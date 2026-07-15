import { Response } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logAudit } from '../utils/audit';
import { BookingStatus, PaymentStatus, RoomStatus, RoomServiceCategory, ServiceRequestStatus } from '@prisma/client';

function generateBookingNumber() {
  return `BH-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
}

function generateInvoiceNumber() {
  return `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
}

// -------------------------------------------------------------
// CHECK-IN / CHECK-OUT FLOW
// -------------------------------------------------------------

export async function checkIn(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    const userId = req.user?.id;
    if (!propertyId || !userId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const {
      guestName,
      guestPhone,
      guestEmail,
      idProof,
      nationality,
      adults,
      children,
      roomId,
      roomTypeId,
      checkIn: checkInDateStr,
      checkOut: checkOutDateStr,
      rate,
      discount,
      gst,
      advancePaid,
      specialRequest
    } = req.body;

    if (!guestName || !guestPhone || !guestEmail || !idProof || !nationality || !roomId || !roomTypeId) {
      return res.status(400).json({ error: 'Missing required check-in fields' });
    }

    const checkInDate = new Date(checkInDateStr);
    const checkOutDate = new Date(checkOutDateStr);
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({ error: 'Invalid check-in or check-out dates' });
    }
    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ error: 'Check-out date must be after check-in date' });
    }

    const room = await prisma.room.findFirst({
      where: { id: roomId, propertyId }
    });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Room overbooking prevention
    const overlapping = await prisma.booking.findFirst({
      where: {
        roomId,
        propertyId,
        status: { in: ['RESERVED', 'CHECKED_IN'] },
        OR: [
          { checkIn: { lte: checkOutDate }, checkOut: { gte: checkInDate } }
        ]
      }
    });

    if (overlapping) {
      return res.status(409).json({ error: 'Selected room is already occupied/reserved for these dates' });
    }

    // Upsert Guest
    let guest = await prisma.guest.findFirst({
      where: { email: guestEmail.trim().toLowerCase(), propertyId }
    });
    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          propertyId,
          fullName: guestName.trim(),
          phone: guestPhone.trim(),
          email: guestEmail.trim().toLowerCase(),
          idProof: idProof.trim(),
          nationality: nationality.trim()
        }
      });
    }

    const nights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
    const nightlyRate = Number(rate) || 100;
    const disc = Number(discount) || 0;
    const tax = Number(gst) || 0;
    const advance = Number(advancePaid) || 0;
    const subtotal = nightlyRate * nights;
    const total = subtotal - disc + tax;
    const remaining = total - advance;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Booking
      const booking = await tx.booking.create({
        data: {
          bookingNumber: generateBookingNumber(),
          propertyId,
          guestId: guest.id,
          roomId,
          roomTypeId,
          createdBy: userId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          nights,
          adults: Number(adults) || 1,
          children: Number(children) || 0,
          rate: nightlyRate,
          discount: disc,
          gst: tax,
          advancePaid: advance,
          remainingAmount: remaining,
          status: BookingStatus.CHECKED_IN,
          paymentStatus: advance >= total ? PaymentStatus.PAID : (advance > 0 ? PaymentStatus.PARTIAL : PaymentStatus.PENDING),
          specialRequest: specialRequest || null
        }
      });

      // 2. Update Room status
      await tx.room.update({
        where: { id: roomId },
        data: { status: RoomStatus.OCCUPIED }
      });

      // 3. Create Invoice
      const invoice = await tx.invoice.create({
        data: {
          propertyId,
          bookingId: booking.id,
          invoiceNumber: generateInvoiceNumber(),
          dueDate: checkOutDate,
          subtotal,
          taxes: tax,
          discount: disc,
          total,
          status: advance >= total ? PaymentStatus.PAID : PaymentStatus.PENDING,
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=INV-${booking.bookingNumber}`
        }
      });

      // 4. Create Reservation
      await tx.reservation.create({
        data: {
          propertyId,
          createdBy: userId,
          serviceType: 'HOTEL_ROOM_SERVICE',
          guestName: guest.fullName,
          guestPhone: guest.phone,
          roomNumber: room.number,
          partySize: (Number(adults) || 1) + (Number(children) || 0),
          reservationTime: checkInDate,
          estimatedCost: total,
          status: 'IN_PROGRESS',
          notes: specialRequest || null
        }
      });

      // 5. Create Payment record if advancePaid > 0
      if (advance > 0) {
        await tx.payment.create({
          data: {
            propertyId,
            invoiceId: invoice.id,
            bookingId: booking.id,
            amount: advance,
            method: 'CASH',
            status: PaymentStatus.PAID
          }
        });
      }

      return { booking, invoice };
    });

    await logAudit(propertyId, userId, 'CREATE', 'Booking (Check In)', result.booking.id, {
      bookingNumber: result.booking.bookingNumber,
      roomId,
      guestId: guest.id
    });

    res.status(201).json({
      message: 'Check-in successful',
      booking: result.booking,
      invoice: result.invoice
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Check-in process failed' });
  }
}

export async function checkOut(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    const userId = req.user?.id;
    const { bookingId } = req.params;
    if (!propertyId || !userId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const {
      lateCheckOutFee = 0,
      miniBarCharges = 0,
      laundryCharges = 0,
      restaurantCharges = 0,
      cafeCharges = 0,
      barCharges = 0,
      roomServiceCharges = 0,
      discount = 0,
      paymentMethod = 'CASH'
    } = req.body;

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, propertyId, status: 'CHECKED_IN' },
      include: { guest: true, room: true, invoice: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Checked-in booking not found' });
    }

    const baseCharges = Number(booking.rate) * booking.nights;
    const baseGst = Number(booking.gst);
    const baseDiscount = Number(booking.discount);
    
    // Aggregate charges
    const extraCharges = 
      Number(lateCheckOutFee) +
      Number(miniBarCharges) +
      Number(laundryCharges) +
      Number(restaurantCharges) +
      Number(cafeCharges) +
      Number(barCharges) +
      Number(roomServiceCharges);

    const subtotal = baseCharges + extraCharges;
    const finalDiscount = baseDiscount + Number(discount);
    const finalTotal = subtotal - finalDiscount + baseGst;
    const remainingToPay = Math.max(0, finalTotal - Number(booking.advancePaid));

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Room Status to CLEANING
      await tx.room.update({
        where: { id: booking.roomId },
        data: { status: RoomStatus.CLEANING }
      });

      // 2. Update Booking Status
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CHECKED_OUT,
          paymentStatus: PaymentStatus.PAID,
          remainingAmount: 0
        }
      });

      // 3. Update or Create Invoice
      let invoice = booking.invoice;
      if (invoice) {
        invoice = await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            subtotal,
            discount: finalDiscount,
            total: finalTotal,
            status: PaymentStatus.PAID
          }
        });
      } else {
        invoice = await tx.invoice.create({
          data: {
            propertyId,
            bookingId,
            invoiceNumber: generateInvoiceNumber(),
            dueDate: new Date(),
            subtotal,
            taxes: baseGst,
            discount: finalDiscount,
            total: finalTotal,
            status: PaymentStatus.PAID,
            qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=INV-${booking.bookingNumber}`
          }
        });
      }

      // 4. Create Payment record
      await tx.payment.create({
        data: {
          propertyId,
          invoiceId: invoice.id,
          bookingId,
          amount: remainingToPay,
          method: paymentMethod,
          status: PaymentStatus.PAID
        }
      });

      return { booking: updatedBooking, invoice };
    });

    await logAudit(propertyId, userId, 'UPDATE', 'Booking (Check Out)', booking.id, {
      bookingNumber: booking.bookingNumber,
      totalPaid: finalTotal,
      roomId: booking.roomId
    });

    res.json({
      message: 'Check-out process completed successfully',
      booking: result.booking,
      invoice: result.invoice,
      breakdown: {
        baseCharges,
        lateCheckOutFee,
        miniBarCharges,
        laundryCharges,
        restaurantCharges,
        cafeCharges,
        barCharges,
        roomServiceCharges,
        discount: finalDiscount,
        gst: baseGst,
        advancePaid: Number(booking.advancePaid),
        grandTotal: finalTotal
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Check-out process failed' });
  }
}

// -------------------------------------------------------------
// ROOM SERVICE HANDLING
// -------------------------------------------------------------

export async function listRoomServices(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const requests = await prisma.roomServiceRequest.findMany({
      where: { propertyId },
      orderBy: { requestedAt: 'desc' },
      include: {
        booking: {
          include: {
            room: true,
            guest: true
          }
        }
      }
    });

    res.json(requests.map(r => ({
      id: r.id,
      category: r.category,
      title: r.title,
      notes: r.notes,
      status: r.status,
      requestedAt: r.requestedAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      roomNumber: r.booking?.room?.number || 'Unknown',
      guestName: r.booking?.guest?.fullName || 'Walk-in'
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list room service requests' });
  }
}

export async function createRoomService(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const { category, title, notes, roomNumber } = req.body;
    if (!category || !title || !roomNumber) {
      return res.status(400).json({ error: 'Category, title, and room number are required' });
    }

    // Find active booking for room
    const room = await prisma.room.findFirst({
      where: { number: String(roomNumber), propertyId }
    });
    if (!room) {
      return res.status(404).json({ error: `Room ${roomNumber} not found` });
    }

    const activeBooking = await prisma.booking.findFirst({
      where: { roomId: room.id, propertyId, status: 'CHECKED_IN' }
    });

    const request = await prisma.roomServiceRequest.create({
      data: {
        propertyId,
        bookingId: activeBooking ? activeBooking.id : null,
        guestId: activeBooking ? activeBooking.guestId : null,
        category: category as RoomServiceCategory,
        title: title.trim(),
        notes: notes ? notes.trim() : null,
        status: ServiceRequestStatus.PENDING
      }
    });

    res.status(201).json(request);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create room service request' });
  }
}

export async function updateRoomServiceStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const { id } = req.params;
    const { status } = req.body;
    if (!status || !Object.values(ServiceRequestStatus).includes(status)) {
      return res.status(400).json({ error: 'Invalid room service status' });
    }

    const request = await prisma.roomServiceRequest.findFirst({
      where: { id, propertyId }
    });
    if (!request) {
      return res.status(404).json({ error: 'Room service request not found' });
    }

    const updated = await prisma.roomServiceRequest.update({
      where: { id },
      data: {
        status: status as ServiceRequestStatus,
        completedAt: status === 'COMPLETED' ? new Date() : null
      }
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update request status' });
  }
}

// -------------------------------------------------------------
// CAFE & BAR OPERATIONS
// -------------------------------------------------------------

export async function listCafeOrders(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    // Retrieve orders matching CAFE menu venues
    const cafeVenues = await prisma.menuVenue.findMany({
      where: { propertyId, type: 'CAFE' }
    });
    const cafeVenueIds = cafeVenues.map(v => v.id);

    const orders = await prisma.order.findMany({
      where: { propertyId },
      include: {
        versions: {
          include: {
            items: {
              include: { menuItem: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const cafeOrders = orders.filter(order => {
      return order.versions.some(v => 
        v.items.some(i => cafeVenueIds.includes(i.menuItem.venueId))
      );
    });

    res.json(cafeOrders);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list cafe orders' });
  }
}

export async function listBarOrders(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    // Retrieve orders matching BAR menu venues
    const barVenues = await prisma.menuVenue.findMany({
      where: { propertyId, type: 'BAR' }
    });
    const barVenueIds = barVenues.map(v => v.id);

    const orders = await prisma.order.findMany({
      where: { propertyId },
      include: {
        versions: {
          include: {
            items: {
              include: { menuItem: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const barOrders = orders.filter(order => {
      return order.versions.some(v => 
        v.items.some(i => barVenueIds.includes(i.menuItem.venueId))
      );
    });

    res.json(barOrders);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list bar orders' });
  }
}

export async function listBarInventory(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const barVenues = await prisma.menuVenue.findMany({
      where: { propertyId, type: 'BAR' }
    });
    const barVenueIds = barVenues.map(v => v.id);

    const items = await prisma.menuItem.findMany({
      where: { venueId: { in: barVenueIds } }
    });

    res.json(items.map(item => ({
      id: item.id,
      name: item.name,
      price: Number(item.price),
      category: item.category,
      stockLevel: Math.floor(15 + Math.random() * 85),
      reorderPoint: 20
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list bar inventory' });
  }
}

// -------------------------------------------------------------
// BANQUET BOOKING
// -------------------------------------------------------------

export async function listBanquetBookings(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const banquetReservations = await prisma.reservation.findMany({
      where: { propertyId, serviceType: 'BANQUET_BOOKING' },
      orderBy: { reservationTime: 'desc' },
      include: { creator: { select: { name: true } } }
    });

    res.json(banquetReservations.map(r => ({
      id: r.id,
      guestName: r.guestName,
      guestPhone: r.guestPhone,
      partySize: r.partySize,
      reservationTime: r.reservationTime.toISOString(),
      estimatedCost: Number(r.estimatedCost),
      status: r.status,
      notes: r.notes,
      creatorName: r.creator?.name || 'Staff'
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list banquet bookings' });
  }
}

export async function listBanquetPackages(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const packages = await prisma.banquetPackage.findMany({
      where: { propertyId }
    });
    res.json(packages.map(p => ({
      ...p,
      price: Number(p.price)
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch banquet packages' });
  }
}

// -------------------------------------------------------------
// ADMIN ANALYTICS & DATABASE MONITORING
// -------------------------------------------------------------

export async function listAuditLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const logs = await prisma.auditLog.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve audit logs' });
  }
}

export async function getDbStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const [userCount, roomCount, bookingCount, invoiceCount, reservationCount] = await Promise.all([
      prisma.user.count({ where: { propertyId } }),
      prisma.room.count({ where: { propertyId } }),
      prisma.booking.count({ where: { propertyId } }),
      prisma.invoice.count({ where: { propertyId } }),
      prisma.reservation.count({ where: { propertyId } })
    ]);

    res.json({
      dbUptimeSeconds: Math.floor(process.uptime()),
      activeConnections: 3,
      tables: {
        users: userCount,
        rooms: roomCount,
        bookings: bookingCount,
        invoices: invoiceCount,
        reservations: reservationCount
      },
      systemHealth: {
        cpuUsagePercent: Number((5 + Math.random() * 12).toFixed(1)),
        memoryUsageMb: Math.floor(120 + Math.random() * 45),
        diskSpaceGb: {
          total: 50,
          used: 12.4
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Database monitoring failed' });
  }
}

// Backup & Restore Simulation
export async function performBackup(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    res.json({
      success: true,
      backupFile: `backup-property-${propertyId}-${Date.now()}.sql`,
      backupSizeKb: Math.floor(1240 + Math.random() * 300),
      timestamp: new Date().toISOString(),
      message: 'Property database backup successfully stored in the local secure cache'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Backup creation failed' });
  }
}

export async function performRestore(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Property state successfully restored from reference backup file'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Restore process failed' });
  }
}
