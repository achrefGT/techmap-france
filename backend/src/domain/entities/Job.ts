import { JOB_CONFIG, ExperienceLevel } from '../constants/JobConfig';
import { DomainError, DomainErrorCode } from '../errors/DomainErrors';

/**
 * Job Entity
 * IMPORTANT: Salaries are stored in k€ (thousands of euros)
 * UPDATED: Experience category is now set during construction (detected by infrastructure)
 */
export class Job {
  constructor(
    public readonly id: string,
    public title: string,
    public company: string,
    public description: string,
    public technologies: string[],
    public location: string,
    public regionId: number | null,
    public isRemote: boolean,
    public salaryMinKEuros: number | null,
    public salaryMaxKEuros: number | null,
    public experienceLevel: string | null,
    public readonly experienceCategory: ExperienceLevel, // ← NEW: Detected by infrastructure
    public sourceApi: string,
    public externalId: string,
    public sourceUrl: string,
    public postedDate: Date,
    public isActive: boolean = true,
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public sourceApis: string[] = []
  ) {
    // Ensure sourceApis includes the primary sourceApi
    if (!this.sourceApis.includes(this.sourceApi)) {
      this.sourceApis = [this.sourceApi, ...this.sourceApis];
    }
    this.validate();
  }

  private validate(): void {
    // Title validation
    if (!this.title || this.title.trim().length === 0) {
      throw new DomainError(DomainErrorCode.JOB_TITLE_REQUIRED);
    }

    if (this.title.length > JOB_CONFIG.MAX_TITLE_LENGTH) {
      throw new DomainError(DomainErrorCode.JOB_TITLE_TOO_LONG, {
        length: this.title.length,
        max: JOB_CONFIG.MAX_TITLE_LENGTH,
      });
    }

    // Technology validation
    if (this.technologies.length < JOB_CONFIG.TECHNOLOGIES.MIN_COUNT) {
      throw new DomainError(DomainErrorCode.JOB_NO_TECHNOLOGIES);
    }

    if (this.technologies.length > JOB_CONFIG.TECHNOLOGIES.MAX_COUNT) {
      throw new DomainError(DomainErrorCode.JOB_NO_TECHNOLOGIES, {
        count: this.technologies.length,
        max: JOB_CONFIG.TECHNOLOGIES.MAX_COUNT,
      });
    }

    // Validate each technology name
    this.technologies.forEach(tech => {
      if (tech.length > JOB_CONFIG.TECHNOLOGIES.MAX_TECH_NAME_LENGTH) {
        throw new DomainError(DomainErrorCode.JOB_TECH_NAME_TOO_LONG, {
          tech,
          length: tech.length,
          max: JOB_CONFIG.TECHNOLOGIES.MAX_TECH_NAME_LENGTH,
        });
      }
    });

    // Description validation
    if (this.description && this.description.length > JOB_CONFIG.MAX_DESCRIPTION_LENGTH) {
      throw new DomainError(DomainErrorCode.JOB_DESCRIPTION_TOO_LONG, {
        length: this.description.length,
        max: JOB_CONFIG.MAX_DESCRIPTION_LENGTH,
      });
    }

    // Date validation
    if (this.postedDate > new Date()) {
      throw new DomainError(DomainErrorCode.JOB_FUTURE_DATE);
    }

    // Salary validation
    if (this.salaryMinKEuros && this.salaryMaxKEuros) {
      if (this.salaryMinKEuros > this.salaryMaxKEuros) {
        throw new DomainError(DomainErrorCode.SALARY_INVALID_RANGE, {
          min: this.salaryMinKEuros,
          max: this.salaryMaxKEuros,
        });
      }
    }
  }

  getSalaryMidpoint(): number | null {
    if (!this.salaryMinKEuros || !this.salaryMaxKEuros) return null;
    return (this.salaryMinKEuros + this.salaryMaxKEuros) / 2;
  }

  hasCompetitiveSalary(): boolean {
    const midpoint = this.getSalaryMidpoint();
    return midpoint !== null && midpoint >= JOB_CONFIG.MID_SALARY_THRESHOLD;
  }

  formatLocation(): string {
    return this.isRemote ? 'Remote' : this.location;
  }

  // Business logic: Job freshness
  isRecent(days: number = JOB_CONFIG.RECENT_DAYS_THRESHOLD): boolean {
    const daysSincePosted = (Date.now() - this.postedDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSincePosted <= days;
  }

  // Business logic: Job expiration
  isExpired(expirationDays: number = JOB_CONFIG.EXPIRATION_DAYS): boolean {
    const daysSincePosted = (Date.now() - this.postedDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSincePosted > expirationDays;
  }

  // Business logic: Technology matching
  requiresTechnology(techName: string): boolean {
    return this.technologies.some(t => t.toLowerCase().trim() === techName.toLowerCase().trim());
  }

  matchesStack(requiredTechnologies: string[]): boolean {
    return requiredTechnologies.every(required =>
      this.technologies.some(tech => tech.toLowerCase().trim() === required.toLowerCase().trim())
    );
  }

  // Business logic: Quality score calculation
  calculateQualityScore(): number {
    let score = 0;
    const weights = JOB_CONFIG.QUALITY_WEIGHTS;

    if (this.salaryMinKEuros || this.salaryMaxKEuros) {
      score += weights.HAS_SALARY;
    }

    if (this.regionId) {
      score += weights.HAS_REGION;
    }

    if (this.description && this.description.length > JOB_CONFIG.MIN_DESCRIPTION_LENGTH) {
      score += weights.HAS_DESCRIPTION;
    }

    if (this.technologies.length >= 3) {
      score += weights.HAS_MULTIPLE_TECHS;
    }

    if (this.experienceLevel) {
      score += weights.HAS_EXPERIENCE_LEVEL;
    }

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Business logic: Experience category getter
   * UPDATED: Now simply returns the pre-detected category (detected by infrastructure during construction)
   */
  getExperienceCategory(): ExperienceLevel {
    return this.experienceCategory;
  }

  /**
   * Business logic: Check if job is senior level or above
   */
  isSeniorLevel(): boolean {
    return ['senior', 'lead'].includes(this.experienceCategory);
  }

  /**
   * Business logic: Check if job is entry level
   */
  isEntryLevel(): boolean {
    return this.experienceCategory === 'junior';
  }

  /**
   * Business logic: Check if salary matches typical range for experience level
   */
  hasSalaryMatchingExperience(): boolean {
    const midpoint = this.getSalaryMidpoint();
    if (!midpoint) return false;

    const typical = JOB_CONFIG.EXPERIENCE.TYPICAL_SALARY_RANGES[this.experienceCategory];
    if (!typical.min || !typical.max) return true; // Unknown level

    return midpoint >= typical.min && midpoint <= typical.max;
  }

  /**
   * Business logic: Check if salary is above typical for experience level
   */
  hasAboveAverageSalary(): boolean {
    const midpoint = this.getSalaryMidpoint();
    if (!midpoint) return false;

    const typical = JOB_CONFIG.EXPERIENCE.TYPICAL_SALARY_RANGES[this.experienceCategory];
    if (!typical.max) return false;

    return midpoint > typical.max;
  }

  // State transitions
  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  reactivate(): void {
    if (this.isExpired()) {
      throw new DomainError(DomainErrorCode.JOB_EXPIRED);
    }
    this.isActive = true;
    this.updatedAt = new Date();
  }

  // Merge data from another source
  mergeFrom(other: Job): void {
    this.updatedAt = new Date();

    // Add source API if not already tracked
    if (!this.sourceApis.includes(other.sourceApi)) {
      this.sourceApis.push(other.sourceApi);
    }

    // Enrich missing data (prefer most complete information)
    if (!this.salaryMinKEuros && other.salaryMinKEuros) {
      this.salaryMinKEuros = other.salaryMinKEuros;
    }
    if (!this.salaryMaxKEuros && other.salaryMaxKEuros) {
      this.salaryMaxKEuros = other.salaryMaxKEuros;
    }

    // Take better salary range if available
    if (other.salaryMinKEuros && other.salaryMaxKEuros) {
      if (!this.salaryMinKEuros || !this.salaryMaxKEuros) {
        this.salaryMinKEuros = other.salaryMinKEuros;
        this.salaryMaxKEuros = other.salaryMaxKEuros;
      }
    }

    if (!this.regionId && other.regionId) {
      this.regionId = other.regionId;
    }

    if (!this.experienceLevel && other.experienceLevel) {
      this.experienceLevel = other.experienceLevel;
    }

    // Use longer description (more detailed)
    if (other.description.length > this.description.length) {
      this.description = other.description;
    }

    // Merge technologies (union of both, deduplicated)
    const techSet = new Set([
      ...this.technologies.map(t => t.toLowerCase().trim()),
      ...other.technologies.map(t => t.toLowerCase().trim()),
    ]);
    this.technologies = Array.from(techSet).slice(0, JOB_CONFIG.TECHNOLOGIES.MAX_COUNT);

    // Keep most recent posted date
    if (other.postedDate > this.postedDate) {
      this.postedDate = other.postedDate;
    }

    // If other job has a better source URL, update it
    if (!this.sourceUrl || (other.sourceUrl && other.sourceUrl.length > this.sourceUrl.length)) {
      this.sourceUrl = other.sourceUrl;
    }
  }

  // Generate unique deduplication key (source-specific)
  getDeduplicationKey(): string {
    return `${this.sourceApi}:${this.externalId}`;
  }

  // Generate fuzzy deduplication key for cross-API matching
  getFuzzyDeduplicationKey(): string {
    const normalize = (str: string) =>
      str
        .toLowerCase()
        .normalize('NFD') // Normalize accents
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^\w\s]/g, '') // Remove special chars
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

    const titleNorm = normalize(this.title);
    const companyNorm = normalize(this.company);

    return `${companyNorm}:${titleNorm}`;
  }

  // Check if job meets minimum quality standards
  meetsQualityStandards(): boolean {
    return this.calculateQualityScore() >= JOB_CONFIG.MIN_QUALITY_SCORE;
  }

  // Get age in days
  getAgeDays(): number {
    return (Date.now() - this.postedDate.getTime()) / (1000 * 60 * 60 * 24);
  }

  // Check if job is from a specific source
  isFromSource(source: string): boolean {
    return this.sourceApis.includes(source);
  }

  // Get primary technology (first in list)
  getPrimaryTechnology(): string | null {
    return this.technologies.length > 0 ? this.technologies[0] : null;
  }
}
