import { Router } from 'express';
import { TechnologyController } from '../controllers/TechnologyController';

/**
 * @swagger
 * /api/technologies:
 *   get:
 *     tags: [Technologies]
 *     summary: Get all technologies with optional filters
 *     description: Returns technologies with optional filtering by category, popularity, and search query
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by technology category
 *         example: "frontend"
 *       - in: query
 *         name: popularityLevel
 *         schema:
 *           type: string
 *           enum: [trending, popular, common, niche]
 *         description: Filter by popularity level
 *       - in: query
 *         name: inDemandOnly
 *         schema:
 *           type: boolean
 *         description: Only return technologies with >100 jobs
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query for technology name
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: List of technologies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Technology'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                     category:
 *                       type: string
 *                     popularityLevel:
 *                       type: string
 */

/**
 * @swagger
 * /api/technologies/{id}:
 *   get:
 *     tags: [Technologies]
 *     summary: Get a technology by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Technology ID
 *       - in: query
 *         name: includeStats
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include detailed statistics
 *     responses:
 *       200:
 *         description: Technology details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Technology'
 *       400:
 *         description: Invalid technology ID
 *       404:
 *         description: Technology not found
 */

/**
 * @swagger
 * /api/technologies/{id}/stats:
 *   get:
 *     tags: [Technologies]
 *     summary: Get detailed statistics for a technology
 *     description: Returns job count, popularity level, salary data, and market trends
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Technology ID
 *     responses:
 *       200:
 *         description: Technology statistics
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
 *                     technology:
 *                       $ref: '#/components/schemas/Technology'
 *                     jobCount:
 *                       type: integer
 *                     popularityLevel:
 *                       type: string
 *                       enum: [trending, popular, common, niche]
 *                     isInDemand:
 *                       type: boolean
 *                     averageSalary:
 *                       type: number
 *                     topRegions:
 *                       type: array
 *                     topCompanies:
 *                       type: array
 *       404:
 *         description: Technology not found
 */

/**
 * @swagger
 * /api/technologies/compare:
 *   post:
 *     tags: [Technologies]
 *     summary: Compare multiple technologies
 *     description: Compare technologies on job count, salaries, popularity, and regional demand
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - technologyIds
 *             properties:
 *               technologyIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 minItems: 2
 *                 maxItems: 5
 *     responses:
 *       200:
 *         description: Technology comparison data
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
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requested:
 *                       type: integer
 *                     found:
 *                       type: integer
 *       400:
 *         description: Invalid number of technology IDs (must be 2-5)
 *       404:
 *         description: One or more technologies not found
 */

export function createTechnologyRoutes(controller: TechnologyController): Router {
  const router = Router();

  // Collection operations
  router.post('/compare', controller.compareTechnologies);

  // Collection queries (handles all filters: category, popularityLevel, inDemandOnly, search, limit)
  router.get('/', controller.getAllTechnologies);

  // Resource-specific operations
  router.get('/:id', controller.getTechnologyById);
  router.get('/:id/stats', controller.getTechnologyStats);

  return router;
}
