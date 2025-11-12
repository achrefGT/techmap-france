import { Request, Response, NextFunction } from 'express';
import { JobService } from '../../../application/use-cases/JobService';
import { JobSearchService } from '../../../application/use-cases/JobSearchService';
import { JobFiltersDTO } from '../../../application/dtos/JobDTO';

/**
 * Job Controller
 *
 * Responsibilities:
 * - Handle HTTP requests/responses
 * - Input validation
 * - Call application services
 * - Transform responses
 */
export class JobController {
  constructor(
    private jobService: JobService,
    private jobSearchService: JobSearchService
  ) {}

  /**
   * GET /api/jobs/:id
   * Get a single job by ID
   */
  getJobById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const job = await this.jobService.getJobById(id);

      if (!job) {
        res.status(404).json({
          error: 'Job not found',
          message: `No job found with ID: ${id}`,
        });
        return;
      }

      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/jobs
   * Get paginated list of jobs with ALL filters
   *
   * Supports all filtering options:
   * - technologies, regionIds, isRemote, experienceCategories
   * - minSalary, maxSalary, minQualityScore
   * - postedAfter, recent (last N days)
   * - company, activeOnly
   * - q (text search)
   */
  getJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      // Build filters from query params
      const filters: JobFiltersDTO = {};

      // Technology filter
      if (req.query.technologies) {
        filters.technologies = (req.query.technologies as string).split(',');
      }

      // Region filter
      if (req.query.regionIds) {
        filters.regionIds = (req.query.regionIds as string).split(',').map(Number);
      }

      // Remote filter
      if (req.query.isRemote !== undefined) {
        filters.isRemote = req.query.isRemote === 'true';
      }

      // Experience filter
      if (req.query.experienceCategories) {
        filters.experienceCategories = (req.query.experienceCategories as string).split(',');
      }

      // Salary filters
      if (req.query.minSalary) {
        filters.minSalary = parseInt(req.query.minSalary as string);
      }
      if (req.query.maxSalary) {
        filters.maxSalary = parseInt(req.query.maxSalary as string);
      }

      // Quality filter
      if (req.query.minQualityScore) {
        filters.minQualityScore = parseInt(req.query.minQualityScore as string);
      }

      // Date filters
      if (req.query.postedAfter) {
        filters.postedAfter = req.query.postedAfter as string;
      }
      if (req.query.recent) {
        filters.recent = parseInt(req.query.recent as string);
      }

      // Company filter
      if (req.query.company) {
        filters.company = req.query.company as string;
      }

      // Active filter
      if (req.query.activeOnly !== undefined) {
        filters.activeOnly = req.query.activeOnly !== 'false';
      }

      // Text search
      if (req.query.q) {
        filters.searchQuery = req.query.q as string;
      }

      const result = await this.jobService.getJobs(filters, page, pageSize);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/jobs/:id/similar
   * Get similar jobs based on technology stack
   */
  getSimilarJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      const excludeSameCompany = req.query.excludeSameCompany === 'true';

      const jobs = await this.jobSearchService.getSimilarJobs(id, limit, excludeSameCompany);

      res.json({
        success: true,
        data: jobs,
        meta: {
          count: jobs.length,
          limit,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/jobs/search
   * Advanced search with scoring
   */
  advancedSearch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const criteria = req.body;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = await this.jobSearchService.advancedSearch(criteria, page, pageSize);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/jobs/compare
   * Compare multiple jobs
   */
  compareJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobIds } = req.body;

      if (!Array.isArray(jobIds) || jobIds.length < 2 || jobIds.length > 5) {
        res.status(400).json({
          error: 'Invalid job IDs',
          message: 'jobIds must be an array with 2-5 job IDs',
        });
        return;
      }

      const comparison = await this.jobSearchService.compareMultipleJobs(jobIds);

      res.json({
        success: true,
        data: comparison,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/jobs/recommendations
   * Get personalized job recommendations
   */
  getRecommendations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userPreferences = req.body;
      const limit = parseInt(req.query.limit as string) || 20;

      const recommendations = await this.jobSearchService.getRecommendedJobs(
        userPreferences,
        limit
      );

      res.json({
        success: true,
        data: recommendations,
        meta: {
          count: recommendations.length,
          limit,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/jobs/:id/deactivate
   * Deactivate a job (state transition)
   */
  deactivateJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      await this.jobService.deactivateJob(id);

      res.json({
        success: true,
        message: 'Job deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/jobs/:id/reactivate
   * Reactivate a job (state transition)
   */
  reactivateJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      await this.jobService.reactivateJob(id);

      res.json({
        success: true,
        message: 'Job reactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
