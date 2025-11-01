import { Region } from '../../../../src/domain/entities/Region';
import { describe, it, expect } from '@jest/globals';
import { DomainError } from '../../../../src/domain/errors/DomainErrors';

describe('Region Entity', () => {
  describe('Constructor and Validation', () => {
    it('should create region with all properties', () => {
      const region = new Region(11, 'Île-de-France', 'IDF', 'Île-de-France', 500, 12000000);

      expect(region.id).toBe(11);
      expect(region.name).toBe('Île-de-France');
      expect(region.code).toBe('IDF');
      expect(region.fullName).toBe('Île-de-France');
      expect(region.jobCount).toBe(500);
      expect(region.population).toBe(12000000);
    });

    it('should default jobCount to 0 when not provided', () => {
      const region = new Region(84, 'Auvergne-Rhône-Alpes', 'ARA', 'Auvergne-Rhône-Alpes');

      expect(region.jobCount).toBe(0);
    });

    it('should default population to null when not provided', () => {
      const region = new Region(84, 'Auvergne-Rhône-Alpes', 'ARA', 'Auvergne-Rhône-Alpes');

      expect(region.population).toBeNull();
    });

    it('should throw error when name is empty', () => {
      expect(() => {
        new Region(11, '', 'IDF', 'Île-de-France');
      }).toThrow(DomainError);
    });

    it('should throw error when code is invalid', () => {
      expect(() => {
        new Region(99, 'Test Region', 'INVALID', 'Test Region');
      }).toThrow(DomainError);
    });

    it('should accept valid region codes', () => {
      expect(() => {
        new Region(11, 'Île-de-France', 'IDF', 'Île-de-France');
      }).not.toThrow();
    });
  });

  describe('Job Density Calculation', () => {
    it('should calculate job density correctly', () => {
      const region = new Region(11, 'Île-de-France', 'IDF', 'Île-de-France', 12000, 12000000);
      const density = region.getJobDensity();

      expect(density).toBeCloseTo(100, 1);
    });

    it('should return null when population is not provided', () => {
      const region = new Region(11, 'Île-de-France', 'IDF', 'Île-de-France', 500);

      expect(region.getJobDensity()).toBeNull();
    });

    it('should return null when population is zero', () => {
      const region = new Region(11, 'Île-de-France', 'IDF', 'Île-de-France', 500, 0);

      expect(region.getJobDensity()).toBeNull();
    });

    it('should handle high job density', () => {
      const region = new Region(11, 'Île-de-France', 'IDF', 'Île-de-France', 50000, 5000000);
      const density = region.getJobDensity();

      expect(density).toBeGreaterThan(100);
    });

    it('should handle low job density', () => {
      const region = new Region(94, 'Corse', 'COR', 'Corse', 100, 1000000);
      const density = region.getJobDensity();

      expect(density).toBeLessThan(20);
    });
  });

  describe('Region Type Classification', () => {
    it('should classify as major region (>1000 jobs)', () => {
      const region = new Region(11, 'Île-de-France', 'IDF', 'Île-de-France', 5000);

      expect(region.getRegionType()).toBe('major');
    });

    it('should classify as significant region (>300 jobs)', () => {
      const region = new Region(84, 'Auvergne-Rhône-Alpes', 'ARA', 'Auvergne-Rhône-Alpes', 500);

      expect(region.getRegionType()).toBe('significant');
    });

    it('should classify as emerging region (>50 jobs)', () => {
      const region = new Region(32, 'Hauts-de-France', 'HDF', 'Hauts-de-France', 100);

      expect(region.getRegionType()).toBe('emerging');
    });

    it('should classify as small region (<=50 jobs)', () => {
      const region = new Region(94, 'Corse', 'COR', 'Corse', 25);

      expect(region.getRegionType()).toBe('small');
    });

    it('should classify empty region as small', () => {
      const region = new Region(94, 'Corse', 'COR', 'Corse', 0);

      expect(region.getRegionType()).toBe('small');
    });

    it('should handle boundary case of exactly 1000 jobs', () => {
      const region = new Region(11, 'Île-de-France', 'IDF', 'Île-de-France', 1000);

      expect(region.getRegionType()).toBe('significant');
    });

    it('should handle boundary case of exactly 1001 jobs', () => {
      const region = new Region(11, 'Île-de-France', 'IDF', 'Île-de-France', 1001);

      expect(region.getRegionType()).toBe('major');
    });
  });

  describe('Tech Hub Detection', () => {
    it('should identify tech hub with high job density', () => {
      const region = new Region(11, 'Île-de-France', 'IDF', 'Île-de-France', 10000, 10000000);

      expect(region.isTechHub()).toBe(true);
    });

    it('should not identify tech hub with low job density', () => {
      const region = new Region(94, 'Corse', 'COR', 'Corse', 100, 1000000);

      expect(region.isTechHub()).toBe(false);
    });

    it('should return false when population data is missing', () => {
      const region = new Region(11, 'Île-de-France', 'IDF', 'Île-de-France', 10000);

      expect(region.isTechHub()).toBe(false);
    });

    it('should handle boundary case of exactly 50 jobs per 100k', () => {
      const region = new Region(11, 'Île-de-France', 'IDF', 'Île-de-France', 5000, 10000000);

      expect(region.isTechHub()).toBe(false);
    });

    it('should handle boundary case of 51 jobs per 100k', () => {
      const region = new Region(11, 'Île-de-France', 'IDF', 'Île-de-France', 5100, 10000000);

      expect(region.isTechHub()).toBe(true);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle regions with no jobs', () => {
      const emptyRegion = new Region(94, 'Corse', 'COR', 'Corse', 0, 400000);

      expect(emptyRegion.jobCount).toBe(0);
      expect(emptyRegion.getRegionType()).toBe('small');
      expect(emptyRegion.getJobDensity()).toBeCloseTo(0, 1);
      expect(emptyRegion.isTechHub()).toBe(false);
    });

    it('should handle major tech hub like Île-de-France', () => {
      const idf = new Region(11, 'Île-de-France', 'IDF', 'Île-de-France', 10000, 12000000);

      expect(idf.getRegionType()).toBe('major');
      expect(idf.getJobDensity()).toBeGreaterThan(50);
      expect(idf.isTechHub()).toBe(true);
    });

    it('should handle growing tech region', () => {
      const region = new Region(
        84,
        'Auvergne-Rhône-Alpes',
        'ARA',
        'Auvergne-Rhône-Alpes',
        800,
        8000000
      );

      expect(region.getRegionType()).toBe('significant');
      expect(region.getJobDensity()).toBeGreaterThan(0);
    });

    it('should handle small region', () => {
      const smallRegion = new Region(94, 'Corse', 'COR', 'Corse', 15, 400000);

      expect(smallRegion.getRegionType()).toBe('small');
      expect(smallRegion.isTechHub()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large job counts', () => {
      const massiveRegion = new Region(11, 'Île-de-France', 'IDF', 'Île-de-France', 100000);

      expect(massiveRegion.getRegionType()).toBe('major');
      expect(massiveRegion.jobCount).toBe(100000);
    });

    it('should handle very large population', () => {
      const region = new Region(11, 'Île-de-France', 'IDF', 'Île-de-France', 10000, 50000000);

      expect(region.getJobDensity()).toBeLessThan(50);
    });

    it('should handle region name with special characters', () => {
      const region = new Region(11, 'Île-de-France', 'IDF', 'Île-de-France', 500);

      expect(region.name).toBe('Île-de-France');
      expect(region.fullName).toBe('Île-de-France');
    });
  });
});
