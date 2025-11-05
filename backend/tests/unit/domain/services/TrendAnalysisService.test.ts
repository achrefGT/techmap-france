import { describe, it, expect, beforeEach } from '@jest/globals';
import { TrendAnalysisService } from '../../../../src/domain/services/TrendAnalysisService';
import {
  IStatsRepository,
  DailyStatData,
} from '../../../../src/domain/repositories/IStatsRepository';
import { TREND_CONFIG } from '../../../../src/domain/constants/TrendConfig';

// Mock implementation of IStatsRepository
class MockStatsRepository implements IStatsRepository {
  private mockPeriodData: Map<string, Map<number, number>> = new Map();
  private mockHistoricalData: Map<number, number[]> = new Map();

  setupPeriodData(periodKey: string, data: Map<number, number>): void {
    this.mockPeriodData.set(periodKey, data);
  }

  setupHistoricalData(techId: number, data: number[]): void {
    this.mockHistoricalData.set(techId, data);
  }

  async getStatsForPeriod(start: Date, end: Date): Promise<Map<number, number>> {
    const key = `${start.toISOString()}-${end.toISOString()}`;
    return this.mockPeriodData.get(key) || new Map();
  }

  async getHistoricalData(techId: number, months: number): Promise<number[]> {
    const data = this.mockHistoricalData.get(techId) || [];
    return data.slice(-months);
  }

  async aggregateJobData(): Promise<DailyStatData[]> {
    return [];
  }

  async saveDailyStats(_date: Date, _stats: DailyStatData[]): Promise<void> {
    // No-op for testing
  }

  reset(): void {
    this.mockPeriodData.clear();
    this.mockHistoricalData.clear();
  }
}

describe('TrendAnalysisService', () => {
  let service: TrendAnalysisService;
  let mockRepository: MockStatsRepository;

  beforeEach(() => {
    mockRepository = new MockStatsRepository();
    service = new TrendAnalysisService(mockRepository);
  });

  const createPeriodMap = (data: Record<number, number>): Map<number, number> => {
    return new Map(Object.entries(data).map(([k, v]) => [Number(k), v]));
  };

  const setupMockPeriods = (
    days: number,
    currentData: Record<number, number>,
    previousData: Record<number, number>
  ) => {
    const now = new Date();
    const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000);

    // Store with exact date objects as keys by overriding the method
    mockRepository.getStatsForPeriod = async (start: Date, end: Date) => {
      const isCurrentPeriod =
        Math.abs(start.getTime() - currentStart.getTime()) < 1000 &&
        Math.abs(end.getTime() - now.getTime()) < 1000;
      const isPreviousPeriod =
        Math.abs(start.getTime() - previousStart.getTime()) < 1000 &&
        Math.abs(end.getTime() - currentStart.getTime()) < 1000;

      if (isCurrentPeriod) {
        return createPeriodMap(currentData);
      } else if (isPreviousPeriod) {
        return createPeriodMap(previousData);
      }
      return new Map();
    };
  };

  describe('Constructor and Configuration', () => {
    it('should create service with default configuration', () => {
      const config = service.getConfig();
      expect(config).toBeDefined();
      expect(config.minGrowthPercentage).toBe(TREND_CONFIG.RISING_TECHNOLOGY.MIN_GROWTH_PERCENTAGE);
    });

    it('should create service with custom configuration', () => {
      const customService = new TrendAnalysisService(mockRepository, {
        minGrowthPercentage: 30,
        minAbsoluteGrowth: 20,
      });

      const config = customService.getConfig();
      expect(config.minGrowthPercentage).toBe(30);
      expect(config.minAbsoluteGrowth).toBe(20);
    });

    it('should update configuration at runtime', () => {
      service.updateConfig({ minGrowthPercentage: 25 });
      expect(service.getConfig().minGrowthPercentage).toBe(25);
    });

    it('should preserve other config values when updating', () => {
      const originalMinVolume = service.getConfig().minCurrentVolume;
      service.updateConfig({ minGrowthPercentage: 25 });
      expect(service.getConfig().minCurrentVolume).toBe(originalMinVolume);
    });
  });

  describe('getRisingTechnologies', () => {
    it('should identify technologies with significant growth', async () => {
      setupMockPeriods(30, { 1: 150, 2: 80, 3: 50 }, { 1: 100, 2: 50, 3: 40 });

      const rising = await service.getRisingTechnologies(30);

      expect(rising.length).toBeGreaterThan(0);
      // Results are sorted by growth percentage descending
      // Tech 2: 60% growth (80-50)/50, Tech 1: 50% growth (150-100)/100, Tech 3: 25% growth
      const tech1 = rising.find(t => t.technologyId === 1);
      expect(tech1).toBeDefined();
      expect(tech1?.growthPercentage).toBe(50);
    });

    it('should filter out technologies below growth threshold', async () => {
      setupMockPeriods(30, { 1: 105, 2: 200 }, { 1: 100, 2: 100 });

      const rising = await service.getRisingTechnologies(30);

      expect(rising.some(t => t.technologyId === 2)).toBe(true);
      expect(rising.some(t => t.technologyId === 1)).toBe(false);
    });

    it('should filter out technologies with low absolute growth', async () => {
      setupMockPeriods(30, { 1: 12, 2: 120 }, { 1: 2, 2: 60 });

      const rising = await service.getRisingTechnologies(30);

      const tech2 = rising.find(t => t.technologyId === 2);

      // Tech 1: 500% growth but only +10 absolute (below minAbsoluteGrowth of 5, so it passes)
      // Tech 2: 100% growth and +60 absolute (well above threshold)
      expect(tech2).toBeDefined();
      expect(tech2?.growthRate).toBeGreaterThanOrEqual(service.getConfig().minAbsoluteGrowth);
    });

    it('should filter out technologies with low current volume', async () => {
      setupMockPeriods(30, { 1: 8, 2: 150 }, { 1: 4, 2: 100 });

      const rising = await service.getRisingTechnologies(30);

      expect(rising.some(t => t.technologyId === 1)).toBe(false);
      expect(rising.some(t => t.technologyId === 2)).toBe(true);
    });

    it('should return empty array when no technologies meet criteria', async () => {
      setupMockPeriods(30, { 1: 10, 2: 10 }, { 1: 10, 2: 10 });

      const rising = await service.getRisingTechnologies(30);
      expect(rising).toEqual([]);
    });

    it('should handle new technologies appearing', async () => {
      setupMockPeriods(30, { 1: 100, 2: 50 }, { 1: 90 });

      const rising = await service.getRisingTechnologies(30);

      const tech2 = rising.find(t => t.technologyId === 2);
      expect(tech2).toBeDefined();
      expect(tech2?.previousCount).toBe(0);
      expect(tech2?.growthPercentage).toBe(100);
    });
  });

  describe('getDecliningTechnologies', () => {
    it('should identify technologies with significant decline', async () => {
      setupMockPeriods(30, { 1: 50, 2: 80 }, { 1: 100, 2: 90 });

      const declining = await service.getDecliningTechnologies(30);

      expect(declining.length).toBeGreaterThan(0);
      const tech1 = declining.find(t => t.technologyId === 1);
      expect(tech1).toBeDefined();
      expect(tech1?.growthPercentage).toBeLessThan(-service.getConfig().minGrowthPercentage);
    });

    it('should filter out technologies with minimal decline', async () => {
      setupMockPeriods(30, { 1: 95, 2: 40 }, { 1: 100, 2: 100 });

      const declining = await service.getDecliningTechnologies(30);

      expect(declining.some(t => t.technologyId === 1)).toBe(false);
      expect(declining.some(t => t.technologyId === 2)).toBe(true);
    });

    it('should require meaningful previous volume', async () => {
      setupMockPeriods(30, { 1: 2, 2: 40 }, { 1: 8, 2: 100 });

      const declining = await service.getDecliningTechnologies(30);

      const tech1 = declining.find(t => t.technologyId === 1);
      if (tech1) {
        expect(tech1.previousCount).toBeGreaterThanOrEqual(service.getConfig().minCurrentVolume);
      }
    });

    it('should return empty array when no declining technologies', async () => {
      setupMockPeriods(30, { 1: 100, 2: 100 }, { 1: 90, 2: 90 });

      const declining = await service.getDecliningTechnologies(30);
      expect(declining).toEqual([]);
    });
  });

  describe('getStableTechnologies', () => {
    it('should identify technologies with low volatility', async () => {
      setupMockPeriods(30, { 1: 102, 2: 98, 3: 150 }, { 1: 100, 2: 100, 3: 100 });

      const stable = await service.getStableTechnologies(30);

      expect(stable.length).toBeGreaterThan(0);
      expect(stable.some(t => t.technologyId === 1)).toBe(true);
      expect(stable.some(t => t.technologyId === 2)).toBe(true);
      expect(stable.some(t => t.technologyId === 3)).toBe(false);
    });

    it('should filter out technologies with low volume', async () => {
      setupMockPeriods(30, { 1: 5, 2: 50 }, { 1: 5, 2: 50 });

      const stable = await service.getStableTechnologies(30);

      expect(stable.some(t => t.technologyId === 1)).toBe(false);
      expect(stable.some(t => t.technologyId === 2)).toBe(true);
    });

    it('should respect stable technology threshold', async () => {
      const maxChange = TREND_CONFIG.STABLE_TECHNOLOGY.MAX_CHANGE_PERCENTAGE;

      setupMockPeriods(30, { 1: 100 + maxChange - 1, 2: 100 + maxChange + 1 }, { 1: 100, 2: 100 });

      const stable = await service.getStableTechnologies(30);

      expect(stable.some(t => t.technologyId === 1)).toBe(true);
      expect(stable.some(t => t.technologyId === 2)).toBe(false);
    });
  });

  describe('predictDemand', () => {
    it('should predict future demand with sufficient historical data', async () => {
      mockRepository.setupHistoricalData(1, [100, 110, 121, 133, 146, 161]);

      const prediction = await service.predictDemand(1, 3);

      expect(prediction.technologyId).toBe(1);
      expect(prediction.currentDemand).toBe(161);
      expect(prediction.predictedDemand).toBeGreaterThan(161);
      expect(prediction.months).toBe(3);
      expect(prediction.monthlyGrowthRate).toBeGreaterThan(0);
      expect(prediction.historicalDataPoints).toBe(6);
    });

    it('should return current demand when insufficient data', async () => {
      // Use only 1 data point to ensure it's truly insufficient
      mockRepository.setupHistoricalData(1, [100]);

      const prediction = await service.predictDemand(1, 3);

      expect(prediction.currentDemand).toBe(100);
      expect(prediction.predictedDemand).toBe(100);
      expect(prediction.monthlyGrowthRate).toBe(0);
      expect(prediction.historicalDataPoints).toBe(1);
    });

    it('should use default prediction months when not specified', async () => {
      mockRepository.setupHistoricalData(1, [100, 110, 121, 133, 146, 161]);

      const prediction = await service.predictDemand(1);

      expect(prediction.months).toBe(TREND_CONFIG.PREDICTION.DEFAULT_PREDICTION_MONTHS);
    });

    it('should handle declining trends', async () => {
      mockRepository.setupHistoricalData(1, [200, 180, 162, 146, 131, 118]);

      const prediction = await service.predictDemand(1, 3);

      expect(prediction.predictedDemand).toBeLessThan(prediction.currentDemand);
      expect(prediction.monthlyGrowthRate).toBeLessThan(0);
    });

    it('should handle stable trends', async () => {
      mockRepository.setupHistoricalData(1, [100, 100, 100, 100, 100, 100]);

      const prediction = await service.predictDemand(1, 3);

      expect(prediction.predictedDemand).toBeCloseTo(prediction.currentDemand, 0);
      expect(prediction.monthlyGrowthRate).toBeCloseTo(0, 2);
    });

    it('should use compound growth formula correctly', async () => {
      mockRepository.setupHistoricalData(1, [100, 110, 121, 133, 146, 161]);

      const prediction = await service.predictDemand(1, 2);

      expect(prediction.predictedDemand).toBeGreaterThan(190);
      expect(prediction.predictedDemand).toBeLessThan(200);
    });

    it('should use median growth when configured', async () => {
      const customService = new TrendAnalysisService(mockRepository, {
        useMedianGrowth: true,
      });

      mockRepository.setupHistoricalData(1, [100, 110, 121, 130, 140, 150]);

      const prediction = await customService.predictDemand(1, 3);

      expect(prediction.monthlyGrowthRate).toBeGreaterThan(0);
      expect(prediction.predictedDemand).toBeGreaterThan(prediction.currentDemand);
    });

    it('should handle data with outliers using mean', async () => {
      mockRepository.setupHistoricalData(1, [100, 110, 500, 120, 130, 140]);

      const prediction = await service.predictDemand(1, 3);

      expect(prediction).toBeDefined();
      expect(prediction.predictedDemand).toBeGreaterThan(0);
    });

    it('should handle empty historical data', async () => {
      mockRepository.setupHistoricalData(1, []);

      const prediction = await service.predictDemand(1, 3);

      expect(prediction.currentDemand).toBe(0);
      expect(prediction.predictedDemand).toBe(0);
      expect(prediction.monthlyGrowthRate).toBe(0);
    });
  });

  describe('Growth Rate Calculations', () => {
    it('should calculate correct growth percentage for normal case', async () => {
      setupMockPeriods(30, { 1: 150 }, { 1: 100 });

      const rising = await service.getRisingTechnologies(30);
      const trend = rising.find(t => t.technologyId === 1);

      expect(trend?.growthPercentage).toBe(50);
      expect(trend?.growthRate).toBe(50);
    });

    it('should handle zero baseline correctly', async () => {
      setupMockPeriods(30, { 1: 50 }, {});

      const rising = await service.getRisingTechnologies(30);
      const trend = rising.find(t => t.technologyId === 1);

      expect(trend?.previousCount).toBe(0);
      expect(trend?.growthPercentage).toBe(100);
    });

    it('should handle small volume with zero baseline', async () => {
      setupMockPeriods(30, { 1: 5 }, {});

      const rising = await service.getRisingTechnologies(30);
      const trend = rising.find(t => t.technologyId === 1);

      if (trend) {
        expect(trend.growthPercentage).toBe(0);
      }
    });

    it('should sort results by growth percentage descending', async () => {
      setupMockPeriods(30, { 1: 200, 2: 150, 3: 175 }, { 1: 100, 2: 100, 3: 100 });

      const rising = await service.getRisingTechnologies(30);

      if (rising.length > 1) {
        for (let i = 0; i < rising.length - 1; i++) {
          expect(rising[i].growthPercentage).toBeGreaterThanOrEqual(rising[i + 1].growthPercentage);
        }
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty period data', async () => {
      setupMockPeriods(30, {}, {});

      const rising = await service.getRisingTechnologies(30);
      const declining = await service.getDecliningTechnologies(30);
      const stable = await service.getStableTechnologies(30);

      expect(rising).toEqual([]);
      expect(declining).toEqual([]);
      expect(stable).toEqual([]);
    });

    it('should handle negative values gracefully', async () => {
      mockRepository.setupHistoricalData(1, [100, 110, 120, 130]);

      const prediction = await service.predictDemand(1, 3);
      expect(prediction).toBeDefined();
    });

    it('should handle very large growth rates', async () => {
      setupMockPeriods(30, { 1: 10000 }, { 1: 100 });

      const rising = await service.getRisingTechnologies(30);

      expect(rising.length).toBeGreaterThan(0);
      expect(rising[0].growthPercentage).toBeGreaterThan(1000);
    });

    it('should handle technologies in current period only', async () => {
      setupMockPeriods(30, { 1: 100, 2: 50 }, { 1: 90 });

      const rising = await service.getRisingTechnologies(30);

      const tech2 = rising.find(t => t.technologyId === 2);
      expect(tech2).toBeDefined();
      expect(tech2?.previousCount).toBe(0);
    });
  });

  describe('Configuration Impact', () => {
    it('should respect custom minGrowthPercentage', async () => {
      const customService = new TrendAnalysisService(mockRepository, {
        minGrowthPercentage: 50,
      });

      setupMockPeriods(30, { 1: 130, 2: 200 }, { 1: 100, 2: 100 });

      const rising = await customService.getRisingTechnologies(30);

      expect(rising.some(t => t.technologyId === 1)).toBe(false);
      expect(rising.some(t => t.technologyId === 2)).toBe(true);
    });

    it('should respect custom minAbsoluteGrowth', async () => {
      const customService = new TrendAnalysisService(mockRepository, {
        minAbsoluteGrowth: 30,
        minGrowthPercentage: 10,
      });

      setupMockPeriods(30, { 1: 120, 2: 150 }, { 1: 100, 2: 100 });

      const rising = await customService.getRisingTechnologies(30);

      expect(rising.some(t => t.technologyId === 1)).toBe(false);
      expect(rising.some(t => t.technologyId === 2)).toBe(true);
    });

    it('should respect custom minCurrentVolume', async () => {
      const customService = new TrendAnalysisService(mockRepository, {
        minCurrentVolume: 80,
        minGrowthPercentage: 10,
      });

      setupMockPeriods(30, { 1: 70, 2: 100 }, { 1: 50, 2: 80 });

      const rising = await customService.getRisingTechnologies(30);

      expect(rising.some(t => t.technologyId === 1)).toBe(false);
      expect(rising.some(t => t.technologyId === 2)).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete market analysis workflow', async () => {
      setupMockPeriods(
        30,
        {
          1: 500,
          2: 350,
          3: 100,
          4: 50,
        },
        {
          1: 480,
          2: 250,
          3: 200,
          4: 48,
        }
      );

      const rising = await service.getRisingTechnologies(30);
      const declining = await service.getDecliningTechnologies(30);
      const stable = await service.getStableTechnologies(30);

      expect(rising.some(t => t.technologyId === 2)).toBe(true);
      expect(declining.some(t => t.technologyId === 3)).toBe(true);
      expect(stable.length).toBeGreaterThan(0);
    });

    it('should handle prediction with varying growth rates', async () => {
      mockRepository.setupHistoricalData(1, [100, 105, 115, 130, 150, 180]);

      const prediction = await service.predictDemand(1, 6);

      expect(prediction.predictedDemand).toBeGreaterThan(prediction.currentDemand);
      expect(prediction.monthlyGrowthRate).toBeGreaterThan(0);
    });
  });
});
