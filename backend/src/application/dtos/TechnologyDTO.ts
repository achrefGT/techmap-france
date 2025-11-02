/**
 * Data Transfer Object for Technology entity
 * Used in API responses and inter-layer communication
 */

export interface TechnologyDTO {
  id: number;
  name: string;
  displayName: string;
  category: string;
  jobCount: number;
  popularityLevel: 'trending' | 'popular' | 'common' | 'niche';
  isInDemand: boolean;
}

/**
 * Technology with trend data
 */
export interface TechnologyTrendDTO {
  technology: TechnologyDTO;
  currentCount: number;
  previousCount: number;
  growthRate: number;
  growthPercentage: number;
  trend: 'rising' | 'stable' | 'declining';
}

/**
 * Technology demand prediction
 */
export interface TechnologyPredictionDTO {
  technology: TechnologyDTO;
  currentDemand: number;
  predictedDemand: number;
  months: number;
  confidence: 'high' | 'medium' | 'low';
  growthRate: number;
}

/**
 * Technology statistics
 */
export interface TechnologyStatsDTO {
  technology: TechnologyDTO;
  totalJobs: number;
  averageSalary: number | null;
  topRegions: {
    regionId: number;
    regionName: string;
    jobCount: number;
  }[];
  experienceDistribution: {
    junior: number;
    mid: number;
    senior: number;
    lead: number;
  };
  remoteJobsPercentage: number;
}

/**
 * Technology category summary
 */
export interface TechnologyCategoryDTO {
  category: string;
  displayName: string;
  technologies: TechnologyDTO[];
  totalJobs: number;
}
