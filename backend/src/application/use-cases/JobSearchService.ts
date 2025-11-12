import { IJobRepository, JobFilters } from '../../domain/repositories/IJobRepository';
import { JobDeduplicationService } from '../../domain/services/JobDeduplicationService';
import { JobMapper } from '../mappers/JobMapper';
import {
  JobDTO,
  JobSummaryDTO,
  PaginatedJobsDTO,
  JobFiltersDTO,
  JobComparisonDTO,
} from '../dtos/JobDTO';
import { Job } from '../../domain/entities/Job';

/**
 * Advanced search criteria with scoring weights
 */
export interface AdvancedSearchCriteria {
  // Required technologies (AND condition)
  requiredTechnologies?: string[];
  // Preferred technologies (OR condition, boosts score)
  preferredTechnologies?: string[];
  // Region preferences (with priority)
  preferredRegions?: number[];
  // Experience level preferences
  experienceCategories?: string[];
  // Salary range
  minSalary?: number;
  maxSalary?: number;
  // Remote preference
  remoteOnly?: boolean;
  remotePreferred?: boolean;
  // Company preferences
  preferredCompanies?: string[];
  excludedCompanies?: string[];
  // Quality threshold
  minQualityScore?: number;
  // Recency preference (boost recent jobs)
  preferRecent?: boolean;
  // Search weights (for scoring)
  weights?: {
    technologyMatch?: number;
    experienceMatch?: number;
    salaryMatch?: number;
    locationMatch?: number;
    qualityScore?: number;
    recency?: number;
  };
}

/**
 * Search result with relevance score
 */
export interface SearchResult {
  job: JobDTO;
  relevanceScore: number;
  matchReasons: string[];
}

/**
 * Job Search Service - Advanced search and matching capabilities
 *
 * Responsibilities:
 * - Full-text search across job fields
 * - Multi-criteria advanced search with scoring
 * - Similar job recommendations
 * - Technology stack matching
 * - Personalized job recommendations
 * - Smart filtering with ranking
 *
 * UPDATED: Enhanced to work with updated repository filters
 */
export class JobSearchService {
  private deduplicationService: JobDeduplicationService;

  constructor(private jobRepository: IJobRepository) {
    this.deduplicationService = new JobDeduplicationService();
  }

  /**
   * Simple text search across job title, company, description
   */
  async searchJobs(
    query: string,
    filters: JobFiltersDTO = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedJobsDTO> {
    // Build repository filters with text search
    const repoFilters = this.convertFiltersToRepoFormat(filters);
    repoFilters.searchQuery = query;

    // Get total count
    const totalItems = await this.jobRepository.count(repoFilters);

    // Get jobs
    const jobs = await this.jobRepository.findAll(repoFilters, page, pageSize);

    return JobMapper.toPaginatedDTO(jobs, totalItems, page, pageSize, {
      ...filters,
      searchQuery: query,
    });
  }

  /**
   * Advanced search with multi-criteria scoring
   * Returns jobs ranked by relevance to criteria
   */
  async advancedSearch(
    criteria: AdvancedSearchCriteria,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{
    results: SearchResult[];
    totalResults: number;
    averageRelevanceScore: number;
  }> {
    // Get base set of jobs (apply hard filters)
    const baseFilters = this.buildBaseFilters(criteria);
    const jobs = await this.jobRepository.findAll(baseFilters, 1, 10000);

    // Apply additional filtering
    let filteredJobs = jobs;

    // Exclude companies
    if (criteria.excludedCompanies && criteria.excludedCompanies.length > 0) {
      const excludedSet = new Set(criteria.excludedCompanies.map(c => c.toLowerCase()));
      filteredJobs = filteredJobs.filter(job => !excludedSet.has(job.company.toLowerCase()));
    }

    // Required technologies (must have ALL) - Note: repository already handles this
    // No additional filtering needed if it was in baseFilters

    // Score and rank remaining jobs
    const searchResults = filteredJobs.map(job => this.scoreJobAgainstCriteria(job, criteria));

    // Sort by relevance score (descending)
    searchResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Calculate average score
    const averageScore =
      searchResults.length > 0
        ? searchResults.reduce((sum, r) => sum + r.relevanceScore, 0) / searchResults.length
        : 0;

    // Paginate
    const totalResults = searchResults.length;
    const start = (page - 1) * pageSize;
    const paginatedResults = searchResults.slice(start, start + pageSize);

    return {
      results: paginatedResults,
      totalResults,
      averageRelevanceScore: Math.round(averageScore * 100) / 100,
    };
  }

  /**
   * Find similar jobs based on a given job
   * Uses deduplication similarity algorithm
   */
  async getSimilarJobs(
    jobId: string,
    limit: number = 10,
    excludeSameCompany: boolean = false
  ): Promise<JobDTO[]> {
    const targetJob = await this.jobRepository.findById(jobId);
    if (!targetJob) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Get all active jobs
    const allJobs = await this.jobRepository.findAll({ isActive: true }, 1, 10000);

    // Calculate similarity scores
    const similarJobs = allJobs
      .filter(job => {
        if (job.id === jobId) return false;
        if (excludeSameCompany && job.company === targetJob.company) return false;
        return true;
      })
      .map(job => ({
        job,
        similarity: this.deduplicationService.calculateSimilarity(targetJob, job),
      }))
      .filter(item => item.similarity > 0.3) // Minimum similarity threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => item.job);

    return JobMapper.toDTOs(similarJobs);
  }

  /**
   * Search jobs by technology stack (must have ALL technologies)
   */
  async searchByTechnologyStack(
    techStack: string[],
    additionalFilters: JobFiltersDTO = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedJobsDTO> {
    const repoFilters = this.convertFiltersToRepoFormat(additionalFilters);
    repoFilters.technologies = techStack;

    const totalItems = await this.jobRepository.count(repoFilters);
    const jobs = await this.jobRepository.findAll(repoFilters, page, pageSize);

    return JobMapper.toPaginatedDTO(jobs, totalItems, page, pageSize, {
      ...additionalFilters,
      technologies: techStack,
    });
  }

  /**
   * Search jobs by any of the given technologies (OR condition)
   * Note: Repository uses AND condition, so we need to fetch and filter
   */
  async searchByAnyTechnology(
    technologies: string[],
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedJobsDTO> {
    const jobs = await this.jobRepository.findAll({}, 1, 10000);

    // Filter jobs that have at least one of the technologies
    const matchingJobs = jobs.filter(job =>
      technologies.some(tech => job.requiresTechnology(tech))
    );

    // Sort by number of matching technologies, then quality
    matchingJobs.sort((a, b) => {
      const aMatches = technologies.filter(tech => a.requiresTechnology(tech)).length;
      const bMatches = technologies.filter(tech => b.requiresTechnology(tech)).length;

      if (aMatches !== bMatches) {
        return bMatches - aMatches;
      }
      return b.calculateQualityScore() - a.calculateQualityScore();
    });

    // Paginate
    const totalItems = matchingJobs.length;
    const start = (page - 1) * pageSize;
    const paginatedJobs = matchingJobs.slice(start, start + pageSize);

    return JobMapper.toPaginatedDTO(paginatedJobs, totalItems, page, pageSize, {
      technologies,
    });
  }

  /**
   * Get personalized job recommendations based on user preferences
   */
  async getRecommendedJobs(
    userPreferences: {
      technologies: string[];
      experienceLevel?: string;
      preferredRegions?: number[];
      minSalary?: number;
      remotePreference?: 'required' | 'preferred' | 'no-preference';
    },
    limit: number = 20
  ): Promise<SearchResult[]> {
    // Build advanced search criteria from user preferences
    const criteria: AdvancedSearchCriteria = {
      preferredTechnologies: userPreferences.technologies,
      experienceCategories: userPreferences.experienceLevel
        ? [userPreferences.experienceLevel]
        : undefined,
      preferredRegions: userPreferences.preferredRegions,
      minSalary: userPreferences.minSalary,
      remoteOnly: userPreferences.remotePreference === 'required',
      remotePreferred: userPreferences.remotePreference === 'preferred',
      minQualityScore: 50, // Only recommend quality jobs
      preferRecent: true, // Prefer recent postings
    };

    const searchResult = await this.advancedSearch(criteria, 1, limit);
    return searchResult.results;
  }

  /**
   * Smart job search with natural language query
   * Extracts technologies, experience level, location from query
   */
  async smartSearch(
    naturalLanguageQuery: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedJobsDTO> {
    // Extract search intent from query
    const intent = this.parseSearchIntent(naturalLanguageQuery);

    // Build filters based on intent
    const filters: JobFiltersDTO = {
      technologies: intent.technologies,
      experienceCategories: intent.experienceLevels,
      isRemote: intent.isRemote,
      minSalary: intent.minSalary,
    };

    // Use text search with extracted filters
    return this.searchJobs(intent.searchText, filters, page, pageSize);
  }

  /**
   * Find jobs at companies hiring for multiple positions
   * Useful for finding companies with active recruitment
   */
  async getCompaniesHiringMultiple(
    minJobCount: number = 3,
    page: number = 1,
    pageSize: number = 20
  ): Promise<
    {
      company: string;
      jobCount: number;
      jobs: JobSummaryDTO[];
    }[]
  > {
    const jobs = await this.jobRepository.findAll({ isActive: true }, 1, 10000);

    // Group by company
    const companyMap = new Map<string, Job[]>();
    jobs.forEach(job => {
      const key = job.company;
      if (!companyMap.has(key)) {
        companyMap.set(key, []);
      }
      companyMap.get(key)!.push(job);
    });

    // Filter companies with minimum job count
    const result = Array.from(companyMap.entries())
      .filter(([_, jobList]) => jobList.length >= minJobCount)
      .map(([company, jobList]) => ({
        company,
        jobCount: jobList.length,
        jobs: JobMapper.toSummaryDTOs(jobList),
      }))
      .sort((a, b) => b.jobCount - a.jobCount);

    // Paginate
    const start = (page - 1) * pageSize;
    return result.slice(start, start + pageSize);
  }

  /**
   * UPDATED: Compare multiple jobs
   * Useful for user-facing "compare jobs" feature
   */
  async compareMultipleJobs(jobIds: string[]): Promise<JobComparisonDTO> {
    const jobs = await Promise.all(jobIds.map(id => this.jobRepository.findById(id)));

    // Filter out null jobs
    const validJobs = jobs.filter((job): job is Job => job !== null);

    if (validJobs.length < 2) {
      throw new Error('At least 2 valid jobs required for comparison');
    }

    // Calculate pairwise similarities
    const similarities: JobComparisonDTO['similarities'] = [];

    for (let i = 0; i < validJobs.length; i++) {
      for (let j = i + 1; j < validJobs.length; j++) {
        const job1 = validJobs[i];
        const job2 = validJobs[j];

        const analysis = this.deduplicationService.analyzeSimilarity(job1, job2);

        const job1Midpoint = job1.getSalaryMidpoint();
        const job2Midpoint = job2.getSalaryMidpoint();
        const salaryDifference =
          job1Midpoint && job2Midpoint ? Math.abs(job1Midpoint - job2Midpoint) : null;

        // Calculate common technologies (normalized comparison)
        const normalize = (str: string) => str.toLowerCase().trim();
        const tech2Set = new Set(job2.technologies.map(normalize));
        const commonTechs = job1.technologies.filter(tech => tech2Set.has(normalize(tech)));

        similarities.push({
          jobId1: job1.id,
          jobId2: job2.id,
          similarityScore: analysis.overallSimilarity,
          commonTechnologies: commonTechs,
          salaryComparison: {
            job1Midpoint,
            job2Midpoint,
            difference: salaryDifference,
          },
          experienceMatch: job1.experienceCategory === job2.experienceCategory,
          locationMatch: job1.regionId === job2.regionId || (job1.isRemote && job2.isRemote),
        });
      }
    }

    return {
      jobs: JobMapper.toDTOs(validJobs),
      similarities,
    };
  }

  /**
   * Analyze similarity between two jobs
   * Useful for debugging or detailed comparison
   */
  async compareJobs(
    jobId1: string,
    jobId2: string
  ): Promise<{
    job1: JobDTO;
    job2: JobDTO;
    similarityAnalysis: ReturnType<JobDeduplicationService['analyzeSimilarity']>;
  }> {
    const job1 = await this.jobRepository.findById(jobId1);
    const job2 = await this.jobRepository.findById(jobId2);

    if (!job1 || !job2) {
      throw new Error('One or both jobs not found');
    }

    const analysis = this.deduplicationService.analyzeSimilarity(job1, job2);

    return {
      job1: JobMapper.toDTO(job1),
      job2: JobMapper.toDTO(job2),
      similarityAnalysis: analysis,
    };
  }

  // ==================== Private Helper Methods ====================

  /**
   * Build base repository filters from advanced criteria
   */
  private buildBaseFilters(criteria: AdvancedSearchCriteria): JobFilters {
    const filters: JobFilters = {};

    // Required technologies (AND condition) - repository handles this
    if (criteria.requiredTechnologies && criteria.requiredTechnologies.length > 0) {
      filters.technologies = criteria.requiredTechnologies;
    }

    // Experience categories
    if (criteria.experienceCategories && criteria.experienceCategories.length > 0) {
      filters.experienceCategories = criteria.experienceCategories;
    }

    // Remote filter
    if (criteria.remoteOnly) {
      filters.isRemote = true;
    }

    // Salary filters
    if (criteria.minSalary) {
      filters.minSalary = criteria.minSalary;
    }
    if (criteria.maxSalary) {
      filters.maxSalary = criteria.maxSalary;
    }

    // Preferred regions
    if (criteria.preferredRegions && criteria.preferredRegions.length > 0) {
      filters.regionIds = criteria.preferredRegions;
    }

    // Quality threshold
    if (criteria.minQualityScore) {
      filters.minQualityScore = criteria.minQualityScore;
    }

    // Recent preference
    if (criteria.preferRecent) {
      filters.recentDays = 30; // Last 30 days
    }

    return filters;
  }

  /**
   * Score a job against advanced search criteria
   */
  private scoreJobAgainstCriteria(job: Job, criteria: AdvancedSearchCriteria): SearchResult {
    let score = 0;
    const matchReasons: string[] = [];

    // Default weights
    const weights = criteria.weights || {
      technologyMatch: 40,
      experienceMatch: 20,
      salaryMatch: 15,
      locationMatch: 10,
      qualityScore: 10,
      recency: 5,
    };

    // Technology matching (preferred technologies)
    if (criteria.preferredTechnologies && criteria.preferredTechnologies.length > 0) {
      const matchCount = criteria.preferredTechnologies.filter(tech =>
        job.requiresTechnology(tech)
      ).length;
      const matchPercentage = matchCount / criteria.preferredTechnologies.length;

      score += matchPercentage * weights.technologyMatch!;

      if (matchCount > 0) {
        matchReasons.push(
          `Matches ${matchCount}/${criteria.preferredTechnologies.length} preferred technologies`
        );
      }
    }

    // Experience level matching
    if (criteria.experienceCategories && criteria.experienceCategories.length > 0) {
      if (criteria.experienceCategories.includes(job.experienceCategory)) {
        score += weights.experienceMatch!;
        matchReasons.push(`Matches experience level: ${job.experienceCategory}`);
      }
    }

    // Salary matching
    if (criteria.minSalary || criteria.maxSalary) {
      const midpoint = job.getSalaryMidpoint();
      if (midpoint) {
        let salaryScore = 0;

        if (criteria.minSalary && midpoint >= criteria.minSalary) {
          salaryScore += 0.5;
          matchReasons.push(`Salary meets minimum: ${midpoint}k€`);
        }

        if (criteria.maxSalary && midpoint <= criteria.maxSalary) {
          salaryScore += 0.5;
        }

        score += salaryScore * weights.salaryMatch!;
      }
    }

    // Location/Region matching
    if (criteria.preferredRegions && criteria.preferredRegions.length > 0) {
      if (job.regionId && criteria.preferredRegions.includes(job.regionId)) {
        score += weights.locationMatch!;
        matchReasons.push('Located in preferred region');
      }
    }

    // Remote preference
    if (criteria.remotePreferred && job.isRemote) {
      score += 5;
      matchReasons.push('Remote position');
    }

    // Company preference
    if (criteria.preferredCompanies && criteria.preferredCompanies.length > 0) {
      const companyMatch = criteria.preferredCompanies.some(
        company => job.company.toLowerCase() === company.toLowerCase()
      );
      if (companyMatch) {
        score += 15;
        matchReasons.push('Preferred company');
      }
    }

    // Quality score boost
    const qualityScore = job.calculateQualityScore();
    score += (qualityScore / 100) * weights.qualityScore!;

    if (qualityScore >= 70) {
      matchReasons.push('High quality job posting');
    }

    // Recency boost
    if (criteria.preferRecent && job.isRecent()) {
      score += weights.recency!;
      matchReasons.push('Recently posted');
    }

    return {
      job: JobMapper.toDTO(job),
      relevanceScore: Math.round(score * 100) / 100,
      matchReasons,
    };
  }

  /**
   * Parse natural language search query to extract intent
   */
  private parseSearchIntent(query: string): {
    searchText: string;
    technologies: string[];
    experienceLevels: string[];
    isRemote?: boolean;
    minSalary?: number;
  } {
    const normalized = query.toLowerCase();

    // Extract technologies (simple keyword matching)
    const commonTechs = [
      'react',
      'vue',
      'angular',
      'node',
      'python',
      'java',
      'javascript',
      'typescript',
      'php',
      'ruby',
      'go',
      'rust',
      'docker',
      'kubernetes',
    ];
    const technologies = commonTechs.filter(tech => normalized.includes(tech));

    // Extract experience levels
    const experienceLevels: string[] = [];
    if (normalized.includes('junior') || normalized.includes('entry')) {
      experienceLevels.push('junior');
    }
    if (normalized.includes('mid') || normalized.includes('intermediate')) {
      experienceLevels.push('mid');
    }
    if (normalized.includes('senior')) {
      experienceLevels.push('senior');
    }
    if (normalized.includes('lead') || normalized.includes('principal')) {
      experienceLevels.push('lead');
    }

    // Extract remote preference
    const isRemote =
      normalized.includes('remote') || normalized.includes('télétravail') ? true : undefined;

    // Extract salary (simple pattern matching)
    const salaryMatch = normalized.match(/(\d+)k/);
    const minSalary = salaryMatch ? parseInt(salaryMatch[1]) : undefined;

    return {
      searchText: query,
      technologies,
      experienceLevels,
      isRemote,
      minSalary,
    };
  }

  /**
   * Convert JobFiltersDTO to repository filters format
   */
  private convertFiltersToRepoFormat(filters: JobFiltersDTO): JobFilters {
    const repoFilters: JobFilters = {};

    if (filters.regionIds && filters.regionIds.length > 0) {
      repoFilters.regionIds = filters.regionIds;
    }

    if (filters.technologies && filters.technologies.length > 0) {
      repoFilters.technologies = filters.technologies;
    }

    if (filters.experienceCategories && filters.experienceCategories.length > 0) {
      repoFilters.experienceCategories = filters.experienceCategories;
    }

    if (filters.isRemote !== undefined) {
      repoFilters.isRemote = filters.isRemote;
    }

    if (filters.minSalary !== undefined) {
      repoFilters.minSalary = filters.minSalary;
    }

    if (filters.maxSalary !== undefined) {
      repoFilters.maxSalary = filters.maxSalary;
    }

    if (filters.minQualityScore !== undefined) {
      repoFilters.minQualityScore = filters.minQualityScore;
    }

    if (filters.sourceApis && filters.sourceApis.length > 0) {
      repoFilters.sourceApis = filters.sourceApis;
    }

    if (filters.postedAfter) {
      repoFilters.postedAfter = new Date(filters.postedAfter);
    }

    if (filters.postedBefore) {
      repoFilters.postedBefore = new Date(filters.postedBefore);
    }

    if (filters.recent !== undefined) {
      repoFilters.recentDays = filters.recent;
    }

    if (filters.isActive !== undefined) {
      repoFilters.isActive = filters.isActive;
    } else if (filters.activeOnly !== undefined) {
      repoFilters.isActive = filters.activeOnly;
    }

    if (filters.company) {
      repoFilters.company = filters.company;
    }

    if (filters.searchQuery) {
      repoFilters.searchQuery = filters.searchQuery;
    } else if (filters.searchTerm) {
      repoFilters.searchQuery = filters.searchTerm;
    }

    return repoFilters;
  }
}
