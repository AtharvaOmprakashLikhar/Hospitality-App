import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.middleware';
import { scanFileMiddleware } from '../middleware/clamav.middleware';
import {
  createVenue,
  getVenues,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  uploadMenuItemImage,
  getVenueItems
} from '../controllers/menu.controller';

const router = Router();

// Ensure upload directory exists
const uploadDir = process.env.VERCEL 
  ? '/tmp/uploads' 
  : path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (err) {
    console.error('Failed to create upload directory:', err);
  }
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `temp-menu-${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowed.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type. Only JPEG, PNG, or WebP are allowed.'));
    }
  }
});

// GET endpoints are public-readable (no auth required for POS/ordering views)
router.get('/venues/:venueId/items', getVenueItems);
router.get('/venues', authenticateJWT, getVenues); // Fetching venue list needs auth

// Write endpoints are guarded by auth and role validation
router.post('/venues', authenticateJWT, authorizeRoles('ADMIN'), createVenue);
router.post('/items', authenticateJWT, authorizeRoles('ADMIN', 'MANAGER'), createMenuItem);
router.patch('/items/:id', authenticateJWT, authorizeRoles('ADMIN', 'MANAGER'), updateMenuItem);
router.delete('/items/:id', authenticateJWT, authorizeRoles('ADMIN', 'MANAGER'), deleteMenuItem);

// Image uploading route runs through multer, then ClamAV threat scanner middleware, then sharp compressor controller
router.post(
  '/items/:id/image',
  authenticateJWT,
  authorizeRoles('ADMIN', 'MANAGER'),
  upload.single('image'),
  scanFileMiddleware,
  uploadMenuItemImage
);

export default router;
