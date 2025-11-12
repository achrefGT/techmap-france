import { IRegionRepository } from '../../domain/repositories/IRegionRepository';
import { IJobRepository } from '../../domain/repositories/IJobRepository';
import { ITechnologyRepository } from '../../domain/repositories/ITechnologyRepository';
import { RegionMapper } from '../mappers/RegionMapper';
import { RegionDTO, RegionStatsDTO } from '../dtos/RegionDTO';
import { Job } from '../../domain/entities/Job';

/**
 * Region Service
 *
 * UPDATED: Uses new repository filters instead of deprecated findByRegion method
 */
export class RegionService {
  constructor(
    private regionRepository: IRegionRepository,
    private jobRepository: IJobRepository,
    private technologyRepository: ITechnologyRepository
  ) {}

  async getAllRegions(): Promise<RegionDTO[]> {
    const regions = await this.regionRepository.findAll();
    return RegionMapper.toDTOs(regions);
  }

  async getRegionById(id: number): Promise<RegionDTO | null> {
    const region = await this.regionRepository.findById(id);
    return region ? RegionMapper.toDTO(region) : null;
  }

  async getRegionStats(regionId: number): Promise<RegionStatsDTO | null> {
    const region = await this.regionRepository.findById(regionId);
    if (!region) return null;

    // Get jobs for this region using new filter format
    const jobs = await this.jobRepository.findAll({ regionIds: [regionId] }, 1, 10000);

    // Calculate top technologies
    const techCounts = new Map<string, { id: number; name: string; count: number }>();

    for (const job of jobs) {
      for (const techName of job.technologies) {
        const tech = await this.technologyRepository.findByName(techName);
        if (tech) {
          const key = tech.name;
          if (!techCounts.has(key)) {
            techCounts.set(key, { id: tech.id!, name: tech.name, count: 0 });
          }
          techCounts.get(key)!.count++;
        }
      }
    }

    const topTechnologies = Array.from(techCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(tech => ({
        technologyId: tech.id,
        technologyName: tech.name,
        jobCount: tech.count,
      }));

    // Calculate salary stats
    const salaries = jobs
      .map((j: Job) => j.getSalaryMidpoint())
      .filter((s): s is number => s !== null);

    const averageSalary =
      salaries.length > 0
        ? salaries.reduce((a: number, b: number) => a + b, 0) / salaries.length
        : null;

    const salaryRange =
      salaries.length > 0 ? { min: Math.min(...salaries), max: Math.max(...salaries) } : null;

    // Calculate remote percentage
    const remoteJobs = jobs.filter((j: Job) => j.isRemote).length;
    const remotePercentage = jobs.length > 0 ? (remoteJobs / jobs.length) * 100 : 0;

    // Experience distribution
    const experienceDistribution = {
      junior: jobs.filter((j: Job) => j.experienceCategory === 'junior').length,
      mid: jobs.filter((j: Job) => j.experienceCategory === 'mid').length,
      senior: jobs.filter((j: Job) => j.experienceCategory === 'senior').length,
      lead: jobs.filter((j: Job) => j.experienceCategory === 'lead').length,
    };

    // Top companies
    const companyMap = new Map<string, number>();
    jobs.forEach((job: Job) => {
      companyMap.set(job.company, (companyMap.get(job.company) || 0) + 1);
    });

    const topCompanies = Array.from(companyMap.entries())
      .map(([companyName, jobCount]) => ({ companyName, jobCount }))
      .sort((a, b) => b.jobCount - a.jobCount)
      .slice(0, 10);

    return RegionMapper.toStatsDTO(
      region,
      topTechnologies,
      averageSalary,
      salaryRange,
      remotePercentage,
      experienceDistribution,
      topCompanies
    );
  }
}
