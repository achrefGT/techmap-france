import { Router } from 'express';
import { TechnologyController } from '../controllers/TechnologyController';

export function createTechnologyRoutes(controller: TechnologyController): Router {
  const router = Router();

  // Basic operations
  router.get('/', controller.getAllTechnologies);
  router.get('/search', controller.searchTechnologies);
  router.get('/compare', controller.compareTechnologies);
  router.get('/:id', controller.getTechnologyById);
  router.get('/:id/stats', controller.getTechnologyStats);

  // Filtering and discovery
  router.get('/category/:category', controller.getTechnologiesByCategory);
  router.get('/trending/list', controller.getTrendingTechnologies);
  router.get('/in-demand/list', controller.getInDemandTechnologies);
  router.get('/popular/list', controller.getPopularTechnologies);

  return router;
}
