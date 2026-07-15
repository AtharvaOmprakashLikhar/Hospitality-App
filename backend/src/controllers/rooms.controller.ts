import { Response } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logAudit } from '../utils/audit';
import { RoomStatus, BookingStatus } from '@prisma/client';

// Helper to create a standard response for next available room
function getNextAvailableTimeMessage(checkoutDate: Date, hasCleaning: boolean) {
  const now = new Date();
  const checkout = new Date(checkoutDate);
  
  // Add 2 hours cleaning buffer if applicable
  if (hasCleaning) {
    checkout.setHours(checkout.getHours() + 2);
  }

  const diffMs = checkout.getTime() - now.getTime();
  if (diffMs <= 0) {
    return 'Room is available now.';
  }

  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) {
    return `Room will be available in ${diffHours} hour${diffHours > 1 ? 's' : ''}.`;
  }

  const checkoutTimeStr = checkout.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffHours < 48) {
    return `Room will be available tomorrow at ${checkoutTimeStr}.`;
  }

  return `Room will be available on ${checkout.toLocaleDateString()} at ${checkoutTimeStr}.`;
}

// 1. GET /api/rooms (Query rooms with search, sorting, and filters)
export async function getRooms(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const { search, status, category, floorId, minPrice, maxPrice, sortBy, sortOrder } = req.query;

    const where: any = { propertyId };

    if (search) {
      where.OR = [
        { number: { contains: String(search), mode: 'insensitive' } },
        { name: { contains: String(search), mode: 'insensitive' } }
      ];
    }

    if (status) {
      where.status = status as RoomStatus;
    }

    if (category) {
      where.category = { equals: String(category), mode: 'insensitive' };
    }

    if (floorId) {
      where.floorId = String(floorId);
    }

    if (minPrice || maxPrice) {
      where.basePrice = {};
      if (minPrice) where.basePrice.gte = Number(minPrice);
      if (maxPrice) where.basePrice.lte = Number(maxPrice);
    }

    const orderBy: any = {};
    if (sortBy) {
      orderBy[String(sortBy)] = sortOrder === 'desc' ? 'desc' : 'asc';
    } else {
      orderBy.number = 'asc';
    }

    const rooms = await prisma.room.findMany({
      where,
      orderBy,
      include: {
        floor: true,
        roomType: true,
        bookings: {
          where: { status: { in: ['CHECKED_IN', 'RESERVED'] } },
          include: { guest: true }
        },
        housekeepingTasks: {
          where: { status: 'PENDING' }
        },
        maintenanceRequests: {
          where: { status: 'PENDING' }
        }
      }
    });

    res.json(rooms.map(room => {
      const activeBooking = room.bookings.find(b => b.status === 'CHECKED_IN');
      const reservedBooking = room.bookings.find(b => b.status === 'RESERVED');
      
      const housekeeping = room.housekeepingTasks[0] || null;
      const maintenance = room.maintenanceRequests[0] || null;

      return {
        id: room.id,
        number: room.number,
        name: room.name || `Room ${room.number}`,
        floorId: room.floorId,
        floorName: room.floor.name,
        roomTypeId: room.roomTypeId,
        roomTypeName: room.roomType.name,
        category: room.category || room.roomType.name,
        capacity: room.capacity || (room.roomType.capacityAdults + room.roomType.capacityChildren),
        bedType: room.bedType || 'King size bed',
        basePrice: Number(room.basePrice || room.roomType.nightlyRate),
        weekendPrice: Number(room.weekendPrice || Number(room.roomType.nightlyRate) * 1.2),
        seasonalPrice: Number(room.seasonalPrice || Number(room.roomType.nightlyRate) * 1.5),
        gst: Number(room.gst || 18),
        status: room.status,
        description: room.description || '',
        amenities: room.amenities ? room.amenities.split(',').map(a => a.trim()) : [],
        images: room.images ? room.images.split(',').map(i => i.trim()) : [],
        assignedGuest: activeBooking ? activeBooking.guest.fullName : null,
        bookingNumber: activeBooking ? activeBooking.bookingNumber : (reservedBooking ? reservedBooking.bookingNumber : null),
        checkInDate: activeBooking ? activeBooking.checkIn.toISOString() : (reservedBooking ? reservedBooking.checkIn.toISOString() : null),
        checkOutDate: activeBooking ? activeBooking.checkOut.toISOString() : (reservedBooking ? reservedBooking.checkOut.toISOString() : null),
        housekeepingStaff: housekeeping ? (housekeeping.assignedTo || 'Unassigned') : null,
        maintenanceIssue: maintenance ? maintenance.title : null,
        maintenancePriority: maintenance ? (maintenance.priority || 'Medium') : null,
        lastUpdated: room.updatedAt.toISOString()
      };
    }));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to query rooms' });
  }
}

// 2. GET /api/rooms/:id (Fetch specific room details)
export async function getRoomById(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    const { id } = req.params;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const room = await prisma.room.findFirst({
      where: { id, propertyId },
      include: {
        floor: true,
        roomType: true,
        bookings: {
          include: { guest: true }
        },
        housekeepingTasks: true,
        maintenanceRequests: true
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(room);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch room' });
  }
}

// 3. POST /api/rooms (Create a room)
export async function createRoom(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    const userId = req.user?.id;
    if (!propertyId || !userId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const {
      number,
      name,
      floorId,
      roomTypeId,
      category,
      capacity,
      bedType,
      basePrice,
      weekendPrice,
      seasonalPrice,
      gst,
      description,
      amenities,
      images,
      status
    } = req.body;

    if (!number || !floorId || !roomTypeId) {
      return res.status(400).json({ error: 'Room number, floor, and room type are required' });
    }

    const existing = await prisma.room.findFirst({
      where: { number, propertyId }
    });
    if (existing) {
      return res.status(409).json({ error: `Room number ${number} already exists` });
    }

    const newRoom = await prisma.room.create({
      data: {
        propertyId,
        number,
        floorId,
        roomTypeId,
        name: name || `Room ${number}`,
        category: category || null,
        capacity: Number(capacity) || 2,
        bedType: bedType || 'King size bed',
        basePrice: Number(basePrice) || 100,
        weekendPrice: Number(weekendPrice) || null,
        seasonalPrice: Number(seasonalPrice) || null,
        gst: Number(gst) || 18,
        description: description || null,
        amenities: Array.isArray(amenities) ? amenities.join(', ') : (amenities || null),
        images: Array.isArray(images) ? images.join(', ') : (images || null),
        status: (status || 'AVAILABLE') as RoomStatus
      }
    });

    await logAudit(propertyId, userId, 'CREATE', 'Room', newRoom.id, {
      number: newRoom.number,
      status: newRoom.status,
      basePrice: Number(newRoom.basePrice)
    });

    res.status(201).json(newRoom);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create room' });
  }
}

// 4. PUT /api/rooms/:id (Edit room specs)
export async function updateRoom(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    const userId = req.user?.id;
    const { id } = req.params;
    if (!propertyId || !userId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const room = await prisma.room.findFirst({
      where: { id, propertyId }
    });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const {
      number,
      name,
      floorId,
      roomTypeId,
      category,
      capacity,
      bedType,
      basePrice,
      weekendPrice,
      seasonalPrice,
      gst,
      description,
      amenities,
      images,
      status
    } = req.body;

    if (number && number !== room.number) {
      const existing = await prisma.room.findFirst({
        where: { number, propertyId, id: { not: id } }
      });
      if (existing) {
        return res.status(409).json({ error: `Room number ${number} already exists` });
      }
    }

    const updated = await prisma.room.update({
      where: { id },
      data: {
        number: number || room.number,
        name: name !== undefined ? name : room.name,
        floorId: floorId || room.floorId,
        roomTypeId: roomTypeId || room.roomTypeId,
        category: category !== undefined ? category : room.category,
        capacity: capacity !== undefined ? Number(capacity) : room.capacity,
        bedType: bedType !== undefined ? bedType : room.bedType,
        basePrice: basePrice !== undefined ? Number(basePrice) : room.basePrice,
        weekendPrice: weekendPrice !== undefined ? (weekendPrice ? Number(weekendPrice) : null) : room.weekendPrice,
        seasonalPrice: seasonalPrice !== undefined ? (seasonalPrice ? Number(seasonalPrice) : null) : room.seasonalPrice,
        gst: gst !== undefined ? Number(gst) : room.gst,
        description: description !== undefined ? description : room.description,
        amenities: amenities !== undefined ? (Array.isArray(amenities) ? amenities.join(', ') : amenities) : room.amenities,
        images: images !== undefined ? (Array.isArray(images) ? images.join(', ') : images) : room.images,
        status: status !== undefined ? status as RoomStatus : room.status
      }
    });

    await logAudit(propertyId, userId, 'UPDATE', 'Room', id, {
      previous: { status: room.status, basePrice: Number(room.basePrice) },
      updated: { status: updated.status, basePrice: Number(updated.basePrice) }
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update room' });
  }
}

// 5. DELETE /api/rooms/:id (Delete a room)
export async function deleteRoom(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    const userId = req.user?.id;
    const { id } = req.params;
    if (!propertyId || !userId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const room = await prisma.room.findFirst({
      where: { id, propertyId }
    });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    await prisma.room.delete({ where: { id } });

    await logAudit(propertyId, userId, 'DELETE', 'Room', id, {
      number: room.number
    });

    res.json({ message: 'Room successfully deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete room' });
  }
}

// 6. PATCH /api/rooms/status (Change status of a room)
export async function changeRoomStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    const userId = req.user?.id;
    if (!propertyId || !userId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const { roomId, status } = req.body;
    if (!roomId || !status) {
      return res.status(400).json({ error: 'Room ID and status are required' });
    }

    const room = await prisma.room.findFirst({
      where: { id: roomId, propertyId }
    });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: { status: status as RoomStatus }
    });

    await logAudit(propertyId, userId, 'UPDATE', 'Room Status', roomId, {
      previousStatus: room.status,
      newStatus: status
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update status' });
  }
}

// 7. GET /api/rooms/availability (Availability timeline based on bookings)
export async function getRoomAvailability(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const rooms = await prisma.room.findMany({
      where: { propertyId },
      include: {
        bookings: {
          where: { status: { in: ['CHECKED_IN', 'RESERVED'] } },
          orderBy: { checkIn: 'asc' }
        }
      }
    });

    res.json(rooms.map(room => ({
      roomId: room.id,
      roomNumber: room.number,
      status: room.status,
      timeline: room.bookings.map(b => ({
        bookingId: b.id,
        bookingNumber: b.bookingNumber,
        status: b.status,
        checkIn: b.checkIn.toISOString(),
        checkOut: b.checkOut.toISOString()
      }))
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch timeline availability' });
  }
}

// 8. GET /api/rooms/next-available (Next availability calculations)
export async function getNextAvailable(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const rooms = await prisma.room.findMany({
      where: { propertyId },
      include: {
        bookings: {
          where: { status: { in: ['CHECKED_IN', 'RESERVED'] } },
          orderBy: { checkOut: 'asc' }
        },
        housekeepingTasks: {
          where: { status: 'PENDING' }
        }
      }
    });

    const result = rooms.map(room => {
      if (room.status === 'AVAILABLE') {
        return {
          roomId: room.id,
          roomNumber: room.number,
          status: room.status,
          message: 'Room is available immediately.',
          availableAt: new Date().toISOString()
        };
      }

      const activeBooking = room.bookings.find(b => b.status === 'CHECKED_IN');
      const nearestFuture = room.bookings.find(b => b.status === 'RESERVED');

      const checkout = activeBooking ? activeBooking.checkOut : (nearestFuture ? nearestFuture.checkOut : new Date());
      const hasCleaning = room.status === 'CLEANING' || room.housekeepingTasks.length > 0;

      const message = getNextAvailableTimeMessage(checkout, hasCleaning);
      
      const availableTime = new Date(checkout);
      if (hasCleaning) {
        availableTime.setHours(availableTime.getHours() + 2);
      }

      return {
        roomId: room.id,
        roomNumber: room.number,
        status: room.status,
        message,
        availableAt: availableTime.toISOString()
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to calculate next availabilities' });
  }
}

// 9. GET /api/rooms/history (Booking history for a specific room)
export async function getRoomHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    const { roomId } = req.query;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    const bookings = await prisma.booking.findMany({
      where: { roomId: String(roomId), propertyId },
      orderBy: { checkIn: 'desc' },
      include: { guest: true }
    });

    res.json(bookings.map(b => ({
      id: b.id,
      bookingNumber: b.bookingNumber,
      guestName: b.guest.fullName,
      checkIn: b.checkIn.toISOString(),
      checkOut: b.checkOut.toISOString(),
      nights: b.nights,
      rate: Number(b.rate),
      status: b.status
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch history log' });
  }
}

// 10. GET /api/rooms/dashboard (Dashboard statistics counters)
export async function getRoomDashboard(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const [totalRooms, available, occupied, reserved, cleaning, maintenance, blocked] = await Promise.all([
      prisma.room.count({ where: { propertyId } }),
      prisma.room.count({ where: { propertyId, status: 'AVAILABLE' } }),
      prisma.room.count({ where: { propertyId, status: 'OCCUPIED' } }),
      prisma.room.count({ where: { propertyId, status: 'RESERVED' } }),
      prisma.room.count({ where: { propertyId, status: 'CLEANING' } }),
      prisma.room.count({ where: { propertyId, status: 'MAINTENANCE' } }),
      prisma.room.count({ where: { propertyId, status: 'BLOCKED' } })
    ]);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [checkinsToday, checkoutsToday, bookingsToday] = await Promise.all([
      prisma.booking.count({
        where: { propertyId, checkIn: { gte: startOfToday, lte: endOfToday } }
      }),
      prisma.booking.count({
        where: { propertyId, checkOut: { gte: startOfToday, lte: endOfToday } }
      }),
      prisma.booking.findMany({
        where: { propertyId }
      })
    ]);

    const occupancyPercent = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;
    
    // Revenue calculations
    const todayRevenue = bookingsToday.reduce((sum, b) => {
      const rateNights = Number(b.rate) * b.nights;
      const totalCost = rateNights - Number(b.discount) + Number(b.gst);
      return sum + totalCost;
    }, 0);

    const revPar = totalRooms > 0 ? Number((todayRevenue / totalRooms).toFixed(2)) : 0;

    res.json({
      totalRooms,
      availableRooms: available,
      occupiedRooms: occupied,
      reservedRooms: reserved,
      roomsBeingCleaned: cleaning,
      roomsUnderMaintenance: maintenance + blocked,
      checkinsToday,
      checkoutsToday,
      occupancyPercentage: occupancyPercent,
      revenuePerAvailableRoom: revPar
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to compile dashboard metrics' });
  }
}
