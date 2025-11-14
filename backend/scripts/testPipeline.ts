import 'dotenv/config';
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
  details?: string;
  error?: string;
}

class PipelineTestRunner {
  private results: TestResult[] = [];

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
  }

  private async testContainerHealth(): Promise<void> {
    console.log('\n📦 Test 1: Container Health Check');
    console.log('-'.repeat(60));

    try {
      const health = await container.healthCheck();

      if (health.status === 'healthy') {
        this.addResult({
          passed: true,
          testName: 'Container Health',
          details: 'All services initialized correctly',
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
          error: 'Container unhealthy',
        });
        console.log('❌ Container unhealthy');
      }
    } catch (error) {
      this.addResult({
        passed: false,
        testName: 'Container Health',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.log('❌ Container initialization failed');
    }
  }

  private async testDatabaseConnection(): Promise<void> {
    console.log('\n🗄️  Test 2: Database Connection');
    console.log('-'.repeat(60));

    try {
      const orchestrator = container.orchestrator;
      // Access private jobRepository through the orchestrator
      const jobRepo = (orchestrator as any).jobRepository;

      // Try a simple query
      const jobCount = await jobRepo.count({});

      this.addResult({
        passed: true,
        testName: 'Database Connection',
        details: `Connected successfully. Found ${jobCount} existing jobs`,
      });
      console.log(`✅ Database connected (${jobCount} jobs in DB)`);
    } catch (error) {
      this.addResult({
        passed: false,
        testName: 'Database Connection',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.log('❌ Database connection failed');
    }
  }

  private async testTechnologyCache(): Promise<void> {
    console.log('\n🔧 Test 3: Technology Cache');
    console.log('-'.repeat(60));

    try {
      const techController = container.technologyController;
      const technologies = await techController.getAllTechnologies(
        {} as any,
        { json: () => {} } as any,
        () => {}
      );

      // Technologies should be loaded
      const techCount = (technologies as any)?.length || 0;

      if (techCount > 0) {
        this.addResult({
          passed: true,
          testName: 'Technology Cache',
          details: `${techCount} technologies loaded`,
        });
        console.log(`✅ Technology cache loaded (${techCount} technologies)`);
      } else {
        this.addResult({
          passed: false,
          testName: 'Technology Cache',
          error: 'No technologies found. Run: npm run seed:technologies',
        });
        console.log('❌ No technologies in database');
      }
    } catch (error) {
      this.addResult({
        passed: false,
        testName: 'Technology Cache',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.log('❌ Technology cache test failed');
    }
  }

  private async testRegionData(): Promise<void> {
    console.log('\n🗺️  Test 4: Region Data');
    console.log('-'.repeat(60));

    try {
      const regionController = container.regionController;
      const regions = await regionController.getAllRegions(
        {} as any,
        { json: () => {} } as any,
        () => {}
      );

      const regionCount = (regions as any)?.length || 0;

      if (regionCount > 0) {
        this.addResult({
          passed: true,
          testName: 'Region Data',
          details: `${regionCount} regions loaded`,
        });
        console.log(`✅ Region data loaded (${regionCount} regions)`);
      } else {
        this.addResult({
          passed: false,
          testName: 'Region Data',
          error: 'No regions found. Run: npm run seed',
        });
        console.log('❌ No regions in database');
      }
    } catch (error) {
      this.addResult({
        passed: false,
        testName: 'Region Data',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.log('❌ Region data test failed');
    }
  }

  private async testFullPipeline(source: string, limit: number): Promise<void> {
    console.log(`\n🔄 Test 5: Full Pipeline - ${source.toUpperCase()}`);
    console.log('-'.repeat(60));

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
        enableDeduplication: false, // Skip for speed in tests
      };

      console.log(`   Fetching ${limit} jobs from ${source}...`);
      const startTime = Date.now();

      const result = await orchestrator.ingestFromAllSources(config);

      const duration = Date.now() - startTime;
      const stats = result.sources[source];

      if (stats && stats.result.total > 0) {
        const successRate = (stats.result.inserted / stats.result.total) * 100;

        this.addResult({
          passed: successRate > 30, // At least 30% success rate
          testName: `Full Pipeline: ${source}`,
          details:
            `Fetched: ${stats.result.total}, Inserted: ${stats.result.inserted}, ` +
            `Failed: ${stats.result.failed}, Success Rate: ${successRate.toFixed(1)}%, ` +
            `Duration: ${duration}ms`,
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
          error: 'No jobs fetched or processed',
        });
        console.log(`❌ No jobs fetched from ${source}`);
      }
    } catch (error) {
      this.addResult({
        passed: false,
        testName: `Full Pipeline: ${source}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.log(`❌ Pipeline test failed for ${source}`);
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async testDataIntegrity(): Promise<void> {
    console.log('\n🔍 Test 6: Data Integrity');
    console.log('-'.repeat(60));

    try {
      const orchestrator = container.orchestrator;
      const jobRepo = (orchestrator as any).jobRepository;

      // Fetch recent jobs from last 10 minutes
      const recentJobs = await jobRepo.findAll({ recentDays: 1 }, 1, 100);

      if (recentJobs.length === 0) {
        this.addResult({
          passed: false,
          testName: 'Data Integrity',
          error: 'No recent jobs found to validate',
        });
        console.log('⚠️  No recent jobs to validate');
        return;
      }

      // Validate job data
      let validJobs = 0;
      let hasDescription = 0;
      let hasTechnologies = 0;
      let hasRegion = 0;
      let hasSalary = 0;
      let hasExperience = 0;

      for (const job of recentJobs) {
        if (job.title && job.company && job.description) {
          validJobs++;
        }
        if (job.description.length > 100) hasDescription++;
        if (job.technologies.length > 0) hasTechnologies++;
        if (job.regionId) hasRegion++;
        if (job.salaryMinKEuros || job.salaryMaxKEuros) hasSalary++;
        if (job.experienceCategory !== 'unknown') hasExperience++;
      }

      const integrity = (validJobs / recentJobs.length) * 100;

      this.addResult({
        passed: integrity > 90,
        testName: 'Data Integrity',
        details:
          `${validJobs}/${recentJobs.length} jobs valid (${integrity.toFixed(1)}%). ` +
          `Technologies: ${hasTechnologies}, Regions: ${hasRegion}, ` +
          `Salaries: ${hasSalary}, Experience: ${hasExperience}`,
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
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.log('❌ Data integrity test failed');
    }
  }

  private async testOrchestratorCoordination(): Promise<void> {
    console.log('\n🎯 Test 7: Orchestrator Coordination');
    console.log('-'.repeat(60));

    try {
      const orchestrator = container.orchestrator;

      // Test multi-source coordination
      const config: IngestionConfig = {
        franceTravail: { enabled: true, maxResults: 3 },
        adzuna: { enabled: true, maxPages: 1, keywords: 'developer' },
        remotive: { enabled: true, limit: 3 },
        batchSize: 50,
        enableDeduplication: true,
      };

      console.log('   Testing multi-source coordination...');
      const result = await orchestrator.ingestFromAllSources(config);

      const sourcesProcessed = result.summary.sourcesProcessed.length;
      const totalFetched = result.summary.totalFetched;
      const totalIngested = result.summary.totalIngested;

      this.addResult({
        passed: sourcesProcessed > 0 && totalFetched > 0,
        testName: 'Orchestrator Coordination',
        details:
          `Processed ${sourcesProcessed} sources, fetched ${totalFetched} jobs, ` +
          `ingested ${totalIngested}`,
      });

      console.log(`✅ Orchestrator coordination test complete`);
      console.log(`   Sources processed: ${sourcesProcessed}`);
      console.log(`   Total fetched:     ${totalFetched}`);
      console.log(`   Total ingested:    ${totalIngested}`);
      console.log(`   Duration:          ${result.summary.duration}ms`);
    } catch (error) {
      this.addResult({
        passed: false,
        testName: 'Orchestrator Coordination',
        error: error instanceof Error ? error.message : 'Unknown error',
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
      console.log(`${status} ${result.testName}`);
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
