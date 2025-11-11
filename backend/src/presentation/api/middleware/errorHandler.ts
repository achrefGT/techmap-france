import { Request, Response, NextFunction } from 'express';
import { DomainError } from '../../../domain/errors/DomainErrors';

/**
 * Global Error Handler Middleware
 *
 * Responsibilities:
 * - Catch all errors from controllers
 * - Transform errors into standardized responses
 * - Log errors appropriately
 * - Hide sensitive details in production
 */

interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: unknown;
  stack?: string;
}

interface ValidationError extends Error {
  errors?: unknown;
}

interface DatabaseError extends Error {
  code?: string;
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  // Don't do anything if response already sent
  if (res.headersSent) {
    return next(err);
  }

  // Log error (in production, use proper logging service)
  console.error('Error caught by error handler:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle Domain Errors
  if (err instanceof DomainError) {
    const response: ErrorResponse = {
      error: 'Domain Error',
      message: err.message,
      code: err.code,
    };

    if (err.details) {
      response.details = err.details;
    }

    // Most domain errors are client errors (400)
    const statusCode = getStatusCodeForDomainError(err.code);
    res.status(statusCode).json(response);
    return;
  }

  // Handle Validation Errors (from express-validator or similar)
  if (err.name === 'ValidationError') {
    const validationErr = err as ValidationError;
    res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: validationErr.errors,
    });
    return;
  }

  // Handle Database Errors
  const dbErr = err as DatabaseError;
  if (err.name === 'DatabaseError' || dbErr.code?.startsWith('23')) {
    // PostgreSQL error codes start with 23 for integrity constraint violations
    res.status(500).json({
      error: 'Database Error',
      message: 'A database error occurred',
      // Don't expose database details in production
      ...(process.env.NODE_ENV !== 'production' && { details: err.message }),
    });
    return;
  }

  // Handle Not Found Errors
  if (err.message.includes('not found') || err.message.includes('Not found')) {
    res.status(404).json({
      error: 'Not Found',
      message: err.message,
    });
    return;
  }

  // Handle Unauthorized Errors
  if (err.name === 'UnauthorizedError' || err.message.includes('Unauthorized')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  // Handle Forbidden Errors
  if (err.name === 'ForbiddenError' || err.message.includes('Forbidden')) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to perform this action',
    });
    return;
  }

  // Default: Internal Server Error
  const response: ErrorResponse = {
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  };

  // Include stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(500).json(response);
}

/**
 * Map domain error codes to HTTP status codes
 */
function getStatusCodeForDomainError(code: string): number {
  const errorCodeMap: Record<string, number> = {
    // 400 Bad Request
    JOB_TITLE_REQUIRED: 400,
    JOB_TITLE_TOO_LONG: 400,
    JOB_NO_TECHNOLOGIES: 400,
    JOB_TECH_NAME_TOO_LONG: 400,
    JOB_DESCRIPTION_TOO_LONG: 400,
    JOB_FUTURE_DATE: 400,
    SALARY_INVALID_RANGE: 400,
    TECHNOLOGY_NAME_REQUIRED: 400,
    TECHNOLOGY_INVALID_CATEGORY: 400,
    REGION_CODE_INVALID: 400,

    // 409 Conflict
    JOB_EXPIRED: 409,

    // 404 Not Found (if we add these codes)
    JOB_NOT_FOUND: 404,
    TECHNOLOGY_NOT_FOUND: 404,
    REGION_NOT_FOUND: 404,
  };

  return errorCodeMap[code] || 400; // Default to 400 for domain errors
}

/**
 * 404 Handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
}

/**
 * Async route handler type
 */
type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response>;

/**
 * Async route wrapper to catch async errors
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
