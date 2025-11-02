/**
 * Data Transfer Objects for analytics and statistics
 */

/**
 * Dashboard overview statistics
 */
export interface DashboardStatsDTO {
  totalJobs: number;
  activeJobs: number;
  recentJobs: number; // last 7 days
  totalTechnologies: number;
  totalRegions: number;
  totalCompanies: number;
  averageQualityScore: number;
  jobsWithSalary: number;
  remoteJobsPercentage: number;
}

/**
 * Time series data point
 */
export interface TimeSeriesDataPointDTO {
  date: string; // ISO date
  value: number;
  label?: string;
}

/**
 * Salary statistics
 */
export interface SalaryStatsDTO {
  overall: {
    average: number;
    median: number;
    min: number;
    max: number;
    percentile25: number;
    percentile75: number;
  };
  byExperience: {
    junior: { average: number; median: number; count: number };
    mid: { average: number; median: number; count: number };
    senior: { average: number; median: number; count: number };
    lead: { average: number; median: number; count: number };
  };
  byTechnology: {
    technologyId: number;
    technologyName: string;
    average: number;
    median: number;
    count: number;
  }[];
  byRegion: {
    regionId: number;
    regionName: string;
    average: number;
    median: number;
    count: number;
  }[];
  trend: TimeSeriesDataPointDTO[];
}

/**
 * Market insights
 */
export interface MarketInsightsDTO {
  hotTechnologies: {
    technologyId: number;
    technologyName: string;
    jobCount: number;
    growthRate: number;
  }[];
  topRegions: {
    regionId: number;
    regionName: string;
    jobCount: number;
    growthRate: number;
  }[];
  topCompanies: {
    companyName: string;
    jobCount: number;
    averageSalary: number | null;
    topTechnologies: string[];
  }[];
  experienceDistribution: {
    junior: number;
    mid: number;
    senior: number;
    lead: number;
  };
  remoteVsOnsite: {
    remote: number;
    onsite: number;
    hybrid: number;
  };
}

/**
 * Search analytics
 */
export interface SearchAnalyticsDTO {
  totalSearches: number;
  topSearchTerms: {
    term: string;
    count: number;
  }[];
  popularTechnologies: {
    technologyName: string;
    searchCount: number;
  }[];
  popularRegions: {
    regionName: string;
    searchCount: number;
  }[];
}
