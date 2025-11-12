import { Router } from 'express';
import { JobController } from '../controllers/JobController';

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     tags: [Jobs]
 *     summary: Get paginated list of jobs with filters
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/PageSizeParam'
 *       - in: query
 *         name: technologies
 *         schema:
 *           type: string
 *         description: Comma-separated list of technologies
 *         example: "javascript,react,nodejs"
 *       - in: query
 *         name: regionIds
 *         schema:
 *           type: string
 *         description: Comma-separated list of region IDs
 *         example: "1,2,3"
 *       - in: query
 *         name: isRemote
 *         schema:
 *           type: boolean
 *         description: Filter by remote jobs
 *       - in: query
 *         name: experienceCategories
 *         schema:
 *           type: string
 *         description: Comma-separated experience levels
 *         example: "mid,senior"
 *       - in: query
 *         name: minSalary
 *         schema:
 *           type: integer
 *         description: Minimum salary in kâ‚¬
 *       - in: query
 *         name: maxSalary
 *         schema:
 *           type: integer
 *         description: Maximum salary in kâ‚¬
 *       - in: query
 *         name: minQualityScore
 *         schema:
 *           type: integer
 *         description: Minimum quality score (0-100)
 *       - in: query
 *         name: postedAfter
 *         schema:
 *           type: string
 *           format: date
 *         description: Posted after date (YYYY-MM-DD)
 *       - in: query
 *         name: recent
 *         schema:
 *           type: integer
 *         description: Get jobs from last N days
 *       - in: query
 *         name: company
 *         schema:
 *           type: string
 *         description: Filter by company name
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Return only active jobs
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Text search query
 *     responses:
 *       200:
 *         description: Paginated list of jobs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */

/**
 * @swagger
 * /api/jobs/{id}:
 *   get:
 *     tags: [Jobs]
 *     summary: Get a single job by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Job'
 *       404:
 *         description: Job not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/jobs/{id}/similar:
 *   get:
 *     tags: [Jobs]
 *     summary: Get similar jobs based on technology stack
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: excludeSameCompany
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Exclude jobs from the same company
 *     responses:
 *       200:
 *         description: List of similar jobs
 */

/**
 * @swagger
 * /api/jobs/{id}/deactivate:
 *   put:
 *     tags: [Jobs]
 *     summary: Deactivate a job (state transition)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job deactivated successfully
 *       404:
 *         description: Job not found
 */

/**
 * @swagger
 * /api/jobs/{id}/reactivate:
 *   put:
 *     tags: [Jobs]
 *     summary: Reactivate a job (state transition)
 *     description: Cannot reactivate expired jobs
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job reactivated successfully
 *       400:
 *         description: Job is expired and cannot be reactivated
 *       404:
 *         description: Job not found
 */

/**
 * @swagger
 * /api/jobs/search:
 *   post:
 *     tags: [Jobs]
 *     summary: Advanced job search with scoring
 *     description: Search jobs with required and preferred technologies, returns ranked results
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/PageSizeParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               requiredTechnologies:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Technologies that must be present
 *               preferredTechnologies:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Technologies that boost ranking
 *               experienceCategories:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [junior, mid, senior, lead]
 *               isRemote:
 *                 type: boolean
 *               minSalary:
 *                 type: number
 *                 description: Minimum salary in kâ‚¬
 *               regionIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Ranked search results
 */

/**
 * @swagger
 * /api/jobs/compare:
 *   post:
 *     tags: [Jobs]
 *     summary: Compare multiple jobs
 *     description: Compare jobs side-by-side on salary, technologies, experience, quality score
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobIds
 *             properties:
 *               jobIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 2
 *                 maxItems: 5
 *     responses:
 *       200:
 *         description: Job comparison
 *       400:
 *         description: Invalid number of job IDs (must be 2-5)
 */

/**
 * @swagger
 * /api/jobs/recommendations:
 *   post:
 *     tags: [Jobs]
 *     summary: Get personalized job recommendations
 *     description: Get jobs matching user preferences with relevance scoring
 *     parameters:
 *       - $ref: '#/components/parameters/LimitParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               technologies:
 *                 type: array
 *                 items:
 *                   type: string
 *               experienceLevel:
 *                 type: string
 *                 enum: [junior, mid, senior, lead]
 *               isRemote:
 *                 type: boolean
 *               minSalary:
 *                 type: number
 *               regionIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Recommended jobs with relevance scores
 */

export function createJobRoutes(controller: JobController): Router {
  const router = Router();

  // Collection operations (must come before /:id routes)
  router.post('/search', controller.advancedSearch);
  router.post('/compare', controller.compareJobs);
  router.post('/recommendations', controller.getRecommendations);

  // Collection queries
  router.get('/', controller.getJobs); // Handles all filters including recent, remote, company, quality, text search

  // Resource-specific operations
  router.get('/:id', controller.getJobById);
  router.get('/:id/similar', controller.getSimilarJobs);

  // State transitions
  router.put('/:id/deactivate', controller.deactivateJob);
  router.put('/:id/reactivate', controller.reactivateJob);

  return router;
}
