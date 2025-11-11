// presentation/api/routes/ingestionRoutes.ts
import { Router } from 'express';
import { IngestionController } from '../controllers/IngestionController';

/**
 * Ingestion Routes
 *
 * IMPORTANT: These routes should be protected with authentication in production
 * Consider adding API key middleware or JWT authentication
 */
export function createIngestionRoutes(controller: IngestionController): Router {
  const router = Router();

  // Job ingestion
  router.post('/jobs', controller.ingestJobs);
  router.post('/jobs/batch', controller.ingestJobsInBatches);
  router.post('/jobs/validate', controller.validateJobs);

  // Cache management
  router.post('/reload-technologies', controller.reloadTechnologies);
  router.post('/clear-technology-cache', controller.clearTechnologyCache);

  // Statistics
  router.get('/stats', controller.getIngestionStats);

  return router;
}
