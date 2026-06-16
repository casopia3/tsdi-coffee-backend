const pool = require('../db/pool');

// GET /api/menu
// Returns all available items grouped by category
const getMenu = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id   AS category_id,
        c.name AS category,
        json_agg(
          json_build_object(
            'id',          m.id,
            'name',        m.name,
            'description', m.description,
            'price',       m.price,
            'image_emoji', m.image_emoji
          ) ORDER BY m.sort_order
        ) AS items
      FROM categories c
      JOIN menu_items m ON m.category_id = c.id
      WHERE c.is_active = true AND m.is_available = true
      GROUP BY c.id, c.name, c.sort_order
      ORDER BY c.sort_order;
    `);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getMenu error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load menu' });
  }
};

// GET /api/menu/:id
const getMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT m.*, c.name AS category
       FROM menu_items m
       JOIN categories c ON c.id = m.category_id
       WHERE m.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load item' });
  }
};

// PATCH /api/menu/:id/availability  (admin)
const toggleAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_available } = req.body;

    const result = await pool.query(
      `UPDATE menu_items SET is_available = $1 WHERE id = $2
       RETURNING id, name, is_available`,
      [is_available, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update item' });
  }
};

module.exports = { getMenu, getMenuItem, toggleAvailability };
