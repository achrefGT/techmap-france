import { Request, Response, NextFunction } from 'express';

/**
 * Request Logger Middleware
 *
 * Logs all incoming HTTP requests with timing information
 * In production, integrate with proper logging service (Winston, etc.)
 */

interface RequestLog {
  method: string;
  path: string;
  query: any;
  ip: string;
  userAgent: string;
  timestamp: string;
  duration?: number;
  statusCode?: number;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Log request
  const requestLog: RequestLog = {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    timestamp: new Date().toISOString(),
  };

  // Skip logging for health checks in production
  if (req.path === '/health' && process.env.NODE_ENV === 'production') {
    return next();
  }

  console.log(`→ ${req.method} ${req.path}`, {
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: requestLog.ip,
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data): Response {
    const duration = Date.now() - startTime;

    console.log(`← ${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Performance Monitor Middleware
 * Logs slow requests (>1000ms)
 */
export function performanceMonitor(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Log slow requests
    if (duration > 1000) {
      console.warn(`⚠️  Slow request detected:`, {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
      });
    }
  });

  next();
}

/**
 * CORS Logger (for debugging)
 */
export function corsLogger(req: Request, next: NextFunction): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('CORS Request:', {
      origin: req.get('origin'),
      method: req.method,
      path: req.path,
    });
  }
  next();
}
