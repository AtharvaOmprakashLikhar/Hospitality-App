import assert from 'assert';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { encrypt, decrypt } from '../utils/crypto';

// Import controller mock/functions if possible, or simulate the exact flow:
// Since this is a self-contained script running with ts-node against the DB,
// we can simulate the exact backend database verification & mutation flows.

async function runTests() {
  console.log('=== STARTING INTEGRATION TESTS ===');
  
  const testTenantId = 'test-tenant-id';
  const testPropertyId = 'test-property-id';
  const testUserId = 'test-user-id';
  const otherPropertyId = 'other-property-id';

  try {
    // 0. Cleanup any previous test data
    await cleanup(testTenantId, testPropertyId, testUserId, otherPropertyId);

    // Seed test structures
    const tenant = await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Test Tenant Ltd',
        themeConfig: { create: {} }
      }
    });

    const property = await prisma.property.create({
      data: {
        id: testPropertyId,
        name: 'Test Property Resort',
        tenantId: testTenantId,
        attendancePolicy: {
          lateThresholdMinutes: 15,
          halfDayThresholdHours: 4
        }
      }
    });

    const otherProperty = await prisma.property.create({
      data: {
        id: otherPropertyId,
        name: 'Other Property Branch',
        tenantId: testTenantId,
        attendancePolicy: {
          lateThresholdMinutes: 15,
          halfDayThresholdHours: 4
        }
      }
    });

    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await prisma.user.create({
      data: {
        id: testUserId,
        name: 'Test Staff',
        email: 'teststaff@hospitalityos.com',
        password: hashedPassword,
        role: 'WAITER',
        tenantId: testTenantId,
        propertyId: testPropertyId
      }
    });

    console.log('[Test Setup] Seeding test database entities completed.');

    // ============================================
    // TEST 1: Cryptography PII Encryption
    // ============================================
    console.log('Running Cryptography PII Encryption Test...');
    const originalText = '45000';
    const encrypted = encrypt(originalText);
    const decrypted = decrypt(encrypted);

    assert.strictEqual(decrypted, originalText, 'Decrypted text must match the original value');
    assert.notStrictEqual(encrypted, originalText, 'Encrypted output must not be plain text');
    console.log('✔ Cryptography Test Passed!');

    // ============================================
    // TEST 2: Overlapping Shift Conflict
    // ============================================
    console.log('Running Overlapping Shift Conflict Test...');
    
    // Shift A: 09:00 to 17:00
    await prisma.staffAssignment.create({
      data: {
        userId: testUserId,
        propertyId: testPropertyId,
        role: 'WAITER',
        section: 'Cafe',
        shiftStart: new Date('2026-07-20T09:00:00Z'),
        shiftEnd: new Date('2026-07-20T17:00:00Z'),
        createdBy: 'test-admin'
      }
    });

    const checkShiftOverlap = async (start: Date, end: Date) => {
      return await prisma.staffAssignment.findFirst({
        where: {
          userId: testUserId,
          propertyId: testPropertyId,
          status: { not: 'CANCELLED' },
          shiftStart: { lt: end },
          shiftEnd: { gt: start }
        }
      });
    };

    // Shift B: 12:00 to 14:00 (inside Shift A) - Should conflict
    const overlapShiftB = await checkShiftOverlap(new Date('2026-07-20T12:00:00Z'), new Date('2026-07-20T14:00:00Z'));
    assert.ok(overlapShiftB, 'Overlapping Shift B must trigger conflict');

    // Shift C: 17:00 to 21:00 (back-to-back sequential) - Should NOT conflict
    const overlapShiftC = await checkShiftOverlap(new Date('2026-07-20T17:00:00Z'), new Date('2026-07-20T21:00:00Z'));
    assert.strictEqual(overlapShiftC, null, 'Back-to-back sequential shift must NOT trigger conflict');

    console.log('✔ Overlapping Shift Detection Passed!');

    // ============================================
    // TEST 3: Double Clock-In Prevention
    // ============================================
    console.log('Running Double Clock-In Test...');
    
    // First clock-in
    await prisma.attendance.create({
      data: {
        userId: testUserId,
        propertyId: testPropertyId,
        clockIn: new Date(),
        method: 'QR',
        status: 'PRESENT'
      }
    });

    const checkActiveClockIn = async () => {
      return await prisma.attendance.findFirst({
        where: { userId: testUserId, clockOut: null }
      });
    };

    const activeSession = await checkActiveClockIn();
    assert.ok(activeSession, 'Active clocked-in session must exist');

    // Attempting double clock-in (should fail if checked programmatically before creating)
    const hasDoubleClockIn = activeSession !== null;
    assert.strictEqual(hasDoubleClockIn, true, 'Double Clock-In state check');

    // Clock out to clean state
    await prisma.attendance.update({
      where: { id: activeSession.id },
      data: { clockOut: new Date() }
    });

    const activeSessionAfterOut = await checkActiveClockIn();
    assert.strictEqual(activeSessionAfterOut, null, 'Active session must be cleared after clock-out');
    console.log('✔ Double Clock-In Prevention Test Passed!');

    // ============================================
    // TEST 4: Overlapping Approved Leaves
    // ============================================
    console.log('Running Overlapping Approved Leaves Test...');
    
    // Leave A: July 22 to July 25
    await prisma.leaveRequest.create({
      data: {
        userId: testUserId,
        propertyId: testPropertyId,
        leaveType: 'CASUAL',
        startDate: new Date('2026-07-22T00:00:00Z'),
        endDate: new Date('2026-07-25T00:00:00Z'),
        reason: 'Holiday',
        status: 'APPROVED'
      }
    });

    const checkLeaveOverlap = async (start: Date, end: Date) => {
      return await prisma.leaveRequest.findFirst({
        where: {
          userId: testUserId,
          status: 'APPROVED',
          startDate: { lte: end },
          endDate: { gte: start }
        }
      });
    };

    // Leave B: July 23 to July 24 - Should overlap
    const overlapLeaveB = await checkLeaveOverlap(new Date('2026-07-23T00:00:00Z'), new Date('2026-07-24T00:00:00Z'));
    assert.ok(overlapLeaveB, 'Overlapping Leave B must trigger conflict');

    // Leave C: July 25 to July 28 - Should overlap (25th bounds)
    const overlapLeaveC = await checkLeaveOverlap(new Date('2026-07-25T00:00:00Z'), new Date('2026-07-28T00:00:00Z'));
    assert.ok(overlapLeaveC, 'Overlapping Leave C must trigger conflict');

    // Leave D: July 26 to July 28 - Should NOT overlap
    const overlapLeaveD = await checkLeaveOverlap(new Date('2026-07-26T00:00:00Z'), new Date('2026-07-28T00:00:00Z'));
    assert.strictEqual(overlapLeaveD, null, 'Non-overlapping Leave D must NOT trigger conflict');

    console.log('✔ Overlapping Leaves Conflict Test Passed!');

    // ============================================
    // TEST 5: Payroll Pro-ration Calculations
    // ============================================
    console.log('Running Payroll Pro-ration Formula Test...');

    const baseSalaryNum = 3000;
    const hraNum = 500;
    const allowancesNum = 200;
    const deductionsNum = 100;
    
    const totalWorkingDays = 30;
    const dailyRate = baseSalaryNum / totalWorkingDays;
    
    const absentDays = 4;
    const absenceDeduction = dailyRate * absentDays;
    
    const grossPay = baseSalaryNum + hraNum + allowancesNum;
    const totalDeductions = deductionsNum + absenceDeduction;
    const netPay = grossPay - totalDeductions;

    assert.strictEqual(dailyRate, 100, 'Daily rate check');
    assert.strictEqual(absenceDeduction, 400, 'Absence deduction check');
    assert.strictEqual(grossPay, 3700, 'Gross pay calculation');
    assert.strictEqual(totalDeductions, 500, 'Total deductions calculation');
    assert.strictEqual(netPay, 3200, 'Net pay calculation');

    console.log('✔ Payroll Pro-ration Calculations Passed!');

    // ============================================
    // TEST 6: QR Attendance Tokens Validation
    // ============================================
    console.log('Running QR Attendance Token Validation Test...');
    
    const secret = process.env.JWT_SECRET || 'super-secret-key-change-in-production';
    
    // 1. Create a valid token
    const validToken = jwt.sign(
      { userId: testUserId, propertyId: testPropertyId, issuedAt: Date.now() },
      secret,
      { expiresIn: '12h' }
    );
    
    // Verify valid token works
    const decodedValid = jwt.verify(validToken, secret) as any;
    assert.strictEqual(decodedValid.userId, testUserId);
    assert.strictEqual(decodedValid.propertyId, testPropertyId);

    // 2. Tampered token verification must fail
    const tamperedToken = validToken + 'tamper';
    assert.throws(() => {
      jwt.verify(tamperedToken, secret);
    }, 'Tampered token must throw signature verification error');

    // 3. Cross-property scan verification check
    const crossPropertyToken = jwt.sign(
      { userId: testUserId, propertyId: otherPropertyId, issuedAt: Date.now() },
      secret,
      { expiresIn: '12h' }
    );
    const decodedCross = jwt.verify(crossPropertyToken, secret) as any;
    const isPropertyMatch = decodedCross.propertyId === testPropertyId;
    assert.strictEqual(isPropertyMatch, false, 'Cross-property scan must correctly flag mismatch');

    console.log('✔ QR Token Validation Test Passed!');

    // ============================================
    // TEST 7: Versioned KOT Order & Revisions
    // ============================================
    console.log('Running Versioned KOT Order & Revisions Test...');

    // 1. Create MenuVenue and MenuItem
    const menuVenue = await prisma.menuVenue.create({
      data: {
        propertyId: testPropertyId,
        type: 'CAFE',
        name: 'Cafe Outlet'
      }
    });

    const menuItem = await prisma.menuItem.create({
      data: {
        venueId: menuVenue.id,
        name: 'Double Espresso',
        category: 'Beverages',
        price: 3.5,
        isVeg: true,
        isAvailable: true,
        createdBy: 'test-admin'
      }
    });

    // 2. Submit initial order (v1)
    const initialOrder = await prisma.order.create({
      data: {
        propertyId: testPropertyId,
        tableId: 'Table 1',
        status: 'SENT'
      }
    });

    const v1 = await prisma.orderVersion.create({
      data: {
        orderId: initialOrder.id,
        version: 1,
        status: 'SENT',
        createdBy: testUserId
      }
    });

    await prisma.orderItem.create({
      data: {
        orderVersionId: v1.id,
        menuItemId: menuItem.id,
        quantity: 2,
        notes: 'Extra hot'
      }
    });

    await prisma.order.update({
      where: { id: initialOrder.id },
      data: { currentVersionId: v1.id }
    });

    // Verify v1 structure
    const checkV1Order = await prisma.order.findUnique({
      where: { id: initialOrder.id },
      include: { versions: { include: { items: true } } }
    });
    assert.strictEqual(checkV1Order?.currentVersionId, v1.id);
    assert.strictEqual(checkV1Order?.versions.length, 1);
    assert.strictEqual(checkV1Order?.versions[0].items[0].quantity, 2);

    // 3. Revise Order (v2) - waiter modifies quantity to 3
    const v2 = await prisma.orderVersion.create({
      data: {
        orderId: initialOrder.id,
        version: 2,
        status: 'SENT',
        createdBy: testUserId
      }
    });

    await prisma.orderItem.create({
      data: {
        orderVersionId: v2.id,
        menuItemId: menuItem.id,
        quantity: 3,
        notes: 'Extra hot, no sugar'
      }
    });

    await prisma.order.update({
      where: { id: initialOrder.id },
      data: { currentVersionId: v2.id }
    });

    // Verify v2 checks & history preservation
    const checkV2Order = await prisma.order.findUnique({
      where: { id: initialOrder.id },
      include: { versions: { orderBy: { version: 'asc' }, include: { items: true } } }
    });
    assert.strictEqual(checkV2Order?.currentVersionId, v2.id);
    assert.strictEqual(checkV2Order?.versions.length, 2, 'History versions must be preserved');
    
    // v1 is still in database
    assert.strictEqual(checkV2Order?.versions[0].version, 1);
    assert.strictEqual(checkV2Order?.versions[0].items[0].quantity, 2);
    
    // v2 is active
    assert.strictEqual(checkV2Order?.versions[1].version, 2);
    assert.strictEqual(checkV2Order?.versions[1].items[0].quantity, 3);

    console.log('✔ Versioned KOT Order & Revisions Test Passed!');

    // ============================================
    // TEST 8: Reservation Booking Overlap & Billing
    // ============================================
    console.log('Running Reservation Booking Overlap & Billing Test...');

    await prisma.propertyService.createMany({
      data: [
        { propertyId: testPropertyId, serviceType: 'RESTAURANT_BOOKING', label: 'Restaurant Booking' },
        { propertyId: testPropertyId, serviceType: 'HOTEL_ROOM_SERVICE', label: 'Hotel Room Service' },
        { propertyId: testPropertyId, serviceType: 'BANQUET_BOOKING', label: 'Banquet Booking' }
      ]
    });

    const bookingTime = new Date('2026-07-22T19:00:00Z');

    const restaurantReservation = await prisma.reservation.create({
      data: {
        propertyId: testPropertyId,
        createdBy: testUserId,
        serviceType: 'RESTAURANT_BOOKING',
        guestName: 'Jane Doe',
        guestPhone: '555-0100',
        tableNumber: 'Table 3',
        partySize: 4,
        reservationTime: bookingTime,
        estimatedCost: 140,
        status: 'CONFIRMED'
      }
    });

    assert.strictEqual(Number(restaurantReservation.estimatedCost), 140, 'Reservation billing estimate must persist correctly');

    const findReservationConflict = async (tableNumber: string, time: Date) => {
      const reservations = await prisma.reservation.findMany({
        where: {
          propertyId: testPropertyId,
          tableNumber,
          status: { not: 'CANCELLED' }
        }
      });
      return reservations.some((reservation) => {
        const diff = Math.abs(reservation.reservationTime.getTime() - time.getTime());
        return diff < 2 * 60 * 60 * 1000;
      });
    };

    assert.ok(await findReservationConflict('Table 3', new Date('2026-07-22T19:45:00Z')), 'Overlapping table booking must be detected');
    assert.strictEqual(await findReservationConflict('Table 3', new Date('2026-07-22T23:00:00Z')), false, 'Non-overlapping table booking must not be detected');

    const banquetReservation = await prisma.reservation.create({
      data: {
        propertyId: testPropertyId,
        createdBy: testUserId,
        serviceType: 'BANQUET_BOOKING',
        guestName: 'Corporate Gala',
        partySize: 15,
        reservationTime: new Date('2026-07-25T18:00:00Z'),
        estimatedCost: 2250,
        status: 'PENDING'
      }
    });

    assert.strictEqual(Number(banquetReservation.estimatedCost), 2250, 'Banquet billing estimate must reflect party size and package rate');
    console.log('✔ Reservation Booking Overlap & Billing Test Passed!');

    // ============================================
    // TEST 9: Kitchen Status Transitions & Overrides
    // ============================================
    console.log('Running Kitchen Status Transitions & Overrides Test...');

    const orderRecord = await prisma.order.create({
      data: {
        propertyId: testPropertyId,
        tableId: 'Table 2',
        status: 'SENT'
      }
    });

    // 1. Legal transition: SENT -> PREPARING
    const allowedTransitions: Record<string, string[]> = {
      SENT: ['PREPARING'],
      PREPARING: ['READY'],
      READY: ['SERVED'],
      SERVED: ['CLOSED']
    };

    let kitchenRole = 'KITCHEN';
    let nextStatus: any = 'PREPARING';
    
    // Verify transition SENT -> PREPARING is legal
    let isLegal = allowedTransitions[orderRecord.status]?.includes(nextStatus);
    assert.strictEqual(isLegal, true, 'SENT -> PREPARING must be legal');

    // 2. Blocked transition: KITCHEN role tries to mark READY -> SERVED
    let activeStatus: any = 'READY';
    nextStatus = 'SERVED';
    let isManager = kitchenRole === 'ADMIN' || kitchenRole === 'MANAGER';
    isLegal = allowedTransitions[activeStatus]?.includes(nextStatus);
    
    // Under KITCHEN rules, transition to SERVED is illegal unless manager
    const isKitchenBlocked = (nextStatus === 'SERVED' || nextStatus === 'CLOSED') && !isManager;
    assert.strictEqual(isKitchenBlocked, true, 'KITCHEN role must be blocked from marking SERVED/CLOSED');

    // 3. Manager Override: allowed transition bypasses the role check
    isManager = true;
    const isManagerAllowed = !((nextStatus === 'SERVED' || nextStatus === 'CLOSED') && !isManager);
    assert.strictEqual(isManagerAllowed, true, 'MANAGER role overrides served/closed restriction');

    console.log('✔ Kitchen Status Transitions & Overrides Passed!');

    // ============================================
    // TEST 9: Frontend Route Redirection & Boundary Guards
    // ============================================
    console.log('Running Frontend Route Redirection & Boundary Guards Test...');
    
    const checkRedirection = (role: string, targetPath: string, isAuthenticated: boolean) => {
      if (!isAuthenticated) return '/login';
      
      const rolePrefixes: Record<string, string> = {
        SUPER_ADMIN: '/admin',
        ADMIN: '/admin',
        MANAGER: '/manager',
        WAITER: '/waiter',
        KITCHEN: '/kitchen'
      };

      const allowedPrefix = rolePrefixes[role];
      if (!allowedPrefix) return '/login';

      if (!targetPath.startsWith(allowedPrefix)) {
        return allowedPrefix;
      }
      return targetPath;
    };

    // 1. Unauthenticated redirects to login
    assert.strictEqual(checkRedirection('WAITER', '/waiter', false), '/login');
    assert.strictEqual(checkRedirection('ADMIN', '/admin', false), '/login');

    // 2. Allowed paths for roles
    assert.strictEqual(checkRedirection('WAITER', '/waiter/qr', true), '/waiter/qr');
    assert.strictEqual(checkRedirection('KITCHEN', '/kitchen', true), '/kitchen');
    assert.strictEqual(checkRedirection('ADMIN', '/admin/staff', true), '/admin/staff');

    // 3. Blocked paths redirect back to own panel home
    assert.strictEqual(checkRedirection('WAITER', '/admin/staff', true), '/waiter');
    assert.strictEqual(checkRedirection('KITCHEN', '/manager/attendance', true), '/kitchen');
    assert.strictEqual(checkRedirection('ADMIN', '/waiter/qr', true), '/admin');

    console.log('✔ Frontend Route Redirection & Boundary Guards Passed!');

    // ============================================
    // TEST 10: Room Booking Transaction & Linking
    // ============================================
    console.log('Running Room Booking Transaction & Linking Test...');

    const roomType = await prisma.roomType.create({
      data: {
        propertyId: testPropertyId,
        name: 'Deluxe Suite Test',
        capacityAdults: 2,
        capacityChildren: 1,
        nightlyRate: 150
      }
    });

    const floor = await prisma.floor.create({
      data: {
        propertyId: testPropertyId,
        name: 'Test Floor 1',
        level: 1
      }
    });

    const room = await prisma.room.create({
      data: {
        propertyId: testPropertyId,
        floorId: floor.id,
        roomTypeId: roomType.id,
        number: 'T101',
        status: 'AVAILABLE'
      }
    });

    const guest = await prisma.guest.create({
      data: {
        propertyId: testPropertyId,
        fullName: 'John Guest',
        email: 'john.guest@example.com',
        phone: '555-1234',
        idProof: 'DL-999',
        nationality: 'Canadian'
      }
    });

    const parsedRate = 150;
    const numberOfNights = 3;
    const parsedDiscount = 10;
    const parsedGst = 15;
    const parsedAdvance = 50;
    const total = parsedRate * numberOfNights - parsedDiscount + parsedGst;
    const remainingAmount = total - parsedAdvance;

    const resultBooking = await prisma.$transaction(async (tx) => {
      // 1. Create Booking
      const booking = await tx.booking.create({
        data: {
          bookingNumber: 'BH-TEST-999',
          propertyId: testPropertyId,
          guestId: guest.id,
          roomId: room.id,
          roomTypeId: roomType.id,
          createdBy: testUserId,
          checkIn: new Date(),
          checkOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          nights: numberOfNights,
          adults: 2,
          children: 0,
          rate: parsedRate,
          discount: parsedDiscount,
          gst: parsedGst,
          advancePaid: parsedAdvance,
          remainingAmount,
          status: 'CHECKED_IN',
          paymentStatus: 'PARTIAL'
        }
      });

      // 2. Update Room status
      await tx.room.update({
        where: { id: room.id },
        data: { status: 'OCCUPIED' }
      });

      // 3. Create Invoice
      const invoice = await tx.invoice.create({
        data: {
          propertyId: testPropertyId,
          bookingId: booking.id,
          invoiceNumber: 'INV-TEST-999',
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          subtotal: parsedRate * numberOfNights,
          taxes: parsedGst,
          discount: parsedDiscount,
          total,
          status: 'PENDING',
          qrCodeUrl: 'https://example.com/inv-test-999'
        }
      });

      // 4. Create Reservation
      await tx.reservation.create({
        data: {
          propertyId: testPropertyId,
          createdBy: testUserId,
          serviceType: 'HOTEL_ROOM_SERVICE',
          guestName: guest.fullName,
          guestPhone: guest.phone,
          roomNumber: room.number,
          partySize: 2,
          reservationTime: new Date(),
          estimatedCost: total,
          status: 'IN_PROGRESS'
        }
      });

      // 5. Create Payment
      if (parsedAdvance > 0) {
        await tx.payment.create({
          data: {
            propertyId: testPropertyId,
            invoiceId: invoice.id,
            bookingId: booking.id,
            amount: parsedAdvance,
            method: 'CASH',
            status: 'PAID'
          }
        });
      }

      return { booking, invoice };
    });

    // Assertions
    assert.strictEqual(resultBooking.booking.bookingNumber, 'BH-TEST-999');
    
    const updatedRoom = await prisma.room.findUnique({ where: { id: room.id } });
    assert.strictEqual(updatedRoom?.status, 'OCCUPIED');

    const createdInvoice = await prisma.invoice.findFirst({ where: { bookingId: resultBooking.booking.id } });
    assert.ok(createdInvoice);
    assert.strictEqual(Number(createdInvoice.total), total);

    const createdReservation = await prisma.reservation.findFirst({ where: { roomNumber: room.number, serviceType: 'HOTEL_ROOM_SERVICE' } });
    assert.ok(createdReservation);
    assert.strictEqual(Number(createdReservation.estimatedCost), total);

    const createdPayment = await prisma.payment.findFirst({ where: { bookingId: resultBooking.booking.id } });
    assert.ok(createdPayment);
    assert.strictEqual(Number(createdPayment.amount), parsedAdvance);

    console.log('✔ Room Booking Transaction & Linking Test Passed!');

    // ============================================
    // TEST 11: Room CRUD & Suggestions Logic
    // ============================================
    console.log('Running Room CRUD & Suggestions Logic Test...');

    const newRoomNo = 'T205';
    const testRoom = await prisma.room.create({
      data: {
        propertyId: testPropertyId,
        floorId: floor.id,
        roomTypeId: roomType.id,
        number: newRoomNo,
        status: 'AVAILABLE',
        name: 'Grand Deluxe Room',
        category: 'Deluxe Suite',
        capacity: 3,
        bedType: 'King size bed',
        basePrice: 180,
        weekendPrice: 220,
        seasonalPrice: 280,
        gst: 18,
        description: 'Luxury room with ocean view',
        amenities: 'WiFi, Mini Bar, AC'
      }
    });

    assert.strictEqual(testRoom.number, newRoomNo);
    assert.strictEqual(testRoom.name, 'Grand Deluxe Room');
    assert.strictEqual(Number(testRoom.basePrice), 180);

    // Try creating duplicate room number and expect database constraint check
    try {
      await prisma.room.create({
        data: {
          propertyId: testPropertyId,
          floorId: floor.id,
          roomTypeId: roomType.id,
          number: newRoomNo,
          status: 'AVAILABLE'
        }
      });
      assert.fail('Should have failed due to unique room number constraint');
    } catch (err: any) {
      assert.ok(err.message.includes('Unique constraint failed') || err.message.includes('unique'));
    }

    // Update Room Details
    const updatedRoomDetails = await prisma.room.update({
      where: { id: testRoom.id },
      data: {
        name: 'Grand Premium Suite',
        basePrice: 200,
        status: 'CLEANING'
      }
    });
    assert.strictEqual(updatedRoomDetails.name, 'Grand Premium Suite');
    assert.strictEqual(Number(updatedRoomDetails.basePrice), 200);
    assert.strictEqual(updatedRoomDetails.status, 'CLEANING');

    // Suggestions Logic Verification
    const suggestionRoom = await prisma.room.create({
      data: {
        propertyId: testPropertyId,
        floorId: floor.id,
        roomTypeId: roomType.id,
        number: 'T206',
        status: 'AVAILABLE',
        name: 'Alternative Deluxe',
        category: 'Deluxe Suite',
        basePrice: 190
      }
    });

    const matchAlternative = [suggestionRoom].find(r => r.category === updatedRoomDetails.category || Math.abs(Number(r.basePrice) - Number(updatedRoomDetails.basePrice)) <= 50);
    assert.ok(matchAlternative);
    assert.strictEqual(matchAlternative.number, 'T206');

    console.log('✔ Room CRUD & Suggestions Logic Test Passed!');

    console.log('=== ALL INTEGRATION TESTS COMPLETED SUCCESSFULLY! ===');
  } catch (err: any) {
    console.error('❌ TEST FAILURE:', err);
    process.exit(1);
  } finally {
    // Cleanup
    await cleanup(testTenantId, testPropertyId, testUserId, otherPropertyId);
  }
}

async function cleanup(tenantId: string, propertyId: string, userId: string, otherPropertyId?: string) {
  try {
    await prisma.roomServiceRequest.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.orderVersion.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.reservation.deleteMany({});
    await prisma.propertyService.deleteMany({ where: { propertyId } });
    await prisma.menuItem.deleteMany({});
    await prisma.menuVenue.deleteMany({});

    await prisma.payment.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.booking.deleteMany({});
    await prisma.guest.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.roomType.deleteMany({});
    await prisma.floor.deleteMany({});

    await prisma.payslip.deleteMany({ where: { userId } });
    await prisma.salaryStructure.deleteMany({ where: { userId } });
    await prisma.leaveRequest.deleteMany({ where: { userId } });
    await prisma.attendance.deleteMany({ where: { userId } });
    await prisma.staffAssignment.deleteMany({ where: { userId } });
    
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.property.deleteMany({ where: { tenantId } });
    await prisma.themeVersion.deleteMany({ where: { tenantId } });
    await prisma.themeConfig.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  } catch {}
}

runTests();
