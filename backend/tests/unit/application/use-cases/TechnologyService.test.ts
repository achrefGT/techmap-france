import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TechnologyService } from '../../../../src/application/use-cases/TechnologyService';
import { ITechnologyRepository } from '../../../../src/domain/repositories/ITechnologyRepository';
import { IJobRepository } from '../../../../src/domain/repositories/IJobRepository';
import { IRegionRepository } from '../../../../src/domain/repositories/IRegionRepository';
import { Technology } from '../../../../src/domain/entities/Technology';
import { Job } from '../../../../src/domain/entities/Job';
import { Region } from '../../../../src/domain/entities/Region';

describe('TechnologyService', () => {
  let technologyService: TechnologyService;
  let mockTechnologyRepository: jest.Mocked<ITechnologyRepository>;
  let mockJobRepository: jest.Mocked<IJobRepository>;
  let mockRegionRepository: jest.Mocked<IRegionRepository>;

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
    mockTechnologyRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      findByCategory: jest.fn(),
      save: jest.fn(),
      updateJobCount: jest.fn(),
    } as jest.Mocked<ITechnologyRepository>;

    mockJobRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      save: jest.fn(),
      saveMany: jest.fn(),
      findRecent: jest.fn(),
      findByTechnology: jest.fn(),
      findByRegion: jest.fn(),
      deactivateOldJobs: jest.fn(),
    } as jest.Mocked<IJobRepository>;

    mockRegionRepository = {
      findById: jest.fn(),
      findByCode: jest.fn(),
      findAll: jest.fn(),
      updateJobCount: jest.fn(),
    } as jest.Mocked<IRegionRepository>;

    technologyService = new TechnologyService(
      mockTechnologyRepository,
      mockJobRepository,
      mockRegionRepository
    );
  });

  describe('getAllTechnologies', () => {
    it('should return all technologies as DTOs', async () => {
      const mockTechnologies = [
        createMockTechnology(),
        createMockTechnology({
          id: 2,
          name: 'TypeScript',
          displayName: 'TypeScript',
          jobCount: 150,
        }),
      ];
      mockTechnologyRepository.findAll.mockResolvedValue(mockTechnologies);

      const result = await technologyService.getAllTechnologies();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].name).toBe('React');
      expect(result[1].id).toBe(2);
      expect(result[1].name).toBe('TypeScript');
      expect(mockTechnologyRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no technologies exist', async () => {
      mockTechnologyRepository.findAll.mockResolvedValue([]);

      const result = await technologyService.getAllTechnologies();

      expect(result).toHaveLength(0);
    });

    it('should include popularity level and demand status in DTOs', async () => {
      const mockTech = createMockTechnology({ jobCount: 600 });
      mockTechnologyRepository.findAll.mockResolvedValue([mockTech]);

      const result = await technologyService.getAllTechnologies();

      expect(result[0].popularityLevel).toBe('trending');
      expect(result[0].isInDemand).toBe(true);
    });
  });

  describe('getTechnologyById', () => {
    it('should return a technology DTO when technology exists', async () => {
      const mockTech = createMockTechnology();
      mockTechnologyRepository.findById.mockResolvedValue(mockTech);

      const result = await technologyService.getTechnologyById(1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.name).toBe('React');
      expect(result?.category).toBe('frontend');
      expect(mockTechnologyRepository.findById).toHaveBeenCalledWith(1);
    });

    it('should return null when technology does not exist', async () => {
      mockTechnologyRepository.findById.mockResolvedValue(null);

      const result = await technologyService.getTechnologyById(999);

      expect(result).toBeNull();
      expect(mockTechnologyRepository.findById).toHaveBeenCalledWith(999);
    });
  });

  describe('getTechnologyStats', () => {
    it('should return null when technology does not exist', async () => {
      mockTechnologyRepository.findById.mockResolvedValue(null);

      const result = await technologyService.getTechnologyStats(999);

      expect(result).toBeNull();
    });

    it('should return comprehensive technology statistics', async () => {
      const mockTech = createMockTechnology();
      const mockJobs = [
        createMockJob({
          technologies: ['React'],
          salaryMinKEuros: 50,
          salaryMaxKEuros: 70,
          isRemote: false,
          experienceCategory: 'mid',
          regionId: 11,
        }),
        createMockJob({
          id: '2',
          technologies: ['React'],
          salaryMinKEuros: 60,
          salaryMaxKEuros: 80,
          isRemote: true,
          experienceCategory: 'senior',
          regionId: 11,
        }),
      ];
      const mockRegion = createMockRegion();

      mockTechnologyRepository.findById.mockResolvedValue(mockTech);
      mockJobRepository.findByTechnology.mockResolvedValue(mockJobs);
      mockRegionRepository.findById.mockResolvedValue(mockRegion);

      const result = await technologyService.getTechnologyStats(1);

      expect(result).not.toBeNull();
      expect(result?.technology.id).toBe(1);
      expect(result?.totalJobs).toBe(100);
      expect(result?.averageSalary).not.toBeNull();
      expect(result?.topRegions).toBeDefined();
      expect(result?.experienceDistribution).toBeDefined();
      expect(result?.remoteJobsPercentage).toBeDefined();
    });

    it('should calculate average salary correctly', async () => {
      const mockTech = createMockTechnology();
      const mockJobs = [
        createMockJob({ salaryMinKEuros: 40, salaryMaxKEuros: 60 }), // midpoint: 50
        createMockJob({ id: '2', salaryMinKEuros: 60, salaryMaxKEuros: 80 }), // midpoint: 70
      ];

      mockTechnologyRepository.findById.mockResolvedValue(mockTech);
      mockJobRepository.findByTechnology.mockResolvedValue(mockJobs);
      mockRegionRepository.findById.mockResolvedValue(createMockRegion());

      const result = await technologyService.getTechnologyStats(1);

      // Average of 50 and 70 = 60
      expect(result?.averageSalary).toBe(60);
    });

    it('should handle jobs without salary data', async () => {
      const mockTech = createMockTechnology();
      const mockJobs = [
        createMockJob({ salaryMinKEuros: null, salaryMaxKEuros: null }),
        createMockJob({
          id: '2',
          salaryMinKEuros: 50,
          salaryMaxKEuros: 70,
        }),
      ];

      mockTechnologyRepository.findById.mockResolvedValue(mockTech);
      mockJobRepository.findByTechnology.mockResolvedValue(mockJobs);
      mockRegionRepository.findById.mockResolvedValue(createMockRegion());

      const result = await technologyService.getTechnologyStats(1);

      // Should only calculate from jobs with salary data
      expect(result?.averageSalary).toBe(60);
    });

    it('should return null for average salary when no salary data exists', async () => {
      const mockTech = createMockTechnology();
      const mockJobs = [createMockJob({ salaryMinKEuros: null, salaryMaxKEuros: null })];

      mockTechnologyRepository.findById.mockResolvedValue(mockTech);
      mockJobRepository.findByTechnology.mockResolvedValue(mockJobs);
      mockRegionRepository.findById.mockResolvedValue(createMockRegion());

      const result = await technologyService.getTechnologyStats(1);

      expect(result?.averageSalary).toBeNull();
    });

    it('should calculate top regions correctly', async () => {
      const mockTech = createMockTechnology();
      const mockJobs = [
        createMockJob({ regionId: 11 }),
        createMockJob({ id: '2', regionId: 11 }),
        createMockJob({ id: '3', regionId: 11 }),
        createMockJob({ id: '4', regionId: 12 }),
        createMockJob({ id: '5', regionId: 12 }),
        createMockJob({ id: '6', regionId: 13 }),
      ];

      const mockRegion1 = createMockRegion({ id: 11, name: 'Île-de-France' });
      const mockRegion2 = createMockRegion({ id: 12, name: 'Auvergne-Rhône-Alpes', code: 'ARA' });
      const mockRegion3 = createMockRegion({ id: 13, name: 'Nouvelle-Aquitaine', code: 'NAQ' });

      mockTechnologyRepository.findById.mockResolvedValue(mockTech);
      mockJobRepository.findByTechnology.mockResolvedValue(mockJobs);
      mockRegionRepository.findById.mockImplementation(async (id: number) => {
        if (id === 11) return mockRegion1;
        if (id === 12) return mockRegion2;
        if (id === 13) return mockRegion3;
        return null;
      });

      const result = await technologyService.getTechnologyStats(1);

      expect(result?.topRegions).toHaveLength(3);
      expect(result?.topRegions[0].regionName).toBe('Île-de-France');
      expect(result?.topRegions[0].jobCount).toBe(3);
      expect(result?.topRegions[1].regionName).toBe('Auvergne-Rhône-Alpes');
      expect(result?.topRegions[1].jobCount).toBe(2);
      expect(result?.topRegions[2].regionName).toBe('Nouvelle-Aquitaine');
      expect(result?.topRegions[2].jobCount).toBe(1);
    });

    it('should limit top regions to 10', async () => {
      const mockTech = createMockTechnology();
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
      // Only create as many regions as we have valid codes
      const regions = Array.from({ length: 13 }, (_, i) => i + 1);
      const mockJobs = regions.map((regionId, i) =>
        createMockJob({
          id: String(i + 1),
          regionId,
        })
      );

      mockTechnologyRepository.findById.mockResolvedValue(mockTech);
      mockJobRepository.findByTechnology.mockResolvedValue(mockJobs);
      mockRegionRepository.findById.mockImplementation(async (id: number) => {
        const codeIndex = id - 1;
        return createMockRegion({
          id,
          name: `Region ${id}`,
          code: validRegionCodes[codeIndex],
        });
      });

      const result = await technologyService.getTechnologyStats(1);

      expect(result?.topRegions.length).toBeLessThanOrEqual(10);
    });

    it('should handle jobs without region ID', async () => {
      const mockTech = createMockTechnology();
      const mockJobs = [
        createMockJob({ regionId: null }),
        createMockJob({ id: '2', regionId: 11 }),
      ];

      mockTechnologyRepository.findById.mockResolvedValue(mockTech);
      mockJobRepository.findByTechnology.mockResolvedValue(mockJobs);
      mockRegionRepository.findById.mockResolvedValue(createMockRegion());

      const result = await technologyService.getTechnologyStats(1);

      // Should only include jobs with valid region IDs
      expect(result?.topRegions).toHaveLength(1);
      expect(result?.topRegions[0].jobCount).toBe(1);
    });

    it('should handle region not found in repository', async () => {
      const mockTech = createMockTechnology();
      const mockJobs = [createMockJob({ regionId: 999 })];

      mockTechnologyRepository.findById.mockResolvedValue(mockTech);
      mockJobRepository.findByTechnology.mockResolvedValue(mockJobs);
      mockRegionRepository.findById.mockResolvedValue(null);

      const result = await technologyService.getTechnologyStats(1);

      // Should handle missing region gracefully
      expect(result?.topRegions).toHaveLength(0);
    });

    it('should calculate experience distribution', async () => {
      const mockTech = createMockTechnology();
      const mockJobs = [
        createMockJob({ experienceCategory: 'junior' }),
        createMockJob({ id: '2', experienceCategory: 'junior' }),
        createMockJob({ id: '3', experienceCategory: 'mid' }),
        createMockJob({ id: '4', experienceCategory: 'mid' }),
        createMockJob({ id: '5', experienceCategory: 'mid' }),
        createMockJob({ id: '6', experienceCategory: 'senior' }),
        createMockJob({ id: '7', experienceCategory: 'lead' }),
      ];

      mockTechnologyRepository.findById.mockResolvedValue(mockTech);
      mockJobRepository.findByTechnology.mockResolvedValue(mockJobs);
      mockRegionRepository.findById.mockResolvedValue(createMockRegion());

      const result = await technologyService.getTechnologyStats(1);

      expect(result?.experienceDistribution.junior).toBe(2);
      expect(result?.experienceDistribution.mid).toBe(3);
      expect(result?.experienceDistribution.senior).toBe(1);
      expect(result?.experienceDistribution.lead).toBe(1);
    });

    it('should calculate remote jobs percentage', async () => {
      const mockTech = createMockTechnology();
      const mockJobs = [
        createMockJob({ isRemote: true }),
        createMockJob({ id: '2', isRemote: false }),
        createMockJob({ id: '3', isRemote: false }),
        createMockJob({ id: '4', isRemote: false }),
      ];

      mockTechnologyRepository.findById.mockResolvedValue(mockTech);
      mockJobRepository.findByTechnology.mockResolvedValue(mockJobs);
      mockRegionRepository.findById.mockResolvedValue(createMockRegion());

      const result = await technologyService.getTechnologyStats(1);

      // 1 out of 4 = 25%
      expect(result?.remoteJobsPercentage).toBe(25);
    });

    it('should handle zero jobs for remote percentage', async () => {
      const mockTech = createMockTechnology();

      mockTechnologyRepository.findById.mockResolvedValue(mockTech);
      mockJobRepository.findByTechnology.mockResolvedValue([]);

      const result = await technologyService.getTechnologyStats(1);

      expect(result?.remoteJobsPercentage).toBe(0);
    });

    it('should handle empty job list', async () => {
      const mockTech = createMockTechnology({ jobCount: 0 });

      mockTechnologyRepository.findById.mockResolvedValue(mockTech);
      mockJobRepository.findByTechnology.mockResolvedValue([]);

      const result = await technologyService.getTechnologyStats(1);

      expect(result?.totalJobs).toBe(0);
      expect(result?.averageSalary).toBeNull();
      expect(result?.topRegions).toHaveLength(0);
      expect(result?.experienceDistribution.junior).toBe(0);
      expect(result?.remoteJobsPercentage).toBe(0);
    });
  });

  describe('getTechnologiesByCategory', () => {
    it('should return technologies filtered by category', async () => {
      const mockTechnologies = [
        createMockTechnology({ id: 1, name: 'React', category: 'frontend' }),
        createMockTechnology({ id: 2, name: 'Vue', category: 'frontend', displayName: 'Vue.js' }),
      ];
      mockTechnologyRepository.findByCategory.mockResolvedValue(mockTechnologies);

      const result = await technologyService.getTechnologiesByCategory('frontend');

      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('frontend');
      expect(result[1].category).toBe('frontend');
      expect(mockTechnologyRepository.findByCategory).toHaveBeenCalledWith('frontend');
    });

    it('should return empty array when no technologies in category', async () => {
      mockTechnologyRepository.findByCategory.mockResolvedValue([]);

      const result = await technologyService.getTechnologiesByCategory('ai-ml');

      expect(result).toHaveLength(0);
    });

    it('should handle different category types', async () => {
      const categories = ['frontend', 'backend', 'database', 'devops', 'ai-ml', 'mobile', 'other'];

      for (const category of categories) {
        mockTechnologyRepository.findByCategory.mockResolvedValue([
          createMockTechnology({ category: category as any }),
        ]);

        const result = await technologyService.getTechnologiesByCategory(category);

        expect(result).toHaveLength(1);
        expect(result[0].category).toBe(category);
      }
    });
  });
});
