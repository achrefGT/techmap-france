import { Router } from 'express';
import { RegionController } from '../controllers/RegionController';

/**
 * @swagger
 * /api/regions:
 *   get:
 *     tags: [Regions]
 *     summary: Get all regions with optional filters
 *     description: Returns regions with optional filtering by type and search query
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [major, significant, emerging, small]
 *         description: Filter by region type
 *       - in: query
 *         name: techHubsOnly
 *         schema:
 *           type: boolean
 *         description: Only return tech hub regions
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query for region name
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: List of regions
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
 *                     $ref: '#/components/schemas/Region'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                     type:
 *                       type: string
 *                     techHubsOnly:
 *                       type: boolean
 */

/**
 * @swagger
 * /api/regions/{id}:
 *   get:
 *     tags: [Regions]
 *     summary: Get a region by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Region ID
 *       - in: query
 *         name: includeStats
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include detailed statistics
 *     responses:
 *       200:
 *         description: Region details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Region'
 *       400:
 *         description: Invalid region ID
 *       404:
 *         description: Region not found
 */

/**
 * @swagger
 * /api/regions/{id}/stats:
 *   get:
 *     tags: [Regions]
 *     summary: Get detailed statistics for a region
 *     description: Returns job count, salary data, job density, and top technologies/companies
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Region ID
 *     responses:
 *       200:
 *         description: Region statistics
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
 *                     region:
 *                       $ref: '#/components/schemas/Region'
 *                     jobCount:
 *                       type: integer
 *                     jobDensity:
 *                       type: number
 *                       description: Jobs per 100k population
 *                     regionType:
 *                       type: string
 *                       enum: [major, significant, emerging, small]
 *                     isTechHub:
 *                       type: boolean
 *                     averageSalary:
 *                       type: number
 *                     topTechnologies:
 *                       type: array
 *                     topCompanies:
 *                       type: array
 *       400:
 *         description: Invalid region ID
 *       404:
 *         description: Region not found
 */

/**
 * @swagger
 * /api/regions/compare:
 *   post:
 *     tags: [Regions]
 *     summary: Compare multiple regions
 *     description: Compare regions on job count, salaries, job density, and market characteristics
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - regionIds
 *             properties:
 *               regionIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 minItems: 2
 *                 maxItems: 5
 *     responses:
 *       200:
 *         description: Region comparison data
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
 *         description: Invalid number of region IDs (must be 2-5)
 *       404:
 *         description: One or more regions not found
 */

export function createRegionRoutes(controller: RegionController): Router {
  const router = Router();

  // Collection operations
  router.post('/compare', controller.compareRegions);

  // Collection queries (handles all filters: type, techHubsOnly, search, limit)
  router.get('/', controller.getAllRegions);

  // Resource-specific operations
  router.get('/:id', controller.getRegionById);
  router.get('/:id/stats', controller.getRegionStats);

  return router;
}
