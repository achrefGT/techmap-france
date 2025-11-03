import { describe, it, expect, beforeEach } from '@jest/globals';
import { RegionMapper } from '../../../../src/application/mappers/RegionMapper';
import { Region } from '../../../../src/domain/entities/Region';

describe('RegionMapper', () => {
  let sampleRegion: Region;

  beforeEach(() => {
    sampleRegion = new Region(
      11,
      'Île-de-France',
      'IDF',
      'Île-de-France (Paris Region)',
      1500,
      12000000
    );
  });

  describe('toDTO', () => {
    it('should convert Region entity to DTO', () => {
      const dto = RegionMapper.toDTO(sampleRegion);

      expect(dto.id).toBe(11);
      expect(dto.name).toBe('Île-de-France');
      expect(dto.code).toBe('IDF');
      expect(dto.fullName).toBe('Île-de-France (Paris Region)');
      expect(dto.jobCount).toBe(1500);
      expect(dto.population).toBe(12000000);
    });

    it('should include computed properties', () => {
      const dto = RegionMapper.toDTO(sampleRegion);

      expect(dto.jobDensity).not.toBeNull();
      expect(dto.regionType).toBe('major');
      expect(typeof dto.isTechHub).toBe('boolean');
    });

    it('should calculate job density correctly', () => {
      const dto = RegionMapper.toDTO(sampleRegion);
      const expectedDensity = (1500 / 12000000) * 100000;

      expect(dto.jobDensity).toBeCloseTo(expectedDensity, 2);
    });

    it('should handle null population', () => {
      const regionNoPopulation = new Region(
        84,
        'Auvergne-Rhône-Alpes',
        'ARA',
        'Auvergne-Rhône-Alpes',
        300,
        null
      );

      const dto = RegionMapper.toDTO(regionNoPopulation);
      expect(dto.jobDensity).toBeNull();
    });

    it('should determine correct region type', () => {
      const major = new Region(1, 'Major', 'IDF', 'Major Region', 1500, 1000000);
      expect(RegionMapper.toDTO(major).regionType).toBe('major');

      const significant = new Region(2, 'Significant', 'ARA', 'Significant Region', 500, 1000000);
      expect(RegionMapper.toDTO(significant).regionType).toBe('significant');

      const emerging = new Region(3, 'Emerging', 'NAQ', 'Emerging Region', 100, 1000000);
      expect(RegionMapper.toDTO(emerging).regionType).toBe('emerging');

      const small = new Region(4, 'Small', 'OCC', 'Small Region', 20, 1000000);
      expect(RegionMapper.toDTO(small).regionType).toBe('small');
    });

    it('should identify tech hubs', () => {
      const techHub = new Region(11, 'Tech Hub', 'IDF', 'Tech Hub', 1000, 1000000);
      expect(RegionMapper.toDTO(techHub).isTechHub).toBe(true);

      const notTechHub = new Region(84, 'Not Hub', 'ARA', 'Not Hub', 100, 10000000);
      expect(RegionMapper.toDTO(notTechHub).isTechHub).toBe(false);
    });
  });

  describe('toDTOs', () => {
    it('should convert array of regions to DTOs', () => {
      const regions = [
        sampleRegion,
        new Region(84, 'Auvergne-Rhône-Alpes', 'ARA', 'Auvergne-Rhône-Alpes', 400, 8000000),
      ];

      const dtos = RegionMapper.toDTOs(regions);

      expect(dtos).toHaveLength(2);
      expect(dtos[0].id).toBe(11);
      expect(dtos[1].id).toBe(84);
    });

    it('should handle empty array', () => {
      const dtos = RegionMapper.toDTOs([]);
      expect(dtos).toHaveLength(0);
    });
  });

  describe('toStatsDTO', () => {
    let topTechnologies: Array<{
      technologyId: number;
      technologyName: string;
      jobCount: number;
    }>;
    let topCompanies: Array<{
      companyName: string;
      jobCount: number;
    }>;
    let experienceDistribution: {
      junior: number;
      mid: number;
      senior: number;
      lead: number;
    };

    beforeEach(() => {
      topTechnologies = [
        { technologyId: 1, technologyName: 'React', jobCount: 500 },
        { technologyId: 2, technologyName: 'Node.js', jobCount: 300 },
      ];

      topCompanies = [
        { companyName: 'TechCorp', jobCount: 100 },
        { companyName: 'StartupCo', jobCount: 50 },
      ];

      experienceDistribution = {
        junior: 200,
        mid: 600,
        senior: 500,
        lead: 200,
      };
    });

    it('should create comprehensive region stats', () => {
      const stats = RegionMapper.toStatsDTO(
        sampleRegion,
        topTechnologies,
        75000,
        { min: 40000, max: 120000 },
        25.5,
        experienceDistribution,
        topCompanies
      );

      expect(stats.region.id).toBe(11);
      expect(stats.topTechnologies).toHaveLength(2);
      expect(stats.averageSalary).toBe(75000);
      expect(stats.salaryRange).toEqual({ min: 40000, max: 120000 });
      expect(stats.remoteJobsPercentage).toBe(25.5);
      expect(stats.experienceDistribution).toEqual(experienceDistribution);
      expect(stats.topCompanies).toEqual(topCompanies);
    });

    it('should calculate technology percentages', () => {
      const stats = RegionMapper.toStatsDTO(
        sampleRegion,
        topTechnologies,
        null,
        null,
        0,
        experienceDistribution,
        []
      );

      expect(stats.topTechnologies[0].percentage).toBeCloseTo(33.33, 2);
      expect(stats.topTechnologies[1].percentage).toBeCloseTo(20, 2);
    });

    it('should round average salary', () => {
      const stats = RegionMapper.toStatsDTO(
        sampleRegion,
        [],
        75432.789,
        null,
        0,
        experienceDistribution,
        []
      );

      expect(stats.averageSalary).toBe(75433);
    });

    it('should handle null average salary', () => {
      const stats = RegionMapper.toStatsDTO(
        sampleRegion,
        [],
        null,
        null,
        0,
        experienceDistribution,
        []
      );

      expect(stats.averageSalary).toBeNull();
    });

    it('should round salary range values', () => {
      const stats = RegionMapper.toStatsDTO(
        sampleRegion,
        [],
        null,
        { min: 40123.456, max: 119876.543 },
        0,
        experienceDistribution,
        []
      );

      expect(stats.salaryRange?.min).toBe(40123);
      expect(stats.salaryRange?.max).toBe(119877);
    });

    it('should handle null salary range', () => {
      const stats = RegionMapper.toStatsDTO(
        sampleRegion,
        [],
        null,
        null,
        0,
        experienceDistribution,
        []
      );

      expect(stats.salaryRange).toBeNull();
    });

    it('should round remote jobs percentage', () => {
      const stats = RegionMapper.toStatsDTO(
        sampleRegion,
        [],
        null,
        null,
        33.333333,
        experienceDistribution,
        []
      );

      expect(stats.remoteJobsPercentage).toBe(33.33);
    });
  });

  describe('toComparisonDTO', () => {
    let regions: Region[];
    let jobCounts: Map<string, number>;
    let averageSalaries: Map<string, number>;
    let topTechnologies: Map<string, string[]>;

    beforeEach(() => {
      regions = [
        sampleRegion,
        new Region(84, 'Auvergne-Rhône-Alpes', 'ARA', 'Auvergne-Rhône-Alpes', 400, 8000000),
      ];

      jobCounts = new Map([
        ['Île-de-France', 1500],
        ['Auvergne-Rhône-Alpes', 400],
      ]);

      averageSalaries = new Map([
        ['Île-de-France', 75000],
        ['Auvergne-Rhône-Alpes', 65000],
      ]);

      topTechnologies = new Map([
        ['Île-de-France', ['React', 'Node.js', 'TypeScript']],
        ['Auvergne-Rhône-Alpes', ['Java', 'Spring', 'Angular']],
      ]);
    });

    it('should create comparison DTO', () => {
      const comparison = RegionMapper.toComparisonDTO(
        regions,
        jobCounts,
        averageSalaries,
        topTechnologies
      );

      expect(comparison.regions).toHaveLength(2);
      expect(comparison.comparison.jobCounts).toEqual({
        'Île-de-France': 1500,
        'Auvergne-Rhône-Alpes': 400,
      });
      expect(comparison.comparison.averageSalaries).toEqual({
        'Île-de-France': 75000,
        'Auvergne-Rhône-Alpes': 65000,
      });
      expect(comparison.comparison.topTechnologies).toEqual({
        'Île-de-France': ['React', 'Node.js', 'TypeScript'],
        'Auvergne-Rhône-Alpes': ['Java', 'Spring', 'Angular'],
      });
    });

    it('should handle empty regions', () => {
      const comparison = RegionMapper.toComparisonDTO([], new Map(), new Map(), new Map());

      expect(comparison.regions).toHaveLength(0);
      expect(comparison.comparison.jobCounts).toEqual({});
    });
  });

  describe('fromDTO', () => {
    it('should update mutable fields from DTO', () => {
      const partialDTO = {
        name: 'Updated Name',
        fullName: 'Updated Full Name',
        jobCount: 2000,
        population: 13000000,
      };

      const updated = RegionMapper.fromDTO(partialDTO, sampleRegion);

      expect(updated.name).toBe('Updated Name');
      expect(updated.fullName).toBe('Updated Full Name');
      expect(updated.jobCount).toBe(2000);
      expect(updated.population).toBe(13000000);
    });

    it('should preserve immutable fields', () => {
      const partialDTO = {
        name: 'Updated',
      };

      const updated = RegionMapper.fromDTO(partialDTO, sampleRegion);

      expect(updated.id).toBe(sampleRegion.id);
      expect(updated.code).toBe(sampleRegion.code);
    });

    it('should use existing values for undefined fields', () => {
      const minimalDTO = {
        jobCount: 2000,
      };

      const updated = RegionMapper.fromDTO(minimalDTO, sampleRegion);

      expect(updated.jobCount).toBe(2000);
      expect(updated.name).toBe(sampleRegion.name);
      expect(updated.fullName).toBe(sampleRegion.fullName);
      expect(updated.population).toBe(sampleRegion.population);
    });
  });
});
