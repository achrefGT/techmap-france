import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'job_aggregator',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Migration tracking table
async function createMigrationsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await pool.query(sql);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query('SELECT migration_name FROM schema_migrations');
  return new Set(result.rows.map(row => row.migration_name));
}

async function markMigrationAsApplied(migrationName: string) {
  await pool.query('INSERT INTO schema_migrations (migration_name) VALUES ($1)', [migrationName]);
}

async function runMigration(filename: string) {
  const filePath = path.join(
    __dirname,
    '..',
    'src',
    'infrastructure',
    'persistence',
    'migrations',
    filename
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(`Migration file not found: ${filename}`);
  }

  const sql = fs.readFileSync(filePath, 'utf-8');

  console.log(`📦 Running migration: ${filename}`);

  try {
    await pool.query(sql);
    await markMigrationAsApplied(filename);
    console.log(`✅ ${filename} completed successfully`);
  } catch (error) {
    console.error(`❌ ${filename} failed:`, error);
    throw error;
  }
}

async function migrate() {
  try {
    console.log('🚀 Starting database migration...\n');

    // Create migrations tracking table
    await createMigrationsTable();

    // Get already applied migrations
    const appliedMigrations = await getAppliedMigrations();

    // Get all migration files
    const migrationsDir = path.join(
      __dirname,
      '..',
      'src',
      'infrastructure',
      'persistence',
      'migrations'
    );

    if (!fs.existsSync(migrationsDir)) {
      console.log('⚠️  No migrations directory found. Creating it...');
      fs.mkdirSync(migrationsDir, { recursive: true });
      console.log('📁 Migrations directory created at:', migrationsDir);
      console.log('\n✅ Migration setup complete. Add migration files to run them.');
      return;
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure migrations run in order

    if (migrationFiles.length === 0) {
      console.log('⚠️  No migration files found in:', migrationsDir);
      console.log('✅ Migration tracking is set up. Add .sql files to run migrations.');
      return;
    }

    // Run pending migrations
    const pendingMigrations = migrationFiles.filter(file => !appliedMigrations.has(file));

    if (pendingMigrations.length === 0) {
      console.log('✅ All migrations are up to date!');
      return;
    }

    console.log(`Found ${pendingMigrations.length} pending migration(s):\n`);

    for (const migration of pendingMigrations) {
      await runMigration(migration);
    }

    console.log('\n✅ All migrations completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations
migrate();
