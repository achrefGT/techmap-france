import { IStatsRepository } from '../repositories/IStatsRepository';
import {
  TREND_CONFIG,
  TrendAnalysisConfig,
  mergeTrendConfig,
  validateTrendConfig,
} from '../constants/TrendConfig';

/**
 * Internal trend data structure
 */
export interface TechnologyTrend {
  technologyId: number;
  currentCount: number;
  previousCount: number;
  growthRate: number;
  growthPercentage: number;
}

/**
 * Prediction result
 */
export interface TechnologyPrediction {
  technologyId: number;
  currentDemand: number;
  predictedDemand: number;
  months: number;
  monthlyGrowthRate: number;
  historicalDataPoints: number;
}

/**
 * Domain Service: Trend Analysis
 *
 * Encapsulates business logic for analyzing technology trends and predicting demand.
 *
 * Business Rules:
 * - Rising: Growth > threshold AND absolute growth > minimum AND current volume > minimum
 * - Declining: Decline > threshold AND absolute decline > minimum AND previous volume > minimum
 * - Stable: Change within ±threshold AND current volume > minimum
 * - Predictions: Requires minimum historical data points for reliability
 */
export class TrendAnalysisService {
  private config: Required<TrendAnalysisConfig>;

  constructor(
    private statsRepository: IStatsRepository,
    userConfig?: Partial<TrendAnalysisConfig>
  ) {
    this.config = mergeTrendConfig(userConfig);
  }

  /**
   * Get rising technologies based on configurable thresholds
   * Returns technologies with significant growth
   */
  async getRisingTechnologies(
    days: number = TREND_CONFIG.ANALYSIS_PERIODS.DEFAULT_DAYS
  ): Promise<TechnologyTrend[]> {
    const trends = await this.analyzePeriodTrends(days);

    // Business rule: What makes a technology "rising"?
    return trends.filter(
      t =>
        t.growthPercentage > this.config.minGrowthPercentage &&
        t.growthRate > this.config.minAbsoluteGrowth &&
        t.currentCount > this.config.minCurrentVolume
    );
  }

  /**
   * Get declining technologies (negative growth)
   * Useful for identifying technologies losing market share
   */
  async getDecliningTechnologies(
    days: number = TREND_CONFIG.ANALYSIS_PERIODS.DEFAULT_DAYS
  ): Promise<TechnologyTrend[]> {
    const trends = await this.analyzePeriodTrends(days);

    // Business rule: What makes a technology "declining"?
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
  async getStableTechnologies(
    days: number = TREND_CONFIG.ANALYSIS_PERIODS.DEFAULT_DAYS
  ): Promise<TechnologyTrend[]> {
    const trends = await this.analyzePeriodTrends(days);

    // Business rule: What makes a technology "stable"?
    return trends.filter(
      t =>
        Math.abs(t.growthPercentage) <= TREND_CONFIG.STABLE_TECHNOLOGY.MAX_CHANGE_PERCENTAGE &&
        t.currentCount > this.config.minCurrentVolume
    );
  }

  /**
   * Predict future demand using compound growth
   * Validates minimum data requirements before prediction
   */
  async predictDemand(
    techId: number,
    months: number = TREND_CONFIG.PREDICTION.DEFAULT_PREDICTION_MONTHS
  ): Promise<TechnologyPrediction> {
    const history = await this.statsRepository.getHistoricalData(
      techId,
      Math.max(this.config.minHistoricalMonths, 6)
    );

    // Validate minimum data points
    if (history.length < this.config.minDataPoints) {
      const currentDemand = history[history.length - 1] || 0;
      // Not enough data: return current demand (no growth prediction)
      return {
        technologyId: techId,
        currentDemand,
        predictedDemand: currentDemand,
        months,
        monthlyGrowthRate: 0,
        historicalDataPoints: history.length,
      };
    }

    const monthlyGrowthRate = this.config.useMedianGrowth
      ? this.calculateMedianGrowthRate(history)
      : this.calculateMeanGrowthRate(history);

    const currentDemand = history[history.length - 1];

    // Business logic: Compound growth formula
    const predictedDemand = Math.round(currentDemand * Math.pow(1 + monthlyGrowthRate, months));

    return {
      technologyId: techId,
      currentDemand,
      predictedDemand,
      months,
      monthlyGrowthRate,
      historicalDataPoints: history.length,
    };
  }

  /**
   * Analyze trends between two periods
   * Compares current period vs previous period
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
        // Business rule: New technology growth calculation
        // Use 100% if has meaningful volume, otherwise 0
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
        // Business rule: New appearance
        // Treat as 100% growth if meaningful volume
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
   * Update configuration at runtime
   */
  updateConfig(config: Partial<TrendAnalysisConfig>): void {
    validateTrendConfig(config);
    this.config = mergeTrendConfig({ ...this.config, ...config });
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<TrendAnalysisConfig> {
    return { ...this.config };
  }
}
