/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { RemotiveAPI } from './RemotiveAPI';

jest.mock('axios');
jest.mock('./TechnologyDetector', () => ({
  techDetector: {
    detect: jest.fn().mockReturnValue(['Go', 'Docker']),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RemotiveAPI - Extended Tests', () => {
  let api: RemotiveAPI;

  beforeEach(() => {
    api = new RemotiveAPI();
    jest.clearAllMocks();
    (mockedAxios.isAxiosError as unknown as jest.Mock) = jest.fn().mockReturnValue(false);
  });

  describe('retry logic', () => {
    it('should retry on timeout errors', async () => {
      const timeoutError = new Error('timeout') as any;
      timeoutError.code = 'ECONNABORTED';
      timeoutError.isAxiosError = true;

      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);

      const successResponse = {
        data: {
          jobs: [
            {
              id: 1,
              title: 'Developer',
              company_name: 'Company',
              description: 'Job description',
              url: 'https://remotive.com/job/1',
              publication_date: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockRejectedValueOnce(timeoutError).mockResolvedValueOnce(successResponse);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const jobs = await api.fetchJobs(50);

      expect(jobs).toHaveLength(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('retrying'),
        expect.anything()
      );
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);

      consoleWarnSpy.mockRestore();
    });

    it('should retry on 5xx server errors', async () => {
      const serverError = {
        isAxiosError: true,
        response: { status: 503, data: 'Service unavailable' },
        message: '503 error',
      };

      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);

      const successResponse = {
        data: {
          jobs: [
            {
              id: 2,
              title: 'Developer',
              company_name: 'Company',
              description: 'Job description',
              url: 'https://remotive.com/job/2',
              publication_date: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockRejectedValueOnce(serverError).mockResolvedValueOnce(successResponse);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const jobs = await api.fetchJobs(50);

      expect(jobs).toHaveLength(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('retrying'),
        expect.anything()
      );
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);

      consoleWarnSpy.mockRestore();
    });

    it('should not retry on 4xx client errors', async () => {
      const clientError = {
        isAxiosError: true,
        response: { status: 401, data: 'Unauthorized' },
        message: '401 error',
      };

      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(clientError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const jobs = await api.fetchJobs(50);

      expect(jobs).toEqual([]);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1); // No retry

      consoleErrorSpy.mockRestore();
    });

    it('should show specific message for rate limiting (429)', async () => {
      const rateLimitError = {
        isAxiosError: true,
        response: { status: 429, data: 'Rate limit exceeded' },
        message: '429 error',
      };

      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(rateLimitError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await api.fetchJobs(50);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('rate limit exceeded'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('4 requests per day'));

      consoleErrorSpy.mockRestore();
    });

    it('should stop retrying after max attempts', async () => {
      const timeoutError = new Error('timeout') as any;
      timeoutError.code = 'ECONNABORTED';
      timeoutError.isAxiosError = true;

      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(timeoutError);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const jobs = await api.fetchJobs(50);

      expect(jobs).toEqual([]);
      expect(mockedAxios.get).toHaveBeenCalledTimes(3); // Max retries

      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('defensive mapping', () => {
    it('should handle missing job ID gracefully', async () => {
      const mockResponse = {
        data: {
          jobs: [
            {
              // Missing ID
              title: 'Developer',
              company_name: 'Company',
              description: 'Job description',
              url: 'https://remotive.com/job/123',
              publication_date: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const jobs = await api.fetchJobs(50);

      expect(jobs).toEqual([]); // Bad record filtered out
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error mapping'),
        expect.anything(),
        expect.anything()
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle invalid publication_date', async () => {
      const mockResponse = {
        data: {
          jobs: [
            {
              id: 123,
              title: 'Developer',
              company_name: 'Company',
              description: 'Job description',
              url: 'https://remotive.com/job/123',
              publication_date: 'invalid-date',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs(50);

      expect(jobs).toHaveLength(1);
      expect(jobs[0].postedDate).toBeInstanceOf(Date);
      // Should fallback to current date
      expect(jobs[0].postedDate.getTime()).toBeGreaterThan(Date.now() - 5000);
    });

    it('should handle missing publication_date', async () => {
      const mockResponse = {
        data: {
          jobs: [
            {
              id: 456,
              title: 'Developer',
              company_name: 'Company',
              description: 'Job description',
              url: 'https://remotive.com/job/456',
              // Missing publication_date
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs(50);

      expect(jobs).toHaveLength(1);
      expect(jobs[0].postedDate).toBeInstanceOf(Date);
    });

    it('should handle missing URL gracefully', async () => {
      const mockResponse = {
        data: {
          jobs: [
            {
              id: 789,
              title: 'Developer',
              company_name: 'Company',
              description: 'Job description',
              // Missing URL - implementation provides fallback
              publication_date: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs(50);

      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe('remotive-789');
      // URL fallback is provided internally, job maps successfully
    });

    it('should handle mixed valid and invalid jobs', async () => {
      const mockResponse = {
        data: {
          jobs: [
            {
              // Valid job
              id: 1,
              title: 'Developer 1',
              company_name: 'Company',
              description: 'Job description',
              url: 'https://remotive.com/job/1',
              publication_date: '2024-01-15T10:00:00Z',
            },
            {
              // Invalid job - missing ID
              title: 'Developer 2',
              company_name: 'Company',
              description: 'Job description',
            },
            {
              // Valid job
              id: 3,
              title: 'Developer 3',
              company_name: 'Company',
              description: 'Job description',
              url: 'https://remotive.com/job/3',
              publication_date: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const jobs = await api.fetchJobs(50);

      expect(jobs).toHaveLength(2); // Only valid jobs
      expect(jobs[0].id).toBe('remotive-1');
      expect(jobs[1].id).toBe('remotive-3');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('parameterizable search', () => {
    it('should accept options object with category', async () => {
      mockedAxios.get.mockResolvedValue({ data: { jobs: [] } });

      await api.fetchJobs({ category: 'marketing', limit: 30 });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            category: 'marketing',
            limit: 30,
          }),
        })
      );
    });

    it('should accept options object with search term', async () => {
      mockedAxios.get.mockResolvedValue({ data: { jobs: [] } });

      await api.fetchJobs({ search: 'python', limit: 25 });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            search: 'python',
            limit: 25,
          }),
        })
      );
    });

    it('should accept options object with company_name', async () => {
      mockedAxios.get.mockResolvedValue({ data: { jobs: [] } });

      await api.fetchJobs({ company_name: 'GitHub' });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            company_name: 'GitHub',
          }),
        })
      );
    });

    it('should maintain backwards compatibility with number argument', async () => {
      mockedAxios.get.mockResolvedValue({ data: { jobs: [] } });

      await api.fetchJobs(75);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            limit: 75,
            category: 'software-dev', // Default
          }),
        })
      );
    });
  });

  describe('Accept header', () => {
    it('should include Accept: application/json header', async () => {
      mockedAxios.get.mockResolvedValue({ data: { jobs: [] } });

      await api.fetchJobs(50);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
        })
      );
    });
  });

  describe('salary parsing edge cases', () => {
    it('should handle invalid salary string gracefully', async () => {
      const mockResponse = {
        data: {
          jobs: [
            {
              id: 999,
              title: 'Developer',
              company_name: 'Company',
              description: 'Job description',
              salary: 'Competitive', // Not parseable
              url: 'https://remotive.com/job/999',
              publication_date: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs(50);

      expect(jobs).toHaveLength(1);
      expect(jobs[0].salaryMin).toBeNull();
      expect(jobs[0].salaryMax).toBeNull();
    });

    it('should handle null salary string', async () => {
      const mockResponse = {
        data: {
          jobs: [
            {
              id: 1000,
              title: 'Developer',
              company_name: 'Company',
              description: 'Job description',
              salary: null,
              url: 'https://remotive.com/job/1000',
              publication_date: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs(50);

      expect(jobs).toHaveLength(1);
      expect(jobs[0].salaryMin).toBeNull();
      expect(jobs[0].salaryMax).toBeNull();
    });

    it('should handle non-string salary value', async () => {
      const mockResponse = {
        data: {
          jobs: [
            {
              id: 1001,
              title: 'Developer',
              company_name: 'Company',
              description: 'Job description',
              salary: 123456, // Number instead of string
              url: 'https://remotive.com/job/1001',
              publication_date: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs(50);

      expect(jobs).toHaveLength(1);
      expect(jobs[0].salaryMin).toBeNull();
      expect(jobs[0].salaryMax).toBeNull();
    });
  });
});
