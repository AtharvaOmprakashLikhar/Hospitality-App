import { Router } from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.middleware';
import {
  setSalaryStructure,
  getSalaryStructure,
  generatePayslip,
  getPayslips,
  downloadPayslipPDF
} from '../controllers/salary.controller';

const router = Router();

// Apply JWT authentication to all salary endpoints
router.use(authenticateJWT);

router.post('/structure', authorizeRoles('ADMIN'), setSalaryStructure);
router.get('/structure/:userId', getSalaryStructure);
router.post('/payslip/generate', authorizeRoles('ADMIN'), generatePayslip);
router.get('/payslips/:userId', getPayslips);
router.get('/payslip/:id/pdf', downloadPayslipPDF);

export default router;
