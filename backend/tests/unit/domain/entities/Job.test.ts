import { describe, it, expect, beforeEach } from '@jest/globals';
import { Job } from '../../../../src/domain/entities/Job';
import { DomainError } from '../../../../src/domain/errors/DomainErrors';

describe('Job Entity', () => {
  const createJob = (overrides: Partial<any> = {}) => {
    const defaults = {
      id: '1',
      title: 'React Developer',
      company: 'TechCorp',
      description: 'Build React apps',
      technologies: ['React', 'TypeScript'],
      location: 'Paris',
      regionId: 11,
      isRemote: false,
      salaryMinKEuros: 50,
      salaryMaxKEuros: 70,
      experienceLevel: 'Mid',
      experienceCategory: 'mid' as const,
      sourceApi: 'linkedin',
      externalId: 'ext-123',
      sourceUrl: 'https://linkedin.com/jobs/1',
      postedDate: new Date('2024-10-20'),
      isActive: true,
    };

    const data = { ...defaults, ...overrides };

    return new Job(
      data.id,
      data.title,
      data.company,
      data.description,
      data.technologies,
      data.location,
      data.regionId,
      data.isRemote,
      data.salaryMinKEuros,
      data.salaryMaxKEuros,
      data.experienceLevel,
      data.experienceCategory,
      data.sourceApi,
      data.externalId,
      data.sourceUrl,
      data.postedDate,
      data.isActive
    );
  };

  describe('Constructor and Validation', () => {
    it('should create a job with all properties', () => {
      const job = createJob();

      expect(job.id).toBe('1');
      expect(job.title).toBe('React Developer');
      expect(job.company).toBe('TechCorp');
      expect(job.technologies).toEqual(['React', 'TypeScript']);
      expect(job.location).toBe('Paris');
      expect(job.isActive).toBe(true);
      expect(job.experienceCategory).toBe('mid');
    });

    it('should ensure sourceApis includes primary sourceApi', () => {
      const job = createJob();
      expect(job.sourceApis).toContain('linkedin');
    });

    it('should throw error when title is empty', () => {
      expect(() => {
        createJob({ title: '' });
      }).toThrow(DomainError);
    });

    it('should throw error when title is too long', () => {
      expect(() => {
        createJob({ title: 'a'.repeat(201) });
      }).toThrow(DomainError);
    });

    it('should throw error when technologies array is empty', () => {
      expect(() => {
        createJob({ technologies: [] });
      }).toThrow(DomainError);
    });

    it('should throw error when posted date is in future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      expect(() => {
        createJob({ postedDate: futureDate });
      }).toThrow(DomainError);
    });

    it('should throw error when salary min > max', () => {
      expect(() => {
        createJob({ salaryMinKEuros: 80, salaryMaxKEuros: 60 });
      }).toThrow(DomainError);
    });
  });

  describe('Salary Methods', () => {
    it('should calculate salary midpoint correctly', () => {
      const job = createJob();
      expect(job.getSalaryMidpoint()).toBe(60);
    });

    it('should return null for midpoint when salary data missing', () => {
      const job = createJob({ salaryMinKEuros: null, salaryMaxKEuros: null });
      expect(job.getSalaryMidpoint()).toBeNull();
    });

    it('should detect competitive salary', () => {
      const job = createJob({ salaryMinKEuros: 60, salaryMaxKEuros: 80 });
      expect(job.hasCompetitiveSalary()).toBe(true);
    });
  });

  describe('Location Formatting', () => {
    it('should return "Remote" for remote jobs', () => {
      const job = createJob({ isRemote: true });
      expect(job.formatLocation()).toBe('Remote');
    });

    it('should return location for non-remote jobs', () => {
      const job = createJob();
      expect(job.formatLocation()).toBe('Paris');
    });
  });

  describe('Date-based Methods', () => {
    it('should identify recent jobs', () => {
      const recentJob = createJob({ postedDate: new Date() });
      expect(recentJob.isRecent(7)).toBe(true);
    });

    it('should identify old jobs as not recent', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      const oldJob = createJob({ postedDate: oldDate });
      expect(oldJob.isRecent(7)).toBe(false);
    });

    it('should identify expired jobs', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const expiredJob = createJob({ postedDate: oldDate });
      expect(expiredJob.isExpired(90)).toBe(true);
    });

    it('should calculate age in days', () => {
      const job = createJob({ postedDate: new Date() });
      expect(job.getAgeDays()).toBeLessThan(1);
    });
  });

  describe('Technology Methods', () => {
    let job: Job;

    beforeEach(() => {
      job = createJob();
    });

    it('should detect if technology is required (case-insensitive)', () => {
      expect(job.requiresTechnology('react')).toBe(true);
      expect(job.requiresTechnology('REACT')).toBe(true);
      expect(job.requiresTechnology('TypeScript')).toBe(true);
    });

    it('should return false for non-existent technology', () => {
      expect(job.requiresTechnology('Python')).toBe(false);
    });

    it('should match technology stack', () => {
      expect(job.matchesStack(['React', 'TypeScript'])).toBe(true);
      expect(job.matchesStack(['React'])).toBe(true);
    });

    it('should not match incomplete stack', () => {
      expect(job.matchesStack(['React', 'TypeScript', 'Python'])).toBe(false);
    });

    it('should get primary technology', () => {
      expect(job.getPrimaryTechnology()).toBe('React');
    });

    it('should return null for primary technology when empty', () => {
      const noTechJob = createJob({ technologies: ['placeholder'] });
      noTechJob.technologies = [];
      expect(noTechJob.getPrimaryTechnology()).toBeNull();
    });
  });

  describe('Quality Score Calculation', () => {
    it('should calculate quality score with all features', () => {
      const job = createJob();
      const score = job.calculateQualityScore();
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should have higher score with more complete data', () => {
      const basicJob = createJob({
        salaryMinKEuros: null,
        salaryMaxKEuros: null,
        experienceLevel: null,
        description: 'Short',
      });

      const completeJob = createJob();

      expect(completeJob.calculateQualityScore()).toBeGreaterThan(basicJob.calculateQualityScore());
    });

    it('should determine if job meets quality standards', () => {
      const job = createJob();
      expect(job.meetsQualityStandards()).toBe(true);
    });
  });

  describe('Experience Level Methods', () => {
    it('should get experience category', () => {
      const job = createJob();
      expect(job.getExperienceCategory()).toBe('mid');
    });

    it('should identify senior level jobs', () => {
      const seniorJob = createJob({ experienceCategory: 'senior' });
      expect(seniorJob.isSeniorLevel()).toBe(true);
    });

    it('should identify entry level jobs', () => {
      const juniorJob = createJob({ experienceCategory: 'junior' });
      expect(juniorJob.isEntryLevel()).toBe(true);
    });

    it('should check if salary matches experience', () => {
      const job = createJob();
      expect(typeof job.hasSalaryMatchingExperience()).toBe('boolean');
    });

    it('should check for above average salary', () => {
      const highPaidJob = createJob({
        salaryMinKEuros: 90,
        salaryMaxKEuros: 110,
      });
      expect(typeof highPaidJob.hasAboveAverageSalary()).toBe('boolean');
    });
  });

  describe('State Transitions', () => {
    let job: Job;

    beforeEach(() => {
      job = createJob();
    });

    it('should deactivate job', () => {
      job.deactivate();
      expect(job.isActive).toBe(false);
    });

    it('should reactivate recent job', () => {
      // Create a recent job (within expiration period)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10); // 10 days old

      const recentJob = createJob({ postedDate: recentDate });
      recentJob.deactivate();
      recentJob.reactivate();

      expect(recentJob.isActive).toBe(true);
    });

    it('should throw error when reactivating expired job', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const expiredJob = createJob({ postedDate: oldDate });
      expiredJob.deactivate();

      expect(() => expiredJob.reactivate()).toThrow(DomainError);
    });
  });

  describe('Merge Functionality', () => {
    let job1: Job;
    let job2: Job;

    beforeEach(() => {
      job1 = createJob();
      job2 = createJob({
        id: '2',
        sourceApi: 'indeed',
        externalId: 'ext-456',
        salaryMinKEuros: 55,
        salaryMaxKEuros: 75,
        description: 'Much longer and more detailed description',
        technologies: ['React', 'Node.js'],
      });
    });

    it('should merge source APIs', () => {
      job1.mergeFrom(job2);
      expect(job1.sourceApis).toContain('linkedin');
      expect(job1.sourceApis).toContain('indeed');
    });

    it('should merge salary data when missing', () => {
      const noSalaryJob = createJob({
        salaryMinKEuros: null,
        salaryMaxKEuros: null,
      });

      noSalaryJob.mergeFrom(job2);
      expect(noSalaryJob.salaryMinKEuros).toBe(55);
      expect(noSalaryJob.salaryMaxKEuros).toBe(75);
    });

    it('should use longer description', () => {
      job1.mergeFrom(job2);
      expect(job1.description).toBe('Much longer and more detailed description');
    });

    it('should merge technologies', () => {
      job1.mergeFrom(job2);
      expect(job1.technologies).toContain('react');
      expect(job1.technologies).toContain('typescript');
      expect(job1.technologies).toContain('node.js');
    });
  });

  describe('Deduplication Keys', () => {
    let job: Job;

    beforeEach(() => {
      job = createJob();
    });

    it('should generate deduplication key', () => {
      expect(job.getDeduplicationKey()).toBe('linkedin:ext-123');
    });

    it('should generate fuzzy deduplication key', () => {
      const key = job.getFuzzyDeduplicationKey();
      expect(key).toContain('techcorp');
      expect(key).toContain('react');
      expect(key).toContain('developer');
    });

    it('should normalize accents in fuzzy key', () => {
      const frenchJob = createJob({
        title: 'Développeur',
        company: 'Société',
      });

      const key = frenchJob.getFuzzyDeduplicationKey();
      expect(key).not.toContain('é');
    });
  });

  describe('Source Tracking', () => {
    it('should identify if job is from specific source', () => {
      const job = createJob();
      expect(job.isFromSource('linkedin')).toBe(true);
      expect(job.isFromSource('indeed')).toBe(false);
    });
  });

  describe('toDTO Method', () => {
    it('should return complete DTO with all fields', () => {
      const job = createJob();
      const dto = job.toDTO();

      expect(dto.id).toBe('1');
      expect(dto.title).toBe('React Developer');
      expect(dto.company).toBe('TechCorp');
      expect(dto.salary).toBeDefined();
      expect(dto.salary?.min).toBe(50);
      expect(dto.salary?.max).toBe(70);
      expect(dto.salary?.currency).toBe('EUR');
      expect(dto.experienceCategory).toBe('mid');
      expect(dto.qualityScore).toBeDefined();
      expect(dto.isRecent).toBeDefined();
      expect(dto.isExpired).toBeDefined();
    });

    it('should return null salary when not specified', () => {
      const job = createJob({
        salaryMinKEuros: null,
        salaryMaxKEuros: null,
      });
      const dto = job.toDTO();

      expect(dto.salary).toBeNull();
    });
  });
});
