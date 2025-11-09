// infrastructure/persistence/PostgresStatsRepository.ts
import { IStatsRepository, DailyStatData } from '../../domain/repositories/IStatsRepository';
import { query } from './connection';

export class PostgresStatsRepository implements IStatsRepository {
  async aggregateJobData(): Promise<DailyStatData[]> {
    const sql = `
      SELECT 
        j.region_id as "regionId",
        t.id as "technologyId",
        COUNT(j.id) as "jobCount",
        AVG((j.salary_min + j.salary_max) / 2) as "avgSalary",
        (COUNT(CASE WHEN j.is_remote THEN 1 END)::float / COUNT(*)::float * 100) as "remotePercentage"
      FROM jobs j
      JOIN job_technologies jt ON j.id = jt.job_id
      JOIN technologies t ON jt.technology_id = t.id
      WHERE j.is_active = true
      GROUP BY j.region_id, t.id
    `;

    const result = await query(sql);
    return result.rows.map(row => ({
      regionId: row.regionId,
      technologyId: row.technologyId,
      jobCount: parseInt(row.jobCount),
      avgSalary: row.avgSalary ? parseFloat(row.avgSalary) : null,
      remotePercentage: parseFloat(row.remotePercentage),
    }));
  }

  async saveDailyStats(date: Date, stats: DailyStatData[]): Promise<void> {
    if (stats.length === 0) return;

    const values = stats
      .map((_, i) => {
        const base = i * 5;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
      })
      .join(',');

    const params = stats.flatMap(s => [date, s.regionId, s.technologyId, s.jobCount, s.avgSalary]);

    const sql = `
      INSERT INTO daily_stats (date, region_id, technology_id, job_count, avg_salary)
      VALUES ${values}
      ON CONFLICT (date, region_id, technology_id) 
      DO UPDATE SET job_count = EXCLUDED.job_count, avg_salary = EXCLUDED.avg_salary
    `;

    await query(sql, params);
  }

  async getStatsForPeriod(startDate: Date, endDate: Date): Promise<Map<number, number>> {
    const sql = `
      SELECT technology_id, SUM(job_count) as total
      FROM daily_stats
      WHERE date BETWEEN $1 AND $2
      GROUP BY technology_id
    `;

    const result = await query(sql, [startDate, endDate]);
    const map = new Map<number, number>();

    result.rows.forEach(row => {
      map.set(row.technology_id, parseInt(row.total));
    });

    return map;
  }

  async getHistoricalData(techId: number, months: number): Promise<number[]> {
    const sql = `
      SELECT SUM(job_count) as count
      FROM daily_stats
      WHERE technology_id = $1
        AND date >= NOW() - ($2 || ' months')::interval
      GROUP BY DATE_TRUNC('month', date)
      ORDER BY DATE_TRUNC('month', date) ASC
    `;

    const result = await query(sql, [techId, months]);
    return result.rows.map(row => parseInt(row.count));
  }
}
