import { Request, Response, NextFunction } from 'express';
import { TechnologyService } from '../../../application/use-cases/TechnologyService';

/**
 * Technology Controller
 *
 * Responsibilities:
 * - Handle technology-related HTTP requests
 * - Provide technology statistics and trends
 */
export class TechnologyController {
  constructor(private technologyService: TechnologyService) {}

  /**
   * GET /api/technologies
   * Get all technologies
   */
  getAllTechnologies = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const technologies = await this.technologyService.getAllTechnologies();

      res.json({
        success: true,
        data: technologies,
        meta: {
          count: technologies.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/technologies/:id
   * Get a technology by ID
   */
  getTechnologyById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          error: 'Invalid technology ID',
          message: 'Technology ID must be a number',
        });
        return;
      }

      const technology = await this.technologyService.getTechnologyById(id);

      if (!technology) {
        res.status(404).json({
          error: 'Technology not found',
          message: `No technology found with ID: ${id}`,
        });
        return;
      }

      res.json({
        success: true,
        data: technology,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/technologies/:id/stats
   * Get detailed statistics for a technology
   */
  getTechnologyStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          error: 'Invalid technology ID',
          message: 'Technology ID must be a number',
        });
        return;
      }

      const stats = await this.technologyService.getTechnologyStats(id);

      if (!stats) {
        res.status(404).json({
          error: 'Technology not found',
          message: `No technology found with ID: ${id}`,
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
   * GET /api/technologies/category/:category
   * Get technologies by category
   */
  getTechnologiesByCategory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { category } = req.params;

      const technologies = await this.technologyService.getTechnologiesByCategory(category);

      res.json({
        success: true,
        data: technologies,
        meta: {
          category,
          count: technologies.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/technologies/trending
   * Get trending technologies (most job postings)
   */
  getTrendingTechnologies = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      const technologies = await this.technologyService.getAllTechnologies();

      // Sort by job count and take top N
      const trending = technologies.sort((a, b) => b.jobCount - a.jobCount).slice(0, limit);

      res.json({
        success: true,
        data: trending,
        meta: {
          limit,
          count: trending.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/technologies/in-demand
   * Get technologies in high demand (jobCount > threshold)
   */
  getInDemandTechnologies = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const threshold = parseInt(req.query.threshold as string) || 100;

      const technologies = await this.technologyService.getAllTechnologies();

      const inDemand = technologies.filter(tech => tech.jobCount >= threshold);

      res.json({
        success: true,
        data: inDemand,
        meta: {
          threshold,
          count: inDemand.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/technologies/popular
   * Get popular technologies (categorized by popularity level)
   */
  getPopularTechnologies = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const technologies = await this.technologyService.getAllTechnologies();

      const grouped = {
        trending: technologies.filter(t => t.popularityLevel === 'trending'),
        popular: technologies.filter(t => t.popularityLevel === 'popular'),
        common: technologies.filter(t => t.popularityLevel === 'common'),
        niche: technologies.filter(t => t.popularityLevel === 'niche'),
      };

      res.json({
        success: true,
        data: grouped,
        meta: {
          total: technologies.length,
          breakdown: {
            trending: grouped.trending.length,
            popular: grouped.popular.length,
            common: grouped.common.length,
            niche: grouped.niche.length,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/technologies/search
   * Search technologies by name
   */
  searchTechnologies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = ((req.query.q as string) || '').toLowerCase().trim();

      if (!query) {
        res.status(400).json({
          error: 'Missing search query',
          message: 'Query parameter "q" is required',
        });
        return;
      }

      const technologies = await this.technologyService.getAllTechnologies();

      const results = technologies.filter(
        tech =>
          tech.name.toLowerCase().includes(query) || tech.displayName.toLowerCase().includes(query)
      );

      res.json({
        success: true,
        data: results,
        meta: {
          query,
          count: results.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/technologies/compare
   * Compare multiple technologies
   */
  compareTechnologies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ids = ((req.query.ids as string) || '')
        .split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id));

      if (ids.length === 0) {
        res.status(400).json({
          error: 'Missing technology IDs',
          message: 'Query parameter "ids" is required (comma-separated)',
        });
        return;
      }

      const technologies = await Promise.all(
        ids.map(id => this.technologyService.getTechnologyStats(id))
      );

      const validTechnologies = technologies.filter(t => t !== null);

      if (validTechnologies.length === 0) {
        res.status(404).json({
          error: 'No technologies found',
          message: 'None of the provided IDs matched existing technologies',
        });
        return;
      }

      res.json({
        success: true,
        data: validTechnologies,
        meta: {
          requested: ids.length,
          found: validTechnologies.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
