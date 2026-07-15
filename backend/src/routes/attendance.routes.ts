import { Router } from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.middleware';
import { scanRateLimiter } from '../middleware/rateLimit.middleware';
import {
  clockIn,
  clockOut,
  getAttendanceSummary,
  createLeaveRequest,
  reviewLeaveRequest,
  getLeaveRequests,
  generateAttendanceQR,
  scanAttendanceQR
} from '../controllers/attendance.controller';

const router = Router();

// Apply JWT authentication to all attendance & leave endpoints
router.use(authenticateJWT);

router.post('/clock-in', clockIn);
router.post('/clock-out', clockOut);
router.get('/summary', authorizeRoles('ADMIN', 'MANAGER'), getAttendanceSummary);

// QR Attendance
router.get('/qr/:userId', generateAttendanceQR);
router.post('/scan', authorizeRoles('ADMIN', 'MANAGER'), scanRateLimiter, scanAttendanceQR);

router.post('/leave/request', createLeaveRequest);
router.get('/leave/requests', getLeaveRequests);
router.patch('/leave/:id/review', authorizeRoles('ADMIN', 'MANAGER'), reviewLeaveRequest);

export default router;
