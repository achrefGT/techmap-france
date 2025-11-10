-- Migration 002: Add Performance Indexes
-- Optimizes query performance for common access patterns

-- ============================================================================
-- JOBS TABLE INDEXES
-- ============================================================================

-- Most common query: filter active jobs by date
CREATE INDEX IF NOT EXISTS idx_jobs_active_posted 
  ON jobs (is_active, posted_date DESC) 
  WHERE is_active = true;

-- Filter by region
CREATE INDEX IF NOT EXISTS idx_jobs_region 
  ON jobs (region_id) 
  WHERE is_active = true;

-- Filter by remote status
CREATE INDEX IF NOT EXISTS idx_jobs_remote 
  ON jobs (is_remote) 
  WHERE is_active = true AND is_remote = true;

-- Filter by experience category
CREATE INDEX IF NOT EXISTS idx_jobs_experience 
  ON jobs (experience_category) 
  WHERE is_active = true;

-- Filter by salary range
CREATE INDEX IF NOT EXISTS idx_jobs_salary 
  ON jobs (salary_min, salary_max) 
  WHERE is_active = true AND salary_min IS NOT NULL;

-- Source tracking (deduplication lookups)
CREATE INDEX IF NOT EXISTS idx_jobs_source_external 
  ON jobs (source_api, external_id);

-- Company lookups (for deduplication)
CREATE INDEX IF NOT EXISTS idx_jobs_company 
  ON jobs (company);

-- Posted date for expiration queries
CREATE INDEX IF NOT EXISTS idx_jobs_posted_date 
  ON jobs (posted_date);

-- Composite index for common filters
CREATE INDEX IF NOT EXISTS idx_jobs_region_experience_posted 
  ON jobs (region_id, experience_category, posted_date DESC) 
  WHERE is_active = true;

-- ============================================================================
-- TECHNOLOGIES TABLE INDEXES
-- ============================================================================

-- Lookup by name (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_technologies_name_lower 
  ON technologies (LOWER(name));

-- Filter by category
CREATE INDEX IF NOT EXISTS idx_technologies_category 
  ON technologies (category, job_count DESC);

-- Sort by popularity
CREATE INDEX IF NOT EXISTS idx_technologies_job_count 
  ON technologies (job_count DESC);

-- ============================================================================
-- JOB_TECHNOLOGIES TABLE INDEXES
-- ============================================================================

-- Reverse lookup: find all jobs for a technology
CREATE INDEX IF NOT EXISTS idx_job_technologies_tech 
  ON job_technologies (technology_id, job_id);

-- Already has primary key (job_id, technology_id) for forward lookup

-- ============================================================================
-- REGIONS TABLE INDEXES
-- ============================================================================

-- Lookup by code (already unique, but explicit index)
CREATE INDEX IF NOT EXISTS idx_regions_code 
  ON regions (code);

-- Sort by popularity
CREATE INDEX IF NOT EXISTS idx_regions_job_count 
  ON regions (job_count DESC);

-- ============================================================================
-- DAILY_STATS TABLE INDEXES
-- ============================================================================

-- Query historical data by technology
CREATE INDEX IF NOT EXISTS idx_daily_stats_tech_date 
  ON daily_stats (technology_id, date DESC);

-- Query by region
CREATE INDEX IF NOT EXISTS idx_daily_stats_region_date 
  ON daily_stats (region_id, date DESC);

-- Time-series queries
CREATE INDEX IF NOT EXISTS idx_daily_stats_date 
  ON daily_stats (date DESC);

-- Composite for common analytics queries
CREATE INDEX IF NOT EXISTS idx_daily_stats_tech_region_date 
  ON daily_stats (technology_id, region_id, date DESC);

-- ============================================================================
-- FULL-TEXT SEARCH INDEXES (Optional but powerful)
-- ============================================================================

-- Full-text search on job title and description
CREATE INDEX IF NOT EXISTS idx_jobs_fulltext 
  ON jobs USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- ============================================================================
-- ANALYZE
-- ============================================================================
-- Update table statistics for query planner
ANALYZE jobs;
ANALYZE technologies;
ANALYZE regions;
ANALYZE job_technologies;
ANALYZE daily_stats;