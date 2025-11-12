-- Migration 003: Enhanced Filters and Optimizations
-- Adds support for new filtering capabilities and performance improvements
-- Related to: Consolidated REST API endpoints and enhanced repository filters

-- ============================================================================
-- 1. ADD NEW COLUMNS
-- ============================================================================

-- Pre-computed quality score (avoids expensive runtime calculation)
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0;

COMMENT ON COLUMN jobs.quality_score IS 'Pre-computed quality score (0-100) based on completeness of job data';

-- Full-text search vector (optimized for text search)
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

COMMENT ON COLUMN jobs.search_vector IS 'Full-text search vector for title, company, and description';

-- ============================================================================
-- 2. FUNCTIONS FOR QUALITY SCORE CALCULATION
-- ============================================================================

-- Function to calculate quality score based on domain business rules
-- Matches Job.calculateQualityScore() in domain entity
CREATE OR REPLACE FUNCTION calculate_job_quality_score(job_row jobs) 
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  tech_count INTEGER;
BEGIN
  -- Has salary (25 points - weight: HAS_SALARY)
  IF job_row.salary_min IS NOT NULL OR job_row.salary_max IS NOT NULL THEN
    score := score + 25;
  END IF;
  
  -- Has region (15 points - weight: HAS_REGION)
  IF job_row.region_id IS NOT NULL THEN
    score := score + 15;
  END IF;
  
  -- Has substantial description > 100 chars (20 points - weight: HAS_DESCRIPTION)
  IF LENGTH(job_row.description) > 100 THEN
    score := score + 20;
  END IF;
  
  -- Has 3+ technologies (20 points - weight: HAS_MULTIPLE_TECHS)
  SELECT COUNT(*) INTO tech_count
  FROM job_technologies
  WHERE job_id = job_row.id;
  
  IF tech_count >= 3 THEN
    score := score + 20;
  END IF;
  
  -- Has experience level (20 points - weight: HAS_EXPERIENCE_LEVEL)
  IF job_row.experience_level IS NOT NULL THEN
    score := score + 20;
  END IF;
  
  -- Cap at 100
  IF score > 100 THEN
    score := 100;
  END IF;
  
  RETURN score;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_job_quality_score IS 'Calculates quality score matching Job.calculateQualityScore() domain logic';

-- ============================================================================
-- 3. TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Trigger: Update quality score on insert/update
CREATE OR REPLACE FUNCTION jobs_quality_score_update() 
RETURNS trigger AS $$
BEGIN
  NEW.quality_score := calculate_job_quality_score(NEW);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_jobs_quality_score 
BEFORE INSERT OR UPDATE ON jobs
FOR EACH ROW 
EXECUTE FUNCTION jobs_quality_score_update();

COMMENT ON TRIGGER trigger_jobs_quality_score ON jobs IS 'Automatically updates quality_score column on insert/update';

-- Trigger: Update search vector on insert/update
CREATE OR REPLACE FUNCTION jobs_search_vector_update() 
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.company, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_jobs_search_vector 
BEFORE INSERT OR UPDATE ON jobs
FOR EACH ROW 
EXECUTE FUNCTION jobs_search_vector_update();

COMMENT ON TRIGGER trigger_jobs_search_vector ON jobs IS 'Automatically updates search_vector for full-text search';

-- Trigger: Update quality score when technologies change
CREATE OR REPLACE FUNCTION job_technologies_quality_update() 
RETURNS trigger AS $$
BEGIN
  -- Update the quality score of the affected job
  UPDATE jobs 
  SET quality_score = calculate_job_quality_score(jobs.*)
  WHERE id = COALESCE(NEW.job_id, OLD.job_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_job_technologies_quality_insert
AFTER INSERT ON job_technologies
FOR EACH ROW 
EXECUTE FUNCTION job_technologies_quality_update();

CREATE TRIGGER trigger_job_technologies_quality_delete
AFTER DELETE ON job_technologies
FOR EACH ROW 
EXECUTE FUNCTION job_technologies_quality_update();

COMMENT ON TRIGGER trigger_job_technologies_quality_insert ON job_technologies IS 'Updates job quality score when technologies are added';
COMMENT ON TRIGGER trigger_job_technologies_quality_delete ON job_technologies IS 'Updates job quality score when technologies are removed';

-- ============================================================================
-- 4. NEW INDEXES FOR ENHANCED FILTERS
-- ============================================================================

-- Quality score filter (for minQualityScore filter)
CREATE INDEX IF NOT EXISTS idx_jobs_quality_score_active 
ON jobs(quality_score DESC, posted_date DESC) 
WHERE is_active = true;

-- Full-text search (for searchQuery filter)
CREATE INDEX IF NOT EXISTS idx_jobs_search_vector 
ON jobs USING GIN(search_vector);

-- Multiple regions support (for regionIds array filter with ANY operator)
CREATE INDEX IF NOT EXISTS idx_jobs_region_id_active 
ON jobs(region_id, posted_date DESC) 
WHERE is_active = true;

-- Multiple experience categories (for experienceCategories array filter)
CREATE INDEX IF NOT EXISTS idx_jobs_experience_category_active 
ON jobs(experience_category, posted_date DESC) 
WHERE is_active = true;

-- Salary range filters (maxSalary support)
CREATE INDEX IF NOT EXISTS idx_jobs_salary_max_active 
ON jobs(salary_max) 
WHERE is_active = true AND salary_max IS NOT NULL;

-- Company filter with case-insensitive lookup
CREATE INDEX IF NOT EXISTS idx_jobs_company_lower_active 
ON jobs(LOWER(company)) 
WHERE is_active = true;

-- Source APIs array filter (for sourceApis filter with && operator)
CREATE INDEX IF NOT EXISTS idx_jobs_source_apis_active 
ON jobs USING GIN(source_apis) 
WHERE is_active = true;

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_jobs_remote_quality_posted 
ON jobs(is_remote, quality_score DESC, posted_date DESC) 
WHERE is_active = true AND is_remote = true;

CREATE INDEX IF NOT EXISTS idx_jobs_region_experience_quality 
ON jobs(region_id, experience_category, quality_score DESC, posted_date DESC) 
WHERE is_active = true;

-- Date range queries (postedBefore support)
CREATE INDEX IF NOT EXISTS idx_jobs_posted_date_range_active 
ON jobs(posted_date) 
WHERE is_active = true;

-- ============================================================================
-- 5. POPULATE EXISTING DATA
-- ============================================================================

-- Update quality scores for existing jobs
-- This may take a while on large datasets, consider running during maintenance window
DO $$
DECLARE
  total_jobs INTEGER;
  updated_count INTEGER := 0;
  batch_size INTEGER := 1000;
  current_batch INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_jobs FROM jobs;
  
  RAISE NOTICE 'Populating quality scores for jobs: %', total_jobs;
  
  -- Update in batches to avoid long-running transaction
  LOOP
    UPDATE jobs
    SET quality_score = calculate_job_quality_score(jobs.*)
    WHERE id IN (
      SELECT id FROM jobs 
      WHERE quality_score = 0 
      LIMIT batch_size
    );
    
    GET DIAGNOSTICS current_batch = ROW_COUNT;
    EXIT WHEN current_batch = 0;
    
    updated_count := updated_count + current_batch;
    RAISE NOTICE 'Updated jobs: %', updated_count;
  END LOOP;
  
  RAISE NOTICE 'Quality score population complete';
END $$;

-- Update search vectors for existing jobs
DO $$
DECLARE
  total_jobs INTEGER;
  updated_count INTEGER := 0;
  batch_size INTEGER := 1000;
  current_batch INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_jobs FROM jobs WHERE search_vector IS NULL;
  
  RAISE NOTICE 'Populating search vectors for jobs: %', total_jobs;
  
  -- Update in batches
  LOOP
    UPDATE jobs
    SET search_vector = 
      setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(company, '')), 'B') ||
      setweight(to_tsvector('english', COALESCE(description, '')), 'C')
    WHERE id IN (
      SELECT id FROM jobs 
      WHERE search_vector IS NULL 
      LIMIT batch_size
    );
    
    GET DIAGNOSTICS current_batch = ROW_COUNT;
    EXIT WHEN current_batch = 0;
    
    updated_count := updated_count + current_batch;
    RAISE NOTICE 'Updated jobs: %', updated_count;
  END LOOP;
  
  RAISE NOTICE 'Search vector population complete';
END $$;

-- ============================================================================
-- 6. DROP OLD INDEXES (cleanup from 002_add_indexes.sql that are redundant)
-- ============================================================================

-- Drop old full-text index if it exists (replaced by search_vector)
DROP INDEX IF EXISTS idx_jobs_fulltext;

-- Drop redundant indexes that are covered by new composite indexes
-- Keep this commented out if you want to be cautious
-- DROP INDEX IF EXISTS idx_jobs_active_posted; -- Covered by composite indexes
-- DROP INDEX IF EXISTS idx_jobs_region; -- Covered by idx_jobs_region_id_active
-- DROP INDEX IF EXISTS idx_jobs_experience; -- Covered by idx_jobs_experience_category_active

-- ============================================================================
-- 7. UTILITY FUNCTIONS FOR MONITORING
-- ============================================================================

-- Function to check quality score distribution
CREATE OR REPLACE FUNCTION get_quality_score_distribution()
RETURNS TABLE(
  score_range TEXT,
  job_count BIGINT,
  percentage NUMERIC(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN quality_score >= 80 THEN '80-100 (Excellent)'
      WHEN quality_score >= 60 THEN '60-79 (Good)'
      WHEN quality_score >= 40 THEN '40-59 (Fair)'
      WHEN quality_score >= 20 THEN '20-39 (Poor)'
      ELSE '0-19 (Very Poor)'
    END AS score_range,
    COUNT(*) AS job_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
  FROM jobs
  WHERE is_active = true
  GROUP BY score_range
  ORDER BY MIN(quality_score) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_quality_score_distribution IS 'Returns distribution of quality scores across active jobs';

-- Function to check search vector coverage
CREATE OR REPLACE FUNCTION get_search_vector_coverage()
RETURNS TABLE(
  has_vector BOOLEAN,
  job_count BIGINT,
  percentage NUMERIC(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (search_vector IS NOT NULL) AS has_vector,
    COUNT(*) AS job_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
  FROM jobs
  GROUP BY has_vector
  ORDER BY has_vector DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_search_vector_coverage IS 'Returns percentage of jobs with populated search vectors';

-- ============================================================================
-- 8. UPDATE STATISTICS
-- ============================================================================

-- Gather fresh statistics for query planner
ANALYZE jobs;
ANALYZE job_technologies;

-- ============================================================================
-- 9. VERIFICATION QUERIES
-- ============================================================================

-- Verify quality scores are populated
DO $$
DECLARE
  null_scores INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_scores FROM jobs WHERE quality_score = 0 OR quality_score IS NULL;
  
  IF null_scores > 0 THEN
    RAISE WARNING 'Found jobs with null/zero quality scores: %', null_scores;
  ELSE
    RAISE NOTICE 'All jobs have valid quality scores';
  END IF;
END $$;

-- Verify search vectors are populated
DO $$
DECLARE
  null_vectors INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_vectors FROM jobs WHERE search_vector IS NULL;
  
  IF null_vectors > 0 THEN
    RAISE WARNING 'Found jobs with null search vectors: %', null_vectors;
  ELSE
    RAISE NOTICE 'All jobs have search vectors';
  END IF;
END $$;

-- Display summary statistics
DO $$
DECLARE
  total_jobs INTEGER;
  avg_quality NUMERIC(5,2);
  high_quality INTEGER;
  quality_pct NUMERIC(5,1);
BEGIN
  SELECT 
    COUNT(*),
    ROUND(AVG(quality_score), 2),
    COUNT(*) FILTER (WHERE quality_score >= 70)
  INTO total_jobs, avg_quality, high_quality
  FROM jobs
  WHERE is_active = true;
  
  IF total_jobs > 0 THEN
    quality_pct := ROUND(high_quality * 100.0 / total_jobs, 1);
  ELSE
    quality_pct := 0;
  END IF;
  
  RAISE NOTICE '=================================';
  RAISE NOTICE 'Migration 003 Summary:';
  RAISE NOTICE '=================================';
  RAISE NOTICE 'Total active jobs: %', total_jobs;
  RAISE NOTICE 'Average quality score: %', avg_quality;
  RAISE NOTICE 'High quality jobs (>=70): % (% %%)', high_quality, quality_pct;
  RAISE NOTICE '=================================';
END $$;

-- ============================================================================
-- 10. ROLLBACK SCRIPT (for emergency use)
-- ============================================================================

/*
-- ROLLBACK SCRIPT - Run this if you need to revert the migration

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_jobs_quality_score ON jobs;
DROP TRIGGER IF EXISTS trigger_jobs_search_vector ON jobs;
DROP TRIGGER IF EXISTS trigger_job_technologies_quality_insert ON job_technologies;
DROP TRIGGER IF EXISTS trigger_job_technologies_quality_delete ON job_technologies;

-- Drop functions
DROP FUNCTION IF EXISTS calculate_job_quality_score(jobs);
DROP FUNCTION IF EXISTS jobs_quality_score_update();
DROP FUNCTION IF EXISTS jobs_search_vector_update();
DROP FUNCTION IF EXISTS job_technologies_quality_update();
DROP FUNCTION IF EXISTS get_quality_score_distribution();
DROP FUNCTION IF EXISTS get_search_vector_coverage();

-- Drop indexes
DROP INDEX IF EXISTS idx_jobs_quality_score_active;
DROP INDEX IF EXISTS idx_jobs_search_vector;
DROP INDEX IF EXISTS idx_jobs_region_id_active;
DROP INDEX IF EXISTS idx_jobs_experience_category_active;
DROP INDEX IF EXISTS idx_jobs_salary_max_active;
DROP INDEX IF EXISTS idx_jobs_company_lower_active;
DROP INDEX IF EXISTS idx_jobs_source_apis_active;
DROP INDEX IF EXISTS idx_jobs_remote_quality_posted;
DROP INDEX IF EXISTS idx_jobs_region_experience_quality;
DROP INDEX IF EXISTS idx_jobs_posted_date_range_active;

-- Drop columns
ALTER TABLE jobs DROP COLUMN IF EXISTS quality_score;
ALTER TABLE jobs DROP COLUMN IF EXISTS search_vector;

-- Re-analyze
ANALYZE jobs;
ANALYZE job_technologies;
*/