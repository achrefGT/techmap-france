import winston from 'winston';
import { ILogger } from '../../application/use-cases/JobIngestionService';

export class WinstonLogger implements ILogger {
  private logger: winston.Logger;
  private context: string;

  constructor(context: string, logger?: winston.Logger) {
    this.context = context;
    this.logger =
      logger ||
      winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        defaultMeta: { service: 'job-aggregator' },
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
          }),
        ],
      });
  }

  info(message: string, meta?: Record<string, any>): void {
    this.logger.info(message, { context: this.context, ...meta });
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.logger.warn(message, { context: this.context, ...meta });
  }

  error(message: string, meta?: Record<string, any>): void {
    this.logger.error(message, { context: this.context, ...meta });
  }
}
