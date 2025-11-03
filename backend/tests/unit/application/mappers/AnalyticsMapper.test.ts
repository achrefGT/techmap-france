import { describe, it, expect, beforeEach } from '@jest/globals';
import { AnalyticsMapper } from '../../../../src/application/mappers/AnalyticsMapper';
import { Job } from '../../../../src/domain/entities/Job';

describe('AnalyticsMapper', () => {
  let sampleJobs: Job[];

  beforeEach(() => {
    sampleJobs = [
      new Job(
        '1',
        'React Developer',
        'TechCorp',
        'Build React apps with modern tools',
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
        'Senior Backend Engineer',
        'BigTech',
        'Design scalable systems',
        ['Node.js', 'PostgreSQL'],
        'Lyon',
        84,
        true,
        80,
        100,
        'Senior',
        'senior',
        'indeed',
        'ext-2',
        'https://example.com/2',
        new Date('2024-10-25'),
        true
      ),
      new Job(
        '3',
        'Junior Frontend Dev',
        'Startup',
        'Learn and grow',
        ['Vue.js'],
        'Paris',
        11,
        false,
        35,
        45,
        'Junior',
        'junior',
        'linkedin',
        'ext-3',
        'https://example.com/3',
        new Date('2024-10-22'),
        true
      ),
    ];
  });

  describe('toDashboardStatsDTO', () => {
    it('should create dashboard stats with all metrics', () => {
      const stats = AnalyticsMapper.toDashboardStatsDTO(100, 90, 30, 15, 8, 50, sampleJobs);

      expect(stats.totalJobs).toBe(100);
      expect(stats.activeJobs).toBe(90);
      expect(stats.recentJobs).toBe(30);
      expect(stats.totalTechnologies).toBe(15);
      expect(stats.totalRegions).toBe(8);
      expect(stats.totalCompanies).toBe(50);
      expect(stats.averageQualityScore).toBeGreaterThan(0);
      expect(stats.jobsWithSalary).toBe(3);
      expect(stats.remoteJobsPercentage).toBeGreaterThan(0);
    });

    it('should calculate remote jobs percentage correctly', () => {
      const stats = AnalyticsMapper.toDashboardStatsDTO(3, 3, 3, 5, 2, 3, sampleJobs);

      expect(stats.remoteJobsPercentage).toBeCloseTo(33.33, 2);
    });

    it('should handle empty jobs array', () => {
      const stats = AnalyticsMapper.toDashboardStatsDTO(0, 0, 0, 0, 0, 0, []);

      expect(stats.averageQualityScore).toBe(0);
      expect(stats.jobsWithSalary).toBe(0);
      expect(stats.remoteJobsPercentage).toBe(0);
    });

    it('should round average quality score to 1 decimal', () => {
      const stats = AnalyticsMapper.toDashboardStatsDTO(3, 3, 3, 5, 2, 3, sampleJobs);

      expect(stats.averageQualityScore.toString()).toMatch(/^\d+\.\d$/);
    });
  });

  describe('toTimeSeriesDTO', () => {
    it('should convert Map to sorted time series array', () => {
      const data = new Map([
        ['2024-10-25', 15],
        ['2024-10-20', 10],
        ['2024-10-22', 12],
      ]);

      const result = AnalyticsMapper.toTimeSeriesDTO(data, 'Job Count');

      expect(result).toHaveLength(3);
      expect(result[0].date).toBe('2024-10-20');
      expect(result[1].date).toBe('2024-10-22');
      expect(result[2].date).toBe('2024-10-25');
      expect(result[0].label).toBe('Job Count');
    });

    it('should work without label', () => {
      const data = new Map([['2024-10-20', 10]]);
      const result = AnalyticsMapper.toTimeSeriesDTO(data);

      expect(result[0].label).toBeUndefined();
    });

    it('should handle empty map', () => {
      const result = AnalyticsMapper.toTimeSeriesDTO(new Map());
      expect(result).toHaveLength(0);
    });
  });

  describe('toSalaryStatsDTO', () => {
    it('should calculate overall salary statistics', () => {
      const stats = AnalyticsMapper.toSalaryStatsDTO(sampleJobs, [], [], new Map());

      expect(stats.overall.average).toBeGreaterThan(0);
      expect(stats.overall.median).toBeGreaterThan(0);
      expect(stats.overall.min).toBe(40);
      expect(stats.overall.max).toBe(90);
      expect(stats.overall.percentile25).toBeGreaterThan(0);
      expect(stats.overall.percentile75).toBeGreaterThan(0);
    });

    it('should group statistics by experience level', () => {
      const stats = AnalyticsMapper.toSalaryStatsDTO(sampleJobs, [], [], new Map());

      expect(stats.byExperience.junior.count).toBe(1);
      expect(stats.byExperience.mid.count).toBe(1);
      expect(stats.byExperience.senior.count).toBe(1);
      expect(stats.byExperience.lead.count).toBe(0);

      expect(stats.byExperience.junior.average).toBeLessThan(stats.byExperience.senior.average);
    });

    it('should map technology salary data', () => {
      const byTechnology = [
        {
          technologyId: 1,
          technologyName: 'React',
          salaries: [60, 70, 80],
        },
      ];

      const stats = AnalyticsMapper.toSalaryStatsDTO(sampleJobs, byTechnology, [], new Map());

      expect(stats.byTechnology).toHaveLength(1);
      expect(stats.byTechnology[0].technologyName).toBe('React');
      expect(stats.byTechnology[0].count).toBe(3);
      expect(stats.byTechnology[0].average).toBe(70);
    });

    it('should map region salary data', () => {
      const byRegion = [
        {
          regionId: 11,
          regionName: 'Paris',
          salaries: [50, 60, 70],
        },
      ];

      const stats = AnalyticsMapper.toSalaryStatsDTO(sampleJobs, [], byRegion, new Map());

      expect(stats.byRegion).toHaveLength(1);
      expect(stats.byRegion[0].regionName).toBe('Paris');
      expect(stats.byRegion[0].median).toBe(60);
    });

    it('should include salary trend data', () => {
      const trend = new Map([
        ['2024-10', 60],
        ['2024-09', 55],
      ]);

      const stats = AnalyticsMapper.toSalaryStatsDTO(sampleJobs, [], [], trend);

      expect(stats.trend).toHaveLength(2);
      expect(stats.trend[0].label).toBe('Average Salary');
    });

    it('should handle jobs without salary data', () => {
      const noSalaryJobs = [
        new Job(
          '4',
          'Test Job',
          'TestCo',
          'Test',
          ['Java'],
          'Paris',
          11,
          false,
          null,
          null,
          'Mid',
          'mid',
          'linkedin',
          'ext-4',
          'https://example.com/4',
          new Date(),
          true
        ),
      ];

      const stats = AnalyticsMapper.toSalaryStatsDTO(noSalaryJobs, [], [], new Map());

      expect(stats.overall.average).toBe(0);
      expect(stats.overall.median).toBe(0);
    });
  });

  describe('toMarketInsightsDTO', () => {
    it('should create complete market insights', () => {
      const hotTechnologies = [
        {
          technologyId: 1,
          technologyName: 'React',
          jobCount: 100,
          growthRate: 15.5,
        },
      ];

      const topRegions = [
        {
          regionId: 11,
          regionName: 'Paris',
          jobCount: 200,
          growthRate: 10.2,
        },
      ];

      const topCompanies = [
        {
          companyName: 'TechCorp',
          jobCount: 50,
          averageSalary: 75.5,
          topTechnologies: ['React', 'Node.js'],
        },
      ];

      const insights = AnalyticsMapper.toMarketInsightsDTO(
        hotTechnologies,
        topRegions,
        topCompanies,
        sampleJobs
      );

      expect(insights.hotTechnologies).toEqual(hotTechnologies);
      expect(insights.topRegions).toEqual(topRegions);
      expect(insights.topCompanies[0].averageSalary).toBe(76);
      expect(insights.experienceDistribution.junior).toBe(1);
      expect(insights.experienceDistribution.mid).toBe(1);
      expect(insights.experienceDistribution.senior).toBe(1);
    });

    it('should calculate remote vs onsite correctly', () => {
      const insights = AnalyticsMapper.toMarketInsightsDTO([], [], [], sampleJobs);

      expect(insights.remoteVsOnsite.remote).toBe(1);
      expect(insights.remoteVsOnsite.onsite).toBe(2);
      expect(insights.remoteVsOnsite.hybrid).toBe(0);
    });

    it('should round company average salaries', () => {
      const topCompanies = [
        {
          companyName: 'Test',
          jobCount: 10,
          averageSalary: 75.789,
          topTechnologies: ['React'],
        },
      ];

      const insights = AnalyticsMapper.toMarketInsightsDTO([], [], topCompanies, sampleJobs);

      expect(insights.topCompanies[0].averageSalary).toBe(76);
    });

    it('should handle null average salary', () => {
      const topCompanies = [
        {
          companyName: 'Test',
          jobCount: 10,
          averageSalary: null,
          topTechnologies: ['React'],
        },
      ];

      const insights = AnalyticsMapper.toMarketInsightsDTO([], [], topCompanies, sampleJobs);

      expect(insights.topCompanies[0].averageSalary).toBeNull();
    });
  });
});
