export interface DailyStatData {
  regionId: number;
  technologyId: number;
  jobCount: number;
  avgSalary: number | null;
  remotePercentage: number;
}

export interface IStatsRepository {
  aggregateJobData(): Promise<DailyStatData[]>;
  saveDailyStats(date: Date, stats: DailyStatData[]): Promise<void>;
  getStatsForPeriod(startDate: Date, endDate: Date): Promise<Map<number, number>>;
  getHistoricalData(techId: number, months: number): Promise<number[]>;
}
