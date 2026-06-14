import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { db } from '../config/db';

const HMAC_SECRET = 'enterprise-workforce-hardening-secret-key-2026';
const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Simple memory cache to track nonces and prevent replay attacks
const processedNonces = new Map<string, number>();

// Clean up expired nonces periodically (every 1 minute)
const nonceCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [nonce, timestamp] of processedNonces.entries()) {
    if (now - timestamp > REPLAY_WINDOW_MS) {
      processedNonces.delete(nonce);
    }
  }
}, 60 * 1000);
nonceCleanupInterval.unref();

export async function verifyRequestSecurity(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Exclude health checks, update downloads, and static documentation
  if (req.path === '/health' || req.path.startsWith('/updates') || req.path.startsWith('/uploads') || req.path.startsWith('/api-docs')) {
    return next();
  }

  // Bypass security signature checks for web browser frontend connections (including local and production configurations)
  const origin = req.headers.origin;
  if (origin) {
    const cleanOrigin = origin.trim().replace(/\/$/, '');
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:3000',
      process.env.FRONTEND_URL || '',
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : [])
    ].filter(Boolean).map(o => o.trim().replace(/\/$/, ''));

    const isVercel = cleanOrigin.endsWith('.vercel.app');
    const isAllowed = allowedOrigins.includes(cleanOrigin) || isVercel;

    if (isAllowed) {
      return next();
    }
  }

  const signature = req.headers['x-signature'] as string;
  const timestampStr = req.headers['x-timestamp'] as string;
  const nonce = req.headers['x-nonce'] as string;
  const fingerprint = req.headers['x-device-fingerprint'] as string;

  if (!signature || !timestampStr || !nonce) {
    console.warn(`[Security Alert] Missing request signature headers: path=${req.path}`);
    res.status(403).json({ message: 'Forbidden: Missing security signature credentials.' });
    return;
  }

  const timestamp = parseInt(timestampStr, 10);
  const now = Date.now();

  // 1. Replay Protection: Check Time Drift
  if (isNaN(timestamp) || Math.abs(now - timestamp) > REPLAY_WINDOW_MS) {
    console.warn(`[Security Alert] Replay protection drift breach: path=${req.path}, drift=${Math.abs(now - timestamp)}ms`);
    res.status(403).json({ message: 'Forbidden: Request timestamp expired or invalid clock synchronization.' });
    return;
  }

  // 2. Replay Protection: Nonce Reuse
  if (processedNonces.has(nonce)) {
    console.error(`[Security Alert] Replay Attack Detected! Duplicate Nonce: ${nonce}, path=${req.path}`);
    // Record security violation in DB
    try {
      await db.logActivity(
        null, // System event
        'SECURITY_ALERT',
        `Replay attack attempt blocked. Nonce ${nonce} reused on endpoint ${req.path}.`
      );
    } catch {}
    res.status(403).json({ message: 'Forbidden: Replay attack signature match.' });
    return;
  }
  processedNonces.set(nonce, now);

  // 3. HMAC Validation Check
  const bodyStr = req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : '';
  
  // Reconstruct message
  const endpoint = req.path.replace(/^\/api/, '');
  const messageToSign = `${req.method}:${endpoint}:${timestampStr}:${nonce}:${bodyStr}`;
  
  const expectedSignature = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(messageToSign)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.error(`[Security Alert] HMAC signature validation mismatch: expected=${expectedSignature}, received=${signature}`);
    res.status(403).json({ message: 'Forbidden: Request payload signature is invalid.' });
    return;
  }

  // Decrypt telemetry payloads if encrypted
  if ((req.path === '/attendance/heartbeat' || req.path === '/api/attendance/heartbeat' || 
       req.path === '/attendance/bulk-heartbeat' || req.path === '/api/attendance/bulk-heartbeat') && 
      req.body && req.body.iv && req.body.ciphertext) {
    try {
      const salt = Buffer.from('workforce-salt');
      const key = crypto.pbkdf2Sync('enterprise-offline-hardened-key-material-2026', salt, 1000, 32, 'sha256');
      
      const iv = Buffer.from(req.body.iv, 'base64');
      const encrypted = Buffer.from(req.body.ciphertext, 'base64');
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      const tag = encrypted.subarray(encrypted.length - 16);
      const ciphertext = encrypted.subarray(0, encrypted.length - 16);
      
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(ciphertext, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      req.body = JSON.parse(decrypted);
      console.log(`[Security Middleware] Decrypted network payload for ${req.path}`);
    } catch (err: any) {
      console.error('[Security Middleware] Decryption failed:', err);
      res.status(400).json({ message: 'Bad Request: Encrypted payload could not be decrypted.' });
      return;
    }
  }

  // 4. Device Fingerprint & Approval State Check
  const isAuthRoute = req.path.startsWith('/auth/') || req.originalUrl.startsWith('/api/auth/');
  const isDeviceRegisterRoute = req.path === '/devices/register' || req.originalUrl === '/api/devices/register' || req.path === '/api/devices/register';
  
  if (!isAuthRoute && !isDeviceRegisterRoute) {
    if (!fingerprint) {
      console.warn(`[Security Alert] Missing device fingerprint header: path=${req.path}, originalUrl=${req.originalUrl}`);
      res.status(403).json({ message: 'Forbidden: Device fingerprint header is missing.' });
      return;
    }
    const device = await db.getDeviceByUuid(fingerprint);
    if (!device) {
      console.warn(`[Security Alert] Unregistered device fingerprint: fingerprint=${fingerprint}, path=${req.path}`);
      res.status(403).json({ message: 'Forbidden: Device is not registered in the system.' });
      return;
    }
    if (device.status !== 'Approved') {
      console.warn(`[Security Alert] Unauthorized device attempt: fingerprint=${fingerprint}, status=${device.status}, path=${req.path}`);
      res.status(403).json({ message: `Forbidden: Device authorization status is: ${device.status}` });
      return;
    }
  }

  // Log successfully fingerprinted and signed request
  if (fingerprint) {
    (req as any).deviceFingerprint = fingerprint;
  }

  next();
}
