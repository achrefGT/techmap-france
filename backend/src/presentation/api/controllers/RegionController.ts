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
   * Get all regions with optional filters
   *
   * Supports all filtering options:
   * - type (major, significant, emerging, small)
   * - techHubsOnly (boolean)
   * - q (search query)
   * - limit (for top regions)
   */
  getAllRegions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const type = req.query.type as string | undefined;
      const techHubsOnly = req.query.techHubsOnly === 'true';
      const searchQuery = req.query.q as string | undefined;

      let regions = await this.regionService.getAllRegions();

      // Apply type filter
      if (type) {
        const validTypes = ['major', 'significant', 'emerging', 'small'];
        if (!validTypes.includes(type)) {
          res.status(400).json({
            error: 'Invalid region type',
            message: `Type must be one of: ${validTypes.join(', ')}`,
          });
          return;
        }
        regions = regions.filter(region => region.regionType === type);
      }

      // Apply tech hub filter
      if (techHubsOnly) {
        regions = regions.filter(region => region.isTechHub);
      }

      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        regions = regions.filter(
          region =>
            region.name.toLowerCase().includes(query) ||
            region.fullName.toLowerCase().includes(query) ||
            region.code.toLowerCase().includes(query)
        );
      }

      // Sort by job count (for top regions) and apply limit
      if (limit) {
        regions = regions.sort((a, b) => b.jobCount - a.jobCount).slice(0, limit);
      }

      res.json({
        success: true,
        data: regions,
        meta: {
          count: regions.length,
          ...(type && { type }),
          ...(techHubsOnly && { techHubsOnly }),
          ...(searchQuery && { query: searchQuery }),
          ...(limit && { limit }),
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
      const includeStats = req.query.includeStats === 'true';

      if (isNaN(id)) {
        res.status(400).json({
          error: 'Invalid region ID',
          message: 'Region ID must be a number',
        });
        return;
      }

      // If stats requested, use getRegionStats, otherwise just get the region
      if (includeStats) {
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
      } else {
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
      }
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
   * POST /api/regions/compare
   * Compare multiple regions
   */
  compareRegions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { regionIds } = req.body;

      if (!Array.isArray(regionIds) || regionIds.length < 2 || regionIds.length > 5) {
        res.status(400).json({
          error: 'Invalid region IDs',
          message: 'regionIds must be an array with 2-5 region IDs',
        });
        return;
      }

      const regions = await Promise.all(regionIds.map(id => this.regionService.getRegionStats(id)));

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
          requested: regionIds.length,
          found: validRegions.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
