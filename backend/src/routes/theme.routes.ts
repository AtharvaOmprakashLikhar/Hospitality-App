import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { 
  getThemeConfig, 
  saveThemeConfig, 
  revertThemeConfig, 
  resetThemeConfig, 
  uploadLogo 
} from '../controllers/theme.controller';

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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${req.params.tenantId}-logo-${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|svg|webp|gif/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowed.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, SVG, GIF, or WebP images are allowed.'));
    }
  }
});

router.get('/:tenantId', getThemeConfig);
router.post('/:tenantId/save', saveThemeConfig);
router.post('/:tenantId/revert', revertThemeConfig);
router.post('/:tenantId/reset', resetThemeConfig);
router.post('/:tenantId/upload-logo', upload.single('logo'), uploadLogo);

export default router;
