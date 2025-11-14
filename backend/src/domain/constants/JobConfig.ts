export const JOB_CONFIG = {
  // Title constraints
  MAX_TITLE_LENGTH: 200,

  // Description constraints
  MIN_DESCRIPTION_LENGTH: 20,
  MAX_DESCRIPTION_LENGTH: 50000,

  // Freshness and expiration
  RECENT_DAYS_THRESHOLD: 7,
  EXPIRATION_DAYS: 90,

  // 50k€ threshold
  MID_SALARY_THRESHOLD: 50,

  // Quality scoring
  MIN_QUALITY_SCORE: 40,
  QUALITY_WEIGHTS: {
    HAS_SALARY: 20,
    HAS_REGION: 20,
    HAS_DESCRIPTION: 20,
    HAS_MULTIPLE_TECHS: 20,
    HAS_EXPERIENCE_LEVEL: 15,
  },

  // Deduplication settings
  DEDUPLICATION: {
    SIMILARITY_THRESHOLD: 0.75,
    WEIGHTS: {
      COMPANY: 30,
      TITLE: 40,
      LOCATION: 15,
      TECHNOLOGIES: 10,
      POSTED_DATE: 5,
    },
    MAX_DATE_DIFF_DAYS: 30,
    MIN_TECH_OVERLAP: 0.5,
    FUZZY_KEY_CACHE_TTL: 3600,
  },

  // Experience levels (business rules)
  EXPERIENCE: {
    LEVELS: ['junior', 'mid', 'senior', 'lead', 'unknown'] as const,

    // Salary expectations by level (in k€)
    TYPICAL_SALARY_RANGES: {
      junior: { min: 30, max: 45 },
      mid: { min: 40, max: 55 },
      senior: { min: 50, max: 75 },
      lead: { min: 65, max: 100 },
      unknown: { min: null, max: null },
    },

    // Years of experience typically associated with each level
    TYPICAL_YEARS: {
      junior: { min: 0, max: 2 },
      mid: { min: 2, max: 5 },
      senior: { min: 5, max: 10 },
      lead: { min: 8, max: null },
      unknown: { min: null, max: null },
    },
  },

  // Technology validation
  TECHNOLOGIES: {
    MIN_COUNT: 1,
    MAX_COUNT: 20,
    MAX_TECH_NAME_LENGTH: 50,
  },

  // Source API tracking
  SOURCES: {
    FRANCE_TRAVAIL: 'france_travail',
    ADZUNA: 'adzuna',
    REMOTIVE: 'remotive',
  },

  // Batch processing
  BATCH: {
    IMPORT_BATCH_SIZE: 100,
    DEDUPLICATION_BATCH_SIZE: 500,
    MAX_CONCURRENT_REQUESTS: 5,
  },
} as const;

// Type helpers for better TypeScript support
export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'lead' | 'unknown';
export type JobSource = (typeof JOB_CONFIG.SOURCES)[keyof typeof JOB_CONFIG.SOURCES];

// Validation helpers
export const isValidExperienceLevel = (level: string): level is ExperienceLevel => {
  return JOB_CONFIG.EXPERIENCE.LEVELS.includes(level as ExperienceLevel);
};

export const isValidSource = (source: string): source is JobSource => {
  return Object.values(JOB_CONFIG.SOURCES).includes(source as JobSource);
};

// Business logic helpers
export const getTypicalSalaryForLevel = (level: ExperienceLevel) => {
  return JOB_CONFIG.EXPERIENCE.TYPICAL_SALARY_RANGES[level];
};

export const getTypicalYearsForLevel = (level: ExperienceLevel) => {
  return JOB_CONFIG.EXPERIENCE.TYPICAL_YEARS[level];
};
