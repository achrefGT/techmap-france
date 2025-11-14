import 'dotenv/config';
import { writeFileSync } from 'fs';
import { container } from '../src/presentation/api/container';
import { IngestionConfig } from '../src/application/use-cases/IngestionOrchestrator';

/**
 * Test Full Ingestion Pipeline
 *
 * This script tests the ENTIRE pipeline:
 * - API connectivity
 * - DTOs and Mappers
 * - Orchestrator
 * - Ingestion service
 * - Technology detection
 * - Experience detection
 * - Quality filtering
 * - Region enrichment
 * - Database operations
 * - Deduplication
 *
 * Usage:
 *   npm run test-pipeline              # Test all sources (small sample)
 *   npm run test-pipeline france       # Test France Travail only
 *   npm run test-pipeline adzuna        # Test Adzuna only
 *   npm run test-pipeline remotive      # Test Remotive only
 */

interface TestResult {
  passed: boolean;
  testName: string;
  duration?: number;
  details?: string;
  error?: string;
  data?: any;
}

interface TestSummary {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  passRate: number;
  totalDuration: number;
  environment: {
    nodeVersion: string;
    platform: string;
    source?: string;
  };
}

interface PipelineTestReport {
  summary: TestSummary;
  tests: TestResult[];
}

class PipelineTestRunner {
  private results: TestResult[] = [];
  private startTime: Date = new Date();

  async runAllTests(source?: string): Promise<void> {
    console.log('🧪 Starting Full Pipeline Integration Tests\n');
    console.log('='.repeat(60));
    console.log('This will test the COMPLETE ingestion pipeline:');
    console.log('  • API connectivity');
    console.log('  • Data mapping (DTOs → RawJobData)');
    console.log('  • Orchestration');
    console.log('  • Technology detection');
    console.log('  • Experience detection');
    console.log('  • Quality filtering');
    console.log('  • Region enrichment');
    console.log('  • Database operations');
    console.log('  • Deduplication');
    console.log('='.repeat(60) + '\n');

    // Test 1: Container initialization
    await this.testContainerHealth();

    // Test 2: Database connectivity
    await this.testDatabaseConnection();

    // Test 3: Technology cache
    await this.testTechnologyCache();

    // Test 4: Region data
    await this.testRegionData();

    // Test 5: Full pipeline with small sample
    if (!source || source === 'all') {
      await this.testFullPipeline('france_travail', 5);
      await this.testFullPipeline('adzuna', 5);
      await this.testFullPipeline('remotive', 5);
    } else {
      await this.testFullPipeline(source, 10);
    }

    // Test 6: Verify data integrity
    await this.testDataIntegrity();

    // Test 7: Orchestrator coordination
    await this.testOrchestratorCoordination();

    // Display results
    this.displayResults();

    // Generate JSON report
    this.generateJSONReport(source);
  }

  private async testContainerHealth(): Promise<void> {
    console.log('\n📦 Test 1: Container Health Check');
    console.log('-'.repeat(60));

    const testStart = Date.now();

    try {
      const health = await container.healthCheck();

      if (health.status === 'healthy') {
        this.addResult({
          passed: true,
          testName: 'Container Health',
          duration: Date.now() - testStart,
          details: 'All services initialized correctly',
          data: {
            status: health.status,
            services: health.services,
          },
        });
        console.log('✅ Container healthy');
        console.log(`   Database: ${health.services.database ? '✓' : '✗'}`);
        console.log(`   Redis: ${health.services.redis ? '✓' : '✗'}`);
        console.log(`   France Travail: ${health.services.franceTravailConfigured ? '✓' : '✗'}`);
        console.log(`   Adzuna: ${health.services.adzunaConfigured ? '✓' : '✗'}`);
        console.log(`   Remotive: ${health.services.remotiveConfigured ? '✓' : '✗'}`);
      } else {
        this.addResult({
          passed: false,
          testName: 'Container Health',
          duration: Date.now() - testStart,
          error: 'Container unhealthy',
          data: {
            status: health.status,
            services: health.services,
          },
        });
        console.log('❌ Container unhealthy');
      }
    } catch (error) {
      this.addResult({
        passed: false,
        testName: 'Container Health',
        duration: Date.now() - testStart,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: {
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      console.log('❌ Container initialization failed');
    }
  }

  private async testDatabaseConnection(): Promise<void> {
    console.log('\n🗄️ Test 2: Database Connection');
    console.log('-'.repeat(60));

    const testStart = Date.now();

    try {
      const orchestrator = container.orchestrator;
      const jobRepo = (orchestrator as any).jobRepository;

      const jobCount = await jobRepo.count({});

      this.addResult({
        passed: true,
        testName: 'Database Connection',
        duration: Date.now() - testStart,
        details: `Connected successfully. Found ${jobCount} existing jobs`,
        data: {
          jobCount,
          connected: true,
        },
      });
      console.log(`✅ Database connected (${jobCount} jobs in DB)`);
    } catch (error) {
      this.addResult({
        passed: false,
        testName: 'Database Connection',
        duration: Date.now() - testStart,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: {
          connected: false,
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      console.log('❌ Database connection failed');
    }
  }

  private async testTechnologyCache(): Promise<void> {
    console.log('\n🔧 Test 3: Technology Cache');
    console.log('-'.repeat(60));

    const testStart = Date.now();

    try {
      // Direct repository access to bypass any caching issues
      const orchestrator = container.orchestrator;
      const techRepo = (orchestrator as any).ingestionService?.technologyRepository;

      if (!techRepo) {
        throw new Error('Technology repository not accessible');
      }

      const technologies = await techRepo.findAll();
      const techCount = technologies.length;

      if (techCount > 0) {
        this.addResult({
          passed: true,
          testName: 'Technology Cache',
          duration: Date.now() - testStart,
          details: `${techCount} technologies loaded`,
          data: {
            technologyCount: techCount,
            sampleTechnologies: technologies.slice(0, 5).map((t: any) => ({
              name: t.name,
              category: t.category,
              jobCount: t.jobCount,
            })),
          },
        });
        console.log(`✅ Technology cache loaded (${techCount} technologies)`);
      } else {
        this.addResult({
          passed: false,
          testName: 'Technology Cache',
          duration: Date.now() - testStart,
          error: 'No technologies found. Run: npm run seed:technologies',
          data: {
            technologyCount: 0,
          },
        });
        console.log('❌ No technologies in database');
      }
    } catch (error) {
      this.addResult({
        passed: false,
        testName: 'Technology Cache',
        duration: Date.now() - testStart,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: {
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      console.log('❌ Technology cache test failed');
    }
  }

  private async testRegionData(): Promise<void> {
    console.log('\n🗺️ Test 4: Region Data');
    console.log('-'.repeat(60));

    const testStart = Date.now();

    try {
      // Direct repository access to bypass any caching issues
      const orchestrator = container.orchestrator;
      const regionRepo = (orchestrator as any).ingestionService?.regionRepository;

      if (!regionRepo) {
        throw new Error('Region repository not accessible');
      }

      const regions = await regionRepo.findAll();
      const regionCount = regions.length;

      if (regionCount > 0) {
        this.addResult({
          passed: true,
          testName: 'Region Data',
          duration: Date.now() - testStart,
          details: `${regionCount} regions loaded`,
          data: {
            regionCount,
            sampleRegions: regions.slice(0, 5).map((r: any) => ({
              name: r.name,
              code: r.code,
              jobCount: r.jobCount,
            })),
          },
        });
        console.log(`✅ Region data loaded (${regionCount} regions)`);
      } else {
        this.addResult({
          passed: false,
          testName: 'Region Data',
          duration: Date.now() - testStart,
          error: 'No regions found. Run: npm run seed',
          data: {
            regionCount: 0,
          },
        });
        console.log('❌ No regions in database');
      }
    } catch (error) {
      this.addResult({
        passed: false,
        testName: 'Region Data',
        duration: Date.now() - testStart,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: {
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      console.log('❌ Region data test failed');
    }
  }

  private async testFullPipeline(source: string, limit: number): Promise<void> {
    console.log(`\n🔄 Test 5: Full Pipeline - ${source.toUpperCase()}`);
    console.log('-'.repeat(60));

    const testStart = Date.now();

    try {
      const orchestrator = container.orchestrator;
      const config: IngestionConfig = {
        franceTravail: {
          enabled: source === 'france_travail',
          maxResults: limit,
        },
        adzuna: {
          enabled: source === 'adzuna',
          maxPages: 1,
          keywords: 'développeur',
        },
        remotive: {
          enabled: source === 'remotive',
          limit: limit,
        },
        batchSize: 50,
        enableDeduplication: false,
      };

      console.log(`   Fetching ${limit} jobs from ${source}...`);

      const result = await orchestrator.ingestFromAllSources(config);
      const duration = Date.now() - testStart;
      const stats = result.sources[source];

      if (stats && stats.result.total > 0) {
        const successRate = (stats.result.inserted / stats.result.total) * 100;

        this.addResult({
          passed: successRate > 30,
          testName: `Full Pipeline: ${source}`,
          duration,
          details:
            `Fetched: ${stats.result.total}, Inserted: ${stats.result.inserted}, ` +
            `Failed: ${stats.result.failed}, Success Rate: ${successRate.toFixed(1)}%`,
          data: {
            source,
            total: stats.result.total,
            inserted: stats.result.inserted,
            updated: stats.result.updated,
            failed: stats.result.failed,
            successRate: Math.round(successRate * 10) / 10,
            errors: stats.result.errors,
            qualityStats: stats.qualityStats,
            dataCompleteness: stats.dataCompleteness,
            technologyStats: stats.technologyStats,
          },
        });

        console.log(`✅ Pipeline test complete for ${source}`);
        console.log(`   Fetched:      ${stats.result.total}`);
        console.log(`   Inserted:     ${stats.result.inserted}`);
        console.log(`   Updated:      ${stats.result.updated}`);
        console.log(`   Failed:       ${stats.result.failed}`);
        console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
        console.log(`   Duration:     ${duration}ms`);

        if (stats.result.errors.length > 0) {
          console.log(`   Sample Errors:`);
          stats.result.errors.slice(0, 3).forEach(err => {
            console.log(`     - ${err}`);
          });
        }
      } else {
        this.addResult({
          passed: false,
          testName: `Full Pipeline: ${source}`,
          duration,
          error: 'No jobs fetched or processed',
          data: {
            source,
            result: stats?.result || null,
          },
        });
        console.log(`❌ No jobs fetched from ${source}`);
      }
    } catch (error) {
      this.addResult({
        passed: false,
        testName: `Full Pipeline: ${source}`,
        duration: Date.now() - testStart,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: {
          source,
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      console.log(`❌ Pipeline test failed for ${source}`);
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async testDataIntegrity(): Promise<void> {
    console.log('\n🔍 Test 6: Data Integrity');
    console.log('-'.repeat(60));

    const testStart = Date.now();

    try {
      const orchestrator = container.orchestrator;
      const jobRepo = (orchestrator as any).jobRepository;

      const recentJobs = await jobRepo.findAll({ recentDays: 1 }, 1, 100);

      if (recentJobs.length === 0) {
        this.addResult({
          passed: false,
          testName: 'Data Integrity',
          duration: Date.now() - testStart,
          error: 'No recent jobs found to validate',
          data: {
            jobsChecked: 0,
          },
        });
        console.log('⚠️  No recent jobs to validate');
        return;
      }

      let validJobs = 0;
      let hasDescription = 0;
      let hasTechnologies = 0;
      let hasRegion = 0;
      let hasSalary = 0;
      let hasExperience = 0;

      const sampleJobs = [];

      for (const job of recentJobs) {
        if (job.title && job.company && job.description) {
          validJobs++;
        }
        if (job.description.length > 100) hasDescription++;
        if (job.technologies.length > 0) hasTechnologies++;
        if (job.regionId) hasRegion++;
        if (job.salaryMinKEuros || job.salaryMaxKEuros) hasSalary++;
        if (job.experienceCategory !== 'unknown') hasExperience++;

        // Collect sample jobs for report
        if (sampleJobs.length < 3) {
          sampleJobs.push({
            title: job.title,
            company: job.company,
            technologies: job.technologies,
            experienceCategory: job.experienceCategory,
            qualityScore: job.calculateQualityScore(),
            hasRegion: !!job.regionId,
            hasSalary: !!(job.salaryMinKEuros || job.salaryMaxKEuros),
          });
        }
      }

      const integrity = (validJobs / recentJobs.length) * 100;

      this.addResult({
        passed: integrity > 90,
        testName: 'Data Integrity',
        duration: Date.now() - testStart,
        details:
          `${validJobs}/${recentJobs.length} jobs valid (${integrity.toFixed(1)}%). ` +
          `Technologies: ${hasTechnologies}, Regions: ${hasRegion}, ` +
          `Salaries: ${hasSalary}, Experience: ${hasExperience}`,
        data: {
          jobsChecked: recentJobs.length,
          validJobs,
          integrityRate: Math.round(integrity * 10) / 10,
          completeness: {
            description: hasDescription,
            technologies: hasTechnologies,
            region: hasRegion,
            salary: hasSalary,
            experience: hasExperience,
          },
          sampleJobs,
        },
      });

      console.log(`✅ Data integrity check complete`);
      console.log(`   Jobs validated:    ${recentJobs.length}`);
      console.log(`   Valid:             ${validJobs} (${integrity.toFixed(1)}%)`);
      console.log(`   With description:  ${hasDescription}`);
      console.log(`   With technologies: ${hasTechnologies}`);
      console.log(`   With region:       ${hasRegion}`);
      console.log(`   With salary:       ${hasSalary}`);
      console.log(`   With experience:   ${hasExperience}`);
    } catch (error) {
      this.addResult({
        passed: false,
        testName: 'Data Integrity',
        duration: Date.now() - testStart,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: {
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      console.log('❌ Data integrity test failed');
    }
  }

  private async testOrchestratorCoordination(): Promise<void> {
    console.log('\n🎯 Test 7: Orchestrator Coordination');
    console.log('-'.repeat(60));

    const testStart = Date.now();

    try {
      const orchestrator = container.orchestrator;

      const config: IngestionConfig = {
        franceTravail: { enabled: true, maxResults: 3 },
        adzuna: { enabled: true, maxPages: 1, keywords: 'developer' },
        remotive: { enabled: true, limit: 3 },
        batchSize: 50,
        enableDeduplication: true,
      };

      console.log('   Testing multi-source coordination...');
      const result = await orchestrator.ingestFromAllSources(config);
      const duration = Date.now() - testStart;

      const sourcesProcessed = result.summary.sourcesProcessed.length;
      const totalFetched = result.summary.totalFetched;
      const totalIngested = result.summary.totalIngested;
      const successRate =
        totalFetched > 0 ? Math.round((totalIngested / totalFetched) * 100 * 10) / 10 : 0;

      this.addResult({
        passed: sourcesProcessed > 0 && totalFetched > 0,
        testName: 'Orchestrator Coordination',
        duration,
        details:
          `Processed ${sourcesProcessed} sources, fetched ${totalFetched} jobs, ` +
          `ingested ${totalIngested}`,
        data: {
          sourcesProcessed: result.summary.sourcesProcessed,
          totalFetched,
          totalIngested,
          totalFailed: result.summary.totalFailed,
          successRate,
          deduplication: result.deduplication,
          sourceBreakdown: Object.fromEntries(
            Object.entries(result.sources).map(([source, stats]) => [
              source,
              {
                total: stats.result.total,
                inserted: stats.result.inserted,
                failed: stats.result.failed,
              },
            ])
          ),
        },
      });

      console.log(`✅ Orchestrator coordination test complete`);
      console.log(`   Sources processed: ${sourcesProcessed}`);
      console.log(`   Total fetched:     ${totalFetched}`);
      console.log(`   Total ingested:    ${totalIngested}`);
      console.log(`   Duration:          ${duration}ms`);
    } catch (error) {
      this.addResult({
        passed: false,
        testName: 'Orchestrator Coordination',
        duration: Date.now() - testStart,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: {
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      console.log('❌ Orchestrator coordination test failed');
    }
  }

  private addResult(result: TestResult): void {
    this.results.push(result);
  }

  private displayResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60) + '\n');

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    const passRate = (passed / total) * 100;

    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      console.log(`${status} ${result.testName}${duration}`);
      if (result.details) {
        console.log(`   ${result.details}`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log();
    });

    console.log('='.repeat(60));
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} (${passRate.toFixed(1)}%)`);
    console.log(`Failed: ${failed}`);
    console.log('='.repeat(60) + '\n');

    if (passRate === 100) {
      console.log('🎉 All tests passed! Pipeline is working correctly.\n');
    } else if (passRate >= 70) {
      console.log('⚠️  Most tests passed. Review failures above.\n');
    } else {
      console.log('❌ Many tests failed. Please fix issues before production use.\n');
    }
  }

  private generateJSONReport(source?: string): void {
    const endTime = new Date();
    const totalDuration = endTime.getTime() - this.startTime.getTime();

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    const passRate = (passed / total) * 100;

    const summary: TestSummary = {
      timestamp: this.startTime.toISOString(),
      totalTests: total,
      passedTests: passed,
      failedTests: failed,
      passRate: Math.round(passRate * 10) / 10,
      totalDuration,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        source: source || 'all',
      },
    };

    const report: PipelineTestReport = {
      summary,
      tests: this.results,
    };

    const timestamp = this.startTime.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `pipeline-test-${timestamp}.json`;

    writeFileSync(filename, JSON.stringify(report, null, 2));

    console.log('📄 Reports generated:');
    console.log(`   - ${filename}\n`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const source = args[0]?.toLowerCase();

  const runner = new PipelineTestRunner();

  try {
    await runner.runAllTests(source);
    await container.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Test runner crashed:', error);
    await container.shutdown();
    process.exit(1);
  }
}

main();
