import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../../../application/use-cases/AnalyticsService';

/**
 * Analytics Controller
 *
 * Responsibilities:
 * - Handle analytics and statistics requests
 * - Provide dashboard data and market insights
 */
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  /**
   * GET /api/analytics/dashboard
   * Get dashboard overview statistics
   */
  getDashboardStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.analyticsService.getDashboardStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/analytics/salary
   * Get comprehensive salary statistics
   */
  getSalaryStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.analyticsService.getSalaryStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/analytics/market
   * Get market insights (hot technologies, top regions, top companies)
   */
  getMarketInsights = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const insights = await this.analyticsService.getMarketInsights();

      res.json({
        success: true,
        data: insights,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/analytics/trends/technologies
   * Get technology trends
   */
  getTechnologyTrends = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const limit = parseInt(req.query.limit as string) || 10;

      // This would require TrendAnalysisService methods
      // Placeholder for now
      res.json({
        success: true,
        data: {
          message: 'Technology trends endpoint - implement with TrendAnalysisService',
          days,
          limit,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/analytics/salary/by-experience
   * Get salary breakdown by experience level
   */
  getSalaryByExperience = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const stats = await this.analyticsService.getSalaryStats();

      res.json({
        success: true,
        data: stats.byExperience,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/analytics/salary/by-technology
   * Get salary breakdown by technology
   */
  getSalaryByTechnology = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const stats = await this.analyticsService.getSalaryStats();
      const limit = parseInt(req.query.limit as string) || 20;

      const topTechnologies = stats.byTechnology
        .sort((a, b) => b.average - a.average)
        .slice(0, limit);

      res.json({
        success: true,
        data: topTechnologies,
        meta: {
          limit,
          total: stats.byTechnology.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/analytics/salary/by-region
   * Get salary breakdown by region
   */
  getSalaryByRegion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.analyticsService.getSalaryStats();
      const limit = parseInt(req.query.limit as string) || 20;

      const topRegions = stats.byRegion.sort((a, b) => b.average - a.average).slice(0, limit);

      res.json({
        success: true,
        data: topRegions,
        meta: {
          limit,
          total: stats.byRegion.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/analytics/companies/top
   * Get top hiring companies
   */
  getTopCompanies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const insights = await this.analyticsService.getMarketInsights();

      const topCompanies = insights.topCompanies.slice(0, limit);

      res.json({
        success: true,
        data: topCompanies,
        meta: {
          limit,
          total: insights.topCompanies.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/analytics/distribution/experience
   * Get experience level distribution
   */
  getExperienceDistribution = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const insights = await this.analyticsService.getMarketInsights();

      res.json({
        success: true,
        data: insights.experienceDistribution,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/analytics/distribution/remote
   * Get remote vs onsite distribution
   */
  getRemoteDistribution = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const insights = await this.analyticsService.getMarketInsights();

      res.json({
        success: true,
        data: insights.remoteVsOnsite,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/analytics/summary
   * Get comprehensive analytics summary
   */
  getSummary = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const [dashboard, salary, market] = await Promise.all([
        this.analyticsService.getDashboardStats(),
        this.analyticsService.getSalaryStats(),
        this.analyticsService.getMarketInsights(),
      ]);

      res.json({
        success: true,
        data: {
          dashboard,
          salary: {
            overall: salary.overall,
            byExperience: salary.byExperience,
          },
          market: {
            hotTechnologies: market.hotTechnologies.slice(0, 5),
            topRegions: market.topRegions.slice(0, 5),
            topCompanies: market.topCompanies.slice(0, 5),
            experienceDistribution: market.experienceDistribution,
            remoteVsOnsite: market.remoteVsOnsite,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
