import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

/**
 * Validation Middleware
 *
 * Works with express-validator to validate request inputs
 * Usage: router.post('/path', validateRequest(validationRules), handler)
 */

/**
 * Validate request and return errors if any
 */
export function validateRequest(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    // Check for errors
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Request validation failed',
        details: errors.array().map(err => ({
          field: err.type === 'field' ? err.path : undefined,
          message: err.msg,
          value: err.type === 'field' ? err.value : undefined,
        })),
      });
      return;
    }

    next();
  };
}

/**
 * Common validation rules
 */
import { body, query, param } from 'express-validator';

export const validationRules = {
  // Pagination
  pagination: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('pageSize')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Page size must be between 1 and 100'),
  ],

  // ID parameter
  id: [param('id').notEmpty().withMessage('ID is required')],

  numericId: [param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer')],

  // Search query
  searchQuery: [
    query('q')
      .notEmpty()
      .withMessage('Search query is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Search query must be between 2 and 100 characters'),
  ],

  // Job filters
  jobFilters: [
    query('technologies')
      .optional()
      .isString()
      .withMessage('Technologies must be a comma-separated string'),
    query('regionIds')
      .optional()
      .isString()
      .withMessage('Region IDs must be a comma-separated string'),
    query('isRemote').optional().isBoolean().withMessage('isRemote must be a boolean'),
    query('minSalary')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Min salary must be a non-negative integer'),
    query('maxSalary')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Max salary must be a non-negative integer'),
  ],

  // Job ingestion
  jobIngestion: [
    body('*.id').notEmpty().withMessage('Job ID is required'),
    body('*.title')
      .notEmpty()
      .withMessage('Job title is required')
      .isLength({ max: 200 })
      .withMessage('Job title must not exceed 200 characters'),
    body('*.company').notEmpty().withMessage('Company name is required'),
    body('*.sourceApi').notEmpty().withMessage('Source API is required'),
    body('*.externalId').notEmpty().withMessage('External ID is required'),
  ],

  // Advanced search
  advancedSearch: [
    body('requiredTechnologies')
      .optional()
      .isArray()
      .withMessage('Required technologies must be an array'),
    body('preferredTechnologies')
      .optional()
      .isArray()
      .withMessage('Preferred technologies must be an array'),
    body('minSalary')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Min salary must be a non-negative integer'),
  ],
};

/**
 * Recursively trims string values in an object
 */
function sanitizeObject(obj: any): void {
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (typeof value === 'string') {
      obj[key] = value.trim();
    } else if (typeof value === 'object' && value !== null) {
      sanitizeObject(value);
    }
  });
}

/**
 * Sanitization middleware
 * Trims and normalizes input strings
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  // Sanitize query params
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      const value = req.query[key];
      if (typeof value === 'string') {
        req.query[key] = value.trim();
      }
    });
  }

  // Sanitize body params
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }

  next();
}
