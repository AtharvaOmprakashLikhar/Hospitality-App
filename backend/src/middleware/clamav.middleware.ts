import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to simulate ClamAV malware scanning on uploaded files.
 * Reusable for endpoints handling multipart/form-data file uploads.
 */
export function scanFileMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.file) {
    return next();
  }

  console.log(`[ClamAV Scanner] Scanning uploaded file: ${req.file.originalname} (${req.file.size} bytes)`);

  const filename = req.file.originalname.toLowerCase();
  
  // Custom mock pattern checks
  if (filename.includes('eicar') || filename.includes('virus') || filename.includes('malware')) {
    console.warn(`[ClamAV Scanner] Security alert: Threat detected in file ${req.file.originalname}!`);
    return res.status(400).json({ 
      error: 'Security validation failed: File contains potential malware patterns.' 
    });
  }

  console.log(`[ClamAV Scanner] File ${req.file.originalname} passed scan.`);
  next();
}
