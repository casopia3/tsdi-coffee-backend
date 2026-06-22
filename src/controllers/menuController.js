const pool = require('../db/pool');

// GET /api/menu
const getMenu = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id   AS category_id,
        c.name AS category,
        json_agg(
          json_build_object(
            'id',           m.id,
            'name',         m.name,
            'description',  m.description,
            'price',        m.price,
            'image_emoji',  m.image_emoji,
            'image_url',    m.image_url,
            'is_available', m.is_available
          ) ORDER BY m.sort_order
        ) AS items
      FROM categories c
      JOIN menu_items m ON m.category_id = c.id
      WHERE c.is_active = true
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
    const result = await pool.query(
      `SELECT m.*, c.name AS category FROM menu_items m
       JOIN categories c ON c.id = m.category_id WHERE m.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load item' });
  }
};

// PATCH /api/menu/:id/availability (admin)
const toggleAvailability = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE menu_items SET is_available = $1 WHERE id = $2 RETURNING id, name, is_available`,
      [req.body.is_available, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update item' });
  }
};

// POST /api/menu (admin)
const createMenuItem = async (req, res) => {
  const { category_id, name, description, price, image_emoji, image_url } = req.body;
  if (!name || !price) return res.status(400).json({ success: false, message: 'Name and price required' });
  try {
    const result = await pool.query(
      `INSERT INTO menu_items (category_id, name, description, price, image_emoji, image_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [category_id, name, description, price, image_emoji || '☕', image_url || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/menu/:id (admin)
const updateMenuItem = async (req, res) => {
  const { name, description, price, image_emoji, image_url, category_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE menu_items SET name=$1, description=$2, price=$3, image_emoji=$4, category_id=$5, image_url=$6
       WHERE id=$7 RETURNING *`,
      [name, description, price, image_emoji, category_id, image_url || null, req.params.id]
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