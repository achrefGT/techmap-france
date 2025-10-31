import axios, { AxiosError } from 'axios';
import { Job } from '../../domain/entities/Job';
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

export class RemotiveAPI {
  private baseUrl = 'https://remotive.com/api/remote-jobs';
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 1000;
  private readonly DEFAULT_LIMIT = 50;

  /**
   * Fetch remote jobs from Remotive API
   *
   * IMPORTANT: Remotive requests that this endpoint be called infrequently.
   * Recommended: Maximum 4 calls per day. Rapid polling may result in blocking.
   *
   * @param limitOrOptions - Either a number (legacy) or options object
   * @returns Array of Job entities
   */
  async fetchJobs(limitOrOptions?: number | RemotiveSearchOptions): Promise<Job[]> {
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
  ): Promise<Job[]> {
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
      return jobs.map(job => this.mapToJobSafely(job)).filter((job): job is Job => job !== null);
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
  ): Promise<Job[]> {
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
   * Safely map raw job data to Job entity with error handling
   */
  private mapToJobSafely(rawJob: RemotiveJobResponse): Job | null {
    try {
      return this.mapToJob(rawJob);
    } catch (error) {
      console.error('Error mapping Remotive job:', error, rawJob);
      return null;
    }
  }

  /**
   * Map raw Remotive API response to Job entity
   */
  private mapToJob(rawJob: RemotiveJobResponse): Job {
    // Defensive validation
    if (!rawJob.id) {
      throw new Error('Job ID is required');
    }

    const title = rawJob.title || 'Remote Position';
    const description = rawJob.description || '';
    const fullText = `${title} ${description}`;

    const technologies = techDetector.detect(fullText);
    const { salaryMin, salaryMax } = this.extractSalary(rawJob.salary);
    const experienceLevel = this.detectExperienceLevel(fullText);

    // Handle potentially missing or invalid publication_date
    let postedDate: Date;
    try {
      postedDate = rawJob.publication_date ? new Date(rawJob.publication_date) : new Date();

      // Validate the date is valid
      if (isNaN(postedDate.getTime())) {
        postedDate = new Date();
      }
    } catch {
      postedDate = new Date();
    }

    return new Job(
      `remotive-${rawJob.id}`,
      title,
      rawJob.company_name || 'Company Not Specified',
      description,
      technologies,
      rawJob.candidate_required_location || 'Remote',
      null, // regionId - always null for fully remote positions
      true, // isRemote - Remotive only lists remote jobs
      salaryMin,
      salaryMax,
      experienceLevel,
      'remotive',
      rawJob.url || `https://remotive.com/remote-jobs/${rawJob.id}`,
      postedDate,
      true
    );
  }

  /**
   * Extract salary range from various string formats
   *
   * Returns salary in thousands (k). Examples:
   * - "$40,000 - $50,000" → { salaryMin: 40, salaryMax: 50 }
   * - "$40k - $50k" → { salaryMin: 40, salaryMax: 50 }
   * - "45000 - 65000" → { salaryMin: 45, salaryMax: 65 }
   */
  private extractSalary(salaryString?: string): {
    salaryMin: number | null;
    salaryMax: number | null;
  } {
    if (!salaryString || typeof salaryString !== 'string') {
      return { salaryMin: null, salaryMax: null };
    }

    // Match patterns like "$40,000 - $50,000" or "$40k - $50k" or "45000 - 65000"
    const rangePattern = /\$?\s*(\d+(?:,\d{3})*)(k)?\s*(?:[-–—]|to)\s*\$?\s*(\d+(?:,\d{3})*)(k)?/i;
    const match = salaryString.match(rangePattern);

    if (match) {
      const parseAmount = (numStr: string, hasK: string | undefined): number => {
        // Remove commas
        const cleaned = numStr.replace(/,/g, '');
        const num = parseInt(cleaned, 10);

        if (isNaN(num)) {
          throw new Error('Invalid number in salary string');
        }

        // If it has 'k' suffix, it's already in thousands
        if (hasK) {
          return num;
        }

        // Otherwise, it's a full number like 40000, convert to thousands
        return Math.round(num / 1000);
      };

      try {
        return {
          salaryMin: parseAmount(match[1], match[2]),
          salaryMax: parseAmount(match[3], match[4]),
        };
      } catch {
        return { salaryMin: null, salaryMax: null };
      }
    }

    // Try to match single value like "$50,000" or "$50k"
    const singlePattern = /\$?\s*(\d+(?:,\d{3})*)(k)?/i;
    const singleMatch = salaryString.match(singlePattern);

    if (singleMatch) {
      try {
        const parseAmount = (numStr: string, hasK: string | undefined): number => {
          const cleaned = numStr.replace(/,/g, '');
          const num = parseInt(cleaned, 10);

          if (isNaN(num)) {
            throw new Error('Invalid number in salary string');
          }

          if (hasK) {
            return num;
          }

          return Math.round(num / 1000);
        };

        const amount = parseAmount(singleMatch[1], singleMatch[2]);
        return { salaryMin: amount, salaryMax: amount };
      } catch {
        return { salaryMin: null, salaryMax: null };
      }
    }

    return { salaryMin: null, salaryMax: null };
  }

  /**
   * Detect experience level from job text
   */
  private detectExperienceLevel(text: string): string | null {
    const lowerText = text.toLowerCase();

    // Senior patterns (5+ years) - Check FIRST
    const seniorPatterns = [
      /\bsenior\b/i,
      /\blead\b/i,
      /\bstaff\b/i,
      /\bprincipal\b/i,
      /\barchitect\b/i,
      /\bexpert\b/i,
      /\b(?:5\+?|[5-9]|1[0-9])\s+years?\b/i,
      /\b(?:5\+?|[5-9]|1[0-9])\s+years?\s+(?:of\s+)?experience\b/i,
    ];

    // Junior patterns (0-2 years) - Check SECOND
    const juniorPatterns = [
      /\bjunior\b/i,
      /\bentry[-\s]?level\b/i,
      /\bintern(?:ship)?\b/i,
      /\bgraduate\b/i,
      /\b[0-2]\s+years?\b/i,
      /\b[0-2]\s+years?\s+(?:of\s+)?experience\b/i,
      /\bearly[-\s]?career\b/i,
    ];

    // Mid-level patterns (3-4 years) - Check LAST
    const midPatterns = [
      /\bmid(?:[-\s]?level)?\b/i,
      /\bintermediate\b/i,
      /\b[3-4]\s+years?\b/i,
      /\b[3-4]\s+years?\s+(?:of\s+)?experience\b/i,
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
