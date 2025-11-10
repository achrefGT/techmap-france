/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PostgresRegionRepository } from '../../../../src/infrastructure/database/PostgresRegionRepository';
import { Region } from '../../../../src/domain/entities/Region';
import { query } from '../../../../src/infrastructure/database/connection';

jest.mock('../../../../src/infrastructure/database/connection');

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('PostgresRegionRepository', () => {
  let repository: PostgresRegionRepository;

  beforeEach(() => {
    repository = new PostgresRegionRepository();
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a region when found', async () => {
      const mockRow = {
        id: 1,
        name: 'Île-de-France',
        code: 'IDF',
        full_name: 'Île-de-France Region',
        job_count: 5000,
        population: 12000000,
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await repository.findById(1);

      expect(result).toBeInstanceOf(Region);
      expect(result?.id).toBe(1);
      expect(result?.name).toBe('Île-de-France');
      expect(result?.code).toBe('IDF');
      expect(result?.fullName).toBe('Île-de-France Region');
      expect(result?.jobCount).toBe(5000);
      expect(result?.population).toBe(12000000);

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM regions WHERE id = $1', [1]);
    });

    it('should return null when region not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });

    it('should handle region with null job_count', async () => {
      const mockRow = {
        id: 2,
        name: 'Brittany',
        code: 'BRE',
        full_name: 'Brittany Region',
        job_count: null,
        population: 3300000,
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await repository.findById(2);

      expect(result?.jobCount).toBe(0);
    });

    it('should handle region with undefined job_count', async () => {
      const mockRow = {
        id: 2,
        name: 'Brittany',
        code: 'BRE',
        full_name: 'Brittany Region',
        job_count: undefined,
        population: 3300000,
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await repository.findById(2);

      expect(result?.jobCount).toBe(0);
    });
  });

  describe('findByCode', () => {
    it('should return a region when found by code', async () => {
      const mockRow = {
        id: 3,
        name: "Provence-Alpes-Côte d'Azur",
        code: 'PAC',
        full_name: "Provence-Alpes-Côte d'Azur Region",
        job_count: 2500,
        population: 5000000,
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await repository.findByCode('PAC');

      expect(result).toBeInstanceOf(Region);
      expect(result?.id).toBe(3);
      expect(result?.code).toBe('PAC');
      expect(result?.name).toBe("Provence-Alpes-Côte d'Azur");

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM regions WHERE code = $1', ['PAC']);
    });

    it('should return null when region code not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await repository.findByCode('INVALID');

      expect(result).toBeNull();
    });

    it('should be case-sensitive for region codes', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await repository.findByCode('pac');

      expect(result).toBeNull();
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM regions WHERE code = $1', ['pac']);
    });
  });

  describe('findAll', () => {
    it('should return all regions ordered by job count', async () => {
      const mockRows = [
        {
          id: 1,
          name: 'Île-de-France',
          code: 'IDF',
          full_name: 'Île-de-France Region',
          job_count: 5000,
          population: 12000000,
        },
        {
          id: 2,
          name: 'Auvergne-Rhône-Alpes',
          code: 'ARA',
          full_name: 'Auvergne-Rhône-Alpes Region',
          job_count: 3000,
          population: 8000000,
        },
        {
          id: 3,
          name: 'Nouvelle-Aquitaine',
          code: 'NAQ',
          full_name: 'Nouvelle-Aquitaine Region',
          job_count: 1500,
          population: 6000000,
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows, rowCount: 3 } as any);

      const result = await repository.findAll();

      expect(result).toHaveLength(3);
      expect(result[0]).toBeInstanceOf(Region);
      expect(result[0].name).toBe('Île-de-France');
      expect(result[0].jobCount).toBe(5000);
      expect(result[1].name).toBe('Auvergne-Rhône-Alpes');
      expect(result[1].jobCount).toBe(3000);
      expect(result[2].name).toBe('Nouvelle-Aquitaine');
      expect(result[2].jobCount).toBe(1500);

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM regions ORDER BY job_count DESC');
    });

    it('should return empty array when no regions exist', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it('should handle regions with zero job count', async () => {
      const mockRows = [
        {
          id: 1,
          name: 'Hauts-de-France',
          code: 'HDF',
          full_name: 'Hauts-de-France Region',
          job_count: 100,
          population: 1000000,
        },
        {
          id: 2,
          name: 'Normandie',
          code: 'NOR',
          full_name: 'Normandie Region',
          job_count: 0,
          population: 500000,
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows, rowCount: 2 } as any);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].jobCount).toBe(100);
      expect(result[1].jobCount).toBe(0);
    });

    it('should handle regions with null job_count', async () => {
      const mockRows = [
        {
          id: 1,
          name: 'Bretagne',
          code: 'BRE',
          full_name: 'Bretagne Region',
          job_count: null,
          population: 1000000,
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows, rowCount: 1 } as any);

      const result = await repository.findAll();

      expect(result[0].jobCount).toBe(0);
    });
  });

  describe('updateJobCount', () => {
    it('should update job count for region', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await repository.updateJobCount(5, 1500);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE regions SET job_count = $2 WHERE id = $1',
        [5, 1500]
      );
    });

    it('should handle updating to zero', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await repository.updateJobCount(10, 0);

      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE regions SET job_count = $2 WHERE id = $1',
        [10, 0]
      );
    });

    it('should handle large job counts', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await repository.updateJobCount(1, 999999);

      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE regions SET job_count = $2 WHERE id = $1',
        [1, 999999]
      );
    });

    it('should not throw error when updating non-existent region', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await expect(repository.updateJobCount(999, 100)).resolves.not.toThrow();

      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE regions SET job_count = $2 WHERE id = $1',
        [999, 100]
      );
    });
  });

  describe('mapToEntity', () => {
    it('should correctly map all fields from database row', async () => {
      const mockRow = {
        id: 7,
        name: 'Occitanie',
        code: 'OCC',
        full_name: 'Occitanie Region',
        job_count: 2200,
        population: 5900000,
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await repository.findById(7);

      expect(result?.id).toBe(7);
      expect(result?.name).toBe('Occitanie');
      expect(result?.code).toBe('OCC');
      expect(result?.fullName).toBe('Occitanie Region');
      expect(result?.jobCount).toBe(2200);
      expect(result?.population).toBe(5900000);
    });

    it('should handle special characters in region names', async () => {
      const mockRow = {
        id: 8,
        name: "Provence-Alpes-Côte d'Azur",
        code: 'PAC',
        full_name: "Provence-Alpes-Côte d'Azur",
        job_count: 1800,
        population: 5000000,
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await repository.findById(8);

      expect(result?.name).toBe("Provence-Alpes-Côte d'Azur");
      expect(result?.fullName).toBe("Provence-Alpes-Côte d'Azur");
    });
  });
});
