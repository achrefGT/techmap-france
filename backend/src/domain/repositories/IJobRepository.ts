import { Job } from '../entities/Job';

export interface JobFilters {
  regionId?: number;
  technologies?: string[];
  experienceLevel?: string;
  isRemote?: boolean;
  minSalary?: number;
  postedAfter?: Date;
}

export interface BulkSaveResult {
  inserted: number;
  updated: number;
  failed: number;
  errors: string[];
}

export interface IJobRepository {
  findById(id: string): Promise<Job | null>;
  findAll(filters: JobFilters, page: number, limit: number): Promise<Job[]>;
  count(filters: JobFilters): Promise<number>;
  save(job: Job): Promise<void>;
  saveMany(jobs: Job[]): Promise<BulkSaveResult>;
  findRecent(days: number): Promise<Job[]>;
  findByTechnology(techId: number): Promise<Job[]>;
  findByRegion(regionId: number): Promise<Job[]>;
  deactivateOldJobs(days: number): Promise<number>;
}
