import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerDefinition } from 'swagger-jsdoc';

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'TechMap France - Job Aggregator API',
    version: '1.0.0',
    description: `
      API for job aggregation, market analytics, and insights for the French tech market.
      
      **Features:**
      - Comprehensive job search with advanced filtering
      - Market analytics and salary insights
      - Technology and regional trends
      - Multi-source job aggregation with deduplication
      
      **Data Sources:**
      - Adzuna
      - France Travail (Pôle Emploi)
      - And more...
    `,
    contact: {
      name: 'API Support',
      email: 'support@techmap-france.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:{port}',
      description: 'Development server',
      variables: {
        port: {
          default: '3000',
          description: 'Port number',
        },
      },
    },
    {
      url: 'https://techmap-france.onrender.com',
      description: 'Production server (Render)',
    },
  ],
  tags: [
    {
      name: 'Jobs',
      description: 'Job listing operations - search, filter, and retrieve job postings',
    },
    {
      name: 'Analytics',
      description: 'Market analytics, statistics, and insights',
    },
    {
      name: 'Technologies',
      description: 'Technology information, trends, and statistics',
    },
    {
      name: 'Regions',
      description: 'Regional market data and statistics',
    },
    {
      name: 'Ingestion',
      description: 'Data ingestion operations (protected)',
    },
  ],
  components: {
    schemas: {
      // ==================== Common Schemas ====================
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error type',
            example: 'ValidationError',
          },
          message: {
            type: 'string',
            description: 'Error message',
            example: 'Invalid input provided',
          },
        },
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          data: {
            type: 'object',
            description: 'Response data',
          },
          meta: {
            type: 'object',
            description: 'Additional metadata',
          },
        },
      },

      // ==================== Job Schemas ====================
      Job: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique job identifier',
            example: 'job_12345',
          },
          title: {
            type: 'string',
            description: 'Job title',
            example: 'Développeur Full Stack Senior',
          },
          company: {
            type: 'string',
            description: 'Company name',
            example: 'Tech Corp France',
          },
          description: {
            type: 'string',
            description: 'Full job description',
          },
          technologies: {
            type: 'array',
            description: 'Required technologies/skills',
            items: {
              type: 'string',
            },
            example: ['React', 'Node.js', 'PostgreSQL'],
          },
          location: {
            type: 'string',
            description: 'Job location',
            example: 'Paris, Île-de-France',
          },
          regionId: {
            type: 'number',
            description: 'Associated region ID',
            example: 1,
            nullable: true,
          },
          isRemote: {
            type: 'boolean',
            description: 'Whether the job is remote',
            example: false,
          },
          salary: {
            type: 'object',
            nullable: true,
            properties: {
              min: {
                type: 'number',
                description: 'Minimum salary in k€',
                example: 50,
                nullable: true,
              },
              max: {
                type: 'number',
                description: 'Maximum salary in k€',
                example: 70,
                nullable: true,
              },
              midpoint: {
                type: 'number',
                description: 'Salary midpoint in k€',
                example: 60,
                nullable: true,
              },
              unit: {
                type: 'string',
                example: 'k€',
              },
              currency: {
                type: 'string',
                example: 'EUR',
              },
              isCompetitive: {
                type: 'boolean',
                example: true,
              },
            },
          },
          experienceLevel: {
            type: 'string',
            description: 'Experience level as detected from job description',
            example: 'Senior',
            nullable: true,
          },
          experienceCategory: {
            type: 'string',
            description: 'Normalized experience category',
            enum: ['junior', 'mid', 'senior', 'lead', 'unknown'],
            example: 'senior',
          },
          sourceApi: {
            type: 'string',
            description: 'Primary source API identifier',
            example: 'welcome_to_the_jungle',
          },
          sourceApis: {
            type: 'array',
            description: 'All source APIs where this job was found (deduplicated)',
            items: {
              type: 'string',
            },
            example: ['welcome_to_the_jungle', 'france_travail'],
          },
          externalId: {
            type: 'string',
            description: 'External job ID from source',
            example: 'ext_98765',
          },
          sourceUrl: {
            type: 'string',
            description: 'Job posting URL',
            format: 'uri',
            example:
              'https://www.welcometothejungle.com/fr/companies/tech-corp/jobs/senior-developer',
          },
          isActive: {
            type: 'boolean',
            description: 'Whether the job is currently active',
            example: true,
          },
          postedDate: {
            type: 'string',
            format: 'date-time',
            description: 'Job posting date',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Record creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Record last update timestamp',
          },
          qualityScore: {
            type: 'number',
            description: 'Calculated job quality score (0-100)',
            example: 85,
            minimum: 0,
            maximum: 100,
          },
          isRecent: {
            type: 'boolean',
            description: 'Whether the job was posted recently',
            example: true,
          },
          isExpired: {
            type: 'boolean',
            description: 'Whether the job has expired',
            example: false,
          },
        },
      },

      JobSummary: {
        type: 'object',
        description: 'Lightweight job summary for list views',
        properties: {
          id: {
            type: 'string',
            example: 'job_12345',
          },
          title: {
            type: 'string',
            example: 'Développeur Full Stack Senior',
          },
          company: {
            type: 'string',
            example: 'Tech Corp France',
          },
          location: {
            type: 'string',
            example: 'Paris',
          },
          isRemote: {
            type: 'boolean',
            example: false,
          },
          technologies: {
            type: 'array',
            items: {
              type: 'string',
            },
            example: ['React', 'Node.js'],
          },
          salary: {
            type: 'object',
            nullable: true,
          },
          experienceCategory: {
            type: 'string',
            example: 'senior',
          },
          postedDate: {
            type: 'string',
            format: 'date-time',
          },
          qualityScore: {
            type: 'number',
            example: 85,
          },
        },
      },

      PaginatedJobs: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          data: {
            type: 'object',
            properties: {
              jobs: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Job',
                },
              },
              pagination: {
                type: 'object',
                properties: {
                  page: {
                    type: 'number',
                    example: 1,
                  },
                  pageSize: {
                    type: 'number',
                    example: 20,
                  },
                  totalPages: {
                    type: 'number',
                    example: 10,
                  },
                  totalItems: {
                    type: 'number',
                    example: 200,
                  },
                  hasNext: {
                    type: 'boolean',
                    example: true,
                  },
                  hasPrevious: {
                    type: 'boolean',
                    example: false,
                  },
                },
              },
              filters: {
                type: 'object',
                description: 'Applied filters',
                properties: {
                  technologies: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  regionIds: {
                    type: 'array',
                    items: { type: 'number' },
                  },
                  experienceCategories: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  isRemote: {
                    type: 'boolean',
                  },
                  minSalary: {
                    type: 'number',
                  },
                  searchQuery: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      },

      SearchResult: {
        type: 'object',
        description: 'Search result with relevance scoring',
        properties: {
          job: {
            $ref: '#/components/schemas/Job',
          },
          relevanceScore: {
            type: 'number',
            description: 'Relevance score (0-100)',
            example: 87.5,
          },
          matchReasons: {
            type: 'array',
            description: 'Reasons why this job matches the search criteria',
            items: {
              type: 'string',
            },
            example: ['Matches 3/3 preferred technologies', 'High quality job posting'],
          },
        },
      },

      AdvancedSearchCriteria: {
        type: 'object',
        description: 'Advanced search criteria with weights',
        properties: {
          requiredTechnologies: {
            type: 'array',
            items: { type: 'string' },
            description: 'Technologies that must be present (AND)',
            example: ['React', 'TypeScript'],
          },
          preferredTechnologies: {
            type: 'array',
            items: { type: 'string' },
            description: 'Technologies that boost score (OR)',
            example: ['Node.js', 'PostgreSQL'],
          },
          preferredRegions: {
            type: 'array',
            items: { type: 'number' },
            description: 'Preferred region IDs',
            example: [1, 2],
          },
          experienceCategories: {
            type: 'array',
            items: { type: 'string' },
            example: ['mid', 'senior'],
          },
          minSalary: {
            type: 'number',
            example: 50,
          },
          maxSalary: {
            type: 'number',
            example: 80,
          },
          remoteOnly: {
            type: 'boolean',
            example: false,
          },
          remotePreferred: {
            type: 'boolean',
            example: true,
          },
          minQualityScore: {
            type: 'number',
            example: 70,
          },
          preferRecent: {
            type: 'boolean',
            example: true,
          },
          weights: {
            type: 'object',
            description: 'Custom scoring weights',
            properties: {
              technologyMatch: { type: 'number', example: 40 },
              experienceMatch: { type: 'number', example: 20 },
              salaryMatch: { type: 'number', example: 15 },
              locationMatch: { type: 'number', example: 10 },
              qualityScore: { type: 'number', example: 10 },
              recency: { type: 'number', example: 5 },
            },
          },
        },
      },

      JobComparison: {
        type: 'object',
        description: 'Comparison between multiple jobs',
        properties: {
          jobs: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Job',
            },
          },
          similarities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                jobId1: { type: 'string' },
                jobId2: { type: 'string' },
                similarityScore: { type: 'number', example: 0.75 },
                commonTechnologies: {
                  type: 'array',
                  items: { type: 'string' },
                },
                salaryComparison: {
                  type: 'object',
                  properties: {
                    job1Midpoint: { type: 'number', nullable: true },
                    job2Midpoint: { type: 'number', nullable: true },
                    difference: { type: 'number', nullable: true },
                  },
                },
                experienceMatch: { type: 'boolean' },
                locationMatch: { type: 'boolean' },
              },
            },
          },
        },
      },

      // ==================== Technology Schemas ====================
      Technology: {
        type: 'object',
        properties: {
          id: {
            type: 'number',
            description: 'Unique technology identifier',
            example: 1,
          },
          name: {
            type: 'string',
            description: 'Technology name (lowercase, canonical)',
            example: 'react',
          },
          displayName: {
            type: 'string',
            description: 'Display name',
            example: 'React',
          },
          category: {
            type: 'string',
            description: 'Technology category',
            example: 'frontend',
          },
          aliases: {
            type: 'array',
            description: 'Alternative names',
            items: {
              type: 'string',
            },
            example: ['reactjs', 'react.js'],
            nullable: true,
          },
          jobCount: {
            type: 'number',
            description: 'Number of jobs requiring this technology',
            example: 1250,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },

      // ==================== Region Schemas ====================
      Region: {
        type: 'object',
        properties: {
          id: {
            type: 'number',
            description: 'Unique region identifier',
            example: 1,
          },
          name: {
            type: 'string',
            description: 'Region name',
            example: 'Île-de-France',
          },
          code: {
            type: 'string',
            description: 'Region code',
            example: 'IDF',
          },
          country: {
            type: 'string',
            description: 'Country',
            example: 'France',
          },
          jobCount: {
            type: 'number',
            description: 'Number of active jobs in this region',
            example: 3420,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },

      // ==================== Analytics Schemas ====================
      DashboardStats: {
        type: 'object',
        properties: {
          totalJobs: {
            type: 'integer',
            description: 'Total number of jobs',
            example: 15420,
          },
          activeJobs: {
            type: 'integer',
            description: 'Number of active jobs',
            example: 12350,
          },
          recentJobs: {
            type: 'integer',
            description: 'Jobs posted in the last 7 days',
            example: 450,
          },
          companiesHiring: {
            type: 'integer',
            description: 'Number of companies currently hiring',
            example: 856,
          },
          averageSalary: {
            type: 'number',
            description: 'Average salary in k€',
            example: 55.5,
          },
          medianSalary: {
            type: 'number',
            description: 'Median salary in k€',
            example: 52.0,
          },
          remoteJobsPercentage: {
            type: 'number',
            description: 'Percentage of remote jobs',
            example: 42.5,
          },
        },
      },

      SalaryStats: {
        type: 'object',
        properties: {
          overall: {
            type: 'object',
            properties: {
              average: { type: 'number', example: 55.5 },
              median: { type: 'number', example: 52.0 },
              min: { type: 'number', example: 30.0 },
              max: { type: 'number', example: 120.0 },
              count: { type: 'integer', example: 8500 },
            },
          },
          byExperience: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                experienceLevel: { type: 'string', example: 'senior' },
                average: { type: 'number', example: 65.0 },
                median: { type: 'number', example: 62.0 },
                count: { type: 'integer', example: 3200 },
              },
            },
          },
          byTechnology: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                technology: { type: 'string', example: 'React' },
                average: { type: 'number', example: 58.0 },
                count: { type: 'integer', example: 1250 },
              },
            },
          },
          byRegion: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                region: { type: 'string', example: 'Île-de-France' },
                average: { type: 'number', example: 60.0 },
                count: { type: 'integer', example: 5200 },
              },
            },
          },
        },
      },

      MarketInsights: {
        type: 'object',
        properties: {
          hotTechnologies: {
            type: 'array',
            description: 'Trending technologies',
            items: {
              type: 'object',
              properties: {
                technology: { type: 'string' },
                jobCount: { type: 'integer' },
                growthRate: { type: 'number', description: 'Growth percentage' },
              },
            },
          },
          topRegions: {
            type: 'array',
            description: 'Top hiring regions',
            items: {
              type: 'object',
              properties: {
                region: { type: 'string' },
                jobCount: { type: 'integer' },
              },
            },
          },
          topCompanies: {
            type: 'array',
            description: 'Top hiring companies',
            items: {
              type: 'object',
              properties: {
                company: { type: 'string' },
                jobCount: { type: 'integer' },
              },
            },
          },
          experienceDistribution: {
            type: 'object',
            description: 'Distribution of jobs by experience level',
            additionalProperties: {
              type: 'integer',
            },
            example: {
              junior: 2500,
              mid: 5000,
              senior: 4000,
              lead: 1500,
            },
          },
          remoteVsOnsite: {
            type: 'object',
            properties: {
              remote: { type: 'integer', example: 5250 },
              onsite: { type: 'integer', example: 7170 },
            },
          },
        },
      },

      // ==================== Ingestion Schemas ====================
      IngestResult: {
        type: 'object',
        properties: {
          total: {
            type: 'integer',
            description: 'Total jobs processed',
            example: 100,
          },
          inserted: {
            type: 'integer',
            description: 'New jobs inserted',
            example: 75,
          },
          updated: {
            type: 'integer',
            description: 'Existing jobs updated',
            example: 20,
          },
          failed: {
            type: 'integer',
            description: 'Jobs that failed processing',
            example: 5,
          },
          errors: {
            type: 'array',
            items: { type: 'string' },
            description: 'Error messages',
          },
        },
      },
    },
    parameters: {
      // ==================== Pagination Parameters ====================
      PageParam: {
        in: 'query',
        name: 'page',
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1,
        },
        description: 'Page number',
      },
      PageSizeParam: {
        in: 'query',
        name: 'pageSize',
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20,
        },
        description: 'Number of items per page (max 100)',
      },
      LimitParam: {
        in: 'query',
        name: 'limit',
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 10,
        },
        description: 'Maximum number of results',
      },

      // ==================== Job Filter Parameters ====================
      TechnologiesParam: {
        in: 'query',
        name: 'technologies',
        schema: {
          type: 'string',
        },
        description: 'Comma-separated list of technologies (AND condition)',
        example: 'React,TypeScript,Node.js',
      },
      RegionIdsParam: {
        in: 'query',
        name: 'regionIds',
        schema: {
          type: 'string',
        },
        description: 'Comma-separated list of region IDs',
        example: '1,2,3',
      },
      ExperienceCategoriesParam: {
        in: 'query',
        name: 'experienceCategories',
        schema: {
          type: 'string',
        },
        description: 'Comma-separated list of experience levels',
        example: 'mid,senior',
      },
      IsRemoteParam: {
        in: 'query',
        name: 'isRemote',
        schema: {
          type: 'boolean',
        },
        description: 'Filter for remote jobs only',
      },
      MinSalaryParam: {
        in: 'query',
        name: 'minSalary',
        schema: {
          type: 'number',
        },
        description: 'Minimum salary in k€',
        example: 50,
      },
      MaxSalaryParam: {
        in: 'query',
        name: 'maxSalary',
        schema: {
          type: 'number',
        },
        description: 'Maximum salary in k€',
        example: 80,
      },
      MinQualityScoreParam: {
        in: 'query',
        name: 'minQualityScore',
        schema: {
          type: 'number',
          minimum: 0,
          maximum: 100,
        },
        description: 'Minimum quality score (0-100)',
        example: 70,
      },
      RecentParam: {
        in: 'query',
        name: 'recent',
        schema: {
          type: 'number',
        },
        description: 'Jobs posted in the last N days',
        example: 7,
      },
      CompanyParam: {
        in: 'query',
        name: 'company',
        schema: {
          type: 'string',
        },
        description: 'Filter by company name (case-insensitive)',
      },
      SearchQueryParam: {
        in: 'query',
        name: 'q',
        schema: {
          type: 'string',
        },
        description: 'Text search across title, company, and description',
        example: 'full stack developer',
      },
      ActiveOnlyParam: {
        in: 'query',
        name: 'activeOnly',
        schema: {
          type: 'boolean',
          default: true,
        },
        description: 'Show only active jobs',
      },
    },
  },
};

const options = {
  swaggerDefinition,
  apis: ['./src/presentation/api/routes/*.ts', './src/presentation/api/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
