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
      description: 'Build React applications',
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

  const createMockTechnology = (overrides: Partial<any> = {}): Technology => {
    const defaults = {
      id: 1,
      name: 'React',
      category: 'frontend' as const,
      displayName: 'React',
      jobCount: 100,
    };

    const data = { ...defaults, ...overrides };

    return new Technology(data.id, data.name, data.category, data.displayName, data.jobCount);
  };

  const createMockRegion = (overrides: Partial<any> = {}): Region => {
    const defaults = {
      id: 11,
      name: 'Île-de-France',
      code: 'IDF',
      fullName: 'Région Île-de-France',
      jobCount: 1000,
      population: 12000000,
    };

    const data = { ...defaults, ...overrides };

    return new Region(data.id, data.name, data.code, data.fullName, data.jobCount, data.population);
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

    mockTechnologyRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      findByCategory: jest.fn(),
      save: jest.fn(),
      updateJobCount: jest.fn(),
    } as jest.Mocked<ITechnologyRepository>;

    mockRegionRepository = {
      findById: jest.fn(),
      findByCode: jest.fn(),
      findAll: jest.fn(),
      updateJobCount: jest.fn(),
    } as jest.Mocked<IRegionRepository>;

    mockTrendService = {
      getRisingTechnologies: jest.fn(),
      getDecliningTechnologies: jest.fn(),
      getStableTechnologies: jest.fn(),
      analyzeTrend: jest.fn(),
    } as any;

    analyticsService = new AnalyticsService(
      mockJobRepository,
      mockTechnologyRepository,
      mockRegionRepository,
      mockTrendService
    );
  });

  describe('getDashboardStats', () => {
    it('should return comprehensive dashboard statistics', async () => {
      const mockJobs = [createMockJob(), createMockJob({ id: '2', company: 'StartupCo' })];
      const mockTechs = [createMockTechnology()];
      const mockRegions = [createMockRegion()];
      const mockRecentJobs = [createMockJob()];

      mockJobRepository.count.mockResolvedValueOnce(100); // totalJobs
      mockJobRepository.count.mockResolvedValueOnce(85); // activeJobs
      mockJobRepository.findAll.mockResolvedValueOnce(mockRecentJobs); // recentJobs
      mockJobRepository.findAll.mockResolvedValueOnce(mockJobs); // allJobs for calculations
      mockTechnologyRepository.findAll.mockResolvedValue(mockTechs);
      mockRegionRepository.findAll.mockResolvedValue(mockRegions);

      const result = await analyticsService.getDashboardStats();

      expect(result.totalJobs).toBe(100);
      expect(result.activeJobs).toBe(85);
      expect(result.recentJobs).toBe(1);
      expect(result.totalTechnologies).toBe(1);
      expect(result.totalRegions).toBe(1);
      expect(result.totalCompanies).toBe(2);
      expect(mockJobRepository.count).toHaveBeenCalledWith({});
      expect(mockJobRepository.count).toHaveBeenCalledWith({ isActive: true });
      expect(mockJobRepository.findAll).toHaveBeenCalledWith({ recentDays: 7 }, 1, 10000);
    });

    it('should handle empty database', async () => {
      mockJobRepository.count.mockResolvedValue(0);
      mockJobRepository.findAll.mockResolvedValue([]);
      mockTechnologyRepository.findAll.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue([]);

      const result = await analyticsService.getDashboardStats();

      expect(result.totalJobs).toBe(0);
      expect(result.activeJobs).toBe(0);
      expect(result.recentJobs).toBe(0);
      expect(result.totalTechnologies).toBe(0);
      expect(result.totalRegions).toBe(0);
      expect(result.totalCompanies).toBe(0);
    });
  });

  describe('getSalaryStats', () => {
    it('should calculate salary statistics by technology', async () => {
      const mockJobs = [
        createMockJob({ salaryMinKEuros: 50, salaryMaxKEuros: 70 }),
        createMockJob({ id: '2', salaryMinKEuros: 60, salaryMaxKEuros: 80 }),
      ];
      const mockTech = createMockTechnology();

      mockJobRepository.findAll.mockResolvedValueOnce(mockJobs); // Jobs with salary
      mockTechnologyRepository.findAll.mockResolvedValue([mockTech]);
      mockJobRepository.findAll.mockResolvedValueOnce(mockJobs); // Tech-specific jobs
      mockRegionRepository.findAll.mockResolvedValue([]);

      const result = await analyticsService.getSalaryStats();

      expect(result).toBeDefined();
      expect(mockJobRepository.findAll).toHaveBeenCalledWith({ minSalary: 1 }, 1, 10000);
      expect(mockJobRepository.findAll).toHaveBeenCalledWith({ technologies: ['React'] }, 1, 10000);
    });

    it('should calculate salary statistics by region', async () => {
      const mockJobs = [createMockJob({ salaryMinKEuros: 50, salaryMaxKEuros: 70, regionId: 11 })];
      const mockRegion = createMockRegion();

      mockJobRepository.findAll.mockResolvedValueOnce(mockJobs);
      mockTechnologyRepository.findAll.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue([mockRegion]);
      mockJobRepository.findAll.mockResolvedValueOnce(mockJobs);

      const result = await analyticsService.getSalaryStats();

      expect(result).toBeDefined();
      expect(mockJobRepository.findAll).toHaveBeenCalledWith({ regionIds: [11] }, 1, 10000);
    });

    it('should handle jobs without salary data', async () => {
      const mockJobs = [createMockJob({ salaryMinKEuros: null, salaryMaxKEuros: null })];

      mockJobRepository.findAll.mockResolvedValue(mockJobs);
      mockTechnologyRepository.findAll.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue([]);

      const result = await analyticsService.getSalaryStats();

      expect(result).toBeDefined();
    });
  });

  describe('getMarketInsights', () => {
    it('should return hot technologies from trend service', async () => {
      // FIX: Added growthRate property
      const mockTrends = [
        {
          technologyId: 1,
          technologyName: 'React',
          currentCount: 150,
          previousCount: 100,
          growthPercentage: 50,
          growthRate: 0.5,
          growthCategory: 'rising' as const,
          periodDays: 30,
        },
      ];
      const mockTech = createMockTechnology();

      mockTrendService.getRisingTechnologies.mockResolvedValue(mockTrends);
      mockTechnologyRepository.findById.mockResolvedValue(mockTech);
      mockRegionRepository.findAll.mockResolvedValue([]);
      mockJobRepository.findAll.mockResolvedValue([]);

      const result = await analyticsService.getMarketInsights();

      expect(result.hotTechnologies).toHaveLength(1);
      expect(result.hotTechnologies[0].technologyName).toBe('React');
      expect(mockTrendService.getRisingTechnologies).toHaveBeenCalledWith(30);
    });

    it('should return top regions by job count', async () => {
      const mockRegions = [
        createMockRegion({ id: 11, name: 'Île-de-France' }),
        createMockRegion({ id: 12, name: 'Auvergne-Rhône-Alpes', code: 'ARA' }),
      ];
      const mockJobs = [
        createMockJob({ regionId: 11 }),
        createMockJob({ id: '2', regionId: 11 }),
        createMockJob({ id: '3', regionId: 12 }),
      ];

      mockTrendService.getRisingTechnologies.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue(mockRegions);
      mockJobRepository.findAll.mockResolvedValueOnce(mockJobs); // First call for region 11
      mockJobRepository.findAll.mockResolvedValueOnce([mockJobs[2]]); // Second call for region 12
      mockJobRepository.findAll.mockResolvedValueOnce(mockJobs); // Final call for all jobs

      const result = await analyticsService.getMarketInsights();

      expect(result.topRegions.length).toBeGreaterThan(0);
      expect(result.topRegions[0].regionName).toBe('Île-de-France');
      expect(result.topRegions[0].jobCount).toBe(3);
    });

    it('should return top companies with statistics', async () => {
      const mockJobs = [
        createMockJob({ company: 'TechCorp', technologies: ['React', 'TypeScript'] }),
        createMockJob({ id: '2', company: 'TechCorp', technologies: ['React'] }),
        createMockJob({ id: '3', company: 'StartupCo', technologies: ['Vue'] }),
      ];

      mockTrendService.getRisingTechnologies.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue([]);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);

      const result = await analyticsService.getMarketInsights();

      expect(result.topCompanies.length).toBeGreaterThan(0);
      expect(result.topCompanies[0].companyName).toBe('TechCorp');
      expect(result.topCompanies[0].jobCount).toBe(2);
      expect(result.topCompanies[0].topTechnologies).toContain('React');
    });

    it('should limit results to top 10', async () => {
      // FIX: Use valid region codes
      const validRegionCodes = [
        'IDF',
        'ARA',
        'NAQ',
        'OCC',
        'HDF',
        'PAC',
        'GES',
        'PDL',
        'BRE',
        'NOR',
        'BFC',
        'CVL',
        'COR',
      ];

      const manyRegions = Array.from({ length: 13 }, (_, i) =>
        createMockRegion({
          id: i + 1,
          name: `Region ${i}`,
          code: validRegionCodes[i],
        })
      );

      mockTrendService.getRisingTechnologies.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue(manyRegions);
      mockJobRepository.findAll.mockResolvedValue([createMockJob()]);

      const result = await analyticsService.getMarketInsights();

      expect(result.topRegions.length).toBeLessThanOrEqual(10);
    });

    it('should handle companies without salary data', async () => {
      const mockJobs = [
        createMockJob({ company: 'TechCorp', salaryMinKEuros: null, salaryMaxKEuros: null }),
      ];

      mockTrendService.getRisingTechnologies.mockResolvedValue([]);
      mockRegionRepository.findAll.mockResolvedValue([]);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);

      const result = await analyticsService.getMarketInsights();

      expect(result.topCompanies[0].averageSalary).toBeNull();
    });
  });
});
