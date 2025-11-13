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
 *     responses:
 *       200:
 *         description: Jobs ingested successfully
 *       400:
 *         description: Invalid request body
 */

/**
 * @swagger
 * /api/ingestion/orchestrate:
 *   post:
 *     tags: [Ingestion]
 *     summary: Orchestrate multi-source ingestion
 *     description: |
 *       Fetch and ingest jobs from multiple configured sources (France Travail, Adzuna, Remotive).
 *       Supports deduplication across sources.
 *
 *       **Security Note:** This endpoint should be protected with authentication in production.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               franceTravail:
 *                 type: object
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                   maxResults:
 *                     type: integer
 *                   searchParams:
 *                     type: object
 *                     properties:
 *                       motsCles:
 *                         type: string
 *                       commune:
 *                         type: string
 *                       departement:
 *                         type: string
 *               adzuna:
 *                 type: object
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                   maxResults:
 *                     type: integer
 *                   keywords:
 *                     type: string
 *               remotive:
 *                 type: object
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                   limit:
 *                     type: integer
 *               batchSize:
 *                 type: integer
 *               enableDeduplication:
 *                 type: boolean
 *           example:
 *             franceTravail:
 *               enabled: true
 *               maxResults: 150
 *               searchParams:
 *                 motsCles: "développeur"
 *             adzuna:
 *               enabled: true
 *               maxResults: 150
 *             remotive:
 *               enabled: false
 *             batchSize: 100
 *             enableDeduplication: true
 *     responses:
 *       200:
 *         description: Orchestrated ingestion completed
 *       400:
 *         description: Invalid configuration
 */

/**
 * @swagger
 * /api/ingestion/source/{sourceName}:
 *   post:
 *     tags: [Ingestion]
 *     summary: Ingest from a specific source
 *     description: |
 *       Fetch and ingest jobs from a single source.
 *
 *       **Security Note:** This endpoint should be protected with authentication in production.
 *     parameters:
 *       - in: path
 *         name: sourceName
 *         required: true
 *         schema:
 *           type: string
 *           enum: [france_travail, adzuna, remotive]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Source-specific configuration
 *     responses:
 *       200:
 *         description: Source ingestion completed
 *       400:
 *         description: Invalid source name
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
 *     responses:
 *       200:
 *         description: Batch ingestion completed
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
 */

export function createIngestionRoutes(controller: IngestionController): Router {
  const router = Router();

  // Orchestrated ingestion - NEW
  router.post('/orchestrate', controller.orchestrateIngestion);
  router.post('/source/:sourceName', controller.ingestFromSource);

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
