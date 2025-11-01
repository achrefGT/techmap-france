import { TECHNOLOGY_CATEGORIES, TechnologyCategory } from '../constants/TechnologyCategories';
import { DomainError, DomainErrorCode } from '../errors/DomainErrors';

export class Technology {
  constructor(
    public id: number | null, // null for new technologies (ID assigned by repo)
    public name: string,
    public category: TechnologyCategory,
    public displayName: string,
    public jobCount: number = 0
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new DomainError(DomainErrorCode.TECHNOLOGY_NAME_REQUIRED);
    }

    if (!TECHNOLOGY_CATEGORIES.includes(this.category)) {
      throw new DomainError(DomainErrorCode.TECHNOLOGY_INVALID_CATEGORY, {
        category: this.category,
        validCategories: TECHNOLOGY_CATEGORIES,
      });
    }
  }

  // Factory method for new technologies
  static create(name: string, category: TechnologyCategory, displayName?: string): Technology {
    return new Technology(
      null, // ID will be assigned by repository
      name,
      category,
      displayName || name,
      0
    );
  }

  // Business logic: Popularity
  getPopularityLevel(): 'trending' | 'popular' | 'common' | 'niche' {
    if (this.jobCount > 500) return 'trending';
    if (this.jobCount > 200) return 'popular';
    if (this.jobCount > 50) return 'common';
    return 'niche';
  }

  isInDemand(): boolean {
    return this.jobCount > 100;
  }
}
