import { Region } from '../entities/Region';

export interface IRegionRepository {
  findById(id: number): Promise<Region | null>;
  findByCode(code: string): Promise<Region | null>;
  findAll(): Promise<Region[]>;
  updateJobCount(regionId: number, count: number): Promise<void>;
}
