/**
 * Ingestion Configuration
 *
 * Default settings for job ingestion from external APIs
 */

export const INGESTION_CONFIG = {
  // France Travail defaults
  FRANCE_TRAVAIL: {
    DEFAULT_MAX_RESULTS: 150,
    DEFAULT_KEYWORDS: 'développeur',
    REQUEST_DELAY_MS: 150,
    MAX_RETRY_ATTEMPTS: 3,
  },

  // Adzuna defaults
  ADZUNA: {
    DEFAULT_MAX_PAGES: 3,
    DEFAULT_RESULTS_PER_PAGE: 50,
    DEFAULT_KEYWORDS: 'développeur',
    REQUEST_DELAY_MS: 200,
    MAX_RETRY_ATTEMPTS: 3,
  },

  // Remotive defaults
  REMOTIVE: {
    DEFAULT_LIMIT: 50,
    DEFAULT_CATEGORY: 'software-dev',
    MAX_RETRY_ATTEMPTS: 3,
  },

  // Batch processing
  BATCH: {
    DEFAULT_BATCH_SIZE: 100,
    ENABLE_DEDUPLICATION: true,
    DEDUPLICATE_ACROSS_SOURCES: true,
  },

  // Scheduling (for future cron jobs)
  SCHEDULE: {
    FRANCE_TRAVAIL_CRON: '0 */6 * * *', // Every 6 hours
    ADZUNA_CRON: '30 */6 * * *', // Every 6 hours, offset by 30 minutes
    REMOTIVE_CRON: '0 0 * * *', // Once per day (API rate limits)
  },
} as const;
