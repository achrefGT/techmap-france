import { Request, Response, NextFunction } from 'express';
import {
  JobIngestionService,
  RawJobData,
} from '../../../application/use-cases/JobIngestionService';
import { ILogger } from '../../../application/use-cases/JobIngestionService';

/**
 * Ingestion Controller
 *
 * Responsibilities:
 * - Handle job ingestion requests
 * - Trigger batch imports
 * - Provide ingestion status
 *
 * Security Note: These endpoints should be protected with authentication
 * in production (API keys, JWT, etc.)
 */
export class IngestionController {
  constructor(
    private ingestionService: JobIngestionService,
    private logger: ILogger
  ) {}

  /**
   * POST /api/ingestion/jobs
   * Ingest jobs from external source
   *
   * Body: Array of RawJobData
   */
  ingestJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawJobs: RawJobData[] = req.body;

      if (!Array.isArray(rawJobs)) {
        res.status(400).json({
          error: 'Invalid request body',
          message: 'Request body must be an array of job objects',
        });
        return;
      }

      if (rawJobs.length === 0) {
        res.status(400).json({
          error: 'Empty job array',
          message: 'At least one job is required',
        });
        return;
      }

      this.logger.info('Ingestion request received', {
        count: rawJobs.length,
        source: rawJobs[0]?.sourceApi,
      });

      const result = await this.ingestionService.ingestJobsWithStats(rawJobs);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      this.logger.error('Ingestion failed', { error });
      next(error);
    }
  };

  /**
   * POST /api/ingestion/jobs/batch
   * Ingest jobs in batches (for large datasets)
   *
   * Body: { jobs: RawJobData[], batchSize?: number }
   */
  ingestJobsInBatches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobs, batchSize } = req.body;

      if (!Array.isArray(jobs)) {
        res.status(400).json({
          error: 'Invalid request body',
          message: 'jobs must be an array',
        });
        return;
      }

      if (jobs.length === 0) {
        res.status(400).json({
          error: 'Empty job array',
          message: 'At least one job is required',
        });
        return;
      }

      const validatedBatchSize = batchSize && batchSize > 0 ? batchSize : undefined;

      this.logger.info('Batch ingestion request received', {
        totalJobs: jobs.length,
        batchSize: validatedBatchSize,
        source: jobs[0]?.sourceApi,
      });

      const result = await this.ingestionService.ingestJobsInBatches(jobs, validatedBatchSize);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      this.logger.error('Batch ingestion failed', { error });
      next(error);
    }
  };

  /**
   * POST /api/ingestion/reload-technologies
   * Reload technology cache (call after adding new technologies to DB)
   */
  reloadTechnologies = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.logger.info('Reloading technologies cache');

      await this.ingestionService.reloadTechnologies();

      res.json({
        success: true,
        message: 'Technologies cache reloaded successfully',
      });
    } catch (error) {
      this.logger.error('Technology reload failed', { error });
      next(error);
    }
  };

  /**
   * POST /api/ingestion/clear-technology-cache
   * Clear technology cache (next ingestion will reload from DB)
   */
  clearTechnologyCache = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.logger.info('Clearing technologies cache');

      this.ingestionService.clearTechnologyCache();

      res.json({
        success: true,
        message: 'Technologies cache cleared successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/ingestion/validate
   * Validate raw job data without persisting (dry-run)
   */
  validateJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawJobs: RawJobData[] = req.body;

      if (!Array.isArray(rawJobs)) {
        res.status(400).json({
          error: 'Invalid request body',
          message: 'Request body must be an array of job objects',
        });
        return;
      }

      // Validation logic
      const validation = {
        total: rawJobs.length,
        valid: 0,
        invalid: 0,
        errors: [] as Array<{ index: number; error: string }>,
      };

      rawJobs.forEach((job, index) => {
        const errors: string[] = [];

        if (!job.id) errors.push('Missing id');
        if (!job.title) errors.push('Missing title');
        if (!job.company) errors.push('Missing company');
        if (!job.description) errors.push('Missing description');
        if (!job.sourceApi) errors.push('Missing sourceApi');
        if (!job.externalId) errors.push('Missing externalId');

        if (errors.length > 0) {
          validation.invalid++;
          validation.errors.push({
            index,
            error: errors.join(', '),
          });
        } else {
          validation.valid++;
        }
      });

      res.json({
        success: true,
        data: validation,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/ingestion/stats
   * Get ingestion statistics (placeholder - would need to track in DB)
   */
  getIngestionStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Placeholder - implement with actual stats tracking
      res.json({
        success: true,
        data: {
          message: 'Ingestion stats endpoint - implement with stats tracking',
          // Would include: total ingestions, success rate, average duration, etc.
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
