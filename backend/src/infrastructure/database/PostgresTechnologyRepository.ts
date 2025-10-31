import { ITechnologyRepository } from '../../domain/repositories/ITechnologyRepository';
import { Technology } from '../../domain/entities/Technology';
import { query } from './connection';

export class PostgresTechnologyRepository implements ITechnologyRepository {
  async findById(id: number): Promise<Technology | null> {
    const result = await query('SELECT * FROM technologies WHERE id = $1', [id]);
    return result.rows[0] ? this.mapToEntity(result.rows[0]) : null;
  }

  async findByName(name: string): Promise<Technology | null> {
    const result = await query('SELECT * FROM technologies WHERE name = $1', [name]);
    return result.rows[0] ? this.mapToEntity(result.rows[0]) : null;
  }

  async findAll(): Promise<Technology[]> {
    const sql = `
      SELECT * FROM technologies
      ORDER BY job_count DESC, name ASC
    `;
    const result = await query(sql);
    return result.rows.map(row => this.mapToEntity(row));
  }

  async findByCategory(category: string): Promise<Technology[]> {
    const sql = `
      SELECT * FROM technologies
      WHERE category = $1
      ORDER BY job_count DESC, name ASC
    `;
    const result = await query(sql, [category]);
    return result.rows.map(row => this.mapToEntity(row));
  }

  async save(technology: Technology): Promise<void> {
    const sql = `
      INSERT INTO technologies (id, name, category, display_name, job_count)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (name) DO UPDATE
        SET category = EXCLUDED.category,
            display_name = EXCLUDED.display_name,
            job_count = EXCLUDED.job_count
    `;

    await query(sql, [
      technology.id,
      technology.name,
      technology.category,
      technology.displayName,
      technology.jobCount,
    ]);
  }

  async updateJobCount(techId: number, count: number): Promise<void> {
    const sql = `
      UPDATE technologies
      SET job_count = $2
      WHERE id = $1
    `;
    await query(sql, [techId, count]);
  }

  private mapToEntity(row: Record<string, unknown>): Technology {
    return new Technology(
      row.id as number,
      row.name as string,
      row.category as string,
      row.display_name as string,
      (row.job_count as number) || 0
    );
  }
}
