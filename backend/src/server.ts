import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.config';

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
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  })
);

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

// ==================== Swagger Documentation ====================

const ENABLE_DOCS = process.env.API_DOCS_ENABLED !== 'false'; // Enabled by default

if (ENABLE_DOCS) {
  // Swagger UI options
  const swaggerUiOptions = {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0 }
      .swagger-ui .scheme-container { margin: 20px 0 }
    `,
    customSiteTitle: 'Job Aggregator API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      tryItOutEnabled: true,
    },
  };

  // Serve Swagger UI
  app.use('/api-docs', swaggerUi.serve);
  app.get('/api-docs', swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  // Serve OpenAPI JSON
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Redirect /docs to /api-docs for convenience
  app.get('/docs', (_req, res) => {
    res.redirect('/api-docs');
  });
}

// ==================== Routes ====================

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Job Aggregator API',
    version: '1.0.0',
    description: 'API for job aggregation and analytics',
    documentation: ENABLE_DOCS ? '/api-docs' : 'Documentation disabled',
    health: '/health',
    endpoints: {
      jobs: '/api/jobs',
      technologies: '/api/technologies',
      regions: '/api/regions',
      analytics: '/api/analytics',
      ingestion: '/api/ingestion',
    },
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Health check endpoint
 *     description: Returns the current health status of the API and its services
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                 services:
 *                   type: object
 *                   description: Status of individual services
 *       503:
 *         description: API is unhealthy
 */
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

/**
 * @swagger
 * /api:
 *   get:
 *     tags: [System]
 *     summary: API version and endpoints information
 *     description: Returns available API endpoints and version information
 *     responses:
 *       200:
 *         description: API information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 version:
 *                   type: string
 *                 description:
 *                   type: string
 *                 endpoints:
 *                   type: object
 */
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
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 Job Aggregator API Server                       ║
║                                                       ║
║   📍 Port: ${PORT}                                       ║
║   🌍 Environment: ${process.env.NODE_ENV || 'development'}                        ║
║   💚 Health: http://localhost:${PORT}/health             ║
${ENABLE_DOCS ? `║   📚 Docs: http://localhost:${PORT}/api-docs            ║` : ''}
${ENABLE_DOCS ? `║   📄 OpenAPI: http://localhost:${PORT}/api-docs.json    ║` : ''}
║                                                       ║
╔═══════════════════════════════════════════════════════╗
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
