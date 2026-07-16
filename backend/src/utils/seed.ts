import bcrypt from 'bcryptjs';
import { prisma } from '../db';

/**
 * Seeds the database with default Tenant, Property, PropertyServices and users.
 * Safe to run multiple times; operations are idempotent.
 */
export async function seedDatabase() {
  try {
    console.log('[Seeding] Checking and seeding database default values...');

    // 1. Ensure Default Tenant
    const tenantId = 'default-tenant-uuid';
    let tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          id: tenantId,
          name: 'HospitalityOS Group',
          themeConfig: {
            create: {
              primary: '220 90% 56%',
              secondary: '160 84% 39%'
            }
          }
        }
      });
      console.log(`[Seeding] Created default tenant: ${tenant.name}`);
    }

    // 2. Ensure Default Property
    const propertyId = 'default-property-uuid';
    let property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) {
      property = await prisma.property.create({
        data: {
          id: propertyId,
          name: 'Grand Horizon Hotel & Cafe',
          tenantId: tenantId,
          attendancePolicy: {
            lateThresholdMinutes: 15,
            halfDayThresholdHours: 4
          }
        }
      });
      console.log(`[Seeding] Created default property: ${property.name}`);
    }

    // 3. Property Services
    const serviceTypes = [
      'HOTEL_ROOM_SERVICE',
      'RESTAURANT_BOOKING',
      'BANQUET_BOOKING',
      'BAR_RESERVATION',
      'CAFE_RESERVATION'
    ] as const;

    for (const serviceType of serviceTypes) {
      const exists = await prisma.propertyService.findFirst({ where: { propertyId, serviceType } });
      if (!exists) {
        await prisma.propertyService.create({
          data: {
            propertyId,
            serviceType,
            label: serviceType
              .split('_')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ')
          }
        });
        console.log(`[Seeding] Created property service: ${serviceType}`);
      }
    }

    // 4. Hotel inventory and business settings
    const roomTypesData = [
      { name: 'Deluxe Suite', capacityAdults: 2, capacityChildren: 2, nightlyRate: 220.0, description: 'Premium room with city view.' },
      { name: 'Executive Room', capacityAdults: 2, capacityChildren: 1, nightlyRate: 170.0, description: 'Stylish room for business travelers.' },
      { name: 'Family Suite', capacityAdults: 4, capacityChildren: 2, nightlyRate: 320.0, description: 'Spacious family accommodation.' }
    ];

    for (const roomType of roomTypesData) {
      const exists = await prisma.roomType.findFirst({ where: { propertyId, name: roomType.name } });
      if (!exists) {
        await prisma.roomType.create({
          data: {
            propertyId,
            ...roomType
          }
        });
        console.log(`[Seeding] Created room type: ${roomType.name}`);
      }
    }

    const floorData = [
      { name: 'Ground Floor', level: 0 },
      { name: 'First Floor', level: 1 },
      { name: 'Second Floor', level: 2 }
    ];

    for (const floor of floorData) {
      const exists = await prisma.floor.findFirst({ where: { propertyId, level: floor.level } });
      if (!exists) {
        await prisma.floor.create({
          data: {
            propertyId,
            name: floor.name,
            level: floor.level,
            description: `${floor.name} hospitality wing.`
          }
        });
      }
    }

    const allFloors = await prisma.floor.findMany({ where: { propertyId } });
    const allRoomTypes = await prisma.roomType.findMany({ where: { propertyId } });

    const createRoom = async (number: string, floorName: string, roomTypeName: string, status: string) => {
      const floor = allFloors.find((it) => it.name === floorName);
      const roomType = allRoomTypes.find((it) => it.name === roomTypeName);
      if (!floor || !roomType) return;
      const exists = await prisma.room.findFirst({ where: { propertyId, number } });
      if (!exists) {
        await prisma.room.create({
          data: {
            propertyId,
            floorId: floor.id,
            roomTypeId: roomType.id,
            number,
            status: status as any,
            name: `${roomTypeName} ${number}`,
            category: roomTypeName,
            capacity: roomType.capacityAdults + roomType.capacityChildren,
            bedType: 'King size bed',
            basePrice: roomType.nightlyRate,
            weekendPrice: Number(roomType.nightlyRate) * 1.2,
            seasonalPrice: Number(roomType.nightlyRate) * 1.5,
            gst: 18,
            description: `A beautiful spacious ${roomTypeName} with elegant design and full view.`,
            amenities: 'Free WiFi, AC, Smart TV, Mini Bar, Safe Locker, Premium Toiletries, Bathrobe'
          }
        });
      }
    };

    await createRoom('101', 'Ground Floor', 'Deluxe Suite', 'AVAILABLE');
    await createRoom('102', 'Ground Floor', 'Executive Room', 'OCCUPIED');
    await createRoom('103', 'Ground Floor', 'Family Suite', 'RESERVED');
    await createRoom('201', 'First Floor', 'Executive Room', 'CLEANING');
    await createRoom('202', 'First Floor', 'Deluxe Suite', 'MAINTENANCE');
    await createRoom('203', 'First Floor', 'Family Suite', 'BLOCKED');

    const propertyInfo = await prisma.hotelInfo.findUnique({ where: { propertyId } });
    if (!propertyInfo) {
      await prisma.hotelInfo.create({
        data: {
          propertyId,
          name: 'Grand Horizon Luxury Hotel',
          address: '143 Royal Avenue, Downtown City',
          phone: '+1 555 0177',
          email: 'frontdesk@grandhorizon.com',
          gstNumber: 'GSTIN123456789',
          description: 'Luxurious city hotel with restaurant, cafe, bar, and banquet facilities.',
          logoUrl: '/uploads/hotel-logo.png'
        }
      });
      console.log('[Seeding] Created hotel info for property');
    }

    const businessSetting = await prisma.businessSetting.findUnique({ where: { propertyId } });
    if (!businessSetting) {
      await prisma.businessSetting.create({
        data: {
          propertyId,
          settings: {
            currency: 'USD',
            timezone: 'America/New_York',
            allowWalkInBookings: true,
            hotelName: 'Grand Horizon Hotel',
            restaurantName: 'Skyline Bistro',
            cafeName: 'Morning Roast',
            barName: 'Velvet Lounge',
            banquetName: 'Crystal Hall'
          }
        }
      });
      console.log('[Seeding] Created business settings');
    }

    const banquetPackages = [
      { name: 'Wedding Celebration', description: 'Full wedding package with catering and décor.', price: 3200.0 },
      { name: 'Corporate Conference', description: 'Premium conference package with AV support.', price: 2800.0 },
      { name: 'Birthday Gala', description: 'Party hall package with cake and lighting.', price: 1700.0 }
    ];

    for (const pack of banquetPackages) {
      const exists = await prisma.banquetPackage.findFirst({ where: { propertyId, name: pack.name } });
      if (!exists) {
        await prisma.banquetPackage.create({
          data: {
            propertyId,
            name: pack.name,
            description: pack.description,
            price: pack.price
          }
        });
      }
    }

    const sampleGuests = [
      { fullName: 'Aisha Khan', phone: '+1 555 0200', email: 'aisha.khan@example.com', idProof: 'Passport A1234567', nationality: 'Indian' },
      { fullName: 'Marcus Lee', phone: '+1 555 0199', email: 'marcus.lee@example.com', idProof: 'Driver License D9876543', nationality: 'American' }
    ];

    for (const guestData of sampleGuests) {
      const exists = await prisma.guest.findFirst({ where: { propertyId, email: guestData.email } });
      if (!exists) {
        await prisma.guest.create({ data: { propertyId, ...guestData } });
      }
    }

    const existingBooking = await prisma.booking.findFirst({ where: { propertyId, bookingNumber: 'BH-2026-001' } });
    const createdByUser = await prisma.user.findFirst({ where: { email: 'admin@hospitalityos.com' } });
    const guest = await prisma.guest.findFirst({ where: { propertyId, email: 'aisha.khan@example.com' } });
    const room101 = await prisma.room.findFirst({ where: { propertyId, number: '101' } });
    const deluxeType = await prisma.roomType.findFirst({ where: { propertyId, name: 'Deluxe Suite' } });
    if (!existingBooking && createdByUser && guest && room101 && deluxeType) {
      const checkIn = new Date();
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkIn.getDate() + 2);
      const nights = 2;
      const rate = 220.0;
      const discount = 20.0;
      const gst = 22.0;
      const advancePaid = 100.0;
      const total = ((rate * nights) - discount) + gst;
      const remainingAmount = total - advancePaid;

      const booking = await prisma.booking.create({
        data: {
          bookingNumber: 'BH-2026-001',
          propertyId,
          guestId: guest.id,
          roomId: room101.id,
          roomTypeId: deluxeType.id,
          createdBy: createdByUser.id,
          checkIn,
          checkOut,
          nights,
          adults: 2,
          children: 1,
          rate,
          discount,
          gst,
          advancePaid,
          remainingAmount,
          status: 'CHECKED_IN',
          paymentStatus: 'PARTIAL',
          specialRequest: 'High floor with late checkout'
        }
      });

      await prisma.invoice.create({
        data: {
          propertyId,
          bookingId: booking.id,
          invoiceNumber: 'INV-2026-001',
          dueDate: new Date(checkOut),
          subtotal: rate * nights,
          taxes: gst,
          discount,
          total,
          status: 'PENDING',
          qrCodeUrl: 'https://example.com/qr/inv-2026-001'
        }
      });

      await prisma.notification.create({
        data: {
          propertyId,
          title: 'New check-in completed',
          body: 'Guest Aisha Khan has checked into Room 101. The front desk has issued the pre-arrival itinerary.',
          type: 'booking'
        }
      });

      console.log('[Seeding] Created sample booking, invoice, and notification');
    }

    const existingService = await prisma.roomServiceRequest.findFirst({ where: { propertyId, title: 'Morning coffee delivery' } });
    if (!existingService && guest) {
      await prisma.roomServiceRequest.create({
        data: {
          propertyId,
          guestId: guest.id,
          category: 'BREAKFAST',
          title: 'Morning coffee delivery',
          notes: 'Serve espresso and croissant to room 101',
          status: 'PENDING'
        }
      });
    }

    const existingHousekeeping = await prisma.housekeepingTask.findFirst({ where: { propertyId, title: 'Refresh Room 102' } });
    if (!existingHousekeeping) {
      await prisma.housekeepingTask.create({
        data: {
          propertyId,
          roomId: room101?.id,
          title: 'Refresh Room 102',
          notes: 'Deep clean after checkout, replenish minibar',
          status: 'PENDING',
          scheduledAt: new Date(new Date().setHours(new Date().getHours() + 3))
        }
      });
    }

    const existingMaintenance = await prisma.maintenanceRequest.findFirst({ where: { propertyId, title: 'Fix AC Unit 202' } });
    if (!existingMaintenance) {
      await prisma.maintenanceRequest.create({
        data: {
          propertyId,
          roomId: room101?.id,
          title: 'Fix AC Unit 202',
          notes: 'Inspect cooling system and replace filter',
          status: 'PENDING',
          priority: 'High'
        }
      });
    }

    const existingMenuVenues = await prisma.menuVenue.findMany({ where: { propertyId } });
    if (existingMenuVenues.length === 0) {
      const restaurantVenue = await prisma.menuVenue.create({ data: { propertyId, type: 'RESTRO', name: 'Skyline Bistro' } });
      const cafeVenue = await prisma.menuVenue.create({ data: { propertyId, type: 'CAFE', name: 'Morning Roast' } });
      const barVenue = await prisma.menuVenue.create({ data: { propertyId, type: 'BAR', name: 'Velvet Lounge' } });
      const banquetVenue = await prisma.menuVenue.create({ data: { propertyId, type: 'BANQUET', name: 'Crystal Hall' } });

      const menuItems = [
        { venueId: restaurantVenue.id, category: 'Starters', name: 'Charred Bruschetta', price: 12.5, description: 'Toasted bread with tomato relish.', isVeg: true },
        { venueId: restaurantVenue.id, category: 'Main Course', name: 'Grilled Salmon', price: 28.0, description: 'Herb butter salmon with seasonal greens.', isVeg: false },
        { venueId: cafeVenue.id, category: 'Coffee', name: 'Vanilla Latte', price: 6.0, description: 'Signature espresso blend with steamed milk.', isVeg: true },
        { venueId: cafeVenue.id, category: 'Pastry', name: 'Almond Croissant', price: 5.5, description: 'Buttery croissant with almond filling.', isVeg: true },
        { venueId: barVenue.id, category: 'Cocktails', name: 'Velvet Martini', price: 14.0, description: 'Premium gin with vermouth and orange twist.', isVeg: true, corkageAllowed: false },
        { venueId: barVenue.id, category: 'Wine', name: 'Pinot Noir', price: 18.0, description: 'Smooth red wine with berry notes.', isVeg: true },
        { venueId: banquetVenue.id, category: 'Packages', name: 'Executive Conference Plan', price: 4500.0, description: 'Meeting hall with plated lunch and AV support.', isVeg: true }
      ];

      for (const item of menuItems) {
        await prisma.menuItem.create({ data: { ...item, createdBy: createdByUser?.id || '' } });
      }
      console.log('[Seeding] Created sample menu venues and items');
    }

    // 5. Seed helper
    const seedUser = async (email: string, name: string, role: any, propId: string | null) => {
      const normalizedEmail = String(email).trim().toLowerCase();
      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (!existing) {
        const hashedPassword = await bcrypt.hash('password123', 12);
        await prisma.user.create({
          data: {
            email: normalizedEmail,
            name,
            password: hashedPassword,
            role,
            status: 'ACTIVE',
            tenantId: tenant.id,
            propertyId: propId
          }
        });
        console.log(`[Seeding] Seeding user: ${normalizedEmail} (${role})`);
      } else {
        await prisma.user.update({ where: { email: normalizedEmail }, data: { status: 'ACTIVE' } });
      }
    };

    // 5. Create standard users
    await seedUser('superadmin@hospitalityos.com', 'Super Admin User', 'SUPER_ADMIN', null);
    await seedUser('admin@hospitalityos.com', 'Admin User', 'ADMIN', propertyId);

    // Ensure requested default admin per requirements
    const defaultAdminEmail = 'atharvalikhar@gmail.com';
    const defaultAdminName = 'atharvalikhar';
    const normalizedAdminEmail = String(defaultAdminEmail).trim().toLowerCase();
    const existingAdmin = await prisma.user.findUnique({ where: { email: normalizedAdminEmail } });
    const defaultAdminPassword = '123456789';
    const hashedAdminPassword = await bcrypt.hash(defaultAdminPassword, 12);
    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          email: normalizedAdminEmail,
          name: defaultAdminName,
          password: hashedAdminPassword,
          role: 'ADMIN',
          status: 'ACTIVE',
          tenantId: tenant.id,
          propertyId: property.id
        }
      });
      console.log(`[Seeding] Created default admin: ${normalizedAdminEmail}`);
    } else {
      await prisma.user.update({
        where: { email: normalizedAdminEmail },
        data: {
          status: 'ACTIVE',
          role: 'ADMIN',
          propertyId: property.id,
          name: defaultAdminName,
          password: hashedAdminPassword
        }
      });
    }

    await seedUser('manager@hospitalityos.com', 'Manager User', 'MANAGER', propertyId);
    await seedUser('waiter@hospitalityos.com', 'Waiter User', 'WAITER', propertyId);
    await seedUser('kitchen@hospitalityos.com', 'Kitchen User', 'KITCHEN', propertyId);
    await seedUser('user@hospitalityos.com', 'Guest User', 'USER', propertyId);

    console.log('[Seeding] Seeding completed successfully!');
  } catch (err: any) {
    console.error('[Seeding Error] Seeding process failed:', err?.message || err);
    throw err;
  }
}

// Run when executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('[Seeding] Completed run.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seeding] Failed:', err?.message || err);
      process.exit(1);
    });
}
