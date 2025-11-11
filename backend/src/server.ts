// src/server.ts
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Middleware
import { errorHandler, notFoundHandler } from './presentation/api/middleware/errorHandler';
import { requestLogger, performanceMonitor } from './presentation/api/middleware/requestLogger';
import { sanitizeInput } from './presentation/api/middleware/validation';

// Container & Routes
import { container } from './presentation/api/container';
import { createJobRoutes } from './presentation/api/routes/jobRoutes';
import { createTechnologyRoutes } from './presentation/api/routes/technologyRoutes';
import { createRegionRoutes } from './presentation/api/routes/regionRoutes';
import { createAnalyticsRoutes } from './presentation/api/routes/analyticsRoutes';
import { createIngestionRoutes } from './presentation/api/routes/ingestionRoutes';

/**
 * Main Application Setup
 */
const app: Application = express();
const PORT = process.env.PORT || 3000;

// ==================== Middleware ====================

// Security
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);

// Request parsing
app.use(express.json({ limit: '10mb' })); // Limit for ingestion endpoint
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging & Performance
app.use(requestLogger);
app.use(performanceMonitor);

// Input sanitization
app.use(sanitizeInput);

// ==================== Routes ====================

// Health check (no auth needed)
app.get('/health', async (_req, res) => {
  try {
    const health = await container.healthCheck();

    res.status(health.status === 'healthy' ? 200 : 503).json({
      status: health.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: health.services,
    });
  } catch {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
    });
  }
});

// API version info
app.get('/api', (_req, res) => {
  res.json({
    name: 'Job Aggregator API',
    version: '1.0.0',
    description: 'API for job aggregation and analytics',
    endpoints: {
      jobs: '/api/jobs',
      technologies: '/api/technologies',
      regions: '/api/regions',
      analytics: '/api/analytics',
      ingestion: '/api/ingestion',
    },
  });
});

// Mount route modules
app.use('/api/jobs', createJobRoutes(container.jobController));
app.use('/api/technologies', createTechnologyRoutes(container.technologyController));
app.use('/api/regions', createRegionRoutes(container.regionController));
app.use('/api/analytics', createAnalyticsRoutes(container.analyticsController));
app.use('/api/ingestion', createIngestionRoutes(container.ingestionController));

// ==================== Error Handling ====================

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// ==================== Server Startup ====================

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`
🚀 Server running on port ${PORT}
📊 Environment: ${process.env.NODE_ENV || 'development'}
🔗 Health check: http://localhost:${PORT}/health
📝 API docs: http://localhost:${PORT}/api
  `);
});

// ==================== Graceful Shutdown ====================

process.on('SIGTERM', async () => {
  // eslint-disable-next-line no-console
  console.log('SIGTERM signal received: closing HTTP server');

  server.close(async () => {
    // eslint-disable-next-line no-console
    console.log('HTTP server closed');

    // Clean up database connections and other resources
    await container.shutdown();

    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  // eslint-disable-next-line no-console
  console.log('\nSIGINT signal received: closing HTTP server');

  server.close(async () => {
    // eslint-disable-next-line no-console
    console.log('HTTP server closed');

    await container.shutdown();

    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // In production, you might want to log this to an error tracking service
});

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  // In production, you might want to log this and restart the server
  process.exit(1);
});

export default app;
