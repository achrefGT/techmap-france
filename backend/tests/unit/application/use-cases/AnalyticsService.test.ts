import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AnalyticsService } from '../../../../src/application/use-cases/AnalyticsService';
import { IJobRepository } from '../../../../src/domain/repositories/IJobRepository';
import { ITechnologyRepository } from '../../../../src/domain/repositories/ITechnologyRepository';
import { IRegionRepository } from '../../../../src/domain/repositories/IRegionRepository';
import { TrendAnalysisService } from '../../../../src/domain/services/TrendAnalysisService';
import { Job } from '../../../../src/domain/entities/Job';
import { Technology } from '../../../../src/domain/entities/Technology';
import { Region } from '../../../../src/domain/entities/Region';

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let mockJobRepository: jest.Mocked<IJobRepository>;
  let mockTechnologyRepository: jest.Mocked<ITechnologyRepository>;
  let mockRegionRepository: jest.Mocked<IRegionRepository>;
  let mockTrendService: jest.Mocked<TrendAnalysisService>;

  const createMockJob = (overrides: Partial<any> = {}): Job => {
    const defaults = {
      id: '1',
      title: 'React Developer',
      company: 'TechCorp',
      description: 'Build React applications with modern tools',
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

  const createMockTechnology = (id: number, name: string): Technology => {
    return new Technology(id, name, 'frontend', 'Test description');
  };

  const createMockRegion = (id: number, code: string, name: string): Region => {
    return new Region(id, code, name, `Full ${name}`);
  };

  beforeEach(() => {
    // Create mock repositories
    mockJobRepository = {
      count: jest.fn(),
      findRecent: jest.fn(),
      findAll: jest.fn(),
      findByTechnology: jest.fn(),
      findByRegion: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
    } as any;

    mockTechnologyRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockRegionRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockTrendService = {
      getRisingTechnologies: jest.fn(),
      getDecliningTechnologies: jest.fn(),
      getStableTechnologies: jest.fn(),
      predictDemand: jest.fn(),
      updateConfig: jest.fn(),
      getConfig: jest.fn(),
    } as any;

    analyticsService = new AnalyticsService(
      mockJobRepository,
      mockTechnologyRepository,
      mockRegionRepository,
      mockTrendService
    );
  });

  describe('getDashboardStats', () => {
    it('should return complete dashboard statistics', async () => {
      const mockJobs = [
        createMockJob({ id: '1', company: 'TechCorp' }),
        createMockJob({ id: '2', company: 'DevCo', isRemote: true }),
        createMockJob({ id: '3', company: 'TechCorp' }),
      ];

      const mockTechnologies = [
        createMockTechnology(1, 'React'),
        createMockTechnology(2, 'TypeScript'),
      ];

      const mockRegions = [
        createMockRegion(11, 'Paris', 'IDF'),
        createMockRegion(12, 'Lyon', 'ARA'),
      ];

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3);
      const recentJobs = [createMockJob({ postedDate: recentDate })];

      mockJobRepository.count.mockResolvedValueOnce(100); // total jobs
      mockJobRepository.count.mockResolvedValueOnce(85); // active jobs
      mockJobRepository.findRecent.mockResolvedValue(recentJobs);
      mockTechnologyRepository.findAll.mockResolvedValue(mockTechnologies);
      mockRegionRepository.findAll.mockResolvedValue(mockRegions);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);

      const result = await analyticsService.getDashboardStats();

      expect(result).toMatchObject({
        totalJobs: 100,
        activeJobs: 85,
        recentJobs: 1,
        totalTechnologies: 2,
        totalRegions: 2,
        totalCompanies: 2,
      });
      expect(result.averageQualityScore).toBeGreaterThan(0);
      expect(result.jobsWithSalary).toBe(3);
      expect(result.remoteJobsPercentage).toBeGreaterThan(0);
    });

    it('should handle zero jobs gracefully', async () => {
      mockJobRepository.count.mockResolvedValue(0);
      mockJobRepository.findRecent.mockResolvedValue([]);
      mockTechnologyRepository.findAll.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue([]);
      mockJobRepository.findAll.mockResolvedValue([]);

      const result = await analyticsService.getDashboardStats();

      expect(result.totalJobs).toBe(0);
      expect(result.averageQualityScore).toBe(0);
      expect(result.remoteJobsPercentage).toBe(0);
    });

    it('should calculate remote percentage correctly', async () => {
      const mockJobs = [
        createMockJob({ id: '1', isRemote: true }),
        createMockJob({ id: '2', isRemote: true }),
        createMockJob({ id: '3', isRemote: false }),
        createMockJob({ id: '4', isRemote: false }),
      ];

      mockJobRepository.count.mockResolvedValueOnce(4);
      mockJobRepository.count.mockResolvedValueOnce(4);
      mockJobRepository.findRecent.mockResolvedValue([]);
      mockTechnologyRepository.findAll.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue([]);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);

      const result = await analyticsService.getDashboardStats();

      expect(result.remoteJobsPercentage).toBe(50);
    });
  });

  describe('getSalaryStats', () => {
    it('should calculate overall salary statistics', async () => {
      const mockJobs = [
        createMockJob({ id: '1', salaryMinKEuros: 40, salaryMaxKEuros: 60 }),
        createMockJob({ id: '2', salaryMinKEuros: 60, salaryMaxKEuros: 80 }),
        createMockJob({ id: '3', salaryMinKEuros: 80, salaryMaxKEuros: 100 }),
      ];

      mockJobRepository.findAll.mockResolvedValue(mockJobs);
      mockTechnologyRepository.findAll.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue([]);

      const result = await analyticsService.getSalaryStats();

      expect(result.overall).toBeDefined();
      expect(result.overall.average).toBeGreaterThan(0);
      expect(result.overall.median).toBeGreaterThan(0);
      expect(result.overall.min).toBeGreaterThan(0);
      expect(result.overall.max).toBeGreaterThan(0);
      expect(result.overall.percentile25).toBeGreaterThan(0);
      expect(result.overall.percentile75).toBeGreaterThan(0);
    });

    it('should calculate salary by experience level', async () => {
      const mockJobs = [
        createMockJob({
          id: '1',
          experienceCategory: 'junior',
          salaryMinKEuros: 35,
          salaryMaxKEuros: 45,
        }),
        createMockJob({
          id: '2',
          experienceCategory: 'mid',
          salaryMinKEuros: 50,
          salaryMaxKEuros: 70,
        }),
        createMockJob({
          id: '3',
          experienceCategory: 'senior',
          salaryMinKEuros: 80,
          salaryMaxKEuros: 100,
        }),
        createMockJob({
          id: '4',
          experienceCategory: 'lead',
          salaryMinKEuros: 100,
          salaryMaxKEuros: 120,
        }),
      ];

      mockJobRepository.findAll.mockResolvedValue(mockJobs);
      mockTechnologyRepository.findAll.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue([]);

      const result = await analyticsService.getSalaryStats();

      expect(result.byExperience.junior.count).toBe(1);
      expect(result.byExperience.mid.count).toBe(1);
      expect(result.byExperience.senior.count).toBe(1);
      expect(result.byExperience.lead.count).toBe(1);
      expect(result.byExperience.lead.average).toBeGreaterThan(result.byExperience.senior.average);
    });

    it('should calculate salary by technology', async () => {
      const reactJobs = [createMockJob({ salaryMinKEuros: 50, salaryMaxKEuros: 70 })];
      const nodeJobs = [createMockJob({ salaryMinKEuros: 60, salaryMaxKEuros: 80 })];

      const mockTechnologies = [
        createMockTechnology(1, 'React'),
        createMockTechnology(2, 'Node.js'),
      ];

      mockJobRepository.findAll.mockResolvedValue([]);
      mockTechnologyRepository.findAll.mockResolvedValue(mockTechnologies);
      mockJobRepository.findByTechnology
        .mockResolvedValueOnce(reactJobs)
        .mockResolvedValueOnce(nodeJobs);
      mockRegionRepository.findAll.mockResolvedValue([]);

      const result = await analyticsService.getSalaryStats();

      expect(result.byTechnology).toHaveLength(2);
      expect(result.byTechnology[0].technologyName).toBe('React');
      expect(result.byTechnology[0].count).toBe(1);
      expect(result.byTechnology[1].technologyName).toBe('Node.js');
    });

    it('should calculate salary by region', async () => {
      const parisJobs = [createMockJob({ regionId: 11, salaryMinKEuros: 60, salaryMaxKEuros: 80 })];
      const lyonJobs = [createMockJob({ regionId: 12, salaryMinKEuros: 50, salaryMaxKEuros: 70 })];

      const mockRegions = [
        createMockRegion(11, 'Paris', 'IDF'),
        createMockRegion(12, 'Lyon', 'ARA'),
      ];

      mockJobRepository.findAll.mockResolvedValue([]);
      mockTechnologyRepository.findAll.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue(mockRegions);
      mockJobRepository.findByRegion
        .mockResolvedValueOnce(parisJobs)
        .mockResolvedValueOnce(lyonJobs);

      const result = await analyticsService.getSalaryStats();

      expect(result.byRegion).toHaveLength(2);
      expect(result.byRegion[0].regionName).toBe('Paris');
      expect(result.byRegion[0].count).toBe(1);
      expect(result.byRegion[1].regionName).toBe('Lyon');
    });

    it('should handle jobs without salary data', async () => {
      const mockJobs = [createMockJob({ salaryMinKEuros: null, salaryMaxKEuros: null })];

      mockJobRepository.findAll.mockResolvedValue(mockJobs);
      mockTechnologyRepository.findAll.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue([]);

      const result = await analyticsService.getSalaryStats();

      expect(result.overall.average).toBe(0);
      expect(result.overall.median).toBe(0);
    });
  });

  describe('getMarketInsights', () => {
    it('should return hot technologies from trend service', async () => {
      const mockTrends = [
        {
          technologyId: 1,
          currentCount: 100,
          previousCount: 50,
          growthRate: 50,
          growthPercentage: 100,
        },
        {
          technologyId: 2,
          currentCount: 80,
          previousCount: 60,
          growthRate: 20,
          growthPercentage: 33.33,
        },
      ];

      mockTrendService.getRisingTechnologies.mockResolvedValue(mockTrends);
      mockTechnologyRepository.findById
        .mockResolvedValueOnce(createMockTechnology(1, 'React'))
        .mockResolvedValueOnce(createMockTechnology(2, 'Vue'));
      mockRegionRepository.findAll.mockResolvedValue([]);
      mockJobRepository.findAll.mockResolvedValue([]);

      const result = await analyticsService.getMarketInsights();

      expect(result.hotTechnologies).toHaveLength(2);
      expect(result.hotTechnologies[0].technologyName).toBe('React');
      expect(result.hotTechnologies[0].jobCount).toBe(100);
      expect(result.hotTechnologies[0].growthRate).toBe(100);
    });

    it('should return top regions by job count', async () => {
      const parisJobs = [
        createMockJob({ id: '1' }),
        createMockJob({ id: '2' }),
        createMockJob({ id: '3' }),
      ];
      const lyonJobs = [createMockJob({ id: '4' })];

      const mockRegions = [
        createMockRegion(11, 'Paris', 'IDF'),
        createMockRegion(12, 'Lyon', 'ARA'),
      ];

      mockTrendService.getRisingTechnologies.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue(mockRegions);
      mockJobRepository.findByRegion
        .mockResolvedValueOnce(parisJobs)
        .mockResolvedValueOnce(lyonJobs);
      mockJobRepository.findAll.mockResolvedValue([]);

      const result = await analyticsService.getMarketInsights();

      expect(result.topRegions).toHaveLength(2);
      expect(result.topRegions[0].regionName).toBe('Paris');
      expect(result.topRegions[0].jobCount).toBe(3);
      expect(result.topRegions[1].regionName).toBe('Lyon');
      expect(result.topRegions[1].jobCount).toBe(1);
    });

    it('should return top companies with statistics', async () => {
      const mockJobs = [
        createMockJob({
          id: '1',
          company: 'TechCorp',
          technologies: ['React', 'TypeScript'],
          salaryMinKEuros: 60,
          salaryMaxKEuros: 80,
        }),
        createMockJob({
          id: '2',
          company: 'TechCorp',
          technologies: ['Node.js'],
          salaryMinKEuros: 70,
          salaryMaxKEuros: 90,
        }),
        createMockJob({
          id: '3',
          company: 'DevCo',
          technologies: ['Python'],
          salaryMinKEuros: 50,
          salaryMaxKEuros: 70,
        }),
      ];

      mockTrendService.getRisingTechnologies.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue([]);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);

      const result = await analyticsService.getMarketInsights();

      expect(result.topCompanies).toHaveLength(2);
      expect(result.topCompanies[0].companyName).toBe('TechCorp');
      expect(result.topCompanies[0].jobCount).toBe(2);
      expect(result.topCompanies[0].averageSalary).toBeGreaterThan(0);
      expect(result.topCompanies[0].topTechnologies.length).toBeGreaterThan(0);
    });

    it('should calculate experience distribution', async () => {
      const mockJobs = [
        createMockJob({ id: '1', experienceCategory: 'junior' }),
        createMockJob({ id: '2', experienceCategory: 'mid' }),
        createMockJob({ id: '3', experienceCategory: 'mid' }),
        createMockJob({ id: '4', experienceCategory: 'senior' }),
      ];

      mockTrendService.getRisingTechnologies.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue([]);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);

      const result = await analyticsService.getMarketInsights();

      expect(result.experienceDistribution.junior).toBe(1);
      expect(result.experienceDistribution.mid).toBe(2);
      expect(result.experienceDistribution.senior).toBe(1);
      expect(result.experienceDistribution.lead).toBe(0);
    });

    it('should calculate remote vs onsite distribution', async () => {
      const mockJobs = [
        createMockJob({ id: '1', isRemote: true }),
        createMockJob({ id: '2', isRemote: true }),
        createMockJob({ id: '3', isRemote: false }),
      ];

      mockTrendService.getRisingTechnologies.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue([]);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);

      const result = await analyticsService.getMarketInsights();

      expect(result.remoteVsOnsite.remote).toBe(2);
      expect(result.remoteVsOnsite.onsite).toBe(1);
      expect(result.remoteVsOnsite.hybrid).toBe(0);
    });

    it('should limit top companies to 20', async () => {
      const mockJobs = Array.from({ length: 30 }, (_, i) =>
        createMockJob({ id: `${i}`, company: `Company${i}` })
      );

      mockTrendService.getRisingTechnologies.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue([]);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);

      const result = await analyticsService.getMarketInsights();

      expect(result.topCompanies.length).toBeLessThanOrEqual(20);
    });

    it('should handle companies without salary data', async () => {
      const mockJobs = [
        createMockJob({
          company: 'StartupCo',
          salaryMinKEuros: null,
          salaryMaxKEuros: null,
        }),
      ];

      mockTrendService.getRisingTechnologies.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue([]);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);

      const result = await analyticsService.getMarketInsights();

      expect(result.topCompanies[0].averageSalary).toBeNull();
    });
  });
});
