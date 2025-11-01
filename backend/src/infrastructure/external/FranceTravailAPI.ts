import axios, { AxiosError } from 'axios';
import { techDetector } from './TechnologyDetector';

interface FranceTravailSearchParams {
  motsCles?: string;
  commune?: string;
  departement?: string;
  codeROME?: string;
  typeContrat?: string;
  nature?: string;
  experience?: string;
  tempsPlein?: boolean;
  range?: string;
  maxResults?: number;
}

interface FranceTravailJobResponse {
  id: string;
  intitule?: string;
  entreprise?: { nom?: string };
  description?: string;
  lieuTravail?: {
    libelle?: string;
    codePostal?: string;
  };
  salaire?: {
    libelle?: string;
  };
  experienceLibelle?: string;
  dateCreation?: string;
  origineOffre?: {
    urlOrigine?: string;
  };
}

/**
 * DTO for job data from France Travail API
 * This represents raw data before domain entity creation
 */
export interface FranceTravailJobDTO {
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

interface FranceTravailConfig {
  maxRetryAttempts?: number;
  retryDelayMs?: number;
  requestDelayMs?: number;
  defaultMaxResults?: number;
  enableCircuitBreaker?: boolean;
  circuitBreakerThreshold?: number;
  circuitBreakerResetTimeMs?: number;
}

/**
 * Optional region repository interface for region lookups
 */
interface RegionRepository {
  findByCode(code: string): Promise<number | null>;
}

export class FranceTravailAPI {
  private tokenUrl =
    'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire';
  private apiUrl = 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search';
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private readonly SOURCE_NAME = 'france_travail';

  private readonly MAX_RESULTS_PER_REQUEST = 150;
  private readonly MAX_RETRY_ATTEMPTS: number;
  private readonly RETRY_DELAY_MS: number;
  private readonly REQUEST_DELAY_MS: number;
  private readonly DEFAULT_MAX_RESULTS: number;

  // Circuit breaker state
  private readonly ENABLE_CIRCUIT_BREAKER: boolean;
  private readonly CIRCUIT_BREAKER_THRESHOLD: number;
  private readonly CIRCUIT_BREAKER_RESET_TIME_MS: number;
  private circuitBreakerFailures: number = 0;
  private circuitBreakerOpenUntil: number = 0;

  // Region mapping: department/postal code prefix -> region code
  private regionCodeMapping: Map<string, string> = new Map([
    // Île-de-France
    ['75', 'IDF'],
    ['paris', 'IDF'],
    ['77', 'IDF'],
    ['78', 'IDF'],
    ['91', 'IDF'],
    ['92', 'IDF'],
    ['93', 'IDF'],
    ['94', 'IDF'],
    ['95', 'IDF'],
    ['ile-de-france', 'IDF'],
    // Auvergne-Rhône-Alpes
    ['01', 'ARA'],
    ['03', 'ARA'],
    ['07', 'ARA'],
    ['15', 'ARA'],
    ['26', 'ARA'],
    ['38', 'ARA'],
    ['42', 'ARA'],
    ['43', 'ARA'],
    ['63', 'ARA'],
    ['69', 'ARA'],
    ['73', 'ARA'],
    ['74', 'ARA'],
    ['lyon', 'ARA'],
    ['grenoble', 'ARA'],
    ['auvergne-rhone-alpes', 'ARA'],
    // Provence-Alpes-Côte d'Azur
    ['04', 'PAC'],
    ['05', 'PAC'],
    ['06', 'PAC'],
    ['13', 'PAC'],
    ['83', 'PAC'],
    ['84', 'PAC'],
    ['marseille', 'PAC'],
    ['nice', 'PAC'],
    ["provence-alpes-cote d'azur", 'PAC'],
    // Occitanie
    ['09', 'OCC'],
    ['11', 'OCC'],
    ['12', 'OCC'],
    ['30', 'OCC'],
    ['31', 'OCC'],
    ['32', 'OCC'],
    ['34', 'OCC'],
    ['46', 'OCC'],
    ['48', 'OCC'],
    ['65', 'OCC'],
    ['66', 'OCC'],
    ['81', 'OCC'],
    ['82', 'OCC'],
    ['toulouse', 'OCC'],
    ['montpellier', 'OCC'],
    ['occitanie', 'OCC'],
    // Nouvelle-Aquitaine
    ['16', 'NAQ'],
    ['17', 'NAQ'],
    ['19', 'NAQ'],
    ['23', 'NAQ'],
    ['24', 'NAQ'],
    ['33', 'NAQ'],
    ['40', 'NAQ'],
    ['47', 'NAQ'],
    ['64', 'NAQ'],
    ['79', 'NAQ'],
    ['86', 'NAQ'],
    ['87', 'NAQ'],
    ['bordeaux', 'NAQ'],
    ['nouvelle-aquitaine', 'NAQ'],
    // Hauts-de-France
    ['02', 'HDF'],
    ['59', 'HDF'],
    ['60', 'HDF'],
    ['62', 'HDF'],
    ['80', 'HDF'],
    ['lille', 'HDF'],
    ['hauts-de-france', 'HDF'],
    // Grand Est
    ['08', 'GES'],
    ['10', 'GES'],
    ['51', 'GES'],
    ['52', 'GES'],
    ['54', 'GES'],
    ['55', 'GES'],
    ['57', 'GES'],
    ['67', 'GES'],
    ['68', 'GES'],
    ['88', 'GES'],
    ['strasbourg', 'GES'],
    ['reims', 'GES'],
    ['grand est', 'GES'],
    // Bretagne
    ['22', 'BRE'],
    ['29', 'BRE'],
    ['35', 'BRE'],
    ['56', 'BRE'],
    ['rennes', 'BRE'],
    ['brest', 'BRE'],
    ['bretagne', 'BRE'],
    // Pays de la Loire
    ['44', 'PDL'],
    ['49', 'PDL'],
    ['53', 'PDL'],
    ['72', 'PDL'],
    ['85', 'PDL'],
    ['nantes', 'PDL'],
    ['pays de la loire', 'PDL'],
    // Normandie
    ['14', 'NOR'],
    ['27', 'NOR'],
    ['50', 'NOR'],
    ['61', 'NOR'],
    ['76', 'NOR'],
    ['normandie', 'NOR'],
    // Bourgogne-Franche-Comté
    ['21', 'BFC'],
    ['25', 'BFC'],
    ['39', 'BFC'],
    ['58', 'BFC'],
    ['70', 'BFC'],
    ['71', 'BFC'],
    ['89', 'BFC'],
    ['90', 'BFC'],
    ['bourgogne-franche-comte', 'BFC'],
    // Centre-Val de Loire
    ['18', 'CVL'],
    ['28', 'CVL'],
    ['36', 'CVL'],
    ['37', 'CVL'],
    ['41', 'CVL'],
    ['45', 'CVL'],
    ['centre-val de loire', 'CVL'],
    // Corse
    ['2a', 'COR'],
    ['2b', 'COR'],
    ['corse', 'COR'],
    // Overseas departments
    ['971', 'GLP'],
    ['972', 'MTQ'],
    ['973', 'GUF'],
    ['974', 'REU'],
    ['976', 'MYT'],
  ]);

  private regionIdCache: Map<string, number> = new Map();

  constructor(
    private clientId: string,
    private clientSecret: string,
    private regionRepository?: RegionRepository,
    config?: FranceTravailConfig
  ) {
    if (!clientId || !clientSecret) {
      throw new Error('France Travail API credentials (clientId and clientSecret) are required');
    }

    this.MAX_RETRY_ATTEMPTS = config?.maxRetryAttempts ?? 3;
    this.RETRY_DELAY_MS = config?.retryDelayMs ?? 1000;
    this.REQUEST_DELAY_MS = config?.requestDelayMs ?? 150;
    this.DEFAULT_MAX_RESULTS = config?.defaultMaxResults ?? 150;

    this.ENABLE_CIRCUIT_BREAKER = config?.enableCircuitBreaker ?? true;
    this.CIRCUIT_BREAKER_THRESHOLD = config?.circuitBreakerThreshold ?? 5;
    this.CIRCUIT_BREAKER_RESET_TIME_MS = config?.circuitBreakerResetTimeMs ?? 60000;
  }

  /**
   * Fetch jobs with automatic pagination support
   * Returns DTOs, not domain entities
   */
  async fetchJobs(params: FranceTravailSearchParams = {}): Promise<FranceTravailJobDTO[]> {
    if (this.isCircuitBreakerOpen()) {
      console.warn('Circuit breaker is open - refusing request to prevent cascading failures');
      return [];
    }

    if (params.range) {
      return this.fetchRange(params, params.range);
    }

    const maxResults = params.maxResults || this.DEFAULT_MAX_RESULTS;
    const allJobs: FranceTravailJobDTO[] = [];

    try {
      await this.ensureToken();

      const numRequests = Math.ceil(maxResults / this.MAX_RESULTS_PER_REQUEST);

      for (let i = 0; i < numRequests; i++) {
        const start = i * this.MAX_RESULTS_PER_REQUEST;
        const end = Math.min(start + this.MAX_RESULTS_PER_REQUEST - 1, maxResults - 1);
        const range = `${start}-${end}`;

        const jobs = await this.fetchRange(params, range);

        if (jobs.length === 0) {
          break;
        }

        allJobs.push(...jobs);

        if (i < numRequests - 1 && jobs.length > 0) {
          await this.delay(this.REQUEST_DELAY_MS);
        }
      }

      this.recordSuccess();

      return allJobs;
    } catch (error) {
      console.error('France Travail API error:', error);
      return allJobs;
    }
  }

  /**
   * Fetch a single range of results with retry logic
   */
  private async fetchRange(
    params: FranceTravailSearchParams,
    range: string,
    attempt: number = 1
  ): Promise<FranceTravailJobDTO[]> {
    try {
      const searchParams: Record<string, any> = {
        motsCles: params.motsCles || 'développeur',
        range: range,
      };

      if (params.commune) searchParams.commune = params.commune;
      if (params.departement) searchParams.departement = params.departement;
      if (params.codeROME) searchParams.codeROME = params.codeROME;
      if (params.typeContrat) searchParams.typeContrat = params.typeContrat;
      if (params.nature) searchParams.nature = params.nature;
      if (params.experience) searchParams.experience = params.experience;
      if (params.tempsPlein !== undefined) searchParams.tempsPlein = params.tempsPlein;

      const response = await axios.get(this.apiUrl, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
        },
        params: searchParams,
        timeout: 15000,
      });

      const jobs: FranceTravailJobResponse[] = response.data.resultats || [];
      const mappedJobs = await Promise.all(jobs.map(job => this.mapToDTO(job)));

      return mappedJobs.filter((dto): dto is FranceTravailJobDTO => dto !== null);
    } catch (error) {
      return this.handleRequestError(error, params, range, attempt);
    }
  }

  /**
   * Handle request errors with retry logic
   */
  private async handleRequestError(
    error: unknown,
    params: FranceTravailSearchParams,
    range: string,
    attempt: number
  ): Promise<FranceTravailJobDTO[]> {
    const isAxiosError = axios.isAxiosError(error);
    const axiosError = error as AxiosError;

    if (isAxiosError && axiosError.response) {
      const status = axiosError.response.status;

      if (status === 401 || status === 403) {
        console.error(
          'France Travail API authentication error. Check credentials or token expired.',
          axiosError.response.data
        );
        this.token = null;
        this.tokenExpiry = 0;

        if (attempt < this.MAX_RETRY_ATTEMPTS) {
          try {
            await this.ensureToken();
            return this.fetchRange(params, range, attempt + 1);
          } catch (refreshError) {
            console.error('Token refresh failed during retry:', refreshError);
            this.recordFailure();
            return [];
          }
        } else {
          this.recordFailure();
          return [];
        }
      }

      if (status === 429 && axiosError.response.headers) {
        const retryAfter = this.extractRetryAfter(axiosError.response.headers);
        if (retryAfter && attempt < this.MAX_RETRY_ATTEMPTS) {
          console.warn(
            `France Travail API rate limited - retrying after ${retryAfter}ms (attempt ${attempt}/${this.MAX_RETRY_ATTEMPTS})`
          );
          await this.delay(retryAfter);
          return this.fetchRange(params, range, attempt + 1);
        }
      }
    }

    const shouldRetry =
      attempt < this.MAX_RETRY_ATTEMPTS &&
      isAxiosError &&
      (axiosError.code === 'ECONNABORTED' ||
        axiosError.code === 'ETIMEDOUT' ||
        axiosError.code === 'ECONNRESET' ||
        (axiosError.response?.status && axiosError.response.status >= 500) ||
        axiosError.response?.status === 429);

    if (shouldRetry) {
      const isRateLimit = axiosError.response?.status === 429;
      const baseDelay = isRateLimit ? 5000 : this.RETRY_DELAY_MS;
      const backoffDelay = baseDelay * Math.pow(2, attempt - 1);

      console.warn(
        `France Travail API request failed (attempt ${attempt}/${this.MAX_RETRY_ATTEMPTS})${
          isRateLimit ? ' - rate limit' : ''
        }, retrying in ${backoffDelay}ms...`,
        isAxiosError ? axiosError.message : error
      );

      await this.delay(backoffDelay);
      return this.fetchRange(params, range, attempt + 1);
    }

    if (isAxiosError) {
      if (axiosError.response) {
        const status = axiosError.response.status;
        if (status === 429) {
          console.error(
            'France Travail API rate limit exceeded after retries. ' +
              'API allows ~10 requests/second. Consider reducing request frequency.'
          );
        } else if (status >= 400 && status < 500) {
          console.error(
            `France Travail API client error (status ${status}):`,
            axiosError.response.data
          );
        } else {
          console.error(`France Travail API error (status ${status}):`, axiosError.response.data);
        }
      } else if (axiosError.request) {
        console.error('France Travail API error: No response received', axiosError.message);
      } else {
        console.error('France Travail API error:', axiosError.message);
      }
    } else {
      console.error('France Travail API unexpected error:', error);
    }

    this.recordFailure();
    return [];
  }

  /**
   * Extract Retry-After header value (in milliseconds)
   */
  private extractRetryAfter(headers: any): number | null {
    if (!headers) return null;

    const retryAfter = headers['retry-after'] || headers['Retry-After'];
    if (!retryAfter) return null;

    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    try {
      const date = new Date(retryAfter);
      const delay = date.getTime() - Date.now();
      return delay > 0 ? delay : null;
    } catch {
      return null;
    }
  }

  /**
   * Ensure we have a valid token
   */
  private async ensureToken(): Promise<void> {
    if (this.token && Date.now() < this.tokenExpiry) {
      return;
    }

    try {
      const response = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'api_offresdemploiv2 o2dsoffre',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          timeout: 15000,
        }
      );

      if (!response.data?.access_token) {
        throw new Error('Invalid token response: missing access_token');
      }

      this.token = response.data.access_token;

      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiry = Date.now() + expiresIn * 1000 - 10000;
    } catch (error) {
      const axiosError = error as AxiosError;

      if (axios.isAxiosError(error)) {
        if (axiosError.response) {
          console.error(
            `Failed to obtain France Travail token (status ${axiosError.response.status}):`,
            axiosError.response.data
          );
        } else {
          console.error('Failed to obtain France Travail token:', axiosError.message);
        }
      } else {
        console.error('Failed to obtain France Travail token:', error);
      }

      throw new Error('Token authentication failed');
    }
  }

  /**
   * Map raw API response to DTO with error handling
   */
  private async mapToDTO(rawJob: FranceTravailJobResponse): Promise<FranceTravailJobDTO | null> {
    try {
      if (!rawJob.id) {
        console.warn('Skipping job without ID:', rawJob);
        return null;
      }

      const title = rawJob.intitule || 'Poste non spécifié';
      const company = rawJob.entreprise?.nom || 'Non spécifié';
      const description = rawJob.description || '';
      const fullText = `${title} ${description}`;

      // Detect technologies
      const technologies = techDetector.detect(fullText);

      // Validate minimum technology requirement
      if (technologies.length === 0) {
        console.warn(`Skipping job ${rawJob.id}: No technologies detected`);
        return null;
      }

      // Extract region ID
      const regionId = await this.extractRegionId(rawJob.lieuTravail);

      // Extract salary in full euros, then convert to k€
      const salaryMinEuros = this.extractSalary(rawJob.salaire?.libelle, 'min');
      const salaryMaxEuros = this.extractSalary(rawJob.salaire?.libelle, 'max');
      const salaryMinKEuros = salaryMinEuros ? Math.round(salaryMinEuros / 1000) : null;
      const salaryMaxKEuros = salaryMaxEuros ? Math.round(salaryMaxEuros / 1000) : null;

      // Handle date
      let postedDate: Date;
      try {
        postedDate = rawJob.dateCreation ? new Date(rawJob.dateCreation) : new Date();
        if (isNaN(postedDate.getTime()) || postedDate > new Date()) {
          postedDate = new Date();
        }
      } catch {
        postedDate = new Date();
      }

      return {
        externalId: `francetravail-${rawJob.id}`,
        title,
        company,
        description,
        technologies,
        location: rawJob.lieuTravail?.libelle || 'France',
        regionId,
        salaryMinKEuros,
        salaryMaxKEuros,
        experienceLevel: null, // Domain layer responsibility
        sourceUrl:
          rawJob.origineOffre?.urlOrigine ||
          `https://candidat.francetravail.fr/offres/recherche/detail/${rawJob.id}`,
        postedDate,
      };
    } catch (error) {
      console.error('Error mapping France Travail job:', error, rawJob);
      return null;
    }
  }

  /**
   * Extract region ID from postal code or location name
   */
  private async extractRegionId(lieuTravail?: {
    libelle?: string;
    codePostal?: string;
  }): Promise<number | null> {
    if (!lieuTravail) return null;

    const codePostal = lieuTravail.codePostal?.replace(/\s/g, '');
    const libelle = lieuTravail.libelle;

    if (codePostal && codePostal.length >= 2) {
      let dept: string;

      if (codePostal.startsWith('97') || codePostal.startsWith('98')) {
        dept = codePostal.substring(0, 3).toLowerCase();
      } else {
        dept = codePostal.substring(0, 2).toLowerCase();
      }

      const regionCode = this.regionCodeMapping.get(dept);

      if (regionCode) {
        return this.getRegionIdFromCode(regionCode);
      }
    }

    if (libelle) {
      const normalizedLocation = this.normalizeString(libelle);

      for (const [key, regionCode] of this.regionCodeMapping) {
        if (normalizedLocation.includes(key)) {
          return this.getRegionIdFromCode(regionCode);
        }
      }
    }

    return null;
  }

  private async getRegionIdFromCode(regionCode: string): Promise<number | null> {
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

  /**
   * Extract salary from string - returns value in FULL EUROS
   * (Converted to k€ in mapToDTO)
   */
  private extractSalary(salaryString?: string, type: 'min' | 'max' = 'min'): number | null {
    if (!salaryString || typeof salaryString !== 'string') return null;

    // Pattern for ranges: "30000 à 40000 Euros"
    const yearlyPattern = /(\d+(?:\s?\d{3})*)\s*(?:à|a|[-–—])\s*(\d+(?:\s?\d{3})*)\s*(?:euros?|€)/i;
    const match = salaryString.match(yearlyPattern);

    if (match) {
      try {
        const min = parseInt(match[1].replace(/\s/g, ''), 10);
        const max = parseInt(match[2].replace(/\s/g, ''), 10);

        if (isNaN(min) || isNaN(max)) {
          return null;
        }

        return type === 'min' ? min : max;
      } catch {
        return null;
      }
    }

    // Try single value: "50 000 €"
    const singlePattern = /(\d+(?:\s?\d{3})*)\s*(?:euros?|€)/i;
    const singleMatch = salaryString.match(singlePattern);

    if (singleMatch) {
      try {
        const amount = parseInt(singleMatch[1].replace(/\s/g, ''), 10);

        if (isNaN(amount)) {
          return null;
        }

        return amount;
      } catch {
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

  // ========== Circuit Breaker ==========

  private isCircuitBreakerOpen(): boolean {
    if (!this.ENABLE_CIRCUIT_BREAKER) return false;

    if (Date.now() < this.circuitBreakerOpenUntil) {
      return true;
    }

    if (this.circuitBreakerOpenUntil > 0 && Date.now() >= this.circuitBreakerOpenUntil) {
      this.circuitBreakerFailures = 0;
      this.circuitBreakerOpenUntil = 0;
    }

    return false;
  }

  private recordFailure(): void {
    if (!this.ENABLE_CIRCUIT_BREAKER) return;

    this.circuitBreakerFailures++;

    if (this.circuitBreakerFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreakerOpenUntil = Date.now() + this.CIRCUIT_BREAKER_RESET_TIME_MS;
      console.error(
        `Circuit breaker opened after ${this.circuitBreakerFailures} failures. ` +
          `Will reset in ${this.CIRCUIT_BREAKER_RESET_TIME_MS / 1000}s`
      );
    }
  }

  private recordSuccess(): void {
    if (!this.ENABLE_CIRCUIT_BREAKER) return;

    if (this.circuitBreakerFailures > 0) {
      this.circuitBreakerFailures = 0;
    }
  }
}
