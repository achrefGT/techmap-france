import { IJobRepository } from '../../domain/repositories/IJobRepository';
import { JobDeduplicationService } from '../../domain/services/JobDeduplicationService';
import { JobMapper } from '../mappers/JobMapper';
import { JobDTO, JobSummaryDTO, PaginatedJobsDTO, JobFiltersDTO } from '../dtos/JobDTO';
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
    // Get all jobs that match basic filters
    const jobs = await this.jobRepository.findAll(
      this.convertFiltersToRepoFormat(filters),
      1,
      10000 // Get large set for text filtering
    );

    // Filter by text search
    const normalizedQuery = this.normalizeSearchQuery(query);
    const matchedJobs = jobs.filter(job => this.matchesSearchQuery(job, normalizedQuery));

    // Sort by relevance (title match > company match > description match)
    const scoredJobs = matchedJobs.map(job => ({
      job,
      score: this.calculateTextSearchScore(job, normalizedQuery),
    }));

    scoredJobs.sort((a, b) => b.score - a.score);

    // Paginate
    const totalItems = scoredJobs.length;
    const start = (page - 1) * pageSize;
    const paginatedJobs = scoredJobs.slice(start, start + pageSize).map(item => item.job);

    return JobMapper.toPaginatedDTO(paginatedJobs, totalItems, page, pageSize, {
      ...filters,
      searchTerm: query,
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

    // Required technologies (must have ALL)
    if (criteria.requiredTechnologies && criteria.requiredTechnologies.length > 0) {
      filteredJobs = filteredJobs.filter(job => job.matchesStack(criteria.requiredTechnologies!));
    }

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
    const jobs = await this.jobRepository.findAll(
      this.convertFiltersToRepoFormat(additionalFilters),
      1,
      10000
    );

    // Filter jobs that match the entire stack
    const matchingJobs = jobs.filter(job => job.matchesStack(techStack));

    // Sort by quality score
    matchingJobs.sort((a, b) => b.calculateQualityScore() - a.calculateQualityScore());

    // Paginate
    const totalItems = matchingJobs.length;
    const start = (page - 1) * pageSize;
    const paginatedJobs = matchingJobs.slice(start, start + pageSize);

    return JobMapper.toPaginatedDTO(paginatedJobs, totalItems, page, pageSize, {
      ...additionalFilters,
      technologies: techStack,
    });
  }

  /**
   * Search jobs by any of the given technologies (OR condition)
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

    return JobMapper.toPaginatedDTO(paginatedJobs, totalItems, page, pageSize, { technologies });
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
   * Analyze similarity between two jobs
   * Useful for debugging or user-facing "compare jobs" feature
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
   * Normalize search query for matching
   */
  private normalizeSearchQuery(query: string): string {
    return query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * Check if job matches search query
   */
  private matchesSearchQuery(job: Job, normalizedQuery: string): boolean {
    const searchableText = [
      job.title,
      job.company,
      job.description,
      ...job.technologies,
      job.location,
    ]
      .join(' ')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return searchableText.includes(normalizedQuery);
  }

  /**
   * Calculate text search relevance score
   */
  private calculateTextSearchScore(job: Job, normalizedQuery: string): number {
    let score = 0;

    const normalizedTitle = this.normalizeSearchQuery(job.title);
    const normalizedCompany = this.normalizeSearchQuery(job.company);
    const normalizedDescription = this.normalizeSearchQuery(job.description);

    // Title match (highest weight)
    if (normalizedTitle.includes(normalizedQuery)) score += 100;

    // Company match (medium weight)
    if (normalizedCompany.includes(normalizedQuery)) score += 50;

    // Technology match (medium weight)
    if (job.technologies.some(tech => this.normalizeSearchQuery(tech).includes(normalizedQuery))) {
      score += 50;
    }

    // Description match (low weight)
    if (normalizedDescription.includes(normalizedQuery)) score += 20;

    // Boost quality jobs
    score += job.calculateQualityScore() * 0.1;

    // Boost recent jobs
    if (job.isRecent()) score += 10;

    return score;
  }

  /**
   * Build base repository filters from advanced criteria
   */
  private buildBaseFilters(criteria: AdvancedSearchCriteria): any {
    const filters: any = {};

    if (criteria.experienceCategories && criteria.experienceCategories.length > 0) {
      filters.experienceLevel = criteria.experienceCategories[0];
    }

    if (criteria.remoteOnly) {
      filters.isRemote = true;
    }

    if (criteria.minSalary) {
      filters.minSalary = criteria.minSalary;
    }

    if (criteria.preferredRegions && criteria.preferredRegions.length > 0) {
      filters.regionId = criteria.preferredRegions[0];
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
   * Convert JobFiltersDTO to repository format
   */
  private convertFiltersToRepoFormat(filters: JobFiltersDTO): any {
    const repoFilters: any = {};

    if (filters.regionIds && filters.regionIds.length > 0) {
      repoFilters.regionId = filters.regionIds[0];
    }

    if (filters.technologies && filters.technologies.length > 0) {
      repoFilters.technologies = filters.technologies;
    }

    if (filters.experienceCategories && filters.experienceCategories.length > 0) {
      repoFilters.experienceLevel = filters.experienceCategories[0];
    }

    if (filters.isRemote !== undefined) {
      repoFilters.isRemote = filters.isRemote;
    }

    if (filters.minSalary !== undefined) {
      repoFilters.minSalary = filters.minSalary;
    }

    if (filters.postedAfter) {
      repoFilters.postedAfter = new Date(filters.postedAfter);
    }

    return repoFilters;
  }
}
