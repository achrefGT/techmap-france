import { Router } from 'express';
import { JobController } from '../controllers/JobController';

export function createJobRoutes(controller: JobController): Router {
  const router = Router();

  // Basic CRUD
  router.get('/', controller.getJobs);
  router.get('/recent', controller.getRecentJobs);
  router.get('/remote', controller.getRemoteJobs);
  router.get('/high-quality', controller.getHighQualityJobs);
  router.get('/:id', controller.getJobById);
  router.get('/:id/stats', controller.getJobStats);
  router.get('/:id/similar', controller.getSimilarJobs);

  // Search
  router.get('/search/text', controller.searchJobs);
  router.post('/search/advanced', controller.advancedSearch);
  router.get('/search/technology/:techStack', controller.searchByTechnologyStack);

  // Filters
  router.get('/company/:company', controller.getJobsByCompany);

  // Recommendations & Comparison
  router.post('/recommendations', controller.getRecommendations);
  router.post('/compare', controller.compareJobs);

  // State management
  router.put('/:id/deactivate', controller.deactivateJob);
  router.put('/:id/reactivate', controller.reactivateJob);

  return router;
}
