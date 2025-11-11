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
   * Get paginated list of jobs with filters
   */
  getJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      // Build filters from query params
      const filters: JobFiltersDTO = {};

      if (req.query.technologies) {
        filters.technologies = (req.query.technologies as string).split(',');
      }

      if (req.query.regionIds) {
        filters.regionIds = (req.query.regionIds as string).split(',').map(Number);
      }

      if (req.query.isRemote !== undefined) {
        filters.isRemote = req.query.isRemote === 'true';
      }

      if (req.query.experienceCategories) {
        filters.experienceCategories = (req.query.experienceCategories as string).split(',');
      }

      if (req.query.minSalary) {
        filters.minSalary = parseInt(req.query.minSalary as string);
      }

      if (req.query.maxSalary) {
        filters.maxSalary = parseInt(req.query.maxSalary as string);
      }

      if (req.query.minQualityScore) {
        filters.minQualityScore = parseInt(req.query.minQualityScore as string);
      }

      if (req.query.postedAfter) {
        filters.postedAfter = req.query.postedAfter as string;
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
   * GET /api/jobs/recent
   * Get recent jobs (last N days)
   */
  getRecentJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const days = parseInt(req.query.days as string) || 7;

      const jobs = await this.jobService.getRecentJobs(days);

      res.json({
        success: true,
        data: jobs,
        meta: {
          count: jobs.length,
          days,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/jobs/search
   * Text search across jobs
   */
  searchJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query.q as string;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      if (!query) {
        res.status(400).json({
          error: 'Missing search query',
          message: 'Query parameter "q" is required',
        });
        return;
      }

      // Build filters
      const filters: JobFiltersDTO = {};
      if (req.query.isRemote !== undefined) {
        filters.isRemote = req.query.isRemote === 'true';
      }

      const result = await this.jobSearchService.searchJobs(query, filters, page, pageSize);

      res.json({
        success: true,
        data: result,
        meta: {
          query,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/jobs/search/advanced
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
   * GET /api/jobs/:id/similar
   * Get similar jobs
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
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/jobs/technology/:techStack
   * Search by technology stack (all required)
   */
  searchByTechnologyStack = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { techStack } = req.params;
      const technologies = techStack.split(',').map(t => t.trim());
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = await this.jobSearchService.searchByTechnologyStack(
        technologies,
        {},
        page,
        pageSize
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/jobs/company/:company
   * Get all jobs from a specific company
   */
  getJobsByCompany = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { company } = req.params;
      const activeOnly = req.query.activeOnly !== 'false';

      const jobs = await this.jobService.getJobsByCompany(company, activeOnly);

      res.json({
        success: true,
        data: jobs,
        meta: {
          company,
          count: jobs.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/jobs/remote
   * Get all remote jobs
   */
  getRemoteJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = await this.jobService.getRemoteJobs(page, pageSize);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/jobs/high-quality
   * Get high quality jobs
   */
  getHighQualityJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const minQualityScore = parseInt(req.query.minQualityScore as string) || 70;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = await this.jobService.getHighQualityJobs(minQualityScore, page, pageSize);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/jobs/:id/stats
   * Get detailed statistics for a job
   */
  getJobStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const stats = await this.jobService.getJobStats(id);

      if (!stats) {
        res.status(404).json({
          error: 'Job not found',
          message: `No job found with ID: ${id}`,
        });
        return;
      }

      res.json({
        success: true,
        data: stats,
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
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/jobs/compare
   * Compare two jobs
   */
  compareJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId1, jobId2 } = req.body;

      if (!jobId1 || !jobId2) {
        res.status(400).json({
          error: 'Missing job IDs',
          message: 'Both jobId1 and jobId2 are required',
        });
        return;
      }

      const comparison = await this.jobSearchService.compareJobs(jobId1, jobId2);

      res.json({
        success: true,
        data: comparison,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/jobs/:id/deactivate
   * Deactivate a job
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
   * Reactivate a job
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
