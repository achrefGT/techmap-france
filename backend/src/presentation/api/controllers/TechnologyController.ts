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
   * Get all technologies with optional filters
   *
   * Supports all filtering options:
   * - category (frontend, backend, etc.)
   * - popularityLevel (trending, popular, common, niche)
   * - inDemandOnly (boolean - jobCount > 100)
   * - q (search query)
   * - limit (for top technologies)
   */
  getAllTechnologies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const category = req.query.category as string | undefined;
      const popularityLevel = req.query.popularityLevel as string | undefined;
      const inDemandOnly = req.query.inDemandOnly === 'true';
      const searchQuery = req.query.q as string | undefined;

      let technologies = await this.technologyService.getAllTechnologies();

      // Apply category filter
      if (category) {
        technologies = technologies.filter(tech => tech.category === category);
      }

      // Apply popularity level filter
      if (popularityLevel) {
        const validLevels = ['trending', 'popular', 'common', 'niche'];
        if (!validLevels.includes(popularityLevel)) {
          res.status(400).json({
            error: 'Invalid popularity level',
            message: `Popularity level must be one of: ${validLevels.join(', ')}`,
          });
          return;
        }
        technologies = technologies.filter(tech => tech.popularityLevel === popularityLevel);
      }

      // Apply in-demand filter
      if (inDemandOnly) {
        technologies = technologies.filter(tech => tech.isInDemand);
      }

      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        technologies = technologies.filter(
          tech =>
            tech.name.toLowerCase().includes(query) ||
            tech.displayName.toLowerCase().includes(query)
        );
      }

      // Sort by job count (for trending) and apply limit
      if (limit) {
        technologies = technologies.sort((a, b) => b.jobCount - a.jobCount).slice(0, limit);
      }

      res.json({
        success: true,
        data: technologies,
        meta: {
          count: technologies.length,
          ...(category && { category }),
          ...(popularityLevel && { popularityLevel }),
          ...(inDemandOnly && { inDemandOnly }),
          ...(searchQuery && { query: searchQuery }),
          ...(limit && { limit }),
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
      const includeStats = req.query.includeStats === 'true';

      if (isNaN(id)) {
        res.status(400).json({
          error: 'Invalid technology ID',
          message: 'Technology ID must be a number',
        });
        return;
      }

      // If stats requested, use getTechnologyStats, otherwise just get the technology
      if (includeStats) {
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
      } else {
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
      }
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
   * POST /api/technologies/compare
   * Compare multiple technologies
   */
  compareTechnologies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { technologyIds } = req.body;

      if (!Array.isArray(technologyIds) || technologyIds.length < 2 || technologyIds.length > 5) {
        res.status(400).json({
          error: 'Invalid technology IDs',
          message: 'technologyIds must be an array with 2-5 technology IDs',
        });
        return;
      }

      const technologies = await Promise.all(
        technologyIds.map(id => this.technologyService.getTechnologyStats(id))
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
          requested: technologyIds.length,
          found: validTechnologies.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
