import { Router } from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.middleware';
import {
  getHotelDashboard,
  getFloors,
  getRoomTypes,
  getRooms,
  getBookings,
  createBooking,
  getNotifications
} from '../controllers/hotel.controller';

const router = Router();
router.use(authenticateJWT);

router.get('/dashboard', authorizeRoles('ADMIN', 'MANAGER'), getHotelDashboard);
router.get('/floors', authorizeRoles('ADMIN', 'MANAGER'), getFloors);
router.get('/room-types', authorizeRoles('ADMIN', 'MANAGER'), getRoomTypes);
router.get('/rooms', authorizeRoles('ADMIN', 'MANAGER'), getRooms);
router.get('/bookings', authorizeRoles('ADMIN', 'MANAGER'), getBookings);
router.post('/bookings', authorizeRoles('ADMIN', 'MANAGER'), createBooking);
router.get('/notifications', authorizeRoles('ADMIN', 'MANAGER'), getNotifications);

export default router;
