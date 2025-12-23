const { Pool } = require('pg');

const PGUSER = process.env.PGUSER || process.env.DB_USER || 'postgres';
const PGPASSWORD = process.env.PGPASSWORD || process.env.DB_PASSWORD || 'postgres';
const PGHOST = process.env.PGHOST || 'localhost';
const PGPORT = process.env.PGPORT || 5432;
const PGDATABASE = process.env.PGDATABASE || process.env.DB_NAME || 'portal_db';

const pool = new Pool({
  user: PGUSER,
  password: PGPASSWORD,
  host: PGHOST,
  port: PGPORT,
  database: PGDATABASE,
});

async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

async function createDatabaseIfNotExists() {
  // Try common admin DB names in order: 'postgres', 'template1', or none
  const adminDbs = ['postgres', 'template1', undefined];
  let lastErr = null;

  for (const adminDb of adminDbs) {
    const adminConfig = {
      user: PGUSER,
      password: PGPASSWORD,
      host: PGHOST,
      port: PGPORT,
    };
    if (adminDb) adminConfig.database = adminDb;

    const adminPool = new Pool(adminConfig);
    try {
      const check = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [PGDATABASE]);
      if (check.rowCount === 0) {
        await adminPool.query(`CREATE DATABASE "${PGDATABASE}"`);
        console.log('Database created:', PGDATABASE);
      } else {
        console.log('Database already exists:', PGDATABASE);
      }
      await adminPool.end();
      return;
    } catch (err) {
      lastErr = err;
      await adminPool.end();
      // try next admin DB
    }
  }

  // If we get here, all attempts failed
  throw lastErr;
}

module.exports = { pool, query, createDatabaseIfNotExists };
