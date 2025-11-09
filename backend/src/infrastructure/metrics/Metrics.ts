import { IMetrics } from '../../application/use-cases/JobIngestionService';

export class ConsoleMetrics implements IMetrics {
  increment(metric: string, tags?: Record<string, string | number>): void {
    console.log(`[METRIC] ${metric} +1`, tags);
  }

  timing(metric: string, duration: number, tags?: Record<string, string | number>): void {
    console.log(`[METRIC] ${metric}: ${duration}ms`, tags);
  }

  gauge(metric: string, value: number, tags?: Record<string, string | number>): void {
    console.log(`[METRIC] ${metric}: ${value}`, tags);
  }
}
