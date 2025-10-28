export class Technology {
  constructor(
    public id: number,
    public name: string,
    public category: string,
    public displayName: string,
    public jobCount: number = 0
  ) {}

  isPopular(): boolean {
    return this.jobCount > 100;
  }
}