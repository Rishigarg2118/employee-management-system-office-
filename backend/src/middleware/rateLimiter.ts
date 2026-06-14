import { Request, Response, NextFunction } from 'express';

interface RateLimitInfo {
  timestamps: number[];
}

const limitStore = new Map<string, RateLimitInfo>();

export function createRateLimiter(options: { windowMs: number; max: number; message: string }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.NODE_ENV !== 'production') {
      next();
      return;
    }
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.baseUrl || req.path}`;
    const now = Date.now();

    // Get client request record
    if (!limitStore.has(key)) {
      limitStore.set(key, { timestamps: [] });
    }

    const record = limitStore.get(key)!;
    
    // Filter out timestamps outside the window range
    record.timestamps = record.timestamps.filter(t => now - t < options.windowMs);

    if (record.timestamps.length >= options.max) {
      res.status(429).json({ message: options.message });
      return;
    }

    record.timestamps.push(now);
    next();
  };
}
