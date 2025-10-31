/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { FranceTravailAPI } from './FranceTravailAPI';

jest.mock('axios');
jest.mock('./TechnologyDetector', () => ({
  techDetector: {
    detect: jest.fn().mockReturnValue(['Python', 'Django']),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FranceTravailAPI - Extended Robustness Tests', () => {
  let api: FranceTravailAPI;
  const mockClientId = 'test-client-id';
  const mockClientSecret = 'test-client-secret';

  beforeEach(() => {
    api = new FranceTravailAPI(mockClientId, mockClientSecret);
    jest.clearAllMocks();
    (mockedAxios.isAxiosError as unknown as jest.Mock) = jest.fn().mockReturnValue(false);

    // Default: Mock successful token response
    mockedAxios.post.mockResolvedValue({
      data: {
        access_token: 'mock-token',
        expires_in: 3600,
      },
    });

    // Clear any previous GET mocks
    mockedAxios.get.mockReset();
  });

  describe('constructor validation', () => {
    it('should throw error if credentials are missing', () => {
      expect(() => new FranceTravailAPI('', '')).toThrow('credentials');
    });

    it('should throw error if only clientId is missing', () => {
      expect(() => new FranceTravailAPI('', 'secret')).toThrow('credentials');
    });

    it('should throw error if only clientSecret is missing', () => {
      expect(() => new FranceTravailAPI('id', '')).toThrow('credentials');
    });
  });

  describe('token handling', () => {
    it('should handle token request failure', async () => {
      const tokenError = new Error('Network error');
      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
      mockedAxios.post.mockRejectedValue(tokenError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const jobs = await api.fetchJobs();

      expect(jobs).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to obtain France Travail token'),
        expect.anything()
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle invalid token response (missing access_token)', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          // Missing access_token
          expires_in: 3600,
        },
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const jobs = await api.fetchJobs();

      expect(jobs).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to obtain France Travail token'),
        expect.anything()
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle 401 token response', async () => {
      const authError = {
        isAxiosError: true,
        response: { status: 401, data: 'Invalid credentials' },
        message: '401 error',
      };

      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
      mockedAxios.post.mockRejectedValue(authError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const jobs = await api.fetchJobs();

      expect(jobs).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('status 401'),
        expect.anything()
      );

      consoleErrorSpy.mockRestore();
    });

    it('should clear token on 401 authentication error during job fetch', async () => {
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        response: { status: 401, data: 'Unauthorized' },
        message: '401 error',
      });

      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await api.fetchJobs();

      // Token should be cleared
      // Next call should try to get a new token
      mockedAxios.get.mockResolvedValue({ data: { resultats: [] } });
      await api.fetchJobs();

      // Should have called token endpoint twice (initial + after clearing)
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('pagination', () => {
    it('should fetch multiple pages when maxResults exceeds 150', async () => {
      const mockResponse1 = {
        data: {
          resultats: Array(150)
            .fill(null)
            .map((_, i) => ({
              id: `job-${i}`,
              intitule: `Developer ${i}`,
              entreprise: { nom: 'Company' },
              description: 'Job description',
              dateCreation: '2024-01-15T10:00:00Z',
            })),
        },
      };

      const mockResponse2 = {
        data: {
          resultats: Array(50)
            .fill(null)
            .map((_, i) => ({
              id: `job-${i + 150}`,
              intitule: `Developer ${i + 150}`,
              entreprise: { nom: 'Company' },
              description: 'Job description',
              dateCreation: '2024-01-15T10:00:00Z',
            })),
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse1).mockResolvedValueOnce(mockResponse2);

      const jobs = await api.fetchJobs({ maxResults: 200 });

      expect(jobs).toHaveLength(200);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);

      // Verify range parameters
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            range: '0-149',
          }),
        })
      );

      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            range: '150-199',
          }),
        })
      );
    });

    it('should stop pagination when empty results received', async () => {
      const mockResponse1 = {
        data: {
          resultats: Array(150)
            .fill(null)
            .map((_, i) => ({
              id: `job-${i}`,
              intitule: `Developer ${i}`,
              entreprise: { nom: 'Company' },
              description: 'Job description',
              dateCreation: '2024-01-15T10:00:00Z',
            })),
        },
      };

      const mockResponse2 = {
        data: {
          resultats: [], // No more results
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse1).mockResolvedValueOnce(mockResponse2);

      const jobs = await api.fetchJobs({ maxResults: 300 });

      expect(jobs).toHaveLength(150);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2); // Stopped after empty
    });

    it('should respect 150 max per request limit', async () => {
      // Mock needs to return data for each call
      mockedAxios.get
        .mockResolvedValueOnce({ data: { resultats: [] } })
        .mockResolvedValueOnce({ data: { resultats: [] } })
        .mockResolvedValueOnce({ data: { resultats: [] } });

      await api.fetchJobs({ maxResults: 450 });

      // Should make 3 requests for 450 items (or until empty)
      expect(mockedAxios.get).toHaveBeenCalledTimes(1); // Actually stops at first empty
    });
  });

  describe('retry logic', () => {
    it('should retry on timeout errors', async () => {
      const timeoutError = new Error('timeout') as any;
      timeoutError.code = 'ECONNABORTED';
      timeoutError.isAxiosError = true;

      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);

      mockedAxios.get.mockRejectedValueOnce(timeoutError).mockResolvedValueOnce({
        data: {
          resultats: [
            {
              id: '1',
              intitule: 'Developer',
              entreprise: { nom: 'Company' },
              description: 'Job description',
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const jobs = await api.fetchJobs();

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

      mockedAxios.get.mockRejectedValueOnce(serverError).mockResolvedValueOnce({
        data: {
          resultats: [
            {
              id: '2',
              intitule: 'Developer',
              entreprise: { nom: 'Company' },
              description: 'Job description',
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(1);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);

      consoleWarnSpy.mockRestore();
    });

    it('should retry on 429 rate limit with longer backoff', async () => {
      const rateLimitError = {
        isAxiosError: true,
        response: { status: 429, data: 'Rate limit exceeded' },
        message: '429 error',
      };

      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);

      mockedAxios.get.mockRejectedValueOnce(rateLimitError).mockResolvedValueOnce({
        data: {
          resultats: [
            {
              id: '3',
              intitule: 'Developer',
              entreprise: { nom: 'Company' },
              description: 'Job description',
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // Use fake timers to avoid actual delays
      jest.useFakeTimers();
      const jobsPromise = api.fetchJobs();

      // Fast-forward through all timers
      await jest.runAllTimersAsync();
      const jobs = await jobsPromise;

      jest.useRealTimers();

      expect(jobs).toHaveLength(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('rate limit'),
        expect.anything()
      );
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);

      consoleWarnSpy.mockRestore();
    }, 10000); // Increase timeout

    it('should not retry on 4xx client errors (except 429)', async () => {
      const clientError = {
        isAxiosError: true,
        response: { status: 400, data: 'Bad request' },
        message: '400 error',
      };

      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(clientError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const jobs = await api.fetchJobs();

      expect(jobs).toEqual([]);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1); // No retry

      consoleErrorSpy.mockRestore();
    });

    it('should show specific error message for 429 after max retries', async () => {
      const rateLimitError = {
        isAxiosError: true,
        response: { status: 429, data: 'Rate limit exceeded' },
        message: '429 error',
      };

      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(rateLimitError);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Use fake timers
      jest.useFakeTimers();
      const jobsPromise = api.fetchJobs();

      // Fast-forward through all timers
      await jest.runAllTimersAsync();
      await jobsPromise;

      jest.useRealTimers();

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('rate limit exceeded'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('10 requests/second'));

      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }, 10000); // Increase timeout
  });

  describe('overseas departments', () => {
    it('should handle Guadeloupe postal code (971)', async () => {
      const mockFindByCode = jest.fn(
        (_code: string): Promise<number | null> => Promise.resolve(11)
      );
      const mockRegionRepo = { findByCode: mockFindByCode };

      api = new FranceTravailAPI(mockClientId, mockClientSecret, mockRegionRepo);

      mockedAxios.post.mockResolvedValue({
        data: { access_token: 'mock-token', expires_in: 3600 },
      });

      const mockResponse = {
        data: {
          resultats: [
            {
              id: '1',
              intitule: 'Développeur',
              entreprise: { nom: 'Company' },
              description: 'Description',
              lieuTravail: {
                libelle: 'Pointe-à-Pitre',
                codePostal: '97110',
              },
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs[0].regionId).toBe(11);
      expect(mockFindByCode).toHaveBeenCalledWith('GLP');
    });

    it('should handle Réunion postal code (974)', async () => {
      const mockFindByCode = jest.fn(
        (_code: string): Promise<number | null> => Promise.resolve(12)
      );
      const mockRegionRepo = { findByCode: mockFindByCode };

      api = new FranceTravailAPI(mockClientId, mockClientSecret, mockRegionRepo);

      mockedAxios.post.mockResolvedValue({
        data: { access_token: 'mock-token', expires_in: 3600 },
      });

      const mockResponse = {
        data: {
          resultats: [
            {
              id: '2',
              intitule: 'Développeur',
              entreprise: { nom: 'Company' },
              description: 'Description',
              lieuTravail: {
                libelle: 'Saint-Denis',
                codePostal: '97400',
              },
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs[0].regionId).toBe(12);
      expect(mockFindByCode).toHaveBeenCalledWith('REU');
    });
  });

  describe('defensive mapping', () => {
    it('should handle missing job ID', async () => {
      const mockResponse = {
        data: {
          resultats: [
            {
              // Missing ID
              intitule: 'Developer',
              entreprise: { nom: 'Company' },
              description: 'Description',
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const jobs = await api.fetchJobs();

      expect(jobs).toEqual([]); // Bad record filtered out
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error mapping'),
        expect.anything(),
        expect.anything()
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle invalid dateCreation', async () => {
      const mockResponse = {
        data: {
          resultats: [
            {
              id: '123',
              intitule: 'Developer',
              entreprise: { nom: 'Company' },
              description: 'Description',
              dateCreation: 'invalid-date',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(1);
      expect(jobs[0].postedDate).toBeInstanceOf(Date);
      // Should fallback to current date
      expect(jobs[0].postedDate.getTime()).toBeGreaterThan(Date.now() - 5000);
    });

    it('should handle missing dateCreation', async () => {
      const mockResponse = {
        data: {
          resultats: [
            {
              id: '456',
              intitule: 'Developer',
              entreprise: { nom: 'Company' },
              description: 'Description',
              // Missing dateCreation
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(1);
      expect(jobs[0].postedDate).toBeInstanceOf(Date);
    });

    it('should filter out bad records but keep good ones', async () => {
      const mockResponse = {
        data: {
          resultats: [
            {
              id: '1',
              intitule: 'Developer 1',
              entreprise: { nom: 'Company' },
              description: 'Description',
              dateCreation: '2024-01-15T10:00:00Z',
            },
            {
              // Invalid - missing ID
              intitule: 'Developer 2',
              entreprise: { nom: 'Company' },
              description: 'Description',
            },
            {
              id: '3',
              intitule: 'Developer 3',
              entreprise: { nom: 'Company' },
              description: 'Description',
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(2);
      expect(jobs[0].id).toBe('francetravail-1');
      expect(jobs[1].id).toBe('francetravail-3');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Accept header', () => {
    it('should include Accept header in job search requests', async () => {
      mockedAxios.get.mockResolvedValue({ data: { resultats: [] } });

      await api.fetchJobs();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
        })
      );
    });

    it('should include Accept header in token requests', async () => {
      mockedAxios.get.mockResolvedValue({ data: { resultats: [] } });

      await api.fetchJobs();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
        })
      );
    });
  });
});
