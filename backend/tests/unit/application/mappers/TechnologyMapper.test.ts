import { describe, it, expect, beforeEach } from '@jest/globals';
import { TechnologyMapper } from '../../../../src/application/mappers/TechnologyMapper';
import { Technology } from '../../../../src/domain/entities/Technology';

describe('TechnologyMapper', () => {
  let sampleTechnology: Technology;

  beforeEach(() => {
    sampleTechnology = new Technology(1, 'react', 'frontend', 'React', 350);
  });

  describe('toDTO', () => {
    it('should convert Technology entity to DTO', () => {
      const dto = TechnologyMapper.toDTO(sampleTechnology);

      expect(dto.id).toBe(1);
      expect(dto.name).toBe('react');
      expect(dto.displayName).toBe('React');
      expect(dto.category).toBe('frontend');
      expect(dto.jobCount).toBe(350);
    });

    it('should include computed properties', () => {
      const dto = TechnologyMapper.toDTO(sampleTechnology);

      expect(dto.popularityLevel).toBe('popular');
      expect(dto.isInDemand).toBe(true);
    });

    it('should throw error when technology has no ID', () => {
      const noIdTech = Technology.create('vue', 'frontend');

      expect(() => {
        TechnologyMapper.toDTO(noIdTech);
      }).toThrow('Cannot map Technology without ID to DTO');
    });

    it('should determine correct popularity levels', () => {
      const trending = new Technology(1, 'trending-tech', 'frontend', 'Trending', 600);
      expect(TechnologyMapper.toDTO(trending).popularityLevel).toBe('trending');

      const popular = new Technology(2, 'popular-tech', 'frontend', 'Popular', 300);
      expect(TechnologyMapper.toDTO(popular).popularityLevel).toBe('popular');

      const common = new Technology(3, 'common-tech', 'frontend', 'Common', 75);
      expect(TechnologyMapper.toDTO(common).popularityLevel).toBe('common');

      const niche = new Technology(4, 'niche-tech', 'frontend', 'Niche', 20);
      expect(TechnologyMapper.toDTO(niche).popularityLevel).toBe('niche');
    });

    it('should determine if technology is in demand', () => {
      const inDemand = new Technology(1, 'popular', 'frontend', 'Popular', 150);
      expect(TechnologyMapper.toDTO(inDemand).isInDemand).toBe(true);

      const notInDemand = new Technology(2, 'rare', 'frontend', 'Rare', 50);
      expect(TechnologyMapper.toDTO(notInDemand).isInDemand).toBe(false);
    });
  });

  describe('toDTOs', () => {
    it('should convert array of technologies to DTOs', () => {
      const technologies = [sampleTechnology, new Technology(2, 'vue', 'frontend', 'Vue.js', 200)];

      const dtos = TechnologyMapper.toDTOs(technologies);

      expect(dtos).toHaveLength(2);
      expect(dtos[0].id).toBe(1);
      expect(dtos[1].id).toBe(2);
    });

    it('should handle empty array', () => {
      const dtos = TechnologyMapper.toDTOs([]);
      expect(dtos).toHaveLength(0);
    });
  });

  describe('toTrendDTO', () => {
    it('should create trend DTO with rising trend', () => {
      const trend = TechnologyMapper.toTrendDTO(sampleTechnology, 350, 300, 50, 16.67);

      expect(trend.technology.id).toBe(1);
      expect(trend.currentCount).toBe(350);
      expect(trend.previousCount).toBe(300);
      expect(trend.growthRate).toBe(50);
      expect(trend.growthPercentage).toBe(16.67);
      expect(trend.trend).toBe('rising');
    });

    it('should detect rising trend (>10% growth)', () => {
      const trend = TechnologyMapper.toTrendDTO(sampleTechnology, 350, 300, 50, 15);

      expect(trend.trend).toBe('rising');
    });

    it('should detect declining trend (<-10% growth)', () => {
      const trend = TechnologyMapper.toTrendDTO(sampleTechnology, 250, 300, -50, -15);

      expect(trend.trend).toBe('declining');
    });

    it('should detect stable trend (-10% to 10%)', () => {
      const stablePositive = TechnologyMapper.toTrendDTO(sampleTechnology, 305, 300, 5, 5);
      expect(stablePositive.trend).toBe('stable');

      const stableNegative = TechnologyMapper.toTrendDTO(sampleTechnology, 295, 300, -5, -5);
      expect(stableNegative.trend).toBe('stable');
    });

    it('should round growth percentage to 2 decimals', () => {
      const trend = TechnologyMapper.toTrendDTO(sampleTechnology, 350, 300, 50, 16.66666667);

      expect(trend.growthPercentage).toBe(16.67);
    });
  });

  describe('toPredictionDTO', () => {
    it('should create prediction DTO with high confidence', () => {
      const prediction = TechnologyMapper.toPredictionDTO(sampleTechnology, 350, 420, 6, 0.2, 8);

      expect(prediction.technology.id).toBe(1);
      expect(prediction.currentDemand).toBe(350);
      expect(prediction.predictedDemand).toBe(420);
      expect(prediction.months).toBe(6);
      expect(prediction.confidence).toBe('high');
      expect(prediction.growthRate).toBe(20);
    });

    it('should determine high confidence (>=6 data points)', () => {
      const prediction = TechnologyMapper.toPredictionDTO(sampleTechnology, 350, 420, 6, 0.2, 6);

      expect(prediction.confidence).toBe('high');
    });

    it('should determine medium confidence (3-5 data points)', () => {
      const prediction = TechnologyMapper.toPredictionDTO(sampleTechnology, 350, 420, 6, 0.2, 4);

      expect(prediction.confidence).toBe('medium');
    });

    it('should determine low confidence (<3 data points)', () => {
      const prediction = TechnologyMapper.toPredictionDTO(sampleTechnology, 350, 420, 6, 0.2, 2);

      expect(prediction.confidence).toBe('low');
    });

    it('should convert growth rate to percentage with 2 decimals', () => {
      const prediction = TechnologyMapper.toPredictionDTO(
        sampleTechnology,
        350,
        420,
        6,
        0.15678,
        6
      );

      expect(prediction.growthRate).toBe(15.68);
    });
  });

  describe('toStatsDTO', () => {
    let topRegions: Array<{
      regionId: number;
      regionName: string;
      jobCount: number;
    }>;
    let experienceDistribution: {
      junior: number;
      mid: number;
      senior: number;
      lead: number;
    };

    beforeEach(() => {
      topRegions = [
        { regionId: 11, regionName: 'Île-de-France', jobCount: 150 },
        { regionId: 84, regionName: 'Auvergne-Rhône-Alpes', jobCount: 80 },
      ];

      experienceDistribution = {
        junior: 50,
        mid: 150,
        senior: 100,
        lead: 50,
      };
    });

    it('should create comprehensive technology stats', () => {
      const stats = TechnologyMapper.toStatsDTO(
        sampleTechnology,
        72500,
        topRegions,
        experienceDistribution,
        30.5
      );

      expect(stats.technology.id).toBe(1);
      expect(stats.totalJobs).toBe(350);
      expect(stats.averageSalary).toBe(72500);
      expect(stats.topRegions).toEqual(topRegions);
      expect(stats.experienceDistribution).toEqual(experienceDistribution);
      expect(stats.remoteJobsPercentage).toBe(30.5);
    });

    it('should round average salary', () => {
      const stats = TechnologyMapper.toStatsDTO(
        sampleTechnology,
        72567.89,
        topRegions,
        experienceDistribution,
        0
      );

      expect(stats.averageSalary).toBe(72568);
    });

    it('should handle null average salary', () => {
      const stats = TechnologyMapper.toStatsDTO(
        sampleTechnology,
        null,
        topRegions,
        experienceDistribution,
        0
      );

      expect(stats.averageSalary).toBeNull();
    });

    it('should round remote jobs percentage', () => {
      const stats = TechnologyMapper.toStatsDTO(
        sampleTechnology,
        null,
        topRegions,
        experienceDistribution,
        33.333333
      );

      expect(stats.remoteJobsPercentage).toBe(33.33);
    });

    it('should use job count from technology', () => {
      const stats = TechnologyMapper.toStatsDTO(
        sampleTechnology,
        null,
        [],
        experienceDistribution,
        0
      );

      expect(stats.totalJobs).toBe(sampleTechnology.jobCount);
    });
  });

  describe('toCategoryDTO', () => {
    let technologies: Technology[];

    beforeEach(() => {
      technologies = [
        new Technology(1, 'react', 'frontend', 'React', 350),
        new Technology(2, 'vue', 'frontend', 'Vue.js', 200),
        new Technology(3, 'angular', 'frontend', 'Angular', 150),
      ];
    });

    it('should create category DTO', () => {
      const category = TechnologyMapper.toCategoryDTO(
        'frontend',
        'Frontend Frameworks',
        technologies
      );

      expect(category.category).toBe('frontend');
      expect(category.displayName).toBe('Frontend Frameworks');
      expect(category.technologies).toHaveLength(3);
      expect(category.totalJobs).toBe(700);
    });

    it('should calculate total jobs correctly', () => {
      const category = TechnologyMapper.toCategoryDTO('frontend', 'Frontend', technologies);

      const expectedTotal = technologies.reduce((sum, tech) => sum + tech.jobCount, 0);
      expect(category.totalJobs).toBe(expectedTotal);
    });

    it('should handle empty technologies array', () => {
      const category = TechnologyMapper.toCategoryDTO('frontend', 'Frontend', []);

      expect(category.technologies).toHaveLength(0);
      expect(category.totalJobs).toBe(0);
    });

    it('should include technology DTOs', () => {
      const category = TechnologyMapper.toCategoryDTO('frontend', 'Frontend', technologies);

      expect(category.technologies[0].name).toBe('react');
      expect(category.technologies[0].displayName).toBe('React');
    });
  });

  describe('fromDTO', () => {
    it('should create Technology from DTO', () => {
      const dto = {
        name: 'svelte',
        category: 'frontend' as any,
        displayName: 'Svelte',
      };

      const tech = TechnologyMapper.fromDTO(dto);

      expect(tech.name).toBe('svelte');
      expect(tech.category).toBe('frontend');
      expect(tech.displayName).toBe('Svelte');
      expect(tech.id).toBeNull();
      expect(tech.jobCount).toBe(0);
    });

    it('should throw error when name is missing', () => {
      const dto = {
        category: 'frontend' as any,
      };

      expect(() => {
        TechnologyMapper.fromDTO(dto);
      }).toThrow('Name and category are required to create Technology');
    });

    it('should throw error when category is missing', () => {
      const dto = {
        name: 'svelte',
      };

      expect(() => {
        TechnologyMapper.fromDTO(dto);
      }).toThrow('Name and category are required to create Technology');
    });

    it('should use name as displayName if not provided', () => {
      const dto = {
        name: 'svelte',
        category: 'frontend' as any,
      };

      const tech = TechnologyMapper.fromDTO(dto);
      expect(tech.displayName).toBe('svelte');
    });

    it('should create technology with null ID for new technologies', () => {
      const dto = {
        name: 'new-tech',
        category: 'backend' as any,
        displayName: 'New Tech',
      };

      const tech = TechnologyMapper.fromDTO(dto);
      expect(tech.id).toBeNull();
    });
  });
});
