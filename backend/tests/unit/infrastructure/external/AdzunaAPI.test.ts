/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import {
  AdzunaAPI,
  SalaryPredictionStatus,
} from '../../../../src/infrastructure/external/AdzunaAPI';

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
              salary_is_predicted: '0',
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
        regionId: null,
        salaryMinKEuros: 40,
        salaryMaxKEuros: 55,
        salaryPredictionStatus: SalaryPredictionStatus.ACTUAL,
        salaryIsReliable: true,
        experienceLevel: null,
        sourceUrl: 'https://www.adzuna.fr/details/12345',
        postedDate: expect.any(Date),
      });
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
              salary_min: 45000,
              salary_max: 55000,
              salary_is_predicted: '0',
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
              salary_min: 50000,
              salary_max: 60000,
              salary_is_predicted: '0',
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
              salary_min: 40000,
              salary_max: 50000,
              salary_is_predicted: '0',
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
              salary_min: 45000,
              salary_max: 55000,
              salary_is_predicted: '0',
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
              salary_min: 50000,
              salary_max: 60000,
              salary_is_predicted: '0',
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
  });

  describe('salary normalization', () => {
    it('should handle very small salary values as daily rates', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '1',
              title: 'Python Developer',
              company: { display_name: 'Lengow' },
              description: 'Senior Python Developer with React',
              salary_min: 40,
              salary_max: 65,
              salary_is_predicted: '0',
              redirect_url: 'https://example.com/1',
              created: '2025-05-23T12:02:08Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const jobs = await api.fetchJobs();

      // 40 * 218 / 1000 = 8.72 ≈ 9, 65 * 218 / 1000 = 14.17 ≈ 14
      // But these are too low (< 25k threshold), so should be filtered
      expect(jobs[0].salaryMinKEuros).toBeNull();
      expect(jobs[0].salaryMaxKEuros).toBeNull();
      expect(jobs[0].salaryPredictionStatus).toBe(SalaryPredictionStatus.MISSING);
      expect(jobs[0].salaryIsReliable).toBe(false);

      consoleWarnSpy.mockRestore();
    });

    it('should handle normal annual salaries', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '2',
              title: 'Python Developer',
              company: { display_name: 'Veesion' },
              description: 'Confirmed Python Developer with JavaScript',
              salary_min: 60000,
              salary_max: 70000,
              salary_is_predicted: '0',
              redirect_url: 'https://example.com/2',
              created: '2025-09-27T11:51:47Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs[0].salaryMinKEuros).toBe(60);
      expect(jobs[0].salaryMaxKEuros).toBe(70);
      expect(jobs[0].salaryPredictionStatus).toBe(SalaryPredictionStatus.ACTUAL);
      expect(jobs[0].salaryIsReliable).toBe(true);
    });

    it('should handle daily rates with contract type hint', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '3',
              title: 'Python Developer',
              company: { display_name: 'WorldWide People' },
              description: 'CI/CD Pipeline development with React',
              salary_min: 340,
              salary_max: 400,
              salary_is_predicted: '0',
              contract_type: 'contract',
              redirect_url: 'https://example.com/3',
              created: '2025-10-07T15:08:29Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      // 340 * 218 / 1000 = 74.12 ≈ 74, 400 * 218 / 1000 = 87.2 ≈ 87
      expect(jobs[0].salaryMinKEuros).toBe(74);
      expect(jobs[0].salaryMaxKEuros).toBe(87);
      expect(jobs[0].salaryPredictionStatus).toBe(SalaryPredictionStatus.ACTUAL);
      expect(jobs[0].salaryIsReliable).toBe(true);
    });

    it('should handle high daily rates', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '4',
              title: 'Senior Python Developer',
              company: { display_name: 'Avanda' },
              description: 'Azure, PostgreSQL development with JavaScript',
              salary_min: 400,
              salary_max: 550,
              salary_is_predicted: '0',
              contract_type: 'contract',
              redirect_url: 'https://example.com/4',
              created: '2025-10-20T15:19:08Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      // 400 * 218 / 1000 = 87.2 ≈ 87, 550 * 218 / 1000 = 119.9 ≈ 120
      expect(jobs[0].salaryMinKEuros).toBe(87);
      expect(jobs[0].salaryMaxKEuros).toBe(120);
      expect(jobs[0].salaryPredictionStatus).toBe(SalaryPredictionStatus.ACTUAL);
      expect(jobs[0].salaryIsReliable).toBe(true);
    });

    it('should handle missing salary data', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '5',
              title: 'Python Developer',
              company: { display_name: 'Stormshield' },
              description: 'Network QA Engineer with React',
              redirect_url: 'https://example.com/5',
              created: '2025-08-13T09:13:17Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs[0].salaryMinKEuros).toBeNull();
      expect(jobs[0].salaryMaxKEuros).toBeNull();
      expect(jobs[0].salaryPredictionStatus).toBe(SalaryPredictionStatus.MISSING);
      expect(jobs[0].salaryIsReliable).toBe(false);
    });

    it('should handle predicted salaries', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '6',
              title: 'Python Developer',
              company: { display_name: 'TechCorp' },
              description: 'Backend development with JavaScript',
              salary_min: 45000,
              salary_max: 55000,
              salary_is_predicted: '1',
              redirect_url: 'https://example.com/6',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs[0].salaryMinKEuros).toBe(45);
      expect(jobs[0].salaryMaxKEuros).toBe(55);
      expect(jobs[0].salaryPredictionStatus).toBe(SalaryPredictionStatus.PREDICTED);
      expect(jobs[0].salaryIsReliable).toBe(false);
    });

    it('should swap min and max when reversed', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '7',
              title: 'Python Developer',
              company: { display_name: 'Company' },
              description: 'Development role with React',
              salary_min: 60000,
              salary_max: 50000,
              salary_is_predicted: '0',
              redirect_url: 'https://example.com/7',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const jobs = await api.fetchJobs();

      expect(jobs[0].salaryMinKEuros).toBe(50);
      expect(jobs[0].salaryMaxKEuros).toBe(60);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('swapping values'));

      consoleWarnSpy.mockRestore();
    });

    it('should handle only min salary provided', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '8',
              title: 'Python Developer',
              company: { display_name: 'Company' },
              description: 'Development role with JavaScript',
              salary_min: 50000,
              salary_is_predicted: '0',
              redirect_url: 'https://example.com/8',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs[0].salaryMinKEuros).toBe(50);
      expect(jobs[0].salaryMaxKEuros).toBe(50);
      expect(jobs[0].salaryPredictionStatus).toBe(SalaryPredictionStatus.ACTUAL);
      expect(jobs[0].salaryIsReliable).toBe(true);
    });

    it('should handle only max salary provided', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '9',
              title: 'Python Developer',
              company: { display_name: 'Company' },
              description: 'Development role with React',
              salary_max: 55000,
              salary_is_predicted: '0',
              redirect_url: 'https://example.com/9',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs[0].salaryMinKEuros).toBe(55);
      expect(jobs[0].salaryMaxKEuros).toBe(55);
      expect(jobs[0].salaryPredictionStatus).toBe(SalaryPredictionStatus.ACTUAL);
      expect(jobs[0].salaryIsReliable).toBe(true);
    });

    it('should handle unrealistically wide salary range', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '10',
              title: 'Python Developer',
              company: { display_name: 'Company' },
              description: 'Development role with JavaScript',
              salary_min: 30000,
              salary_max: 120000,
              salary_is_predicted: '0',
              redirect_url: 'https://example.com/10',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const jobs = await api.fetchJobs();

      // Range ratio = 120/30 = 4.0 > 3.0 threshold
      // Should use midpoint: (30 + 120) / 2 = 75
      expect(jobs[0].salaryMinKEuros).toBe(75);
      expect(jobs[0].salaryMaxKEuros).toBe(75);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('too wide'));

      consoleWarnSpy.mockRestore();
    });

    it('should filter out unrealistically low salaries', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '11',
              title: 'Python Developer',
              company: { display_name: 'Company' },
              description: 'Development role with React',
              salary_min: 15000,
              salary_max: 20000,
              salary_is_predicted: '0',
              redirect_url: 'https://example.com/11',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const jobs = await api.fetchJobs();

      // Below 25k threshold
      expect(jobs[0].salaryMinKEuros).toBeNull();
      expect(jobs[0].salaryMaxKEuros).toBeNull();
      expect(jobs[0].salaryIsReliable).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('outside realistic range')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should filter out unrealistically high salaries', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '12',
              title: 'Python Developer',
              company: { display_name: 'Company' },
              description: 'Development role with JavaScript',
              salary_min: 200000,
              salary_max: 300000,
              salary_is_predicted: '0',
              redirect_url: 'https://example.com/12',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const jobs = await api.fetchJobs();

      // Above 250k threshold
      expect(jobs[0].salaryMinKEuros).toBeNull();
      expect(jobs[0].salaryMaxKEuros).toBeNull();
      expect(jobs[0].salaryIsReliable).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('outside realistic range')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle stage/internship salaries (monthly stipends)', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '13',
              title: 'STAGE - Développement Python',
              company: { display_name: 'THALES' },
              description: 'Stage development with React',
              salary_min: 1000,
              salary_max: 2311,
              salary_is_predicted: '0',
              contract_type: 'contract',
              redirect_url: 'https://example.com/13',
              created: '2025-11-01T10:57:57Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      // Detected as daily rate: 1000 * 218 / 1000 = 218, 2311 * 218 / 1000 = 503
      // But these are too high, will be filtered
      // Actually should be detected as unrealistic
      expect(jobs[0].salaryMinKEuros).toBeNull();
      expect(jobs[0].salaryMaxKEuros).toBeNull();
    });
  });

  describe('other field handling', () => {
    it('should handle missing company name', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '67890',
              title: 'Développeur',
              description: 'Description with JavaScript',
              salary_min: 40000,
              salary_max: 50000,
              salary_is_predicted: '0',
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
              salary_min: 45000,
              salary_max: 55000,
              salary_is_predicted: '0',
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
              salary_min: 40000,
              salary_max: 50000,
              salary_is_predicted: '0',
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

    it('should always return null for experienceLevel', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '44444',
              title: 'Développeur Junior',
              company: { display_name: 'Company' },
              description: "Poste pour débutant, 0 à 2 ans d'expérience with React",
              salary_min: 35000,
              salary_max: 45000,
              salary_is_predicted: '0',
              redirect_url: 'https://www.adzuna.fr/details/44444',
              created: '2024-01-15T10:00:00Z',
            },
            {
              id: '55555',
              title: 'Développeur Senior',
              company: { display_name: 'Company' },
              description: "Poste confirmé, 5+ ans d'expérience with JavaScript",
              salary_min: 55000,
              salary_max: 75000,
              salary_is_predicted: '0',
              redirect_url: 'https://www.adzuna.fr/details/55555',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(2);
      expect(jobs[0].experienceLevel).toBeNull();
      expect(jobs[1].experienceLevel).toBeNull();
    });

    it('should skip jobs without detected technologies', async () => {
      const {
        techDetector,
      } = require('../../../../src/infrastructure/external/TechnologyDetector');

      // Mock techDetector to return empty array for this test
      techDetector.detect.mockReturnValueOnce([]);

      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '33333',
              title: 'Développeur',
              company: { display_name: 'Company' },
              description: 'Description without tech keywords',
              salary_min: 40000,
              salary_max: 50000,
              salary_is_predicted: '0',
              redirect_url: 'https://www.adzuna.fr/details/33333',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No technologies detected'),
        expect.anything()
      );

      consoleWarnSpy.mockRestore();
      // Reset mock to default behavior
      techDetector.detect.mockReturnValue(['JavaScript', 'React']);
    });

    it('should skip jobs without ID', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              title: 'Développeur',
              company: { display_name: 'Company' },
              description: 'Description with React',
              salary_min: 40000,
              salary_max: 50000,
              salary_is_predicted: '0',
              redirect_url: 'https://www.adzuna.fr/details/missing',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('without ID'),
        expect.anything()
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle invalid date formats gracefully', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '66666',
              title: 'Développeur',
              company: { display_name: 'Company' },
              description: 'Description with JavaScript',
              salary_min: 40000,
              salary_max: 50000,
              salary_is_predicted: '0',
              redirect_url: 'https://www.adzuna.fr/details/66666',
              created: 'invalid-date',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(1);
      expect(jobs[0].postedDate).toBeInstanceOf(Date);
      // Should fallback to current date
      expect(jobs[0].postedDate.getTime()).toBeLessThanOrEqual(new Date().getTime());
    });

    it('should handle future dates by using current date', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '77777',
              title: 'Développeur',
              company: { display_name: 'Company' },
              description: 'Description with React',
              salary_min: 40000,
              salary_max: 50000,
              salary_is_predicted: '0',
              redirect_url: 'https://www.adzuna.fr/details/77777',
              created: futureDate.toISOString(),
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(1);
      expect(jobs[0].postedDate.getTime()).toBeLessThanOrEqual(new Date().getTime());
    });
  });

  describe('getSourceName', () => {
    it('should return correct source name', () => {
      expect(api.getSourceName()).toBe('adzuna');
    });
  });

  describe('region extraction', () => {
    it('should extract region ID for Paris', async () => {
      const mockRegionRepo = {
        findByCode: jest.fn<(code: string) => Promise<number | null>>().mockResolvedValue(1),
      };

      const apiWithRegion = new AdzunaAPI(mockAppId, mockAppKey, mockRegionRepo);

      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '88888',
              title: 'Développeur',
              company: { display_name: 'Company' },
              description: 'Description with JavaScript',
              location: { display_name: 'Paris, Île-de-France' },
              salary_min: 50000,
              salary_max: 60000,
              salary_is_predicted: '0',
              redirect_url: 'https://www.adzuna.fr/details/88888',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await apiWithRegion.fetchJobs();

      expect(jobs[0].regionId).toBe(1);
      expect(mockRegionRepo.findByCode).toHaveBeenCalledWith('IDF');
    });

    it('should cache region IDs to avoid repeated lookups', async () => {
      const mockRegionRepo = {
        findByCode: jest.fn<(code: string) => Promise<number | null>>().mockResolvedValue(2),
      };

      const apiWithRegion = new AdzunaAPI(mockAppId, mockAppKey, mockRegionRepo);

      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '99999',
              title: 'Développeur 1',
              company: { display_name: 'Company' },
              description: 'Description with React',
              location: { display_name: 'Lyon, Auvergne-Rhône-Alpes' },
              salary_min: 45000,
              salary_max: 55000,
              salary_is_predicted: '0',
              redirect_url: 'https://www.adzuna.fr/details/99999',
              created: '2024-01-15T10:00:00Z',
            },
            {
              id: '99998',
              title: 'Développeur 2',
              company: { display_name: 'Company' },
              description: 'Description with JavaScript',
              location: { display_name: 'Lyon, Auvergne-Rhône-Alpes' },
              salary_min: 45000,
              salary_max: 55000,
              salary_is_predicted: '0',
              redirect_url: 'https://www.adzuna.fr/details/99998',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await apiWithRegion.fetchJobs();

      expect(jobs).toHaveLength(2);
      expect(jobs[0].regionId).toBe(2);
      expect(jobs[1].regionId).toBe(2);
      // Should only be called once due to caching
      expect(mockRegionRepo.findByCode).toHaveBeenCalledTimes(1);
    });

    it('should return null for unrecognized regions', async () => {
      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '99997',
              title: 'Développeur',
              company: { display_name: 'Company' },
              description: 'Description with React',
              location: { display_name: 'Unknown Region' },
              salary_min: 45000,
              salary_max: 55000,
              salary_is_predicted: '0',
              redirect_url: 'https://www.adzuna.fr/details/99997',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs[0].regionId).toBeNull();
    });
  });

  describe('error handling in mapToDTO', () => {
    it('should handle errors during DTO mapping gracefully', async () => {
      const {
        techDetector,
      } = require('../../../../src/infrastructure/external/TechnologyDetector');

      // Make techDetector throw an error
      techDetector.detect.mockImplementationOnce(() => {
        throw new Error('Technology detection failed');
      });

      const mockResponse = {
        status: 200,
        data: {
          results: [
            {
              id: '99996',
              title: 'Développeur',
              company: { display_name: 'Company' },
              description: 'Description',
              salary_min: 40000,
              salary_max: 50000,
              salary_is_predicted: '0',
              redirect_url: 'https://www.adzuna.fr/details/99996',
              created: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error mapping Adzuna job'),
        expect.anything(),
        expect.anything()
      );

      consoleErrorSpy.mockRestore();
      // Reset mock
      techDetector.detect.mockReturnValue(['JavaScript', 'React']);
    });
  });

  describe('API parameter validation', () => {
    it('should use default parameters when none provided', async () => {
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

    it('should pass custom keywords to API', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { results: [] },
      });

      await api.fetchJobs({ keywords: 'python developer' });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            what: 'python developer',
          }),
        })
      );
    });

    it('should include app credentials in all requests', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { results: [] },
      });

      await api.fetchJobs();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            app_id: mockAppId,
            app_key: mockAppKey,
          }),
        })
      );
    });
  });
});
