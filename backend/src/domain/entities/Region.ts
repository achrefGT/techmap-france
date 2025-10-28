export class Region {
  constructor(
    public id: number,
    public name: string,
    public code: string,
    public fullName: string,
    public jobCount: number = 0
  ) {}
}
