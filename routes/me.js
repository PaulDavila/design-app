const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

function resolveUsuarioId(req) {
  const raw = req.headers['x-user-id'] ?? req.query?.usuario_id;
  const id = raw != null ? parseInt(String(raw), 10) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * GET /api/me?usuario_id=1  (o header X-User-Id)
 */
router.get('/', async (req, res) => {
  const uid = resolveUsuarioId(req);
  if (!uid) {
    return res.status(400).json({ error: 'Falta X-User-Id o query usuario_id' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT id, email, nombre, role FROM users WHERE id = ? AND activo = 1',
      [uid]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const u = rows[0];
    const role = u.role || 'user'
    res.json({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      role,
      isAdmin: role === 'admin',
      isAdministrativo: role === 'administrativo',
    });
  } catch (err) {
    console.error('GET /api/me:', err);
    res.status(500).json({ error: 'Error al leer usuario' });
  }
});

module.exports = router;
