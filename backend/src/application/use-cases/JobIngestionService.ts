import { JOB_CONFIG } from '../../domain/constants/JobConfig';
import { Job } from '../../domain/entities/Job';
import { Region } from '../../domain/entities/Region';
import { IJobRepository } from '../../domain/repositories/IJobRepository';
import { IRegionRepository } from '../../domain/repositories/IRegionRepository';
import { ITechnologyRepository } from '../../domain/repositories/ITechnologyRepository';
import { experienceDetector } from '../../infrastructure/external/ExperienceDetector';
import { techDetector } from '../../infrastructure/external/TechnologyDetector';
import { IngestResultMapper } from '../mappers/IngestResultMapper';
import { IngestStatsDTO, BatchIngestResultDTO, IngestResultDTO } from '../dtos/IngestResultDTO';

/**
 * Internal result type (used within the service before mapping to DTO)
 */
export interface IngestResult {
  total: number;
  inserted: number;
  updated: number;
  failed: number;
  errors: string[];
  startTime?: Date;
  endTime?: Date;
  sourceApi?: string;
}

/**
 * Raw job data from external APIs (before domain entity creation)
 */
export interface RawJobData {
  id: string;
  title: string;
  company: string;
  description: string;
  technologies?: string[];
  location: string;
  isRemote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  experienceLevel: string | null;
  sourceApi: string;
  externalId: string;
  sourceUrl: string;
  postedDate: Date | string;
}

/**
 * Logger interface for dependency injection
 */
export interface ILogger {
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, context?: Record<string, any>): void;
}

/**
 * Metrics interface for dependency injection
 */
export interface IMetrics {
  increment(metric: string, tags?: Record<string, string | number>): void;
  timing(metric: string, duration: number, tags?: Record<string, string | number>): void;
  gauge(metric: string, value: number, tags?: Record<string, string | number>): void;
}

/**
 * Service options
 */
export interface JobIngestionServiceOptions {
  cacheTechnologies?: boolean;
  logger?: ILogger;
  metrics?: IMetrics;
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Job Ingestion Service
 *
 * Orchestrates the import pipeline:
 * 1. Transform raw API data to domain entities
 * 2. Detect technologies and experience levels (via infrastructure)
 * 3. Validate detected technologies against known technologies database
 * 4. Filter by quality standards
 * 5. Enrich with regions
 * 6. Save to repository (DB handles same-source duplicates via unique constraint)
 *
 * NOTE: Technologies MUST exist in the database before ingestion.
 * Jobs with unknown technologies will have those technologies filtered out.
 * Jobs with no valid technologies after filtering are rejected.
 */
export class JobIngestionService {
  private validTechnologyNames: Set<string> | null = null;
  private technologyLoadPromise: Promise<void> | null = null; // Prevents concurrent loads
  private cacheTechnologies: boolean;
  private logger: ILogger;
  private metrics: IMetrics;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(
    private jobRepository: IJobRepository,
    private technologyRepository: ITechnologyRepository,
    private regionRepository: IRegionRepository,
    options?: JobIngestionServiceOptions
  ) {
    this.cacheTechnologies = options?.cacheTechnologies ?? true;
    this.logger = options?.logger || this.createNoOpLogger();
    this.metrics = options?.metrics || this.createNoOpMetrics();
    this.maxRetries = options?.maxRetries ?? 3;
    this.retryDelayMs = options?.retryDelayMs ?? 1000;
  }

  /**
   * Main ingestion pipeline with detailed statistics
   * Returns IngestStatsDTO with comprehensive metrics
   */
  async ingestJobsWithStats(rawJobs: RawJobData[]): Promise<IngestStatsDTO> {
    const startTime = new Date();
    const sourceApi = rawJobs[0]?.sourceApi || 'unknown';

    this.logger.info('Ingestion started', {
      count: rawJobs.length,
      sourceApi,
    });

    const result: IngestResult = {
      total: rawJobs.length,
      inserted: 0,
      updated: 0,
      failed: 0,
      errors: [],
      startTime,
      sourceApi,
    };

    try {
      // Load valid technologies once at the start (thread-safe)
      await this.loadValidTechnologies();

      // Track discovered unknown technologies for reporting
      const unknownTechnologies: string[] = [];
      const unknownTechSet = new Set<string>();

      // Step 1: Transform raw data to domain entities (validates technologies)
      const jobs = await this.transformToDomainEntities(rawJobs, result, unknownTechSet);

      // Track unknown technologies for stats
      unknownTechnologies.push(...Array.from(unknownTechSet));

      // Step 2: Filter quality jobs
      const qualityJobs = jobs.filter(
        job => job.calculateQualityScore() >= JOB_CONFIG.MIN_QUALITY_SCORE
      );

      this.logger.info('Quality filtering complete', {
        total: jobs.length,
        qualityJobs: qualityJobs.length,
        filtered: jobs.length - qualityJobs.length,
      });

      // Step 3: Enrich with regions
      const enrichedJobs = await this.enrichWithRegions(qualityJobs);

      // Step 4: Save jobs with bulk operation if available
      await this.saveJobs(enrichedJobs, result);

      result.endTime = new Date();
      const duration = result.endTime.getTime() - startTime.getTime();

      // Log metrics
      this.metrics.increment('jobs.ingested.total', { sourceApi });
      this.metrics.increment('jobs.ingested.inserted', { sourceApi, count: result.inserted });
      this.metrics.increment('jobs.ingested.updated', { sourceApi, count: result.updated });
      this.metrics.increment('jobs.ingested.failed', { sourceApi, count: result.failed });
      this.metrics.timing('jobs.ingestion.duration', duration, { sourceApi });
      this.metrics.gauge('jobs.ingestion.unknown_technologies', unknownTechnologies.length, {
        sourceApi,
      });

      this.logger.info('Ingestion completed', {
        sourceApi,
        total: result.total,
        inserted: result.inserted,
        updated: result.updated,
        failed: result.failed,
        duration: `${duration}ms`,
        unknownTechnologies: unknownTechnologies.length,
      });

      // Return detailed statistics using mapper
      return IngestResultMapper.toStatsDTO(result, enrichedJobs, unknownTechnologies);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error('Ingestion failed', {
        sourceApi,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      this.metrics.increment('jobs.ingestion.error', { sourceApi });

      throw error;
    }
  }

  /**
   * Simple ingestion (backward compatibility)
   * Returns basic IngestResultDTO
   */
  async ingestJobs(rawJobs: RawJobData[]): Promise<IngestResultDTO> {
    const stats = await this.ingestJobsWithStats(rawJobs);
    return stats.result;
  }

  /**
   * Batch processing for large datasets
   * Returns BatchIngestResultDTO with comprehensive statistics
   */
  async ingestJobsInBatches(
    rawJobs: RawJobData[],
    batchSize: number = JOB_CONFIG.BATCH.IMPORT_BATCH_SIZE
  ): Promise<BatchIngestResultDTO> {
    const batchResults: IngestResult[] = [];
    const totalBatches = Math.ceil(rawJobs.length / batchSize);

    this.logger.info('Batch ingestion started', {
      totalJobs: rawJobs.length,
      batchSize,
      totalBatches,
    });

    // Load valid technologies once before processing batches (thread-safe)
    await this.loadValidTechnologies();

    for (let i = 0; i < rawJobs.length; i += batchSize) {
      const batchNumber = Math.floor(i / batchSize) + 1;
      const startTime = new Date();
      const batch = rawJobs.slice(i, i + batchSize);

      this.logger.info('Processing batch', {
        batchNumber,
        totalBatches,
        batchSize: batch.length,
      });

      const result: IngestResult = {
        total: batch.length,
        inserted: 0,
        updated: 0,
        failed: 0,
        errors: [],
        startTime,
        sourceApi: batch[0]?.sourceApi,
      };

      const unknownTechSet = new Set<string>();

      try {
        // Process batch
        const jobs = await this.transformToDomainEntities(batch, result, unknownTechSet);
        const qualityJobs = jobs.filter(
          job => job.calculateQualityScore() >= JOB_CONFIG.MIN_QUALITY_SCORE
        );
        const enrichedJobs = await this.enrichWithRegions(qualityJobs);

        // Save jobs
        await this.saveJobs(enrichedJobs, result);

        result.endTime = new Date();
        batchResults.push(result);

        const duration = result.endTime.getTime() - startTime.getTime();
        this.logger.info('Batch completed', {
          batchNumber,
          inserted: result.inserted,
          updated: result.updated,
          failed: result.failed,
          duration: `${duration}ms`,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        this.logger.error('Batch processing failed', {
          batchNumber,
          error: errorMessage,
        });

        result.errors.push(`Batch ${batchNumber} failed: ${errorMessage}`);
        result.failed = batch.length;
        result.endTime = new Date();
        batchResults.push(result);
      }
    }

    // Use mapper to create comprehensive batch DTO
    return IngestResultMapper.toBatchDTO(batchResults);
  }

  /**
   * Load and cache valid technology names from database (thread-safe)
   * Uses a promise to prevent concurrent loads
   */
  private async loadValidTechnologies(): Promise<void> {
    // Skip if caching is enabled and already loaded
    if (this.cacheTechnologies && this.validTechnologyNames !== null) {
      return;
    }

    // If a load is already in progress, wait for it
    if (this.technologyLoadPromise !== null) {
      await this.technologyLoadPromise;
      return;
    }

    // Start the load and store the promise
    this.technologyLoadPromise = (async () => {
      try {
        this.logger.info('Loading valid technologies from database');
        const technologies = await this.technologyRepository.findAll();

        // Atomic replacement: create new Set and assign
        const newCache = new Set(technologies.map(t => t.name));
        this.validTechnologyNames = newCache;

        this.logger.info('Valid technologies loaded', {
          count: newCache.size,
        });

        this.metrics.gauge('jobs.valid_technologies.count', newCache.size);
      } finally {
        // Clear the promise so future calls can load again if needed
        this.technologyLoadPromise = null;
      }
    })();

    await this.technologyLoadPromise;
  }

  /**
   * Reload valid technologies from database
   * Call this after adding new technologies to the database
   */
  async reloadTechnologies(): Promise<void> {
    this.logger.info('Reloading technologies');

    // Clear existing cache and load promise
    this.validTechnologyNames = null;
    this.technologyLoadPromise = null;

    await this.loadValidTechnologies();
  }

  /**
   * Clear the technology cache
   * Next ingestion will reload technologies from database
   */
  clearTechnologyCache(): void {
    this.logger.info('Clearing technology cache');
    this.validTechnologyNames = null;
    this.technologyLoadPromise = null;
  }

  /**
   * Filter technologies that exist in the database
   * Tech detector should return exact names matching database
   * Unknown technologies are tracked for reporting only
   */
  private filterValidTechnologies(
    detectedTechnologies: string[],
    unknownTechSet: Set<string>
  ): string[] {
    if (!this.validTechnologyNames) {
      throw new Error('Valid technologies not loaded. Call loadValidTechnologies first.');
    }

    const validTechs: string[] = [];

    for (const tech of detectedTechnologies) {
      if (this.validTechnologyNames.has(tech)) {
        validTechs.push(tech);
      } else {
        unknownTechSet.add(tech);
      }
    }

    return validTechs;
  }

  /**
   * Save jobs to repository with error handling
   * Uses bulk operation
   */
  private async saveJobs(jobs: Job[], result: IngestResult): Promise<void> {
    if (jobs.length === 0) {
      return; // Skip if no jobs to save
    }
    const bulkResult = await this.jobRepository.saveMany(jobs);
    result.inserted = bulkResult.inserted;
    result.updated = bulkResult.updated;
    result.failed += bulkResult.failed;
    result.errors.push(...bulkResult.errors);
  }

  /**
   * Transform raw API data to domain entities
   * Uses infrastructure layer to detect technologies and experience
   * Validates technologies against database and filters unknown ones
   * Includes retry logic for external detector calls
   */
  // In JobIngestionService.ts, update the transformToDomainEntities method

  private async transformToDomainEntities(
    rawJobs: RawJobData[],
    result: IngestResult,
    unknownTechSet: Set<string>
  ): Promise<Job[]> {
    const jobs: Job[] = [];

    for (const raw of rawJobs) {
      try {
        // ✅ UPDATED: Use pre-detected technologies if available (e.g., from Adzuna)
        // Otherwise detect from description (e.g., France Travail, Remotive)
        const detectedTechnologies =
          raw.technologies && raw.technologies.length > 0
            ? raw.technologies
            : await this.retryOperation(
                () => techDetector.detect(raw.description),
                `Tech detection for job ${raw.id}`
              );

        // Validate detected technologies against known technologies
        const validTechnologies = this.filterValidTechnologies(
          detectedTechnologies,
          unknownTechSet
        );

        // Skip if no valid technologies after filtering
        if (validTechnologies.length === 0) {
          result.failed++;
          if (detectedTechnologies.length > 0) {
            const errorMsg = `No valid technologies found for job ${raw.id} (detected: ${detectedTechnologies.join(', ')})`;
            result.errors.push(errorMsg);
            this.logger.warn('Job rejected: no valid technologies', {
              jobId: raw.id,
              detectedTechnologies,
            });
          } else {
            result.errors.push(`No technologies detected for job ${raw.id}`);
            this.logger.warn('Job rejected: no technologies detected', {
              jobId: raw.id,
            });
          }
          continue;
        }

        // Infrastructure layer: Detect experience level (with retry)
        const experienceCategory = await this.retryOperation(
          () => experienceDetector.detect(raw.title, raw.experienceLevel, raw.description),
          `Experience detection for job ${raw.id}`
        );

        // Ensure postedDate is a Date object
        const postedDate =
          raw.postedDate instanceof Date ? raw.postedDate : new Date(raw.postedDate);

        // Create domain entity with validated technologies
        const job = new Job(
          raw.id,
          raw.title,
          raw.company,
          raw.description,
          validTechnologies, // Only valid technologies
          raw.location,
          null, // regionId - will be enriched later
          raw.isRemote,
          raw.salaryMin,
          raw.salaryMax,
          raw.experienceLevel,
          experienceCategory, // Detected by infrastructure
          raw.sourceApi,
          raw.externalId,
          raw.sourceUrl,
          postedDate
        );

        jobs.push(job);
      } catch (error) {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        result.errors.push(`Failed to transform job ${raw.id}: ${errorMessage}`);

        this.logger.error('Job transformation failed', {
          jobId: raw.id,
          error: errorMessage,
        });
      }
    }

    return jobs;
  }

  /**
   * Enrich jobs with region information (parallelized)
   */
  private async enrichWithRegions(jobs: Job[]): Promise<Job[]> {
    const jobsNeedingRegion = jobs.filter(job => !job.regionId);

    // Parallelize region detection
    await Promise.all(
      jobsNeedingRegion.map(async job => {
        try {
          const region = await this.detectRegion(job.location);
          if (region) {
            job.regionId = region.id;
          }
        } catch (error) {
          this.logger.warn('Region detection failed', {
            jobId: job.id,
            location: job.location,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      })
    );

    return jobs;
  }

  /**
   * Business logic: City to region mapping
   * Maps common French cities to their regions
   */
  private async detectRegion(location: string): Promise<Region | null> {
    const normalized = location
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    // City to region code mapping
    const cityMappings: Record<string, string> = {
      paris: 'IDF',
      lyon: 'ARA',
      marseille: 'PAC',
      toulouse: 'OCC',
      nantes: 'PDL',
      lille: 'HDF',
      bordeaux: 'NAQ',
      rennes: 'BRE',
      strasbourg: 'GES',
      montpellier: 'OCC',
      nice: 'PAC',
      grenoble: 'ARA',
    };

    for (const [city, code] of Object.entries(cityMappings)) {
      if (normalized.includes(city)) {
        return await this.regionRepository.findByCode(code);
      }
    }

    return null;
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => T | Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          this.logger.warn('Operation failed, retrying', {
            operation: operationName,
            attempt,
            maxRetries: this.maxRetries,
            nextRetryIn: `${delay}ms`,
            error: lastError.message,
          });

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error('Operation failed after all retries', {
      operation: operationName,
      attempts: this.maxRetries,
      error: lastError?.message,
    });

    throw lastError || new Error(`${operationName} failed after ${this.maxRetries} attempts`);
  }

  /**
   * Create no-op logger for when none is provided
   */
  private createNoOpLogger(): ILogger {
    return {
      info: () => {},
      warn: () => {},
      error: () => {},
    };
  }

  /**
   * Create no-op metrics for when none is provided
   */
  private createNoOpMetrics(): IMetrics {
    return {
      increment: () => {},
      timing: () => {},
      gauge: () => {},
    };
  }
}
