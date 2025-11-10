/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PostgresStatsRepository } from '../../../../src/infrastructure/database/PostgresStatsRepository';
import { DailyStatData } from '../../../../src/domain/repositories/IStatsRepository';
import { query } from '../../../../src/infrastructure/database/connection';

jest.mock('../../../../src/infrastructure/database/connection');

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('PostgresStatsRepository', () => {
  let repository: PostgresStatsRepository;

  beforeEach(() => {
    repository = new PostgresStatsRepository();
    jest.clearAllMocks();
  });

  describe('aggregateJobData', () => {
    it('should aggregate job data by region and technology', async () => {
      const mockRows = [
        {
          regionId: 1,
          technologyId: 10,
          jobCount: '25',
          avgSalary: '65000.50',
          remotePercentage: '40.5',
        },
        {
          regionId: 2,
          technologyId: 15,
          jobCount: '15',
          avgSalary: '72000.00',
          remotePercentage: '60.0',
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows, rowCount: 2 } as any);

      const result = await repository.aggregateJobData();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        regionId: 1,
        technologyId: 10,
        jobCount: 25,
        avgSalary: 65000.5,
        remotePercentage: 40.5,
      });
      expect(result[1]).toEqual({
        regionId: 2,
        technologyId: 15,
        jobCount: 15,
        avgSalary: 72000,
        remotePercentage: 60.0,
      });

      const call = mockQuery.mock.calls[0];
      const sql = call[0] as string;

      expect(sql).toContain('SELECT');
      expect(sql).toContain('j.region_id');
      expect(sql).toContain('t.id');
      expect(sql).toContain('COUNT(j.id)');
      expect(sql).toContain('AVG((j.salary_min + j.salary_max) / 2)');
      expect(sql).toContain('FROM jobs j');
      expect(sql).toContain('JOIN job_technologies jt');
      expect(sql).toContain('JOIN technologies t');
      expect(sql).toContain('WHERE j.is_active = true');
      expect(sql).toContain('GROUP BY j.region_id, t.id');
    });

    it('should handle null average salary', async () => {
      const mockRows = [
        {
          regionId: 1,
          technologyId: 10,
          jobCount: '5',
          avgSalary: null,
          remotePercentage: '20.0',
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows, rowCount: 1 } as any);

      const result = await repository.aggregateJobData();

      expect(result).toHaveLength(1);
      expect(result[0].avgSalary).toBeNull();
    });

    it('should return empty array when no data', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await repository.aggregateJobData();

      expect(result).toEqual([]);
    });
  });

  describe('saveDailyStats', () => {
    it('should save daily stats with batch insert', async () => {
      const date = new Date('2024-01-15');
      const stats: DailyStatData[] = [
        {
          regionId: 1,
          technologyId: 10,
          jobCount: 25,
          avgSalary: 65000,
          remotePercentage: 40,
        },
        {
          regionId: 2,
          technologyId: 15,
          jobCount: 15,
          avgSalary: 72000,
          remotePercentage: 60,
        },
      ];

      mockQuery.mockResolvedValue({ rows: [], rowCount: 2 } as any);

      await repository.saveDailyStats(date, stats);

      expect(mockQuery).toHaveBeenCalledTimes(1);

      const call = mockQuery.mock.calls[0];
      const sql = call[0] as string;
      const params = call[1] as any[];

      expect(sql).toContain('INSERT INTO daily_stats');
      expect(sql).toContain('(date, region_id, technology_id, job_count, avg_salary)');
      expect(sql).toContain('VALUES');
      expect(sql).toContain('($1, $2, $3, $4, $5)');
      expect(sql).toContain('($6, $7, $8, $9, $10)');
      expect(sql).toContain('ON CONFLICT (date, region_id, technology_id)');
      expect(sql).toContain('DO UPDATE SET');

      expect(params).toEqual([date, 1, 10, 25, 65000, date, 2, 15, 15, 72000]);
    });

    it('should handle single stat entry', async () => {
      const date = new Date('2024-01-15');
      const stats: DailyStatData[] = [
        {
          regionId: 1,
          technologyId: 10,
          jobCount: 25,
          avgSalary: 65000,
          remotePercentage: 40,
        },
      ];

      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await repository.saveDailyStats(date, stats);

      expect(mockQuery).toHaveBeenCalledTimes(1);

      const call = mockQuery.mock.calls[0];
      const params = call[1] as any[];

      expect(params).toEqual([date, 1, 10, 25, 65000]);
    });

    it('should do nothing when stats array is empty', async () => {
      const date = new Date('2024-01-15');

      await repository.saveDailyStats(date, []);

      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should handle null avgSalary values', async () => {
      const date = new Date('2024-01-15');
      const stats: DailyStatData[] = [
        {
          regionId: 1,
          technologyId: 10,
          jobCount: 5,
          avgSalary: null,
          remotePercentage: 20,
        },
      ];

      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await repository.saveDailyStats(date, stats);

      const call = mockQuery.mock.calls[0];
      const params = call[1] as any[];

      expect(params[4]).toBeNull();
    });
  });

  describe('getStatsForPeriod', () => {
    it('should return technology stats for date range', async () => {
      const mockRows = [
        { technology_id: 10, total: '150' },
        { technology_id: 15, total: '200' },
        { technology_id: 20, total: '75' },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows, rowCount: 3 } as any);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const result = await repository.getStatsForPeriod(startDate, endDate);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(3);
      expect(result.get(10)).toBe(150);
      expect(result.get(15)).toBe(200);
      expect(result.get(20)).toBe(75);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT technology_id, SUM(job_count)'),
        [startDate, endDate]
      );

      const call = mockQuery.mock.calls[0];
      const sql = call[0] as string;

      expect(sql).toContain('FROM daily_stats');
      expect(sql).toContain('WHERE date BETWEEN $1 AND $2');
      expect(sql).toContain('GROUP BY technology_id');
    });

    it('should return empty map when no stats found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const result = await repository.getStatsForPeriod(startDate, endDate);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  describe('getHistoricalData', () => {
    it('should return monthly job counts for technology', async () => {
      const mockRows = [{ count: '100' }, { count: '150' }, { count: '200' }];

      mockQuery.mockResolvedValue({ rows: mockRows, rowCount: 3 } as any);

      const result = await repository.getHistoricalData(10, 3);

      expect(result).toEqual([100, 150, 200]);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT SUM(job_count)'),
        [10, 3]
      );

      const call = mockQuery.mock.calls[0];
      const sql = call[0] as string;

      expect(sql).toContain('FROM daily_stats');
      expect(sql).toContain('WHERE technology_id = $1');
      expect(sql).toContain("AND date >= NOW() - ($2 || ' months')::interval");
      expect(sql).toContain("GROUP BY DATE_TRUNC('month', date)");
      expect(sql).toContain("ORDER BY DATE_TRUNC('month', date) ASC");
    });

    it('should return empty array when no historical data', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await repository.getHistoricalData(10, 6);

      expect(result).toEqual([]);
    });

    it('should handle different month ranges', async () => {
      const mockRows = [
        { count: '50' },
        { count: '60' },
        { count: '70' },
        { count: '80' },
        { count: '90' },
        { count: '100' },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows, rowCount: 6 } as any);

      const result = await repository.getHistoricalData(5, 6);

      expect(result).toHaveLength(6);
      expect(result).toEqual([50, 60, 70, 80, 90, 100]);

      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [5, 6]);
    });
  });
});
