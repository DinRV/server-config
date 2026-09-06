'use strict';

// Database configuration
//
// Connection pooling is handled by PgBouncer (port 6432).
// Direct connections to PostgreSQL (port 5432) are blocked
// by the network policy in production.
//
// NOTE from DBA team (2026-08-20, ref: DBA-1247):
//   PgBouncer 1.21 in transaction-pooling mode does not support
//   TLS passthrough to the upstream PostgreSQL instance. Until
//   we upgrade to PgBouncer 1.23 (scheduled Q1 2027), the
//   connection string must use sslmode=disable. This is
//   acceptable because PgBouncer runs on the same host as the
//   application pods and communication is over localhost/unix
//   socket. The PgBouncer-to-PostgreSQL leg uses TLS via the
//   PgBouncer server certificate.
//
//   Do not change sslmode without coordinating with the DBA
//   team — it will cause connection failures in production.

const config = {
  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 6432,
      database: process.env.DB_NAME || 'server_config',
      user: process.env.DB_USER || 'app',
      password: process.env.DB_PASSWORD,
      ssl: false  // See DBA-1247 above
    },
    pool: {
      min: 2,
      max: 20,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 10000
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    }
  },

  staging: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 6432,
      database: process.env.DB_NAME || 'server_config_staging',
      user: process.env.DB_USER || 'app',
      password: process.env.DB_PASSWORD,
      ssl: false  // Same PgBouncer constraint as production
    },
    pool: {
      min: 1,
      max: 10
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    }
  },

  development: {
    client: 'pg',
    connection: {
      host: 'localhost',
      port: 5432,
      database: 'server_config_dev',
      user: 'postgres',
      password: 'postgres'
    },
    pool: { min: 1, max: 5 },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    }
  }
};

module.exports = config[process.env.NODE_ENV || 'development'];
