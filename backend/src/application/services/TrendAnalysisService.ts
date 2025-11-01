import { IStatsRepository } from '../../domain/repositories/IStatsRepository';

export interface TechnologyTrend {
  technologyId: number;
  technologyName?: string;
  currentCount: number;
  previousCount: number;
  growthRate: number;
  growthPercentage: number;
}

export class TrendAnalysisService {
  constructor(private statsRepository: IStatsRepository) {}

  async getRisingTechnologies(days: number = 7): Promise<TechnologyTrend[]> {
    const now = new Date();
    const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000);

    const currentPeriod = await this.statsRepository.getStatsForPeriod(currentStart, now);
    const previousPeriod = await this.statsRepository.getStatsForPeriod(
      previousStart,
      currentStart
    );

    const trends = this.calculateGrowthRates(currentPeriod, previousPeriod);

    // Rising: >10% growth AND >5 absolute jobs AND meaningful volume
    return trends.filter(t => t.growthPercentage > 10 && t.growthRate > 5 && t.currentCount > 10);
  }

  // Fixed: Proper growth rate calculation with zero handling
  private calculateGrowthRates(
    current: Map<number, number>,
    previous: Map<number, number>
  ): TechnologyTrend[] {
    const trends: TechnologyTrend[] = [];

    for (const [techId, currentCount] of current.entries()) {
      const previousCount = previous.get(techId) || 0;
      const growthRate = currentCount - previousCount;

      let growthPercentage: number;
      if (previousCount === 0) {
        // New technology: use 100% if has meaningful volume
        growthPercentage = currentCount > 5 ? 100 : 0;
      } else {
        growthPercentage = (growthRate / previousCount) * 100;
      }

      trends.push({
        technologyId: techId,
        currentCount,
        previousCount,
        growthRate,
        growthPercentage,
      });
    }

    return trends.sort((a, b) => b.growthPercentage - a.growthPercentage);
  }

  // Fixed: Proper compounding prediction
  async predictDemand(techId: number, months: number): Promise<number> {
    const history = await this.statsRepository.getHistoricalData(techId, 6);

    if (history.length < 2) {
      return history[history.length - 1] || 0;
    }

    const monthlyGrowthRate = this.calculateMonthlyGrowthRate(history);
    const currentDemand = history[history.length - 1];

    // Compound growth: demand * (1 + rate)^months
    return Math.round(currentDemand * Math.pow(1 + monthlyGrowthRate, months));
  }

  // Fixed: Proper monthly growth calculation with zero handling
  private calculateMonthlyGrowthRate(data: number[]): number {
    if (data.length < 2) return 0;

    const validGrowthRates: number[] = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i - 1] > 0) {
        // Guard against division by zero
        const growth = (data[i] - data[i - 1]) / data[i - 1];
        validGrowthRates.push(growth);
      }
    }

    if (validGrowthRates.length === 0) return 0;

    const avgGrowth = validGrowthRates.reduce((a, b) => a + b, 0) / validGrowthRates.length;
    return avgGrowth;
  }
}
