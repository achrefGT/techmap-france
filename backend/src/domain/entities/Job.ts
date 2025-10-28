export class Job {
  constructor(
    public id: string,
    public title: string,
    public company: string,
    public description: string,
    public technologies: string[],
    public location: string,
    public regionId: number | null,
    public isRemote: boolean,
    public salaryMin: number | null,
    public salaryMax: number | null,
    public experienceLevel: string | null,
    public sourceApi: string,
    public sourceUrl: string,
    public postedDate: Date,
    public isActive: boolean = true
  ) {}

  isRecent(days: number = 7): boolean {
    const daysSincePosted = (Date.now() - this.postedDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSincePosted <= days;
  }

  hasTechnology(tech: string): boolean {
    return this.technologies.some(t => t.toLowerCase() === tech.toLowerCase());
  }

  getSalaryRange(): string {
    if (!this.salaryMin && !this.salaryMax) return 'Not specified';
    if (!this.salaryMax) return `${this.salaryMin}k+`;
    if (!this.salaryMin) return `Up to ${this.salaryMax}k`;
    return `${this.salaryMin}k - ${this.salaryMax}k`;
  }
}