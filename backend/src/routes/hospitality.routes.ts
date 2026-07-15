import { Router } from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.middleware';
import {
  checkIn,
  checkOut,
  listRoomServices,
  createRoomService,
  updateRoomServiceStatus,
  listCafeOrders,
  listBarOrders,
  listBarInventory,
  listBanquetBookings,
  listBanquetPackages,
  listAuditLogs,
  getDbStatus,
  performBackup,
  performRestore
} from '../controllers/hospitality.controller';

const router = Router();

router.use(authenticateJWT);

// Check-in and Check-out
router.post('/check-in', authorizeRoles('ADMIN', 'MANAGER'), checkIn);
router.post('/bookings/:bookingId/check-out', authorizeRoles('ADMIN', 'MANAGER'), checkOut);

// Room Service requests
router.get('/room-services', authorizeRoles('ADMIN', 'MANAGER'), listRoomServices);
router.post('/room-services', authorizeRoles('ADMIN', 'MANAGER', 'USER'), createRoomService);
router.patch('/room-services/:id/status', authorizeRoles('ADMIN', 'MANAGER'), updateRoomServiceStatus);

// Cafe and Bar Module
router.get('/cafe/orders', authorizeRoles('ADMIN', 'MANAGER'), listCafeOrders);
router.get('/bar/orders', authorizeRoles('ADMIN', 'MANAGER'), listBarOrders);
router.get('/bar/inventory', authorizeRoles('ADMIN', 'MANAGER'), listBarInventory);

// Banquet Module
router.get('/banquet/bookings', authorizeRoles('ADMIN', 'MANAGER'), listBanquetBookings);
router.get('/banquet/packages', authorizeRoles('ADMIN', 'MANAGER'), listBanquetPackages);

// Admin-only management endpoints (Manager is excluded from DB monitor, settings, backup, restore, audit logs)
router.get('/admin/audit-logs', authorizeRoles('ADMIN'), listAuditLogs);
router.get('/admin/db-status', authorizeRoles('ADMIN'), getDbStatus);
router.post('/admin/backup', authorizeRoles('ADMIN'), performBackup);
router.post('/admin/restore', authorizeRoles('ADMIN'), performRestore);

export default router;
