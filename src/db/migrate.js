const pool = require('./pool');

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('🚀 Running database migrations...\n');

    await client.query('BEGIN');

    // 1. Restaurant tables (physical tables in the coffee house)
    await client.query(`
      CREATE TABLE IF NOT EXISTS restaurant_tables (
        id        SERIAL PRIMARY KEY,
        number    VARCHAR(10) UNIQUE NOT NULL,  -- e.g. "01", "07", "VIP1"
        label     VARCHAR(50),                  -- e.g. "Window seat", "Outdoor"
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ restaurant_tables');

    // 2. Menu categories
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(50) UNIQUE NOT NULL,  -- e.g. "Coffee", "Food"
        sort_order INT DEFAULT 0,
        is_active  BOOLEAN DEFAULT true
      );
    `);
    console.log('✅ categories');

    // 3. Menu items
    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id           SERIAL PRIMARY KEY,
        category_id  INT REFERENCES categories(id) ON DELETE SET NULL,
        name         VARCHAR(100) NOT NULL,
        description  TEXT,
        price        NUMERIC(10, 2) NOT NULL,
        image_emoji  VARCHAR(10) DEFAULT '☕',
        is_available BOOLEAN DEFAULT true,
        sort_order   INT DEFAULT 0,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ menu_items');

    // 4. Orders
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE order_status AS ENUM (
          'pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        table_number   VARCHAR(10) NOT NULL,
        status         order_status DEFAULT 'pending',
        notes          TEXT,
        subtotal       NUMERIC(10, 2) NOT NULL DEFAULT 0,
        service_charge NUMERIC(10, 2) NOT NULL DEFAULT 0,
        total          NUMERIC(10, 2) NOT NULL DEFAULT 0,
        created_at     TIMESTAMPTZ DEFAULT NOW(),
        updated_at     TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ orders');

    // 5. Order items (line items in each order)
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id           SERIAL PRIMARY KEY,
        order_id     UUID REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id INT REFERENCES menu_items(id) ON DELETE SET NULL,
        name         VARCHAR(100) NOT NULL,  -- snapshot of name at order time
        price        NUMERIC(10, 2) NOT NULL, -- snapshot of price at order time
        quantity     INT NOT NULL DEFAULT 1,
        subtotal     NUMERIC(10, 2) GENERATED ALWAYS AS (price * quantity) STORED
      );
    `);
    console.log('✅ order_items');

    // 6. Payments
    await client.query(`
      DO $body$ BEGIN
        CREATE TYPE payment_method AS ENUM ('chapa','telebirr','card','cash');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $body$;
    `);
    await client.query(`
      DO $body$ BEGIN
        CREATE TYPE payment_status AS ENUM ('pending','completed','failed','refunded');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $body$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
        method          payment_method NOT NULL,
        status          payment_status DEFAULT 'pending',
        amount          NUMERIC(10, 2) NOT NULL,
        tx_ref          VARCHAR(100) UNIQUE,   -- Chapa transaction reference
        chapa_checkout_url TEXT,               -- redirect URL from Chapa
        verified_at     TIMESTAMPTZ,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ payments');

    // 7. Auto-update orders.updated_at on any change
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS set_orders_updated_at ON orders;
      CREATE TRIGGER set_orders_updated_at
        BEFORE UPDATE ON orders
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);
    console.log('✅ updated_at trigger');

    await client.query('COMMIT');
    console.log('\n🎉 All migrations completed successfully!\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));