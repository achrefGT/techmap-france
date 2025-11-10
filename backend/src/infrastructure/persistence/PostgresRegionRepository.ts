// infrastructure/persistence/PostgresRegionRepository.ts
import { IRegionRepository } from '../../domain/repositories/IRegionRepository';
import { Region } from '../../domain/entities/Region';
import { query } from './connection';

export class PostgresRegionRepository implements IRegionRepository {
  async findById(id: number): Promise<Region | null> {
    const result = await query('SELECT * FROM regions WHERE id = $1', [id]);
    return result.rows[0] ? this.mapToEntity(result.rows[0]) : null;
  }

  async findByCode(code: string): Promise<Region | null> {
    const result = await query('SELECT * FROM regions WHERE code = $1', [code]);
    return result.rows[0] ? this.mapToEntity(result.rows[0]) : null;
  }

  async findAll(): Promise<Region[]> {
    const result = await query('SELECT * FROM regions ORDER BY job_count DESC');
    return result.rows.map(row => this.mapToEntity(row));
  }

  async updateJobCount(regionId: number, count: number): Promise<void> {
    await query('UPDATE regions SET job_count = $2 WHERE id = $1', [regionId, count]);
  }

  private mapToEntity(row: any): Region {
    return new Region(
      row.id,
      row.name,
      row.code,
      row.full_name,
      row.job_count || 0,
      row.population
    );
  }
}
