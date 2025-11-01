import axios, { AxiosError } from 'axios';
import { techDetector } from './TechnologyDetector';

interface AdzunaSearchOptions {
  keywords?: string;
  maxPages?: number;
  resultsPerPage?: number;
  delayBetweenRequests?: number;
}

interface AdzunaJobResponse {
  id: string;
  title?: string;
  company?: {
    display_name?: string;
  };
  description?: string;
  location?: {
    display_name?: string;
    area?: string[];
  };
  salary_min?: number;
  salary_max?: number;
  redirect_url?: string;
  created?: string;
}

/**
 * DTO for job data from Adzuna API
 * This represents raw data before domain entity creation
 */
export interface AdzunaJobDTO {
  externalId: string;
  title: string;
  company: string;
  description: string;
  technologies: string[];
  location: string;
  regionId: number | null;
  salaryMinKEuros: number | null;
  salaryMaxKEuros: number | null;
  experienceLevel: null; // Always null - domain layer responsibility
  sourceUrl: string;
  postedDate: Date;
}

/**
 * Optional region repository interface for region lookups
 */
interface RegionRepository {
  findByCode(code: string): Promise<number | null>;
}

export class AdzunaAPI {
  private baseUrl = 'https://api.adzuna.com/v1/api/jobs/fr/search';
  private readonly MAX_RESULTS_PER_PAGE = 50;
  private readonly DEFAULT_DELAY_MS = 200;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 1000;
  private readonly SOURCE_NAME = 'adzuna';

  // Region mapping: normalized location string (without accents) -> region code
  private regionCodeMapping: Map<string, string> = new Map([
    ['ile-de-france', 'IDF'],
    ['paris', 'IDF'],
    ['auvergne-rhone-alpes', 'ARA'],
    ['lyon', 'ARA'],
    ["provence-alpes-cote d'azur", 'PAC'],
    ['marseille', 'PAC'],
    ['occitanie', 'OCC'],
    ['toulouse', 'OCC'],
    ['nouvelle-aquitaine', 'NAQ'],
    ['bordeaux', 'NAQ'],
    ['hauts-de-france', 'HDF'],
    ['lille', 'HDF'],
    ['grand est', 'GES'],
    ['strasbourg', 'GES'],
    ['bretagne', 'BRE'],
    ['rennes', 'BRE'],
    ['pays de la loire', 'PDL'],
    ['nantes', 'PDL'],
    ['normandie', 'NOR'],
    ['bourgogne-franche-comte', 'BFC'],
    ['centre-val de loire', 'CVL'],
    ['corse', 'COR'],
  ]);

  private regionIdCache: Map<string, number> = new Map();

  constructor(
    private appId: string,
    private appKey: string,
    private regionRepository?: RegionRepository
  ) {
    if (!appId || !appKey) {
      throw new Error('Adzuna API credentials (appId and appKey) are required');
    }
  }

  /**
   * Fetch jobs with optional pagination
   * Returns DTOs, not domain entities
   */
  async fetchJobs(options: AdzunaSearchOptions = {}): Promise<AdzunaJobDTO[]> {
    const {
      keywords = 'développeur',
      maxPages = 1,
      resultsPerPage = this.MAX_RESULTS_PER_PAGE,
      delayBetweenRequests = this.DEFAULT_DELAY_MS,
    } = options;

    if (resultsPerPage > this.MAX_RESULTS_PER_PAGE) {
      console.warn(
        `results_per_page exceeds maximum (${this.MAX_RESULTS_PER_PAGE}), using maximum`
      );
    }

    const actualResultsPerPage = Math.min(resultsPerPage, this.MAX_RESULTS_PER_PAGE);
    const allJobs: AdzunaJobDTO[] = [];

    try {
      for (let page = 1; page <= maxPages; page++) {
        const pageJobs = await this.fetchPage(keywords, page, actualResultsPerPage);

        if (pageJobs.length === 0) {
          break;
        }

        allJobs.push(...pageJobs);

        if (page < maxPages && pageJobs.length > 0) {
          await this.delay(delayBetweenRequests);
        }
      }

      return allJobs;
    } catch (error) {
      console.error('Adzuna API error:', error);
      return allJobs;
    }
  }

  /**
   * Fetch a single page of results with retry logic
   */
  private async fetchPage(
    keywords: string,
    page: number,
    resultsPerPage: number,
    attempt: number = 1
  ): Promise<AdzunaJobDTO[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/${page}`, {
        params: {
          app_id: this.appId,
          app_key: this.appKey,
          what: keywords,
          results_per_page: resultsPerPage,
        },
        headers: {
          Accept: 'application/json',
        },
        timeout: 15000,
        validateStatus: status => status >= 200 && status < 300,
      });

      if (response.status !== 200) {
        throw new Error(`Unexpected status code: ${response.status}`);
      }

      const jobs: AdzunaJobResponse[] = response.data.results || [];
      const mappedJobs = await Promise.all(jobs.map(job => this.mapToDTO(job)));

      return mappedJobs.filter((dto): dto is AdzunaJobDTO => dto !== null);
    } catch (error) {
      return this.handleRequestError(error, keywords, page, resultsPerPage, attempt);
    }
  }

  /**
   * Handle request errors with retry logic for transient failures
   */
  private async handleRequestError(
    error: unknown,
    keywords: string,
    page: number,
    resultsPerPage: number,
    attempt: number
  ): Promise<AdzunaJobDTO[]> {
    const isAxiosError = axios.isAxiosError(error);
    const axiosError = error as AxiosError;

    const shouldRetry =
      attempt < this.MAX_RETRY_ATTEMPTS &&
      isAxiosError &&
      (axiosError.code === 'ECONNABORTED' ||
        axiosError.code === 'ETIMEDOUT' ||
        (axiosError.response?.status && axiosError.response.status >= 500));

    if (shouldRetry) {
      const backoffDelay = this.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(
        `Adzuna API request failed (attempt ${attempt}/${this.MAX_RETRY_ATTEMPTS}), ` +
          `retrying in ${backoffDelay}ms...`,
        isAxiosError ? axiosError.message : error
      );

      await this.delay(backoffDelay);
      return this.fetchPage(keywords, page, resultsPerPage, attempt + 1);
    }

    if (isAxiosError) {
      if (axiosError.response) {
        console.error(
          `Adzuna API error (status ${axiosError.response.status}):`,
          axiosError.response.data
        );
      } else if (axiosError.request) {
        console.error('Adzuna API error: No response received', axiosError.message);
      } else {
        console.error('Adzuna API error:', axiosError.message);
      }
    } else {
      console.error('Adzuna API unexpected error:', error);
    }

    return [];
  }

  /**
   * Map raw API response to DTO with error handling
   */
  private async mapToDTO(rawJob: AdzunaJobResponse): Promise<AdzunaJobDTO | null> {
    try {
      if (!rawJob.id) {
        console.warn('Skipping job without ID:', rawJob);
        return null;
      }

      const title = rawJob.title || 'Sans titre';
      const company = rawJob.company?.display_name || 'Non spécifié';
      const description = rawJob.description || '';
      const fullText = `${title} ${description}`;

      // Detect technologies
      const technologies = techDetector.detect(fullText);

      // Validate minimum technology requirement
      if (technologies.length === 0) {
        console.warn(`Skipping job: No technologies detected`, rawJob);
        return null;
      }

      // Extract region ID
      const regionId = await this.extractRegionId(rawJob.location?.display_name);

      // Convert salary from full euros to k€
      const salaryMinKEuros = rawJob.salary_min ? Math.round(rawJob.salary_min / 1000) : null;
      const salaryMaxKEuros = rawJob.salary_max ? Math.round(rawJob.salary_max / 1000) : null;

      // Handle date
      let postedDate: Date;
      try {
        postedDate = rawJob.created ? new Date(rawJob.created) : new Date();
        if (isNaN(postedDate.getTime()) || postedDate > new Date()) {
          postedDate = new Date();
        }
      } catch {
        postedDate = new Date();
      }

      return {
        externalId: `adzuna-${rawJob.id}`,
        title,
        company,
        description,
        technologies,
        location: rawJob.location?.display_name || 'France',
        regionId,
        salaryMinKEuros,
        salaryMaxKEuros,
        experienceLevel: null, // Domain layer responsibility
        sourceUrl: rawJob.redirect_url || '',
        postedDate,
      };
    } catch (error) {
      console.error('Error mapping Adzuna job:', error, rawJob);
      return null;
    }
  }

  /**
   * Extract region ID from location string
   */
  private async extractRegionId(location?: string): Promise<number | null> {
    if (!location) return null;

    const normalizedLocation = this.normalizeString(location);

    for (const [normalizedKey, regionCode] of this.regionCodeMapping) {
      if (normalizedLocation.includes(normalizedKey)) {
        if (this.regionIdCache.has(regionCode)) {
          return this.regionIdCache.get(regionCode)!;
        }

        if (this.regionRepository) {
          const regionId = await this.regionRepository.findByCode(regionCode);
          if (regionId) {
            this.regionIdCache.set(regionCode, regionId);
            return regionId;
          }
        }

        return null;
      }
    }

    return null;
  }

  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get the source name for this API
   */
  getSourceName(): string {
    return this.SOURCE_NAME;
  }
}
