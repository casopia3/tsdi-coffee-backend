const pool = require('./pool');

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE menu_items 
      ADD COLUMN IF NOT EXISTS image_url TEXT;
    `);
    console.log('✅ image_url column added to menu_items');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
