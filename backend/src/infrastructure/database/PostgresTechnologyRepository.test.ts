/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PostgresTechnologyRepository } from './PostgresTechnologyRepository';
import { Technology } from '../../domain/entities/Technology';
import { query } from './connection';

jest.mock('./connection');

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('PostgresTechnologyRepository', () => {
  let repository: PostgresTechnologyRepository;

  beforeEach(() => {
    repository = new PostgresTechnologyRepository();
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a technology when found', async () => {
      const mockRow = {
        id: 1,
        name: 'React',
        category: 'frontend',
        display_name: 'React.js',
        job_count: 150,
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await repository.findById(1);

      expect(result).toBeInstanceOf(Technology);
      expect(result?.id).toBe(1);
      expect(result?.name).toBe('React');
      expect(result?.category).toBe('frontend');
      expect(result?.displayName).toBe('React.js');
      expect(result?.jobCount).toBe(150);
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM technologies WHERE id = $1', [1]);
    });

    it('should return null when technology not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByName', () => {
    it('should return a technology by name', async () => {
      const mockRow = {
        id: 2,
        name: 'Python',
        category: 'backend',
        display_name: 'Python',
        job_count: 200,
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await repository.findByName('Python');

      expect(result).toBeInstanceOf(Technology);
      expect(result?.name).toBe('Python');
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM technologies WHERE name = $1', [
        'Python',
      ]);
    });

    it('should return null when technology not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await repository.findByName('NonExistent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all technologies ordered by job count and name', async () => {
      const mockRows = [
        {
          id: 1,
          name: 'React',
          category: 'frontend',
          display_name: 'React.js',
          job_count: 150,
        },
        {
          id: 2,
          name: 'Vue',
          category: 'frontend',
          display_name: 'Vue.js',
          job_count: 100,
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows, rowCount: 2 } as any);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Technology);
      expect(result[0].name).toBe('React');
      expect(result[1].name).toBe('Vue');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY job_count DESC, name ASC')
      );
    });

    it('should return empty array when no technologies exist', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it('should handle technologies with zero job count', async () => {
      const mockRows = [
        {
          id: 3,
          name: 'Rust',
          category: 'backend',
          display_name: 'Rust',
          job_count: 0,
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows, rowCount: 1 } as any);

      const result = await repository.findAll();

      expect(result[0].jobCount).toBe(0);
    });
  });

  describe('findByCategory', () => {
    it('should return technologies filtered by category', async () => {
      const mockRows = [
        {
          id: 1,
          name: 'React',
          category: 'frontend',
          display_name: 'React.js',
          job_count: 150,
        },
        {
          id: 4,
          name: 'Angular',
          category: 'frontend',
          display_name: 'Angular',
          job_count: 120,
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows, rowCount: 2 } as any);

      const result = await repository.findByCategory('frontend');

      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('frontend');
      expect(result[1].category).toBe('frontend');
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE category = $1'), [
        'frontend',
      ]);
    });

    it('should return empty array when no technologies in category', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await repository.findByCategory('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('save', () => {
    it('should insert a new technology', async () => {
      const technology = new Technology(1, 'TypeScript', 'language', 'TypeScript', 75);

      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await repository.save(technology);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO technologies'), [
        1,
        'TypeScript',
        'language',
        'TypeScript',
        75,
      ]);
    });

    it('should update existing technology on conflict', async () => {
      const technology = new Technology(1, 'React', 'frontend', 'React.js', 200);

      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await repository.save(technology);

      const call = mockQuery.mock.calls[0];
      const sql = call[0] as string;

      expect(sql).toContain('ON CONFLICT (name) DO UPDATE');
      expect(sql).toContain('SET category = EXCLUDED.category');
    });

    it('should handle technology with zero job count', async () => {
      const technology = new Technology(5, 'NewTech', 'emerging', 'New Technology', 0);

      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await repository.save(technology);

      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining([0]));
    });
  });

  describe('updateJobCount', () => {
    it('should update job count for a technology', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await repository.updateJobCount(1, 250);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE technologies'),
        [1, 250]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SET job_count = $2'),
        [1, 250]
      );
    });

    it('should update job count to zero', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await repository.updateJobCount(2, 0);

      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [2, 0]);
    });

    it('should handle large job counts', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await repository.updateJobCount(3, 10000);

      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [3, 10000]);
    });
  });

  describe('mapToEntity', () => {
    it('should handle missing job_count field', async () => {
      const mockRow = {
        id: 6,
        name: 'NewFramework',
        category: 'frontend',
        display_name: 'New Framework',
        job_count: null,
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await repository.findById(6);

      expect(result?.jobCount).toBe(0);
    });
  });
});
