import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { JobService } from '../../../../src/application/use-cases/JobService';
import { IJobRepository } from '../../../../src/domain/repositories/IJobRepository';
import { Job } from '../../../../src/domain/entities/Job';
import { JobFiltersDTO } from '../../../../src/application/dtos/JobDTO';
import { JOB_CONFIG } from '../../../../src/domain/constants/JobConfig';

describe('JobService', () => {
  let jobService: JobService;
  let mockJobRepository: jest.Mocked<IJobRepository>;

  const createMockJob = (overrides: Partial<any> = {}): Job => {
    const defaults = {
      id: '1',
      title: 'React Developer',
      company: 'TechCorp',
      description: 'Build React applications with modern technologies',
      technologies: ['React', 'TypeScript'],
      location: 'Paris',
      regionId: 11,
      isRemote: false,
      salaryMinKEuros: 50,
      salaryMaxKEuros: 70,
      experienceLevel: 'Mid',
      experienceCategory: 'mid' as const,
      sourceApi: 'linkedin',
      externalId: 'ext-123',
      sourceUrl: 'https://linkedin.com/jobs/1',
      postedDate: new Date('2024-10-20'),
      isActive: true,
      createdAt: new Date('2024-10-20'),
      updatedAt: new Date('2024-10-20'),
      sourceApis: ['linkedin'],
    };

    const data = { ...defaults, ...overrides };

    return new Job(
      data.id,
      data.title,
      data.company,
      data.description,
      data.technologies,
      data.location,
      data.regionId,
      data.isRemote,
      data.salaryMinKEuros,
      data.salaryMaxKEuros,
      data.experienceLevel,
      data.experienceCategory,
      data.sourceApi,
      data.externalId,
      data.sourceUrl,
      data.postedDate,
      data.isActive,
      data.createdAt,
      data.updatedAt,
      data.sourceApis
    );
  };

  beforeEach(() => {
    mockJobRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      save: jest.fn(),
      saveMany: jest.fn(),
      deactivateOldJobs: jest.fn(),
    } as jest.Mocked<IJobRepository>;

    jobService = new JobService(mockJobRepository);
  });

  describe('getJobById', () => {
    it('should return a job DTO when job exists', async () => {
      const mockJob = createMockJob();
      mockJobRepository.findById.mockResolvedValue(mockJob);

      const result = await jobService.getJobById('1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('1');
      expect(result?.title).toBe('React Developer');
      expect(mockJobRepository.findById).toHaveBeenCalledWith('1');
    });

    it('should return null when job does not exist', async () => {
      mockJobRepository.findById.mockResolvedValue(null);

      const result = await jobService.getJobById('999');

      expect(result).toBeNull();
      expect(mockJobRepository.findById).toHaveBeenCalledWith('999');
    });
  });

  describe('getJobs', () => {
    it('should return paginated jobs with default parameters', async () => {
      const mockJobs = [createMockJob(), createMockJob({ id: '2', title: 'Vue Developer' })];
      mockJobRepository.count.mockResolvedValue(2);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);

      const result = await jobService.getJobs();

      expect(result.jobs).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(20);
      expect(result.pagination.totalItems).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should apply filters correctly', async () => {
      const filters: JobFiltersDTO = {
        isRemote: true,
        minSalary: 50,
        technologies: ['React'],
      };

      mockJobRepository.count.mockResolvedValue(5);
      mockJobRepository.findAll.mockResolvedValue([createMockJob()]);

      await jobService.getJobs(filters, 1, 20);

      expect(mockJobRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          isRemote: true,
          minSalary: 50,
          technologies: ['React'],
        }),
        1,
        20
      );
    });

    it('should validate and cap page size to 100', async () => {
      mockJobRepository.count.mockResolvedValue(0);
      mockJobRepository.findAll.mockResolvedValue([]);

      await jobService.getJobs({}, 1, 200);

      expect(mockJobRepository.findAll).toHaveBeenCalledWith(expect.anything(), 1, 100);
    });

    it('should ensure page number is at least 1', async () => {
      mockJobRepository.count.mockResolvedValue(0);
      mockJobRepository.findAll.mockResolvedValue([]);

      await jobService.getJobs({}, -5, 20);

      expect(mockJobRepository.findAll).toHaveBeenCalledWith(expect.anything(), 1, 20);
    });

    it('should calculate pagination metadata correctly', async () => {
      mockJobRepository.count.mockResolvedValue(45);
      mockJobRepository.findAll.mockResolvedValue([createMockJob()]);

      const result = await jobService.getJobs({}, 2, 20);

      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrevious).toBe(true);
    });
  });

  describe('getRecentJobs', () => {
    it('should return recent jobs with default threshold', async () => {
      const mockJobs = [createMockJob()];
      mockJobRepository.findAll.mockResolvedValue(mockJobs);

      const result = await jobService.getRecentJobs();

      expect(result).toHaveLength(1);
      expect(mockJobRepository.findAll).toHaveBeenCalledWith(
        { recentDays: JOB_CONFIG.RECENT_DAYS_THRESHOLD },
        1,
        10000
      );
    });

    it('should accept custom days parameter', async () => {
      mockJobRepository.findAll.mockResolvedValue([]);

      await jobService.getRecentJobs(14);

      expect(mockJobRepository.findAll).toHaveBeenCalledWith({ recentDays: 14 }, 1, 10000);
    });
  });

  describe('getJobSummaries', () => {
    it('should return lightweight job summaries', async () => {
      const mockJobs = [createMockJob()];
      mockJobRepository.count.mockResolvedValue(1);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);

      const result = await jobService.getJobSummaries();

      expect(result.jobs).toHaveLength(1);
      expect(result.totalItems).toBe(1);
      expect(result.jobs[0]).toHaveProperty('id');
      expect(result.jobs[0]).toHaveProperty('title');
      expect(result.jobs[0]).not.toHaveProperty('description');
    });
  });

  describe('getJobsByCompany', () => {
    it('should filter jobs by company name', async () => {
      const mockJobs = [createMockJob({ company: 'TechCorp' })];
      mockJobRepository.findAll.mockResolvedValue(mockJobs);

      const result = await jobService.getJobsByCompany('TechCorp');

      expect(result).toHaveLength(1);
      expect(result[0].company).toBe('TechCorp');
      expect(mockJobRepository.findAll).toHaveBeenCalledWith(
        { company: 'TechCorp', isActive: true },
        1,
        1000
      );
    });

    it('should filter for active jobs only by default', async () => {
      mockJobRepository.findAll.mockResolvedValue([]);

      await jobService.getJobsByCompany('TechCorp');

      expect(mockJobRepository.findAll).toHaveBeenCalledWith(
        { company: 'TechCorp', isActive: true },
        1,
        1000
      );
    });

    it('should include inactive jobs when specified', async () => {
      mockJobRepository.findAll.mockResolvedValue([]);

      await jobService.getJobsByCompany('TechCorp', false);

      // FIX: When activeOnly is false, isActive should be set to false, not omitted
      expect(mockJobRepository.findAll).toHaveBeenCalledWith(
        { company: 'TechCorp', isActive: false },
        1,
        1000
      );
    });
  });

  describe('getJobsByTechnology', () => {
    it('should return paginated jobs for a technology', async () => {
      const mockJobs = [createMockJob()];
      mockJobRepository.count.mockResolvedValue(1);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);

      const result = await jobService.getJobsByTechnology('React');

      expect(result.jobs).toHaveLength(1);
      expect(result.pagination.totalItems).toBe(1);
      expect(mockJobRepository.findAll).toHaveBeenCalledWith({ technologies: ['React'] }, 1, 20);
    });

    it('should handle manual pagination', async () => {
      const mockJobs = Array.from({ length: 25 }, (_, i) => createMockJob({ id: String(i + 1) }));
      mockJobRepository.count.mockResolvedValue(25);
      mockJobRepository.findAll.mockResolvedValue(mockJobs.slice(10, 20));

      const result = await jobService.getJobsByTechnology('React', 2, 10);

      expect(result.jobs).toHaveLength(10);
      expect(result.pagination.totalPages).toBe(3);
    });
  });

  describe('getJobsByRegion', () => {
    it('should return jobs for a specific region', async () => {
      const mockJobs = [createMockJob({ regionId: 11 })];
      mockJobRepository.count.mockResolvedValue(1);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);

      const result = await jobService.getJobsByRegion(11);

      expect(result.jobs).toHaveLength(1);
      expect(mockJobRepository.findAll).toHaveBeenCalledWith({ regionIds: [11] }, 1, 20);
    });
  });

  describe('getRemoteJobs', () => {
    it('should return only remote jobs', async () => {
      mockJobRepository.count.mockResolvedValue(1);
      mockJobRepository.findAll.mockResolvedValue([createMockJob({ isRemote: true })]);

      const result = await jobService.getRemoteJobs();

      expect(result.jobs).toHaveLength(1);
      expect(mockJobRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ isRemote: true }),
        1,
        20
      );
    });
  });

  describe('getCompetitiveSalaryJobs', () => {
    it('should return jobs with salaries above threshold', async () => {
      mockJobRepository.count.mockResolvedValue(1);
      mockJobRepository.findAll.mockResolvedValue([createMockJob()]);

      await jobService.getCompetitiveSalaryJobs();

      expect(mockJobRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ minSalary: JOB_CONFIG.MID_SALARY_THRESHOLD }),
        1,
        20
      );
    });

    it('should accept custom salary threshold', async () => {
      mockJobRepository.count.mockResolvedValue(0);
      mockJobRepository.findAll.mockResolvedValue([]);

      await jobService.getCompetitiveSalaryJobs(70);

      expect(mockJobRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ minSalary: 70 }),
        1,
        20
      );
    });
  });

  describe('getJobsByExperience', () => {
    it('should return jobs for specific experience category', async () => {
      mockJobRepository.count.mockResolvedValue(1);
      mockJobRepository.findAll.mockResolvedValue([createMockJob()]);

      await jobService.getJobsByExperience('senior');

      expect(mockJobRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ experienceCategories: ['senior'] }),
        1,
        20
      );
    });
  });

  describe('deactivateJob', () => {
    it('should deactivate an existing job', async () => {
      const mockJob = createMockJob();
      mockJobRepository.findById.mockResolvedValue(mockJob);
      mockJobRepository.save.mockResolvedValue(undefined);

      await jobService.deactivateJob('1');

      expect(mockJob.isActive).toBe(false);
      expect(mockJobRepository.save).toHaveBeenCalledWith(mockJob);
    });

    it('should throw error when job not found', async () => {
      mockJobRepository.findById.mockResolvedValue(null);

      await expect(jobService.deactivateJob('999')).rejects.toThrow('Job not found: 999');
    });
  });

  describe('reactivateJob', () => {
    it('should reactivate a recent job', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);
      const mockJob = createMockJob({ postedDate: recentDate, isActive: false });

      mockJobRepository.findById.mockResolvedValue(mockJob);
      mockJobRepository.save.mockResolvedValue(undefined);

      await jobService.reactivateJob('1');

      expect(mockJob.isActive).toBe(true);
      expect(mockJobRepository.save).toHaveBeenCalledWith(mockJob);
    });

    it('should throw error when job not found', async () => {
      mockJobRepository.findById.mockResolvedValue(null);

      await expect(jobService.reactivateJob('999')).rejects.toThrow('Job not found: 999');
    });

    it('should throw error when trying to reactivate expired job', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      const expiredJob = createMockJob({ postedDate: oldDate, isActive: false });

      mockJobRepository.findById.mockResolvedValue(expiredJob);

      await expect(jobService.reactivateJob('1')).rejects.toThrow();
    });
  });

  describe('deactivateExpiredJobs', () => {
    it('should deactivate expired jobs with default expiration days', async () => {
      mockJobRepository.deactivateOldJobs.mockResolvedValue(5);

      const result = await jobService.deactivateExpiredJobs();

      expect(result).toBe(5);
      expect(mockJobRepository.deactivateOldJobs).toHaveBeenCalledWith(JOB_CONFIG.EXPIRATION_DAYS);
    });

    it('should accept custom expiration days', async () => {
      mockJobRepository.deactivateOldJobs.mockResolvedValue(3);

      const result = await jobService.deactivateExpiredJobs(60);

      expect(result).toBe(3);
      expect(mockJobRepository.deactivateOldJobs).toHaveBeenCalledWith(60);
    });
  });

  describe('getJobsByDateRange', () => {
    it('should return jobs within date range', async () => {
      const startDate = new Date('2024-10-01');
      const endDate = new Date('2024-10-31');

      mockJobRepository.count.mockResolvedValue(1);
      mockJobRepository.findAll.mockResolvedValue([createMockJob()]);

      const result = await jobService.getJobsByDateRange(startDate, endDate);

      expect(result.jobs).toHaveLength(1);
      expect(mockJobRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          postedAfter: startDate,
          postedBefore: endDate,
        }),
        1,
        20
      );
    });
  });

  describe('getHighQualityJobs', () => {
    it('should return jobs with quality score above threshold', async () => {
      mockJobRepository.count.mockResolvedValue(1);
      mockJobRepository.findAll.mockResolvedValue([createMockJob()]);

      await jobService.getHighQualityJobs(70);

      expect(mockJobRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ minQualityScore: 70 }),
        1,
        20
      );
    });

    it('should use default quality threshold of 70', async () => {
      mockJobRepository.count.mockResolvedValue(0);
      mockJobRepository.findAll.mockResolvedValue([]);

      await jobService.getHighQualityJobs();

      expect(mockJobRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ minQualityScore: 70 }),
        1,
        20
      );
    });
  });

  describe('getJobsBySource', () => {
    it('should return jobs from specific source API', async () => {
      mockJobRepository.count.mockResolvedValue(1);
      mockJobRepository.findAll.mockResolvedValue([createMockJob()]);

      await jobService.getJobsBySource('linkedin');

      expect(mockJobRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ sourceApis: ['linkedin'] }),
        1,
        20
      );
    });
  });

  describe('getMultiSourceJobs', () => {
    it('should return only jobs from multiple sources', async () => {
      const multiSourceJob = createMockJob({ sourceApis: ['linkedin', 'indeed'] });
      const singleSourceJob = createMockJob({ id: '2', sourceApis: ['linkedin'] });

      mockJobRepository.findAll.mockResolvedValue([multiSourceJob, singleSourceJob]);

      const result = await jobService.getMultiSourceJobs();

      expect(result).toHaveLength(1);
      expect(result[0].sourceApis).toHaveLength(2);
    });
  });

  describe('getJobStats', () => {
    it('should return comprehensive job statistics', async () => {
      const mockJob = createMockJob();
      mockJobRepository.findById.mockResolvedValue(mockJob);

      const result = await jobService.getJobStats('1');

      expect(result).not.toBeNull();
      expect(result?.job.id).toBe('1');
      expect(result).toHaveProperty('qualityScore');
      expect(result).toHaveProperty('isRecent');
      expect(result).toHaveProperty('isExpired');
      expect(result).toHaveProperty('ageDays');
      expect(result).toHaveProperty('hasCompetitiveSalary');
      expect(result).toHaveProperty('isSeniorLevel');
      expect(result).toHaveProperty('meetsQualityStandards');
    });

    it('should return null when job not found', async () => {
      mockJobRepository.findById.mockResolvedValue(null);

      const result = await jobService.getJobStats('999');

      expect(result).toBeNull();
    });
  });

  describe('getJobCount', () => {
    it('should return job count with no filters', async () => {
      mockJobRepository.count.mockResolvedValue(42);

      const result = await jobService.getJobCount();

      expect(result).toBe(42);
    });

    it('should return job count with filters', async () => {
      mockJobRepository.count.mockResolvedValue(15);

      const result = await jobService.getJobCount({ isRemote: true });

      expect(result).toBe(15);
    });
  });

  describe('Filter Conversion', () => {
    it('should convert region IDs filter', async () => {
      const filters: JobFiltersDTO = { regionIds: [11, 12] };
      mockJobRepository.count.mockResolvedValue(0);
      mockJobRepository.findAll.mockResolvedValue([]);

      await jobService.getJobs(filters);

      expect(mockJobRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ regionIds: [11, 12] }),
        expect.anything(),
        expect.anything()
      );
    });

    it('should convert experience categories filter', async () => {
      const filters: JobFiltersDTO = { experienceCategories: ['senior', 'lead'] };
      mockJobRepository.count.mockResolvedValue(0);
      mockJobRepository.findAll.mockResolvedValue([]);

      await jobService.getJobs(filters);

      expect(mockJobRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ experienceCategories: ['senior', 'lead'] }),
        expect.anything(),
        expect.anything()
      );
    });

    it('should convert date string to Date object', async () => {
      const filters: JobFiltersDTO = { postedAfter: '2024-10-01T00:00:00.000Z' };
      mockJobRepository.count.mockResolvedValue(0);
      mockJobRepository.findAll.mockResolvedValue([]);

      await jobService.getJobs(filters);

      expect(mockJobRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          postedAfter: expect.any(Date),
        }),
        expect.anything(),
        expect.anything()
      );
    });

    it('should handle both isActive and activeOnly', async () => {
      mockJobRepository.count.mockResolvedValue(0);
      mockJobRepository.findAll.mockResolvedValue([]);

      await jobService.getJobs({ activeOnly: true });

      expect(mockJobRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
        expect.anything(),
        expect.anything()
      );
    });

    it('should handle both searchQuery and searchTerm', async () => {
      mockJobRepository.count.mockResolvedValue(0);
      mockJobRepository.findAll.mockResolvedValue([]);

      await jobService.getJobs({ searchTerm: 'developer' });

      expect(mockJobRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ searchQuery: 'developer' }),
        expect.anything(),
        expect.anything()
      );
    });
  });
});
