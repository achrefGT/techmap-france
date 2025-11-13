import 'dotenv/config';
import { container } from '../src/presentation/api/container';
import { IngestionConfig } from '../src/application/use-cases/IngestionOrchestrator';

/**
 * Fetch Jobs Script
 *
 * Usage:
 *   npm run fetch-jobs              # Fetch from all enabled sources
 *   npm run fetch-jobs france       # Fetch only from France Travail
 *   npm run fetch-jobs adzuna        # Fetch only from Adzuna
 *   npm run fetch-jobs remotive      # Fetch only from Remotive
 */

async function main() {
  const args = process.argv.slice(2);
  const source = args[0]?.toLowerCase();

  console.log('🚀 Starting job fetch...\n');

  try {
    const orchestrator = container.orchestrator;

    // Default configuration
    const config: IngestionConfig = {
      franceTravail: {
        enabled: false,
        maxResults: 150,
        searchParams: {
          motsCles: 'développeur',
        },
      },
      adzuna: {
        enabled: false,
        maxResults: 150,
        keywords: 'développeur',
        maxPages: 3,
      },
      remotive: {
        enabled: false,
        limit: 50,
        category: 'software-dev',
      },
      batchSize: 100,
      enableDeduplication: true,
      deduplicateAcrossSources: true,
    };

    // Enable sources based on argument or enable all
    if (!source || source === 'all') {
      config.franceTravail!.enabled = true;
      config.adzuna!.enabled = true;
      config.remotive!.enabled = true;
      console.log('📡 Fetching from all sources\n');
    } else if (source === 'france' || source === 'francetravail') {
      config.franceTravail!.enabled = true;
      console.log('📡 Fetching from France Travail only\n');
    } else if (source === 'adzuna') {
      config.adzuna!.enabled = true;
      console.log('📡 Fetching from Adzuna only\n');
    } else if (source === 'remotive') {
      config.remotive!.enabled = true;
      console.log('📡 Fetching from Remotive only\n');
    } else {
      console.error(`❌ Unknown source: ${source}`);
      console.log('Valid sources: all, france, adzuna, remotive');
      process.exit(1);
    }

    // Run orchestrated ingestion
    const result = await orchestrator.ingestFromAllSources(config);

    // Display results
    console.log('\n' + '='.repeat(60));
    console.log('✅ JOB FETCH COMPLETE');
    console.log('='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`  • Total Fetched:     ${result.summary.totalFetched}`);
    console.log(`  • Total Ingested:    ${result.summary.totalIngested}`);
    console.log(`  • Total Failed:      ${result.summary.totalFailed}`);
    console.log(`  • Total Duplicated:  ${result.summary.totalDuplicated}`);
    console.log(`  • Duration:          ${result.summary.duration}ms`);
    console.log(`  • Sources Processed: ${result.summary.sourcesProcessed.join(', ')}`);

    if (result.summary.sourcesSkipped.length > 0) {
      console.log(`  • Sources Skipped:   ${result.summary.sourcesSkipped.join(', ')}`);
    }

    // Per-source breakdown
    console.log(`\n📋 Per-Source Results:`);
    for (const [sourceName, stats] of Object.entries(result.sources)) {
      console.log(`\n  ${sourceName.toUpperCase()}:`);
      console.log(`    • Fetched:  ${stats.result.total}`);
      console.log(`    • Inserted: ${stats.result.inserted}`);
      console.log(`    • Updated:  ${stats.result.updated}`);
      console.log(`    • Failed:   ${stats.result.failed}`);
      if (stats.result.errors.length > 0) {
        console.log(`    • Errors:   ${stats.result.errors.length}`);
      }
    }

    // Deduplication stats
    if (result.deduplication) {
      console.log(`\n🔄 Deduplication:`);
      console.log(`  • Duplicate Rate:    ${result.deduplication.duplicateRate.toFixed(2)}%`);
      console.log(`  • Multi-Source Jobs: ${result.deduplication.multiSourceJobs}`);
      console.log(`  • Avg Quality Score: ${result.deduplication.averageQualityScore}`);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Shutdown
    await container.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during job fetch:', error);
    await container.shutdown();
    process.exit(1);
  }
}

main();
