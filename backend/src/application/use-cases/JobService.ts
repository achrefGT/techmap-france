import { IJobRepository, JobFilters } from '../../domain/repositories/IJobRepository';
import { JobMapper } from '../mappers/JobMapper';
import { JobDTO, JobSummaryDTO, PaginatedJobsDTO, JobFiltersDTO } from '../dtos/JobDTO';
import { JOB_CONFIG } from '../../domain/constants/JobConfig';

/**
 * Job Service - Basic CRUD and job management operations
 *
 * Responsibilities:
 * - Retrieve individual jobs
 * - List jobs with filtering and pagination
 * - Job activation/deactivation
 * - Company-specific job listings
 * - Expired job cleanup
 *
 * UPDATED: Enhanced filter conversion to support all new parameters
 */
export class JobService {
  constructor(private jobRepository: IJobRepository) {}

  /**
   * Get a single job by ID
   */
  async getJobById(id: string): Promise<JobDTO | null> {
    const job = await this.jobRepository.findById(id);
    return job ? JobMapper.toDTO(job) : null;
  }

  /**
   * UPDATED: Get jobs with comprehensive filtering and pagination
   * Main endpoint for job listings - supports ALL filter types
   */
  async getJobs(
    filters: JobFiltersDTO = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedJobsDTO> {
    // Validate pagination params
    const validatedPage = Math.max(1, page);
    const validatedPageSize = Math.min(Math.max(1, pageSize), 100); // Cap at 100

    // Convert DTO filters to repository filters
    const repoFilters = this.convertFiltersToRepoFormat(filters);

    // Get total count for pagination
    const totalItems = await this.jobRepository.count(repoFilters);

    // Get paginated jobs
    const jobs = await this.jobRepository.findAll(repoFilters, validatedPage, validatedPageSize);

    return JobMapper.toPaginatedDTO(jobs, totalItems, validatedPage, validatedPageSize, filters);
  }

  /**
   * Get recent jobs (posted within N days)
   */
  async getRecentJobs(days: number = JOB_CONFIG.RECENT_DAYS_THRESHOLD): Promise<JobDTO[]> {
    const jobs = await this.jobRepository.findAll({ recentDays: days }, 1, 10000);
    return JobMapper.toDTOs(jobs);
  }

  /**
   * Get lightweight job summaries (for list views)
   * More efficient than full DTOs
   */
  async getJobSummaries(
    filters: JobFiltersDTO = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ jobs: JobSummaryDTO[]; totalItems: number }> {
    const repoFilters = this.convertFiltersToRepoFormat(filters);
    const totalItems = await this.jobRepository.count(repoFilters);
    const jobs = await this.jobRepository.findAll(repoFilters, page, pageSize);

    return {
      jobs: JobMapper.toSummaryDTOs(jobs),
      totalItems,
    };
  }

  /**
   * Get all jobs from a specific company
   */
  async getJobsByCompany(company: string, activeOnly: boolean = true): Promise<JobDTO[]> {
    const repoFilters: JobFilters = {
      company,
      isActive: activeOnly,
    };

    const jobs = await this.jobRepository.findAll(repoFilters, 1, 1000);
    return JobMapper.toDTOs(jobs);
  }

  /**
   * Get jobs by technology
   */
  async getJobsByTechnology(
    technologyName: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedJobsDTO> {
    const repoFilters: JobFilters = {
      technologies: [technologyName],
    };

    const totalItems = await this.jobRepository.count(repoFilters);
    const jobs = await this.jobRepository.findAll(repoFilters, page, pageSize);

    return JobMapper.toPaginatedDTO(jobs, totalItems, page, pageSize, {
      technologies: [technologyName],
    });
  }

  /**
   * Get jobs by region
   */
  async getJobsByRegion(
    regionId: number,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedJobsDTO> {
    const repoFilters: JobFilters = {
      regionIds: [regionId],
    };

    const totalItems = await this.jobRepository.count(repoFilters);
    const jobs = await this.jobRepository.findAll(repoFilters, page, pageSize);

    return JobMapper.toPaginatedDTO(jobs, totalItems, page, pageSize, {
      regionIds: [regionId],
    });
  }

  /**
   * Get remote jobs only
   */
  async getRemoteJobs(page: number = 1, pageSize: number = 20): Promise<PaginatedJobsDTO> {
    return this.getJobs({ isRemote: true }, page, pageSize);
  }

  /**
   * Get jobs with competitive salaries
   */
  async getCompetitiveSalaryJobs(
    minSalary: number = JOB_CONFIG.MID_SALARY_THRESHOLD,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedJobsDTO> {
    return this.getJobs({ minSalary }, page, pageSize);
  }

  /**
   * Get jobs by experience category
   */
  async getJobsByExperience(
    experienceCategory: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedJobsDTO> {
    return this.getJobs({ experienceCategories: [experienceCategory] }, page, pageSize);
  }

  /**
   * Deactivate a job
   */
  async deactivateJob(id: string): Promise<void> {
    const job = await this.jobRepository.findById(id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }

    job.deactivate();
    await this.jobRepository.save(job);
  }

  /**
   * Reactivate a job (if not expired)
   */
  async reactivateJob(id: string): Promise<void> {
    const job = await this.jobRepository.findById(id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }

    job.reactivate(); // Will throw if expired
    await this.jobRepository.save(job);
  }

  /**
   * Deactivate all expired jobs
   * Returns number of jobs deactivated
   */
  async deactivateExpiredJobs(
    expirationDays: number = JOB_CONFIG.EXPIRATION_DAYS
  ): Promise<number> {
    return await this.jobRepository.deactivateOldJobs(expirationDays);
  }

  /**
   * Get jobs posted within a date range
   */
  async getJobsByDateRange(
    startDate: Date,
    endDate: Date,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedJobsDTO> {
    const filters: JobFiltersDTO = {
      postedAfter: startDate.toISOString(),
      postedBefore: endDate.toISOString(),
    };

    return this.getJobs(filters, page, pageSize);
  }

  /**
   * Get high-quality jobs only
   */
  async getHighQualityJobs(
    minQualityScore: number = 70,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedJobsDTO> {
    return this.getJobs({ minQualityScore }, page, pageSize);
  }

  /**
   * Get jobs from specific source(s)
   */
  async getJobsBySource(
    sourceApi: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedJobsDTO> {
    return this.getJobs({ sourceApis: [sourceApi] }, page, pageSize);
  }

  /**
   * Get multi-source jobs (aggregated from multiple APIs)
   */
  async getMultiSourceJobs(page: number = 1, pageSize: number = 20): Promise<JobDTO[]> {
    const jobs = await this.jobRepository.findAll({}, page, pageSize);
    const multiSourceJobs = jobs.filter(job => job.sourceApis.length > 1);
    return JobMapper.toDTOs(multiSourceJobs);
  }

  /**
   * Get job statistics for a specific job
   */
  async getJobStats(id: string): Promise<{
    job: JobDTO;
    qualityScore: number;
    isRecent: boolean;
    isExpired: boolean;
    ageDays: number;
    hasCompetitiveSalary: boolean;
    isSeniorLevel: boolean;
    meetsQualityStandards: boolean;
  } | null> {
    const job = await this.jobRepository.findById(id);
    if (!job) return null;

    return {
      job: JobMapper.toDTO(job),
      qualityScore: job.calculateQualityScore(),
      isRecent: job.isRecent(),
      isExpired: job.isExpired(),
      ageDays: job.getAgeDays(),
      hasCompetitiveSalary: job.hasCompetitiveSalary(),
      isSeniorLevel: job.isSeniorLevel(),
      meetsQualityStandards: job.meetsQualityStandards(),
    };
  }

  /**
   * Get count of jobs by various filters
   */
  async getJobCount(filters: JobFiltersDTO = {}): Promise<number> {
    const repoFilters = this.convertFiltersToRepoFormat(filters);
    return await this.jobRepository.count(repoFilters);
  }

  /**
   * UPDATED: Convert JobFiltersDTO to repository filters format
   * Handles all new filter types and aliases
   */
  private convertFiltersToRepoFormat(filters: JobFiltersDTO): JobFilters {
    const repoFilters: JobFilters = {};

    // Region filters (multiple regions supported)
    if (filters.regionIds && filters.regionIds.length > 0) {
      repoFilters.regionIds = filters.regionIds;
    }

    // Technology filters (multiple technologies with AND condition)
    if (filters.technologies && filters.technologies.length > 0) {
      repoFilters.technologies = filters.technologies;
    }

    // Experience filters (multiple categories with OR condition)
    if (filters.experienceCategories && filters.experienceCategories.length > 0) {
      repoFilters.experienceCategories = filters.experienceCategories;
    }

    // Remote filter
    if (filters.isRemote !== undefined) {
      repoFilters.isRemote = filters.isRemote;
    }

    // Salary filters
    if (filters.minSalary !== undefined) {
      repoFilters.minSalary = filters.minSalary;
    }
    if (filters.maxSalary !== undefined) {
      repoFilters.maxSalary = filters.maxSalary;
    }

    // Quality filter
    if (filters.minQualityScore !== undefined) {
      repoFilters.minQualityScore = filters.minQualityScore;
    }

    // Source API filters
    if (filters.sourceApis && filters.sourceApis.length > 0) {
      repoFilters.sourceApis = filters.sourceApis;
    }

    // Date filters
    if (filters.postedAfter) {
      repoFilters.postedAfter = new Date(filters.postedAfter);
    }
    if (filters.postedBefore) {
      repoFilters.postedBefore = new Date(filters.postedBefore);
    }

    // Recent days filter (shorthand for postedAfter)
    if (filters.recent !== undefined) {
      repoFilters.recentDays = filters.recent;
    }

    // Active filter (handle both isActive and activeOnly)
    if (filters.isActive !== undefined) {
      repoFilters.isActive = filters.isActive;
    } else if (filters.activeOnly !== undefined) {
      repoFilters.isActive = filters.activeOnly;
    }

    // Company filter
    if (filters.company) {
      repoFilters.company = filters.company;
    }

    // Text search (handle both searchQuery and searchTerm aliases)
    if (filters.searchQuery) {
      repoFilters.searchQuery = filters.searchQuery;
    } else if (filters.searchTerm) {
      repoFilters.searchQuery = filters.searchTerm;
    }

    return repoFilters;
  }
}
