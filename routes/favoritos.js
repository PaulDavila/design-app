const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

function resolveUsuarioId(req) {
  const fromHeader = req.headers['x-user-id'];
  const fromBody = req.body?.usuario_id;
  const fromQuery = req.query?.usuario_id;
  const raw = fromHeader ?? fromBody ?? fromQuery;
  const id = raw != null ? parseInt(String(raw), 10) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * GET /api/favoritos?usuario_id=1
 * Lista ids de plantillas favoritas
 */
router.get('/', async (req, res) => {
  const usuario_id = resolveUsuarioId(req);
  if (!usuario_id) {
    return res.status(400).json({ error: 'Falta usuario_id (query, body o header X-User-Id)' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT plantilla_id FROM plantillas_favoritas WHERE usuario_id = ? ORDER BY plantilla_id',
      [usuario_id]
    );
    res.json(rows.map((r) => r.plantilla_id));
  } catch (err) {
    console.error('Error listando favoritos:', err);
    res.status(500).json({ error: 'Error al listar favoritos' });
  }
});

/**
 * POST /api/favoritos { plantilla_id, usuario_id? }
 */
router.post('/', async (req, res) => {
  const usuario_id = resolveUsuarioId(req);
  const plantilla_id = req.body?.plantilla_id != null ? parseInt(req.body.plantilla_id, 10) : NaN;
  if (!usuario_id) {
    return res.status(400).json({ error: 'Falta usuario_id (body o header X-User-Id)' });
  }
  if (!Number.isFinite(plantilla_id)) {
    return res.status(400).json({ error: 'Falta plantilla_id válido' });
  }
  try {
    await pool.query(
      'INSERT IGNORE INTO plantillas_favoritas (usuario_id, plantilla_id) VALUES (?, ?)',
      [usuario_id, plantilla_id]
    );
    res.status(201).json({ ok: true, usuario_id, plantilla_id });
  } catch (err) {
    console.error('Error guardando favorito:', err);
    res.status(500).json({ error: 'Error al guardar favorito' });
  }
});

/**
 * DELETE /api/favoritos/:plantillaId?usuario_id=1
 */
router.delete('/:plantillaId', async (req, res) => {
  const usuario_id = resolveUsuarioId(req);
  const plantilla_id = parseInt(req.params.plantillaId, 10);
  if (!usuario_id) {
    return res.status(400).json({ error: 'Falta usuario_id (query o header X-User-Id)' });
  }
  if (!Number.isFinite(plantilla_id)) {
    return res.status(400).json({ error: 'plantillaId inválido' });
  }
  try {
    const [r] = await pool.query(
      'DELETE FROM plantillas_favoritas WHERE usuario_id = ? AND plantilla_id = ?',
      [usuario_id, plantilla_id]
    );
    res.json({ ok: true, removed: r.affectedRows > 0 });
  } catch (err) {
    console.error('Error eliminando favorito:', err);
    res.status(500).json({ error: 'Error al eliminar favorito' });
  }
});

module.exports = router;
