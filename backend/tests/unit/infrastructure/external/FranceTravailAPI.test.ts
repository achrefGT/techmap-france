import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import axios from 'axios';
import { FranceTravailAPI } from '../../../../src/infrastructure/external/FranceTravailAPI';

jest.mock('axios');
jest.mock('../../../../src/infrastructure/external/TechnologyDetector', () => ({
  techDetector: {
    detect: jest.fn().mockReturnValue(['Python', 'Django']),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FranceTravailAPI - Updated Tests', () => {
  let api: FranceTravailAPI;
  const mockClientId = 'test-client-id';
  const mockClientSecret = 'test-client-secret';

  beforeEach(() => {
    api = new FranceTravailAPI(mockClientId, mockClientSecret);
    jest.clearAllMocks();
    (mockedAxios.isAxiosError as unknown as jest.Mock) = jest.fn().mockReturnValue(false);

    mockedAxios.post.mockResolvedValue({
      data: { access_token: 'mock-token', expires_in: 3600 },
    });

    mockedAxios.get.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor validation', () => {
    it('should throw error if credentials are missing', () => {
      expect(() => new FranceTravailAPI('', '')).toThrow('credentials');
      expect(() => new FranceTravailAPI('', 'secret')).toThrow('credentials');
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
      mockedAxios.post.mockResolvedValue({ data: { expires_in: 3600 } });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const jobs = await api.fetchJobs();

      expect(jobs).toEqual([]);
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
      consoleErrorSpy.mockRestore();
    });

    it('should refresh token on 401 during job fetch and retry', async () => {
      const authError = {
        isAxiosError: true,
        response: { status: 401 },
        message: '401 error',
      };

      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);

      mockedAxios.get.mockRejectedValueOnce(authError);
      mockedAxios.post.mockResolvedValueOnce({
        data: { access_token: 'new-token', expires_in: 3600 },
      });
      mockedAxios.get.mockResolvedValueOnce({ data: { resultats: [] } });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await api.fetchJobs();

      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('DTO structure', () => {
    it('should return DTOs with correct structure', async () => {
      const mockResponse = {
        data: {
          resultats: [
            {
              id: '123',
              intitule: 'Développeur Python Senior',
              entreprise: { nom: 'TechCorp' },
              description: 'Développer des applications avec Python et Django',
              lieuTravail: { libelle: 'Paris', codePostal: '75001' },
              salaire: { libelle: '40000 à 50000 Euros par an' },
              dateCreation: '2024-01-15T10:00:00Z',
              origineOffre: { urlOrigine: 'https://example.com/job/123' },
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toEqual({
        externalId: 'francetravail-123',
        title: 'Développeur Python Senior',
        company: 'TechCorp',
        description: 'Développer des applications avec Python et Django',
        technologies: ['Python', 'Django'],
        location: 'Paris',
        regionId: null,
        salaryMinKEuros: 40,
        salaryMaxKEuros: 50,
        experienceLevel: null,
        sourceUrl: 'https://example.com/job/123',
        postedDate: expect.any(Date),
      });
    });

    it('should always return null for experienceLevel', async () => {
      const mockResponse = {
        data: {
          resultats: [
            {
              id: '100',
              intitule: 'Développeur Junior',
              entreprise: { nom: 'Company' },
              description: 'Poste avec Python',
              experienceLibelle: 'Débutant accepté',
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const jobs = await api.fetchJobs();

      expect(jobs[0].experienceLevel).toBeNull();
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
              description: 'Job with Python',
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
              description: 'Job with Django',
              dateCreation: '2024-01-15T10:00:00Z',
            })),
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse1).mockResolvedValueOnce(mockResponse2);
      const jobs = await api.fetchJobs({ maxResults: 200 });

      expect(jobs).toHaveLength(200);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.objectContaining({ params: expect.objectContaining({ range: '0-149' }) })
      );
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({ params: expect.objectContaining({ range: '150-199' }) })
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
              description: 'Job with Python',
              dateCreation: '2024-01-15T10:00:00Z',
            })),
        },
      };

      mockedAxios.get
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce({ data: { resultats: [] } });

      const jobs = await api.fetchJobs({ maxResults: 300 });

      expect(jobs).toHaveLength(150);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
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
              description: 'Job with Python',
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
              description: 'Job with Django',
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

    it('should retry on 429 rate limit with backoff', async () => {
      const rateLimitError = {
        isAxiosError: true,
        response: { status: 429, data: 'Rate limit', headers: {} },
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
              description: 'Job with Python',
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      jest.useFakeTimers();
      const jobsPromise = api.fetchJobs();
      await jest.runAllTimersAsync();
      const jobs = await jobsPromise;
      jest.useRealTimers();

      expect(jobs).toHaveLength(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('rate limit'),
        expect.anything()
      );
      consoleWarnSpy.mockRestore();
    }, 10000);

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
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      consoleErrorSpy.mockRestore();
    });

    it('should show error message for 429 after max retries', async () => {
      const rateLimitError = {
        isAxiosError: true,
        response: { status: 429, data: 'Rate limit', headers: {} },
        message: '429 error',
      };

      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(rateLimitError);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      jest.useFakeTimers();
      const jobsPromise = api.fetchJobs();
      await jest.runAllTimersAsync();
      await jobsPromise;
      jest.useRealTimers();

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('rate limit exceeded'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('10 requests/second'));

      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }, 10000);
  });

  describe('region extraction', () => {
    it('should extract region from postal code', async () => {
      const mockFindByCode = jest.fn((_code: string): Promise<number | null> => Promise.resolve(1));
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
              description: 'Job with Python',
              lieuTravail: { libelle: 'Paris', codePostal: '75001' },
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const jobs = await api.fetchJobs();

      expect(jobs[0].regionId).toBe(1);
      expect(mockFindByCode).toHaveBeenCalledWith('IDF');
    });

    it('should handle overseas departments (Guadeloupe)', async () => {
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
              description: 'Job with Python',
              lieuTravail: { libelle: 'Pointe-à-Pitre', codePostal: '97110' },
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

    it('should extract department from libelle (e.g., "69 - LYON 03")', async () => {
      const mockFindByCode = jest.fn((_code: string): Promise<number | null> => Promise.resolve(2));
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
              description: 'Job with Django',
              lieuTravail: { libelle: '69 - LYON 03' },
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(1);
      expect(mockFindByCode).toHaveBeenCalledWith('ARA');
    });

    it('should match city names in libelle', async () => {
      const mockFindByCode = jest.fn((_code: string): Promise<number | null> => Promise.resolve(3));
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
              description: 'Job with Python',
              lieuTravail: { libelle: 'Marseille Centre' },
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(1);
      expect(mockFindByCode).toHaveBeenCalledWith('PAC');
    });

    it('should cache region IDs', async () => {
      const mockFindByCode = jest.fn((_code: string): Promise<number | null> => Promise.resolve(1));
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
              intitule: 'Dev 1',
              entreprise: { nom: 'Company' },
              description: 'Job with Python',
              lieuTravail: { codePostal: '75001' },
              dateCreation: '2024-01-15T10:00:00Z',
            },
            {
              id: '2',
              intitule: 'Dev 2',
              entreprise: { nom: 'Company' },
              description: 'Job with Django',
              lieuTravail: { codePostal: '75002' },
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(2);
      expect(jobs[0].regionId).toBe(1);
      expect(jobs[1].regionId).toBe(1);
      expect(mockFindByCode).toHaveBeenCalledTimes(1);
      expect(mockFindByCode).toHaveBeenCalledWith('IDF');
    });
  });

  describe('defensive mapping', () => {
    it('should skip jobs without ID', async () => {
      const mockResponse = {
        data: {
          resultats: [
            {
              intitule: 'Developer',
              entreprise: { nom: 'Company' },
              description: 'Job with Python',
              dateCreation: '2024-01-15T10:00:00Z',
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
        expect.anything()
      );
      consoleWarnSpy.mockRestore();
    });

    it('should skip jobs without detected technologies', async () => {
      const {
        techDetector,
      } = require('../../../../src/infrastructure/external/TechnologyDetector');
      (techDetector.detect as jest.Mock).mockReturnValueOnce([]);

      const mockResponse = {
        data: {
          resultats: [
            {
              id: '123',
              intitule: 'Generic Position',
              entreprise: { nom: 'Company' },
              description: 'Vague description',
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const jobs = await api.fetchJobs();

      expect(jobs).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No technologies detected')
      );

      consoleWarnSpy.mockRestore();
      (techDetector.detect as jest.Mock).mockReturnValue(['Python', 'Django']);
    });

    it('should handle invalid dateCreation', async () => {
      const mockResponse = {
        data: {
          resultats: [
            {
              id: '123',
              intitule: 'Developer',
              entreprise: { nom: 'Company' },
              description: 'Job with Python',
              dateCreation: 'invalid-date',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(1);
      expect(jobs[0].postedDate).toBeInstanceOf(Date);
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
              description: 'Job with Django',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(1);
      expect(jobs[0].postedDate).toBeInstanceOf(Date);
    });

    it('should filter out invalid records but keep valid ones', async () => {
      const mockResponse = {
        data: {
          resultats: [
            {
              id: '1',
              intitule: 'Developer 1',
              entreprise: { nom: 'Company' },
              description: 'Job with Python',
              dateCreation: '2024-01-15T10:00:00Z',
            },
            {
              intitule: 'Developer 2',
              entreprise: { nom: 'Company' },
              description: 'Job with Django',
            },
            {
              id: '3',
              intitule: 'Developer 3',
              entreprise: { nom: 'Company' },
              description: 'Job with Python',
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(2);
      expect(jobs[0].externalId).toBe('francetravail-1');
      expect(jobs[1].externalId).toBe('francetravail-3');
      consoleWarnSpy.mockRestore();
    });
  });

  describe('salary extraction', () => {
    it('should convert annual salary range to k€', async () => {
      const mockResponse = {
        data: {
          resultats: [
            {
              id: '200',
              intitule: 'Développeur',
              entreprise: { nom: 'Company' },
              description: 'Job with Python',
              salaire: { libelle: '40000 à 50000 Euros par an' },
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const jobs = await api.fetchJobs();

      expect(jobs[0].salaryMinKEuros).toBe(40);
      expect(jobs[0].salaryMaxKEuros).toBe(50);
    });

    it('should handle single salary value', async () => {
      const mockResponse = {
        data: {
          resultats: [
            {
              id: '201',
              intitule: 'Développeur',
              entreprise: { nom: 'Company' },
              description: 'Job with Django',
              salaire: { libelle: '45 000 € par an' },
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const jobs = await api.fetchJobs();

      expect(jobs[0].salaryMinKEuros).toBe(45);
      expect(jobs[0].salaryMaxKEuros).toBe(45);
    });

    it('should convert monthly salary to annual', async () => {
      const mockResponse = {
        data: {
          resultats: [
            {
              id: '202',
              intitule: 'Développeur',
              entreprise: { nom: 'Company' },
              description: 'Job with Python',
              salaire: { libelle: '2500 € Mensuel' },
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const jobs = await api.fetchJobs();

      expect(jobs[0].salaryMinKEuros).toBe(3);
      expect(jobs[0].salaryMaxKEuros).toBe(3);
    });

    it('should handle monthly salary with months multiplier', async () => {
      const mockResponse = {
        data: {
          resultats: [
            {
              id: '203',
              intitule: 'Développeur',
              entreprise: { nom: 'Company' },
              description: 'Job with Django',
              salaire: { libelle: '3000 € Mensuel sur 13 mois' },
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const jobs = await api.fetchJobs();

      expect(jobs[0].salaryMinKEuros).toBe(39);
      expect(jobs[0].salaryMaxKEuros).toBe(39);
    });

    it('should handle salary with decimals', async () => {
      const mockResponse = {
        data: {
          resultats: [
            {
              id: '204',
              intitule: 'Développeur',
              entreprise: { nom: 'Company' },
              description: 'Job with Python',
              salaire: { libelle: '42500.0 à 52500.0 Euros' },
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const jobs = await api.fetchJobs();

      expect(jobs[0].salaryMinKEuros).toBe(43);
      expect(jobs[0].salaryMaxKEuros).toBe(53);
    });

    it('should handle missing salary', async () => {
      const mockResponse = {
        data: {
          resultats: [
            {
              id: '205',
              intitule: 'Développeur',
              entreprise: { nom: 'Company' },
              description: 'Job with Django',
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(1);
      expect(jobs[0].salaryMinKEuros).toBeNull();
      expect(jobs[0].salaryMaxKEuros).toBeNull();
    });
  });

  describe('Accept header', () => {
    it('should include Accept header in job requests', async () => {
      mockedAxios.get.mockResolvedValue({ data: { resultats: [] } });
      await api.fetchJobs();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Accept: 'application/json' }),
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
          headers: expect.objectContaining({ Accept: 'application/json' }),
        })
      );
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit after threshold failures', async () => {
      // Use a config that reduces retries so circuit breaker can accumulate failures faster
      const config = { maxRetryAttempts: 1, circuitBreakerThreshold: 3 };
      api = new FranceTravailAPI(mockClientId, mockClientSecret, undefined, config);

      const error = { isAxiosError: true, response: { status: 500 }, message: 'error' };
      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(error);

      mockedAxios.post.mockResolvedValue({
        data: { access_token: 'mock-token', expires_in: 3600 },
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Use fake timers to speed up retry delays
      jest.useFakeTimers();

      // Trigger 3 failures sequentially to open circuit breaker
      for (let i = 0; i < 3; i++) {
        const promise = api.fetchJobs();
        await jest.runAllTimersAsync();
        await promise;
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker opened')
      );

      await api.fetchJobs();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker is open')
      );

      jest.useRealTimers();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }, 15000);

    it('should reset circuit breaker after timeout', async () => {
      const config = { circuitBreakerResetTimeMs: 100 };
      api = new FranceTravailAPI(mockClientId, mockClientSecret, undefined, config);

      const error = { isAxiosError: true, response: { status: 500 }, message: 'error' };
      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(error);

      mockedAxios.post.mockResolvedValue({
        data: { access_token: 'mock-token', expires_in: 3600 },
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Use fake timers
      jest.useFakeTimers();

      // Trigger 5 failures to open circuit breaker
      for (let i = 0; i < 5; i++) {
        const promise = api.fetchJobs();
        await jest.runAllTimersAsync();
        await promise;
      }

      // Advance time to reset the circuit breaker
      jest.advanceTimersByTime(150);

      mockedAxios.get.mockResolvedValue({ data: { resultats: [] } });
      await api.fetchJobs();

      expect(mockedAxios.get).toHaveBeenCalled();

      jest.useRealTimers();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }, 15000);

    it('should allow disabling circuit breaker', async () => {
      const config = { enableCircuitBreaker: false };
      api = new FranceTravailAPI(mockClientId, mockClientSecret, undefined, config);

      const error = { isAxiosError: true, response: { status: 500 }, message: 'error' };
      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(error);

      mockedAxios.post.mockResolvedValue({
        data: { access_token: 'mock-token', expires_in: 3600 },
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      jest.useFakeTimers();
      for (let i = 0; i < 10; i++) {
        const promise = api.fetchJobs();
        await jest.runAllTimersAsync();
        await promise;
      }

      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker opened')
      );

      jest.useRealTimers();
      consoleErrorSpy.mockRestore();
    }, 15000);
  });

  describe('configuration', () => {
    it('should use custom retry configuration', async () => {
      const config = { maxRetryAttempts: 1, retryDelayMs: 100 };
      api = new FranceTravailAPI(mockClientId, mockClientSecret, undefined, config);

      const error = { isAxiosError: true, code: 'ECONNABORTED', message: 'timeout' };
      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);

      // Mock token response
      mockedAxios.post.mockResolvedValue({
        data: { access_token: 'mock-token', expires_in: 3600 },
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Pre-fetch token by making a successful call first
      mockedAxios.get.mockResolvedValueOnce({ data: { resultats: [] } });
      await api.fetchJobs();

      // Clear mock to reset call counts
      mockedAxios.get.mockClear();

      // Now test retry with errors - both attempts will fail
      mockedAxios.get.mockRejectedValue(error);

      jest.useFakeTimers();
      const jobsPromise = api.fetchJobs();

      // Wait for initial call
      await Promise.resolve();
      await Promise.resolve();

      // Advance timers for retry delay
      jest.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();

      // Complete all remaining timers
      jest.runAllTimers();
      await jobsPromise;
      jest.useRealTimers();

      // Initial attempt + 1 retry = 2 calls
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);

      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should use custom default max results', async () => {
      const config = { defaultMaxResults: 300 };
      api = new FranceTravailAPI(mockClientId, mockClientSecret, undefined, config);

      mockedAxios.post.mockResolvedValue({
        data: { access_token: 'mock-token', expires_in: 3600 },
      });

      // Return empty results for both requests to test pagination
      mockedAxios.get
        .mockResolvedValueOnce({
          data: {
            resultats: Array(150)
              .fill(null)
              .map((_, i) => ({
                id: `job-${i}`,
                intitule: 'Dev',
                entreprise: { nom: 'Co' },
                description: 'Job with Python',
                dateCreation: '2024-01-15T10:00:00Z',
              })),
          },
        })
        .mockResolvedValueOnce({
          data: {
            resultats: Array(150)
              .fill(null)
              .map((_, i) => ({
                id: `job-${i + 150}`,
                intitule: 'Dev',
                entreprise: { nom: 'Co' },
                description: 'Job with Django',
                dateCreation: '2024-01-15T10:00:00Z',
              })),
          },
        });

      await api.fetchJobs();

      // 300 results = 2 requests (0-149, 150-299)
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined fields gracefully', async () => {
      const mockResponse = {
        data: {
          resultats: [
            {
              id: '999',
              intitule: null,
              entreprise: null,
              description: undefined,
              lieuTravail: null,
              salaire: null,
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const jobs = await api.fetchJobs();

      expect(jobs).toHaveLength(1);
      expect(jobs[0].title).toBe('Poste non spécifié');
      expect(jobs[0].company).toBe('Non spécifié');
      expect(jobs[0].location).toBe('France');
    });

    it('should handle future dates by using current date', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const mockResponse = {
        data: {
          resultats: [
            {
              id: '888',
              intitule: 'Developer',
              entreprise: { nom: 'Company' },
              description: 'Job with Python',
              dateCreation: futureDate.toISOString(),
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);
      const jobs = await api.fetchJobs();

      expect(jobs[0].postedDate.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should handle Retry-After header as seconds', async () => {
      const rateLimitError = {
        isAxiosError: true,
        response: { status: 429, headers: { 'retry-after': '2' } },
        message: '429',
      };

      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);

      mockedAxios.get.mockRejectedValueOnce(rateLimitError).mockResolvedValueOnce({
        data: {
          resultats: [
            {
              id: '1',
              intitule: 'Dev',
              entreprise: { nom: 'Co' },
              description: 'Job with Python',
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      jest.useFakeTimers();
      const jobsPromise = api.fetchJobs();
      await jest.runAllTimersAsync();
      const jobs = await jobsPromise;
      jest.useRealTimers();

      expect(jobs).toHaveLength(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'France Travail API rate limited - retrying after 2000ms (attempt 0/3)'
      );

      consoleWarnSpy.mockRestore();
    }, 10000);

    it('should handle Retry-After header as date', async () => {
      const retryDate = new Date(Date.now() + 3000);
      const rateLimitError = {
        isAxiosError: true,
        response: { status: 429, headers: { 'retry-after': retryDate.toUTCString() } },
        message: '429',
      };

      (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);

      mockedAxios.get.mockRejectedValueOnce(rateLimitError).mockResolvedValueOnce({
        data: {
          resultats: [
            {
              id: '1',
              intitule: 'Dev',
              entreprise: { nom: 'Co' },
              description: 'Job with Django',
              dateCreation: '2024-01-15T10:00:00Z',
            },
          ],
        },
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      jest.useFakeTimers();
      const jobsPromise = api.fetchJobs();
      await jest.runAllTimersAsync();
      const jobs = await jobsPromise;
      jest.useRealTimers();

      expect(jobs).toHaveLength(1);
      consoleWarnSpy.mockRestore();
    }, 10000);
  });

  describe('getSourceName', () => {
    it('should return correct source name', () => {
      expect(api.getSourceName()).toBe('france_travail');
    });
  });
});
