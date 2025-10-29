import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';


const poolMax = Number(process.env.PG_POOL_MAX ?? (isProduction ? 5 : 5));

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: poolMax,
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT ?? 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT ?? 10000),
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// simple helper
export const query = (text: string, params?: any[]) => pool.query(text, params);
