import {
  IJobRepository,
  JobFilters,
  BulkSaveResult,
} from '../../domain/repositories/IJobRepository';
import { Job } from '../../domain/entities/Job';
import { ExperienceLevel } from '../../domain/constants/JobConfig';
import { query } from './connection';

/**
 * UPDATED: PostgreSQL Job Repository
 *
 * Main changes:
 * - Enhanced buildWhereClause() to support all new filters
 * - Kept findRecent(), findByTechnology(), findByRegion() for backward compatibility
 *   (but marked as deprecated - use findAll() instead)
 */
export class PostgresJobRepository implements IJobRepository {
  async findById(id: string): Promise<Job | null> {
    const result = await query('SELECT * FROM jobs WHERE id = $1', [id]);
    return result.rows[0] ? this.mapToEntity(result.rows[0]) : null;
  }

  /**
   * UPDATED: Enhanced to support comprehensive filtering
   */
  async findAll(filters: JobFilters, page: number = 1, limit: number = 25): Promise<Job[]> {
    const offset = (page - 1) * limit;
    const { whereClause, params } = this.buildWhereClause(filters);

    const sql = `
      SELECT j.*, ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as technologies
      FROM jobs j
      LEFT JOIN job_technologies jt ON j.id = jt.job_id
      LEFT JOIN technologies t ON jt.technology_id = t.id
      ${whereClause}
      GROUP BY j.id
      ORDER BY j.posted_date DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await query(sql, [...params, limit, offset]);
    return result.rows.map(row => this.mapToEntity(row));
  }

  /**
   * UPDATED: Enhanced to support comprehensive filtering
   */
  async count(filters: JobFilters): Promise<number> {
    const { whereClause, params } = this.buildWhereClause(filters);

    // Note: COUNT(DISTINCT j.id) is needed when joining with technologies
    const sql = `
      SELECT COUNT(DISTINCT j.id) 
      FROM jobs j 
      ${this.needsJoinForFilters(filters) ? this.getJoinsClause() : ''}
      ${whereClause}
    `;

    const result = await query(sql, params);
    return parseInt(result.rows[0].count);
  }

  async save(job: Job): Promise<void> {
    const sql = `
      INSERT INTO jobs (id, title, company, description, location_raw, region_id, 
        is_remote, salary_min, salary_max, experience_level, experience_category,
        source_api, external_id, source_url, posted_date, source_apis)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (id) DO UPDATE SET
        is_active = true,
        fetched_at = NOW(),
        source_apis = EXCLUDED.source_apis
    `;

    await query(sql, [
      job.id,
      job.title,
      job.company,
      job.description,
      job.location,
      job.regionId,
      job.isRemote,
      job.salaryMinKEuros,
      job.salaryMaxKEuros,
      job.experienceLevel,
      job.experienceCategory,
      job.sourceApi,
      job.externalId,
      job.sourceUrl,
      job.postedDate,
      job.sourceApis,
    ]);

    if (job.technologies.length > 0) {
      await this.saveTechnologies(job.id, job.technologies);
    }
  }

  async saveMany(jobs: Job[]): Promise<BulkSaveResult> {
    const result: BulkSaveResult = {
      inserted: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    if (jobs.length === 0) return result;

    try {
      // Get existing job IDs to determine inserts vs updates
      const jobIds = jobs.map(j => j.id);
      const existingResult = await query('SELECT id FROM jobs WHERE id = ANY($1)', [jobIds]);
      const existingIds = new Set(existingResult.rows.map(row => row.id));

      // Count inserts and updates
      result.inserted = jobs.filter(j => !existingIds.has(j.id)).length;
      result.updated = jobs.filter(j => existingIds.has(j.id)).length;

      // Batch insert/update jobs
      const jobValues = jobs
        .map((_, i) => {
          const base = i * 16;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16})`;
        })
        .join(',');

      const jobParams = jobs.flatMap(job => [
        job.id,
        job.title,
        job.company,
        job.description,
        job.location,
        job.regionId,
        job.isRemote,
        job.salaryMinKEuros,
        job.salaryMaxKEuros,
        job.experienceLevel,
        job.experienceCategory,
        job.sourceApi,
        job.externalId,
        job.sourceUrl,
        job.postedDate,
        job.sourceApis,
      ]);

      const jobSql = `
        INSERT INTO jobs (id, title, company, description, location_raw, region_id,
          is_remote, salary_min, salary_max, experience_level, experience_category,
          source_api, external_id, source_url, posted_date, source_apis)
        VALUES ${jobValues}
        ON CONFLICT (id) DO UPDATE SET 
          is_active = true, 
          fetched_at = NOW(),
          source_apis = EXCLUDED.source_apis
      `;

      await query(jobSql, jobParams);

      // Batch insert technologies
      const allTechs = jobs.flatMap(job => job.technologies.map(tech => ({ jobId: job.id, tech })));

      if (allTechs.length > 0) {
        await this.saveTechnologiesBatch(allTechs);
      }
    } catch (error) {
      // If bulk operation fails entirely, mark all as failed
      result.failed = jobs.length;
      result.inserted = 0;
      result.updated = 0;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Bulk save failed: ${errorMessage}`);
    }

    return result;
  }

  /**
   * DEPRECATED: Use findAll({ recentDays: days }) instead
   * Kept for backward compatibility
   */
  async findRecent(days: number): Promise<Job[]> {
    return this.findAll({ recentDays: days }, 1, 10000);
  }

  /**
   * DEPRECATED: Use findAll({ technologies: [techName] }) instead
   * Kept for backward compatibility
   */
  async findByTechnology(techId: number): Promise<Job[]> {
    // Need to get technology name from ID
    const techResult = await query('SELECT name FROM technologies WHERE id = $1', [techId]);
    if (techResult.rows.length === 0) return [];

    const techName = techResult.rows[0].name;
    return this.findAll({ technologies: [techName] }, 1, 10000);
  }

  /**
   * DEPRECATED: Use findAll({ regionIds: [regionId] }) instead
   * Kept for backward compatibility
   */
  async findByRegion(regionId: number): Promise<Job[]> {
    return this.findAll({ regionIds: [regionId] }, 1, 10000);
  }

  async deactivateOldJobs(days: number): Promise<number> {
    const sql = `
      UPDATE jobs SET is_active = false
      WHERE posted_date < NOW() - $1::interval
        AND is_active = true
      RETURNING id
    `;

    const result = await query(sql, [`${days} days`]);
    return result.rowCount || 0;
  }

  /**
   * UPDATED: Build WHERE clause supporting all filter types
   */
  private buildWhereClause(filters: JobFilters): { whereClause: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    // Active filter (default to true unless explicitly set)
    if (filters.isActive !== undefined) {
      params.push(filters.isActive);
      conditions.push(`j.is_active = $${params.length}`);
    } else {
      conditions.push('j.is_active = true'); // Default behavior
    }

    // Region filter - support multiple regions (OR condition)
    if (filters.regionIds && filters.regionIds.length > 0) {
      params.push(filters.regionIds);
      conditions.push(`j.region_id = ANY($${params.length})`);
    } else if (filters.regionId) {
      // Backward compatibility with single regionId
      params.push(filters.regionId);
      conditions.push(`j.region_id = $${params.length}`);
    }

    // Technology filter - ALL technologies must be present (AND condition)
    if (filters.technologies && filters.technologies.length > 0) {
      params.push(filters.technologies);
      conditions.push(`
        (SELECT COUNT(DISTINCT t2.name) 
         FROM job_technologies jt2
         JOIN technologies t2 ON jt2.technology_id = t2.id
         WHERE jt2.job_id = j.id AND t2.name = ANY($${params.length})
        ) = $${params.length + 1}
      `);
      params.push(filters.technologies.length);
    }

    // Experience filter - support multiple levels (OR condition)
    if (filters.experienceCategories && filters.experienceCategories.length > 0) {
      params.push(filters.experienceCategories);
      conditions.push(`j.experience_category = ANY($${params.length})`);
    } else if (filters.experienceLevel) {
      // Backward compatibility with single experienceLevel
      params.push(filters.experienceLevel);
      conditions.push(`j.experience_category = $${params.length}`);
    }

    // Remote filter
    if (filters.isRemote !== undefined) {
      params.push(filters.isRemote);
      conditions.push(`j.is_remote = $${params.length}`);
    }

    // Salary filters
    if (filters.minSalary !== undefined) {
      params.push(filters.minSalary);
      conditions.push(`j.salary_min >= $${params.length}`);
    }

    if (filters.maxSalary !== undefined) {
      params.push(filters.maxSalary);
      conditions.push(`j.salary_max <= $${params.length}`);
    }

    // Date filters
    if (filters.postedAfter) {
      params.push(filters.postedAfter);
      conditions.push(`j.posted_date >= $${params.length}`);
    }

    if (filters.postedBefore) {
      params.push(filters.postedBefore);
      conditions.push(`j.posted_date <= $${params.length}`);
    }

    // Recent days filter (shorthand for postedAfter)
    if (filters.recentDays !== undefined && !filters.postedAfter) {
      params.push(`${filters.recentDays} days`);
      conditions.push(`j.posted_date > NOW() - $${params.length}::interval`);
    }

    // Company filter (case-insensitive exact match)
    if (filters.company) {
      params.push(filters.company.toLowerCase());
      conditions.push(`LOWER(j.company) = $${params.length}`);
    }

    // Source API filter - support multiple sources (OR condition)
    if (filters.sourceApis && filters.sourceApis.length > 0) {
      params.push(filters.sourceApis);
      conditions.push(`j.source_apis && $${params.length}`);
    }

    // Text search filter (searches title, company, description)
    if (filters.searchQuery) {
      params.push(`%${filters.searchQuery.toLowerCase()}%`);
      conditions.push(`(
        LOWER(j.title) LIKE $${params.length} OR
        LOWER(j.company) LIKE $${params.length} OR
        LOWER(j.description) LIKE $${params.length}
      )`);
    }

    // Quality score filter
    // Uses pre-computed quality_score column (added in migration 003)
    if (filters.minQualityScore !== undefined) {
      params.push(filters.minQualityScore);
      conditions.push(`j.quality_score >= ${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params };
  }

  /**
   * Helper to determine if we need joins for filtering
   */
  private needsJoinForFilters(filters: JobFilters): boolean {
    return !!(filters.technologies?.length || filters.minQualityScore !== undefined);
  }

  /**
   * Helper to get join clauses when needed
   */
  private getJoinsClause(): string {
    return `
      LEFT JOIN job_technologies jt ON j.id = jt.job_id
      LEFT JOIN technologies t ON jt.technology_id = t.id
    `;
  }

  private async saveTechnologies(jobId: string, technologies: string[]): Promise<void> {
    const techResult = await query('SELECT id, name FROM technologies WHERE name = ANY($1)', [
      technologies,
    ]);
    const techMap = new Map(techResult.rows.map(row => [row.name, row.id]));

    if (techMap.size > 0) {
      const values = Array.from(techMap.values())
        .map((_, i) => `($1, $${i + 2})`)
        .join(',');

      const sql = `INSERT INTO job_technologies (job_id, technology_id) VALUES ${values} ON CONFLICT DO NOTHING`;
      await query(sql, [jobId, ...Array.from(techMap.values())]);
    }
  }

  private async saveTechnologiesBatch(
    items: Array<{ jobId: string; tech: string }>
  ): Promise<void> {
    const uniqueTechs = [...new Set(items.map(item => item.tech))];
    const techResult = await query('SELECT id, name FROM technologies WHERE name = ANY($1)', [
      uniqueTechs,
    ]);
    const techMap = new Map(techResult.rows.map(row => [row.name, row.id]));

    const values = items
      .filter(item => techMap.has(item.tech))
      .map((_, i) => {
        const base = i * 2;
        return `($${base + 1}, $${base + 2})`;
      })
      .join(',');

    if (values) {
      const params = items
        .filter(item => techMap.has(item.tech))
        .flatMap(item => [item.jobId, techMap.get(item.tech)]);

      const sql = `INSERT INTO job_technologies (job_id, technology_id) VALUES ${values} ON CONFLICT DO NOTHING`;
      await query(sql, params);
    }
  }

  private mapToEntity(row: any): Job {
    return new Job(
      row.id,
      row.title,
      row.company,
      row.description,
      row.technologies || [],
      row.location_raw,
      row.region_id,
      row.is_remote,
      row.salary_min,
      row.salary_max,
      row.experience_level,
      (row.experience_category as ExperienceLevel) || 'unknown',
      row.source_api,
      row.external_id,
      row.source_url,
      new Date(row.posted_date),
      row.is_active,
      row.created_at ? new Date(row.created_at) : new Date(),
      row.updated_at ? new Date(row.updated_at) : new Date(),
      row.source_apis || [row.source_api]
    );
  }
}
