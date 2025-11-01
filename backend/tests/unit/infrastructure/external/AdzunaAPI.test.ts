/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { AdzunaAPI } from '../../../../src/infrastructure/external/AdzunaAPI';

jest.mock('axios');
jest.mock('../../../../src/infrastructure/external/TechnologyDetector', () => ({
  techDetector: {
    detect: jest.fn().mockReturnValue(['JavaScript', 'React']),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AdzunaAPI', () => {
  let api: AdzunaAPI;
  const mockAppId = 'test-app-id';
  const mockAppKey = 'test-app-key';

  beforeEach(() => {
    api = new AdzunaAPI(mockAppId, mockAppKey);
    jest.clearAllMocks();
    (mockedAxios.isAxiosError as unknown as jest.Mock) = jest.fn().mockReturnValue(false);
  });

  describe('constructor', () => {
    it('should throw error if credentials are missing', () => {
      expect(() => new AdzunaAPI('', '')).toThrow('Adzuna API credentials');
    });
  });

  describe('fetchJobs', () => {
    it('should fetch and map jobs successfully to DTOs', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '12345',
              title: 'Développeur Full Stack',
              company: { display_name: 'TechCorp' },
              description: 'Nous recherchons un développeur Full Stack avec React',
              location: { display_name: 'Paris, Île-de-France' },
              salary_min: 40000,
              salary_max: 55000,
              redirect_url: 'https://www.adzuna.fr/details/12345',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs({ keywords: 'développeur' });

      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toEqual({
        externalId: 'adzuna-12345',
        title: 'Développeur Full Stack',
        company: 'TechCorp',
        description: 'Nous recherchons un développeur Full Stack avec React',
        technologies: ['JavaScript', 'React'],
        location: 'Paris, Île-de-France',
        regionId: null, // No region repo provided
        salaryMinKEuros: 40,
        salaryMaxKEuros: 55,
        experienceLevel: null, // Always null - domain responsibility
        sourceUrl: 'https://www.adzuna.fr/details/12345',
        postedDate: expect.any(Date),
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.adzuna.com/v1/api/jobs/fr/search/1',
        expect.objectContaining({
          params: {
            app_id: mockAppId,
            app_key: mockAppKey,
            what: 'développeur',
            results_per_page: 50,
          },
          headers: {
            Accept: 'application/json',
          },
        })
      );
    });

    it('should handle pagination with multiple pages', async () => {
      const mockResponse1 = {
        status: 200,
        data: {
          results: [
            {
              id: '1',
              title: 'Dev 1',
              company: { display_name: 'Company1' },
              description: 'Description with JavaScript',
              redirect_url: 'https://example.com/1',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      const mockResponse2 = {
        status: 200,
        data: {
          results: [
            {
              id: '2',
              title: 'Dev 2',
              company: { display_name: 'Company2' },
              description: 'Description with React',
              redirect_url: 'https://example.com/2',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse1).mockResolvedValueOnce(mockResponse2);

      const jobs = await api.fetchJobs({
        keywords: 'développeur',
        maxPages: 2,
        delayBetweenRequests: 10,
      });

      expect(jobs).toHaveLength(2);
      expect(jobs[0].externalId).toBe('adzuna-1');
      expect(jobs[1].externalId).toBe('adzuna-2');
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should stop pagination when empty results', async () => {
      const mockResponse1 = {
        status: 200,
        data: {
          results: [
            {
              id: '1',
              title: 'Dev 1',
              company: { display_name: 'Company' },
              description: 'Description with JavaScript',
              redirect_url: 'https://example.com/1',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      const mockResponse2 = {
        status: 200,
        data: {
          results: [],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse1).mockResolvedValueOnce(mockResponse2);

      const jobs = await api.fetchJobs({
        keywords: 'développeur',
        maxPages: 5,
        delayBetweenRequests: 10,
      });

      expect(jobs).toHaveLength(1);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should enforce max results per page limit', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { results: [] },
      });

      await api.fetchJobs({ resultsPerPage: 100 });

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('exceeds maximum'));
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            results_per_page: 50,
          }),
        })
      );

      consoleWarnSpy.mockRestore();
    });

    it('should retry on timeout errors', async () => {
      const timeoutError = new Error('timeout') as any;
      timeoutError.code = 'ECONNABORTED';
      timeoutError.isAxiosError = true;

      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
      mockedAxios.get.mockRejectedValueOnce(timeoutError).mockResolvedValueOnce({
        status: 200,
        data: {
          results: [
            {
              id: '1',
              title: 'Dev',
              company: { display_name: 'Company' },
              description: 'Description with JavaScript',
              redirect_url: 'https://example.com/1',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const jobs = await api.fetchJobs({ delayBetweenRequests: 10 });

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
        status: 200,
        data: {
          results: [
            {
              id: '1',
              title: 'Dev',
              company: { display_name: 'Company' },
              description: 'Description with React',
              redirect_url: 'https://example.com/1',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const jobs = await api.fetchJobs({ delayBetweenRequests: 10 });

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

      const jobs = await api.fetchJobs();

      expect(jobs).toEqual([]);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockRestore();
    });

    it('should handle missing company name', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '67890',
              title: 'Développeur',
              description: 'Description with JavaScript',
              redirect_url: 'https://www.adzuna.fr/details/67890',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs[0].company).toBe('Non spécifié');
    });

    it('should handle missing location', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '11111',
              title: 'Développeur',
              company: { display_name: 'Company' },
              description: 'Description with React',
              redirect_url: 'https://www.adzuna.fr/details/11111',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs[0].location).toBe('France');
    });

    it('should handle missing title', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '22222',
              company: { display_name: 'Company' },
              description: 'Description with JavaScript',
              redirect_url: 'https://www.adzuna.fr/details/22222',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs[0].title).toBe('Sans titre');
    });

    it('should NOT detect remote jobs (domain responsibility)', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '33333',
              title: 'Développeur Remote',
              company: { display_name: 'RemoteCompany' },
              description: 'Poste en télétravail complet with JavaScript',
              location: { display_name: 'France' },
              redirect_url: 'https://www.adzuna.fr/details/33333',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(1);
      // DTO doesn't have isRemote - that's determined by domain layer
      expect(jobs[0]).not.toHaveProperty('isRemote');
    });

    it('should always return null for experienceLevel (domain responsibility)', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '44444',
              title: 'Développeur Junior',
              company: { display_name: 'Company' },
              description: "Poste pour débutant, 0 à 2 ans d'expérience with React",
              redirect_url: 'https://www.adzuna.fr/details/44444',
              created: '2024-01-15T10:00:00Z',
            },
            {
              id: '55555',
              title: 'Développeur Senior',
              company: { display_name: 'Company' },
              description: "Poste confirmé, 5+ ans d'expérience with JavaScript",
              redirect_url: 'https://www.adzuna.fr/details/55555',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(2);
      // All jobs should have null experienceLevel - detection is domain responsibility
      expect(jobs[0].experienceLevel).toBeNull();
      expect(jobs[1].experienceLevel).toBeNull();
    });

    it('should set null salary when not provided', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '77777',
              title: 'Développeur',
              company: { display_name: 'Company' },
              description: 'Description with JavaScript',
              redirect_url: 'https://www.adzuna.fr/details/77777',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs[0].salaryMinKEuros).toBeNull();
      expect(jobs[0].salaryMaxKEuros).toBeNull();
    });

    it('should convert salary from yearly to thousands', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '88888',
              title: 'Développeur',
              company: { display_name: 'Company' },
              description: 'Description with React',
              salary_min: 45000,
              salary_max: 60000,
              redirect_url: 'https://www.adzuna.fr/details/88888',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs[0].salaryMinKEuros).toBe(45);
      expect(jobs[0].salaryMaxKEuros).toBe(60);
    });

    it('should skip jobs without detected technologies', async () => {
      const {
        techDetector,
      } = require('../../../../src/infrastructure/external/TechnologyDetector');
      (techDetector.detect as jest.Mock).mockReturnValueOnce([]);

      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '99999',
              title: 'Generic Position',
              company: { display_name: 'Company' },
              description: 'Very vague description',
              redirect_url: 'https://www.adzuna.fr/details/99999',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const jobs = await api.fetchJobs();

      expect(jobs).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No technologies detected'),
        expect.anything()
      );

      consoleWarnSpy.mockRestore();

      // Restore mock
      (techDetector.detect as jest.Mock).mockReturnValue(['JavaScript', 'React']);
    });

    it('should return empty array on API error after retries', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const jobs = await api.fetchJobs();

      expect(jobs).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle empty results', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { results: [] },
      });

      const jobs = await api.fetchJobs();

      expect(jobs).toEqual([]);
    });

    it('should use default parameters', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { results: [] },
      });

      await api.fetchJobs();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            what: 'développeur',
            results_per_page: 50,
          }),
        })
      );
    });

    it('should handle missing job ID gracefully', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              // Missing ID
              title: 'Developer',
              company: { display_name: 'Company' },
              description: 'Description with JavaScript',
              redirect_url: 'https://example.com/123',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const jobs = await api.fetchJobs();

      expect(jobs).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipping job without ID'),
        expect.any(Object)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('fetchJobs with region repository', () => {
    it('should fetch region ID from repository', async () => {
      const mockFindByCode = jest.fn((_code: string): Promise<number | null> => Promise.resolve(1));
      const mockRegionRepo = {
        findByCode: mockFindByCode,
      };

      api = new AdzunaAPI(mockAppId, mockAppKey, mockRegionRepo);

      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '99999',
              title: 'Développeur',
              company: { display_name: 'Company' },
              description: 'Description with JavaScript',
              location: { display_name: 'Paris, Île-de-France' },
              redirect_url: 'https://www.adzuna.fr/details/99999',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs[0].regionId).toBe(1);
      expect(mockFindByCode).toHaveBeenCalledWith('IDF');
    });

    it('should cache region IDs', async () => {
      const mockFindByCode = jest.fn((_code: string): Promise<number | null> => Promise.resolve(2));
      const mockRegionRepo = {
        findByCode: mockFindByCode,
      };

      api = new AdzunaAPI(mockAppId, mockAppKey, mockRegionRepo);

      const mockResponse1 = {
        status: 200,
        data: {
          results: [
            {
              id: '10001',
              title: 'Développeur',
              company: { display_name: 'Company' },
              description: 'Description with React',
              location: { display_name: 'Lyon, Auvergne-Rhône-Alpes' },
              redirect_url: 'https://www.adzuna.fr/details/10001',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse1);
      await api.fetchJobs();

      expect(mockFindByCode).toHaveBeenCalledTimes(1);
      expect(mockFindByCode).toHaveBeenCalledWith('ARA');

      const mockResponse2 = {
        status: 200,
        data: {
          results: [
            {
              id: '10002',
              title: 'Développeur 2',
              company: { display_name: 'Company' },
              description: 'Description with JavaScript',
              location: { display_name: 'Lyon, Auvergne-Rhône-Alpes' },
              redirect_url: 'https://www.adzuna.fr/details/10002',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse2);
      await api.fetchJobs();

      expect(mockFindByCode).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSourceName', () => {
    it('should return the correct source name', () => {
      expect(api.getSourceName()).toBe('adzuna');
    });
  });
});
