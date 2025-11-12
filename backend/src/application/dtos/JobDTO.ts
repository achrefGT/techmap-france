/**
 * Data Transfer Object for Job entity
 * Used in API responses and inter-layer communication
 */

export interface JobDTO {
  id: string;
  title: string;
  company: string;
  description: string;
  technologies: string[];
  location: string;
  regionId: number | null;
  isRemote: boolean;
  salary: SalaryDTO | null;
  experienceLevel: string | null;
  experienceCategory: string;
  sourceApi: string;
  sourceApis: string[];
  externalId: string;
  sourceUrl: string;
  postedDate: string; // ISO 8601 string
  isActive: boolean;
  qualityScore: number;
  isRecent: boolean;
  isExpired: boolean;
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
}

export interface SalaryDTO {
  min: number | null;
  max: number | null;
  midpoint: number | null;
  unit: string; // "k€"
  currency: string; // "EUR"
  isCompetitive: boolean;
}

/**
 * Lightweight Job DTO for list views
 */
export interface JobSummaryDTO {
  id: string;
  title: string;
  company: string;
  location: string;
  isRemote: boolean;
  technologies: string[];
  salary: SalaryDTO | null;
  experienceCategory: string;
  postedDate: string;
  qualityScore: number;
}

/**
 * UPDATED: Enhanced job filters supporting all query parameters from controller
 */
export interface JobFiltersDTO {
  // Technology filters
  technologies?: string[];

  // Location filters
  regionIds?: number[];
  isRemote?: boolean;

  // Experience filters
  experienceCategories?: string[];

  // Salary filters
  minSalary?: number;
  maxSalary?: number;

  // Quality filter
  minQualityScore?: number;

  // Source filters
  sourceApis?: string[];

  // Date filters
  postedAfter?: string; // ISO date
  postedBefore?: string; // ISO date
  recent?: number; // Jobs posted in last N days (shorthand for postedAfter)

  // Status filter
  isActive?: boolean;
  activeOnly?: boolean; // Alias for isActive=true

  // Company filter
  company?: string;

  // Text search
  searchQuery?: string;
  searchTerm?: string; // Alias for searchQuery
}

/**
 * Pagination metadata
 */
export interface PaginationDTO {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Paginated job results
 */
export interface PaginatedJobsDTO {
  jobs: JobDTO[];
  pagination: PaginationDTO;
  filters: JobFiltersDTO;
}

/**
 * Job comparison result
 */
export interface JobComparisonDTO {
  jobs: JobDTO[];
  similarities: {
    jobId1: string;
    jobId2: string;
    similarityScore: number;
    commonTechnologies: string[];
    salaryComparison: {
      job1Midpoint: number | null;
      job2Midpoint: number | null;
      difference: number | null;
    };
    experienceMatch: boolean;
    locationMatch: boolean;
  }[];
}
