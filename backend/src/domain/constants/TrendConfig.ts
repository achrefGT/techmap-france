/**
 * Configuration for trend analysis thresholds and parameters
 */
export const TREND_CONFIG = {
  // Rising technology thresholds
  RISING_TECHNOLOGY: {
    MIN_GROWTH_PERCENTAGE: 10, // Must grow by at least 10%
    MIN_ABSOLUTE_GROWTH: 5, // Must gain at least 5 jobs
    MIN_CURRENT_VOLUME: 10, // Must have at least 10 current jobs
  },

  // Declining technology thresholds
  DECLINING_TECHNOLOGY: {
    MIN_DECLINE_PERCENTAGE: 10, // Must decline by at least 10%
    MIN_ABSOLUTE_DECLINE: 5, // Must lose at least 5 jobs
    MIN_PREVIOUS_VOLUME: 10, // Must have had at least 10 jobs
  },

  // Stable technology thresholds
  STABLE_TECHNOLOGY: {
    MAX_CHANGE_PERCENTAGE: 5, // Within ±5% is considered stable
    MIN_CURRENT_VOLUME: 10, // Must have meaningful volume
  },

  // Data quality thresholds
  DATA_QUALITY: {
    MIN_DATA_POINTS: 2, // Minimum historical data points
    MIN_HISTORICAL_MONTHS: 3, // Minimum months of history for predictions
  },

  // Prediction settings
  PREDICTION: {
    USE_MEDIAN_GROWTH: false, // Use mean by default (median is more robust)
    TRIM_OUTLIER_PERCENTAGE: 0, // No outlier trimming by default (0-50)
    DEFAULT_PREDICTION_MONTHS: 6, // Default forecast horizon
  },

  // Time periods
  ANALYSIS_PERIODS: {
    DEFAULT_DAYS: 7, // Default comparison period
    SHORT_TERM: 7, // 1 week
    MEDIUM_TERM: 30, // 1 month
    LONG_TERM: 90, // 3 months
  },

  // Confidence thresholds
  CONFIDENCE: {
    HIGH_DATA_POINTS: 6, // 6+ months = high confidence
    MEDIUM_DATA_POINTS: 3, // 3-5 months = medium confidence
    LOW_DATA_POINTS: 1, // 1-2 months = low confidence
  },
} as const;

// Type for external configuration (optional runtime overrides)
export interface TrendAnalysisConfig {
  minGrowthPercentage?: number;
  minAbsoluteGrowth?: number;
  minCurrentVolume?: number;
  minDataPoints?: number;
  minHistoricalMonths?: number;
  useMedianGrowth?: boolean;
  trimOutlierPercentage?: number;
}

// Helper to merge user config with defaults
export function mergeTrendConfig(
  userConfig?: Partial<TrendAnalysisConfig>
): Required<TrendAnalysisConfig> {
  return {
    minGrowthPercentage:
      userConfig?.minGrowthPercentage ?? TREND_CONFIG.RISING_TECHNOLOGY.MIN_GROWTH_PERCENTAGE,
    minAbsoluteGrowth:
      userConfig?.minAbsoluteGrowth ?? TREND_CONFIG.RISING_TECHNOLOGY.MIN_ABSOLUTE_GROWTH,
    minCurrentVolume:
      userConfig?.minCurrentVolume ?? TREND_CONFIG.RISING_TECHNOLOGY.MIN_CURRENT_VOLUME,
    minDataPoints: userConfig?.minDataPoints ?? TREND_CONFIG.DATA_QUALITY.MIN_DATA_POINTS,
    minHistoricalMonths:
      userConfig?.minHistoricalMonths ?? TREND_CONFIG.DATA_QUALITY.MIN_HISTORICAL_MONTHS,
    useMedianGrowth: userConfig?.useMedianGrowth ?? TREND_CONFIG.PREDICTION.USE_MEDIAN_GROWTH,
    trimOutlierPercentage:
      userConfig?.trimOutlierPercentage ?? TREND_CONFIG.PREDICTION.TRIM_OUTLIER_PERCENTAGE,
  };
}

// Validation helpers
export function validateTrendConfig(config: Partial<TrendAnalysisConfig>): void {
  if (config.minGrowthPercentage !== undefined && config.minGrowthPercentage < 0) {
    throw new Error('minGrowthPercentage must be non-negative');
  }
  if (config.minAbsoluteGrowth !== undefined && config.minAbsoluteGrowth < 0) {
    throw new Error('minAbsoluteGrowth must be non-negative');
  }
  if (
    config.trimOutlierPercentage !== undefined &&
    (config.trimOutlierPercentage < 0 || config.trimOutlierPercentage > 50)
  ) {
    throw new Error('trimOutlierPercentage must be between 0 and 50');
  }
}
