import { IJobRepository, JobFilters } from '../../domain/repositories/IJobRepository';
import { Job } from '../../domain/entities/Job';
import { query } from './connection';

export class PostgresJobRepository implements IJobRepository {
  async findById(id: string): Promise<Job | null> {
    const result = await query('SELECT * FROM jobs WHERE id = $1', [id]);
    return result.rows[0] ? this.mapToEntity(result.rows[0]) : null;
  }

  async findAll(filters: JobFilters, page: number = 1, limit: number = 25): Promise<Job[]> {
    const offset = (page - 1) * limit;
    const { whereClause, params } = this.buildWhereClause(filters);

    const sql = `
      SELECT j.*, ARRAY_AGG(t.name) as technologies
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

  async count(filters: JobFilters): Promise<number> {
    const { whereClause, params } = this.buildWhereClause(filters);
    const sql = `SELECT COUNT(DISTINCT j.id) FROM jobs j ${whereClause}`;
    const result = await query(sql, params);
    return parseInt(result.rows[0].count);
  }

  async save(job: Job): Promise<void> {
    const sql = `
      INSERT INTO jobs (id, title, company, description, location_raw, region_id, 
        is_remote, salary_min, salary_max, experience_level, source_api, source_url, posted_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        is_active = true,
        fetched_at = NOW()
    `;

    await query(sql, [
      job.id,
      job.title,
      job.company,
      job.description,
      job.location,
      job.regionId,
      job.isRemote,
      job.salaryMin,
      job.salaryMax,
      job.experienceLevel,
      job.sourceApi,
      job.sourceUrl,
      job.postedDate,
    ]);

    if (job.technologies.length > 0) {
      await this.saveTechnologies(job.id, job.technologies);
    }
  }

  async saveMany(jobs: Job[]): Promise<void> {
    if (jobs.length === 0) return;

    // Batch insert jobs
    const jobValues = jobs
      .map((_, i) => {
        const base = i * 13;
        return `(${base + 1}, ${base + 2}, ${base + 3}, ${base + 4}, ${base + 5}, ${base + 6}, ${base + 7}, ${base + 8}, ${base + 9}, ${base + 10}, ${base + 11}, ${base + 12}, ${base + 13})`;
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
      job.salaryMin,
      job.salaryMax,
      job.experienceLevel,
      job.sourceApi,
      job.sourceUrl,
      job.postedDate,
    ]);

    const jobSql = `
      INSERT INTO jobs (id, title, company, description, location_raw, region_id,
        is_remote, salary_min, salary_max, experience_level, source_api, source_url, posted_date)
      VALUES ${jobValues}
      ON CONFLICT (id) DO UPDATE SET is_active = true, fetched_at = NOW()
    `;

    await query(jobSql, jobParams);

    // Batch insert technologies
    const allTechs = jobs.flatMap(job => job.technologies.map(tech => ({ jobId: job.id, tech })));

    if (allTechs.length > 0) {
      await this.saveTechnologiesBatch(allTechs);
    }
  }

  async findRecent(days: number): Promise<Job[]> {
    const sql = `
      SELECT j.*, ARRAY_AGG(t.name) as technologies
      FROM jobs j
      LEFT JOIN job_technologies jt ON j.id = jt.job_id
      LEFT JOIN technologies t ON jt.technology_id = t.id
      WHERE j.posted_date > NOW() - $1::interval
        AND j.is_active = true
      GROUP BY j.id
      ORDER BY j.posted_date DESC
    `;

    const result = await query(sql, [`${days} days`]);
    return result.rows.map(row => this.mapToEntity(row));
  }

  async findByTechnology(techId: number): Promise<Job[]> {
    const sql = `
      SELECT j.*, ARRAY_AGG(t.name) as technologies
      FROM jobs j
      JOIN job_technologies jt ON j.id = jt.job_id
      LEFT JOIN technologies t ON jt.technology_id = t.id
      WHERE jt.technology_id = $1 AND j.is_active = true
      GROUP BY j.id
      ORDER BY j.posted_date DESC
    `;

    const result = await query(sql, [techId]);
    return result.rows.map(row => this.mapToEntity(row));
  }

  async findByRegion(regionId: number): Promise<Job[]> {
    const sql = `
      SELECT j.*, ARRAY_AGG(t.name) as technologies
      FROM jobs j
      LEFT JOIN job_technologies jt ON j.id = jt.job_id
      LEFT JOIN technologies t ON jt.technology_id = t.id
      WHERE j.region_id = $1 AND j.is_active = true
      GROUP BY j.id
      ORDER BY j.posted_date DESC
    `;

    const result = await query(sql, [regionId]);
    return result.rows.map(row => this.mapToEntity(row));
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

  private buildWhereClause(filters: JobFilters): { whereClause: string; params: unknown[] } {
    const conditions: string[] = ['j.is_active = true'];
    const params: unknown[] = [];

    if (filters.regionId) {
      params.push(filters.regionId);
      conditions.push(`j.region_id = $${params.length}`);
    }

    if (filters.technologies && filters.technologies.length > 0) {
      params.push(filters.technologies);
      conditions.push(`EXISTS (
        SELECT 1 FROM job_technologies jt2
        JOIN technologies t2 ON jt2.technology_id = t2.id
        WHERE jt2.job_id = j.id AND t2.name = ANY($${params.length})
      )`);
    }

    if (filters.experienceLevel) {
      params.push(filters.experienceLevel);
      conditions.push(`j.experience_level = $${params.length}`);
    }

    if (filters.isRemote !== undefined) {
      params.push(filters.isRemote);
      conditions.push(`j.is_remote = $${params.length}`);
    }

    if (filters.minSalary) {
      params.push(filters.minSalary);
      conditions.push(`j.salary_min >= $${params.length}`);
    }

    if (filters.postedAfter) {
      params.push(filters.postedAfter);
      conditions.push(`j.posted_date >= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params };
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
        return `(${base + 1}, ${base + 2})`;
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
      row.source_api,
      row.source_url,
      new Date(row.posted_date),
      row.is_active
    );
  }
}
