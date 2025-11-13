import { FranceTravailJobDTO } from '../FranceTravailAPI';
import { RawJobData } from '../../../application/use-cases/JobIngestionService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Mapper for France Travail API DTOs to RawJobData
 */
export class FranceTravailMapper {
  /**
   * Convert France Travail DTO to RawJobData for ingestion
   */
  static toRawJobData(dto: FranceTravailJobDTO): RawJobData {
    return {
      id: uuidv4(), // Generate UUID for internal ID
      title: dto.title,
      company: dto.company,
      description: dto.description,
      location: dto.location,
      isRemote: this.detectRemote(dto.location, dto.description),
      salaryMin: dto.salaryMinKEuros,
      salaryMax: dto.salaryMaxKEuros,
      experienceLevel: dto.experienceLevel,
      sourceApi: 'france_travail',
      externalId: dto.externalId,
      sourceUrl: dto.sourceUrl,
      postedDate: dto.postedDate,
    };
  }

  /**
   * Detect if job is remote from location or description
   */
  private static detectRemote(location: string, description: string): boolean {
    const remoteKeywords = [
      'remote',
      'télétravail',
      'teletravail',
      'à distance',
      'full remote',
      '100% remote',
      'home office',
    ];

    const locationLower = location.toLowerCase();
    const descriptionLower = description.toLowerCase();

    return remoteKeywords.some(
      keyword => locationLower.includes(keyword) || descriptionLower.includes(keyword)
    );
  }
}
