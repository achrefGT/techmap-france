import axios, { AxiosError } from 'axios';
import { Job } from '../../domain/entities/Job';
import { techDetector } from './TechnologyDetector';

interface FranceTravailSearchParams {
  motsCles?: string;
  commune?: string;
  departement?: string;
  codeROME?: string;
  typeContrat?: string; // CDI, CDD, MIS, etc.
  nature?: string; // Offre d'emploi, Alternance
  experience?: string; // 1 = Débutant accepté, 2 = Expérience exigée, 3 = Expérience souhaitée
  tempsPlein?: boolean;
  range?: string; // Format: "0-99" (max 150 per request)
  maxResults?: number; // Total max results to fetch across pages
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

export class FranceTravailAPI {
  private tokenUrl =
    'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire';
  private apiUrl = 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search';
  private token: string | null = null;
  private tokenExpiry: number = 0;

  private readonly MAX_RESULTS_PER_REQUEST = 150;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 1000;
  private readonly REQUEST_DELAY_MS = 100; // Delay between requests (10/sec max)
  private readonly DEFAULT_MAX_RESULTS = 150;

  // Region mapping: normalized department/region name -> region code
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
    // Overseas departments (DOM-TOM) - 3 digit codes
    ['971', 'GLP'], // Guadeloupe
    ['972', 'MTQ'], // Martinique
    ['973', 'GUF'], // Guyane
    ['974', 'REU'], // Réunion
    ['976', 'MYT'], // Mayotte
  ]);

  private regionIdCache: Map<string, number> = new Map();

  constructor(
    private clientId: string,
    private clientSecret: string,
    private regionRepository?: { findByCode(code: string): Promise<number | null> }
  ) {
    if (!clientId || !clientSecret) {
      throw new Error('France Travail API credentials (clientId and clientSecret) are required');
    }
  }

  /**
   * Fetch jobs with automatic pagination support
   *
   * IMPORTANT: France Travail API has rate limits (~10 calls/second).
   * This implementation respects rate limits with automatic delays.
   */
  async fetchJobs(params: FranceTravailSearchParams = {}): Promise<Job[]> {
    const maxResults = params.maxResults || this.DEFAULT_MAX_RESULTS;
    const allJobs: Job[] = [];

    try {
      await this.ensureToken();

      // Calculate how many requests we need
      const numRequests = Math.ceil(maxResults / this.MAX_RESULTS_PER_REQUEST);

      for (let i = 0; i < numRequests; i++) {
        const start = i * this.MAX_RESULTS_PER_REQUEST;
        const end = Math.min(start + this.MAX_RESULTS_PER_REQUEST - 1, maxResults - 1);

        const jobs = await this.fetchRange(params, `${start}-${end}`);

        if (jobs.length === 0) {
          // No more results available
          break;
        }

        allJobs.push(...jobs);

        // Add delay between requests to respect rate limits (except on last request)
        if (i < numRequests - 1 && jobs.length > 0) {
          await this.delay(this.REQUEST_DELAY_MS);
        }
      }

      return allJobs;
    } catch (error) {
      console.error('France Travail API error:', error);
      return allJobs; // Return any jobs we managed to fetch
    }
  }

  /**
   * Fetch a single range of results with retry logic
   */
  private async fetchRange(
    params: FranceTravailSearchParams,
    range: string,
    attempt: number = 1
  ): Promise<Job[]> {
    try {
      const searchParams: Record<string, any> = {
        motsCles: params.motsCles || 'développeur',
        range: params.range || range,
      };

      // Add optional filters
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
      const mappedJobs = await Promise.all(jobs.map(job => this.mapToJobSafely(job)));

      return mappedJobs.filter((job): job is Job => job !== null);
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
  ): Promise<Job[]> {
    const isAxiosError = axios.isAxiosError(error);
    const axiosError = error as AxiosError;

    // Determine if we should retry
    const shouldRetry =
      attempt < this.MAX_RETRY_ATTEMPTS &&
      isAxiosError &&
      (axiosError.code === 'ECONNABORTED' ||
        axiosError.code === 'ETIMEDOUT' ||
        axiosError.code === 'ECONNRESET' ||
        (axiosError.response?.status && axiosError.response.status >= 500) ||
        axiosError.response?.status === 429); // Rate limit - retry with backoff

    if (shouldRetry) {
      // Exponential backoff, but extra delay for 429
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

    // Log the error with details
    if (isAxiosError) {
      if (axiosError.response) {
        const status = axiosError.response.status;
        if (status === 429) {
          console.error(
            'France Travail API rate limit exceeded after retries. ' +
              'API allows ~10 requests/second. Consider reducing request frequency.'
          );
        } else if (status === 401 || status === 403) {
          console.error(
            'France Travail API authentication error. Check credentials or token expired.',
            axiosError.response.data
          );
          // Clear token to force refresh on next call
          this.token = null;
          this.tokenExpiry = 0;
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

    return [];
  }

  /**
   * Ensure we have a valid token, with robust error handling
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

      // Validate response - check data first since that's what matters
      if (!response.data?.access_token) {
        throw new Error('Invalid token response: missing access_token');
      }

      this.token = response.data.access_token;

      // Set expiry 10 seconds before actual expiry for safety margin
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
   * Safely map raw job data with error handling
   */
  private async mapToJobSafely(rawJob: FranceTravailJobResponse): Promise<Job | null> {
    try {
      return await this.mapToJob(rawJob);
    } catch (error) {
      console.error('Error mapping France Travail job:', error, rawJob);
      return null;
    }
  }

  /**
   * Map raw API response to Job entity
   */
  private async mapToJob(rawJob: FranceTravailJobResponse): Promise<Job> {
    if (!rawJob.id) {
      throw new Error('Job ID is required');
    }

    const title = rawJob.intitule || 'Poste non spécifié';
    const description = rawJob.description || '';
    const fullText = `${title} ${description}`;

    const technologies = techDetector.detect(fullText);
    const isRemote = this.detectRemote(rawJob);
    const regionId = await this.extractRegionId(rawJob.lieuTravail);
    const experienceLevel = this.mapExperienceLevel(rawJob.experienceLibelle, fullText);

    // Extract salary in full euros (not thousands)
    const salaryMin = this.extractSalary(rawJob.salaire?.libelle, 'min');
    const salaryMax = this.extractSalary(rawJob.salaire?.libelle, 'max');

    // Handle potentially invalid date
    let postedDate: Date;
    try {
      postedDate = rawJob.dateCreation ? new Date(rawJob.dateCreation) : new Date();

      if (isNaN(postedDate.getTime())) {
        postedDate = new Date();
      }
    } catch {
      postedDate = new Date();
    }

    return new Job(
      `francetravail-${rawJob.id}`,
      title,
      rawJob.entreprise?.nom || 'Non spécifié',
      description,
      technologies,
      rawJob.lieuTravail?.libelle || 'France',
      regionId,
      isRemote,
      salaryMin,
      salaryMax,
      experienceLevel,
      'francetravail',
      rawJob.origineOffre?.urlOrigine ||
        `https://candidat.francetravail.fr/offres/recherche/detail/${rawJob.id}`,
      postedDate,
      true
    );
  }

  private detectRemote(rawJob: FranceTravailJobResponse): boolean {
    const lieuTravail = rawJob.lieuTravail?.libelle?.toLowerCase() || '';

    // Remote indicators in location
    const remoteLocationKeywords = [
      /\bt[eé]l[eé]travail\b/i,
      /\bt[eé]l[eé]-travail\b/i,
      /\bremote\b/i,
      /\bdistance\b/i,
      /\b100%?\s*t[eé]l[eé]travail\b/i,
    ];

    if (remoteLocationKeywords.some(pattern => pattern.test(lieuTravail))) {
      return true;
    }

    // Check description for remote indicators
    const description = `${rawJob.intitule || ''} ${rawJob.description || ''}`.toLowerCase();
    const remoteDescriptionKeywords = [
      /\bt[eé]l[eé]travail\s+(?:complet|total|int[eé]gral)\b/i,
      /\b100%\s*t[eé]l[eé]travail\b/i,
      /\bfull\s*remote\b/i,
      /\btotalement\s+[aà]\s+distance\b/i,
      /\bposte\s+en\s+t[eé]l[eé]travail\b/i,
    ];

    return remoteDescriptionKeywords.some(pattern => pattern.test(description));
  }

  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * Extract region ID from postal code or location name
   * Handles both metropolitan and overseas departments
   */
  private async extractRegionId(lieuTravail?: {
    libelle?: string;
    codePostal?: string;
  }): Promise<number | null> {
    if (!lieuTravail) return null;

    const codePostal = lieuTravail.codePostal;
    const libelle = lieuTravail.libelle;

    // Try department code from postal code first
    if (codePostal && codePostal.length >= 2) {
      let dept: string;

      // Handle overseas departments (3-digit codes starting with 97 or 98)
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

    // Try from location name
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

    return null;
  }

  private mapExperienceLevel(experienceLibelle?: string, fullText?: string): string | null {
    if (!experienceLibelle && !fullText) return null;

    const lowerExp = experienceLibelle?.toLowerCase() || '';
    const lowerText = fullText?.toLowerCase() || '';
    const combined = `${lowerExp} ${lowerText}`;

    // Senior patterns (5+ years)
    const seniorPatterns = [
      /\b5\s+ans?\s+et\s+plus\b/i,
      /\bsenior\b/i,
      /\bconfirme\b/i,
      /\bexpert\b/i,
      /\b(?:plus\s+de\s+)?[5-9]\+?\s+ans?\b/i,
      /\b(?:plus\s+de\s+)?1[0-9]\+?\s+ans?\b/i,
      /\blead\b/i,
      /\barchitecte\b/i,
      /\bexperimente\b/i,
    ];

    // Junior patterns (0-2 years)
    const juniorPatterns = [
      /\bdebutant\s+accepte\b/i,
      /\b[0-2]\s+ans?\b/i,
      /\bjunior\b/i,
      /\bdebutant\b/i,
      /\bentree\s+de\s+carriere\b/i,
      /\bpremiere\s+experience\b/i,
      /\bjeune\s+diplome\b/i,
    ];

    // Mid-level patterns (3-4 years)
    const midPatterns = [/\b[3-4]\s+ans?\b/i, /\bintermediaire\b/i, /\bmid[-\s]?level\b/i];

    if (seniorPatterns.some(p => p.test(combined))) {
      return 'senior';
    }

    if (juniorPatterns.some(p => p.test(combined))) {
      return 'junior';
    }

    if (midPatterns.some(p => p.test(combined))) {
      return 'mid';
    }

    return null;
  }

  /**
   * Extract salary from string - returns value in thousands (k)
   *
   * Examples:
   * - "30000 à 40000 Euros par an" → min: 30, max: 40
   * - "50 000 € par an" → min: 50, max: 50
   */
  private extractSalary(salaryString?: string, type: 'min' | 'max' = 'min'): number | null {
    if (!salaryString || typeof salaryString !== 'string') return null;

    // Pattern for ranges: "30000 à 40000 Euros"
    // Use strict separator matching with word boundaries
    const yearlyPattern = /(\d+(?:\s?\d{3})*)\s*(?:à|a|[-–—])\s*(\d+(?:\s?\d{3})*)\s*(?:euros?|€)/i;
    const match = salaryString.match(yearlyPattern);

    if (match) {
      try {
        const min = parseInt(match[1].replace(/\s/g, ''), 10);
        const max = parseInt(match[2].replace(/\s/g, ''), 10);

        if (isNaN(min) || isNaN(max)) {
          return null;
        }

        // Return in thousands
        return type === 'min' ? Math.round(min / 1000) : Math.round(max / 1000);
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

        return Math.round(amount / 1000);
      } catch {
        return null;
      }
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
