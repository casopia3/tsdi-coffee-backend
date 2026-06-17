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

// POST /api/menu (admin)
const createMenuItem = async (req, res) => {
  const { category_id, name, description, price, image_emoji } = req.body;
  if (!name || !price) return res.status(400).json({ success: false, message: 'Name and price required' });
  try {
    const result = await pool.query(
      `INSERT INTO menu_items (category_id, name, description, price, image_emoji)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [category_id, name, description, price, image_emoji || '☕']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/menu/:id (admin)
const updateMenuItem = async (req, res) => {
  const { name, description, price, image_emoji, category_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE menu_items SET name=$1, description=$2, price=$3, image_emoji=$4, category_id=$5
       WHERE id=$6 RETURNING *`,
      [name, description, price, image_emoji, category_id, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/menu/:id (admin)
const deleteMenuItem = async (req, res) => {
  try {
    await pool.query('DELETE FROM menu_items WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getMenu, getMenuItem, toggleAvailability, createMenuItem, updateMenuItem, deleteMenuItem };
