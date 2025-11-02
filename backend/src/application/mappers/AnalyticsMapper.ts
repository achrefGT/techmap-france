import { Job } from '../../domain/entities/Job';
import {
  DashboardStatsDTO,
  TimeSeriesDataPointDTO,
  SalaryStatsDTO,
  MarketInsightsDTO,
} from '../dtos/AnalyticsDTO';

/**
 * Mapper for analytics and statistics
 */
export class AnalyticsMapper {
  /**
   * Create DashboardStatsDTO from raw data
   */
  static toDashboardStatsDTO(
    totalJobs: number,
    activeJobs: number,
    recentJobs: number,
    totalTechnologies: number,
    totalRegions: number,
    totalCompanies: number,
    jobs: Job[]
  ): DashboardStatsDTO {
    const qualityScores = jobs.map(job => job.calculateQualityScore());
    const averageQualityScore =
      qualityScores.length > 0
        ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
        : 0;

    const jobsWithSalary = jobs.filter(
      job => job.salaryMinKEuros !== null || job.salaryMaxKEuros !== null
    ).length;

    const remoteJobs = jobs.filter(job => job.isRemote).length;
    const remoteJobsPercentage = totalJobs > 0 ? (remoteJobs / totalJobs) * 100 : 0;

    return {
      totalJobs,
      activeJobs,
      recentJobs,
      totalTechnologies,
      totalRegions,
      totalCompanies,
      averageQualityScore: Math.round(averageQualityScore * 10) / 10,
      jobsWithSalary,
      remoteJobsPercentage: Math.round(remoteJobsPercentage * 100) / 100,
    };
  }

  /**
   * Create TimeSeriesDataPointDTO array
   */
  static toTimeSeriesDTO(data: Map<string, number>, label?: string): TimeSeriesDataPointDTO[] {
    return Array.from(data.entries())
      .map(([date, value]) => ({
        date,
        value,
        label,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Create SalaryStatsDTO from jobs
   */
  static toSalaryStatsDTO(
    jobs: Job[],
    byTechnology: Array<{
      technologyId: number;
      technologyName: string;
      salaries: number[];
    }>,
    byRegion: Array<{
      regionId: number;
      regionName: string;
      salaries: number[];
    }>,
    trend: Map<string, number>
  ): SalaryStatsDTO {
    // Get all midpoint salaries
    const allSalaries = jobs
      .map(job => job.getSalaryMidpoint())
      .filter((s): s is number => s !== null)
      .sort((a, b) => a - b);

    // Calculate overall statistics
    const overall = {
      average: this.calculateAverage(allSalaries),
      median: this.calculateMedian(allSalaries),
      min: allSalaries.length > 0 ? Math.min(...allSalaries) : 0,
      max: allSalaries.length > 0 ? Math.max(...allSalaries) : 0,
      percentile25: this.calculatePercentile(allSalaries, 25),
      percentile75: this.calculatePercentile(allSalaries, 75),
    };

    // Group by experience
    const juniorJobs = jobs.filter(j => j.experienceCategory === 'junior');
    const midJobs = jobs.filter(j => j.experienceCategory === 'mid');
    const seniorJobs = jobs.filter(j => j.experienceCategory === 'senior');
    const leadJobs = jobs.filter(j => j.experienceCategory === 'lead');

    const byExperience = {
      junior: this.calculateExperienceStats(juniorJobs),
      mid: this.calculateExperienceStats(midJobs),
      senior: this.calculateExperienceStats(seniorJobs),
      lead: this.calculateExperienceStats(leadJobs),
    };

    // Map technology salaries
    const byTechnologyDTO = byTechnology.map(tech => ({
      technologyId: tech.technologyId,
      technologyName: tech.technologyName,
      average: Math.round(this.calculateAverage(tech.salaries)),
      median: Math.round(this.calculateMedian(tech.salaries)),
      count: tech.salaries.length,
    }));

    // Map region salaries
    const byRegionDTO = byRegion.map(region => ({
      regionId: region.regionId,
      regionName: region.regionName,
      average: Math.round(this.calculateAverage(region.salaries)),
      median: Math.round(this.calculateMedian(region.salaries)),
      count: region.salaries.length,
    }));

    return {
      overall,
      byExperience,
      byTechnology: byTechnologyDTO,
      byRegion: byRegionDTO,
      trend: this.toTimeSeriesDTO(trend, 'Average Salary'),
    };
  }

  /**
   * Create MarketInsightsDTO
   */
  static toMarketInsightsDTO(
    hotTechnologies: Array<{
      technologyId: number;
      technologyName: string;
      jobCount: number;
      growthRate: number;
    }>,
    topRegions: Array<{
      regionId: number;
      regionName: string;
      jobCount: number;
      growthRate: number;
    }>,
    topCompanies: Array<{
      companyName: string;
      jobCount: number;
      averageSalary: number | null;
      topTechnologies: string[];
    }>,
    jobs: Job[]
  ): MarketInsightsDTO {
    // Calculate experience distribution
    const experienceDistribution = {
      junior: jobs.filter(j => j.experienceCategory === 'junior').length,
      mid: jobs.filter(j => j.experienceCategory === 'mid').length,
      senior: jobs.filter(j => j.experienceCategory === 'senior').length,
      lead: jobs.filter(j => j.experienceCategory === 'lead').length,
    };

    // Calculate remote vs onsite
    const remote = jobs.filter(j => j.isRemote).length;
    const onsite = jobs.filter(j => !j.isRemote).length;

    return {
      hotTechnologies,
      topRegions,
      topCompanies: topCompanies.map(company => ({
        ...company,
        averageSalary: company.averageSalary ? Math.round(company.averageSalary) : null,
      })),
      experienceDistribution,
      remoteVsOnsite: {
        remote,
        onsite,
        hybrid: 0, // Not currently tracked
      },
    };
  }

  // Helper methods

  private static calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.round(values.reduce((sum, val) => sum + val, 0) / values.length);
  }

  private static calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
  }

  private static calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private static calculateExperienceStats(jobs: Job[]): {
    average: number;
    median: number;
    count: number;
  } {
    const salaries = jobs
      .map(job => job.getSalaryMidpoint())
      .filter((s): s is number => s !== null);

    return {
      average: Math.round(this.calculateAverage(salaries)),
      median: Math.round(this.calculateMedian(salaries)),
      count: jobs.length,
    };
  }
}
