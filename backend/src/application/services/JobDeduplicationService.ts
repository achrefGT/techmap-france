import { Job } from '../../domain/entities/Job';
import { JOB_CONFIG } from '../../domain/constants/JobConfig';

/**
 * Service for deduplicating jobs across different APIs
 *
 * Strategy:
 * 1. Exact match: Same sourceApi + externalId (within same API)
 * 2. Fuzzy match: Similar company + title (cross-API deduplication)
 * 3. Multi-signal similarity scoring with configurable weights
 */
export class JobDeduplicationService {
  private readonly config = JOB_CONFIG.DEDUPLICATION;
  private fuzzyKeyCache = new Map<string, string>();

  /**
   * Check if two jobs are duplicates across different APIs
   */
  isDuplicate(job1: Job, job2: Job): boolean {
    // Same source + externalId = exact duplicate
    if (job1.getDeduplicationKey() === job2.getDeduplicationKey()) {
      return true;
    }

    // Don't compare jobs from the same source
    if (job1.sourceApi === job2.sourceApi) {
      return false;
    }

    // Quick fuzzy key check
    if (job1.getFuzzyDeduplicationKey() !== job2.getFuzzyDeduplicationKey()) {
      return false;
    }

    // Date proximity check (jobs posted too far apart are unlikely to be duplicates)
    const daysDiff =
      Math.abs(job1.postedDate.getTime() - job2.postedDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > this.config.MAX_DATE_DIFF_DAYS) {
      return false;
    }

    // Full similarity calculation
    const similarity = this.calculateSimilarity(job1, job2);
    return similarity >= this.config.SIMILARITY_THRESHOLD;
  }

  /**
   * Calculate similarity score between two jobs (0-1)
   * Uses weighted multi-signal approach from config
   */
  calculateSimilarity(job1: Job, job2: Job): number {
    let score = 0;
    let maxScore = 0;
    const weights = this.config.WEIGHTS;

    // 1. Company match
    maxScore += weights.COMPANY;
    const companyScore = this.compareStrings(
      this.normalize(job1.company),
      this.normalize(job2.company)
    );
    score += companyScore * weights.COMPANY;

    // 2. Title match
    maxScore += weights.TITLE;
    const titleScore = this.compareStrings(this.normalize(job1.title), this.normalize(job2.title));
    score += titleScore * weights.TITLE;

    // 3. Location match
    maxScore += weights.LOCATION;
    const locationScore = this.compareStrings(
      this.normalize(job1.location),
      this.normalize(job2.location)
    );
    score += locationScore * weights.LOCATION;

    // 4. Technology overlap (Jaccard similarity)
    maxScore += weights.TECHNOLOGIES;
    const techScore = this.calculateTechnologyOverlap(job1.technologies, job2.technologies);
    score += techScore * weights.TECHNOLOGIES;

    // 5. Posted date proximity
    maxScore += weights.POSTED_DATE;
    const dateScore = this.calculateDateProximity(job1.postedDate, job2.postedDate);
    score += dateScore * weights.POSTED_DATE;

    return score / maxScore;
  }

  /**
   * Normalize string for comparison
   * Handles French accents, special characters, and whitespace
   */
  private normalize(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD') // Normalize accents (é -> e + ´)
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\w\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Compare two strings using Levenshtein distance
   * Returns similarity score (0-1)
   */
  private compareStrings(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;

    const distance = this.levenshteinDistance(str1, str2);
    const maxLen = Math.max(str1.length, str2.length);

    return 1 - distance / maxLen;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * Measures minimum number of edits needed to transform one string into another
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // Create 2D array for dynamic programming
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    // Initialize base cases
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // Fill the matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1]; // No operation needed
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1, // deletion
            dp[i][j - 1] + 1, // insertion
            dp[i - 1][j - 1] + 1 // substitution
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Calculate technology overlap using Jaccard similarity
   * Returns overlap score (0-1)
   */
  private calculateTechnologyOverlap(tech1: string[], tech2: string[]): number {
    if (tech1.length === 0 && tech2.length === 0) return 1;
    if (tech1.length === 0 || tech2.length === 0) return 0;

    const set1 = new Set(tech1.map(t => this.normalize(t)));
    const set2 = new Set(tech2.map(t => this.normalize(t)));

    const intersection = new Set([...set1].filter(t => set2.has(t)));
    const union = new Set([...set1, ...set2]);

    const jaccardSimilarity = intersection.size / union.size;

    // Apply minimum threshold from config
    return jaccardSimilarity >= this.config.MIN_TECH_OVERLAP
      ? jaccardSimilarity
      : jaccardSimilarity * 0.5; // Penalize low overlap
  }

  /**
   * Calculate date proximity score (0-1)
   * Jobs posted closer together are more likely to be duplicates
   */
  private calculateDateProximity(date1: Date, date2: Date): number {
    const daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);

    // Same day = 1.0
    if (daysDiff === 0) return 1;

    // Within a week = high score
    if (daysDiff <= 7) return 1 - (daysDiff / 7) * 0.3; // Max 30% penalty

    // Within 30 days = medium score
    if (daysDiff <= 30) return 0.7 - ((daysDiff - 7) / 23) * 0.4; // Gradual decay

    // Beyond 30 days = low score
    return 0.3;
  }

  /**
   * Find all duplicates of a job in a list
   */
  findDuplicates(job: Job, candidates: Job[]): Job[] {
    return candidates.filter(
      candidate => candidate.id !== job.id && this.isDuplicate(job, candidate)
    );
  }

  /**
   * Merge duplicate jobs (keep best data from each)
   * Returns a single merged job with data from all sources
   */
  mergeDuplicates(jobs: Job[]): Job {
    if (jobs.length === 0) {
      throw new Error('Cannot merge empty job list');
    }

    if (jobs.length === 1) {
      return jobs[0];
    }

    // Choose primary job (highest quality score)
    const primary = jobs.reduce((best, current) =>
      current.calculateQualityScore() > best.calculateQualityScore() ? current : best
    );

    // Create a copy to avoid mutating the original
    const merged = new Job(
      primary.id,
      primary.title,
      primary.company,
      primary.description,
      [...primary.technologies],
      primary.location,
      primary.regionId,
      primary.isRemote,
      primary.salaryMinKEuros,
      primary.salaryMaxKEuros,
      primary.experienceLevel,
      primary.experienceCategory,
      primary.sourceApi,
      primary.externalId,
      primary.sourceUrl,
      primary.postedDate,
      primary.isActive,
      primary.createdAt,
      primary.updatedAt,
      [...primary.sourceApis]
    );

    // Merge data from all other jobs
    jobs.forEach(job => {
      if (job.id !== merged.id) {
        merged.mergeFrom(job);
      }
    });

    return merged;
  }

  /**
   * Deduplicate a list of jobs
   * Returns unique jobs with merged data from duplicates
   */
  deduplicateJobs(jobs: Job[]): Job[] {
    if (jobs.length === 0) return [];

    const uniqueJobs: Job[] = [];
    const processed = new Set<string>();

    // Group by fuzzy key for performance optimization
    const jobsByFuzzyKey = this.groupByFuzzyKey(jobs);

    for (const jobGroup of jobsByFuzzyKey.values()) {
      for (const job of jobGroup) {
        if (processed.has(job.id)) {
          continue;
        }

        // Find all duplicates of this job within the same fuzzy key group
        const duplicates = [job, ...this.findDuplicates(job, jobGroup)];

        // Mark all as processed
        duplicates.forEach(dup => processed.add(dup.id));

        // Merge and add to unique list
        const merged = this.mergeDuplicates(duplicates);
        uniqueJobs.push(merged);
      }
    }

    return uniqueJobs;
  }

  /**
   * Group jobs by fuzzy deduplication key for faster processing
   */
  private groupByFuzzyKey(jobs: Job[]): Map<string, Job[]> {
    const groups = new Map<string, Job[]>();

    for (const job of jobs) {
      const fuzzyKey = job.getFuzzyDeduplicationKey();

      if (!groups.has(fuzzyKey)) {
        groups.set(fuzzyKey, []);
      }
      groups.get(fuzzyKey)!.push(job);
    }

    return groups;
  }

  /**
   * Get detailed deduplication statistics
   */
  getDeduplicationStats(
    originalJobs: Job[],
    deduplicatedJobs: Job[]
  ): {
    originalCount: number;
    deduplicatedCount: number;
    duplicatesRemoved: number;
    duplicateRate: number;
    multiSourceJobs: number;
    multiSourceRate: number;
    averageQualityScore: number;
    sourceBreakdown: Record<string, number>;
  } {
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

    return {
      originalCount: originalJobs.length,
      deduplicatedCount: deduplicatedJobs.length,
      duplicatesRemoved: originalJobs.length - deduplicatedJobs.length,
      duplicateRate:
        originalJobs.length > 0
          ? ((originalJobs.length - deduplicatedJobs.length) / originalJobs.length) * 100
          : 0,
      multiSourceJobs: multiSourceJobs.length,
      multiSourceRate:
        deduplicatedJobs.length > 0 ? (multiSourceJobs.length / deduplicatedJobs.length) * 100 : 0,
      averageQualityScore: Math.round(averageQualityScore * 10) / 10,
      sourceBreakdown,
    };
  }

  /**
   * Analyze similarity between two specific jobs
   * Useful for debugging or manual review
   */
  analyzeSimilarity(
    job1: Job,
    job2: Job
  ): {
    isDuplicate: boolean;
    overallSimilarity: number;
    breakdown: {
      company: number;
      title: number;
      location: number;
      technologies: number;
      postedDate: number;
    };
    reasons: string[];
  } {
    const isDuplicate = this.isDuplicate(job1, job2);
    const overallSimilarity = this.calculateSimilarity(job1, job2);

    const breakdown = {
      company: this.compareStrings(this.normalize(job1.company), this.normalize(job2.company)),
      title: this.compareStrings(this.normalize(job1.title), this.normalize(job2.title)),
      location: this.compareStrings(this.normalize(job1.location), this.normalize(job2.location)),
      technologies: this.calculateTechnologyOverlap(job1.technologies, job2.technologies),
      postedDate: this.calculateDateProximity(job1.postedDate, job2.postedDate),
    };

    const reasons: string[] = [];

    if (breakdown.company > 0.9) reasons.push('Very similar company names');
    if (breakdown.title > 0.9) reasons.push('Very similar job titles');
    if (breakdown.location > 0.9) reasons.push('Same location');
    if (breakdown.technologies > 0.7) reasons.push('High technology overlap');

    const daysDiff =
      Math.abs(job1.postedDate.getTime() - job2.postedDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff <= 3) reasons.push(`Posted within ${Math.round(daysDiff)} days`);

    return {
      isDuplicate,
      overallSimilarity: Math.round(overallSimilarity * 100) / 100,
      breakdown: {
        company: Math.round(breakdown.company * 100) / 100,
        title: Math.round(breakdown.title * 100) / 100,
        location: Math.round(breakdown.location * 100) / 100,
        technologies: Math.round(breakdown.technologies * 100) / 100,
        postedDate: Math.round(breakdown.postedDate * 100) / 100,
      },
      reasons,
    };
  }

  /**
   * Clear the fuzzy key cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.fuzzyKeyCache.clear();
  }
}
