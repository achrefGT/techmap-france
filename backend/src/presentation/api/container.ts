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
import { IngestionOrchestrator } from '../../application/use-cases/IngestionOrchestrator';

// Infrastructure
import { WinstonLogger } from '../../infrastructure/logging/WinstonLogger';
import { ConsoleMetrics } from '../../infrastructure/metrics/Metrics';
import { RedisCache } from '../../infrastructure/cache/RedisCache';

// External APIs
import { FranceTravailAPI } from '../../infrastructure/external/FranceTravailAPI';
import { AdzunaAPI } from '../../infrastructure/external/AdzunaAPI';
import { RemotiveAPI } from '../../infrastructure/external/RemotiveAPI';

// Controllers
import { JobController } from './controllers/JobController';
import { TechnologyController } from './controllers/TechnologyController';
import { RegionController } from './controllers/RegionController';
import { AnalyticsController } from './controllers/AnalyticsController';
import { IngestionController } from './controllers/IngestionController';

/**
 * Simple adapter to convert Region entity to just ID
 */
interface RegionRepositoryAdapter {
  findByCode(code: string): Promise<number | null>;
}

/**
 * Dependency Injection Container
 */
export class DIContainer {
  // Infrastructure
  private cache!: RedisCache;
  private logger!: WinstonLogger;
  private metrics!: ConsoleMetrics;

  // External APIs
  private franceTravailAPI!: FranceTravailAPI;
  private adzunaAPI!: AdzunaAPI;
  private remotiveAPI!: RemotiveAPI;

  // Repositories
  private jobRepository!: PostgresJobRepository;
  private technologyRepository!: PostgresTechnologyRepository;
  private regionRepository!: PostgresRegionRepository;
  private statsRepository!: PostgresStatsRepository;

  // Repository adapter for APIs
  private regionRepositoryAdapter!: RegionRepositoryAdapter;

  // Domain Services
  private trendAnalysisService!: TrendAnalysisService;

  // Application Services
  private jobService!: JobService;
  private jobSearchService!: JobSearchService;
  private jobIngestionService!: JobIngestionService;
  private technologyService!: TechnologyService;
  private regionService!: RegionService;
  private analyticsService!: AnalyticsService;
  private ingestionOrchestrator!: IngestionOrchestrator;

  // Controllers
  private _jobController!: JobController;
  private _technologyController!: TechnologyController;
  private _regionController!: RegionController;
  private _analyticsController!: AnalyticsController;
  private _ingestionController!: IngestionController;

  constructor() {
    // Initialize in correct order
    this.initializeInfrastructure();
    this.initializeRepositories();
    this.initializeExternalAPIs();
    this.initializeDomainServices();
    this.initializeApplicationServices();
    this.initializeControllers();
  }

  private initializeInfrastructure(): void {
    this.cache = new RedisCache();
    this.logger = new WinstonLogger('job-aggregator');
    this.metrics = new ConsoleMetrics();

    this.logger.info('Infrastructure initialized');
  }

  private initializeRepositories(): void {
    this.jobRepository = new PostgresJobRepository();
    this.technologyRepository = new PostgresTechnologyRepository();
    this.regionRepository = new PostgresRegionRepository();
    this.statsRepository = new PostgresStatsRepository();

    // Create adapter for APIs (they only need region ID, not full entity)
    this.regionRepositoryAdapter = {
      findByCode: async (code: string): Promise<number | null> => {
        const region = await this.regionRepository.findByCode(code);
        return region?.id || null;
      },
    };

    this.logger.info('Repositories initialized');
  }

  private initializeExternalAPIs(): void {
    // France Travail API
    const ftClientId = process.env.FRANCE_TRAVAIL_CLIENT_ID;
    const ftClientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;

    if (ftClientId && ftClientSecret) {
      this.franceTravailAPI = new FranceTravailAPI(
        ftClientId,
        ftClientSecret,
        this.regionRepositoryAdapter,
        {
          maxRetryAttempts: 3,
          retryDelayMs: 1000,
          requestDelayMs: 150,
          defaultMaxResults: 150,
          enableCircuitBreaker: true,
          circuitBreakerThreshold: 5,
          circuitBreakerResetTimeMs: 60000,
        }
      );
      this.logger.info('France Travail API initialized');
    } else {
      this.logger.warn('France Travail API credentials not configured - API disabled');
      // Create dummy API that will throw if used
      this.franceTravailAPI = {
        fetchJobs: async () => {
          throw new Error('France Travail API not configured. Please set credentials in .env');
        },
        getSourceName: () => 'france_travail',
      } as any;
    }

    // Adzuna API
    const adzunaAppId = process.env.ADZUNA_APP_ID;
    const adzunaAppKey = process.env.ADZUNA_APP_KEY;

    if (adzunaAppId && adzunaAppKey) {
      this.adzunaAPI = new AdzunaAPI(adzunaAppId, adzunaAppKey, this.regionRepositoryAdapter);
      this.logger.info('Adzuna API initialized');
    } else {
      this.logger.warn('Adzuna API credentials not configured - API disabled');
      this.adzunaAPI = {
        fetchJobs: async () => {
          throw new Error('Adzuna API not configured. Please set credentials in .env');
        },
        getSourceName: () => 'adzuna',
      } as any;
    }

    // Remotive API (no credentials needed)
    this.remotiveAPI = new RemotiveAPI();
    this.logger.info('Remotive API initialized');

    this.logger.info('External APIs initialized');
  }

  private initializeDomainServices(): void {
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
        maxRetries: 3,
        retryDelayMs: 1000,
      }
    );

    // Ingestion Orchestrator
    this.ingestionOrchestrator = new IngestionOrchestrator(
      this.jobRepository,
      this.technologyRepository,
      this.regionRepository,
      this.franceTravailAPI,
      this.adzunaAPI,
      this.remotiveAPI,
      this.logger,
      this.metrics
    );

    // Technology Service
    this.technologyService = new TechnologyService(
      this.technologyRepository,
      this.jobRepository,
      this.regionRepository
    );

    // Region Service
    this.regionService = new RegionService(
      this.regionRepository,
      this.jobRepository,
      this.technologyRepository
    );

    // Analytics Service
    this.analyticsService = new AnalyticsService(
      this.jobRepository,
      this.technologyRepository,
      this.regionRepository,
      this.trendAnalysisService
    );

    this.logger.info('Application services initialized');
  }

  private initializeControllers(): void {
    this._jobController = new JobController(this.jobService, this.jobSearchService);
    this._technologyController = new TechnologyController(this.technologyService);
    this._regionController = new RegionController(this.regionService);
    this._analyticsController = new AnalyticsController(this.analyticsService);

    // Pass orchestrator to ingestion controller
    this._ingestionController = new IngestionController(
      this.jobIngestionService,
      this.logger,
      this.ingestionOrchestrator
    );

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

  // Getter for orchestrator (used by scripts)
  get orchestrator(): IngestionOrchestrator {
    return this.ingestionOrchestrator;
  }

  // Getters for APIs (useful for testing/debugging)
  get apis() {
    return {
      franceTravail: this.franceTravailAPI,
      adzuna: this.adzunaAPI,
      remotive: this.remotiveAPI,
    };
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

    // Check API configurations
    services.franceTravailConfigured = !!process.env.FRANCE_TRAVAIL_CLIENT_ID;
    services.adzunaConfigured = !!process.env.ADZUNA_APP_ID;
    services.remotiveConfigured = true; // Always available

    const allHealthy = services.database && services.redis;

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

    // Note: Upstash Redis doesn't require explicit disconnect
    // It's HTTP-based, not a persistent connection
    this.logger.info('Redis cache cleanup complete');

    this.logger.info('Application shutdown complete');
  }
}

// Export singleton instance
export const container = new DIContainer();
