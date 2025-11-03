import { IStatsRepository } from '../../domain/repositories/IStatsRepository';

export interface TechnologyTrend {
  technologyId: number;
  technologyName?: string;
  currentCount: number;
  previousCount: number;
  growthRate: number;
  growthPercentage: number;
}

/**
 * Configuration for trend analysis thresholds
 */
export interface TrendAnalysisConfig {
  // Rising technology thresholds
  minGrowthPercentage: number; // Default: 10%
  minAbsoluteGrowth: number; // Default: 5 jobs
  minCurrentVolume: number; // Default: 10 jobs

  // Data quality thresholds
  minDataPoints: number; // Default: 2
  minHistoricalMonths: number; // Default: 3

  // Prediction settings
  useMedianGrowth: boolean; // Default: false (use mean)
  trimOutlierPercentage: number; // Default: 0 (no trimming)
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: TrendAnalysisConfig = {
  minGrowthPercentage: 10,
  minAbsoluteGrowth: 5,
  minCurrentVolume: 10,
  minDataPoints: 2,
  minHistoricalMonths: 3,
  useMedianGrowth: false,
  trimOutlierPercentage: 0,
};

export class TrendAnalysisService {
  private config: TrendAnalysisConfig;

  constructor(
    private statsRepository: IStatsRepository,
    config?: Partial<TrendAnalysisConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get rising technologies based on configurable thresholds
   * Returns technologies with significant growth
   */
  async getRisingTechnologies(days: number = 7): Promise<TechnologyTrend[]> {
    const trends = await this.analyzePeriodTrends(days);

    // Filter based on configurable thresholds
    return trends.filter(
      t =>
        t.growthPercentage > this.config.minGrowthPercentage &&
        t.growthRate > this.config.minAbsoluteGrowth &&
        t.currentCount > this.config.minCurrentVolume
    );
  }

  /**
   * Helper method to analyze trends between two periods
   */
  private async analyzePeriodTrends(days: number): Promise<TechnologyTrend[]> {
    const now = new Date();
    const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000);

    const currentPeriod = await this.statsRepository.getStatsForPeriod(currentStart, now);
    const previousPeriod = await this.statsRepository.getStatsForPeriod(
      previousStart,
      currentStart
    );

    return this.calculatePeriodGrowthRates(currentPeriod, previousPeriod);
  }

  /**
   * Calculate growth rates between two periods with proper zero handling
   * Handles edge cases: new technologies, zero baselines, etc.
   */
  private calculatePeriodGrowthRates(
    current: Map<number, number>,
    previous: Map<number, number>
  ): TechnologyTrend[] {
    const trends: TechnologyTrend[] = [];

    for (const [techId, currentCount] of current.entries()) {
      const previousCount = previous.get(techId) || 0;
      const growthRate = currentCount - previousCount;

      let growthPercentage: number;
      if (previousCount === 0) {
        // New technology: use 100% if has meaningful volume, otherwise 0
        growthPercentage = currentCount > this.config.minCurrentVolume ? 100 : 0;
      } else {
        growthPercentage = (growthRate / previousCount) * 100;
      }

      trends.push({
        technologyId: techId,
        currentCount,
        previousCount,
        growthRate,
        growthPercentage,
      });
    }

    return trends.sort((a, b) => b.growthPercentage - a.growthPercentage);
  }

  /**
   * Predict future demand using compound growth
   * Validates minimum data requirements before prediction
   */
  async predictDemand(techId: number, months: number): Promise<number> {
    const history = await this.statsRepository.getHistoricalData(
      techId,
      Math.max(this.config.minHistoricalMonths, 6)
    );

    // Validate minimum data points
    if (history.length < this.config.minDataPoints) {
      // Not enough data: return current demand or 0
      return history[history.length - 1] || 0;
    }

    const monthlyGrowthRate = this.config.useMedianGrowth
      ? this.calculateMedianGrowthRate(history)
      : this.calculateMeanGrowthRate(history);

    const currentDemand = history[history.length - 1];

    // Compound growth formula: demand * (1 + rate)^months
    return Math.round(currentDemand * Math.pow(1 + monthlyGrowthRate, months));
  }

  /**
   * Calculate mean monthly growth rate with zero handling
   * Optionally trim outliers for more robust estimation
   */
  private calculateMeanGrowthRate(data: number[]): number {
    if (data.length < this.config.minDataPoints) return 0;

    const growthRates = this.calculateTimeSeriesGrowthRates(data);

    if (growthRates.length === 0) return 0;

    // Optionally trim outliers
    const trimmedRates = this.trimOutliers(growthRates);

    if (trimmedRates.length === 0) return 0;

    const sum = trimmedRates.reduce((a, b) => a + b, 0);
    return sum / trimmedRates.length;
  }

  /**
   * Calculate median monthly growth rate (more robust to outliers)
   */
  private calculateMedianGrowthRate(data: number[]): number {
    if (data.length < this.config.minDataPoints) return 0;

    const growthRates = this.calculateTimeSeriesGrowthRates(data);

    if (growthRates.length === 0) return 0;

    // Sort for median calculation
    const sorted = [...growthRates].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      // Even: average of two middle values
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      // Odd: middle value
      return sorted[mid];
    }
  }

  /**
   * Calculate period-to-period growth rates from time series data
   * Handles zero divisions and validates data quality
   */
  private calculateTimeSeriesGrowthRates(data: number[]): number[] {
    const growthRates: number[] = [];

    for (let i = 1; i < data.length; i++) {
      const previous = data[i - 1];
      const current = data[i];

      if (previous > 0) {
        // Guard against division by zero
        const growth = (current - previous) / previous;
        growthRates.push(growth);
      } else if (previous === 0 && current > 0) {
        // New appearance: treat as 100% growth if meaningful
        if (current >= this.config.minCurrentVolume) {
          growthRates.push(1.0); // 100% growth
        }
      }
      // Skip: both zero or negative values
    }

    return growthRates;
  }

  /**
   * Trim outliers from growth rates using configurable percentage
   * Removes extreme values from both ends
   */
  private trimOutliers(values: number[]): number[] {
    if (this.config.trimOutlierPercentage <= 0 || values.length < 4) {
      return values;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const trimCount = Math.floor(sorted.length * (this.config.trimOutlierPercentage / 100));

    if (trimCount === 0) return sorted;

    // Remove trimCount from each end
    return sorted.slice(trimCount, sorted.length - trimCount);
  }

  /**
   * Get declining technologies (negative growth)
   * Useful for identifying technologies losing market share
   */
  async getDecliningTechnologies(days: number = 7): Promise<TechnologyTrend[]> {
    const trends = await this.analyzePeriodTrends(days);

    // Filter for significant declines
    return trends.filter(
      t =>
        t.growthPercentage < -this.config.minGrowthPercentage &&
        Math.abs(t.growthRate) > this.config.minAbsoluteGrowth &&
        t.previousCount > this.config.minCurrentVolume // Had meaningful volume before
    );
  }

  /**
   * Get stable technologies (low volatility)
   * Technologies with consistent demand
   */
  async getStableTechnologies(days: number = 7): Promise<TechnologyTrend[]> {
    const trends = await this.analyzePeriodTrends(days);

    // Stable: small percentage change but meaningful volume
    const stabilityThreshold = 5; // Within ±5%
    return trends.filter(
      t =>
        Math.abs(t.growthPercentage) <= stabilityThreshold &&
        t.currentCount > this.config.minCurrentVolume
    );
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(config: Partial<TrendAnalysisConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): TrendAnalysisConfig {
    return { ...this.config };
  }
}
