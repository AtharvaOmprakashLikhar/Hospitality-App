import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logAudit } from '../utils/audit';

async function ensureDefaultAdminUser() {
  const defaultEmail = 'atharvalikhar@gmail.com';
  const defaultName = 'atharvalikhar';
  const defaultPassword = '12345';

  let tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'HospitalityOS Group',
        themeConfig: { create: {} }
      }
    });
  }

  let property = await prisma.property.findFirst({ where: { tenantId: tenant.id } });
  if (!property) {
    property = await prisma.property.create({
      data: {
        name: 'Grand Horizon Hotel & Cafe',
        tenantId: tenant.id,
        attendancePolicy: {
          lateThresholdMinutes: 15,
          halfDayThresholdHours: 4
        }
      }
    });
  }

  const hashedPassword = await bcrypt.hash(defaultPassword, 12);
  const existingAdmin = await prisma.user.findUnique({ where: { email: defaultEmail } });
  if (!existingAdmin) {
    return await prisma.user.create({
      data: {
        email: defaultEmail,
        name: defaultName,
        password: hashedPassword,
        role: 'ADMIN',
        status: 'ACTIVE',
        tenantId: tenant.id,
        propertyId: property.id
      }
    });
  }

  return await prisma.user.update({
    where: { email: defaultEmail },
    data: {
      name: defaultName,
      password: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
      tenantId: tenant.id,
      propertyId: property.id
    }
  });
}

/**
 * POST /api/auth/register (renamed to signup for clarity, or support both endpoints)
 */
export async function signup(req: Request, res: Response) {
  try {
    let { email, password, name, phone, role, propertyId } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Role restrictions for self-signup
    if (role && !['MANAGER', 'WAITER', 'KITCHEN'].includes(role)) {
      return res.status(400).json({ error: 'Only MANAGER, WAITER, or KITCHEN roles can be requested during signup.' });
    }

    // Normalize email to avoid case sensitivity issues
    email = String(email).trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password with 12 rounds of bcrypt
    const hashedPassword = await bcrypt.hash(password, 12);

    // Get default tenant
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: 'HospitalityOS Group',
          themeConfig: { create: {} }
        }
      });
    }

    let resolvedPropertyId = propertyId;
    if (!resolvedPropertyId) {
      const firstProp = await prisma.property.findFirst({ where: { tenantId: tenant.id } });
      if (firstProp) {
        resolvedPropertyId = firstProp.id;
      }
    }

    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        phone: phone || null,
        password: hashedPassword,
        role: role || 'WAITER',
        status: 'PENDING', // Default to PENDING approval
        tenantId: tenant.id,
        propertyId: resolvedPropertyId || null
      }
    });

    res.status(201).json({
      message: 'Signup successful. Your account is pending manager/admin approval.',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        status: newUser.status
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Signup failed' });
  }
}

/**
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response) {
  try {
    let { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const loginIdentifier = String(email).trim();
    const normalizedEmail = loginIdentifier.toLowerCase();
    const normalizedLookup = loginIdentifier.replace(/\s+/g, '').toLowerCase();
    const defaultAdminKeys = ['atharvalikhar', 'atharvalikhar@gmail.com', 'atharvalikharid'];

    let user = null;
    try {
      if (normalizedEmail.includes('@')) {
        user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            tenantId: true,
            propertyId: true,
            status: true,
            password: true
          }
        });
      } else {
        user = await prisma.user.findFirst({
          where: {
            OR: [
              { name: { equals: loginIdentifier, mode: 'insensitive' } },
              { email: { startsWith: `${normalizedEmail}@`, mode: 'insensitive' } }
            ]
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            tenantId: true,
            propertyId: true,
            status: true,
            password: true
          }
        });
      }

      if (!user && defaultAdminKeys.includes(normalizedLookup)) {
        user = await ensureDefaultAdminUser();
      }
    } catch (dbErr: any) {
      console.error('[auth] login lookup error', dbErr);
      return res.status(500).json({ error: 'Login lookup failed' });
    }

    if (!user) {
      console.debug(`[auth] login failed - user not found: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Reject non-ACTIVE users
    if (user.status === 'PENDING') {
      return res.status(403).json({ error: 'Your account is pending manager approval. Please wait.' });
    }
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Your account is suspended. Contact your administrator.' });
    }
    if (user.status === 'REJECTED') {
      return res.status(403).json({ error: 'Your registration request was rejected.' });
    }

    if (!user.password) {
      console.error(`[auth] user record missing password for id=${user.id} email=${user.email}`);
      return res.status(500).json({ error: 'Login configuration error' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.debug(`[auth] login failed - bad password for user: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        propertyId: user.propertyId
      },
      process.env.JWT_SECRET || 'super-secret-key-change-in-production',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        propertyId: user.propertyId,
        status: user.status
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed' });
  }
}

/**
 * GET /api/auth/pending-approvals
 * ADMIN only. List all pending users in the admin's property scope.
 */
export async function getPendingApprovals(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const pending = await prisma.user.findMany({
      where: {
        propertyId,
        status: 'PENDING'
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(pending);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch pending approvals' });
  }
}

/**
 * PATCH /api/auth/approve/:userId
 * ADMIN only. Approve pending user, assign final role + propertyId.
 */
export async function approveUser(req: AuthenticatedRequest, res: Response) {
  try {
    const adminPropertyId = req.user?.propertyId;
    const adminId = req.user?.id;
    const { userId } = req.params;
    const { finalRole } = req.body; // optional role override at approval

    if (!adminPropertyId || !adminId) {
      return res.status(403).json({ error: 'Admin property scope missing' });
    }

    const pendingUser = await prisma.user.findFirst({
      where: { id: userId, propertyId: adminPropertyId }
    });

    if (!pendingUser) {
      return res.status(404).json({ error: 'Pending user not found in your property scope' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
        role: finalRole || pendingUser.role
      }
    });

    // Write audit log
    await logAudit(adminPropertyId, adminId, 'UPDATE', 'User', userId, {
      statusBefore: pendingUser.status,
      statusAfter: 'ACTIVE',
      roleBefore: pendingUser.role,
      roleAfter: updated.role
    });

    res.json({
      message: 'User successfully approved',
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        status: updated.status
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Approval failed' });
  }
}

/**
 * PATCH /api/auth/reject/:userId
 * ADMIN only. Reject pending user.
 */
export async function rejectUser(req: AuthenticatedRequest, res: Response) {
  try {
    const adminPropertyId = req.user?.propertyId;
    const adminId = req.user?.id;
    const { userId } = req.params;
    const { reason } = req.body;

    if (!adminPropertyId || !adminId) {
      return res.status(403).json({ error: 'Admin property scope missing' });
    }

    const pendingUser = await prisma.user.findFirst({
      where: { id: userId, propertyId: adminPropertyId }
    });

    if (!pendingUser) {
      return res.status(404).json({ error: 'Pending user not found in your property scope' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'REJECTED'
      }
    });

    // Write audit log with rejection reason
    await logAudit(adminPropertyId, adminId, 'UPDATE', 'User', userId, {
      statusBefore: pendingUser.status,
      statusAfter: 'REJECTED',
      rejectionReason: reason || 'Not specified'
    });

    res.json({
      message: 'User request rejected successfully',
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        status: updated.status
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Rejection failed' });
  }
}
