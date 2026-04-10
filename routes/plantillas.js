const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

const SELECT_FIELDS = `p.id, p.id_externo, p.nombre, p.tipo, p.categoria, p.red_social, p.formato_redes,
  p.layout_indice, p.ratio_variante, p.grupo_layout, p.definicion, p.ruta_imagen_base, p.ruta_miniatura, p.created_at`;

/** Miniatura actual en repo; BD antigua puede seguir con email-aniversarios.png hasta correr migrate. */
const RUTA_MINIATURA_RECONOCIMIENTOS = 'miniaturas/miniatura-reconocimientos.png';

function normalizePlantillaRow(row) {
  if (!row || row.grupo_layout !== 'reconocimientos_1') return row;
  return { ...row, ruta_miniatura: RUTA_MINIATURA_RECONOCIMIENTOS };
}

/** Express puede entregar query duplicada como array; sin esto favoritos!== '1' y se listan todas las plantillas */
function queryTruthyOne(val) {
  if (val === undefined || val === null) return false;
  const v = Array.isArray(val) ? val[0] : val;
  return v === '1' || v === 'true' || v === 1;
}

function firstQueryString(val) {
  if (val === undefined || val === null) return null;
  return Array.isArray(val) ? val[0] : val;
}

/**
 * GET /api/plantillas
 * Query: categoria, red_social, formato_redes, q, usuario_id (para es_favorito)
 *        favoritos=1 + usuario_id → solo plantillas marcadas como favoritas (JOIN)
 */
router.get('/', async (req, res) => {
  const {
    categoria,
    red_social,
    formato_redes,
    q,
    usuario_id,
    favoritos,
  } = req.query;

  const uidRaw = firstQueryString(usuario_id);
  const uidParsed = uidRaw != null && uidRaw !== '' ? parseInt(String(uidRaw), 10) : NaN;
  const uid = Number.isFinite(uidParsed) && uidParsed > 0 ? uidParsed : null;
  const soloFavoritos = queryTruthyOne(favoritos);

  try {
    if (soloFavoritos) {
      if (!uid) {
        return res.status(400).json({ error: 'favoritos=1 requiere usuario_id válido' });
      }
      const conditions = ['p.activo = 1'];
      const whereParams = [uid];
      if (q && String(q).trim()) {
        conditions.push('p.nombre LIKE ?');
        whereParams.push(`%${String(q).trim()}%`);
      }
      const sql = `SELECT ${SELECT_FIELDS}, 1 AS es_favorito
        FROM plantillas p
        INNER JOIN plantillas_favoritas f ON f.plantilla_id = p.id AND f.usuario_id = ?
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.categoria, p.formato_redes, p.layout_indice, p.nombre`;
      const [rows] = await pool.query(sql, whereParams);
      return res.json(rows.map(normalizePlantillaRow));
    }

    const conditions = ['p.activo = 1'];
    const whereParams = [];

    if (categoria) {
      conditions.push('p.categoria = ?');
      whereParams.push(categoria);
    }
    if (formato_redes) {
      conditions.push('p.formato_redes = ?');
      whereParams.push(formato_redes);
    }
    const portadasGlobales =
      formato_redes === 'portadas_banners' ||
      formato_redes === 'portadas_redes_sociales' ||
      formato_redes === 'portadas_google_forms';
    if (red_social && !portadasGlobales) {
      conditions.push('p.red_social = ?');
      whereParams.push(red_social);
    }
    // Carrusel/imagen/portadas globales (sin filtrar por red en query)
    if (
      categoria === 'redes_sociales' &&
      (formato_redes === 'carrusel' ||
        formato_redes === 'imagen' ||
        formato_redes === 'portadas_redes_sociales' ||
        formato_redes === 'portadas_google_forms') &&
      !red_social
    ) {
      conditions.push('p.red_social IS NULL');
    }
    if (q && String(q).trim()) {
      conditions.push('p.nombre LIKE ?');
      whereParams.push(`%${String(q).trim()}%`);
    }

    let sql = `SELECT ${SELECT_FIELDS}`;
    if (uid) {
      sql += `, CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END AS es_favorito`;
    } else {
      sql += `, 0 AS es_favorito`;
    }
    sql += ` FROM plantillas p`;
    if (uid) {
      sql += ` LEFT JOIN plantillas_favoritas f ON f.plantilla_id = p.id AND f.usuario_id = ?`;
    }
    sql += ` WHERE ${conditions.join(' AND ')}`;
    sql +=
      ' ORDER BY p.categoria, p.red_social, p.formato_redes, p.layout_indice, p.ratio_variante, p.nombre';

    const params = uid ? [uid, ...whereParams] : whereParams;
    const [rows] = await pool.query(sql, params);
    res.json(rows.map(normalizePlantillaRow));
  } catch (err) {
    console.error('Error listando plantillas:', err);
    res.status(500).json({ error: 'Error al listar plantillas' });
  }
});

/**
 * GET /api/plantillas/:id
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const usuario_id = req.query.usuario_id ? parseInt(req.query.usuario_id, 10) : null;

  try {
    const isNumeric = /^\d+$/.test(id);
    let sql = `SELECT ${SELECT_FIELDS}`;
    if (usuario_id) {
      sql += `, CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END AS es_favorito`;
    } else {
      sql += `, 0 AS es_favorito`;
    }
    sql += ` FROM plantillas p`;
    if (usuario_id) {
      sql += ` LEFT JOIN plantillas_favoritas f ON f.plantilla_id = p.id AND f.usuario_id = ?`;
    }
    sql += isNumeric
      ? ' WHERE p.id = ? AND p.activo = 1'
      : ' WHERE p.id_externo = ? AND p.activo = 1';

    const params = usuario_id ? [usuario_id, id] : [id];
    const [rows] = await pool.query(sql, params);
    if (rows.length === 0) return res.status(404).json({ error: 'Plantilla no encontrada' });
    res.json(normalizePlantillaRow(rows[0]));
  } catch (err) {
    console.error('Error obteniendo plantilla:', err);
    res.status(500).json({ error: 'Error al obtener plantilla' });
  }
});

module.exports = router;
