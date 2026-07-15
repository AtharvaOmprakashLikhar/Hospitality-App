import { Response } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { encrypt, decrypt } from '../utils/crypto';
import { generatePayslipPDF } from '../utils/pdf';
import { logAudit } from '../utils/audit';

/**
 * POST /api/salary/structure
 * ADMIN only. Sets or updates the salary structure for a user.
 */
export async function setSalaryStructure(req: AuthenticatedRequest, res: Response) {
  try {
    const creatorId = req.user?.id;
    const propertyId = req.user?.propertyId;

    if (!creatorId || !propertyId) {
      return res.status(403).json({ error: 'Scope unauthorized' });
    }

    const { userId, baseSalary, hra, allowances, deductions, effectiveFrom } = req.body;

    if (!userId || baseSalary === undefined || hra === undefined || allowances === undefined || deductions === undefined) {
      return res.status(400).json({ error: 'userId, baseSalary, hra, allowances, and deductions are required' });
    }

    // Verify user belongs to the same property
    const user = await prisma.user.findFirst({ where: { id: userId, propertyId } });
    if (!user) {
      return res.status(404).json({ error: 'Employee not found in this property' });
    }

    // Encrypt structural elements
    const encBase = encrypt(String(baseSalary));
    const encHra = encrypt(String(hra));
    const encAllowances = encrypt(String(allowances));
    const encDeductions = encrypt(String(deductions));

    const structure = await prisma.salaryStructure.upsert({
      where: { userId },
      update: {
        baseSalary: encBase,
        hra: encHra,
        allowances: encAllowances,
        deductions: encDeductions,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        createdBy: creatorId
      },
      create: {
        userId,
        baseSalary: encBase,
        hra: encHra,
        allowances: encAllowances,
        deductions: encDeductions,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        createdBy: creatorId
      }
    });

    // Write audit log
    await logAudit(propertyId, creatorId, 'UPDATE', 'SalaryStructure', structure.id, { userId });

    res.json({
      message: 'Salary structure updated successfully',
      structure: {
        id: structure.id,
        userId: structure.userId,
        effectiveFrom: structure.effectiveFrom
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update salary structure' });
  }
}

/**
 * GET /api/salary/structure/:userId
 * ADMIN can view any, staff view their own
 */
export async function getSalaryStructure(req: AuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    const role = req.user?.role;
    const propertyId = req.user?.propertyId;

    if (role !== 'ADMIN' && currentUserId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to view this salary structure' });
    }

    // Verify property scope
    const user = await prisma.user.findFirst({ where: { id: userId, propertyId } });
    if (!user) {
      return res.status(404).json({ error: 'Employee not found in this property' });
    }

    const structure = await prisma.salaryStructure.findUnique({ where: { userId } });
    if (!structure) {
      return res.status(404).json({ error: 'Salary structure not defined for this employee' });
    }

    // Decrypt fields
    res.json({
      userId: structure.userId,
      baseSalary: parseFloat(decrypt(structure.baseSalary)),
      hra: parseFloat(decrypt(structure.hra)),
      allowances: parseFloat(decrypt(structure.allowances)),
      deductions: parseFloat(decrypt(structure.deductions)),
      effectiveFrom: structure.effectiveFrom
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch salary structure' });
  }
}

/**
 * POST /api/salary/payslip/generate
 * ADMIN only. Generates pro-rated monthly payslip.
 */
export async function generatePayslip(req: AuthenticatedRequest, res: Response) {
  try {
    const creatorId = req.user?.id;
    const propertyId = req.user?.propertyId;

    if (!creatorId || !propertyId) {
      return res.status(403).json({ error: 'Scope unauthorized' });
    }

    const { userId, month, year, overrideNetPay, overrideReason } = req.body;

    if (!userId || !month || !year) {
      return res.status(400).json({ error: 'userId, month, and year are required' });
    }

    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    // Verify employee
    const user = await prisma.user.findFirst({ where: { id: userId, propertyId } });
    if (!user) {
      return res.status(404).json({ error: 'Employee not found in this property' });
    }

    // Fetch salary structure
    const structure = await prisma.salaryStructure.findUnique({ where: { userId } });
    if (!structure) {
      return res.status(404).json({ error: 'Salary structure not defined for this employee.' });
    }

    // Decrypt components
    const baseSalary = parseFloat(decrypt(structure.baseSalary));
    const hra = parseFloat(decrypt(structure.hra));
    const allowances = parseFloat(decrypt(structure.allowances));
    const structuralDeductions = parseFloat(decrypt(structure.deductions));

    // Calculate dates
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59, 999);
    const totalWorkingDaysInMonth = new Date(y, m, 0).getDate();

    // Fetch attendance records
    const attendances = await prisma.attendance.findMany({
      where: {
        userId,
        propertyId,
        clockIn: { gte: startDate, lte: endDate }
      }
    });

    const presentCount = attendances.filter(a => a.status === 'PRESENT').length;
    const lateCount = attendances.filter(a => a.status === 'LATE').length;
    const halfDayCount = attendances.filter(a => a.status === 'HALF_DAY').length;

    // Fetch shift assignments
    const totalShifts = await prisma.staffAssignment.count({
      where: {
        userId,
        propertyId,
        status: { in: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW'] },
        shiftStart: { gte: startDate, lte: endDate }
      }
    });

    const clockedDaysCount = attendances.length;
    const absentCount = Math.max(0, totalShifts - clockedDaysCount);

    // Fetch approved leaves
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        userId,
        propertyId,
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate }
      }
    });

    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;

    approvedLeaves.forEach(leave => {
      const lStart = new Date(Math.max(new Date(leave.startDate).getTime(), startDate.getTime()));
      const lEnd = new Date(Math.min(new Date(leave.endDate).getTime(), endDate.getTime()));
      const diffTime = Math.abs(lEnd.getTime() - lStart.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      if (leave.leaveType === 'UNPAID') {
        unpaidLeaveDays += diffDays;
      } else {
        paidLeaveDays += diffDays;
      }
    });

    // Pro-ration calculations
    const dailyRate = baseSalary / totalWorkingDaysInMonth;
    const unpaidAbsences = unpaidLeaveDays + absentCount + (halfDayCount * 0.5);
    const absenceDeduction = dailyRate * unpaidAbsences;

    const grossPay = baseSalary + hra + allowances;
    const calculatedDeductions = structuralDeductions + absenceDeduction;
    
    let netPay = grossPay - calculatedDeductions;
    if (netPay < 0) netPay = 0;

    // Apply manual overrides if present
    let finalNetPay = netPay;
    let finalDeductions = calculatedDeductions;
    if (overrideNetPay !== undefined) {
      if (!overrideReason) {
        return res.status(400).json({ error: 'Manual overrides require an overrideReason note' });
      }
      finalNetPay = parseFloat(overrideNetPay);
      finalDeductions = grossPay - finalNetPay;
    }

    // Check if payslip already exists
    const existingPayslip = await prisma.payslip.findUnique({
      where: {
        userId_month_year: { userId, month: m, year: y }
      }
    });

    let payslip;
    if (existingPayslip) {
      payslip = await prisma.payslip.update({
        where: { id: existingPayslip.id },
        data: {
          grossPay: grossPay,
          deductions: finalDeductions,
          netPay: finalNetPay,
          presentDays: presentCount + lateCount,
          leaveDays: paidLeaveDays + unpaidLeaveDays,
          absentDays: absentCount,
          generatedBy: creatorId
        }
      });
    } else {
      payslip = await prisma.payslip.create({
        data: {
          userId,
          propertyId,
          month: m,
          year: y,
          grossPay: grossPay,
          deductions: finalDeductions,
          netPay: finalNetPay,
          presentDays: presentCount + lateCount,
          leaveDays: paidLeaveDays + unpaidLeaveDays,
          absentDays: absentCount,
          generatedBy: creatorId
        }
      });
    }

    // Write audit log
    await logAudit(propertyId, creatorId, 'CREATE', 'Payslip', payslip.id, {
      userId,
      month: m,
      year: y,
      overrideApplied: overrideNetPay !== undefined
    });

    res.status(201).json(payslip);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate payslip' });
  }
}

/**
 * GET /api/salary/payslips/:userId
 * Staff can view their own, ADMIN can view any in property.
 */
export async function getPayslips(req: AuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    const role = req.user?.role;
    const propertyId = req.user?.propertyId;

    if (role !== 'ADMIN' && currentUserId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to view these payslips' });
    }

    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    // Scoped to property
    const user = await prisma.user.findFirst({ where: { id: userId, propertyId } });
    if (!user) {
      return res.status(404).json({ error: 'Employee not found in this property' });
    }

    const payslips = await prisma.payslip.findMany({
      where: { userId, propertyId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });

    res.json(payslips);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch payslips' });
  }
}

/**
 * GET /api/salary/payslip/:id/pdf
 * Generates downloadable payslip PDF.
 */
export async function downloadPayslipPDF(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const propertyId = req.user?.propertyId;
    const currentUserId = req.user?.id;
    const role = req.user?.role;

    if (!propertyId || !currentUserId) {
      return res.status(403).json({ error: 'Scope unauthorized' });
    }

    const payslip = await prisma.payslip.findFirst({
      where: { id, propertyId },
      include: {
        user: { select: { name: true, email: true } },
        property: { select: { name: true } }
      }
    });

    if (!payslip) {
      return res.status(404).json({ error: 'Payslip not found' });
    }

    // RBAC: Waiter/Kitchen can only view their own
    if (role !== 'ADMIN' && payslip.userId !== currentUserId) {
      return res.status(403).json({ error: 'Unauthorized to view this payslip' });
    }

    // Fetch decrypted salary structure to list initial components on PDF
    const structure = await prisma.salaryStructure.findUnique({
      where: { userId: payslip.userId }
    });

    const baseSalary = structure ? parseFloat(decrypt(structure.baseSalary)) : 0;
    const hra = structure ? parseFloat(decrypt(structure.hra)) : 0;
    const allowances = structure ? parseFloat(decrypt(structure.allowances)) : 0;

    const pdfBuffer = await generatePayslipPDF({
      id: payslip.id,
      userName: payslip.user.name,
      userEmail: payslip.user.email,
      propertyName: payslip.property.name,
      month: payslip.month,
      year: payslip.year,
      baseSalary,
      hra,
      allowances,
      deductions: parseFloat(payslip.deductions.toString()),
      grossPay: parseFloat(payslip.grossPay.toString()),
      netPay: parseFloat(payslip.netPay.toString()),
      presentDays: payslip.presentDays,
      leaveDays: payslip.leaveDays,
      absentDays: payslip.absentDays,
      generatedAt: payslip.generatedAt
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslip-${payslip.year}-${payslip.month}.pdf`);
    res.send(Buffer.from(pdfBuffer));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to download payslip' });
  }
}
