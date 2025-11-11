import { Router } from 'express';
import { AnalyticsController } from '../controllers/AnalyticsController';

export function createAnalyticsRoutes(controller: AnalyticsController): Router {
  const router = Router();

  // Overview
  router.get('/dashboard', controller.getDashboardStats);
  router.get('/summary', controller.getSummary);
  router.get('/market', controller.getMarketInsights);

  // Salary analytics
  router.get('/salary', controller.getSalaryStats);
  router.get('/salary/by-experience', controller.getSalaryByExperience);
  router.get('/salary/by-technology', controller.getSalaryByTechnology);
  router.get('/salary/by-region', controller.getSalaryByRegion);

  // Trends
  router.get('/trends/technologies', controller.getTechnologyTrends);

  // Distribution
  router.get('/distribution/experience', controller.getExperienceDistribution);
  router.get('/distribution/remote', controller.getRemoteDistribution);

  // Companies
  router.get('/companies/top', controller.getTopCompanies);

  return router;
}
