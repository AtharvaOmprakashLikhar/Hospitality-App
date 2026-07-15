import { Router } from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.middleware';
import { 
  createOrder, 
  reviseOrder, 
  getTableOrder, 
  getKitchenQueue, 
  updateOrderStatus 
} from '../controllers/order.controller';

const router = Router();

// Secure all order routing paths
router.use(authenticateJWT);

router.post('/', authorizeRoles('WAITER', 'MANAGER', 'ADMIN'), createOrder);
router.patch('/:id/revise', authorizeRoles('WAITER', 'MANAGER', 'ADMIN'), reviseOrder);
router.get('/table/:tableId', authorizeRoles('WAITER', 'KITCHEN', 'MANAGER', 'ADMIN'), getTableOrder);
router.get('/kitchen-queue', authorizeRoles('KITCHEN', 'MANAGER', 'ADMIN'), getKitchenQueue);
router.patch('/:id/status', authorizeRoles('KITCHEN', 'MANAGER', 'ADMIN'), updateOrderStatus);

export default router;
