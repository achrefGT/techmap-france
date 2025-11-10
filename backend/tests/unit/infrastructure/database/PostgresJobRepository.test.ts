/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PostgresJobRepository } from '../../../../src/infrastructure/persistence/PostgresJobRepository';
import { Job } from '../../../../src/domain/entities/Job';
import { JobFilters } from '../../../../src/domain/repositories/IJobRepository';
import { query } from '../../../../src/infrastructure/persistence/connection';

jest.mock('../../../../src/infrastructure/persistence/connection');

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('PostgresJobRepository', () => {
  let repository: PostgresJobRepository;

  beforeEach(() => {
    repository = new PostgresJobRepository();
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a job when found', async () => {
      const mockRow = {
        id: 'job-1',
        title: 'Software Engineer',
        company: 'TechCorp',
        description: 'Great job',
        technologies: ['React', 'Node.js'],
        location_raw: 'Paris',
        region_id: 1,
        is_remote: true,
        salary_min: 50000,
        salary_max: 70000,
        experience_level: 'mid',
        source_api: 'indeed',
        source_url: 'https://example.com',
        posted_date: '2024-01-15',
        is_active: true,
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await repository.findById('job-1');

      expect(result).toBeInstanceOf(Job);
      expect(result?.id).toBe('job-1');
      expect(result?.title).toBe('Software Engineer');
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM jobs WHERE id = $1', ['job-1']);
    });

    it('should return null when job not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return jobs with pagination', async () => {
      const mockRows = [
        {
          id: 'job-1',
          title: 'Engineer',
          company: 'TechCorp',
          description: 'Job 1',
          technologies: ['React'],
          location_raw: 'Paris',
          region_id: 1,
          is_remote: false,
          salary_min: 50000,
          salary_max: 70000,
          experience_level: 'mid',
          source_api: 'indeed',
          source_url: 'https://example.com',
          posted_date: '2024-01-15',
          is_active: true,
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows, rowCount: 1 } as any);

      const filters: JobFilters = {};
      const result = await repository.findAll(filters, 2, 10);

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        [10, 10]
      );
    });

    it('should apply filters correctly', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const filters: JobFilters = {
        regionId: 5,
        technologies: ['React', 'Node.js'],
        experienceLevel: 'senior',
        isRemote: true,
        minSalary: 60000,
        postedAfter: new Date('2024-01-01'),
      };

      await repository.findAll(filters, 1, 25);

      const call = mockQuery.mock.calls[0];
      const sql = call[0] as string;
      const params = call[1] as any[];

      expect(sql).toContain('j.is_active = true');
      expect(sql).toContain('j.region_id = $1');
      expect(sql).toContain('t2.name = ANY($2)');
      expect(sql).toContain('j.experience_level = $3');
      expect(sql).toContain('j.is_remote = $4');
      expect(sql).toContain('j.salary_min >= $5');
      expect(sql).toContain('j.posted_date >= $6');
      expect(params).toEqual([
        5,
        ['React', 'Node.js'],
        'senior',
        true,
        60000,
        expect.any(Date),
        25,
        0,
      ]);
    });
  });

  describe('count', () => {
    it('should return job count with filters', async () => {
      mockQuery.mockResolvedValue({ rows: [{ count: '42' }], rowCount: 1 } as any);

      const filters: JobFilters = { regionId: 1 };
      const result = await repository.count(filters);

      expect(result).toBe(42);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('COUNT(DISTINCT j.id)'), [1]);
    });
  });

  describe('save', () => {
    it('should save a job with technologies', async () => {
      const job = new Job(
        'job-1',
        'Software Engineer',
        'TechCorp',
        'Great job',
        ['React', 'Node.js'],
        'Paris',
        1,
        true,
        50,
        70,
        'mid',
        'mid',
        'indeed',
        'job-1-external',
        'https://example.com',
        new Date('2024-01-15'),
        true
      );

      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Insert job
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'React' },
            { id: 2, name: 'Node.js' },
          ],
          rowCount: 2,
        } as any) // Get technologies
        .mockResolvedValueOnce({ rows: [], rowCount: 2 } as any); // Insert job_technologies

      await repository.save(job);

      expect(mockQuery).toHaveBeenCalledTimes(3);
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO jobs'),
        expect.arrayContaining(['job-1', 'Software Engineer', 'TechCorp'])
      );
    });

    it('should handle job with single technology', async () => {
      const job = new Job(
        'job-1',
        'Software Engineer',
        'TechCorp',
        'Great job',
        ['JavaScript'],
        'Paris',
        1,
        true,
        50,
        70,
        'mid',
        'mid',
        'indeed',
        'job-1-external',
        'https://example.com',
        new Date('2024-01-15'),
        true
      );

      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Insert job
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'JavaScript' }],
          rowCount: 1,
        } as any) // Get technologies
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // Insert job_technologies

      await repository.save(job);

      expect(mockQuery).toHaveBeenCalledTimes(3);
    });
  });

  describe('saveMany', () => {
    it('should batch insert new jobs and return correct counts', async () => {
      const jobs = [
        new Job(
          'job-1',
          'Engineer 1',
          'Company A',
          'Desc 1',
          ['React'],
          'Paris',
          1,
          false,
          50,
          70,
          'mid',
          'mid',
          'indeed',
          'job-1-external',
          'https://example.com/1',
          new Date('2024-01-15'),
          true
        ),
        new Job(
          'job-2',
          'Engineer 2',
          'Company B',
          'Desc 2',
          ['Node.js'],
          'Lyon',
          2,
          true,
          60,
          80,
          'senior',
          'senior',
          'linkedin',
          'job-2-external',
          'https://example.com/2',
          new Date('2024-01-16'),
          true
        ),
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // Check existing jobs (none found)
        .mockResolvedValueOnce({ rows: [], rowCount: 2 } as any) // Batch insert jobs
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'React' },
            { id: 2, name: 'Node.js' },
          ],
          rowCount: 2,
        } as any) // Get technologies
        .mockResolvedValueOnce({ rows: [], rowCount: 2 } as any); // Batch insert technologies

      const result = await repository.saveMany(jobs);

      expect(result.inserted).toBe(2);
      expect(result.updated).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toEqual([]);
      expect(mockQuery).toHaveBeenCalledTimes(4);

      const insertCall = mockQuery.mock.calls[1];
      const sql = insertCall[0] as string;
      const params = insertCall[1] as any[];

      expect(sql).toContain('INSERT INTO jobs');
      expect(sql).toContain('VALUES');
      expect(params[0]).toBe('job-1');
    });

    it('should detect updated jobs and return correct counts', async () => {
      const jobs = [
        new Job(
          'job-1',
          'Engineer 1',
          'Company A',
          'Desc 1',
          ['React'],
          'Paris',
          1,
          false,
          50,
          70,
          'mid',
          'mid',
          'indeed',
          'job-1-external',
          'https://example.com/1',
          new Date('2024-01-15'),
          true
        ),
        new Job(
          'job-2',
          'Engineer 2',
          'Company B',
          'Desc 2',
          ['Node.js'],
          'Lyon',
          2,
          true,
          60,
          80,
          'senior',
          'senior',
          'linkedin',
          'job-2-external',
          'https://example.com/2',
          new Date('2024-01-16'),
          true
        ),
      ];

      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'job-1' }],
          rowCount: 1,
        } as any) // Check existing jobs (job-1 exists)
        .mockResolvedValueOnce({ rows: [], rowCount: 2 } as any) // Batch insert/update jobs
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'React' },
            { id: 2, name: 'Node.js' },
          ],
          rowCount: 2,
        } as any) // Get technologies
        .mockResolvedValueOnce({ rows: [], rowCount: 2 } as any); // Batch insert technologies

      const result = await repository.saveMany(jobs);

      expect(result.inserted).toBe(1); // job-2 is new
      expect(result.updated).toBe(1); // job-1 exists
      expect(result.failed).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('should handle empty array', async () => {
      const result = await repository.saveMany([]);

      expect(result.inserted).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toEqual([]);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should handle bulk operation failure', async () => {
      const jobs = [
        new Job(
          'job-1',
          'Engineer 1',
          'Company A',
          'Desc 1',
          ['React'],
          'Paris',
          1,
          false,
          50,
          70,
          'mid',
          'mid',
          'indeed',
          'job-1-external',
          'https://example.com/1',
          new Date('2024-01-15'),
          true
        ),
      ];

      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await repository.saveMany(jobs);

      expect(result.inserted).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Bulk save failed: Database connection failed');
    });
  });

  describe('findRecent', () => {
    it('should find jobs posted in last N days', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await repository.findRecent(7);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE j.posted_date > NOW() - $1::interval'),
        ['7 days']
      );
    });
  });

  describe('findByTechnology', () => {
    it('should find jobs by technology ID', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await repository.findByTechnology(5);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE jt.technology_id = $1'),
        [5]
      );
    });
  });

  describe('findByRegion', () => {
    it('should find jobs by region ID', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await repository.findByRegion(3);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE j.region_id = $1'), [
        3,
      ]);
    });
  });

  describe('deactivateOldJobs', () => {
    it('should deactivate jobs older than N days', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 5 } as any);

      const result = await repository.deactivateOldJobs(30);

      expect(result).toBe(5);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE jobs SET is_active = false'),
        ['30 days']
      );
    });

    it('should return 0 when no jobs deactivated', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: null } as any);

      const result = await repository.deactivateOldJobs(30);

      expect(result).toBe(0);
    });
  });
});
