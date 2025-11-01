import { VALID_REGION_CODES } from '../constants/RegionCodes';
import { DomainError, DomainErrorCode } from '../errors/DomainErrors';

export class Region {
  constructor(
    public readonly id: number,
    public name: string,
    public code: string,
    public fullName: string,
    public jobCount: number = 0,
    public population: number | null = null
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new DomainError(DomainErrorCode.REGION_CODE_INVALID, {
        field: 'name',
      });
    }

    if (!VALID_REGION_CODES.has(this.code)) {
      throw new DomainError(DomainErrorCode.REGION_CODE_INVALID, {
        code: this.code,
        validCodes: Array.from(VALID_REGION_CODES),
      });
    }
  }

  getJobDensity(): number | null {
    if (!this.population || this.population === 0) return null;
    return (this.jobCount / this.population) * 100000;
  }

  getRegionType(): 'major' | 'significant' | 'emerging' | 'small' {
    if (this.jobCount > 1000) return 'major';
    if (this.jobCount > 300) return 'significant';
    if (this.jobCount > 50) return 'emerging';
    return 'small';
  }

  isTechHub(): boolean {
    const jobDensity = this.getJobDensity();
    return jobDensity !== null && jobDensity > 50;
  }
}
