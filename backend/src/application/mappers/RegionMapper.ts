import { Region } from '../../domain/entities/Region';
import { RegionDTO, RegionStatsDTO, RegionComparisonDTO } from '../dtos/RegionDTO';

/**
 * Mapper for Region entity <-> RegionDTO transformations
 */
export class RegionMapper {
  /**
   * Convert Region entity to RegionDTO
   */
  static toDTO(region: Region): RegionDTO {
    return {
      id: region.id,
      name: region.name,
      code: region.code,
      fullName: region.fullName,
      jobCount: region.jobCount,
      population: region.population,
      jobDensity: region.getJobDensity(),
      regionType: region.getRegionType(),
      isTechHub: region.isTechHub(),
    };
  }

  /**
   * Convert array of Region entities to DTOs
   */
  static toDTOs(regions: Region[]): RegionDTO[] {
    return regions.map(region => this.toDTO(region));
  }

  /**
   * Create RegionStatsDTO with detailed statistics
   */
  static toStatsDTO(
    region: Region,
    topTechnologies: Array<{
      technologyId: number;
      technologyName: string;
      jobCount: number;
    }>,
    averageSalary: number | null,
    salaryRange: { min: number; max: number } | null,
    remoteJobsPercentage: number,
    experienceDistribution: {
      junior: number;
      mid: number;
      senior: number;
      lead: number;
    },
    topCompanies: Array<{
      companyName: string;
      jobCount: number;
    }>
  ): RegionStatsDTO {
    // Calculate percentage for each technology
    const topTechnologiesWithPercentage = topTechnologies.map(tech => ({
      ...tech,
      percentage: Math.round((tech.jobCount / region.jobCount) * 10000) / 100,
    }));

    return {
      region: this.toDTO(region),
      topTechnologies: topTechnologiesWithPercentage,
      averageSalary: averageSalary ? Math.round(averageSalary) : null,
      salaryRange: salaryRange
        ? {
            min: Math.round(salaryRange.min),
            max: Math.round(salaryRange.max),
          }
        : null,
      remoteJobsPercentage: Math.round(remoteJobsPercentage * 100) / 100,
      experienceDistribution,
      topCompanies,
    };
  }

  /**
   * Create RegionComparisonDTO for multiple regions
   */
  static toComparisonDTO(
    regions: Region[],
    jobCounts: Map<string, number>,
    averageSalaries: Map<string, number>,
    topTechnologies: Map<string, string[]>
  ): RegionComparisonDTO {
    return {
      regions: this.toDTOs(regions),
      comparison: {
        jobCounts: Object.fromEntries(jobCounts),
        averageSalaries: Object.fromEntries(averageSalaries),
        topTechnologies: Object.fromEntries(topTechnologies),
      },
    };
  }

  /**
   * Convert DTO back to Region entity (for updates)
   */
  static fromDTO(dto: Partial<RegionDTO>, existingRegion: Region): Region {
    return new Region(
      existingRegion.id,
      dto.name ?? existingRegion.name,
      existingRegion.code, // Code is immutable
      dto.fullName ?? existingRegion.fullName,
      dto.jobCount ?? existingRegion.jobCount,
      dto.population ?? existingRegion.population
    );
  }
}
