import { Technology } from '../entities/Technology';

export interface ITechnologyRepository {
  findById(id: number): Promise<Technology | null>;
  findByName(name: string): Promise<Technology | null>;
  findAll(): Promise<Technology[]>;
  findByCategory(category: string): Promise<Technology[]>;
  save(technology: Technology): Promise<void>;
  updateJobCount(techId: number, count: number): Promise<void>;
}
