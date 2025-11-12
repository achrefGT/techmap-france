import { Router } from 'express';
import { AnalyticsController } from '../controllers/AnalyticsController';

/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     tags: [Analytics]
 *     summary: Get dashboard overview statistics
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalJobs:
 *                       type: integer
 *                     activeJobs:
 *                       type: integer
 *                     companiesHiring:
 *                       type: integer
 *                     averageSalary:
 *                       type: number
 */

/**
 * @swagger
 * /api/analytics/summary:
 *   get:
 *     tags: [Analytics]
 *     summary: Get comprehensive analytics summary
 *     description: Returns dashboard stats, salary data, and market insights in one response
 *     responses:
 *       200:
 *         description: Complete analytics summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     dashboard:
 *                       type: object
 *                     salary:
 *                       type: object
 *                     market:
 *                       type: object
 */

/**
 * @swagger
 * /api/analytics/market:
 *   get:
 *     tags: [Analytics]
 *     summary: Get market insights
 *     description: Returns hot technologies, top regions, top companies, and distributions
 *     responses:
 *       200:
 *         description: Market insights
 */

/**
 * @swagger
 * /api/analytics/salary:
 *   get:
 *     tags: [Analytics]
 *     summary: Get comprehensive salary statistics
 *     description: Returns overall salary stats and breakdowns by experience, technology, and region
 *     responses:
 *       200:
 *         description: Salary statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     overall:
 *                       type: object
 *                       properties:
 *                         average:
 *                           type: number
 *                         median:
 *                           type: number
 *                         min:
 *                           type: number
 *                         max:
 *                           type: number
 *                     byExperience:
 *                       type: array
 *                     byTechnology:
 *                       type: array
 *                     byRegion:
 *                       type: array
 */

/**
 * @swagger
 * /api/analytics/salary/by-experience:
 *   get:
 *     tags: [Analytics]
 *     summary: Get salary breakdown by experience level
 *     responses:
 *       200:
 *         description: Salary data by experience level
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       experienceLevel:
 *                         type: string
 *                       average:
 *                         type: number
 *                       median:
 *                         type: number
 *                       count:
 *                         type: integer
 */

/**
 * @swagger
 * /api/analytics/salary/by-technology:
 *   get:
 *     tags: [Analytics]
 *     summary: Get salary breakdown by technology
 *     parameters:
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Top paying technologies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       technology:
 *                         type: string
 *                       average:
 *                         type: number
 *                       count:
 *                         type: integer
 *                 meta:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 */

/**
 * @swagger
 * /api/analytics/salary/by-region:
 *   get:
 *     tags: [Analytics]
 *     summary: Get salary breakdown by region
 *     parameters:
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Top paying regions
 */

/**
 * @swagger
 * /api/analytics/trends/technologies:
 *   get:
 *     tags: [Analytics]
 *     summary: Get technology trends
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to analyze
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Technology trends data
 */

/**
 * @swagger
 * /api/analytics/distribution/experience:
 *   get:
 *     tags: [Analytics]
 *     summary: Get experience level distribution
 *     responses:
 *       200:
 *         description: Distribution of jobs by experience level
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     type: integer
 */

/**
 * @swagger
 * /api/analytics/distribution/remote:
 *   get:
 *     tags: [Analytics]
 *     summary: Get remote vs onsite distribution
 *     responses:
 *       200:
 *         description: Distribution of remote vs onsite jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     remote:
 *                       type: integer
 *                     onsite:
 *                       type: integer
 */

/**
 * @swagger
 * /api/analytics/companies/top:
 *   get:
 *     tags: [Analytics]
 *     summary: Get top hiring companies
 *     parameters:
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Top companies by job count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       company:
 *                         type: string
 *                       jobCount:
 *                         type: integer
 *                 meta:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 */

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
