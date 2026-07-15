import { Router } from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.middleware';
import {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  changeRoomStatus,
  getRoomAvailability,
  getNextAvailable,
  getRoomHistory,
  getRoomDashboard
} from '../controllers/rooms.controller';

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRoles('ADMIN', 'MANAGER'));

router.get('/', getRooms);
router.get('/dashboard', getRoomDashboard);
router.get('/availability', getRoomAvailability);
router.get('/next-available', getNextAvailable);
router.get('/history', getRoomHistory);
router.get('/:id', getRoomById);
router.post('/', createRoom);
router.put('/:id', updateRoom);
router.delete('/:id', deleteRoom);
router.patch('/status', changeRoomStatus);

export default router;
