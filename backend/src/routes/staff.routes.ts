import { Router } from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.middleware';
import { 
  createAssignment, 
  getAssignments, 
  updateAssignment, 
  deleteAssignment 
} from '../controllers/staff.controller';

const router = Router();

// Apply JWT authentication to all staff endpoints
router.use(authenticateJWT);

router.post('/', authorizeRoles('ADMIN', 'MANAGER'), createAssignment);
router.get('/', getAssignments);
router.patch('/:id', authorizeRoles('ADMIN', 'MANAGER'), updateAssignment);
router.delete('/:id', authorizeRoles('ADMIN', 'MANAGER'), deleteAssignment);

export default router;
