/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  JobIngestionService,
  RawJobData,
} from '../../../../src/application/use-cases/JobIngestionService';
import { IJobRepository, BulkSaveResult } from '../../../../src/domain/repositories/IJobRepository';
import { ITechnologyRepository } from '../../../../src/domain/repositories/ITechnologyRepository';
import { IRegionRepository } from '../../../../src/domain/repositories/IRegionRepository';
import { Technology } from '../../../../src/domain/entities/Technology';
import { Region } from '../../../../src/domain/entities/Region';

// Create mock functions first
const mockTechDetectorDetect = jest.fn<(text: string) => Promise<string[]>>();
const mockExperienceDetectorDetect =
  jest.fn<
    (
      title: string,
      experienceLevel: string | null,
      description: string
    ) => Promise<'junior' | 'mid' | 'senior' | 'lead' | 'unknown'>
  >();

// Mock the detector modules with the pre-created functions
jest.mock('../../../../src/infrastructure/external/TechnologyDetector', () => ({
  techDetector: {
    detect: (text: string) => mockTechDetectorDetect(text),
  },
}));

jest.mock('../../../../src/infrastructure/external/ExperienceDetector', () => ({
  experienceDetector: {
    detect: (title: string, experienceLevel: string | null, description: string) =>
      mockExperienceDetectorDetect(title, experienceLevel, description),
  },
}));

describe('JobIngestionService', () => {
  let service: JobIngestionService;
  let mockJobRepository: jest.Mocked<IJobRepository>;
  let mockTechnologyRepository: jest.Mocked<ITechnologyRepository>;
  let mockRegionRepository: jest.Mocked<IRegionRepository>;

  const createMockRawJob = (overrides?: Partial<RawJobData>): RawJobData => ({
    id: 'job-1',
    title: 'Senior React Developer',
    company: 'TechCorp',
    description: 'We are looking for a React developer with experience in TypeScript',
    location: 'Paris',
    isRemote: false,
    salaryMin: 50,
    salaryMax: 70,
    experienceLevel: 'senior',
    sourceApi: 'indeed',
    externalId: 'ext-123',
    sourceUrl: 'https://example.com/job/123',
    postedDate: new Date('2024-01-15'),
    ...overrides,
  });

  beforeEach(() => {
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
    } as any;

    mockTechnologyRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findByCategory: jest.fn(),
      save: jest.fn(),
      updateJobCount: jest.fn(),
    } as any;

    mockRegionRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      updateJobCount: jest.fn(),
    } as any;

    service = new JobIngestionService(
      mockJobRepository,
      mockTechnologyRepository,
      mockRegionRepository
    );

    jest.clearAllMocks();
  });

  describe('ingestJobsWithStats', () => {
    it('should successfully ingest jobs with valid technologies', async () => {
      const rawJobs = [createMockRawJob()];

      mockTechnologyRepository.findAll.mockResolvedValue([
        new Technology(1, 'React', 'frontend', 'React'),
        new Technology(2, 'TypeScript', 'backend', 'TypeScript'),
      ]);

      mockTechDetectorDetect.mockResolvedValue(['React', 'TypeScript']);
      mockExperienceDetectorDetect.mockResolvedValue('senior');

      mockRegionRepository.findByCode.mockResolvedValue(
        new Region(1, 'IDF', 'IDF', 'Île-de-France')
      );

      const bulkResult: BulkSaveResult = {
        inserted: 1,
        updated: 0,
        failed: 0,
        errors: [],
      };
      mockJobRepository.saveMany.mockResolvedValue(bulkResult);

      const result = await service.ingestJobsWithStats(rawJobs);

      expect(result.result.total).toBe(1);
      expect(result.result.inserted).toBe(1);
      expect(result.result.updated).toBe(0);
      expect(result.result.failed).toBe(0);
      expect(result.technologyStats.newTechnologies).toBe(0);
      expect(mockTechnologyRepository.findAll).toHaveBeenCalledTimes(1);
      expect(mockTechDetectorDetect).toHaveBeenCalledWith(rawJobs[0].description);
      expect(mockExperienceDetectorDetect).toHaveBeenCalledWith(
        rawJobs[0].title,
        rawJobs[0].experienceLevel,
        rawJobs[0].description
      );
    });

    it('should track unknown technologies', async () => {
      const rawJobs = [createMockRawJob()];

      mockTechnologyRepository.findAll.mockResolvedValue([
        new Technology(1, 'React', 'frontend', 'React'),
      ]);

      mockTechDetectorDetect.mockResolvedValue(['React', 'Vue']);
      mockExperienceDetectorDetect.mockResolvedValue('senior');

      mockRegionRepository.findByCode.mockResolvedValue(
        new Region(1, 'IDF', 'IDF', 'Île-de-France')
      );

      const bulkResult: BulkSaveResult = {
        inserted: 1,
        updated: 0,
        failed: 0,
        errors: [],
      };
      mockJobRepository.saveMany.mockResolvedValue(bulkResult);

      const result = await service.ingestJobsWithStats(rawJobs);

      expect(result.technologyStats.newTechnologies).toBe(1);
      expect(result.result.inserted).toBe(1);
    });

    it('should reject jobs with no valid technologies', async () => {
      const rawJobs = [createMockRawJob()];

      mockTechnologyRepository.findAll.mockResolvedValue([
        new Technology(1, 'React', 'frontend', 'React'),
      ]);

      mockTechDetectorDetect.mockResolvedValue(['Vue', 'Angular']);
      mockExperienceDetectorDetect.mockResolvedValue('senior');

      // Mock saveMany to return empty result since no jobs will be saved
      const bulkResult: BulkSaveResult = {
        inserted: 0,
        updated: 0,
        failed: 0,
        errors: [],
      };
      mockJobRepository.saveMany.mockResolvedValue(bulkResult);

      const result = await service.ingestJobsWithStats(rawJobs);

      expect(result.result.failed).toBe(1);
      expect(result.result.inserted).toBe(0);
      expect(result.technologyStats.newTechnologies).toBe(2);
      expect(result.result.errors[0]).toContain('No valid technologies found');
    });

    it('should reject jobs with no detected technologies', async () => {
      const rawJobs = [createMockRawJob()];

      mockTechnologyRepository.findAll.mockResolvedValue([
        new Technology(1, 'React', 'frontend', 'React'),
      ]);

      mockTechDetectorDetect.mockResolvedValue([]);
      mockExperienceDetectorDetect.mockResolvedValue('senior');

      // Mock saveMany to return empty result since no jobs will be saved
      const bulkResult: BulkSaveResult = {
        inserted: 0,
        updated: 0,
        failed: 0,
        errors: [],
      };
      mockJobRepository.saveMany.mockResolvedValue(bulkResult);

      const result = await service.ingestJobsWithStats(rawJobs);

      expect(result.result.failed).toBe(1);
      expect(result.result.inserted).toBe(0);
      expect(result.result.errors[0]).toContain('No technologies detected');
    });

    it('should filter out low quality jobs', async () => {
      const rawJobs = [
        createMockRawJob({
          title: 'Dev',
          description: 'Job',
        }),
      ];

      mockTechnologyRepository.findAll.mockResolvedValue([
        new Technology(1, 'React', 'frontend', 'React'),
      ]);

      mockTechDetectorDetect.mockResolvedValue(['React']);
      mockExperienceDetectorDetect.mockResolvedValue('senior');

      // Mock saveMany to return empty result since no quality jobs will be saved
      const bulkResult: BulkSaveResult = {
        inserted: 0,
        updated: 0,
        failed: 0,
        errors: [],
      };
      mockJobRepository.saveMany.mockResolvedValue(bulkResult);

      const result = await service.ingestJobsWithStats(rawJobs);

      expect(result.result.inserted).toBe(0);
    });

    it('should enrich jobs with regions', async () => {
      const rawJobs = [
        createMockRawJob({ location: 'Paris' }),
        createMockRawJob({ id: 'job-2', location: 'Lyon' }),
      ];

      mockTechnologyRepository.findAll.mockResolvedValue([
        new Technology(1, 'React', 'frontend', 'React'),
      ]);

      mockTechDetectorDetect.mockResolvedValue(['React']);
      mockExperienceDetectorDetect.mockResolvedValue('senior');

      mockRegionRepository.findByCode
        .mockResolvedValueOnce(new Region(1, 'IDF', 'IDF', 'Île-de-France'))
        .mockResolvedValueOnce(new Region(2, 'ARA', 'ARA', 'Auvergne-Rhône-Alpes'));

      const bulkResult: BulkSaveResult = {
        inserted: 2,
        updated: 0,
        failed: 0,
        errors: [],
      };
      mockJobRepository.saveMany.mockResolvedValue(bulkResult);

      const result = await service.ingestJobsWithStats(rawJobs);

      expect(result.result.inserted).toBe(2);
      expect(mockRegionRepository.findByCode).toHaveBeenCalledWith('IDF');
      expect(mockRegionRepository.findByCode).toHaveBeenCalledWith('ARA');
    });

    it('should handle region detection failures gracefully', async () => {
      const rawJobs = [createMockRawJob({ location: 'Unknown City' })];

      mockTechnologyRepository.findAll.mockResolvedValue([
        new Technology(1, 'React', 'frontend', 'React'),
      ]);

      mockTechDetectorDetect.mockResolvedValue(['React']);
      mockExperienceDetectorDetect.mockResolvedValue('senior');

      mockRegionRepository.findByCode.mockResolvedValue(null);

      const bulkResult: BulkSaveResult = {
        inserted: 1,
        updated: 0,
        failed: 0,
        errors: [],
      };
      mockJobRepository.saveMany.mockResolvedValue(bulkResult);

      const result = await service.ingestJobsWithStats(rawJobs);

      expect(result.result.inserted).toBe(1);
    });

    it('should retry failed detector calls', async () => {
      const rawJobs = [createMockRawJob()];

      mockTechnologyRepository.findAll.mockResolvedValue([
        new Technology(1, 'React', 'frontend', 'React'),
      ]);

      mockTechDetectorDetect
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(['React']);

      mockExperienceDetectorDetect.mockResolvedValue('senior');

      mockRegionRepository.findByCode.mockResolvedValue(
        new Region(1, 'IDF', 'IDF', 'Île-de-France')
      );

      const bulkResult: BulkSaveResult = {
        inserted: 1,
        updated: 0,
        failed: 0,
        errors: [],
      };
      mockJobRepository.saveMany.mockResolvedValue(bulkResult);

      const result = await service.ingestJobsWithStats(rawJobs);

      expect(result.result.inserted).toBe(1);
      expect(mockTechDetectorDetect).toHaveBeenCalledTimes(3);
    });

    it('should fail job after max retries', async () => {
      const rawJobs = [createMockRawJob()];

      mockTechnologyRepository.findAll.mockResolvedValue([
        new Technology(1, 'React', 'frontend', 'React'),
      ]);

      mockTechDetectorDetect.mockRejectedValue(new Error('Network error'));

      // Mock saveMany to return empty result since job will fail
      const bulkResult: BulkSaveResult = {
        inserted: 0,
        updated: 0,
        failed: 0,
        errors: [],
      };
      mockJobRepository.saveMany.mockResolvedValue(bulkResult);

      const result = await service.ingestJobsWithStats(rawJobs);

      expect(result.result.failed).toBe(1);
      expect(result.result.errors[0]).toContain('Failed to transform job');
      expect(mockTechDetectorDetect).toHaveBeenCalledTimes(3);
    });

    it('should handle save failures from repository', async () => {
      const rawJobs = [createMockRawJob()];

      mockTechnologyRepository.findAll.mockResolvedValue([
        new Technology(1, 'React', 'frontend', 'React'),
      ]);

      mockTechDetectorDetect.mockResolvedValue(['React']);
      mockExperienceDetectorDetect.mockResolvedValue('senior');

      mockRegionRepository.findByCode.mockResolvedValue(
        new Region(1, 'IDF', 'IDF', 'Île-de-France')
      );

      const bulkResult: BulkSaveResult = {
        inserted: 0,
        updated: 0,
        failed: 1,
        errors: ['Database constraint violation'],
      };
      mockJobRepository.saveMany.mockResolvedValue(bulkResult);

      const result = await service.ingestJobsWithStats(rawJobs);

      expect(result.result.failed).toBe(1);
      expect(result.result.errors).toContain('Database constraint violation');
    });

    it('should cache valid technologies across calls', async () => {
      const rawJobs1 = [createMockRawJob()];
      const rawJobs2 = [createMockRawJob({ id: 'job-2' })];

      mockTechnologyRepository.findAll.mockResolvedValue([
        new Technology(1, 'React', 'frontend', 'React'),
      ]);

      mockTechDetectorDetect.mockResolvedValue(['React']);
      mockExperienceDetectorDetect.mockResolvedValue('senior');

      mockRegionRepository.findByCode.mockResolvedValue(
        new Region(1, 'IDF', 'IDF', 'Île-de-France')
      );

      const bulkResult: BulkSaveResult = {
        inserted: 1,
        updated: 0,
        failed: 0,
        errors: [],
      };
      mockJobRepository.saveMany.mockResolvedValue(bulkResult);

      await service.ingestJobsWithStats(rawJobs1);
      await service.ingestJobsWithStats(rawJobs2);

      expect(mockTechnologyRepository.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('ingestJobs', () => {
    it('should return basic result without stats', async () => {
      const rawJobs = [createMockRawJob()];

      mockTechnologyRepository.findAll.mockResolvedValue([
        new Technology(1, 'React', 'frontend', 'React'),
      ]);

      mockTechDetectorDetect.mockResolvedValue(['React']);
      mockExperienceDetectorDetect.mockResolvedValue('senior');

      mockRegionRepository.findByCode.mockResolvedValue(
        new Region(1, 'IDF', 'IDF', 'Île-de-France')
      );

      const bulkResult: BulkSaveResult = {
        inserted: 1,
        updated: 0,
        failed: 0,
        errors: [],
      };
      mockJobRepository.saveMany.mockResolvedValue(bulkResult);

      const result = await service.ingestJobs(rawJobs);

      expect(result.total).toBe(1);
      expect(result.inserted).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('ingestJobsInBatches', () => {
    it('should process jobs in batches', async () => {
      const rawJobs = Array.from({ length: 5 }, (_, i) =>
        createMockRawJob({ id: `job-${i}`, externalId: `ext-${i}` })
      );

      mockTechnologyRepository.findAll.mockResolvedValue([
        new Technology(1, 'React', 'frontend', 'React'),
      ]);

      mockTechDetectorDetect.mockResolvedValue(['React']);
      mockExperienceDetectorDetect.mockResolvedValue('senior');

      mockRegionRepository.findByCode.mockResolvedValue(
        new Region(1, 'IDF', 'IDF', 'Île-de-France')
      );

      const bulkResult: BulkSaveResult = {
        inserted: 2,
        updated: 0,
        failed: 0,
        errors: [],
      };
      mockJobRepository.saveMany.mockResolvedValue(bulkResult);

      const result = await service.ingestJobsInBatches(rawJobs, 2);

      expect(result.batches.length).toBe(3);
      expect(result.summary.totalProcessed).toBe(5);
      expect(mockTechnologyRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it('should handle batch failures gracefully', async () => {
      const rawJobs = Array.from({ length: 3 }, (_, i) =>
        createMockRawJob({ id: `job-${i}`, externalId: `ext-${i}` })
      );

      mockTechnologyRepository.findAll.mockResolvedValue([
        new Technology(1, 'React', 'frontend', 'React'),
      ]);

      mockTechDetectorDetect.mockResolvedValue(['React']);
      mockExperienceDetectorDetect.mockResolvedValue('senior');

      mockRegionRepository.findByCode.mockResolvedValue(
        new Region(1, 'IDF', 'IDF', 'Île-de-France')
      );

      mockJobRepository.saveMany
        .mockResolvedValueOnce({
          inserted: 2,
          updated: 0,
          failed: 0,
          errors: [],
        })
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await service.ingestJobsInBatches(rawJobs, 2);

      expect(result.batches.length).toBe(2);
      expect(result.summary.totalInserted).toBe(2);
      expect(result.summary.totalFailed).toBe(1);
      expect(result.batches[1].errors.length).toBeGreaterThan(0);
    });
  });

  describe('reloadTechnologies', () => {
    it('should reload technologies from database', async () => {
      mockTechnologyRepository.findAll.mockResolvedValue([
        new Technology(1, 'React', 'frontend', 'React'),
      ]);

      await service.reloadTechnologies();

      expect(mockTechnologyRepository.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearTechnologyCache', () => {
    it('should clear cache and reload on next ingestion', async () => {
      const rawJobs = [createMockRawJob()];

      mockTechnologyRepository.findAll.mockResolvedValue([
        new Technology(1, 'React', 'frontend', 'React'),
      ]);

      mockTechDetectorDetect.mockResolvedValue(['React']);
      mockExperienceDetectorDetect.mockResolvedValue('senior');

      mockRegionRepository.findByCode.mockResolvedValue(
        new Region(1, 'IDF', 'IDF', 'Île-de-France')
      );

      const bulkResult: BulkSaveResult = {
        inserted: 1,
        updated: 0,
        failed: 0,
        errors: [],
      };
      mockJobRepository.saveMany.mockResolvedValue(bulkResult);

      await service.ingestJobsWithStats(rawJobs);
      expect(mockTechnologyRepository.findAll).toHaveBeenCalledTimes(1);

      service.clearTechnologyCache();

      await service.ingestJobsWithStats(rawJobs);
      expect(mockTechnologyRepository.findAll).toHaveBeenCalledTimes(2);
    });
  });
});
