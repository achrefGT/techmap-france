import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { pool, query } from '../src/infrastructure/persistence/connection';

dotenv.config();

async function runSeed(filename: string) {
  const filePath = path.join(
    __dirname,
    '..',
    'src',
    'infrastructure',
    'persistence',
    'seeds',
    filename
  );

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Seed file not found: ${filename} (skipping)`);
    return;
  }

  const sql = fs.readFileSync(filePath, 'utf-8');

  console.log(`🌱 Running seed: ${filename}`);

  try {
    await query(sql);
    console.log(`✅ ${filename} completed`);
  } catch (error) {
    console.error(`❌ ${filename} failed:`, error);
    throw error;
  }
}

async function seed() {
  try {
    console.log('🌱 Starting database seeding...\n');

    const seedsDir = path.join(__dirname, '..', 'src', 'infrastructure', 'persistence', 'seeds');

    if (!fs.existsSync(seedsDir)) {
      console.log('⚠️  No seeds directory found. Creating it...');
      fs.mkdirSync(seedsDir, { recursive: true });
      console.log('📁 Seeds directory created at:', seedsDir);
      console.log('\n✅ Seed setup complete. Add seed files to populate data.');
      return;
    }

    // Run seeds in specific order
    const seedOrder = ['regions.sql', 'technologies.sql'];

    for (const seedFile of seedOrder) {
      await runSeed(seedFile);
    }

    // Get counts for confirmation
    const regionsResult = await query('SELECT COUNT(*) FROM regions');
    const techsResult = await query('SELECT COUNT(*) FROM technologies');

    console.log('\n📊 Database populated:');
    console.log(`   - Regions: ${regionsResult.rows[0].count}`);
    console.log(`   - Technologies: ${techsResult.rows[0].count}`);

    console.log('\n✅ All seeds completed successfully!');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run seeds
seed();
