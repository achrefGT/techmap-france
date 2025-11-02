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
 * Job filters for queries
 */
export interface JobFiltersDTO {
  technologies?: string[];
  regionIds?: number[];
  isRemote?: boolean;
  experienceCategories?: string[];
  minSalary?: number;
  maxSalary?: number;
  minQualityScore?: number;
  sourceApis?: string[];
  postedAfter?: string; // ISO date
  postedBefore?: string; // ISO date
  isActive?: boolean;
  searchTerm?: string;
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
