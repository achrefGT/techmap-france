import { Job } from '../../domain/entities/Job';
import {
  IngestResultDTO,
  IngestStatsDTO,
  BatchIngestResultDTO,
  DeduplicationStatsDTO,
} from '../dtos/IngestResultDTO';

/**
 * Result type from ingestion service (before mapping to DTO)
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
 * Mapper for ingestion results <-> DTOs
 */
export class IngestResultMapper {
  /**
   * Convert IngestResult to IngestResultDTO
   */
  static toDTO(result: IngestResult): IngestResultDTO {
    const duration =
      result.startTime && result.endTime
        ? result.endTime.getTime() - result.startTime.getTime()
        : undefined;

    return {
      total: result.total,
      inserted: result.inserted,
      updated: result.updated,
      failed: result.failed,
      errors: [...result.errors],
      duration,
      sourceApi: result.sourceApi,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create IngestStatsDTO with detailed statistics
   */
  static toStatsDTO(
    result: IngestResult,
    jobs: Job[], // The successfully processed jobs
    newTechnologies: string[]
  ): IngestStatsDTO {
    // Calculate quality statistics
    const qualityScores = jobs.map(job => job.calculateQualityScore());
    const avgQuality =
      qualityScores.length > 0
        ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
        : 0;

    const highQuality = qualityScores.filter(score => score >= 70).length;
    const mediumQuality = qualityScores.filter(score => score >= 40 && score < 70).length;
    const lowQuality = qualityScores.filter(score => score < 40).length;

    // Calculate data completeness
    const withSalary = jobs.filter(
      job => job.salaryMinKEuros !== null || job.salaryMaxKEuros !== null
    ).length;
    const withRegion = jobs.filter(job => job.regionId !== null).length;
    const withExperience = jobs.filter(job => job.experienceLevel !== null).length;
    const withDescription = jobs.filter(
      job => job.description && job.description.length > 100
    ).length;

    // Calculate technology statistics
    const allTechnologies = new Set<string>();
    const technologyCounts = new Map<string, number>();

    jobs.forEach(job => {
      job.technologies.forEach(tech => {
        allTechnologies.add(tech);
        technologyCounts.set(tech, (technologyCounts.get(tech) || 0) + 1);
      });
    });

    // Get top 10 technologies
    const topTechnologies = Array.from(technologyCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    return {
      result: this.toDTO(result),
      qualityStats: {
        averageQualityScore: Math.round(avgQuality * 10) / 10,
        highQualityJobs: highQuality,
        mediumQualityJobs: mediumQuality,
        lowQualityJobs: lowQuality,
      },
      dataCompleteness: {
        withSalary,
        withRegion,
        withExperience,
        withDescription,
      },
      technologyStats: {
        totalTechnologies: allTechnologies.size,
        newTechnologies: newTechnologies.length,
        topTechnologies,
      },
    };
  }

  /**
   * Create BatchIngestResultDTO from multiple batch results
   */
  static toBatchDTO(batchResults: IngestResult[]): BatchIngestResultDTO {
    const totalProcessed = batchResults.reduce((sum, r) => sum + r.total, 0);
    const totalInserted = batchResults.reduce((sum, r) => sum + r.inserted, 0);
    const totalUpdated = batchResults.reduce((sum, r) => sum + r.updated, 0);
    const totalFailed = batchResults.reduce((sum, r) => sum + r.failed, 0);

    // Calculate total duration
    const durations = batchResults
      .map(r => {
        if (r.startTime && r.endTime) {
          return r.endTime.getTime() - r.startTime.getTime();
        }
        return 0;
      })
      .filter(d => d > 0);

    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const averageBatchDuration = durations.length > 0 ? totalDuration / durations.length : 0;

    // Collect all errors
    const allErrors = batchResults.flatMap(r => r.errors);

    return {
      batches: batchResults.map(r => this.toDTO(r)),
      summary: {
        totalProcessed,
        totalInserted,
        totalUpdated,
        totalFailed,
        totalDuration,
        averageBatchDuration,
      },
      errors: allErrors,
    };
  }

  /**
   * Create DeduplicationStatsDTO
   */
  static toDeduplicationStatsDTO(
    originalJobs: Job[],
    deduplicatedJobs: Job[]
  ): DeduplicationStatsDTO {
    const multiSourceJobs = deduplicatedJobs.filter(j => j.sourceApis.length > 1);

    // Calculate source breakdown
    const sourceBreakdown: Record<string, number> = {};
    deduplicatedJobs.forEach(job => {
      job.sourceApis.forEach(source => {
        sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
      });
    });

    // Calculate average quality score
    const averageQualityScore =
      deduplicatedJobs.length > 0
        ? deduplicatedJobs.reduce((sum, job) => sum + job.calculateQualityScore(), 0) /
          deduplicatedJobs.length
        : 0;

    const duplicatesRemoved = originalJobs.length - deduplicatedJobs.length;
    const duplicateRate =
      originalJobs.length > 0 ? (duplicatesRemoved / originalJobs.length) * 100 : 0;

    const multiSourceRate =
      deduplicatedJobs.length > 0 ? (multiSourceJobs.length / deduplicatedJobs.length) * 100 : 0;

    return {
      originalCount: originalJobs.length,
      deduplicatedCount: deduplicatedJobs.length,
      duplicatesRemoved,
      duplicateRate: Math.round(duplicateRate * 100) / 100,
      multiSourceJobs: multiSourceJobs.length,
      multiSourceRate: Math.round(multiSourceRate * 100) / 100,
      averageQualityScore: Math.round(averageQualityScore * 10) / 10,
      sourceBreakdown,
    };
  }
}
