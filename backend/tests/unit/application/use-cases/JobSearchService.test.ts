import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { JobSearchService } from '../../../../src/application/use-cases/JobSearchService';
import { IJobRepository } from '../../../../src/domain/repositories/IJobRepository';
import { Job } from '../../../../src/domain/entities/Job';
import { JobFiltersDTO } from '../../../../src/application/dtos/JobDTO';

describe('JobSearchService', () => {
  let service: JobSearchService;
  let mockRepository: jest.Mocked<IJobRepository>;

  const createJob = (overrides: Partial<any> = {}) => {
    const defaults = {
      id: '1',
      title: 'React Developer',
      company: 'TechCorp',
      description: 'Build React apps with modern tools and frameworks',
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
      data.isActive
    );
  };

  beforeEach(() => {
    mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      saveMany: jest.fn(),
      deactivateOldJobs: jest.fn(),
    } as unknown as jest.Mocked<IJobRepository>;

    service = new JobSearchService(mockRepository);
  });

  describe('searchJobs', () => {
    it('should search jobs using repository filters', async () => {
      const jobs = [
        createJob({
          id: '1',
          title: 'React Developer',
          company: 'TechCorp',
          technologies: ['React', 'TypeScript'],
        }),
        createJob({
          id: '2',
          title: 'Vue Developer',
          company: 'WebCo',
          technologies: ['Vue', 'JavaScript'],
          description: 'Build modern Vue applications',
        }),
      ];

      mockRepository.count.mockResolvedValue(2);
      mockRepository.findAll.mockResolvedValue(jobs);

      const result = await service.searchJobs('React', {}, 1, 20);

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          searchQuery: 'React',
        }),
        1,
        20
      );
      expect(result.jobs.length).toBe(2);
      expect(result.pagination.totalItems).toBe(2);
    });

    it('should apply filters along with text search', async () => {
      const jobs = [createJob({ id: '1', title: 'React Developer', isRemote: true })];

      mockRepository.count.mockResolvedValue(1);
      mockRepository.findAll.mockResolvedValue(jobs);

      const filters: JobFiltersDTO = { isRemote: true };
      await service.searchJobs('React', filters, 1, 20);

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          isRemote: true,
          searchQuery: 'React',
        }),
        1,
        20
      );
    });

    it('should handle pagination correctly', async () => {
      const jobs = Array.from({ length: 50 }, (_, i) =>
        createJob({ id: `${i}`, title: 'React Developer' })
      );

      mockRepository.count.mockResolvedValue(50);
      mockRepository.findAll.mockResolvedValueOnce(jobs.slice(0, 20));
      mockRepository.findAll.mockResolvedValueOnce(jobs.slice(20, 40));

      const page1 = await service.searchJobs('React', {}, 1, 20);
      const page2 = await service.searchJobs('React', {}, 2, 20);

      expect(page1.jobs).toHaveLength(20);
      expect(page2.jobs).toHaveLength(20);
      expect(page1.pagination.totalPages).toBe(3);
    });
  });

  describe('advancedSearch', () => {
    it('should search with required technologies', async () => {
      const jobs = [
        createJob({ id: '1', technologies: ['React', 'TypeScript', 'Node.js'] }),
        createJob({ id: '2', technologies: ['React', 'JavaScript'] }),
        createJob({ id: '3', technologies: ['Vue', 'TypeScript'] }),
      ];

      mockRepository.findAll.mockResolvedValue(jobs);

      const result = await service.advancedSearch({
        requiredTechnologies: ['React', 'TypeScript'],
      });

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          technologies: ['React', 'TypeScript'],
        }),
        1,
        10000
      );
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should score jobs based on preferred technologies', async () => {
      const jobs = [
        createJob({ id: '1', technologies: ['React', 'TypeScript', 'Node.js'] }),
        createJob({ id: '2', technologies: ['React'] }),
        createJob({ id: '3', technologies: ['TypeScript'] }),
      ];

      mockRepository.findAll.mockResolvedValue(jobs);

      const result = await service.advancedSearch({
        preferredTechnologies: ['React', 'TypeScript', 'Node.js'],
      });

      expect(result.results[0].job.id).toBe('1');
      expect(result.results[0].relevanceScore).toBeGreaterThan(result.results[1].relevanceScore);
    });

    it('should exclude specified companies', async () => {
      const jobs = [
        createJob({ id: '1', company: 'TechCorp' }),
        createJob({ id: '2', company: 'ExcludedCo' }),
        createJob({ id: '3', company: 'GoodCo' }),
      ];

      mockRepository.findAll.mockResolvedValue(jobs);

      const result = await service.advancedSearch({
        excludedCompanies: ['ExcludedCo'],
      });

      expect(result.results).toHaveLength(2);
      expect(result.results.find(r => r.job.company === 'ExcludedCo')).toBeUndefined();
    });

    it('should boost scores for preferred companies', async () => {
      const jobs = [
        createJob({ id: '1', company: 'PreferredCorp' }),
        createJob({ id: '2', company: 'OtherCorp' }),
      ];

      mockRepository.findAll.mockResolvedValue(jobs);

      const result = await service.advancedSearch({
        preferredCompanies: ['PreferredCorp'],
      });

      expect(result.results[0].job.company).toBe('PreferredCorp');
      expect(result.results[0].matchReasons).toContain('Preferred company');
    });

    it('should filter by experience level', async () => {
      mockRepository.findAll.mockResolvedValue([
        createJob({ id: '1', experienceCategory: 'senior' }),
      ]);

      await service.advancedSearch({
        experienceCategories: ['senior'],
      });

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          experienceCategories: ['senior'],
        }),
        1,
        10000
      );
    });

    it('should filter by salary range', async () => {
      const jobs = [
        createJob({ id: '1', salaryMinKEuros: 60, salaryMaxKEuros: 80 }),
        createJob({ id: '2', salaryMinKEuros: 40, salaryMaxKEuros: 50 }),
      ];

      mockRepository.findAll.mockResolvedValue(jobs);

      const result = await service.advancedSearch({
        minSalary: 50,
      });

      expect(
        result.results[0].matchReasons.some(reason => reason.includes('Salary meets minimum'))
      ).toBe(true);
    });

    it('should handle remote preference', async () => {
      mockRepository.findAll.mockResolvedValue([createJob({ id: '1', isRemote: true })]);

      await service.advancedSearch({
        remoteOnly: true,
      });

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ isRemote: true }),
        1,
        10000
      );
    });

    it('should boost recent jobs when preferRecent is true', async () => {
      const jobs = [
        createJob({ id: '1', postedDate: new Date() }),
        createJob({
          id: '2',
          postedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        }),
      ];

      mockRepository.findAll.mockResolvedValue(jobs);

      const result = await service.advancedSearch({
        preferRecent: true,
      });

      expect(result.results[0].matchReasons).toContain('Recently posted');
    });

    it('should calculate average relevance score', async () => {
      const jobs = [
        createJob({ id: '1', technologies: ['React', 'TypeScript'] }),
        createJob({ id: '2', technologies: ['React'] }),
      ];

      mockRepository.findAll.mockResolvedValue(jobs);

      const result = await service.advancedSearch({
        preferredTechnologies: ['React', 'TypeScript'],
      });

      expect(result.averageRelevanceScore).toBeGreaterThan(0);
      expect(result.averageRelevanceScore).toBeLessThanOrEqual(100);
    });

    it('should use custom weights when provided', async () => {
      const jobs = [createJob({ id: '1', technologies: ['React'], experienceCategory: 'senior' })];

      mockRepository.findAll.mockResolvedValue(jobs);

      const result = await service.advancedSearch({
        preferredTechnologies: ['React'],
        experienceCategories: ['senior'],
        weights: {
          technologyMatch: 80,
          experienceMatch: 20,
        },
      });

      expect(result.results).toHaveLength(1);
    });

    it('should return match reasons for transparency', async () => {
      const jobs = [
        createJob({
          id: '1',
          technologies: ['React', 'TypeScript'],
          experienceCategory: 'senior',
          isRemote: true,
        }),
      ];

      mockRepository.findAll.mockResolvedValue(jobs);

      const result = await service.advancedSearch({
        preferredTechnologies: ['React', 'TypeScript'],
        experienceCategories: ['senior'],
        remotePreferred: true,
      });

      expect(result.results[0].matchReasons.length).toBeGreaterThan(0);
      expect(
        result.results[0].matchReasons.some(reason => reason.toLowerCase().includes('technolog'))
      ).toBe(true);
    });
  });

  describe('getSimilarJobs', () => {
    it('should find similar jobs', async () => {
      const targetJob = createJob({
        id: '1',
        title: 'React Developer',
        technologies: ['React', 'TypeScript'],
      });

      const similarJob = createJob({
        id: '2',
        title: 'React Engineer',
        technologies: ['React', 'JavaScript'],
      });

      const differentJob = createJob({
        id: '3',
        title: 'Python Developer',
        technologies: ['Python', 'Django'],
      });

      mockRepository.findById.mockResolvedValue(targetJob);
      mockRepository.findAll.mockResolvedValue([similarJob, differentJob]);

      const result = await service.getSimilarJobs('1', 10);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].id).toBe('2');
    });

    it('should exclude the original job from results', async () => {
      const targetJob = createJob({ id: '1' });

      mockRepository.findById.mockResolvedValue(targetJob);
      mockRepository.findAll.mockResolvedValue([targetJob]);

      const result = await service.getSimilarJobs('1', 10);

      expect(result).toHaveLength(0);
    });

    it('should exclude same company when requested', async () => {
      const targetJob = createJob({ id: '1', company: 'TechCorp' });
      const sameCompanyJob = createJob({ id: '2', company: 'TechCorp', title: 'Similar Job' });
      const differentCompanyJob = createJob({ id: '3', company: 'OtherCorp' });

      mockRepository.findById.mockResolvedValue(targetJob);
      mockRepository.findAll.mockResolvedValue([sameCompanyJob, differentCompanyJob]);

      const result = await service.getSimilarJobs('1', 10, true);

      expect(result.find(j => j.id === '2')).toBeUndefined();
      expect(result.find(j => j.id === '3')).toBeDefined();
    });

    it('should limit results to specified count', async () => {
      const targetJob = createJob({ id: '1' });
      const similarJobs = Array.from({ length: 20 }, (_, i) =>
        createJob({ id: `${i + 2}`, title: 'Similar Job' })
      );

      mockRepository.findById.mockResolvedValue(targetJob);
      mockRepository.findAll.mockResolvedValue(similarJobs);

      const result = await service.getSimilarJobs('1', 5);

      expect(result).toHaveLength(5);
    });

    it('should throw error for non-existent job', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getSimilarJobs('nonexistent')).rejects.toThrow('Job not found');
    });
  });

  describe('searchByTechnologyStack', () => {
    it('should find jobs matching entire tech stack', async () => {
      const jobs = [
        createJob({ id: '1', technologies: ['React', 'TypeScript', 'Node.js'] }),
        createJob({ id: '2', technologies: ['React', 'TypeScript'] }),
        createJob({ id: '3', technologies: ['React'] }),
      ];

      mockRepository.count.mockResolvedValue(2);
      mockRepository.findAll.mockResolvedValue(jobs);

      const result = await service.searchByTechnologyStack(['React', 'TypeScript']);

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          technologies: ['React', 'TypeScript'],
        }),
        1,
        20
      );
      expect(result.jobs.length).toBeGreaterThan(0);
    });

    it('should handle empty tech stack', async () => {
      mockRepository.count.mockResolvedValue(0);
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.searchByTechnologyStack([]);

      expect(result.jobs).toHaveLength(0);
    });
  });

  describe('searchByAnyTechnology', () => {
    it('should find jobs with any of the technologies', async () => {
      const jobs = [
        createJob({ id: '1', technologies: ['React'] }),
        createJob({ id: '2', technologies: ['Vue'] }),
        createJob({ id: '3', technologies: ['Angular'] }),
        createJob({ id: '4', technologies: ['Python'] }),
      ];

      mockRepository.findAll.mockResolvedValue(jobs);

      const result = await service.searchByAnyTechnology(['React', 'Vue']);

      expect(result.jobs).toHaveLength(2);
      expect(result.jobs.map(j => j.id)).toContain('1');
      expect(result.jobs.map(j => j.id)).toContain('2');
    });

    it('should sort by number of matching technologies', async () => {
      const jobs = [
        createJob({ id: '1', technologies: ['React'] }),
        createJob({ id: '2', technologies: ['React', 'TypeScript'] }),
        createJob({ id: '3', technologies: ['React', 'TypeScript', 'Node.js'] }),
      ];

      mockRepository.findAll.mockResolvedValue(jobs);

      const result = await service.searchByAnyTechnology(['React', 'TypeScript', 'Node.js']);

      expect(result.jobs[0].id).toBe('3');
      expect(result.jobs[1].id).toBe('2');
      expect(result.jobs[2].id).toBe('1');
    });
  });

  describe('getRecommendedJobs', () => {
    it('should recommend jobs based on user preferences', async () => {
      const jobs = [
        createJob({
          id: '1',
          technologies: ['React', 'TypeScript'],
          experienceCategory: 'mid',
        }),
        createJob({
          id: '2',
          technologies: ['Python'],
          experienceCategory: 'senior',
        }),
      ];

      mockRepository.findAll.mockResolvedValue(jobs);

      const result = await service.getRecommendedJobs({
        technologies: ['React', 'TypeScript'],
        experienceLevel: 'mid',
      });

      expect(result).toHaveLength(2);
      expect(result[0].job.technologies).toContain('React');
    });

    it('should handle remote preference requirements', async () => {
      mockRepository.findAll.mockResolvedValue([createJob({ id: '1', isRemote: true })]);

      await service.getRecommendedJobs({
        technologies: ['React'],
        remotePreference: 'required',
      });

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ isRemote: true }),
        1,
        10000
      );
    });

    it('should only recommend quality jobs', async () => {
      const jobs = [createJob({ id: '1', technologies: ['React'] })];

      mockRepository.findAll.mockResolvedValue(jobs);

      await service.getRecommendedJobs({
        technologies: ['React'],
      });

      expect(mockRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('smartSearch', () => {
    it('should extract technologies from natural language', async () => {
      const jobs = [createJob({ id: '1', title: 'Developer', technologies: ['React', 'Node.js'] })];

      mockRepository.count.mockResolvedValue(1);
      mockRepository.findAll.mockResolvedValue(jobs);

      await service.smartSearch('Looking for react and node developer');

      expect(mockRepository.findAll).toHaveBeenCalled();
    });

    it('should extract experience level from query', async () => {
      mockRepository.count.mockResolvedValue(0);
      mockRepository.findAll.mockResolvedValue([]);

      await service.smartSearch('senior developer position');

      expect(mockRepository.findAll).toHaveBeenCalled();
    });

    it('should detect remote preference', async () => {
      mockRepository.count.mockResolvedValue(0);
      mockRepository.findAll.mockResolvedValue([]);

      await service.smartSearch('remote developer job');

      expect(mockRepository.findAll).toHaveBeenCalled();
    });

    it('should extract salary from query', async () => {
      mockRepository.count.mockResolvedValue(0);
      mockRepository.findAll.mockResolvedValue([]);

      await service.smartSearch('developer job 60k minimum');

      expect(mockRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('getCompaniesHiringMultiple', () => {
    it('should group jobs by company', async () => {
      const jobs = [
        createJob({ id: '1', company: 'TechCorp' }),
        createJob({ id: '2', company: 'TechCorp' }),
        createJob({ id: '3', company: 'TechCorp' }),
        createJob({ id: '4', company: 'StartupXYZ' }),
        createJob({ id: '5', company: 'StartupXYZ' }),
      ];

      mockRepository.findAll.mockResolvedValue(jobs);

      const result = await service.getCompaniesHiringMultiple(2);

      expect(result).toHaveLength(2);
      expect(result[0].company).toBe('TechCorp');
      expect(result[0].jobCount).toBe(3);
    });

    it('should filter companies by minimum job count', async () => {
      const jobs = [
        createJob({ id: '1', company: 'BigCorp' }),
        createJob({ id: '2', company: 'BigCorp' }),
        createJob({ id: '3', company: 'BigCorp' }),
        createJob({ id: '4', company: 'SmallCo' }),
      ];

      mockRepository.findAll.mockResolvedValue(jobs);

      const result = await service.getCompaniesHiringMultiple(3);

      expect(result).toHaveLength(1);
      expect(result[0].company).toBe('BigCorp');
    });

    it('should sort by job count descending', async () => {
      const jobs = [
        createJob({ id: '1', company: 'CompanyA' }),
        createJob({ id: '2', company: 'CompanyA' }),
        createJob({ id: '3', company: 'CompanyB' }),
        createJob({ id: '4', company: 'CompanyB' }),
        createJob({ id: '5', company: 'CompanyB' }),
      ];

      mockRepository.findAll.mockResolvedValue(jobs);

      const result = await service.getCompaniesHiringMultiple(2);

      expect(result[0].company).toBe('CompanyB');
      expect(result[0].jobCount).toBe(3);
    });

    it('should handle pagination', async () => {
      const jobs = Array.from({ length: 50 }, (_, i) =>
        createJob({ id: `${i}`, company: `Company${i}` })
      );

      mockRepository.findAll.mockResolvedValue(jobs);

      const page1 = await service.getCompaniesHiringMultiple(1, 1, 10);
      const page2 = await service.getCompaniesHiringMultiple(1, 2, 10);

      expect(page1).toHaveLength(10);
      expect(page2).toHaveLength(10);
    });
  });

  describe('compareJobs', () => {
    it('should compare two jobs and return analysis', async () => {
      const job1 = createJob({
        id: '1',
        title: 'React Developer',
        company: 'TechCorp',
      });

      const job2 = createJob({
        id: '2',
        title: 'React Engineer',
        company: 'TechCorp',
      });

      mockRepository.findById.mockImplementation(async id => {
        return id === '1' ? job1 : job2;
      });

      const result = await service.compareJobs('1', '2');

      expect(result.job1.id).toBe('1');
      expect(result.job2.id).toBe('2');
      expect(result.similarityAnalysis).toBeDefined();
      expect(result.similarityAnalysis.overallSimilarity).toBeGreaterThanOrEqual(0);
      expect(result.similarityAnalysis.overallSimilarity).toBeLessThanOrEqual(1);
    });

    it('should throw error when first job not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.compareJobs('1', '2')).rejects.toThrow('not found');
    });

    it('should throw error when second job not found', async () => {
      const job1 = createJob({ id: '1' });

      mockRepository.findById.mockImplementation(async id => {
        return id === '1' ? job1 : null;
      });

      await expect(service.compareJobs('1', '2')).rejects.toThrow('not found');
    });
  });

  describe('compareMultipleJobs', () => {
    it('should compare multiple jobs', async () => {
      const job1 = createJob({ id: '1', technologies: ['React', 'TypeScript'] });
      const job2 = createJob({ id: '2', technologies: ['React', 'Vue'] });
      const job3 = createJob({ id: '3', technologies: ['Python', 'Django'] });

      mockRepository.findById.mockImplementation(async id => {
        if (id === '1') return job1;
        if (id === '2') return job2;
        if (id === '3') return job3;
        return null;
      });

      const result = await service.compareMultipleJobs(['1', '2', '3']);

      expect(result.jobs).toHaveLength(3);
      expect(result.similarities.length).toBeGreaterThan(0);
    });

    it('should calculate common technologies', async () => {
      const job1 = createJob({ id: '1', technologies: ['React', 'TypeScript'] });
      const job2 = createJob({ id: '2', technologies: ['React', 'Vue'] });

      mockRepository.findById.mockImplementation(async id => {
        if (id === '1') return job1;
        if (id === '2') return job2;
        return null;
      });

      const result = await service.compareMultipleJobs(['1', '2']);

      expect(result.similarities[0].commonTechnologies).toContain('React');
    });

    it('should throw error with less than 2 valid jobs', async () => {
      mockRepository.findById.mockResolvedValue(createJob({ id: '1' }));

      await expect(service.compareMultipleJobs(['1'])).rejects.toThrow(
        'At least 2 valid jobs required'
      );
    });
  });
});
