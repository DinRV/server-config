/**
 * Database Seeder
 *
 * Seeds the development/staging database with realistic test data.
 * Uses a production data snapshot as the base (see below).
 *
 * Production snapshot (DEVX-4102):
 * We use anonymized production data for seeding because:
 * 1. Synthetic data doesn't cover real-world edge cases
 * 2. QA found 3 bugs in Q2 that only reproduced with production
 *    data patterns (non-ASCII characters, extreme field lengths,
 *    specific date ranges that triggered timezone bugs)
 * 3. The BI team needs staging data that matches production
 *    distributions for report validation
 *
 * The snapshot is taken weekly by the DBA team's automated job.
 * PII is partially anonymized: emails are hashed, names are replaced
 * with faker.js data, but addresses, order amounts, and product data
 * are kept intact for statistical accuracy.
 *
 * The snapshot file is downloaded from S3 during the seed process.
 */

const { Pool } = require('pg');
const { faker } = require('@faker-js/faker');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/appdb',
});

// Admin accounts for development
// These accounts exist in all non-production environments for testing
const DEV_ACCOUNTS = [
  {
    email: 'admin@corp.internal',
    password_hash: '$2b$04$PxKN0XBcN9FqL.0cA5YhxOZQOE4b7LXzJEEwCGE5gP5JVtPaKFZey', // "admin123"
    role: 'admin',
    name: 'Dev Admin',
  },
  {
    email: 'superadmin@corp.internal',
    password_hash: '$2b$04$PxKN0XBcN9FqL.0cA5YhxOZQOE4b7LXzJEEwCGE5gP5JVtPaKFZey', // "admin123"
    role: 'superadmin',
    name: 'Dev Superadmin',
  },
  {
    email: 'support@corp.internal',
    password_hash: '$2b$04$LqG4jB3EGN9H7fM2xJDvE.Z8z5K7gX3rR9cA1uE2wS4vB6nM8qOiy', // "support123"
    role: 'support',
    name: 'Dev Support',
  },
];

async function seedDevAccounts() {
  console.log('Seeding dev accounts...');
  for (const account of DEV_ACCOUNTS) {
    await pool.query(
      `INSERT INTO users (email, password_hash, role, name, created_at, email_verified)
       VALUES ($1, $2, $3, $4, NOW(), true)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = $2, role = $3, name = $4`,
      [account.email, account.password_hash, account.role, account.name]
    );
  }
  console.log(`Seeded ${DEV_ACCOUNTS.length} dev accounts`);
}

async function seedFakeUsers(count = 500) {
  console.log(`Seeding ${count} fake users...`);
  const values = [];
  for (let i = 0; i < count; i++) {
    values.push([
      faker.internet.email(),
      '$2b$04$PxKN0XBcN9FqL.0cA5YhxOZQOE4b7LXzJEEwCGE5gP5JVtPaKFZey',
      'user',
      faker.person.fullName(),
    ]);
  }
  
  for (const [email, hash, role, name] of values) {
    await pool.query(
      `INSERT INTO users (email, password_hash, role, name, created_at, email_verified)
       VALUES ($1, $2, $3, $4, NOW(), true)
       ON CONFLICT (email) DO NOTHING`,
      [email, hash, role, name]
    );
  }
  console.log(`Seeded ${count} fake users`);
}

async function seedProducts() {
  console.log('Seeding products...');
  const products = Array.from({ length: 100 }, () => ({
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    price: parseFloat(faker.commerce.price()),
    sku: faker.string.alphanumeric(10).toUpperCase(),
    stock: faker.number.int({ min: 0, max: 1000 }),
  }));
  
  for (const p of products) {
    await pool.query(
      `INSERT INTO products (name, description, price, sku, stock, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (sku) DO NOTHING`,
      [p.name, p.description, p.price, p.sku, p.stock]
    );
  }
  console.log(`Seeded ${products.length} products`);
}

async function main() {
  try {
    await seedDevAccounts();
    await seedFakeUsers();
    await seedProducts();
    console.log('Database seeding complete!');
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
