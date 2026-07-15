import { Router } from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.middleware';
import {
  createReservation,
  listReservations,
  updateReservationStatus,
  getAvailableServices,
  createPropertyService
} from '../controllers/reservations.controller';

const router = Router();

router.use(authenticateJWT);

router.get('/services', getAvailableServices);
router.post('/services', authorizeRoles('ADMIN', 'MANAGER'), createPropertyService);
router.get('/', authorizeRoles('ADMIN', 'MANAGER', 'WAITER', 'USER'), listReservations);
router.post('/', authorizeRoles('ADMIN', 'MANAGER', 'WAITER'), createReservation);
router.patch('/:id/status', authorizeRoles('ADMIN', 'MANAGER'), updateReservationStatus);

export default router;
