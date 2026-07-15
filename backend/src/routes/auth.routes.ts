import { Router } from 'express';
import { 
  signup, 
  login, 
  getPendingApprovals, 
  approveUser, 
  rejectUser 
} from '../controllers/auth.controller';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// Open routes
router.post('/signup', signup);
router.post('/login', login);

// Admin-only approval gates
router.get('/pending-approvals', authenticateJWT, authorizeRoles('ADMIN'), getPendingApprovals);
router.patch('/approve/:userId', authenticateJWT, authorizeRoles('ADMIN'), approveUser);
router.patch('/reject/:userId', authenticateJWT, authorizeRoles('ADMIN'), rejectUser);

export default router;
