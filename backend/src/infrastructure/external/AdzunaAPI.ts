import axios, { AxiosError } from 'axios';
import { Job } from '../../domain/entities/Job';
import { techDetector } from './TechnologyDetector';

interface AdzunaSearchOptions {
  keywords?: string;
  maxPages?: number;
  resultsPerPage?: number;
  delayBetweenRequests?: number;
}

export class AdzunaAPI {
  private baseUrl = 'https://api.adzuna.com/v1/api/jobs/fr/search';
  private readonly MAX_RESULTS_PER_PAGE = 50;
  private readonly DEFAULT_DELAY_MS = 200; // Delay between paginated requests
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 1000;

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
    private regionRepository?: { findByCode(code: string): Promise<number | null> }
  ) {
    if (!appId || !appKey) {
      throw new Error('Adzuna API credentials (appId and appKey) are required');
    }
  }

  /**
   * Fetch jobs with optional pagination
   * @param options Search options including keywords, pagination settings
   * @returns Array of Job entities
   */
  async fetchJobs(options: AdzunaSearchOptions = {}): Promise<Job[]> {
    const {
      keywords = 'développeur',
      maxPages = 1,
      resultsPerPage = this.MAX_RESULTS_PER_PAGE,
      delayBetweenRequests = this.DEFAULT_DELAY_MS,
    } = options;

    // Validate results per page
    if (resultsPerPage > this.MAX_RESULTS_PER_PAGE) {
      console.warn(
        `results_per_page exceeds maximum (${this.MAX_RESULTS_PER_PAGE}), using maximum`
      );
    }

    const actualResultsPerPage = Math.min(resultsPerPage, this.MAX_RESULTS_PER_PAGE);
    const allJobs: Job[] = [];

    try {
      for (let page = 1; page <= maxPages; page++) {
        const pageJobs = await this.fetchPage(keywords, page, actualResultsPerPage);

        if (pageJobs.length === 0) {
          // No more results, stop pagination
          break;
        }

        allJobs.push(...pageJobs);

        // Add delay between requests to be polite to the API
        if (page < maxPages && pageJobs.length > 0) {
          await this.delay(delayBetweenRequests);
        }
      }

      return allJobs;
    } catch (error) {
      console.error('Adzuna API error:', error);
      return allJobs; // Return any jobs we managed to fetch
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
  ): Promise<Job[]> {
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

      // Explicit status check
      if (response.status !== 200) {
        throw new Error(`Unexpected status code: ${response.status}`);
      }

      const jobs = response.data.results || [];
      const mappedJobs = await Promise.all(jobs.map((job: any) => this.mapToJob(job)));

      return mappedJobs;
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
  ): Promise<Job[]> {
    const isAxiosError = axios.isAxiosError(error);
    const axiosError = error as AxiosError;

    // Determine if we should retry
    const shouldRetry =
      attempt < this.MAX_RETRY_ATTEMPTS &&
      isAxiosError &&
      (axiosError.code === 'ECONNABORTED' || // Timeout
        axiosError.code === 'ETIMEDOUT' ||
        (axiosError.response?.status && axiosError.response.status >= 500)); // Server errors

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

    // Log the error with details
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

  private async mapToJob(rawJob: any): Promise<Job> {
    // Defensive field access with fallbacks
    const title = rawJob.title || 'Sans titre';
    const description = rawJob.description || '';
    const fullText = `${title} ${description}`;

    const technologies = techDetector.detect(fullText);
    const isRemote = this.detectRemote(fullText, rawJob.location?.display_name);
    const regionId = await this.extractRegionId(rawJob.location?.display_name);
    const experienceLevel = this.detectExperienceLevel(fullText);

    return new Job(
      `adzuna-${rawJob.id}`,
      title,
      rawJob.company?.display_name || 'Non spécifié',
      description,
      technologies,
      rawJob.location?.display_name || 'France',
      regionId,
      isRemote,
      rawJob.salary_min ? Math.round(rawJob.salary_min / 1000) : null,
      rawJob.salary_max ? Math.round(rawJob.salary_max / 1000) : null,
      experienceLevel,
      'adzuna',
      rawJob.redirect_url || '',
      rawJob.created ? new Date(rawJob.created) : new Date(),
      true
    );
  }

  private detectRemote(text: string, location?: string): boolean {
    const lowerText = text.toLowerCase();
    const lowerLocation = location?.toLowerCase() || '';

    // Remote indicators - support both accented and non-accented characters
    const remoteKeywords = [
      /\bt[eé]l[eé]travail\b/i,
      /\bremote\b/i,
      /\bdistance\b/i,
      /\b100%?\s*remote\b/i,
      /\bfull\s*remote\b/i,
      /\btravail\s+[aà]\s+distance\b/i,
      /\ben\s+remote\b/i,
      /\btotalement\s+[aà]\s+distance\b/i,
      /\bhome\s*office\b/i,
    ];

    return remoteKeywords.some(pattern => pattern.test(lowerText) || pattern.test(lowerLocation));
  }

  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics/accents
      .trim();
  }

  private async extractRegionId(location?: string): Promise<number | null> {
    if (!location) return null;

    const normalizedLocation = this.normalizeString(location);

    // Try to find matching region code
    for (const [normalizedKey, regionCode] of this.regionCodeMapping) {
      if (normalizedLocation.includes(normalizedKey)) {
        // Check cache first
        if (this.regionIdCache.has(regionCode)) {
          return this.regionIdCache.get(regionCode)!;
        }

        // Look up from repository if available
        if (this.regionRepository) {
          const regionId = await this.regionRepository.findByCode(regionCode);
          if (regionId) {
            this.regionIdCache.set(regionCode, regionId);
            return regionId;
          }
        }

        // If no repository, return null
        return null;
      }
    }

    return null;
  }

  private detectExperienceLevel(text: string): string | null {
    const lowerText = text.toLowerCase();

    // Senior patterns (5+ years)
    const seniorPatterns = [
      /\bsenior\b/i,
      /\bconfirm[eé]\b/i,
      /\bexpert\b/i,
      /\b(?:plus\s+de\s+)?[5-9]\+?\s+ans?\b/i,
      /\b(?:plus\s+de\s+)?1[0-9]\+?\s+ans?\b/i,
      /\b[5-9]\s+ans?\s+d['']exp[eé]rience\b/i,
      /\b1[0-9]\s+ans?\s+d['']exp[eé]rience\b/i,
      /\blead\b/i,
      /\barchitecte\b/i,
      /\bprincipal\b/i,
      /\bstaff\b/i,
      /\bexp[eé]riment[eé]\b/i,
    ];

    // Junior patterns (0-2 years)
    const juniorPatterns = [
      /\bjunior\b/i,
      /\bd[eé]butant\b/i,
      /\bentr[eé]e\s+de\s+carri[eè]re\b/i,
      /\b0[-\s]?[aà][-\s]?2\s+ans?\b/i,
      /\bpremi[eè]re\s+exp[eé]rience\b/i,
      /\bjeune\s+dipl[oô]m[eé]\b/i,
      /\bstage\b/i,
      /\balternance\b/i,
      /\b[0-2]\s+ans?\s+d['']exp[eé]rience\b/i,
    ];

    // Mid-level patterns (3-4 years)
    const midPatterns = [
      /\b[3-4]\s+ans?\s+d['']exp[eé]rience\b/i,
      /\b[3-4]\s+ans?\b/i,
      /\b[2-4][-\s]?[aà][-\s]?5\s+ans?\b/i,
      /\binterm[eé]diaire\b/i,
      /\bmid[-\s]?level\b/i,
    ];

    if (seniorPatterns.some(p => p.test(lowerText))) {
      return 'senior';
    }

    if (juniorPatterns.some(p => p.test(lowerText))) {
      return 'junior';
    }

    if (midPatterns.some(p => p.test(lowerText))) {
      return 'mid';
    }

    return null;
  }

  /**
   * Utility method to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
