-- Migration 001: Initial Schema
-- Creates all core tables for the job aggregator

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- REGIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS regions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) NOT NULL UNIQUE,
  full_name VARCHAR(200) NOT NULL,
  job_count INTEGER DEFAULT 0,
  population INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- TECHNOLOGIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS technologies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  category VARCHAR(20) NOT NULL CHECK (category IN ('frontend', 'backend', 'database', 'devops', 'ai-ml', 'mobile', 'other')),
  display_name VARCHAR(50) NOT NULL,
  job_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- JOBS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic info
  title VARCHAR(200) NOT NULL,
  company VARCHAR(200) NOT NULL,
  description TEXT,
  
  -- Location
  location_raw VARCHAR(200),
  region_id INTEGER REFERENCES regions(id) ON DELETE SET NULL,
  is_remote BOOLEAN DEFAULT false,
  
  -- Salary (stored in k€)
  salary_min INTEGER,
  salary_max INTEGER,
  
  -- Experience
  experience_level VARCHAR(100),
  experience_category VARCHAR(20) NOT NULL DEFAULT 'unknown' CHECK (experience_category IN ('junior', 'mid', 'senior', 'lead', 'unknown')),
  
  -- Source tracking
  source_api VARCHAR(50) NOT NULL,
  external_id VARCHAR(200) NOT NULL,
  source_url TEXT,
  source_apis TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Dates
  posted_date TIMESTAMP NOT NULL,
  fetched_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Constraints
  CONSTRAINT unique_job_per_source UNIQUE (source_api, external_id),
  CONSTRAINT salary_range_valid CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max),
  CONSTRAINT salary_realistic CHECK (
    (salary_min IS NULL OR (salary_min >= 20 AND salary_min <= 300)) AND
    (salary_max IS NULL OR (salary_max >= 20 AND salary_max <= 300))
  )
);

-- ============================================================================
-- JOB_TECHNOLOGIES (Many-to-Many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS job_technologies (
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  technology_id INTEGER NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  PRIMARY KEY (job_id, technology_id)
);

-- ============================================================================
-- DAILY_STATS (For analytics/trends)
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_stats (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  region_id INTEGER REFERENCES regions(id) ON DELETE CASCADE,
  technology_id INTEGER REFERENCES technologies(id) ON DELETE CASCADE,
  job_count INTEGER NOT NULL DEFAULT 0,
  avg_salary NUMERIC(10, 2),
  remote_percentage NUMERIC(5, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_daily_stat UNIQUE (date, region_id, technology_id)
);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE jobs IS 'Job postings aggregated from multiple sources';
COMMENT ON COLUMN jobs.salary_min IS 'Minimum salary in thousands of euros (k€)';
COMMENT ON COLUMN jobs.salary_max IS 'Maximum salary in thousands of euros (k€)';
COMMENT ON COLUMN jobs.experience_category IS 'Detected experience level category';
COMMENT ON COLUMN jobs.source_apis IS 'Array of all APIs this job appeared in (for deduplication)';

COMMENT ON TABLE regions IS 'French regions for job location filtering';
COMMENT ON TABLE technologies IS 'Technology stack tags with job counts';
COMMENT ON TABLE job_technologies IS 'Many-to-many relationship between jobs and technologies';
COMMENT ON TABLE daily_stats IS 'Historical statistics for trend analysis';