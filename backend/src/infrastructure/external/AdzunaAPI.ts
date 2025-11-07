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
  salary_is_predicted?: string;
  redirect_url?: string;
  created?: string;
  contract_type?: string;
}

/**
 * Enum for salary prediction status
 */
export enum SalaryPredictionStatus {
  ACTUAL = 'actual',
  PREDICTED = 'predicted',
  MISSING = 'missing',
}

/**
 * Interface for normalized salary data
 */
export interface NormalizedSalary {
  minKEuros: number | null;
  maxKEuros: number | null;
  isPredicted: SalaryPredictionStatus;
  isReliable: boolean;
  originalMin?: number;
  originalMax?: number;
}

/**
 * DTO for job data from Adzuna API
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
  salaryPredictionStatus: SalaryPredictionStatus;
  salaryIsReliable: boolean;
  experienceLevel: null;
  sourceUrl: string;
  postedDate: Date;
}

/**
 * Optional region repository interface
 */
interface RegionRepository {
  findByCode(code: string): Promise<number | null>;
}

/**
 * Configuration for salary normalization
 */
interface SalaryNormalizationConfig {
  // Daily rate thresholds (in euros)
  minDailyRate: number;
  maxDailyRate: number;

  // Annual salary thresholds (in euros)
  minAnnualSalary: number;
  maxAnnualSalary: number;

  // Maximum acceptable range multiplier (max/min ratio)
  maxRangeRatio: number;

  // Minimum acceptable salary for tech jobs (in k€)
  minTechSalaryKEuros: number;
}

export class AdzunaAPI {
  private baseUrl = 'https://api.adzuna.com/v1/api/jobs/fr/search';
  private readonly MAX_RESULTS_PER_PAGE = 50;
  private readonly DEFAULT_DELAY_MS = 200;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 1000;
  private readonly SOURCE_NAME = 'adzuna';

  // Salary normalization configuration
  private readonly salaryConfig: SalaryNormalizationConfig = {
    minDailyRate: 100,
    maxDailyRate: 1500,
    minAnnualSalary: 20000,
    maxAnnualSalary: 250000,
    maxRangeRatio: 3.0,
    minTechSalaryKEuros: 25,
  };

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
  private regionLookupPromises: Map<string, Promise<number | null>> = new Map();

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
   * Fetch a single page with retry logic
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
   * Handle request errors with retry logic
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
   * Normalize salary data with advanced inconsistency handling
   */
  private normalizeSalary(rawJob: AdzunaJobResponse): NormalizedSalary {
    const salaryMin = rawJob.salary_min;
    const salaryMax = rawJob.salary_max;
    const isPredicted = rawJob.salary_is_predicted === '1';

    // Case 1: No salary data
    if (!salaryMin && !salaryMax) {
      return {
        minKEuros: null,
        maxKEuros: null,
        isPredicted: SalaryPredictionStatus.MISSING,
        isReliable: false,
      };
    }

    // Determine if values are daily rates or annual salaries
    const isDailyRate = this.isDailyRate(salaryMin, salaryMax, rawJob.contract_type);

    let normalizedMin: number | null = null;
    let normalizedMax: number | null = null;

    if (isDailyRate) {
      // Convert daily rates to annual (assuming 218 working days/year)
      normalizedMin = salaryMin ? Math.round((salaryMin * 218) / 1000) : null;
      normalizedMax = salaryMax ? Math.round((salaryMax * 218) / 1000) : null;
    } else {
      // Already annual, convert to k€
      normalizedMin = salaryMin ? Math.round(salaryMin / 1000) : null;
      normalizedMax = salaryMax ? Math.round(salaryMax / 1000) : null;
    }

    // Validate and adjust salary range
    const adjustedSalary = this.validateAndAdjustSalaryRange(normalizedMin, normalizedMax);

    // Determine reliability
    const isReliable = this.isSalaryReliable(
      adjustedSalary.minKEuros,
      adjustedSalary.maxKEuros,
      isPredicted
    );

    const predictionStatus = isPredicted
      ? SalaryPredictionStatus.PREDICTED
      : adjustedSalary.minKEuros === null && adjustedSalary.maxKEuros === null
        ? SalaryPredictionStatus.MISSING
        : SalaryPredictionStatus.ACTUAL;

    return {
      minKEuros: adjustedSalary.minKEuros,
      maxKEuros: adjustedSalary.maxKEuros,
      isPredicted: predictionStatus,
      isReliable,
      originalMin: salaryMin,
      originalMax: salaryMax,
    };
  }

  /**
   * Determine if salary values represent daily rates
   */
  private isDailyRate(salaryMin?: number, salaryMax?: number, contractType?: string): boolean {
    // Contract type hint
    if (contractType === 'contract') {
      return true;
    }

    // No salary data to evaluate
    if (!salaryMin && !salaryMax) {
      return false;
    }

    // Check numeric ranges - use the higher value if available
    const valueToCheck = salaryMax || salaryMin || 0;

    // If value is within daily rate range, likely a daily rate
    if (
      valueToCheck >= this.salaryConfig.minDailyRate &&
      valueToCheck <= this.salaryConfig.maxDailyRate
    ) {
      return true;
    }

    // Edge case: very small values (< 5000) are likely daily rates
    // This catches cases like salary_min: 40, salary_max: 65
    if (valueToCheck > 0 && valueToCheck < 5000) {
      return true;
    }

    return false;
  }

  /**
   * Validate and adjust salary range for consistency
   */
  private validateAndAdjustSalaryRange(
    minKEuros: number | null,
    maxKEuros: number | null
  ): { minKEuros: number | null; maxKEuros: number | null } {
    // Case: Only one value provided
    if (minKEuros !== null && maxKEuros === null) {
      // Use min as a point estimate
      return { minKEuros, maxKEuros: minKEuros };
    }

    if (minKEuros === null && maxKEuros !== null) {
      // Use max as a point estimate
      return { minKEuros: maxKEuros, maxKEuros };
    }

    if (minKEuros === null || maxKEuros === null) {
      return { minKEuros: null, maxKEuros: null };
    }

    // Case: Min > Max (swap them)
    if (minKEuros > maxKEuros) {
      console.warn(`Salary min (${minKEuros}) > max (${maxKEuros}), swapping values`);
      [minKEuros, maxKEuros] = [maxKEuros, minKEuros];
    }

    // Case: Range is too wide (unrealistic)
    const rangeRatio = maxKEuros / minKEuros;
    if (rangeRatio > this.salaryConfig.maxRangeRatio) {
      console.warn(`Salary range too wide (ratio: ${rangeRatio.toFixed(2)}), using midpoint`);
      const midpoint = Math.round((minKEuros + maxKEuros) / 2);
      return { minKEuros: midpoint, maxKEuros: midpoint };
    }

    // Case: Unrealistic values (too low or too high)
    if (
      minKEuros < this.salaryConfig.minTechSalaryKEuros ||
      maxKEuros > this.salaryConfig.maxAnnualSalary / 1000
    ) {
      console.warn(`Salary values outside realistic range: ${minKEuros}-${maxKEuros}k€`);
      return { minKEuros: null, maxKEuros: null };
    }

    return { minKEuros, maxKEuros };
  }

  /**
   * Determine if salary data is reliable
   */
  private isSalaryReliable(
    minKEuros: number | null,
    maxKEuros: number | null,
    isPredicted: boolean
  ): boolean {
    // Missing data is not reliable
    if (minKEuros === null && maxKEuros === null) {
      return false;
    }

    // Predicted salaries are less reliable
    if (isPredicted) {
      return false;
    }

    // Check if values are within realistic ranges
    if (minKEuros !== null && minKEuros < this.salaryConfig.minTechSalaryKEuros) {
      return false;
    }

    if (maxKEuros !== null && maxKEuros > this.salaryConfig.maxAnnualSalary / 1000) {
      return false;
    }

    return true;
  }

  /**
   * Map raw API response to DTO
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

      if (technologies.length === 0) {
        console.warn(`Skipping job: No technologies detected`, rawJob);
        return null;
      }

      // Normalize salary with advanced handling
      const normalizedSalary = this.normalizeSalary(rawJob);

      // Extract region ID
      const regionId = await this.extractRegionId(rawJob.location?.display_name);

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
        salaryMinKEuros: normalizedSalary.minKEuros,
        salaryMaxKEuros: normalizedSalary.maxKEuros,
        salaryPredictionStatus: normalizedSalary.isPredicted,
        salaryIsReliable: normalizedSalary.isReliable,
        experienceLevel: null,
        sourceUrl: rawJob.redirect_url || '',
        postedDate,
      };
    } catch (error) {
      console.error('Error mapping Adzuna job:', error, rawJob);
      return null;
    }
  }

  /**
   * Extract region ID from location string with race condition protection
   */
  private async extractRegionId(location?: string): Promise<number | null> {
    if (!location) return null;

    const normalizedLocation = this.normalizeString(location);

    for (const [normalizedKey, regionCode] of this.regionCodeMapping) {
      if (normalizedLocation.includes(normalizedKey)) {
        // Check if we have a cached result
        if (this.regionIdCache.has(regionCode)) {
          return this.regionIdCache.get(regionCode)!;
        }

        // Check if there's already a pending lookup for this region code
        if (this.regionLookupPromises.has(regionCode)) {
          return this.regionLookupPromises.get(regionCode)!;
        }

        // Create a new lookup promise
        if (this.regionRepository) {
          const lookupPromise = this.regionRepository
            .findByCode(regionCode)
            .then(regionId => {
              // Clean up the promise from the pending map
              this.regionLookupPromises.delete(regionCode);

              // Cache the result if found
              if (regionId) {
                this.regionIdCache.set(regionCode, regionId);
              }

              return regionId;
            })
            .catch(error => {
              // Clean up on error too
              this.regionLookupPromises.delete(regionCode);
              console.error(`Error looking up region ${regionCode}:`, error);
              return null;
            });

          // Store the promise while it's pending
          this.regionLookupPromises.set(regionCode, lookupPromise);

          return lookupPromise;
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

  getSourceName(): string {
    return this.SOURCE_NAME;
  }
}
