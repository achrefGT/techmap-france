import { Job } from './Job'

describe('Job Entity', () => {
  let job: Job

  beforeEach(() => {
    job = new Job(
      '1',
      'React Developer',
      'TechCorp',
      'Build React apps',
      ['React', 'TypeScript'],
      'Paris',
      11,
      false,
      50,
      70,
      'Mid',
      'linkedin',
      'https://linkedin.com/jobs/1',
      new Date('2024-10-20'),
      true
    )
  })

  describe('Constructor', () => {
    it('should create a job with all properties', () => {
      expect(job.id).toBe('1')
      expect(job.title).toBe('React Developer')
      expect(job.company).toBe('TechCorp')
      expect(job.technologies).toEqual(['React', 'TypeScript'])
      expect(job.location).toBe('Paris')
      expect(job.isActive).toBe(true)
    })
  })

  describe('isRecent()', () => {
    it('should return true for recent jobs', () => {
      const recentJob = new Job(
        '2',
        'Dev',
        'Company',
        'Description',
        [],
        'Paris',
        11,
        false,
        null,
        null,
        null,
        'api',
        'url',
        new Date(), // Today
        true
      )

      expect(recentJob.isRecent(7)).toBe(true)
    })

    it('should return false for old jobs', () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 10)

      const oldJob = new Job(
        '3',
        'Dev',
        'Company',
        'Description',
        [],
        'Paris',
        11,
        false,
        null,
        null,
        null,
        'api',
        'url',
        oldDate,
        true
      )

      expect(oldJob.isRecent(7)).toBe(false)
    })
  })

  describe('hasTechnology()', () => {
    it('should return true when technology exists (case-insensitive)', () => {
      expect(job.hasTechnology('react')).toBe(true)
      expect(job.hasTechnology('REACT')).toBe(true)
      expect(job.hasTechnology('TypeScript')).toBe(true)
    })

    it('should return false when technology does not exist', () => {
      expect(job.hasTechnology('Python')).toBe(false)
      expect(job.hasTechnology('Java')).toBe(false)
    })
  })

  describe('getSalaryRange()', () => {
    it('should return formatted range when both min and max provided', () => {
      expect(job.getSalaryRange()).toBe('50k - 70k')
    })

    it('should return "min+" when only min provided', () => {
      const jobMinOnly = new Job(
        '4',
        'Dev',
        'Company',
        'Description',
        [],
        'Paris',
        11,
        false,
        45,
        null,
        null,
        'api',
        'url',
        new Date(),
        true
      )

      expect(jobMinOnly.getSalaryRange()).toBe('45k+')
    })

    it('should return "Up to max" when only max provided', () => {
      const jobMaxOnly = new Job(
        '5',
        'Dev',
        'Company',
        'Description',
        [],
        'Paris',
        11,
        false,
        null,
        60,
        null,
        'api',
        'url',
        new Date(),
        true
      )

      expect(jobMaxOnly.getSalaryRange()).toBe('Up to 60k')
    })

    it('should return "Not specified" when neither provided', () => {
      const jobNoSalary = new Job(
        '6',
        'Dev',
        'Company',
        'Description',
        [],
        'Paris',
        11,
        false,
        null,
        null,
        null,
        'api',
        'url',
        new Date(),
        true
      )

      expect(jobNoSalary.getSalaryRange()).toBe('Not specified')
    })
  })
})