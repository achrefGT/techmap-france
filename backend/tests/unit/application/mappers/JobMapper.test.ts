import { describe, it, expect, beforeEach } from '@jest/globals';
import { JobMapper } from '../../../../src/application/mappers/JobMapper';
import { Job } from '../../../../src/domain/entities/Job';
import { JobDTO, JobFiltersDTO } from '../../../../src/application/dtos/JobDTO';

describe('JobMapper', () => {
  let sampleJob: Job;

  beforeEach(() => {
    sampleJob = new Job(
      '1',
      'React Developer',
      'TechCorp',
      'Build modern React applications',
      ['React', 'TypeScript'],
      'Paris',
      11,
      false,
      50,
      70,
      'Mid',
      'mid',
      'linkedin',
      'ext-123',
      'https://linkedin.com/jobs/1',
      new Date('2024-10-20'),
      true
    );
  });

  describe('toDTO', () => {
    it('should convert Job entity to full DTO', () => {
      const dto = JobMapper.toDTO(sampleJob);

      expect(dto.id).toBe('1');
      expect(dto.title).toBe('React Developer');
      expect(dto.company).toBe('TechCorp');
      expect(dto.description).toBe('Build modern React applications');
      expect(dto.technologies).toEqual(['React', 'TypeScript']);
      expect(dto.location).toBe('Paris');
      expect(dto.regionId).toBe(11);
      expect(dto.isRemote).toBe(false);
      expect(dto.experienceLevel).toBe('Mid');
      expect(dto.experienceCategory).toBe('mid');
      expect(dto.sourceApi).toBe('linkedin');
      expect(dto.externalId).toBe('ext-123');
      expect(dto.sourceUrl).toBe('https://linkedin.com/jobs/1');
      expect(dto.isActive).toBe(true);
    });

    it('should include salary data when present', () => {
      const dto = JobMapper.toDTO(sampleJob);

      expect(dto.salary).not.toBeNull();
      expect(dto.salary?.min).toBe(50);
      expect(dto.salary?.max).toBe(70);
      expect(dto.salary?.midpoint).toBe(60);
      expect(dto.salary?.unit).toBe('k€');
      expect(dto.salary?.currency).toBe('EUR');
      expect(typeof dto.salary?.isCompetitive).toBe('boolean');
    });

    it('should return null salary when data missing', () => {
      const noSalaryJob = new Job(
        '2',
        'Test Job',
        'TestCo',
        'Test',
        ['Java'],
        'Lyon',
        84,
        false,
        null,
        null,
        'Mid',
        'mid',
        'linkedin',
        'ext-456',
        'https://example.com',
        new Date(),
        true
      );

      const dto = JobMapper.toDTO(noSalaryJob);
      expect(dto.salary).toBeNull();
    });

    it('should include computed properties', () => {
      const dto = JobMapper.toDTO(sampleJob);

      expect(typeof dto.qualityScore).toBe('number');
      expect(typeof dto.isRecent).toBe('boolean');
      expect(typeof dto.isExpired).toBe('boolean');
    });

    it('should format dates as ISO strings', () => {
      const dto = JobMapper.toDTO(sampleJob);

      expect(dto.postedDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(dto.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(dto.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should copy arrays to prevent mutation', () => {
      const dto = JobMapper.toDTO(sampleJob);

      dto.technologies.push('Vue.js');
      expect(sampleJob.technologies).not.toContain('Vue.js');

      dto.sourceApis.push('indeed');
      expect(sampleJob.sourceApis.length).toBe(1);
    });
  });

  describe('toSummaryDTO', () => {
    it('should convert to lightweight summary', () => {
      const summary = JobMapper.toSummaryDTO(sampleJob);

      expect(summary.id).toBe('1');
      expect(summary.title).toBe('React Developer');
      expect(summary.company).toBe('TechCorp');
      expect(summary.location).toBe('Paris');
      expect(summary.isRemote).toBe(false);
      expect(summary.technologies).toEqual(['React', 'TypeScript']);
      expect(summary.experienceCategory).toBe('mid');
    });

    it('should include salary and quality score', () => {
      const summary = JobMapper.toSummaryDTO(sampleJob);

      expect(summary.salary).not.toBeNull();
      expect(summary.qualityScore).toBeGreaterThan(0);
    });

    it('should not include full details', () => {
      const summary = JobMapper.toSummaryDTO(sampleJob);

      expect(summary).not.toHaveProperty('description');
      expect(summary).not.toHaveProperty('sourceApi');
      expect(summary).not.toHaveProperty('externalId');
    });

    it('should copy technologies array', () => {
      const summary = JobMapper.toSummaryDTO(sampleJob);

      summary.technologies.push('Angular');
      expect(sampleJob.technologies).not.toContain('Angular');
    });
  });

  describe('toDTOs', () => {
    it('should convert array of jobs to DTOs', () => {
      const jobs = [
        sampleJob,
        new Job(
          '2',
          'Backend Developer',
          'StartupCo',
          'Build APIs',
          ['Node.js'],
          'Lyon',
          84,
          true,
          60,
          80,
          'Senior',
          'senior',
          'indeed',
          'ext-789',
          'https://indeed.com/jobs/2',
          new Date(),
          true
        ),
      ];

      const dtos = JobMapper.toDTOs(jobs);

      expect(dtos).toHaveLength(2);
      expect(dtos[0].id).toBe('1');
      expect(dtos[1].id).toBe('2');
    });

    it('should handle empty array', () => {
      const dtos = JobMapper.toDTOs([]);
      expect(dtos).toHaveLength(0);
    });
  });

  describe('toSummaryDTOs', () => {
    it('should convert array of jobs to summaries', () => {
      const jobs = [sampleJob];
      const summaries = JobMapper.toSummaryDTOs(jobs);

      expect(summaries).toHaveLength(1);
      expect(summaries[0].id).toBe('1');
      expect(summaries[0]).not.toHaveProperty('description');
    });
  });

  describe('toPaginatedDTO', () => {
    let jobs: Job[];
    let filters: JobFiltersDTO;

    beforeEach(() => {
      jobs = Array.from(
        { length: 5 },
        (_, i) =>
          new Job(
            `job-${i}`,
            `Job ${i}`,
            'Company',
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
            `ext-${i}`,
            'https://example.com',
            new Date(),
            true
          )
      );

      filters = {
        technologies: ['React'],
        experienceCategories: ['mid'],
        regionIds: [11],
        isRemote: undefined,
        minSalary: undefined,
        maxSalary: undefined,
        isActive: true,
      };
    });

    it('should create paginated response', () => {
      const paginated = JobMapper.toPaginatedDTO(jobs, 50, 1, 10, filters);

      expect(paginated.jobs).toHaveLength(5);
      expect(paginated.pagination.page).toBe(1);
      expect(paginated.pagination.pageSize).toBe(10);
      expect(paginated.pagination.totalItems).toBe(50);
      expect(paginated.pagination.totalPages).toBe(5);
      expect(paginated.filters).toEqual(filters);
    });

    it('should calculate pagination flags correctly', () => {
      const firstPage = JobMapper.toPaginatedDTO(jobs, 50, 1, 10, filters);
      expect(firstPage.pagination.hasPrevious).toBe(false);
      expect(firstPage.pagination.hasNext).toBe(true);

      const middlePage = JobMapper.toPaginatedDTO(jobs, 50, 3, 10, filters);
      expect(middlePage.pagination.hasPrevious).toBe(true);
      expect(middlePage.pagination.hasNext).toBe(true);

      const lastPage = JobMapper.toPaginatedDTO(jobs, 50, 5, 10, filters);
      expect(lastPage.pagination.hasPrevious).toBe(true);
      expect(lastPage.pagination.hasNext).toBe(false);
    });

    it('should handle single page results', () => {
      const paginated = JobMapper.toPaginatedDTO(jobs, 5, 1, 10, filters);

      expect(paginated.pagination.totalPages).toBe(1);
      expect(paginated.pagination.hasNext).toBe(false);
      expect(paginated.pagination.hasPrevious).toBe(false);
    });

    it('should calculate total pages correctly', () => {
      const paginated = JobMapper.toPaginatedDTO(jobs, 25, 1, 10, filters);
      expect(paginated.pagination.totalPages).toBe(3);
    });
  });

  describe('fromDTO', () => {
    let existingJob: Job;
    let partialDTO: Partial<JobDTO>;

    beforeEach(() => {
      existingJob = sampleJob;
      partialDTO = {
        title: 'Updated Title',
        company: 'Updated Company',
        description: 'Updated description',
      };
    });

    it('should update mutable fields from DTO', () => {
      const updated = JobMapper.fromDTO(partialDTO, existingJob);

      expect(updated.title).toBe('Updated Title');
      expect(updated.company).toBe('Updated Company');
      expect(updated.description).toBe('Updated description');
    });

    it('should preserve immutable fields', () => {
      const updated = JobMapper.fromDTO(partialDTO, existingJob);

      expect(updated.id).toBe(existingJob.id);
      expect(updated.sourceApi).toBe(existingJob.sourceApi);
      expect(updated.externalId).toBe(existingJob.externalId);
      expect(updated.postedDate).toEqual(existingJob.postedDate);
      expect(updated.createdAt).toEqual(existingJob.createdAt);
      expect(updated.experienceCategory).toBe(existingJob.experienceCategory);
    });

    it('should update salary data', () => {
      const dtoWithSalary: Partial<JobDTO> = {
        salary: {
          min: 60,
          max: 90,
          midpoint: 75,
          unit: 'k€',
          currency: 'EUR',
          isCompetitive: true,
        },
      };

      const updated = JobMapper.fromDTO(dtoWithSalary, existingJob);

      expect(updated.salaryMinKEuros).toBe(60);
      expect(updated.salaryMaxKEuros).toBe(90);
    });

    it('should update technologies array', () => {
      const dtoWithTech: Partial<JobDTO> = {
        technologies: ['React', 'Vue.js', 'Angular'],
      };

      const updated = JobMapper.fromDTO(dtoWithTech, existingJob);
      expect(updated.technologies).toEqual(['React', 'Vue.js', 'Angular']);
    });

    it('should update updatedAt timestamp', () => {
      const beforeUpdate = new Date();
      const updated = JobMapper.fromDTO(partialDTO, existingJob);

      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it('should use existing values for undefined DTO fields', () => {
      const minimalDTO: Partial<JobDTO> = {
        title: 'New Title',
      };

      const updated = JobMapper.fromDTO(minimalDTO, existingJob);

      expect(updated.title).toBe('New Title');
      expect(updated.company).toBe(existingJob.company);
      expect(updated.description).toBe(existingJob.description);
      expect(updated.location).toBe(existingJob.location);
    });

    it('should handle isActive updates', () => {
      const dtoDeactivated: Partial<JobDTO> = {
        isActive: false,
      };

      const updated = JobMapper.fromDTO(dtoDeactivated, existingJob);
      expect(updated.isActive).toBe(false);
    });
  });
});
