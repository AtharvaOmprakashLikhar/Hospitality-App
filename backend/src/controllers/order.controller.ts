import { Response } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { io } from '../server';
import { logAudit } from '../utils/audit';

/**
 * POST /api/orders
 * WAITER, MANAGER, ADMIN. Creates a new order.
 */
export async function createOrder(req: AuthenticatedRequest, res: Response) {
  try {
    const { tableId, items } = req.body; // items: [{ menuItemId, quantity, notes }]
    const propertyId = req.user?.propertyId;
    const userId = req.user?.id;

    if (!propertyId || !userId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    if (!tableId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Table ID and order items are required' });
    }

    // 1. Validate all menu items exist and are available
    const menuItemIds = items.map(i => i.menuItemId);
    const dbMenuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } }
    });

    const unavailableItems = dbMenuItems.filter(item => !item.isAvailable);
    if (unavailableItems.length > 0) {
      const names = unavailableItems.map(i => i.name).join(', ');
      return res.status(400).json({
        error: 'ITEMS_UNAVAILABLE',
        message: `Order contains unavailable items: ${names}`
      });
    }

    if (dbMenuItems.length !== menuItemIds.length) {
      return res.status(400).json({ error: 'Some menu items do not exist' });
    }

    // 2. Create Order & first version transaction
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          propertyId,
          tableId,
          status: 'SENT'
        }
      });

      const version = await tx.orderVersion.create({
        data: {
          orderId: order.id,
          version: 1,
          status: 'SENT',
          createdBy: userId
        }
      });

      // Create Order Items
      const orderItemsData = items.map(item => ({
        orderVersionId: version.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes || null
      }));

      await tx.orderItem.createMany({
        data: orderItemsData
      });

      // Point order to latest version
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: { currentVersionId: version.id },
        include: {
          versions: {
            where: { id: version.id },
            include: {
              items: {
                include: { menuItem: true }
              }
            }
          }
        }
      });

      return updatedOrder;
    });

    // 3. Emit real-time socket event
    io.to(propertyId).emit('order:sent', result);

    // 4. Log Audit
    await logAudit(propertyId, userId, 'CREATE', 'Order', result.id, {
      tableId,
      version: 1,
      itemsCount: items.length
    });

    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create order' });
  }
}

/**
 * PATCH /api/orders/:id/revise
 * WAITER, MANAGER, ADMIN. Creates a new OrderVersion.
 */
export async function reviseOrder(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params; // Order ID
    const { items } = req.body; // items: [{ menuItemId, quantity, notes }]
    const propertyId = req.user?.propertyId;
    const userId = req.user?.id;

    if (!propertyId || !userId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Revised order items are required' });
    }

    const order = await prisma.order.findUnique({
      where: { id, propertyId },
      include: { versions: { orderBy: { version: 'desc' } } }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'SERVED' || order.status === 'CLOSED') {
      return res.status(400).json({ error: 'Cannot revise an order that has already been served or closed.' });
    }

    // Validate item availability
    const menuItemIds = items.map(i => i.menuItemId);
    const dbMenuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } }
    });

    const unavailableItems = dbMenuItems.filter(item => !item.isAvailable);
    if (unavailableItems.length > 0) {
      const names = unavailableItems.map(i => i.name).join(', ');
      return res.status(400).json({
        error: 'ITEMS_UNAVAILABLE',
        message: `Order contains unavailable items: ${names}`
      });
    }

    const lastVersion = order.versions[0];
    const newVersionIndex = lastVersion ? lastVersion.version + 1 : 1;

    // Transaction to append version and update pointer
    const result = await prisma.$transaction(async (tx) => {
      const version = await tx.orderVersion.create({
        data: {
          orderId: id,
          version: newVersionIndex,
          status: order.status, // maintains current prep status
          createdBy: userId
        }
      });

      const orderItemsData = items.map(item => ({
        orderVersionId: version.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes || null
      }));

      await tx.orderItem.createMany({
        data: orderItemsData
      });

      const updatedOrder = await tx.order.update({
        where: { id },
        data: { currentVersionId: version.id },
        include: {
          versions: {
            where: { id: version.id },
            include: {
              items: {
                include: { menuItem: true }
              }
            }
          }
        }
      });

      return updatedOrder;
    });

    // Socket broadcast
    io.to(propertyId).emit('order:revised', result);

    // Audit log
    await logAudit(propertyId, userId, 'UPDATE', 'Order', id, {
      action: 'REVISION',
      newVersion: newVersionIndex,
      itemsCount: items.length
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to revise order' });
  }
}

/**
 * GET /api/orders/table/:tableId
 * Returns the active (non-CLOSED, non-SERVED) order for a table
 */
export async function getTableOrder(req: AuthenticatedRequest, res: Response) {
  try {
    const { tableId } = req.params;
    const propertyId = req.user?.propertyId;

    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const order = await prisma.order.findFirst({
      where: {
        propertyId,
        tableId,
        NOT: { status: { in: ['SERVED', 'CLOSED'] } }
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: {
            items: {
              include: { menuItem: true }
            }
          }
        }
      }
    });

    // If order found, extract only current active version details
    if (order) {
      const activeVersion = order.versions.find(v => v.id === order.currentVersionId) || order.versions[0];
      return res.json({
        ...order,
        activeVersion
      });
    }

    res.json(null);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch table order' });
  }
}

/**
 * GET /api/orders/kitchen-queue
 * KITCHEN, MANAGER, ADMIN only. Returns active tickets (current versions).
 */
export async function getKitchenQueue(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;

    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const orders = await prisma.order.findMany({
      where: {
        propertyId,
        NOT: { status: { in: ['SERVED', 'CLOSED'] } }
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: {
            items: {
              include: { menuItem: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const queue = orders.map(order => {
      const activeVersion = order.versions.find(v => v.id === order.currentVersionId) || order.versions[0];
      return {
        id: order.id,
        tableId: order.tableId,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        version: activeVersion.version,
        items: activeVersion.items
      };
    });

    res.json(queue);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch kitchen queue' });
  }
}

/**
 * PATCH /api/orders/:id/status
 * Updates order prep stage (SENT -> PREPARING -> READY -> SERVED).
 * KITCHEN: SENT -> PREPARING -> READY only.
 * ADMIN/MANAGER: Any transition.
 */
export async function updateOrderStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body; // OrderStatus
    const propertyId = req.user?.propertyId;
    const role = req.user?.role;
    const userId = req.user?.id;

    if (!propertyId || !userId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const order = await prisma.order.findUnique({
      where: { id, propertyId },
      include: { versions: { orderBy: { version: 'desc' } } }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const currentStatus = order.status;
    const isManagerOrAdmin = role === 'ADMIN' || role === 'MANAGER' || role === 'SUPER_ADMIN';

    // Verify valid status transition sequence
    const allowedTransitions: Record<string, string[]> = {
      SENT: ['PREPARING'],
      PREPARING: ['READY'],
      READY: ['SERVED'],
      SERVED: ['CLOSED'],
      CLOSED: []
    };

    const isLegalTransition = allowedTransitions[currentStatus]?.includes(status);

    if (!isLegalTransition && !isManagerOrAdmin) {
      return res.status(400).json({
        error: 'ILLEGAL_TRANSITION',
        message: `Illegal transition from ${currentStatus} to ${status} is blocked for kitchen staff.`
      });
    }

    // Kitchen cannot transition to SERVED or CLOSED
    if ((status === 'SERVED' || status === 'CLOSED') && !isManagerOrAdmin) {
      return res.status(403).json({
        error: 'ROLE_RESTRICTED',
        message: 'Kitchen staff cannot mark orders as SERVED or CLOSED.'
      });
    }

    // Update status in both Order and current OrderVersion
    const updated = await prisma.$transaction(async (tx) => {
      const orderRecord = await tx.order.update({
        where: { id },
        data: { status },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            include: {
              items: {
                include: { menuItem: true }
              }
            }
          }
        }
      });

      if (orderRecord.currentVersionId) {
        await tx.orderVersion.update({
          where: { id: orderRecord.currentVersionId },
          data: { status }
        });
      }

      return orderRecord;
    });

    const activeVersion = updated.versions.find(v => v.id === updated.currentVersionId) || updated.versions[0];
    const cleanOutput = {
      id: updated.id,
      tableId: updated.tableId,
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      version: activeVersion.version,
      items: activeVersion.items
    };

    // Socket emission
    io.to(propertyId).emit('order:status_updated', cleanOutput);

    // Audit log
    await logAudit(propertyId, userId, 'UPDATE', 'Order', id, {
      action: 'STATUS_CHANGE',
      from: currentStatus,
      to: status
    });

    res.json(cleanOutput);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update order status' });
  }
}
