import { Response } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { io } from '../server';
import { logAudit } from '../utils/audit';

/**
 * POST /api/staff/assignments
 * ADMIN, MANAGER only. Create shift assignment with overlap check.
 */
export async function createAssignment(req: AuthenticatedRequest, res: Response) {
  try {
    const { userId, role, section, shiftStart, shiftEnd } = req.body;
    const propertyId = req.user?.propertyId;
    const creatorId = req.user?.id;

    if (!propertyId || !creatorId) {
      return res.status(403).json({ error: 'Property scope missing or unauthorized' });
    }

    if (!userId || !role || !shiftStart || !shiftEnd) {
      return res.status(400).json({ error: 'userId, role, shiftStart, and shiftEnd are required' });
    }

    const start = new Date(shiftStart);
    const end = new Date(shiftEnd);

    if (start >= end) {
      return res.status(400).json({ error: 'Shift start must be before shift end' });
    }

    // Overlap check: start < existing.shiftEnd AND end > existing.shiftStart
    const overlap = await prisma.staffAssignment.findFirst({
      where: {
        userId,
        status: { not: 'CANCELLED' },
        shiftStart: { lt: end },
        shiftEnd: { gt: start }
      }
    });

    if (overlap) {
      return res.status(409).json({ 
        error: 'Conflict: This user already has an overlapping shift assignment.' 
      });
    }

    const assignment = await prisma.staffAssignment.create({
      data: {
        propertyId,
        userId,
        role,
        section,
        shiftStart: start,
        shiftEnd: end,
        createdBy: creatorId
      },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    // Write audit log
    await logAudit(propertyId, creatorId, 'CREATE', 'StaffAssignment', assignment.id, assignment);

    // Emit live update socket event
    io.to(propertyId).emit('staff:assignment:updated', { id: assignment.id, action: 'CREATE', assignment });

    res.status(201).json(assignment);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create assignment' });
  }
}

/**
 * GET /api/staff/assignments
 * Filterable, paginated, scoped to property.
 */
export async function getAssignments(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const { date, role, page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { propertyId };

    if (role) {
      where.role = role;
    }

    if (date) {
      const targetDate = new Date(date as string);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
      
      where.shiftStart = {
        gte: startOfDay,
        lte: endOfDay
      };
    }

    const [assignments, total] = await prisma.$transaction([
      prisma.staffAssignment.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { shiftStart: 'asc' },
        include: {
          user: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma.staffAssignment.count({ where })
    ]);

    res.json({
      assignments,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch assignments' });
  }
}

/**
 * PATCH /api/staff/assignments/:id
 * reassign section/shift, only by MANAGER/ADMIN of that property.
 */
export async function updateAssignment(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const propertyId = req.user?.propertyId;
    const updaterId = req.user?.id;

    if (!propertyId || !updaterId) {
      return res.status(403).json({ error: 'Property scope missing or unauthorized' });
    }

    // Verify assignment belongs to this property
    const existing = await prisma.staffAssignment.findFirst({
      where: { id, propertyId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Assignment not found in this property' });
    }

    const { section, shiftStart, shiftEnd, status, userId } = req.body;

    const start = shiftStart ? new Date(shiftStart) : existing.shiftStart;
    const end = shiftEnd ? new Date(shiftEnd) : existing.shiftEnd;
    const targetUserId = userId || existing.userId;

    if (start >= end) {
      return res.status(400).json({ error: 'Shift start must be before shift end' });
    }

    // Overlap check for shift updates or reassignments
    if (shiftStart || shiftEnd || userId) {
      const overlap = await prisma.staffAssignment.findFirst({
        where: {
          id: { not: id },
          userId: targetUserId,
          status: { not: 'CANCELLED' },
          shiftStart: { lt: end },
          shiftEnd: { gt: start }
        }
      });

      if (overlap) {
        return res.status(409).json({ 
          error: 'Conflict: This user has another overlapping shift assignment during that time.' 
        });
      }
    }

    const updated = await prisma.staffAssignment.update({
      where: { id },
      data: {
        section,
        shiftStart: start,
        shiftEnd: end,
        status,
        userId: targetUserId
      },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    // Write audit log
    await logAudit(propertyId, updaterId, 'UPDATE', 'StaffAssignment', id, {
      before: existing,
      after: updated
    });

    // Emit live update
    io.to(propertyId).emit('staff:assignment:updated', { id, action: 'UPDATE', assignment: updated });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update assignment' });
  }
}

/**
 * DELETE /api/staff/assignments/:id
 * Soft-delete (set status CANCELLED)
 */
export async function deleteAssignment(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const propertyId = req.user?.propertyId;
    const updaterId = req.user?.id;

    if (!propertyId || !updaterId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const existing = await prisma.staffAssignment.findFirst({
      where: { id, propertyId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Assignment not found in this property' });
    }

    const cancelled = await prisma.staffAssignment.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    // Audit log
    await logAudit(propertyId, updaterId, 'UPDATE', 'StaffAssignment', id, {
      before: existing,
      after: cancelled
    });

    // Emit live update
    io.to(propertyId).emit('staff:assignment:updated', { id, action: 'CANCELLED', assignment: cancelled });

    res.json({ message: 'Assignment successfully cancelled', assignment: cancelled });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete assignment' });
  }
}
