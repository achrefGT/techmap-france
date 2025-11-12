import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RegionService } from '../../../../src/application/use-cases/RegionService';
import { IRegionRepository } from '../../../../src/domain/repositories/IRegionRepository';
import { IJobRepository } from '../../../../src/domain/repositories/IJobRepository';
import { ITechnologyRepository } from '../../../../src/domain/repositories/ITechnologyRepository';
import { Region } from '../../../../src/domain/entities/Region';
import { Job } from '../../../../src/domain/entities/Job';
import { Technology } from '../../../../src/domain/entities/Technology';

describe('RegionService', () => {
  let regionService: RegionService;
  let mockRegionRepository: jest.Mocked<IRegionRepository>;
  let mockJobRepository: jest.Mocked<IJobRepository>;
  let mockTechnologyRepository: jest.Mocked<ITechnologyRepository>;

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

  beforeEach(() => {
    mockRegionRepository = {
      findById: jest.fn(),
      findByCode: jest.fn(),
      findAll: jest.fn(),
      updateJobCount: jest.fn(),
    } as jest.Mocked<IRegionRepository>;

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

    regionService = new RegionService(
      mockRegionRepository,
      mockJobRepository,
      mockTechnologyRepository
    );
  });

  describe('getAllRegions', () => {
    it('should return all regions as DTOs', async () => {
      const mockRegions = [
        createMockRegion(),
        createMockRegion({ id: 12, name: 'Auvergne-Rhône-Alpes', code: 'ARA' }),
      ];
      mockRegionRepository.findAll.mockResolvedValue(mockRegions);

      const result = await regionService.getAllRegions();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(11);
      expect(result[0].name).toBe('Île-de-France');
      expect(result[1].id).toBe(12);
      expect(mockRegionRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no regions exist', async () => {
      mockRegionRepository.findAll.mockResolvedValue([]);

      const result = await regionService.getAllRegions();

      expect(result).toHaveLength(0);
    });
  });

  describe('getRegionById', () => {
    it('should return a region DTO when region exists', async () => {
      const mockRegion = createMockRegion();
      mockRegionRepository.findById.mockResolvedValue(mockRegion);

      const result = await regionService.getRegionById(11);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(11);
      expect(result?.name).toBe('Île-de-France');
      expect(result?.code).toBe('IDF');
      expect(mockRegionRepository.findById).toHaveBeenCalledWith(11);
    });

    it('should return null when region does not exist', async () => {
      mockRegionRepository.findById.mockResolvedValue(null);

      const result = await regionService.getRegionById(999);

      expect(result).toBeNull();
      expect(mockRegionRepository.findById).toHaveBeenCalledWith(999);
    });
  });

  describe('getRegionStats', () => {
    it('should return null when region does not exist', async () => {
      mockRegionRepository.findById.mockResolvedValue(null);

      const result = await regionService.getRegionStats(999);

      expect(result).toBeNull();
    });

    it('should return comprehensive region statistics', async () => {
      const mockRegion = createMockRegion();
      const mockJobs = [
        createMockJob({
          technologies: ['React', 'TypeScript'],
          salaryMinKEuros: 50,
          salaryMaxKEuros: 70,
          isRemote: false,
          experienceCategory: 'mid',
          company: 'TechCorp',
        }),
        createMockJob({
          id: '2',
          technologies: ['React', 'Node.js'],
          salaryMinKEuros: 60,
          salaryMaxKEuros: 80,
          isRemote: true,
          experienceCategory: 'senior',
          company: 'StartupCo',
        }),
      ];

      const mockReactTech = createMockTechnology({ id: 1, name: 'React' });
      const mockTypescriptTech = createMockTechnology({ id: 2, name: 'TypeScript' });
      const mockNodeTech = createMockTechnology({ id: 3, name: 'Node.js' });

      mockRegionRepository.findById.mockResolvedValue(mockRegion);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);
      mockTechnologyRepository.findByName.mockImplementation(async (name: string) => {
        if (name === 'React') return mockReactTech;
        if (name === 'TypeScript') return mockTypescriptTech;
        if (name === 'Node.js') return mockNodeTech;
        return null;
      });

      const result = await regionService.getRegionStats(11);

      expect(result).not.toBeNull();
      expect(result?.region.id).toBe(11);
      expect(result?.topTechnologies).toBeDefined();
      expect(result?.averageSalary).not.toBeNull();
      expect(result?.salaryRange).not.toBeNull();
      expect(result?.remoteJobsPercentage).toBeDefined();
      expect(result?.experienceDistribution).toBeDefined();
      expect(result?.topCompanies).toBeDefined();
      expect(mockJobRepository.findAll).toHaveBeenCalledWith({ regionIds: [11] }, 1, 10000);
    });

    it('should calculate top technologies correctly', async () => {
      const mockRegion = createMockRegion();
      const mockJobs = [
        createMockJob({ technologies: ['React'] }),
        createMockJob({ id: '2', technologies: ['React'] }),
        createMockJob({ id: '3', technologies: ['TypeScript'] }),
      ];

      const mockReactTech = createMockTechnology({ id: 1, name: 'React' });
      const mockTypescriptTech = createMockTechnology({ id: 2, name: 'TypeScript' });

      mockRegionRepository.findById.mockResolvedValue(mockRegion);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);
      mockTechnologyRepository.findByName.mockImplementation(async (name: string) => {
        if (name === 'React') return mockReactTech;
        if (name === 'TypeScript') return mockTypescriptTech;
        return null;
      });

      const result = await regionService.getRegionStats(11);

      expect(result?.topTechnologies).toHaveLength(2);
      expect(result?.topTechnologies[0].technologyName).toBe('React');
      expect(result?.topTechnologies[0].jobCount).toBe(2);
      expect(result?.topTechnologies[1].technologyName).toBe('TypeScript');
      expect(result?.topTechnologies[1].jobCount).toBe(1);
    });

    it('should limit top technologies to 10', async () => {
      const mockRegion = createMockRegion();
      const technologies = Array.from({ length: 15 }, (_, i) => `Tech${i}`);
      const mockJobs = technologies.map((tech, i) =>
        createMockJob({
          id: String(i + 1),
          technologies: [tech],
        })
      );

      mockRegionRepository.findById.mockResolvedValue(mockRegion);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);
      mockTechnologyRepository.findByName.mockImplementation(async (name: string) => {
        const id = parseInt(name.replace('Tech', '')) + 1;
        return createMockTechnology({ id, name });
      });

      const result = await regionService.getRegionStats(11);

      expect(result?.topTechnologies.length).toBeLessThanOrEqual(10);
    });

    it('should calculate average salary correctly', async () => {
      const mockRegion = createMockRegion();
      const mockJobs = [
        createMockJob({ salaryMinKEuros: 40, salaryMaxKEuros: 60 }), // midpoint: 50
        createMockJob({ id: '2', salaryMinKEuros: 60, salaryMaxKEuros: 80 }), // midpoint: 70
      ];

      mockRegionRepository.findById.mockResolvedValue(mockRegion);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);
      mockTechnologyRepository.findByName.mockResolvedValue(createMockTechnology());

      const result = await regionService.getRegionStats(11);

      // Average of 50 and 70 = 60
      expect(result?.averageSalary).toBe(60);
    });

    it('should handle jobs without salary data', async () => {
      const mockRegion = createMockRegion();
      const mockJobs = [
        createMockJob({ salaryMinKEuros: null, salaryMaxKEuros: null }),
        createMockJob({
          id: '2',
          salaryMinKEuros: 50,
          salaryMaxKEuros: 70,
        }),
      ];

      mockRegionRepository.findById.mockResolvedValue(mockRegion);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);
      mockTechnologyRepository.findByName.mockResolvedValue(createMockTechnology());

      const result = await regionService.getRegionStats(11);

      // Should only calculate from jobs with salary data
      expect(result?.averageSalary).toBe(60);
    });

    it('should return null for average salary when no salary data exists', async () => {
      const mockRegion = createMockRegion();
      const mockJobs = [createMockJob({ salaryMinKEuros: null, salaryMaxKEuros: null })];

      mockRegionRepository.findById.mockResolvedValue(mockRegion);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);
      mockTechnologyRepository.findByName.mockResolvedValue(createMockTechnology());

      const result = await regionService.getRegionStats(11);

      expect(result?.averageSalary).toBeNull();
    });

    it('should calculate salary range correctly', async () => {
      const mockRegion = createMockRegion();
      const mockJobs = [
        createMockJob({ salaryMinKEuros: 30, salaryMaxKEuros: 50 }), // midpoint: 40
        createMockJob({ id: '2', salaryMinKEuros: 60, salaryMaxKEuros: 100 }), // midpoint: 80
        createMockJob({ id: '3', salaryMinKEuros: 50, salaryMaxKEuros: 70 }), // midpoint: 60
      ];

      mockRegionRepository.findById.mockResolvedValue(mockRegion);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);
      mockTechnologyRepository.findByName.mockResolvedValue(createMockTechnology());

      const result = await regionService.getRegionStats(11);

      expect(result?.salaryRange?.min).toBe(40);
      expect(result?.salaryRange?.max).toBe(80);
    });

    it('should calculate remote jobs percentage', async () => {
      const mockRegion = createMockRegion();
      const mockJobs = [
        createMockJob({ isRemote: true }),
        createMockJob({ id: '2', isRemote: false }),
        createMockJob({ id: '3', isRemote: false }),
        createMockJob({ id: '4', isRemote: false }),
      ];

      mockRegionRepository.findById.mockResolvedValue(mockRegion);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);
      mockTechnologyRepository.findByName.mockResolvedValue(createMockTechnology());

      const result = await regionService.getRegionStats(11);

      // 1 out of 4 = 25%
      expect(result?.remoteJobsPercentage).toBe(25);
    });

    it('should handle zero jobs for remote percentage', async () => {
      const mockRegion = createMockRegion();

      mockRegionRepository.findById.mockResolvedValue(mockRegion);
      mockJobRepository.findAll.mockResolvedValue([]);

      const result = await regionService.getRegionStats(11);

      expect(result?.remoteJobsPercentage).toBe(0);
    });

    it('should calculate experience distribution', async () => {
      const mockRegion = createMockRegion();
      const mockJobs = [
        createMockJob({ experienceCategory: 'junior' }),
        createMockJob({ id: '2', experienceCategory: 'junior' }),
        createMockJob({ id: '3', experienceCategory: 'mid' }),
        createMockJob({ id: '4', experienceCategory: 'mid' }),
        createMockJob({ id: '5', experienceCategory: 'mid' }),
        createMockJob({ id: '6', experienceCategory: 'senior' }),
        createMockJob({ id: '7', experienceCategory: 'lead' }),
      ];

      mockRegionRepository.findById.mockResolvedValue(mockRegion);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);
      mockTechnologyRepository.findByName.mockResolvedValue(createMockTechnology());

      const result = await regionService.getRegionStats(11);

      expect(result?.experienceDistribution.junior).toBe(2);
      expect(result?.experienceDistribution.mid).toBe(3);
      expect(result?.experienceDistribution.senior).toBe(1);
      expect(result?.experienceDistribution.lead).toBe(1);
    });

    it('should calculate top companies', async () => {
      const mockRegion = createMockRegion();
      const mockJobs = [
        createMockJob({ company: 'TechCorp' }),
        createMockJob({ id: '2', company: 'TechCorp' }),
        createMockJob({ id: '3', company: 'TechCorp' }),
        createMockJob({ id: '4', company: 'StartupCo' }),
        createMockJob({ id: '5', company: 'StartupCo' }),
        createMockJob({ id: '6', company: 'BigCompany' }),
      ];

      mockRegionRepository.findById.mockResolvedValue(mockRegion);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);
      mockTechnologyRepository.findByName.mockResolvedValue(createMockTechnology());

      const result = await regionService.getRegionStats(11);

      expect(result?.topCompanies).toHaveLength(3);
      expect(result?.topCompanies[0].companyName).toBe('TechCorp');
      expect(result?.topCompanies[0].jobCount).toBe(3);
      expect(result?.topCompanies[1].companyName).toBe('StartupCo');
      expect(result?.topCompanies[1].jobCount).toBe(2);
      expect(result?.topCompanies[2].companyName).toBe('BigCompany');
      expect(result?.topCompanies[2].jobCount).toBe(1);
    });

    it('should limit top companies to 10', async () => {
      const mockRegion = createMockRegion();
      const companies = Array.from({ length: 15 }, (_, i) => `Company${i}`);
      const mockJobs = companies.map((company, i) =>
        createMockJob({
          id: String(i + 1),
          company,
        })
      );

      mockRegionRepository.findById.mockResolvedValue(mockRegion);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);
      mockTechnologyRepository.findByName.mockResolvedValue(createMockTechnology());

      const result = await regionService.getRegionStats(11);

      expect(result?.topCompanies.length).toBeLessThanOrEqual(10);
    });

    it('should handle jobs with technologies not in repository', async () => {
      const mockRegion = createMockRegion();
      const mockJobs = [createMockJob({ technologies: ['UnknownTech', 'React'] })];

      mockRegionRepository.findById.mockResolvedValue(mockRegion);
      mockJobRepository.findAll.mockResolvedValue(mockJobs);
      mockTechnologyRepository.findByName.mockImplementation(async (name: string) => {
        if (name === 'React') return createMockTechnology({ name: 'React' });
        return null; // UnknownTech not found
      });

      const result = await regionService.getRegionStats(11);

      // Should only include React, not UnknownTech
      expect(result?.topTechnologies).toHaveLength(1);
      expect(result?.topTechnologies[0].technologyName).toBe('React');
    });

    it('should handle empty job list', async () => {
      const mockRegion = createMockRegion({ jobCount: 0 });

      mockRegionRepository.findById.mockResolvedValue(mockRegion);
      mockJobRepository.findAll.mockResolvedValue([]);

      const result = await regionService.getRegionStats(11);

      expect(result?.topTechnologies).toHaveLength(0);
      expect(result?.averageSalary).toBeNull();
      expect(result?.salaryRange).toBeNull();
      expect(result?.remoteJobsPercentage).toBe(0);
      expect(result?.experienceDistribution.junior).toBe(0);
      expect(result?.topCompanies).toHaveLength(0);
    });
  });
});
