import 'dotenv/config';
import { FranceTravailAPI } from '../src/infrastructure/external/FranceTravailAPI';
import { AdzunaAPI } from '../src/infrastructure/external/AdzunaAPI';
import { RemotiveAPI } from '../src/infrastructure/external/RemotiveAPI';

/**
 * Test API Connectivity Script
 *
 * Tests each API independently to verify credentials and connectivity
 */

async function testFranceTravail() {
  console.log('\n📡 Testing France Travail API...');

  const clientId = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log('  ⚠️  Credentials not configured (skipping)');
    return;
  }

  try {
    const api = new FranceTravailAPI(clientId, clientSecret);
    const jobs = await api.fetchJobs({ maxResults: 5 });

    console.log(`  ✅ Success! Fetched ${jobs.length} jobs`);
    if (jobs.length > 0) {
      console.log(`  📄 Sample: "${jobs[0].title}" at ${jobs[0].company}`);
    }
  } catch (error) {
    console.error('  ❌ Failed:', error instanceof Error ? error.message : error);
  }
}

async function testAdzuna() {
  console.log('\n📡 Testing Adzuna API...');

  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    console.log('  ⚠️  Credentials not configured (skipping)');
    return;
  }

  try {
    const api = new AdzunaAPI(appId, appKey);
    const jobs = await api.fetchJobs({ maxPages: 1, resultsPerPage: 5 });

    console.log(`  ✅ Success! Fetched ${jobs.length} jobs`);
    if (jobs.length > 0) {
      console.log(`  📄 Sample: "${jobs[0].title}" at ${jobs[0].company}`);
    }
  } catch (error) {
    console.error('  ❌ Failed:', error instanceof Error ? error.message : error);
  }
}

async function testRemotive() {
  console.log('\n📡 Testing Remotive API...');

  try {
    const api = new RemotiveAPI();
    const jobs = await api.fetchJobs({ limit: 5 });

    console.log(`  ✅ Success! Fetched ${jobs.length} jobs`);
    if (jobs.length > 0) {
      console.log(`  📄 Sample: "${jobs[0].title}" at ${jobs[0].company}`);
    }
  } catch (error) {
    console.error('  ❌ Failed:', error instanceof Error ? error.message : error);
  }
}

async function main() {
  console.log('🔧 API Connectivity Test\n');
  console.log('='.repeat(60));

  await testFranceTravail();
  await testAdzuna();
  await testRemotive();

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ API tests complete\n');
}

main();
