import { ITechnologyRepository } from '../../domain/repositories/ITechnologyRepository';
import { IJobRepository } from '../../domain/repositories/IJobRepository';
import { IRegionRepository } from '../../domain/repositories/IRegionRepository';
import { TechnologyMapper } from '../mappers/TechnologyMapper';
import { TechnologyDTO, TechnologyStatsDTO } from '../dtos/TechnologyDTO';
import { Job } from '../../domain/entities/Job';

/**
 * Technology Service
 *
 * UPDATED: Uses new repository filters instead of deprecated findByTechnology method
 */
export class TechnologyService {
  constructor(
    private technologyRepository: ITechnologyRepository,
    private jobRepository: IJobRepository,
    private regionRepository: IRegionRepository
  ) {}

  async getAllTechnologies(): Promise<TechnologyDTO[]> {
    const technologies = await this.technologyRepository.findAll();
    return TechnologyMapper.toDTOs(technologies);
  }

  async getTechnologyById(id: number): Promise<TechnologyDTO | null> {
    const tech = await this.technologyRepository.findById(id);
    return tech ? TechnologyMapper.toDTO(tech) : null;
  }

  async getTechnologyStats(techId: number): Promise<TechnologyStatsDTO | null> {
    const tech = await this.technologyRepository.findById(techId);
    if (!tech) return null;

    // Get all jobs with this technology using new filter format
    const jobs = await this.jobRepository.findAll({ technologies: [tech.name] }, 1, 10000);

    // Calculate average salary
    const salaries = jobs
      .map((j: Job) => j.getSalaryMidpoint())
      .filter((s): s is number => s !== null);

    const averageSalary =
      salaries.length > 0
        ? salaries.reduce((a: number, b: number) => a + b, 0) / salaries.length
        : null;

    // Top regions for this technology
    const regionCounts = new Map<number, { name: string; count: number }>();

    for (const job of jobs) {
      if (job.regionId) {
        if (!regionCounts.has(job.regionId)) {
          const region = await this.regionRepository.findById(job.regionId);
          if (region) {
            regionCounts.set(job.regionId, { name: region.name, count: 0 });
          }
        }
        const regionData = regionCounts.get(job.regionId);
        if (regionData) regionData.count++;
      }
    }

    const topRegions = Array.from(regionCounts.entries())
      .map(([regionId, data]) => ({
        regionId,
        regionName: data.name,
        jobCount: data.count,
      }))
      .sort((a, b) => b.jobCount - a.jobCount)
      .slice(0, 10);

    // Experience distribution
    const experienceDistribution = {
      junior: jobs.filter((j: Job) => j.experienceCategory === 'junior').length,
      mid: jobs.filter((j: Job) => j.experienceCategory === 'mid').length,
      senior: jobs.filter((j: Job) => j.experienceCategory === 'senior').length,
      lead: jobs.filter((j: Job) => j.experienceCategory === 'lead').length,
    };

    // Remote jobs percentage
    const remoteJobs = jobs.filter((j: Job) => j.isRemote).length;
    const remoteJobsPercentage = jobs.length > 0 ? (remoteJobs / jobs.length) * 100 : 0;

    return TechnologyMapper.toStatsDTO(
      tech,
      averageSalary,
      topRegions,
      experienceDistribution,
      remoteJobsPercentage
    );
  }

  async getTechnologiesByCategory(category: string): Promise<TechnologyDTO[]> {
    const technologies = await this.technologyRepository.findByCategory(category);
    return TechnologyMapper.toDTOs(technologies);
  }
}
