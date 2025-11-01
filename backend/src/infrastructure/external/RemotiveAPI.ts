import axios, { AxiosError } from 'axios';
import { techDetector } from './TechnologyDetector';

interface RemotiveSearchOptions {
  category?: string;
  limit?: number;
  search?: string;
  company_name?: string;
}

interface RemotiveJobResponse {
  id: number;
  title?: string;
  company_name?: string;
  description?: string;
  candidate_required_location?: string;
  salary?: string;
  url?: string;
  publication_date?: string;
}

/**
 * DTO for job data from Remotive API
 * This represents raw data before domain entity creation
 */
export interface RemotiveJobDTO {
  externalId: string;
  title: string;
  company: string;
  description: string;
  technologies: string[];
  location: string;
  salaryMinKEuros: number | null;
  salaryMaxKEuros: number | null;
  experienceLevel: string | null;
  sourceUrl: string;
  postedDate: Date;
}

export class RemotiveAPI {
  private baseUrl = 'https://remotive.com/api/remote-jobs';
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 1000;
  private readonly DEFAULT_LIMIT = 50;
  private readonly SOURCE_NAME = 'remotive';

  /**
   * Fetch remote jobs from Remotive API
   *
   * IMPORTANT: Remotive requests that this endpoint be called infrequently.
   * Recommended: Maximum 4 calls per day. Rapid polling may result in blocking.
   *
   * @param limitOrOptions - Either a number (legacy) or options object
   * @returns Array of RemotiveJobDTO (not domain entities)
   */
  async fetchJobs(limitOrOptions?: number | RemotiveSearchOptions): Promise<RemotiveJobDTO[]> {
    // Backwards compatibility: accept number or options object
    const options: RemotiveSearchOptions =
      typeof limitOrOptions === 'number'
        ? { limit: limitOrOptions }
        : { limit: this.DEFAULT_LIMIT, category: 'software-dev', ...limitOrOptions };

    return this.fetchWithRetry(options);
  }

  /**
   * Fetch jobs with retry logic for transient failures
   */
  private async fetchWithRetry(
    options: RemotiveSearchOptions,
    attempt: number = 1
  ): Promise<RemotiveJobDTO[]> {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          category: options.category || 'software-dev',
          limit: options.limit || this.DEFAULT_LIMIT,
          ...(options.search && { search: options.search }),
          ...(options.company_name && { company_name: options.company_name }),
        },
        headers: {
          Accept: 'application/json',
        },
        timeout: 15000,
        validateStatus: status => status >= 200 && status < 300,
      });

      const jobs: RemotiveJobResponse[] = response.data.jobs || [];
      return jobs
        .map(job => this.mapToDTO(job))
        .filter((dto): dto is RemotiveJobDTO => dto !== null);
    } catch (error) {
      return this.handleRequestError(error, options, attempt);
    }
  }

  /**
   * Handle request errors with retry logic for transient failures
   */
  private async handleRequestError(
    error: unknown,
    options: RemotiveSearchOptions,
    attempt: number
  ): Promise<RemotiveJobDTO[]> {
    const isAxiosError = axios.isAxiosError(error);
    const axiosError = error as AxiosError;

    // Determine if we should retry
    const shouldRetry =
      attempt < this.MAX_RETRY_ATTEMPTS &&
      isAxiosError &&
      (axiosError.code === 'ECONNABORTED' || // Timeout
        axiosError.code === 'ETIMEDOUT' ||
        axiosError.code === 'ECONNRESET' ||
        (axiosError.response?.status && axiosError.response.status >= 500)); // Server errors

    if (shouldRetry) {
      const backoffDelay = this.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(
        `Remotive API request failed (attempt ${attempt}/${this.MAX_RETRY_ATTEMPTS}), ` +
          `retrying in ${backoffDelay}ms...`,
        isAxiosError ? axiosError.message : error
      );

      await this.delay(backoffDelay);
      return this.fetchWithRetry(options, attempt + 1);
    }

    // Log the error with details (do not retry 4xx errors)
    if (isAxiosError) {
      if (axiosError.response) {
        const status = axiosError.response.status;
        if (status === 429) {
          console.error(
            'Remotive API rate limit exceeded. Please reduce request frequency. ' +
              'Remotive recommends maximum 4 requests per day.'
          );
        } else if (status >= 400 && status < 500) {
          console.error(`Remotive API client error (status ${status}):`, axiosError.response.data);
        } else {
          console.error(`Remotive API error (status ${status}):`, axiosError.response.data);
        }
      } else if (axiosError.request) {
        console.error('Remotive API error: No response received', axiosError.message);
      } else {
        console.error('Remotive API error:', axiosError.message);
      }
    } else {
      console.error('Remotive API unexpected error:', error);
    }

    return [];
  }

  /**
   * Safely map raw job data to DTO with error handling
   */
  private mapToDTO(rawJob: RemotiveJobResponse): RemotiveJobDTO | null {
    try {
      // Defensive validation
      if (!rawJob.id) {
        console.warn('Skipping job without ID:', rawJob);
        return null;
      }

      const title = rawJob.title || 'Remote Position';
      const company = rawJob.company_name || 'Company Not Specified';
      const description = rawJob.description || '';
      const fullText = `${title} ${description}`;

      // Detect technologies from job text
      const technologies = techDetector.detect(fullText);

      // Validate minimum technology requirement
      if (technologies.length === 0) {
        console.warn(`Skipping job ${rawJob.id}: No technologies detected`);
        return null;
      }

      // Extract salary (already in k€ or converted to k€)
      const { salaryMin, salaryMax } = this.extractSalary(rawJob.salary);

      // Handle potentially missing or invalid publication_date
      let postedDate: Date;
      try {
        postedDate = rawJob.publication_date ? new Date(rawJob.publication_date) : new Date();

        // Validate the date is valid and not in the future
        if (isNaN(postedDate.getTime()) || postedDate > new Date()) {
          postedDate = new Date();
        }
      } catch {
        postedDate = new Date();
      }

      return {
        externalId: `remotive-${rawJob.id}`,
        title,
        company,
        description,
        technologies,
        location: rawJob.candidate_required_location || 'Remote',
        salaryMinKEuros: salaryMin,
        salaryMaxKEuros: salaryMax,
        experienceLevel: null, // Will be detected by Job entity
        sourceUrl: rawJob.url || `https://remotive.com/remote-jobs/${rawJob.id}`,
        postedDate,
      };
    } catch (error) {
      console.error('Error mapping Remotive job:', error, rawJob);
      return null;
    }
  }

  /**
   * Extract salary range from various string formats
   *
   * Returns salary in thousands (k). Examples:
   * - "$40,000 - $50,000" → { salaryMin: 40, salaryMax: 50 }
   * - "$40k - $50k" → { salaryMin: 40, salaryMax: 50 }
   * - "45000 - 65000" → { salaryMin: 45, salaryMax: 65 }
   * - "€60k - €80k" → { salaryMin: 60, salaryMax: 80 }
   */
  private extractSalary(salaryString?: string): {
    salaryMin: number | null;
    salaryMax: number | null;
  } {
    if (!salaryString || typeof salaryString !== 'string') {
      return { salaryMin: null, salaryMax: null };
    }

    // Match patterns like "$40,000 - $50,000" or "$40k - $50k" or "45000 - 65000"
    // Also handles € symbol
    const rangePattern =
      /[$€]?\s*(\d+(?:,\d{3})*)(k)?\s*(?:[-–—]|to)\s*[$€]?\s*(\d+(?:,\d{3})*)(k)?/i;
    const match = salaryString.match(rangePattern);

    if (match) {
      try {
        const min = this.parseAmount(match[1], match[2]);
        const max = this.parseAmount(match[3], match[4]);

        // Basic validation
        if (min > max) {
          console.warn(`Invalid salary range: ${salaryString}`);
          return { salaryMin: null, salaryMax: null };
        }

        return { salaryMin: min, salaryMax: max };
      } catch (error) {
        console.warn(`Failed to parse salary range: ${salaryString}`, error);
        return { salaryMin: null, salaryMax: null };
      }
    }

    // Try to match single value like "$50,000" or "$50k"
    const singlePattern = /[$€]?\s*(\d+(?:,\d{3})*)(k)?/i;
    const singleMatch = salaryString.match(singlePattern);

    if (singleMatch) {
      try {
        const amount = this.parseAmount(singleMatch[1], singleMatch[2]);
        return { salaryMin: amount, salaryMax: amount };
      } catch (error) {
        console.warn(`Failed to parse single salary: ${salaryString}`, error);
        return { salaryMin: null, salaryMax: null };
      }
    }

    return { salaryMin: null, salaryMax: null };
  }

  /**
   * Parse salary amount and convert to k€
   */
  private parseAmount(numStr: string, hasK: string | undefined): number {
    // Remove commas and spaces
    const cleaned = numStr.replace(/[,\s]/g, '');
    const num = parseInt(cleaned, 10);

    if (isNaN(num) || num <= 0) {
      throw new Error('Invalid number in salary string');
    }

    // If it has 'k' suffix, it's already in thousands
    if (hasK) {
      return num;
    }

    // Otherwise, it's a full number like 40000, convert to thousands
    return Math.round(num / 1000);
  }

  /**
   * Utility method to delay execution
   */
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
