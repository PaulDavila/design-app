const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { componer } = require('../services/compositor');
const path = require('path');

/**
 * POST /api/componer
 * Body: { plantillaId?: number | string, plantilla?: {...}, datos: { [idCapa]: valor } }
 * Si plantillaId viene, se carga la plantilla desde BD. Si no, plantilla debe venir en el body.
 */
router.post('/', async (req, res) => {
  let plantilla = req.body.plantilla;
  const datos = req.body.datos || {};
  const formato = (req.body.formato || 'png').toLowerCase();

  if (!plantilla && req.body.plantillaId != null) {
    try {
      const [rows] = await pool.query(
        'SELECT id, id_externo, nombre, tipo, definicion, ruta_imagen_base FROM plantillas WHERE (id = ? OR id_externo = ?) AND activo = 1',
        [req.body.plantillaId, req.body.plantillaId]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Plantilla no encontrada' });
      plantilla = rows[0];
    } catch (err) {
      console.error('Error cargando plantilla:', err);
      return res.status(500).json({ error: 'Error al cargar plantilla' });
    }
  }

  if (!plantilla || !plantilla.definicion) {
    return res.status(400).json({ error: 'Falta plantilla (o plantillaId) con definicion' });
  }

  try {
    const result = await componer(plantilla, datos, { formato });
    const nombreArchivo = path.basename(result.path);
    res.setHeader('Content-Type', formato === 'jpg' ? 'image/jpeg' : 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="${nombreArchivo}"`);
    res.send(result.buffer);
  } catch (err) {
    console.error('Error componiendo:', err);
    res.status(500).json({ error: err.message || 'Error al generar la imagen' });
  }
});

module.exports = router;
