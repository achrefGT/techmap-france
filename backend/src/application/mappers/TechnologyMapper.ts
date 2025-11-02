import { Technology } from '../../domain/entities/Technology';
import {
  TechnologyDTO,
  TechnologyTrendDTO,
  TechnologyPredictionDTO,
  TechnologyStatsDTO,
  TechnologyCategoryDTO,
} from '../dtos/TechnologyDTO';

/**
 * Mapper for Technology entity <-> TechnologyDTO transformations
 */
export class TechnologyMapper {
  /**
   * Convert Technology entity to TechnologyDTO
   */
  static toDTO(tech: Technology): TechnologyDTO {
    if (!tech.id) {
      throw new Error('Cannot map Technology without ID to DTO');
    }

    return {
      id: tech.id,
      name: tech.name,
      displayName: tech.displayName,
      category: tech.category,
      jobCount: tech.jobCount,
      popularityLevel: tech.getPopularityLevel(),
      isInDemand: tech.isInDemand(),
    };
  }

  /**
   * Convert array of Technology entities to DTOs
   */
  static toDTOs(technologies: Technology[]): TechnologyDTO[] {
    return technologies.map(tech => this.toDTO(tech));
  }

  /**
   * Create TechnologyTrendDTO from Technology and trend data
   */
  static toTrendDTO(
    tech: Technology,
    currentCount: number,
    previousCount: number,
    growthRate: number,
    growthPercentage: number
  ): TechnologyTrendDTO {
    let trend: 'rising' | 'stable' | 'declining';
    if (growthPercentage > 10) {
      trend = 'rising';
    } else if (growthPercentage < -10) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    return {
      technology: this.toDTO(tech),
      currentCount,
      previousCount,
      growthRate,
      growthPercentage: Math.round(growthPercentage * 100) / 100,
      trend,
    };
  }

  /**
   * Create TechnologyPredictionDTO
   */
  static toPredictionDTO(
    tech: Technology,
    currentDemand: number,
    predictedDemand: number,
    months: number,
    growthRate: number,
    historicalDataPoints: number
  ): TechnologyPredictionDTO {
    // Determine confidence based on historical data availability
    let confidence: 'high' | 'medium' | 'low';
    if (historicalDataPoints >= 6) {
      confidence = 'high';
    } else if (historicalDataPoints >= 3) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      technology: this.toDTO(tech),
      currentDemand,
      predictedDemand,
      months,
      confidence,
      growthRate: Math.round(growthRate * 10000) / 100, // percentage with 2 decimals
    };
  }

  /**
   * Create TechnologyStatsDTO
   */
  static toStatsDTO(
    tech: Technology,
    averageSalary: number | null,
    topRegions: Array<{
      regionId: number;
      regionName: string;
      jobCount: number;
    }>,
    experienceDistribution: {
      junior: number;
      mid: number;
      senior: number;
      lead: number;
    },
    remoteJobsPercentage: number
  ): TechnologyStatsDTO {
    return {
      technology: this.toDTO(tech),
      totalJobs: tech.jobCount,
      averageSalary: averageSalary ? Math.round(averageSalary) : null,
      topRegions,
      experienceDistribution,
      remoteJobsPercentage: Math.round(remoteJobsPercentage * 100) / 100,
    };
  }

  /**
   * Create TechnologyCategoryDTO
   */
  static toCategoryDTO(
    category: string,
    displayName: string,
    technologies: Technology[]
  ): TechnologyCategoryDTO {
    const totalJobs = technologies.reduce((sum, tech) => sum + tech.jobCount, 0);

    return {
      category,
      displayName,
      technologies: this.toDTOs(technologies),
      totalJobs,
    };
  }

  /**
   * Convert DTO back to Technology entity (for creation)
   */
  static fromDTO(dto: Partial<TechnologyDTO>): Technology {
    if (!dto.name || !dto.category) {
      throw new Error('Name and category are required to create Technology');
    }

    return Technology.create(
      dto.name,
      dto.category as any, // Type assertion for TechnologyCategory
      dto.displayName
    );
  }
}
