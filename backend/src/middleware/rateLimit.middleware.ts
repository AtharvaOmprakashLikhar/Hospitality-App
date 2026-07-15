import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

// In-memory store for rate limits (key: userId, value: timestamp)
const scanThrottles = new Map<string, number>();

/**
 * Throttles scanning requests to 1 request per 1.5 seconds per administrator account.
 */
export function scanRateLimiter(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  if (!userId) {
    return next();
  }

  const now = Date.now();
  const lastScan = scanThrottles.get(userId);

  if (lastScan && now - lastScan < 1500) {
    return res.status(429).json({ 
      error: 'Too many requests: Please wait 1.5 seconds between scanning staff attendance.' 
    });
  }

  scanThrottles.set(userId, now);
  next();
}
