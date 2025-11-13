import { IJobRepository } from '../../domain/repositories/IJobRepository';
import { ITechnologyRepository } from '../../domain/repositories/ITechnologyRepository';
import { IRegionRepository } from '../../domain/repositories/IRegionRepository';
import { JobIngestionService, ILogger, IMetrics, RawJobData } from './JobIngestionService';
import { FranceTravailAPI } from '../../infrastructure/external/FranceTravailAPI';
import { AdzunaAPI } from '../../infrastructure/external/AdzunaAPI';
import { RemotiveAPI } from '../../infrastructure/external/RemotiveAPI';
import { FranceTravailMapper } from '../../infrastructure/external/mappers/FranceTravailMapper';
import { AdzunaMapper } from '../../infrastructure/external/mappers/AdzunaMapper';
import { RemotiveMapper } from '../../infrastructure/external/mappers/RemotiveMapper';
import { IngestResultMapper } from '../mappers/IngestResultMapper';
import {
  IngestStatsDTO,
  BatchIngestResultDTO,
  DeduplicationStatsDTO,
} from '../dtos/IngestResultDTO';

/**
 * Configuration for ingestion orchestration
 */
export interface IngestionConfig {
  // France Travail settings
  franceTravail?: {
    enabled: boolean;
    maxResults?: number;
    searchParams?: {
      motsCles?: string;
      commune?: string;
      departement?: string;
      codeROME?: string;
      typeContrat?: string;
      nature?: string;
      experience?: string;
      tempsPlein?: boolean;
    };
  };

  // Adzuna settings
  adzuna?: {
    enabled: boolean;
    maxResults?: number;
    keywords?: string;
    maxPages?: number;
  };

  // Remotive settings
  remotive?: {
    enabled: boolean;
    limit?: number;
    category?: string;
    search?: string;
  };

  // Processing settings
  batchSize?: number;
  enableDeduplication?: boolean;
  deduplicateAcrossSources?: boolean;
}

/**
 * Result from orchestrated ingestion across all sources
 */
export interface OrchestrationResult {
  sources: {
    [sourceName: string]: IngestStatsDTO;
  };
  deduplication?: DeduplicationStatsDTO;
  summary: {
    totalFetched: number;
    totalIngested: number;
    totalFailed: number;
    totalDuplicated: number;
    duration: number;
    sourcesProcessed: string[];
    sourcesSkipped: string[];
  };
}

/**
 * Ingestion Orchestrator
 *
 * Coordinates the entire job ingestion pipeline:
 * 1. Fetch jobs from multiple external APIs
 * 2. Map to domain entities via mappers
 * 3. Deduplicate across sources (optional)
 * 4. Ingest into database via JobIngestionService
 * 5. Report comprehensive statistics
 */
export class IngestionOrchestrator {
  private ingestionService: JobIngestionService;

  constructor(
    private jobRepository: IJobRepository,
    technologyRepository: ITechnologyRepository,
    regionRepository: IRegionRepository,
    private franceTravailAPI: FranceTravailAPI,
    private adzunaAPI: AdzunaAPI,
    private remotiveAPI: RemotiveAPI,
    private logger: ILogger,
    private metrics: IMetrics
  ) {
    // Initialize services
    this.ingestionService = new JobIngestionService(
      jobRepository,
      technologyRepository,
      regionRepository,
      {
        cacheTechnologies: true,
        logger,
        metrics,
        maxRetries: 3,
        retryDelayMs: 1000,
      }
    );
  }

  /**
   * Run full ingestion pipeline from all configured sources
   */
  async ingestFromAllSources(config: IngestionConfig): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const result: OrchestrationResult = {
      sources: {},
      summary: {
        totalFetched: 0,
        totalIngested: 0,
        totalFailed: 0,
        totalDuplicated: 0,
        duration: 0,
        sourcesProcessed: [],
        sourcesSkipped: [],
      },
    };

    this.logger.info('🚀 Starting orchestrated ingestion', { config });

    try {
      // Pre-load valid technologies once for all sources
      await this.ingestionService['loadValidTechnologies']();

      // Fetch from all enabled sources
      const allRawJobs: RawJobData[] = [];

      // 1. France Travail
      if (config.franceTravail?.enabled) {
        try {
          this.logger.info('📡 Fetching from France Travail API');
          const ftJobs = await this.fetchFromFranceTravail(config.franceTravail);
          allRawJobs.push(...ftJobs);
          result.summary.sourcesProcessed.push('france_travail');
          this.logger.info('✅ France Travail fetch complete', { count: ftJobs.length });
          this.metrics.increment('ingestion.source.success', { source: 'france_travail' });
        } catch (error) {
          this.logger.error('❌ France Travail fetch failed', { error });
          this.metrics.increment('ingestion.source.error', { source: 'france_travail' });
          result.summary.sourcesSkipped.push('france_travail');
        }
      }

      // 2. Adzuna
      if (config.adzuna?.enabled) {
        try {
          this.logger.info('📡 Fetching from Adzuna API');
          const adzunaJobs = await this.fetchFromAdzuna(config.adzuna);
          allRawJobs.push(...adzunaJobs);
          result.summary.sourcesProcessed.push('adzuna');
          this.logger.info('✅ Adzuna fetch complete', { count: adzunaJobs.length });
          this.metrics.increment('ingestion.source.success', { source: 'adzuna' });
        } catch (error) {
          this.logger.error('❌ Adzuna fetch failed', { error });
          this.metrics.increment('ingestion.source.error', { source: 'adzuna' });
          result.summary.sourcesSkipped.push('adzuna');
        }
      }

      // 3. Remotive
      if (config.remotive?.enabled) {
        try {
          this.logger.info('📡 Fetching from Remotive API');
          const remotiveJobs = await this.fetchFromRemotive(config.remotive);
          allRawJobs.push(...remotiveJobs);
          result.summary.sourcesProcessed.push('remotive');
          this.logger.info('✅ Remotive fetch complete', { count: remotiveJobs.length });
          this.metrics.increment('ingestion.source.success', { source: 'remotive' });
        } catch (error) {
          this.logger.error('❌ Remotive fetch failed', { error });
          this.metrics.increment('ingestion.source.error', { source: 'remotive' });
          result.summary.sourcesSkipped.push('remotive');
        }
      }

      result.summary.totalFetched = allRawJobs.length;

      if (allRawJobs.length === 0) {
        this.logger.warn('⚠️  No jobs fetched from any source');
        result.summary.duration = Date.now() - startTime;
        return result;
      }

      this.logger.info('📊 All sources fetched', {
        totalJobs: allRawJobs.length,
        sources: result.summary.sourcesProcessed,
      });

      // Batch ingestion with optional deduplication
      this.logger.info('💾 Starting batch ingestion', {
        totalJobs: allRawJobs.length,
        batchSize: config.batchSize,
        deduplicationEnabled: config.enableDeduplication,
      });

      const batchResult = await this.ingestionService.ingestJobsInBatches(
        allRawJobs,
        config.batchSize
      );

      result.summary.totalIngested = batchResult.summary.totalInserted;
      result.summary.totalFailed = batchResult.summary.totalFailed;

      // Per-source statistics (approximate based on source distribution)
      const sourceStats = this.calculateSourceStats(allRawJobs, batchResult);
      result.sources = sourceStats;

      // Deduplication (if enabled and jobs were ingested)
      if (config.enableDeduplication && result.summary.totalIngested > 0) {
        this.logger.info('🔄 Running post-ingestion deduplication analysis');
        result.deduplication = await this.analyzeDeduplication();
        result.summary.totalDuplicated = result.deduplication?.duplicatesRemoved || 0;
      }

      result.summary.duration = Date.now() - startTime;

      this.logger.info('✅ Orchestrated ingestion complete', {
        duration: `${result.summary.duration}ms`,
        fetched: result.summary.totalFetched,
        ingested: result.summary.totalIngested,
        failed: result.summary.totalFailed,
        duplicated: result.summary.totalDuplicated,
        sources: result.summary.sourcesProcessed,
      });

      // Metrics
      this.metrics.timing('ingestion.orchestration.duration', result.summary.duration);
      this.metrics.gauge('ingestion.orchestration.fetched', result.summary.totalFetched);
      this.metrics.gauge('ingestion.orchestration.ingested', result.summary.totalIngested);
      this.metrics.gauge('ingestion.orchestration.failed', result.summary.totalFailed);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('💥 Orchestrated ingestion failed', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      this.metrics.increment('ingestion.orchestration.error');

      result.summary.duration = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Fetch jobs from France Travail API
   */
  private async fetchFromFranceTravail(
    config: NonNullable<IngestionConfig['franceTravail']>
  ): Promise<RawJobData[]> {
    const ftDTOs = await this.franceTravailAPI.fetchJobs({
      motsCles: config.searchParams?.motsCles || 'développeur',
      maxResults: config.maxResults || 150,
      ...config.searchParams,
    });

    return ftDTOs.map(dto => FranceTravailMapper.toRawJobData(dto));
  }

  /**
   * Fetch jobs from Adzuna API
   */
  private async fetchFromAdzuna(
    config: NonNullable<IngestionConfig['adzuna']>
  ): Promise<RawJobData[]> {
    const adzunaDTOs = await this.adzunaAPI.fetchJobs({
      keywords: config.keywords || 'développeur',
      maxPages: config.maxPages || 3,
      resultsPerPage: 50,
    });

    return adzunaDTOs.map(dto => AdzunaMapper.toRawJobData(dto));
  }

  /**
   * Fetch jobs from Remotive API
   */
  private async fetchFromRemotive(
    config: NonNullable<IngestionConfig['remotive']>
  ): Promise<RawJobData[]> {
    const remotiveDTOs = await this.remotiveAPI.fetchJobs({
      limit: config.limit || 50,
      category: config.category || 'software-dev',
      search: config.search,
    });

    return remotiveDTOs.map(dto => RemotiveMapper.toRawJobData(dto));
  }

  /**
   * Calculate per-source statistics from batch result
   */
  private calculateSourceStats(
    rawJobs: RawJobData[],
    batchResult: BatchIngestResultDTO
  ): Record<string, IngestStatsDTO> {
    const sourceGroups = new Map<string, RawJobData[]>();

    // Group jobs by source
    rawJobs.forEach(job => {
      const source = job.sourceApi;
      if (!sourceGroups.has(source)) {
        sourceGroups.set(source, []);
      }
      sourceGroups.get(source)!.push(job);
    });

    const sourceStats: Record<string, IngestStatsDTO> = {};

    // Create approximate stats for each source
    // Note: This is an approximation since batch processing doesn't track per-source
    sourceGroups.forEach((jobs, source) => {
      const sourcePercentage = jobs.length / rawJobs.length;

      sourceStats[source] = {
        result: {
          total: jobs.length,
          inserted: Math.round(batchResult.summary.totalInserted * sourcePercentage),
          updated: Math.round(batchResult.summary.totalUpdated * sourcePercentage),
          failed: Math.round(batchResult.summary.totalFailed * sourcePercentage),
          errors: [],
          duration: batchResult.summary.totalDuration,
          sourceApi: source,
          timestamp: new Date().toISOString(),
        },
        qualityStats: {
          averageQualityScore: 0,
          highQualityJobs: 0,
          mediumQualityJobs: 0,
          lowQualityJobs: 0,
        },
        dataCompleteness: {
          withSalary: 0,
          withRegion: 0,
          withExperience: 0,
          withDescription: 0,
        },
        technologyStats: {
          totalTechnologies: 0,
          newTechnologies: 0,
          topTechnologies: [],
        },
      };
    });

    return sourceStats;
  }

  /**
   * Analyze deduplication across all jobs in database
   */
  private async analyzeDeduplication(): Promise<DeduplicationStatsDTO> {
    try {
      // Fetch all recent jobs (last 7 days)
      const recentJobs = await this.jobRepository.findAll({ recentDays: 7 }, 1, 10000);

      if (recentJobs.length === 0) {
        return {
          originalCount: 0,
          deduplicatedCount: 0,
          duplicatesRemoved: 0,
          duplicateRate: 0,
          multiSourceJobs: 0,
          multiSourceRate: 0,
          averageQualityScore: 0,
          sourceBreakdown: {},
        };
      }

      // Use the mapper to create deduplication stats DTO
      return IngestResultMapper.toDeduplicationStatsDTO(recentJobs, recentJobs);
    } catch (error) {
      this.logger.error('Deduplication analysis failed', { error });
      return {
        originalCount: 0,
        deduplicatedCount: 0,
        duplicatesRemoved: 0,
        duplicateRate: 0,
        multiSourceJobs: 0,
        multiSourceRate: 0,
        averageQualityScore: 0,
        sourceBreakdown: {},
      };
    }
  }

  /**
   * Ingest from a single source (convenience method)
   */
  async ingestFromSource(
    source: 'france_travail' | 'adzuna' | 'remotive',
    sourceConfig?: any
  ): Promise<IngestStatsDTO> {
    const config: IngestionConfig = {
      enableDeduplication: false,
      deduplicateAcrossSources: false,
    };

    if (source === 'france_travail') {
      config.franceTravail = { enabled: true, ...sourceConfig };
    } else if (source === 'adzuna') {
      config.adzuna = { enabled: true, ...sourceConfig };
    } else if (source === 'remotive') {
      config.remotive = { enabled: true, ...sourceConfig };
    }

    const result = await this.ingestFromAllSources(config);
    return result.sources[source] || this.createEmptyStats(source);
  }

  /**
   * Create empty stats for a source
   */
  private createEmptyStats(source: string): IngestStatsDTO {
    return {
      result: {
        total: 0,
        inserted: 0,
        updated: 0,
        failed: 0,
        errors: [],
        sourceApi: source,
        timestamp: new Date().toISOString(),
      },
      qualityStats: {
        averageQualityScore: 0,
        highQualityJobs: 0,
        mediumQualityJobs: 0,
        lowQualityJobs: 0,
      },
      dataCompleteness: {
        withSalary: 0,
        withRegion: 0,
        withExperience: 0,
        withDescription: 0,
      },
      technologyStats: {
        totalTechnologies: 0,
        newTechnologies: 0,
        topTechnologies: [],
      },
    };
  }
}
