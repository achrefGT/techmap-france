/**
 * Data Transfer Object for job ingestion results
 * Used when importing jobs from external APIs
 */

export interface IngestResultDTO {
  total: number;
  inserted: number;
  updated: number;
  failed: number;
  errors: string[];
  duration?: number; // milliseconds
  sourceApi?: string;
  timestamp: string; // ISO 8601 string
}

/**
 * Detailed ingestion statistics
 */
export interface IngestStatsDTO {
  result: IngestResultDTO;
  qualityStats: {
    averageQualityScore: number;
    highQualityJobs: number; // score >= 70
    mediumQualityJobs: number; // score 40-69
    lowQualityJobs: number; // score < 40
  };
  dataCompleteness: {
    withSalary: number;
    withRegion: number;
    withExperience: number;
    withDescription: number;
  };
  technologyStats: {
    totalTechnologies: number;
    newTechnologies: number;
    topTechnologies: {
      name: string;
      count: number;
    }[];
  };
}

/**
 * Batch ingestion result
 */
export interface BatchIngestResultDTO {
  batches: IngestResultDTO[];
  summary: {
    totalProcessed: number;
    totalInserted: number;
    totalUpdated: number;
    totalFailed: number;
    totalDuration: number;
    averageBatchDuration: number;
  };
  errors: string[];
}

/**
 * Deduplication statistics
 */
export interface DeduplicationStatsDTO {
  originalCount: number;
  deduplicatedCount: number;
  duplicatesRemoved: number;
  duplicateRate: number; // percentage
  multiSourceJobs: number;
  multiSourceRate: number; // percentage
  averageQualityScore: number;
  sourceBreakdown: Record<string, number>; // sourceApi -> count
}
