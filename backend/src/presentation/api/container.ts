import { pool } from '../../infrastructure/persistence/connection';

// Repositories
import { PostgresJobRepository } from '../../infrastructure/persistence/PostgresJobRepository';
import { PostgresTechnologyRepository } from '../../infrastructure/persistence/PostgresTechnologyRepository';
import { PostgresRegionRepository } from '../../infrastructure/persistence/PostgresRegionRepository';
import { PostgresStatsRepository } from '../../infrastructure/persistence/PostgresStatsRepository';

// Domain Services
import { TrendAnalysisService } from '../../domain/services/TrendAnalysisService';

// Application Services
import { JobService } from '../../application/use-cases/JobService';
import { JobSearchService } from '../../application/use-cases/JobSearchService';
import { JobIngestionService } from '../../application/use-cases/JobIngestionService';
import { TechnologyService } from '../../application/use-cases/TechnologyService';
import { RegionService } from '../../application/use-cases/RegionService';
import { AnalyticsService } from '../../application/use-cases/AnalyticsService';

// Infrastructure
import { WinstonLogger } from '../../infrastructure/logging/WinstonLogger';
import { ConsoleMetrics } from '../../infrastructure/metrics/Metrics';
import { RedisCache } from '../../infrastructure/cache/RedisCache';

// Controllers
import { JobController } from './controllers/JobController';
import { TechnologyController } from './controllers/TechnologyController';
import { RegionController } from './controllers/RegionController';
import { AnalyticsController } from './controllers/AnalyticsController';
import { IngestionController } from './controllers/IngestionController';

/**
 * Dependency Injection Container
 *
 * Responsibilities:
 * - Wire up all dependencies
 * - Provide singleton instances
 * - Handle service lifecycle
 *
 */
export class DIContainer {
  // Infrastructure
  private cache!: RedisCache;
  private logger!: WinstonLogger;
  private metrics!: ConsoleMetrics;

  // Repositories
  private jobRepository!: PostgresJobRepository;
  private technologyRepository!: PostgresTechnologyRepository;
  private regionRepository!: PostgresRegionRepository;
  private statsRepository!: PostgresStatsRepository;

  // Domain Services
  private trendAnalysisService!: TrendAnalysisService;

  // Application Services
  private jobService!: JobService;
  private jobSearchService!: JobSearchService;
  private jobIngestionService!: JobIngestionService;
  private technologyService!: TechnologyService;
  private regionService!: RegionService;
  private analyticsService!: AnalyticsService;

  // Controllers
  private _jobController!: JobController;
  private _technologyController!: TechnologyController;
  private _regionController!: RegionController;
  private _analyticsController!: AnalyticsController;
  private _ingestionController!: IngestionController;

  constructor() {
    // Initialize infrastructure layer
    this.initializeInfrastructure();

    // Initialize repositories
    this.initializeRepositories();

    // Initialize domain services
    this.initializeDomainServices();

    // Initialize application services
    this.initializeApplicationServices();

    // Initialize controllers
    this.initializeControllers();
  }

  private initializeInfrastructure(): void {
    // Cache
    this.cache = new RedisCache();

    // Logging
    this.logger = new WinstonLogger('job-aggregator');

    // Metrics
    this.metrics = new ConsoleMetrics();

    this.logger.info('Infrastructure initialized');
  }

  private initializeRepositories(): void {
    this.jobRepository = new PostgresJobRepository();
    this.technologyRepository = new PostgresTechnologyRepository();
    this.regionRepository = new PostgresRegionRepository();
    this.statsRepository = new PostgresStatsRepository();

    this.logger.info('Repositories initialized');
  }

  private initializeDomainServices(): void {
    // TrendAnalysisService: (statsRepository, userConfig?)
    this.trendAnalysisService = new TrendAnalysisService(this.statsRepository);

    this.logger.info('Domain services initialized');
  }

  private initializeApplicationServices(): void {
    // Job services
    this.jobService = new JobService(this.jobRepository);

    this.jobSearchService = new JobSearchService(this.jobRepository);

    this.jobIngestionService = new JobIngestionService(
      this.jobRepository,
      this.technologyRepository,
      this.regionRepository,
      {
        logger: this.logger,
        metrics: this.metrics,
        cacheTechnologies: true,
      }
    );

    // TechnologyService: (technologyRepository, jobRepository, regionRepository)
    this.technologyService = new TechnologyService(
      this.technologyRepository,
      this.jobRepository,
      this.regionRepository
    );

    // RegionService: (regionRepository, jobRepository, technologyRepository)
    this.regionService = new RegionService(
      this.regionRepository,
      this.jobRepository,
      this.technologyRepository
    );

    // AnalyticsService: (jobRepository, technologyRepository, regionRepository, trendService)
    this.analyticsService = new AnalyticsService(
      this.jobRepository,
      this.technologyRepository,
      this.regionRepository,
      this.trendAnalysisService
    );

    this.logger.info('Application services initialized');
  }

  private initializeControllers(): void {
    // JobController: (jobService, jobSearchService)
    this._jobController = new JobController(this.jobService, this.jobSearchService);

    // TechnologyController: (technologyService)
    this._technologyController = new TechnologyController(this.technologyService);

    // RegionController: (regionService)
    this._regionController = new RegionController(this.regionService);

    // AnalyticsController: (analyticsService)
    this._analyticsController = new AnalyticsController(this.analyticsService);

    // IngestionController: (jobIngestionService, logger)
    this._ingestionController = new IngestionController(this.jobIngestionService, this.logger);

    this.logger.info('Controllers initialized');
  }

  // Getters for controllers
  get jobController(): JobController {
    return this._jobController;
  }

  get technologyController(): TechnologyController {
    return this._technologyController;
  }

  get regionController(): RegionController {
    return this._regionController;
  }

  get analyticsController(): AnalyticsController {
    return this._analyticsController;
  }

  get ingestionController(): IngestionController {
    return this._ingestionController;
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    services: Record<string, boolean>;
  }> {
    const services: Record<string, boolean> = {};

    // Check database
    try {
      await pool.query('SELECT 1');
      services.database = true;
    } catch (error) {
      services.database = false;
      this.logger.error('Database health check failed', { error });
    }

    // Check Redis
    try {
      services.redis = await this.cache.ping();
    } catch (error) {
      services.redis = false;
      this.logger.error('Redis health check failed', { error });
    }

    const allHealthy = Object.values(services).every(status => status);

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      services,
    };
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down application...');

    try {
      await pool.end();
      this.logger.info('Database connection closed');
    } catch (error) {
      this.logger.error('Error closing database connection', { error });
    }

    this.logger.info('Application shut down complete');
  }
}

// Export singleton instance
export const container = new DIContainer();
