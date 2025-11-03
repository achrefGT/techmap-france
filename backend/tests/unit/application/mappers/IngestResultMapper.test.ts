import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  IngestResultMapper,
  IngestResult,
} from '../../../../src/application/mappers/IngestResultMapper';
import { Job } from '../../../../src/domain/entities/Job';

describe('IngestResultMapper', () => {
  let sampleResult: IngestResult;
  let sampleJobs: Job[];

  beforeEach(() => {
    sampleResult = {
      total: 100,
      inserted: 60,
      updated: 30,
      failed: 10,
      errors: ['Error 1', 'Error 2'],
      startTime: new Date('2024-10-20T10:00:00Z'),
      endTime: new Date('2024-10-20T10:05:00Z'),
      sourceApi: 'linkedin',
    };

    sampleJobs = [
      new Job(
        '1',
        'React Developer',
        'TechCorp',
        'Build modern React applications with TypeScript and best practices. Work with a talented team on exciting projects.',
        ['React', 'TypeScript'],
        'Paris',
        11,
        false,
        50,
        70,
        'Mid',
        'mid',
        'linkedin',
        'ext-1',
        'https://example.com/1',
        new Date('2024-10-20'),
        true
      ),
      new Job(
        '2',
        'Backend Engineer',
        'StartupCo',
        'Short desc',
        ['Node.js'],
        'Lyon',
        84,
        true,
        null,
        null,
        null,
        'mid',
        'indeed',
        'ext-2',
        'https://example.com/2',
        new Date('2024-10-21'),
        true
      ),
    ];
  });

  describe('toDTO', () => {
    it('should convert IngestResult to DTO', () => {
      const dto = IngestResultMapper.toDTO(sampleResult);

      expect(dto.total).toBe(100);
      expect(dto.inserted).toBe(60);
      expect(dto.updated).toBe(30);
      expect(dto.failed).toBe(10);
      expect(dto.errors).toEqual(['Error 1', 'Error 2']);
      expect(dto.sourceApi).toBe('linkedin');
      expect(dto.timestamp).toBeDefined();
    });

    it('should calculate duration in milliseconds', () => {
      const dto = IngestResultMapper.toDTO(sampleResult);

      expect(dto.duration).toBe(5 * 60 * 1000); // 5 minutes
    });

    it('should handle missing duration fields', () => {
      const resultWithoutTime = { ...sampleResult, startTime: undefined, endTime: undefined };
      const dto = IngestResultMapper.toDTO(resultWithoutTime);

      expect(dto.duration).toBeUndefined();
    });

    it('should create a copy of errors array', () => {
      const dto = IngestResultMapper.toDTO(sampleResult);

      sampleResult.errors.push('New Error');
      expect(dto.errors).not.toContain('New Error');
    });

    it('should include timestamp in ISO format', () => {
      const dto = IngestResultMapper.toDTO(sampleResult);

      expect(dto.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('toStatsDTO', () => {
    it('should create stats with quality metrics', () => {
      const stats = IngestResultMapper.toStatsDTO(sampleResult, sampleJobs, ['Vue.js', 'Angular']);

      expect(stats.result.total).toBe(100);
      expect(stats.qualityStats.averageQualityScore).toBeGreaterThan(0);
      expect(stats.qualityStats.highQualityJobs).toBeGreaterThanOrEqual(0);
      expect(stats.qualityStats.mediumQualityJobs).toBeGreaterThanOrEqual(0);
      expect(stats.qualityStats.lowQualityJobs).toBeGreaterThanOrEqual(0);
    });

    it('should categorize quality scores correctly', () => {
      const stats = IngestResultMapper.toStatsDTO(sampleResult, sampleJobs, []);

      const total =
        stats.qualityStats.highQualityJobs +
        stats.qualityStats.mediumQualityJobs +
        stats.qualityStats.lowQualityJobs;

      expect(total).toBe(sampleJobs.length);
    });

    it('should calculate data completeness', () => {
      const stats = IngestResultMapper.toStatsDTO(sampleResult, sampleJobs, []);

      expect(stats.dataCompleteness.withSalary).toBe(1);
      expect(stats.dataCompleteness.withRegion).toBe(2);
      expect(stats.dataCompleteness.withExperience).toBe(1);
      expect(stats.dataCompleteness.withDescription).toBe(1);
    });

    it('should count descriptions longer than 100 chars', () => {
      const stats = IngestResultMapper.toStatsDTO(sampleResult, sampleJobs, []);

      expect(stats.dataCompleteness.withDescription).toBe(1);
    });

    it('should collect technology statistics', () => {
      const stats = IngestResultMapper.toStatsDTO(sampleResult, sampleJobs, ['Vue.js']);

      expect(stats.technologyStats.totalTechnologies).toBe(3);
      expect(stats.technologyStats.newTechnologies).toBe(1);
      expect(stats.technologyStats.topTechnologies.length).toBeGreaterThan(0);
    });

    it('should limit top technologies to 10', () => {
      const manyTechJobs = Array.from(
        { length: 15 },
        (_, i) =>
          new Job(
            `job-${i}`,
            `Job ${i}`,
            'Company',
            'Description',
            [`Tech-${i}`],
            'Paris',
            11,
            false,
            50,
            70,
            'Mid',
            'mid',
            'linkedin',
            `ext-${i}`,
            'https://example.com',
            new Date(),
            true
          )
      );

      const stats = IngestResultMapper.toStatsDTO(sampleResult, manyTechJobs, []);

      expect(stats.technologyStats.topTechnologies.length).toBeLessThanOrEqual(10);
    });

    it('should sort top technologies by count descending', () => {
      const stats = IngestResultMapper.toStatsDTO(sampleResult, sampleJobs, []);

      const counts = stats.technologyStats.topTechnologies.map(t => t.count);
      const sortedCounts = [...counts].sort((a, b) => b - a);

      expect(counts).toEqual(sortedCounts);
    });

    it('should handle empty jobs array', () => {
      const stats = IngestResultMapper.toStatsDTO(sampleResult, [], []);

      expect(stats.qualityStats.averageQualityScore).toBe(0);
      expect(stats.dataCompleteness.withSalary).toBe(0);
      expect(stats.technologyStats.totalTechnologies).toBe(0);
    });

    it('should round average quality score to 1 decimal', () => {
      const stats = IngestResultMapper.toStatsDTO(sampleResult, sampleJobs, []);

      expect(stats.qualityStats.averageQualityScore.toString()).toMatch(/^\d+\.\d$/);
    });
  });

  describe('toBatchDTO', () => {
    let batchResults: IngestResult[];

    beforeEach(() => {
      batchResults = [
        {
          total: 50,
          inserted: 30,
          updated: 15,
          failed: 5,
          errors: ['Batch 1 error'],
          startTime: new Date('2024-10-20T10:00:00Z'),
          endTime: new Date('2024-10-20T10:03:00Z'),
          sourceApi: 'linkedin',
        },
        {
          total: 50,
          inserted: 30,
          updated: 15,
          failed: 5,
          errors: ['Batch 2 error'],
          startTime: new Date('2024-10-20T10:05:00Z'),
          endTime: new Date('2024-10-20T10:07:00Z'),
          sourceApi: 'indeed',
        },
      ];
    });

    it('should aggregate batch results', () => {
      const batchDTO = IngestResultMapper.toBatchDTO(batchResults);

      expect(batchDTO.summary.totalProcessed).toBe(100);
      expect(batchDTO.summary.totalInserted).toBe(60);
      expect(batchDTO.summary.totalUpdated).toBe(30);
      expect(batchDTO.summary.totalFailed).toBe(10);
    });

    it('should calculate total and average duration', () => {
      const batchDTO = IngestResultMapper.toBatchDTO(batchResults);

      expect(batchDTO.summary.totalDuration).toBeGreaterThan(0);
      expect(batchDTO.summary.averageBatchDuration).toBeGreaterThan(0);
    });

    it('should collect all errors from batches', () => {
      const batchDTO = IngestResultMapper.toBatchDTO(batchResults);

      expect(batchDTO.errors).toContain('Batch 1 error');
      expect(batchDTO.errors).toContain('Batch 2 error');
      expect(batchDTO.errors).toHaveLength(2);
    });

    it('should include individual batch DTOs', () => {
      const batchDTO = IngestResultMapper.toBatchDTO(batchResults);

      expect(batchDTO.batches).toHaveLength(2);
      expect(batchDTO.batches[0].total).toBe(50);
      expect(batchDTO.batches[1].total).toBe(50);
    });

    it('should handle batches without timing data', () => {
      const noDurationBatches = batchResults.map(r => ({
        ...r,
        startTime: undefined,
        endTime: undefined,
      }));

      const batchDTO = IngestResultMapper.toBatchDTO(noDurationBatches);

      expect(batchDTO.summary.totalDuration).toBe(0);
      expect(batchDTO.summary.averageBatchDuration).toBe(0);
    });

    it('should handle empty batch array', () => {
      const batchDTO = IngestResultMapper.toBatchDTO([]);

      expect(batchDTO.summary.totalProcessed).toBe(0);
      expect(batchDTO.batches).toHaveLength(0);
      expect(batchDTO.errors).toHaveLength(0);
    });
  });

  describe('toDeduplicationStatsDTO', () => {
    let originalJobs: Job[];
    let deduplicatedJobs: Job[];

    beforeEach(() => {
      originalJobs = [
        ...sampleJobs,
        new Job(
          '3',
          'Duplicate Job',
          'TechCorp',
          'Description',
          ['React'],
          'Paris',
          11,
          false,
          50,
          70,
          'Mid',
          'mid',
          'linkedin',
          'ext-3',
          'https://example.com/3',
          new Date(),
          true
        ),
      ];

      deduplicatedJobs = [...sampleJobs];
      // Add multi-source job
      deduplicatedJobs[0].mergeFrom(
        new Job(
          '4',
          'React Developer',
          'TechCorp',
          'Description',
          ['React'],
          'Paris',
          11,
          false,
          50,
          70,
          'Mid',
          'mid',
          'indeed',
          'ext-4',
          'https://example.com/4',
          new Date(),
          true
        )
      );
    });

    it('should calculate deduplication statistics', () => {
      const stats = IngestResultMapper.toDeduplicationStatsDTO(originalJobs, deduplicatedJobs);

      expect(stats.originalCount).toBe(3);
      expect(stats.deduplicatedCount).toBe(2);
      expect(stats.duplicatesRemoved).toBe(1);
    });

    it('should calculate duplicate rate percentage', () => {
      const stats = IngestResultMapper.toDeduplicationStatsDTO(originalJobs, deduplicatedJobs);

      expect(stats.duplicateRate).toBeCloseTo(33.33, 2);
    });

    it('should count multi-source jobs', () => {
      const stats = IngestResultMapper.toDeduplicationStatsDTO(originalJobs, deduplicatedJobs);

      expect(stats.multiSourceJobs).toBeGreaterThanOrEqual(1);
    });

    it('should calculate multi-source rate', () => {
      const stats = IngestResultMapper.toDeduplicationStatsDTO(originalJobs, deduplicatedJobs);

      expect(stats.multiSourceRate).toBeGreaterThan(0);
      expect(stats.multiSourceRate).toBeLessThanOrEqual(100);
    });

    it('should calculate average quality score', () => {
      const stats = IngestResultMapper.toDeduplicationStatsDTO(originalJobs, deduplicatedJobs);

      expect(stats.averageQualityScore).toBeGreaterThan(0);
      expect(stats.averageQualityScore.toString()).toMatch(/^\d+\.\d$/);
    });

    it('should create source breakdown', () => {
      const stats = IngestResultMapper.toDeduplicationStatsDTO(originalJobs, deduplicatedJobs);

      expect(stats.sourceBreakdown).toHaveProperty('linkedin');
      expect(stats.sourceBreakdown).toHaveProperty('indeed');
    });

    it('should handle empty arrays', () => {
      const stats = IngestResultMapper.toDeduplicationStatsDTO([], []);

      expect(stats.originalCount).toBe(0);
      expect(stats.deduplicatedCount).toBe(0);
      expect(stats.duplicatesRemoved).toBe(0);
      expect(stats.duplicateRate).toBe(0);
      expect(stats.averageQualityScore).toBe(0);
    });

    it('should handle no duplicates case', () => {
      const stats = IngestResultMapper.toDeduplicationStatsDTO(sampleJobs, sampleJobs);

      expect(stats.duplicatesRemoved).toBe(0);
      expect(stats.duplicateRate).toBe(0);
    });
  });
});
