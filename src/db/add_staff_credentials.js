// Migration: create staff_credentials table and seed it from existing
// ADMIN_PASSWORD / KITCHEN_PASSWORD env vars (hashed with bcrypt).
//
// Run once with:
//   node src/db/add_staff_credentials.js
//
// Safe to re-run — uses IF NOT EXISTS and ON CONFLICT DO NOTHING.

const pool = require('./pool');
const bcrypt = require('bcrypt');

async function migrate() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff_credentials (
        role          TEXT PRIMARY KEY,         -- 'admin' or 'kitchen'
        password_hash TEXT NOT NULL,
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ staff_credentials table ready');

    const adminPlain   = process.env.ADMIN_PASSWORD   || 'admin123';
    const kitchenPlain  = process.env.KITCHEN_PASSWORD || 'kitchen123';

    const adminHash   = await bcrypt.hash(adminPlain, 10);
    const kitchenHash = await bcrypt.hash(kitchenPlain, 10);

    await pool.query(
      `INSERT INTO staff_credentials (role, password_hash) VALUES ($1, $2)
       ON CONFLICT (role) DO NOTHING`,
      ['admin', adminHash]
    );
    await pool.query(
      `INSERT INTO staff_credentials (role, password_hash) VALUES ($1, $2)
       ON CONFLICT (role) DO NOTHING`,
      ['kitchen', kitchenHash]
    );

    console.log('✅ Seeded initial admin/kitchen password hashes (only if not already present)');
    console.log('   Initial admin password:', adminPlain);
    console.log('   Initial kitchen password:', kitchenPlain);
    console.log('   (Change these from the dashboard after first login!)');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
