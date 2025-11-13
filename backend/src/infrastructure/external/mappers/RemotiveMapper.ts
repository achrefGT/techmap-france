import { RemotiveJobDTO } from '../RemotiveAPI';
import { RawJobData } from '../../../application/use-cases/JobIngestionService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Mapper for Remotive API DTOs to RawJobData
 */
export class RemotiveMapper {
  /**
   * Convert Remotive DTO to RawJobData for ingestion
   */
  static toRawJobData(dto: RemotiveJobDTO): RawJobData {
    return {
      id: uuidv4(),
      title: dto.title,
      company: dto.company,
      description: dto.description,
      location: dto.location,
      isRemote: true, // Remotive is exclusively remote jobs
      salaryMin: dto.salaryMinKEuros,
      salaryMax: dto.salaryMaxKEuros,
      experienceLevel: dto.experienceLevel,
      sourceApi: 'remotive',
      externalId: dto.externalId,
      sourceUrl: dto.sourceUrl,
      postedDate: dto.postedDate,
    };
  }
}
