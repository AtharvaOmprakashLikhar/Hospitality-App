import { Request, Response } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logAudit } from '../utils/audit';
import jwt from 'jsonwebtoken';

/**
 * POST /api/attendance/clock-in
 * Scope: own user (restricted to ADMIN/MANAGER/SUPER_ADMIN)
 */
export async function clockIn(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const propertyId = req.user?.propertyId;
    const role = req.user?.role;
    
    if (!userId || !propertyId) {
      return res.status(403).json({ error: 'User or property scope missing' });
    }

    if (role === 'WAITER' || role === 'KITCHEN') {
      return res.status(403).json({ 
        error: 'Self-service clocking is disabled. Waiters and Kitchen staff must check in via manager QR scan.' 
      });
    }

    const { method, notes } = req.body; // method: MANUAL, QR, GEOFENCE

    if (!method) {
      return res.status(400).json({ error: 'Clock-in method is required' });
    }

    // Check if already clocked in (i.e. has an attendance record with null clockOut)
    const activeClockIn = await prisma.attendance.findFirst({
      where: { userId, clockOut: null }
    });

    if (activeClockIn) {
      return res.status(409).json({ error: 'Conflict: Already clocked in. Clock out first.' });
    }

    const now = new Date();

    // Fetch property attendance policy
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Try to find scheduled shift for today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const assignment = await prisma.staffAssignment.findFirst({
      where: {
        userId,
        propertyId,
        status: 'SCHEDULED',
        shiftStart: { gte: startOfDay, lte: endOfDay }
      }
    });

    let attendanceStatus: any = 'PRESENT';
    if (assignment) {
      const policy: any = property.attendancePolicy || { lateThresholdMinutes: 15 };
      const lateThreshold = policy.lateThresholdMinutes || 15;
      
      const shiftStart = new Date(assignment.shiftStart);
      const diffMins = (now.getTime() - shiftStart.getTime()) / (1000 * 60);

      if (diffMins > lateThreshold) {
        attendanceStatus = 'LATE';
      }

      // Update shift status to IN_PROGRESS
      await prisma.staffAssignment.update({
        where: { id: assignment.id },
        data: { status: 'IN_PROGRESS' }
      });
    }

    const record = await prisma.attendance.create({
      data: {
        propertyId,
        userId,
        clockIn: now,
        method,
        status: attendanceStatus,
        notes
      }
    });

    res.status(201).json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clock in' });
  }
}

/**
 * POST /api/attendance/clock-out
 * Scope: own user
 */
export async function clockOut(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const propertyId = req.user?.propertyId;
    const role = req.user?.role;

    if (!userId || !propertyId) {
      return res.status(403).json({ error: 'User or property scope missing' });
    }

    if (role === 'WAITER' || role === 'KITCHEN') {
      return res.status(403).json({ 
        error: 'Self-service clocking is disabled. Waiters and Kitchen staff must check out via manager QR scan.' 
      });
    }

    const activeClockIn = await prisma.attendance.findFirst({
      where: { userId, clockOut: null },
      orderBy: { clockIn: 'desc' }
    });

    if (!activeClockIn) {
      return res.status(404).json({ error: 'No active clock-in session found' });
    }

    const now = new Date();
    const clockInTime = new Date(activeClockIn.clockIn);

    // Fetch property attendance policy
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    const policy: any = property?.attendancePolicy || { halfDayThresholdHours: 4 };
    const halfDayHours = policy.halfDayThresholdHours || 4;

    const diffHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

    let finalStatus = activeClockIn.status;
    if (diffHours < halfDayHours) {
      finalStatus = 'HALF_DAY';
    }

    const record = await prisma.attendance.update({
      where: { id: activeClockIn.id },
      data: {
        clockOut: now,
        status: finalStatus
      }
    });

    // Mark today's shift as COMPLETED if active
    const startOfDay = new Date(clockInTime);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(clockInTime);
    endOfDay.setHours(23, 59, 59, 999);

    const assignment = await prisma.staffAssignment.findFirst({
      where: {
        userId,
        propertyId,
        status: 'IN_PROGRESS',
        shiftStart: { gte: startOfDay, lte: endOfDay }
      }
    });

    if (assignment) {
      await prisma.staffAssignment.update({
        where: { id: assignment.id },
        data: { status: 'COMPLETED' }
      });
    }

    res.json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clock out' });
  }
}

/**
 * GET /api/attendance/summary
 * ADMIN, MANAGER only. Calculates attendance stats for a date range.
 */
export async function getAttendanceSummary(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to date boundaries are required' });
    }

    const startDate = new Date(from as string);
    const endDate = new Date(to as string);

    // Fetch users in this property
    const users = await prisma.user.findMany({
      where: { propertyId },
      select: { id: true, name: true, email: true }
    });

    const summary = await Promise.all(
      users.map(async (user) => {
        // Find attendance records in range
        const attendances = await prisma.attendance.findMany({
          where: {
            userId: user.id,
            propertyId,
            clockIn: { gte: startDate, lte: endDate }
          }
        });

        const present = attendances.filter(a => a.status === 'PRESENT').length;
        const late = attendances.filter(a => a.status === 'LATE').length;
        const halfDay = attendances.filter(a => a.status === 'HALF_DAY').length;

        // Fetch shift assignments (scheduled + completed) in range
        const totalAssignments = await prisma.staffAssignment.findMany({
          where: {
            userId: user.id,
            propertyId,
            status: { in: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW'] },
            shiftStart: { gte: startDate, lte: endDate }
          }
        });

        // Absent days count
        const clockedDaysCount = attendances.length;
        const absent = Math.max(0, totalAssignments.length - clockedDaysCount);

        // Leave days count
        const approvedLeaves = await prisma.leaveRequest.findMany({
          where: {
            userId: user.id,
            propertyId,
            status: 'APPROVED',
            startDate: { lte: endDate },
            endDate: { gte: startDate }
          }
        });

        let leaveDays = 0;
        approvedLeaves.forEach(leave => {
          const lStart = new Date(Math.max(new Date(leave.startDate).getTime(), startDate.getTime()));
          const lEnd = new Date(Math.min(new Date(leave.endDate).getTime(), endDate.getTime()));
          const diffTime = Math.abs(lEnd.getTime() - lStart.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          leaveDays += diffDays;
        });

        return {
          userId: user.id,
          name: user.name,
          email: user.email,
          present,
          late,
          halfDay,
          absent,
          leaveDays
        };
      })
    );

    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch summary' });
  }
}

/**
 * POST /api/leave/request
 * Scope: own user
 */
export async function createLeaveRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const propertyId = req.user?.propertyId;

    if (!userId || !propertyId) {
      return res.status(403).json({ error: 'User or property scope missing' });
    }

    const { leaveType, startDate, endDate, reason } = req.body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'leaveType, startDate, endDate, and reason are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({ error: 'Leave start date must be before end date' });
    }

    const request = await prisma.leaveRequest.create({
      data: {
        propertyId,
        userId,
        leaveType,
        startDate: start,
        endDate: end,
        reason
      }
    });

    // Write audit log
    await logAudit(propertyId, userId, 'CREATE', 'LeaveRequest', request.id, request);

    res.status(201).json(request);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to request leave' });
  }
}

/**
 * PATCH /api/leave/:id/review
 * ADMIN, MANAGER only. Approve/Reject requests.
 */
export async function reviewLeaveRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const propertyId = req.user?.propertyId;
    const reviewerId = req.user?.id;

    if (!propertyId || !reviewerId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const { status } = req.body; // APPROVED or REJECTED
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
    }

    const request = await prisma.leaveRequest.findFirst({
      where: { id, propertyId }
    });

    if (!request) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    if (status === 'APPROVED') {
      // Overlap check for approved leaves
      const overlap = await prisma.leaveRequest.findFirst({
        where: {
          id: { not: id },
          userId: request.userId,
          status: 'APPROVED',
          startDate: { lte: request.endDate },
          endDate: { gte: request.startDate }
        }
      });

      if (overlap) {
        return res.status(409).json({
          error: 'Conflict: This user already has an approved leave request in this time window.'
        });
      }
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        reviewedBy: reviewerId,
        reviewedAt: new Date()
      }
    });

    // Write audit log
    await logAudit(propertyId, reviewerId, 'UPDATE', 'LeaveRequest', id, {
      before: request,
      after: updated
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to review leave request' });
  }
}

/**
 * GET /api/leave/requests
 * ADMIN, MANAGER can view all. WAITER, KITCHEN see their own.
 */
export async function getLeaveRequests(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!propertyId || !userId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const where: any = { propertyId };
    
    // If not admin/manager, filter by own userId
    if (role !== 'ADMIN' && role !== 'MANAGER') {
      where.userId = userId;
    }

    const requests = await prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    res.json(requests);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch leave requests' });
  }
}

/**
 * GET /api/attendance/qr/:userId
 * Scope: own user or admin/manager. Returns signed short-lived token.
 */
export async function generateAttendanceQR(req: AuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    const role = req.user?.role;
    const propertyId = req.user?.propertyId;

    if (!propertyId || !currentUserId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    // WAITER/KITCHEN can only request their own QR code
    if (role !== 'ADMIN' && role !== 'MANAGER' && currentUserId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to request QR for another user' });
    }

    const secret = process.env.JWT_SECRET || 'super-secret-key-change-in-production';
    const qrToken = jwt.sign(
      { userId, propertyId, issuedAt: Date.now() },
      secret,
      { expiresIn: '12h' }
    );

    res.json({ qrToken });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate QR token' });
  }
}

/**
 * POST /api/attendance/scan
 * ADMIN, MANAGER only. Body: { qrToken }. Marks clock-in/out.
 */
export async function scanAttendanceQR(req: AuthenticatedRequest, res: Response) {
  try {
    const adminPropertyId = req.user?.propertyId;
    const adminId = req.user?.id;

    if (!adminPropertyId || !adminId) {
      return res.status(403).json({ error: 'Admin property scope missing' });
    }

    const { qrToken } = req.body;
    if (!qrToken) {
      return res.status(400).json({ error: 'qrToken is required' });
    }

    const secret = process.env.JWT_SECRET || 'super-secret-key-change-in-production';
    let decoded: any;
    
    try {
      decoded = jwt.verify(qrToken, secret);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return res.status(400).json({ error: 'QR_EXPIRED', message: 'The attendance QR code has expired.' });
      }
      return res.status(400).json({ error: 'QR_INVALID', message: 'Invalid or tampered QR code.' });
    }

    // Verify same property
    if (decoded.propertyId !== adminPropertyId) {
      return res.status(403).json({ error: 'UNAUTHORIZED_PROPERTY', message: 'Cross-property scan is not permitted.' });
    }

    // Look up scanned user
    const scannedUser = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!scannedUser) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Scanned employee does not exist.' });
    }

    // Look up current open session
    const openSession = await prisma.attendance.findFirst({
      where: { userId: decoded.userId, clockOut: null },
      orderBy: { clockIn: 'desc' }
    });

    const now = new Date();
    let record;
    let clockStatus: 'CLOCKED_IN' | 'CLOCKED_OUT';

    if (!openSession) {
      // Clock in
      // Try to find scheduled shift for today to determine if LATE
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const assignment = await prisma.staffAssignment.findFirst({
        where: {
          userId: decoded.userId,
          propertyId: adminPropertyId,
          status: 'SCHEDULED',
          shiftStart: { gte: startOfDay, lte: endOfDay }
        }
      });

      let attendanceStatus: any = 'PRESENT';
      if (assignment) {
        const property = await prisma.property.findUnique({ where: { id: adminPropertyId } });
        const policy: any = property?.attendancePolicy || { lateThresholdMinutes: 15 };
        const lateThreshold = policy.lateThresholdMinutes || 15;
        
        const shiftStart = new Date(assignment.shiftStart);
        const diffMins = (now.getTime() - shiftStart.getTime()) / (1000 * 60);

        if (diffMins > lateThreshold) {
          attendanceStatus = 'LATE';
        }

        // Update shift assignment
        await prisma.staffAssignment.update({
          where: { id: assignment.id },
          data: { status: 'IN_PROGRESS' }
        });
      }

      record = await prisma.attendance.create({
        data: {
          propertyId: adminPropertyId,
          userId: decoded.userId,
          clockIn: now,
          method: 'QR',
          status: attendanceStatus,
          notes: `Clock-in scanned by admin/manager (${adminId})`
        }
      });
      clockStatus = 'CLOCKED_IN';
    } else {
      // Clock out
      const clockInTime = new Date(openSession.clockIn);
      const property = await prisma.property.findUnique({ where: { id: adminPropertyId } });
      const policy: any = property?.attendancePolicy || { halfDayThresholdHours: 4 };
      const halfDayHours = policy.halfDayThresholdHours || 4;

      const diffHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      let finalStatus = openSession.status;
      if (diffHours < halfDayHours) {
        finalStatus = 'HALF_DAY';
      }

      record = await prisma.attendance.update({
        where: { id: openSession.id },
        data: {
          clockOut: now,
          status: finalStatus,
          notes: `${openSession.notes || ''} | Clock-out scanned by admin/manager (${adminId})`
        }
      });

      // Mark today's shift as COMPLETED if active
      const startOfDay = new Date(clockInTime);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(clockInTime);
      endOfDay.setHours(23, 59, 59, 999);

      const assignment = await prisma.staffAssignment.findFirst({
        where: {
          userId: decoded.userId,
          propertyId: adminPropertyId,
          status: 'IN_PROGRESS',
          shiftStart: { gte: startOfDay, lte: endOfDay }
        }
      });

      if (assignment) {
        await prisma.staffAssignment.update({
          where: { id: assignment.id },
          data: { status: 'COMPLETED' }
        });
      }

      clockStatus = 'CLOCKED_OUT';
    }

    // Write audit log with manager ID
    await logAudit(adminPropertyId, adminId, openSession ? 'UPDATE' : 'CREATE', 'Attendance', record.id, {
      markedUserId: decoded.userId,
      scanType: clockStatus,
      recordedBy: adminId
    });

    res.json({
      status: clockStatus,
      userName: scannedUser.name,
      email: scannedUser.email,
      attendance: record
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Scanning process failed' });
  }
}

