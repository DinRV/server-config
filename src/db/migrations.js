const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

async function getMigrationHistory(pool) {
  try {
    const result = await pool.query(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    return result.rows.map(row => row.version);
  } catch (err) {
    if (err.message.includes('does not exist')) {
      return [];
    }
    throw err;
  }
}

async function runMigrations(pool) {
  const client = await pool.connect();
  try {
    const appliedVersions = await getMigrationHistory(pool);
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const version = file.match(/^(\d+)/)?.[1];
      if (!version || appliedVersions.includes(version)) {
        continue;
      }

      console.log(`Applying migration ${version}: ${file}`);
      const sqlPath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      await client.query(sql);
      console.log(`✓ Migration ${version} applied successfully`);
    }
  } finally {
    client.release();
  }
}

module.exports = { runMigrations, getMigrationHistory };
