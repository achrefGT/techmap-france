import { Router } from 'express';
import { RegionController } from '../controllers/RegionController';

export function createRegionRoutes(controller: RegionController): Router {
  const router = Router();

  // Basic operations
  router.get('/', controller.getAllRegions);
  router.get('/search', controller.searchRegions);
  router.get('/compare', controller.compareRegions);
  router.get('/:id', controller.getRegionById);
  router.get('/:id/stats', controller.getRegionStats);

  // Filtering and discovery
  router.get('/top/list', controller.getTopRegions);
  router.get('/tech-hubs/list', controller.getTechHubs);
  router.get('/type/:type', controller.getRegionsByType);

  return router;
}
