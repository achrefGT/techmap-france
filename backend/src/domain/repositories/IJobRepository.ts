import { Job } from '../entities/Job';

/**
 * UPDATED: Comprehensive filters to support all query scenarios
 */
export interface JobFilters {
  regionId?: number;
  technologies?: string[];
  experienceLevel?: string;
  isRemote?: boolean;
  minSalary?: number;
  postedAfter?: Date;
  postedBefore?: Date;
  isActive?: boolean;
  maxSalary?: number;
  minQualityScore?: number;
  company?: string; // Company name filter
  searchQuery?: string; // Text search across title, company, description
  recentDays?: number; // Jobs posted in last N days
  experienceCategories?: string[]; // Multiple experience levels (OR condition)
  regionIds?: number[]; // Multiple regions (OR condition)
  sourceApis?: string[]; // Filter by source APIs
}

export interface BulkSaveResult {
  inserted: number;
  updated: number;
  failed: number;
  errors: string[];
}

export interface IJobRepository {
  findById(id: string): Promise<Job | null>;

  // UPDATED: Single method handles all filtering
  findAll(filters: JobFilters, page: number, limit: number): Promise<Job[]>;

  count(filters: JobFilters): Promise<number>;

  save(job: Job): Promise<void>;
  saveMany(jobs: Job[]): Promise<BulkSaveResult>;

  deactivateOldJobs(days: number): Promise<number>;
}
