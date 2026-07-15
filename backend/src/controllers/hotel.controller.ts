import { Response } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logAudit } from '../utils/audit';
import { BookingStatus, PaymentStatus, RoomStatus, RoomServiceCategory, ServiceRequestStatus } from '@prisma/client';

function createBookingNumber() {
  return `BH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function isSameDay(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}

export async function getHotelDashboard(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const rooms = await prisma.room.findMany({ where: { propertyId } });
    const bookings = await prisma.booking.findMany({ where: { propertyId } });
    const invoices = await prisma.invoice.findMany({ where: { propertyId } });
    const pendingServices = await prisma.roomServiceRequest.count({ where: { propertyId, status: 'PENDING' } });

    const now = new Date();
    const arrivalCount = bookings.filter((booking) => isSameDay(booking.checkIn, now) && booking.status === 'RESERVED').length;
    const departureCount = bookings.filter((booking) => isSameDay(booking.checkOut, now) && booking.status === 'CHECKED_IN').length;

    const statusCounts = rooms.reduce<Record<string, number>>((acc, room) => {
      acc[room.status] = (acc[room.status] || 0) + 1;
      return acc;
    }, {});

    const revenue = invoices.reduce((sum, invoice) => sum + Number(invoice.total), 0);
    const pendingPayments = invoices.filter((invoice) => invoice.status === 'PENDING').length;

    const latestBookings = bookings
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map((booking) => ({
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        guestId: booking.guestId,
        roomId: booking.roomId,
        status: booking.status,
        checkIn: booking.checkIn.toISOString(),
        checkOut: booking.checkOut.toISOString(),
        total: Number(booking.rate) * booking.nights - Number(booking.discount) + Number(booking.gst)
      }));

    res.json({
      roomCounts: {
        available: statusCounts.AVAILABLE || 0,
        occupied: statusCounts.OCCUPIED || 0,
        reserved: statusCounts.RESERVED || 0,
        cleaning: statusCounts.CLEANING || 0,
        maintenance: statusCounts.MAINTENANCE || 0,
        blocked: statusCounts.BLOCKED || 0
      },
      expectedArrivals: arrivalCount,
      expectedDepartures: departureCount,
      revenue,
      pendingPayments,
      roomServiceRequests: pendingServices,
      latestBookings
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch hotel dashboard' });
  }
}

export async function getFloors(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const floors = await prisma.floor.findMany({ where: { propertyId }, orderBy: { level: 'asc' } });
    res.json(floors);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch floors' });
  }
}

export async function getRoomTypes(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const roomTypes = await prisma.roomType.findMany({ where: { propertyId }, orderBy: { name: 'asc' } });
    res.json(roomTypes.map((roomType) => ({
      ...roomType,
      nightlyRate: Number(roomType.nightlyRate)
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch room types' });
  }
}

export async function getRooms(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const rooms = await prisma.room.findMany({
      where: { propertyId },
      include: {
        floor: true,
        roomType: true
      },
      orderBy: [{ floorId: 'asc' }, { number: 'asc' }]
    });

    res.json(rooms.map((room) => ({
      ...room,
      status: room.status,
      nightlyRate: Number(room.roomType.nightlyRate)
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch rooms' });
  }
}

export async function getBookings(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const bookings = await prisma.booking.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
      include: {
        guest: true,
        room: true,
        roomType: true
      }
    });

    res.json(bookings.map((booking) => ({
      ...booking,
      rate: Number(booking.rate),
      discount: Number(booking.discount),
      gst: Number(booking.gst),
      advancePaid: Number(booking.advancePaid),
      remainingAmount: Number(booking.remainingAmount),
      checkIn: booking.checkIn.toISOString(),
      checkOut: booking.checkOut.toISOString()
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch bookings' });
  }
}

export async function createBooking(req: AuthenticatedRequest, res: Response) {
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
      roomTypeId,
      roomId,
      checkIn,
      checkOut,
      rate,
      discount,
      gst,
      advancePaid,
      specialRequest
    } = req.body;

    if (!guestName || !guestPhone || !guestEmail || !idProof || !nationality) {
      return res.status(400).json({ error: 'Guest name, phone, email, ID proof and nationality are required' });
    }

    if (!roomTypeId || !roomId) {
      return res.status(400).json({ error: 'Room type and room selection are required' });
    }

    const checkInDate = new Date(String(checkIn));
    const checkOutDate = new Date(String(checkOut));
    if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
      return res.status(400).json({ error: 'Valid check-in and check-out dates are required' });
    }
    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ error: 'Check-out must be after check-in' });
    }

    const numberOfNights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (24 * 60 * 60 * 1000)));
    const parsedRate = Number(rate);
    const parsedDiscount = Number(discount || 0);
    const parsedGst = Number(gst || 0);
    const parsedAdvance = Number(advancePaid || 0);

    if (Number.isNaN(parsedRate) || parsedRate <= 0) {
      return res.status(400).json({ error: 'Rate must be a positive number' });
    }

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room || room.propertyId !== propertyId) {
      return res.status(404).json({ error: 'Room not found for this property' });
    }
    if (['OCCUPIED', 'MAINTENANCE', 'BLOCKED'].includes(room.status)) {
      return res.status(409).json({ error: 'Selected room is not available for booking' });
    }

    const overlappingBooking = await prisma.booking.findFirst({
      where: {
        roomId,
        status: { not: 'CANCELLED' },
        OR: [
          {
            checkIn: { lte: checkOutDate },
            checkOut: { gte: checkInDate }
          }
        ]
      }
    });
    if (overlappingBooking) {
      return res.status(409).json({ error: 'Room is already booked for the selected dates' });
    }

    let guest = await prisma.guest.findFirst({ where: { propertyId, email: String(guestEmail).trim().toLowerCase() } });
    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          propertyId,
          fullName: String(guestName).trim(),
          phone: String(guestPhone).trim(),
          email: String(guestEmail).trim().toLowerCase(),
          idProof: String(idProof).trim(),
          nationality: String(nationality).trim()
        }
      });
    }

    const total = Number((parsedRate * numberOfNights - parsedDiscount + parsedGst).toFixed(2));
    const remainingAmount = Number((total - parsedAdvance).toFixed(2));
    const status = checkInDate <= new Date() ? 'CHECKED_IN' : 'RESERVED';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Booking
      const booking = await tx.booking.create({
        data: {
          bookingNumber: createBookingNumber(),
          propertyId,
          guestId: guest.id,
          roomId,
          roomTypeId,
          createdBy: userId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          nights: numberOfNights,
          adults: Number(adults) || 1,
          children: Number(children) || 0,
          rate: parsedRate,
          discount: parsedDiscount,
          gst: parsedGst,
          advancePaid: parsedAdvance,
          remainingAmount,
          status: status as BookingStatus,
          paymentStatus: parsedAdvance >= total ? PaymentStatus.PAID : (parsedAdvance > 0 ? PaymentStatus.PARTIAL : PaymentStatus.PENDING),
          specialRequest: specialRequest ? String(specialRequest).trim() : null
        }
      });

      // 2. Update Room status
      await tx.room.update({
        where: { id: roomId },
        data: { status: status === 'CHECKED_IN' ? RoomStatus.OCCUPIED : RoomStatus.RESERVED }
      });

      // 3. Create Invoice
      const invoice = await tx.invoice.create({
        data: {
          propertyId,
          bookingId: booking.id,
          invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          dueDate: checkOutDate,
          subtotal: parsedRate * numberOfNights,
          taxes: parsedGst,
          discount: parsedDiscount,
          total,
          status: parsedAdvance >= total ? PaymentStatus.PAID : PaymentStatus.PENDING,
          qrCodeUrl: `https://example.com/invoice/${booking.bookingNumber}`
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
          status: status === 'CHECKED_IN' ? 'IN_PROGRESS' : 'CONFIRMED',
          notes: specialRequest ? String(specialRequest).trim() : null
        }
      });

      // 5. Create Payment record if advancePaid > 0
      if (parsedAdvance > 0) {
        await tx.payment.create({
          data: {
            propertyId,
            invoiceId: invoice.id,
            bookingId: booking.id,
            amount: parsedAdvance,
            method: 'CASH',
            status: PaymentStatus.PAID
          }
        });
      }

      return { booking, invoice };
    });

    const booking = result.booking;

    await prisma.notification.create({
      data: {
        propertyId,
        title: `New booking created: ${booking.bookingNumber}`,
        body: `Guest ${guest.fullName} is scheduled for ${numberOfNights} night(s) in room ${room.number}.`,
        type: 'booking'
      }
    });

    await logAudit(propertyId, userId, 'CREATE', 'Booking', booking.id, {
      bookingNumber: booking.bookingNumber,
      roomId,
      guestId: guest.id,
      status: booking.status
    });

    res.status(201).json({
      ...booking,
      rate: Number(booking.rate),
      discount: Number(booking.discount),
      gst: Number(booking.gst),
      advancePaid: Number(booking.advancePaid),
      remainingAmount: Number(booking.remainingAmount),
      checkIn: booking.checkIn.toISOString(),
      checkOut: booking.checkOut.toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create booking' });
  }
}

export async function getNotifications(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }
    const notifications = await prisma.notification.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    res.json(notifications);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch notifications' });
  }
}
