import { IJobRepository } from '../../domain/repositories/IJobRepository';
import { ITechnologyRepository } from '../../domain/repositories/ITechnologyRepository';
import { IRegionRepository } from '../../domain/repositories/IRegionRepository';
import { TrendAnalysisService } from '../../domain/services/TrendAnalysisService';
import { AnalyticsMapper } from '../mappers/AnalyticsMapper';
import { DashboardStatsDTO, SalaryStatsDTO, MarketInsightsDTO } from '../dtos/AnalyticsDTO';
import { Job } from '../../domain/entities/Job';

/**
 * Analytics Service
 *
 * UPDATED: Uses new repository filters instead of deprecated methods
 */
export class AnalyticsService {
  constructor(
    private jobRepository: IJobRepository,
    private technologyRepository: ITechnologyRepository,
    private regionRepository: IRegionRepository,
    private trendService: TrendAnalysisService
  ) {}

  /**
   * Get dashboard overview statistics
   */
  async getDashboardStats(): Promise<DashboardStatsDTO> {
    const [totalJobs, activeJobs, recentJobs, technologies, regions, allJobs] = await Promise.all([
      this.jobRepository.count({}),
      this.jobRepository.count({ isActive: true }),
      this.jobRepository.findAll({ recentDays: 7 }, 1, 10000),
      this.technologyRepository.findAll(),
      this.regionRepository.findAll(),
      this.jobRepository.findAll({}, 1, 1000), // Sample for calculations
    ]);

    const totalCompanies = new Set(allJobs.map((j: Job) => j.company)).size;

    return AnalyticsMapper.toDashboardStatsDTO(
      totalJobs,
      activeJobs,
      recentJobs.length,
      technologies.length,
      regions.length,
      totalCompanies,
      allJobs
    );
  }

  /**
   * Get salary statistics across different dimensions
   */
  async getSalaryStats(): Promise<SalaryStatsDTO> {
    // Get all jobs with salary data
    const jobs = await this.jobRepository.findAll({ minSalary: 1 }, 1, 10000);

    // Calculate salary by technology
    const technologies = await this.technologyRepository.findAll();
    const byTechnology = await Promise.all(
      technologies.map(async tech => {
        // Use new filter format with technology name
        const techJobs = await this.jobRepository.findAll({ technologies: [tech.name] }, 1, 10000);

        const salaries = techJobs
          .map((j: Job) => j.getSalaryMidpoint())
          .filter((s): s is number => s !== null);

        return {
          technologyId: tech.id!,
          technologyName: tech.name,
          salaries,
        };
      })
    );

    // Calculate salary by region
    const regions = await this.regionRepository.findAll();
    const byRegion = await Promise.all(
      regions.map(async region => {
        // Use new filter format with regionIds array
        const regionJobs = await this.jobRepository.findAll({ regionIds: [region.id] }, 1, 10000);

        const salaries = regionJobs
          .map((j: Job) => j.getSalaryMidpoint())
          .filter((s): s is number => s !== null);

        return {
          regionId: region.id,
          regionName: region.name,
          salaries,
        };
      })
    );

    // Calculate salary trend over time (placeholder - needs time-series data)
    const trend = new Map<string, number>();
    // TODO: Implement actual trend calculation from daily_stats table

    return AnalyticsMapper.toSalaryStatsDTO(jobs, byTechnology, byRegion, trend);
  }

  /**
   * Get market insights (hot technologies, top regions, top companies)
   */
  async getMarketInsights(): Promise<MarketInsightsDTO> {
    // Get hot technologies (from TrendAnalysisService)
    const risingTrends = await this.trendService.getRisingTechnologies(30);
    const hotTechnologies = risingTrends.map(trend => ({
      technologyId: trend.technologyId,
      technologyName: '', // Need to fetch from repository
      jobCount: trend.currentCount,
      growthRate: trend.growthPercentage,
    }));

    // Enrich with technology names
    await Promise.all(
      hotTechnologies.map(async hot => {
        const tech = await this.technologyRepository.findById(hot.technologyId);
        if (tech) hot.technologyName = tech.name;
      })
    );

    // Get top regions
    const regions = await this.regionRepository.findAll();
    const topRegions = await Promise.all(
      regions.map(async region => {
        // Use new filter format
        const jobs = await this.jobRepository.findAll({ regionIds: [region.id] }, 1, 10000);

        return {
          regionId: region.id,
          regionName: region.name,
          jobCount: jobs.length,
          growthRate: 0, // TODO: Calculate from historical data
        };
      })
    );

    // Sort by job count
    topRegions.sort((a, b) => b.jobCount - a.jobCount);

    // Get top companies
    const allJobs = await this.jobRepository.findAll({}, 1, 10000);
    const companyMap = new Map<string, { jobs: Job[]; technologies: Set<string> }>();

    allJobs.forEach((job: Job) => {
      if (!companyMap.has(job.company)) {
        companyMap.set(job.company, { jobs: [], technologies: new Set() });
      }
      const companyData = companyMap.get(job.company)!;
      companyData.jobs.push(job);
      job.technologies.forEach(tech => companyData.technologies.add(tech));
    });

    const topCompanies = Array.from(companyMap.entries())
      .map(([companyName, data]) => {
        const salaries = data.jobs
          .map((j: Job) => j.getSalaryMidpoint())
          .filter((s): s is number => s !== null);

        return {
          companyName,
          jobCount: data.jobs.length,
          averageSalary:
            salaries.length > 0
              ? salaries.reduce((a: number, b: number) => a + b, 0) / salaries.length
              : null,
          topTechnologies: Array.from(data.technologies).slice(0, 5),
        };
      })
      .sort((a, b) => b.jobCount - a.jobCount)
      .slice(0, 20);

    return AnalyticsMapper.toMarketInsightsDTO(
      hotTechnologies.slice(0, 10),
      topRegions.slice(0, 10),
      topCompanies,
      allJobs
    );
  }
}
