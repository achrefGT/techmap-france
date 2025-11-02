/**
 * Data Transfer Object for Region entity
 * Used in API responses and inter-layer communication
 */

export interface RegionDTO {
  id: number;
  name: string;
  code: string;
  fullName: string;
  jobCount: number;
  population: number | null;
  jobDensity: number | null;
  regionType: 'major' | 'significant' | 'emerging' | 'small';
  isTechHub: boolean;
}

/**
 * Region with detailed statistics
 */
export interface RegionStatsDTO {
  region: RegionDTO;
  topTechnologies: {
    technologyId: number;
    technologyName: string;
    jobCount: number;
    percentage: number;
  }[];
  averageSalary: number | null;
  salaryRange: {
    min: number;
    max: number;
  } | null;
  remoteJobsPercentage: number;
  experienceDistribution: {
    junior: number;
    mid: number;
    senior: number;
    lead: number;
  };
  topCompanies: {
    companyName: string;
    jobCount: number;
  }[];
}

/**
 * Region comparison
 */
export interface RegionComparisonDTO {
  regions: RegionDTO[];
  comparison: {
    jobCounts: Record<string, number>; // regionCode -> count
    averageSalaries: Record<string, number>; // regionCode -> salary
    topTechnologies: Record<string, string[]>; // regionCode -> tech names
  };
}
