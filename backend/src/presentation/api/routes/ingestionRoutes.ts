import { Router } from 'express';
import { IngestionController } from '../controllers/IngestionController';

/**
 * @swagger
 * /api/ingestion/jobs:
 *   post:
 *     tags: [Ingestion]
 *     summary: Ingest jobs from external source
 *     description: |
 *       Import jobs from external sources. This endpoint processes raw job data and stores it in the database.
 *
 *       **Security Note:** This endpoint should be protected with authentication in production.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               required:
 *                 - id
 *                 - title
 *                 - company
 *                 - description
 *                 - sourceApi
 *                 - externalId
 *               properties:
 *                 id:
 *                   type: string
 *                   description: Internal job ID
 *                 title:
 *                   type: string
 *                   description: Job title
 *                 company:
 *                   type: string
 *                   description: Company name
 *                 description:
 *                   type: string
 *                   description: Job description
 *                 sourceApi:
 *                   type: string
 *                   description: Source API identifier
 *                 externalId:
 *                   type: string
 *                   description: External job ID from source
 *                 location:
 *                   type: string
 *                   description: Job location
 *                 isRemote:
 *                   type: boolean
 *                 salaryMin:
 *                   type: number
 *                 salaryMax:
 *                   type: number
 *                 technologies:
 *                   type: array
 *                   items:
 *                     type: string
 *           example:
 *             - id: "job-123"
 *               title: "Senior React Developer"
 *               company: "Tech Corp"
 *               description: "Looking for an experienced React developer..."
 *               sourceApi: "indeed"
 *               externalId: "ext-456"
 *               location: "San Francisco, CA"
 *               isRemote: false
 *               salaryMin: 120000
 *               salaryMax: 160000
 *               technologies: ["React", "TypeScript", "Node.js"]
 *     responses:
 *       200:
 *         description: Jobs ingested successfully
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
 *                     total:
 *                       type: integer
 *                     created:
 *                       type: integer
 *                     updated:
 *                       type: integer
 *                     skipped:
 *                       type: integer
 *                     failed:
 *                       type: integer
 *       400:
 *         description: Invalid request body
 */

/**
 * @swagger
 * /api/ingestion/jobs/batch:
 *   post:
 *     tags: [Ingestion]
 *     summary: Ingest jobs in batches
 *     description: |
 *       Import large datasets of jobs in batches for better performance.
 *
 *       **Security Note:** This endpoint should be protected with authentication in production.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobs
 *             properties:
 *               jobs:
 *                 type: array
 *                 items:
 *                   type: object
 *                 description: Array of raw job data
 *               batchSize:
 *                 type: integer
 *                 description: Number of jobs to process per batch
 *                 default: 50
 *                 minimum: 1
 *                 maximum: 1000
 *           example:
 *             jobs:
 *               - id: "job-123"
 *                 title: "Senior Developer"
 *                 company: "Tech Corp"
 *                 description: "Job description..."
 *                 sourceApi: "indeed"
 *                 externalId: "ext-456"
 *             batchSize: 100
 *     responses:
 *       200:
 *         description: Batch ingestion completed
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
 *                     batchesProcessed:
 *                       type: integer
 *                     created:
 *                       type: integer
 *                     updated:
 *                       type: integer
 *                     failed:
 *                       type: integer
 *       400:
 *         description: Invalid request body
 */

/**
 * @swagger
 * /api/ingestion/jobs/validate:
 *   post:
 *     tags: [Ingestion]
 *     summary: Validate raw job data without persisting
 *     description: Dry-run validation of job data without storing in the database
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *     responses:
 *       200:
 *         description: Validation results
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
 *                     total:
 *                       type: integer
 *                     valid:
 *                       type: integer
 *                     invalid:
 *                       type: integer
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           index:
 *                             type: integer
 *                           error:
 *                             type: string
 *       400:
 *         description: Invalid request body
 */

/**
 * @swagger
 * /api/ingestion/reload-technologies:
 *   post:
 *     tags: [Ingestion]
 *     summary: Reload technology cache
 *     description: |
 *       Reload the technology cache from the database. Call this after adding new technologies to the database.
 *
 *       **Security Note:** This endpoint should be protected with authentication in production.
 *     responses:
 *       200:
 *         description: Technologies cache reloaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */

/**
 * @swagger
 * /api/ingestion/clear-technology-cache:
 *   post:
 *     tags: [Ingestion]
 *     summary: Clear technology cache
 *     description: |
 *       Clear the technology cache. Next ingestion will reload from database.
 *
 *       **Security Note:** This endpoint should be protected with authentication in production.
 *     responses:
 *       200:
 *         description: Technologies cache cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */

/**
 * @swagger
 * /api/ingestion/stats:
 *   get:
 *     tags: [Ingestion]
 *     summary: Get ingestion statistics
 *     description: Returns statistics about past ingestion operations (placeholder endpoint)
 *     responses:
 *       200:
 *         description: Ingestion statistics
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
 *                     message:
 *                       type: string
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
