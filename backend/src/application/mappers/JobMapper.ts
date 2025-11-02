import { Job } from '../../domain/entities/Job';
import {
  JobDTO,
  SalaryDTO,
  JobSummaryDTO,
  PaginatedJobsDTO,
  PaginationDTO,
  JobFiltersDTO,
} from '../dtos/JobDTO';
import { SALARY_CONFIG } from '../../domain/constants/SalaryConfig';

/**
 * Mapper for Job entity <-> JobDTO transformations
 */
export class JobMapper {
  /**
   * Convert Job entity to full JobDTO
   */
  static toDTO(job: Job): JobDTO {
    return {
      id: job.id,
      title: job.title,
      company: job.company,
      description: job.description,
      technologies: [...job.technologies],
      location: job.location,
      regionId: job.regionId,
      isRemote: job.isRemote,
      salary: this.mapSalary(job),
      experienceLevel: job.experienceLevel,
      experienceCategory: job.experienceCategory,
      sourceApi: job.sourceApi,
      sourceApis: [...job.sourceApis],
      externalId: job.externalId,
      sourceUrl: job.sourceUrl,
      postedDate: job.postedDate.toISOString(),
      isActive: job.isActive,
      qualityScore: job.calculateQualityScore(),
      isRecent: job.isRecent(),
      isExpired: job.isExpired(),
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }

  /**
   * Convert Job entity to lightweight JobSummaryDTO
   */
  static toSummaryDTO(job: Job): JobSummaryDTO {
    return {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      isRemote: job.isRemote,
      technologies: [...job.technologies],
      salary: this.mapSalary(job),
      experienceCategory: job.experienceCategory,
      postedDate: job.postedDate.toISOString(),
      qualityScore: job.calculateQualityScore(),
    };
  }

  /**
   * Convert array of Job entities to DTOs
   */
  static toDTOs(jobs: Job[]): JobDTO[] {
    return jobs.map(job => this.toDTO(job));
  }

  /**
   * Convert array of Job entities to summary DTOs
   */
  static toSummaryDTOs(jobs: Job[]): JobSummaryDTO[] {
    return jobs.map(job => this.toSummaryDTO(job));
  }

  /**
   * Map salary fields to SalaryDTO
   */
  private static mapSalary(job: Job): SalaryDTO | null {
    if (!job.salaryMinKEuros && !job.salaryMaxKEuros) {
      return null;
    }

    const midpoint = job.getSalaryMidpoint();

    return {
      min: job.salaryMinKEuros,
      max: job.salaryMaxKEuros,
      midpoint,
      unit: SALARY_CONFIG.UNIT,
      currency: 'EUR',
      isCompetitive: job.hasCompetitiveSalary(),
    };
  }

  /**
   * Create paginated response
   */
  static toPaginatedDTO(
    jobs: Job[],
    totalItems: number,
    page: number,
    pageSize: number,
    filters: JobFiltersDTO
  ): PaginatedJobsDTO {
    const totalPages = Math.ceil(totalItems / pageSize);

    const pagination: PaginationDTO = {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };

    return {
      jobs: this.toDTOs(jobs),
      pagination,
      filters,
    };
  }

  /**
   * Convert DTO back to Job entity (for updates)
   * Requires an existing job to preserve immutable fields
   */
  static fromDTO(dto: Partial<JobDTO>, existingJob: Job): Job {
    return new Job(
      existingJob.id,
      dto.title ?? existingJob.title,
      dto.company ?? existingJob.company,
      dto.description ?? existingJob.description,
      dto.technologies ?? existingJob.technologies,
      dto.location ?? existingJob.location,
      dto.regionId ?? existingJob.regionId,
      dto.isRemote ?? existingJob.isRemote,
      dto.salary?.min ?? existingJob.salaryMinKEuros,
      dto.salary?.max ?? existingJob.salaryMaxKEuros,
      dto.experienceLevel ?? existingJob.experienceLevel,
      existingJob.experienceCategory, // Cannot be changed via DTO
      existingJob.sourceApi, // Immutable
      existingJob.externalId, // Immutable
      dto.sourceUrl ?? existingJob.sourceUrl,
      existingJob.postedDate, // Cannot be changed
      dto.isActive ?? existingJob.isActive,
      existingJob.createdAt, // Immutable
      new Date(), // Updated now
      existingJob.sourceApis // Cannot be changed via DTO
    );
  }
}
