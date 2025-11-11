import { Request, Response, NextFunction } from 'express';
import { RegionService } from '../../../application/use-cases/RegionService';

/**
 * Region Controller
 *
 * Responsibilities:
 * - Handle region-related HTTP requests
 * - Provide regional statistics and insights
 */
export class RegionController {
  constructor(private regionService: RegionService) {}

  /**
   * GET /api/regions
   * Get all regions
   */
  getAllRegions = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const regions = await this.regionService.getAllRegions();

      res.json({
        success: true,
        data: regions,
        meta: {
          count: regions.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/regions/:id
   * Get a region by ID
   */
  getRegionById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          error: 'Invalid region ID',
          message: 'Region ID must be a number',
        });
        return;
      }

      const region = await this.regionService.getRegionById(id);

      if (!region) {
        res.status(404).json({
          error: 'Region not found',
          message: `No region found with ID: ${id}`,
        });
        return;
      }

      res.json({
        success: true,
        data: region,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/regions/:id/stats
   * Get detailed statistics for a region
   */
  getRegionStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          error: 'Invalid region ID',
          message: 'Region ID must be a number',
        });
        return;
      }

      const stats = await this.regionService.getRegionStats(id);

      if (!stats) {
        res.status(404).json({
          error: 'Region not found',
          message: `No region found with ID: ${id}`,
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
   * GET /api/regions/top
   * Get top regions by job count
   */
  getTopRegions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      const regions = await this.regionService.getAllRegions();

      // Sort by job count and take top N
      const topRegions = regions.sort((a, b) => b.jobCount - a.jobCount).slice(0, limit);

      res.json({
        success: true,
        data: topRegions,
        meta: {
          limit,
          count: topRegions.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/regions/tech-hubs
   * Get regions that are tech hubs (high job density)
   */
  getTechHubs = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const regions = await this.regionService.getAllRegions();

      const techHubs = regions.filter(region => region.isTechHub);

      res.json({
        success: true,
        data: techHubs,
        meta: {
          count: techHubs.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/regions/by-type/:type
   * Get regions by type (major, significant, emerging, small)
   */
  getRegionsByType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { type } = req.params;

      const validTypes = ['major', 'significant', 'emerging', 'small'];
      if (!validTypes.includes(type)) {
        res.status(400).json({
          error: 'Invalid region type',
          message: `Type must be one of: ${validTypes.join(', ')}`,
        });
        return;
      }

      const regions = await this.regionService.getAllRegions();

      const filtered = regions.filter(region => region.regionType === type);

      res.json({
        success: true,
        data: filtered,
        meta: {
          type,
          count: filtered.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/regions/search
   * Search regions by name
   */
  searchRegions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = ((req.query.q as string) || '').toLowerCase().trim();

      if (!query) {
        res.status(400).json({
          error: 'Missing search query',
          message: 'Query parameter "q" is required',
        });
        return;
      }

      const regions = await this.regionService.getAllRegions();

      const results = regions.filter(
        region =>
          region.name.toLowerCase().includes(query) ||
          region.fullName.toLowerCase().includes(query) ||
          region.code.toLowerCase().includes(query)
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
   * GET /api/regions/compare
   * Compare multiple regions
   */
  compareRegions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ids = ((req.query.ids as string) || '')
        .split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id));

      if (ids.length === 0) {
        res.status(400).json({
          error: 'Missing region IDs',
          message: 'Query parameter "ids" is required (comma-separated)',
        });
        return;
      }

      const regions = await Promise.all(ids.map(id => this.regionService.getRegionStats(id)));

      const validRegions = regions.filter(r => r !== null);

      if (validRegions.length === 0) {
        res.status(404).json({
          error: 'No regions found',
          message: 'None of the provided IDs matched existing regions',
        });
        return;
      }

      res.json({
        success: true,
        data: validRegions,
        meta: {
          requested: ids.length,
          found: validRegions.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
