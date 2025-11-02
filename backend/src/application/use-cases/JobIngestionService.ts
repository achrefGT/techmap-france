import { JOB_CONFIG } from '../../domain/constants/JobConfig';
import { Job } from '../../domain/entities/Job';
import { Region } from '../../domain/entities/Region';
import { Technology } from '../../domain/entities/Technology';
import { IJobRepository } from '../../domain/repositories/IJobRepository';
import { IRegionRepository } from '../../domain/repositories/IRegionRepository';
import { ITechnologyRepository } from '../../domain/repositories/ITechnologyRepository';
import { experienceDetector } from '../../infrastructure/external/ExperienceDetector';
import { techDetector } from '../../infrastructure/external/TechnologyDetector';
import { TechnologyCategorizer } from '../../application/helpers/TechnologyCategorizer';

export interface IngestResult {
  total: number;
  inserted: number;
  updated: number;
  failed: number;
  errors: string[];
}

/**
 * Raw job data from external APIs (before domain entity creation)
 */
export interface RawJobData {
  id: string;
  title: string;
  company: string;
  description: string;
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

export class JobIngestionService {
  constructor(
    private jobRepository: IJobRepository,
    private technologyRepository: ITechnologyRepository,
    private regionRepository: IRegionRepository
  ) {}

  /**
   * Main ingestion pipeline
   * 1. Transform raw data to domain entities (with detection)
   * 2. Filter by quality
   * 3. Deduplicate
   * 4. Enrich with regions
   * 5. Ensure technologies exist
   * 6. Save to repository
   */
  async ingestJobs(rawJobs: RawJobData[]): Promise<IngestResult> {
    const result: IngestResult = {
      total: rawJobs.length,
      inserted: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    // Step 1: Transform raw data to domain entities (infrastructure detects here)
    const jobs = await this.transformToDomainEntities(rawJobs, result);

    // Step 2: Filter quality jobs
    const qualityJobs = jobs.filter(
      job => job.calculateQualityScore() >= JOB_CONFIG.MIN_QUALITY_SCORE
    );

    // Step 3: Deduplicate using proper keys
    const uniqueJobs = this.deduplicateJobs(qualityJobs);

    // Step 4: Enrich with regions (parallelized)
    const enrichedJobs = await this.enrichWithRegions(uniqueJobs);

    // Step 5: Ensure technologies exist (parallelized)
    await this.ensureTechnologiesExist(enrichedJobs);

    // Step 6: Save jobs (consider batching for production)
    for (const job of enrichedJobs) {
      try {
        const existing = await this.jobRepository.findById(job.id);

        if (existing) {
          await this.jobRepository.save(job);
          result.updated++;
        } else {
          await this.jobRepository.save(job);
          result.inserted++;
        }
      } catch (error) {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        result.errors.push(`Failed to save job ${job.id}: ${errorMessage}`);
      }
    }

    return result;
  }

  /**
   * Transform raw API data to domain entities
   * Uses infrastructure layer to detect technologies and experience
   */
  private async transformToDomainEntities(
    rawJobs: RawJobData[],
    result: IngestResult
  ): Promise<Job[]> {
    const jobs: Job[] = [];

    for (const raw of rawJobs) {
      try {
        // Infrastructure layer: Detect technologies from description
        const technologies = techDetector.detect(raw.description);

        // Skip if no technologies detected
        if (technologies.length === 0) {
          result.failed++;
          result.errors.push(`No technologies detected for job ${raw.id}`);
          continue;
        }

        // Infrastructure layer: Detect experience level
        const experienceCategory = experienceDetector.detect(
          raw.title,
          raw.experienceLevel,
          raw.description
        );

        // Ensure postedDate is a Date object
        const postedDate =
          raw.postedDate instanceof Date ? raw.postedDate : new Date(raw.postedDate);

        // Create domain entity with detected data
        const job = new Job(
          raw.id,
          raw.title,
          raw.company,
          raw.description,
          technologies,
          raw.location,
          null, // regionId - will be enriched later
          raw.isRemote,
          raw.salaryMin,
          raw.salaryMax,
          raw.experienceLevel,
          experienceCategory, // ← Detected by infrastructure
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
      }
    }

    return jobs;
  }

  /**
   * Deduplicate jobs using sourceApi + externalId
   * Keeps the newest version if duplicates found
   */
  private deduplicateJobs(jobs: Job[]): Job[] {
    const seen = new Map<string, Job>();

    for (const job of jobs) {
      const key = job.getDeduplicationKey();

      // Keep newest version if duplicate
      if (!seen.has(key) || seen.get(key)!.postedDate < job.postedDate) {
        seen.set(key, job);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Enrich jobs with region information (parallelized)
   */
  private async enrichWithRegions(jobs: Job[]): Promise<Job[]> {
    const jobsNeedingRegion = jobs.filter(job => !job.regionId);

    // Parallelize region detection
    await Promise.all(
      jobsNeedingRegion.map(async job => {
        const region = await this.detectRegion(job.location);
        if (region) {
          job.regionId = region.id;
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
   * Ensure all detected technologies exist in database (parallelized)
   * Creates missing technologies with automatic categorization
   */
  private async ensureTechnologiesExist(jobs: Job[]): Promise<void> {
    const allTechs = new Set<string>();
    jobs.forEach(job => job.technologies.forEach(tech => allTechs.add(tech)));

    // Check all technologies in parallel
    await Promise.all(
      Array.from(allTechs).map(async techName => {
        const existing = await this.technologyRepository.findByName(techName);
        if (!existing) {
          const category = TechnologyCategorizer.categorize(techName);
          const newTech = Technology.create(techName, category);
          await this.technologyRepository.save(newTech);
        }
      })
    );
  }

  /**
   * Advanced: Fuzzy deduplication across different APIs
   * Merges jobs from different sources that are likely the same position
   */
  async deduplicateAcrossSources(jobs: Job[]): Promise<Job[]> {
    const fuzzyMap = new Map<string, Job>();

    for (const job of jobs) {
      const fuzzyKey = job.getFuzzyDeduplicationKey();

      const existing = fuzzyMap.get(fuzzyKey);
      if (existing) {
        // Merge data from both jobs
        existing.mergeFrom(job);
      } else {
        fuzzyMap.set(fuzzyKey, job);
      }
    }

    return Array.from(fuzzyMap.values());
  }

  /**
   * Batch processing for large datasets
   */
  async ingestJobsInBatches(
    rawJobs: RawJobData[],
    batchSize: number = JOB_CONFIG.BATCH.IMPORT_BATCH_SIZE
  ): Promise<IngestResult> {
    const totalResult: IngestResult = {
      total: rawJobs.length,
      inserted: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < rawJobs.length; i += batchSize) {
      const batch = rawJobs.slice(i, i + batchSize);
      const batchResult = await this.ingestJobs(batch);

      totalResult.inserted += batchResult.inserted;
      totalResult.updated += batchResult.updated;
      totalResult.failed += batchResult.failed;
      totalResult.errors.push(...batchResult.errors);
    }

    return totalResult;
  }
}
