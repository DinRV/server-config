const { Pool } = require('pg');
const { runMigrations } = require('./migrations');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/server_config',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function main() {
  try {
    console.log('Starting database migrations...');
    await runMigrations(pool);
    console.log('All migrations completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
