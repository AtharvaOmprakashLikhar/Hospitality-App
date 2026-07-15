import { Response } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logAudit } from '../utils/audit';
import { ServiceType, ReservationStatus } from '@prisma/client';

const serviceLabels: Record<ServiceType, string> = {
  HOTEL_ROOM_SERVICE: 'Hotel Room Service',
  RESTAURANT_BOOKING: 'Restaurant Booking',
  BANQUET_BOOKING: 'Banquet Booking',
  BAR_RESERVATION: 'Bar Reservation',
  CAFE_RESERVATION: 'Cafe Reservation'
};

const baseRates: Record<ServiceType, number> = {
  HOTEL_ROOM_SERVICE: 60,
  RESTAURANT_BOOKING: 35,
  BANQUET_BOOKING: 150,
  BAR_RESERVATION: 25,
  CAFE_RESERVATION: 18
};

function getCostEstimate(serviceType: ServiceType, partySize: number) {
  const base = baseRates[serviceType] || 30;
  if (serviceType === 'HOTEL_ROOM_SERVICE') {
    return base;
  }
  return base * Math.max(1, partySize);
}

function normalizeServiceType(input: any): ServiceType | null {
  if (!input || typeof input !== 'string') return null;
  const normalized = input.toUpperCase().replace(/\s+/g, '_');
  if (Object.keys(serviceLabels).includes(normalized)) {
    return normalized as ServiceType;
  }
  return null;
}

export async function getAvailableServices(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const services = await prisma.propertyService.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'asc' }
    });

    res.json(services.map(service => ({
      id: service.id,
      type: service.serviceType,
      label: service.label,
      createdAt: service.createdAt
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch services' });
  }
}

export async function createPropertyService(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const { serviceType } = req.body;
    const normalizedType = normalizeServiceType(serviceType);
    if (!normalizedType) {
      return res.status(400).json({ error: 'Invalid serviceType' });
    }

    const exists = await prisma.propertyService.findFirst({
      where: { propertyId, serviceType: normalizedType }
    });
    if (exists) {
      return res.status(200).json({ message: 'Service already enabled', service: exists });
    }

    const service = await prisma.propertyService.create({
      data: {
        propertyId,
        serviceType: normalizedType,
        label: serviceLabels[normalizedType]
      }
    });

    await logAudit(propertyId, req.user?.id || null, 'CREATE', 'PropertyService', service.id, { serviceType: normalizedType });

    res.status(201).json(service);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create service' });
  }
}

export async function createReservation(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    const userId = req.user?.id;
    if (!propertyId || !userId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const {
      serviceType: rawServiceType,
      guestName,
      guestPhone,
      roomNumber,
      tableNumber,
      partySize,
      reservationTime,
      notes,
      estimatedCost
    } = req.body;

    const serviceType = normalizeServiceType(rawServiceType);
    if (!serviceType) {
      return res.status(400).json({ error: 'serviceType is required and must be valid' });
    }
    if (!guestName || typeof guestName !== 'string' || guestName.trim().length < 2) {
      return res.status(400).json({ error: 'Guest name is required' });
    }

    const parsedTime = new Date(String(reservationTime));
    if (Number.isNaN(parsedTime.getTime())) {
      return res.status(400).json({ error: 'Invalid reservationTime' });
    }

    const size = Number(partySize) || 1;
    if (size <= 0) {
      return res.status(400).json({ error: 'partySize must be a positive number' });
    }

    if (serviceType === 'HOTEL_ROOM_SERVICE' && !roomNumber) {
      return res.status(400).json({ error: 'roomNumber is required for hotel room service' });
    }

    if (['RESTAURANT_BOOKING', 'BAR_RESERVATION', 'CAFE_RESERVATION'].includes(serviceType)) {
      if (!tableNumber) {
        return res.status(400).json({ error: 'tableNumber is required for restaurant, bar, and cafe bookings' });
      }
    }

    if (serviceType === 'BANQUET_BOOKING' && size < 10) {
      return res.status(400).json({ error: 'Banquet bookings require at least 10 guests' });
    }

    const activeService = await prisma.propertyService.findFirst({
      where: { propertyId, serviceType }
    });
    if (!activeService) {
      return res.status(400).json({ error: 'This service is not enabled for your property' });
    }

    // Prevent duplicate/overlapping bookings for same room or table
    const existingReservations = await prisma.reservation.findMany({
      where: {
        propertyId,
        status: { not: 'CANCELLED' }
      }
    });

    const overlapWindowMs = 2 * 60 * 60 * 1000;
    const conflict = existingReservations.find((reservation) => {
      const existingTime = reservation.reservationTime.getTime();
      const targetTime = parsedTime.getTime();
      const isClose = Math.abs(existingTime - targetTime) < overlapWindowMs;

      if (serviceType === 'HOTEL_ROOM_SERVICE' && reservation.roomNumber && roomNumber) {
        return reservation.roomNumber === roomNumber && isClose;
      }

      if (['RESTAURANT_BOOKING', 'BAR_RESERVATION', 'CAFE_RESERVATION'].includes(serviceType) && reservation.tableNumber && tableNumber) {
        return reservation.tableNumber === tableNumber && isClose;
      }

      if (serviceType === 'BANQUET_BOOKING' && reservation.serviceType === 'BANQUET_BOOKING') {
        return isClose;
      }

      return false;
    });

    if (conflict) {
      return res.status(409).json({
        error: 'RESERVATION_CONFLICT',
        message: 'A reservation already exists for the selected room/table around this time.'
      });
    }

    const numericEstimatedCost = Number(estimatedCost) || getCostEstimate(serviceType, size);
    const reservation = await prisma.reservation.create({
      data: {
        propertyId,
        createdBy: userId,
        serviceType,
        guestName: guestName.trim(),
        guestPhone: guestPhone ? String(guestPhone).trim() : null,
        roomNumber: roomNumber ? String(roomNumber).trim() : null,
        tableNumber: tableNumber ? String(tableNumber).trim() : null,
        partySize: size,
        reservationTime: parsedTime,
        notes: notes ? String(notes).trim() : null,
        estimatedCost: numericEstimatedCost
      }
    });

    await logAudit(propertyId, userId, 'CREATE', 'Reservation', reservation.id, {
      serviceType,
      guestName: reservation.guestName,
      partySize: reservation.partySize,
      reservationTime: reservation.reservationTime.toISOString()
    });

    res.status(201).json(reservation);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create reservation' });
  }
}

export async function listReservations(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const where = userRole === 'USER'
      ? { propertyId, createdBy: userId }
      : { propertyId };

    const reservations = await prisma.reservation.findMany({
      where,
      orderBy: { reservationTime: 'desc' },
      include: { creator: { select: { id: true, name: true, email: true } } }
    });

    res.json(reservations.map(r => ({
      ...r,
      estimatedCost: Number(r.estimatedCost),
      createdAt: r.createdAt.toISOString(),
      reservationTime: r.reservationTime.toISOString()
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch reservations' });
  }
}

export async function updateReservationStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const { id } = req.params;
    const { status } = req.body;
    if (!status || !Object.values(ReservationStatus).includes(status as ReservationStatus)) {
      return res.status(400).json({ error: 'Invalid reservation status' });
    }

    const reservation = await prisma.reservation.findUnique({ where: { id } });
    if (!reservation || reservation.propertyId !== propertyId) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const currentStatus = reservation.status;
    const legalTransitions: Record<ReservationStatus, ReservationStatus[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: []
    };

    if (!legalTransitions[currentStatus].includes(status as ReservationStatus)) {
      return res.status(400).json({ error: 'Invalid status transition' });
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: { status }
    });

    await logAudit(propertyId, req.user?.id || null, 'UPDATE', 'Reservation', id, {
      statusBefore: currentStatus,
      statusAfter: updated.status
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update reservation status' });
  }
}
