const pool = require('./pool');

async function seed() {
  const client = await pool.connect();

  try {
    console.log('🌱 Seeding database...\n');
    await client.query('BEGIN');

    // ── Tables ────────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO restaurant_tables (number, label) VALUES
        ('01', 'Entrance'),
        ('02', 'Entrance'),
        ('03', 'Window seat'),
        ('04', 'Window seat'),
        ('05', 'Center'),
        ('06', 'Center'),
        ('07', 'Center'),
        ('08', 'Outdoor'),
        ('09', 'Outdoor'),
        ('VIP', 'Private room')
      ON CONFLICT (number) DO NOTHING;
    `);
    console.log('✅ restaurant_tables seeded');

    // ── Categories ────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO categories (name, sort_order) VALUES
        ('Coffee',     1),
        ('Tea & Drinks', 2),
        ('Food',       3),
        ('Pastry',     4)
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log('✅ categories seeded');

    // ── Menu items ────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO menu_items (category_id, name, description, price, image_emoji, sort_order)
      SELECT c.id, m.name, m.description, m.price, m.emoji, m.sort_order
      FROM (VALUES
        -- Coffee
        ('Coffee', 'Macchiato',    'Ethiopian-style espresso with a touch of milk foam',        45.00, '☕', 1),
        ('Coffee', 'Buna',         'Traditional Ethiopian black coffee, ceremony style',         35.00, '🫖', 2),
        ('Coffee', 'Cappuccino',   'Double espresso with steamed milk and thick froth',          75.00, '☕', 3),
        ('Coffee', 'Latte',        'Smooth espresso with lots of steamed milk',                  80.00, '🥛', 4),
        ('Coffee', 'Cold Brew',    '12-hour slow-brewed cold coffee, served over ice',           85.00, '🧊', 5),
        ('Coffee', 'Spiced Buna',  'Black coffee with cardamom and cinnamon',                    50.00, '✨', 6),
        -- Tea & Drinks
        ('Tea & Drinks', 'Spiced Tea',    'Cardamom and ginger masala tea with milk',            40.00, '🍵', 1),
        ('Tea & Drinks', 'Mango Juice',   'Fresh blended Ethiopian mango, no sugar added',       60.00, '🥭', 2),
        ('Tea & Drinks', 'Avocado Juice', 'Creamy fresh avocado juice, lightly sweetened',       65.00, '🥑', 3),
        ('Tea & Drinks', 'Tamarind Drink','Tangy chilled tamarind water with a hint of spice',   45.00, '🧃', 4),
        -- Food
        ('Food', 'Firfir',         'Shredded injera sautéed in spiced butter and berbere',      110.00, '🫓', 1),
        ('Food', 'Egg Sandwich',   'Pan-fried egg with tomato, jalapeño, and spices',            95.00, '🥚', 2),
        ('Food', 'Tibs Roll',      'Spiced beef tibs wrapped in thin injera',                   130.00, '🌯', 3),
        ('Food', 'Foul',           'Fava beans with olive oil, lemon, and cumin',                75.00, '🫘', 4),
        -- Pastry
        ('Pastry', 'Croissant',    'Buttery flaky baked croissant, served warm',                 65.00, '🥐', 1),
        ('Pastry', 'Banana Bread', 'Moist homemade banana loaf, baked fresh daily',              55.00, '🍞', 2),
        ('Pastry', 'Mandazi',      'East African fried dough, lightly sweet',                    40.00, '🍩', 3),
        ('Pastry', 'Cake Slice',   'Rotating daily cake, ask your waiter for todays flavour', 70.00, '🍰', 4)
      ) AS m(category, name, description, price, emoji, sort_order)
      JOIN categories c ON c.name = m.category
      ON CONFLICT DO NOTHING;
    `);
    console.log('✅ menu_items seeded (18 items)');

    await client.query('COMMIT');
    console.log('\n🎉 Database seeded successfully!\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(() => process.exit(1));