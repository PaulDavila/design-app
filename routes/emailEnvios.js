const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

function resolveUsuarioId(req) {
  const raw = req.headers['x-user-id'] ?? req.body?.usuario_id ?? req.query?.usuario_id;
  const id = raw != null ? parseInt(String(raw), 10) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function getUserRole(userId) {
  const [rows] = await pool.query('SELECT role FROM users WHERE id = ? AND activo = 1', [userId]);
  const r = rows[0]?.role;
  return r === 'admin' || r === 'administrativo' || r === 'user' ? r : 'user';
}

async function userIsAdmin(userId) {
  return (await getUserRole(userId)) === 'admin';
}

function requireUserId(req, res) {
  const id = resolveUsuarioId(req);
  if (!id) {
    res.status(400).json({ error: 'Falta X-User-Id (o usuario_id en query/body)' });
    return null;
  }
  return id;
}

/** Columnas del listado GET / (sin payload JSON: evita ER_OUT_OF_SORTMEMORY con imágenes base64). */
const LIST_SELECT_COLS = `id, plantilla_id, creado_por_user_id, editor_tipo, enviar_todos, destinatarios,
  fecha_hora_programada, estado, created_at, updated_at, enviado_en, error_envio`;

function rowToApi(r, options = {}) {
  let payload;
  if (options.listMode) {
    payload = {};
  } else {
    payload = r.payload;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = {};
      }
    }
  }
  const f = r.fecha_hora_programada;
  const fechaIso = f instanceof Date ? f.toISOString() : String(f);
  return {
    id: r.id,
    plantilla_id: r.plantilla_id,
    creado_por_user_id: r.creado_por_user_id,
    editor_tipo: r.editor_tipo,
    payload,
    enviar_todos: Boolean(r.enviar_todos),
    destinatarios: r.destinatarios || '',
    fecha_hora_programada: fechaIso,
    estado: r.estado,
    created_at: r.created_at,
    updated_at: r.updated_at,
    enviado_en:
      r.enviado_en != null
        ? r.enviado_en instanceof Date
          ? r.enviado_en.toISOString()
          : String(r.enviado_en)
        : null,
    error_envio: r.error_envio != null ? String(r.error_envio) : null,
  };
}

/**
 * POST /api/email-envios
 * Crea solicitud pendiente de revisión (sin envío real).
 */
router.post('/', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const plantilla_id = parseInt(req.body?.plantilla_id, 10);
  const payload = req.body?.payload;
  const enviar_todos = Boolean(req.body?.enviar_todos);
  const destinatarios = req.body?.destinatarios != null ? String(req.body.destinatarios).trim() : '';
  const fecha_hora_programada = req.body?.fecha_hora_programada;

  if (!Number.isFinite(plantilla_id)) {
    return res.status(400).json({ error: 'plantilla_id inválido' });
  }
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'payload (objeto JSON) requerido' });
  }
  if (!fecha_hora_programada || typeof fecha_hora_programada !== 'string') {
    return res.status(400).json({ error: 'fecha_hora_programada (ISO) requerida' });
  }
  const d = new Date(fecha_hora_programada);
  if (Number.isNaN(d.getTime())) {
    return res.status(400).json({ error: 'fecha_hora_programada no válida' });
  }
  if (!enviar_todos && !destinatarios) {
    return res.status(400).json({ error: 'Indica destinatarios o activa enviar a todos' });
  }

  const rawTipo =
    req.body?.editor_tipo != null ? String(req.body.editor_tipo).trim().toLowerCase() : 'email1';
  const allowedTipo = new Set([
    'email1',
    'newsletter_1',
    'email2',
    'email3',
    'email4',
    'cumpleanos_1',
    'aniversarios_1',
    'reconocimientos_1',
  ]);
  if (!allowedTipo.has(rawTipo)) {
    return res.status(400).json({
      error:
        'editor_tipo debe ser email1, newsletter_1, email2, email3, email4, cumpleanos_1, aniversarios_1 o reconocimientos_1',
    });
  }
  const editor_tipo = rawTipo;

  try {
    const mysqlDt = new Date(fecha_hora_programada);
    const mysqlStr = Number.isNaN(mysqlDt.getTime())
      ? null
      : mysqlDt.toISOString().slice(0, 19).replace('T', ' ');
    if (!mysqlStr) {
      return res.status(400).json({ error: 'fecha_hora_programada no válida' });
    }
    const [r] = await pool.query(
      `INSERT INTO email_envios_solicitud
        (plantilla_id, creado_por_user_id, editor_tipo, payload, enviar_todos, destinatarios, fecha_hora_programada, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente_revision')`,
      [
        plantilla_id,
        userId,
        editor_tipo,
        JSON.stringify(payload),
        enviar_todos ? 1 : 0,
        enviar_todos ? null : destinatarios,
        mysqlStr,
      ]
    );
    const insertId = r.insertId;
    const [rows] = await pool.query('SELECT * FROM email_envios_solicitud WHERE id = ?', [insertId]);
    res.status(201).json(rowToApi(rows[0]));
  } catch (err) {
    console.error('POST /api/email-envios:', err);
    // FK: creado_por_user_id → users, plantilla_id → plantillas (p. ej. VITE_USER_ID ≠ users.id en prod)
    if (err.errno === 1452 || err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        error:
          'Usuario o plantilla no reconocidos en la base de datos. Comprueba que exista users.id igual a X-User-Id (y la plantilla). En Railway suele fallar si VITE_USER_ID apunta a un id que no creaste (el seed suele usar el usuario 1).',
      });
    }
    res.status(500).json({ error: 'No se pudo crear la solicitud' });
  }
});

/**
 * GET /api/email-envios
 * admin: pendiente_revision + programado.
 * administrativo: solo programado (no ve cola de revisión de nadie).
 * user: todos los programados + sus propias pendiente_revision.
 */
router.get('/', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const role = await getUserRole(userId);
    let rows;
    if (role === 'admin') {
      [rows] = await pool.query(
        `SELECT ${LIST_SELECT_COLS} FROM email_envios_solicitud
         WHERE estado IN ('pendiente_revision', 'programado')
         ORDER BY fecha_hora_programada ASC, id ASC`
      );
    } else if (role === 'administrativo') {
      [rows] = await pool.query(
        `SELECT ${LIST_SELECT_COLS} FROM email_envios_solicitud
         WHERE estado = 'programado'
         ORDER BY fecha_hora_programada ASC, id ASC`
      );
    } else {
      [rows] = await pool.query(
        `SELECT ${LIST_SELECT_COLS} FROM email_envios_solicitud
         WHERE estado = 'programado'
            OR (creado_por_user_id = ? AND estado = 'pendiente_revision')
         ORDER BY fecha_hora_programada ASC, id ASC`,
        [userId]
      );
    }
    res.json(rows.map((row) => rowToApi(row, { listMode: true })));
  } catch (err) {
    console.error('GET /api/email-envios:', err);
    res.status(500).json({ error: 'Error al listar solicitudes' });
  }
});

/**
 * PATCH /api/email-envios/:id
 * Dueño: actualizar borrador pendiente_revision (re-envío a revisión tras editar).
 */
router.patch('/:id', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'id inválido' });
  }

  const payload = req.body?.payload;
  const enviar_todos = Boolean(req.body?.enviar_todos);
  const destinatarios = req.body?.destinatarios != null ? String(req.body.destinatarios).trim() : '';
  const fecha_hora_programada = req.body?.fecha_hora_programada;

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'payload (objeto JSON) requerido' });
  }
  if (!fecha_hora_programada || typeof fecha_hora_programada !== 'string') {
    return res.status(400).json({ error: 'fecha_hora_programada (ISO) requerida' });
  }
  const d = new Date(fecha_hora_programada);
  if (Number.isNaN(d.getTime())) {
    return res.status(400).json({ error: 'fecha_hora_programada no válida' });
  }
  if (!enviar_todos && !destinatarios) {
    return res.status(400).json({ error: 'Indica destinatarios o activa enviar a todos' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM email_envios_solicitud WHERE id = ? AND estado = 'pendiente_revision'`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'No encontrada o no editable' });
    }
    const row = rows[0];
    if (row.creado_por_user_id !== userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const mysqlDt = new Date(fecha_hora_programada);
    const mysqlStr = Number.isNaN(mysqlDt.getTime())
      ? null
      : mysqlDt.toISOString().slice(0, 19).replace('T', ' ');
    if (!mysqlStr) {
      return res.status(400).json({ error: 'fecha_hora_programada no válida' });
    }

    await pool.query(
      `UPDATE email_envios_solicitud
       SET payload = ?, enviar_todos = ?, destinatarios = ?, fecha_hora_programada = ?
       WHERE id = ? AND creado_por_user_id = ? AND estado = 'pendiente_revision'`,
      [JSON.stringify(payload), enviar_todos ? 1 : 0, enviar_todos ? null : destinatarios, mysqlStr, id, userId]
    );
    const [out] = await pool.query('SELECT * FROM email_envios_solicitud WHERE id = ?', [id]);
    res.json(rowToApi(out[0]));
  } catch (err) {
    console.error('PATCH /api/email-envios/:id:', err);
    res.status(500).json({ error: 'Error al actualizar solicitud' });
  }
});

/**
 * GET /api/email-envios/:id
 */
router.get('/:id', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'id inválido' });
  }

  try {
    const role = await getUserRole(userId);
    const [rows] = await pool.query('SELECT * FROM email_envios_solicitud WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'No encontrada' });
    }
    const row = rows[0];
    const esMia = row.creado_por_user_id === userId;
    if (role === 'admin') {
      // puede leer cualquiera
    } else if (!esMia) {
      return res.status(403).json({ error: 'No autorizado' });
    } else if (role === 'user' && row.estado === 'programado') {
      return res.status(403).json({
        error: 'Los correos ya programados solo se pueden consultar en el calendario; no son editables.',
      });
    }
    res.json(rowToApi(row));
  } catch (err) {
    console.error('GET /api/email-envios/:id:', err);
    res.status(500).json({ error: 'Error al leer solicitud' });
  }
});

/**
 * POST /api/email-envios/:id/completar
 * Solo admin. Marca programado (conserva fila para calendario). Re-aprobable si ya estaba programado.
 */
router.post('/:id/completar', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'id inválido' });
  }

  try {
    const role = await getUserRole(userId);
    if (role !== 'admin' && role !== 'administrativo') {
      return res.status(403).json({ error: 'Solo administradores o usuarios administrativos' });
    }

    const [rows] = await pool.query(
      `SELECT * FROM email_envios_solicitud WHERE id = ? AND estado IN ('pendiente_revision', 'programado')`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' });
    }

    const row = rows[0];
    if (role === 'administrativo' && row.creado_por_user_id !== userId) {
      return res.status(403).json({ error: 'Solo puedes completar tus propias solicitudes' });
    }
    const enviar_inmediatamente = Boolean(req.body?.enviar_inmediatamente);
    const payload = req.body?.payload;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'payload final requerido' });
    }
    const enviar_todos = Boolean(req.body?.enviar_todos);
    const destinatarios = req.body?.destinatarios != null ? String(req.body.destinatarios).trim() : '';
    if (!enviar_todos && !destinatarios) {
      return res.status(400).json({ error: 'Indica destinatarios o enviar a todos' });
    }

    let fechaFinal;
    let affected;

    if (enviar_inmediatamente) {
      fechaFinal = new Date().toISOString();
      // No tocar fecha_hora_programada: el correo sigue el mismo día en el calendario.
      const [rImm] = await pool.query(
        `UPDATE email_envios_solicitud
         SET estado = 'programado',
             payload = ?,
             enviar_todos = ?,
             destinatarios = ?
         WHERE id = ? AND estado IN ('pendiente_revision', 'programado')`,
        [JSON.stringify(payload), enviar_todos ? 1 : 0, enviar_todos ? null : destinatarios, id]
      );
      affected = rImm.affectedRows;
    } else {
      const f = req.body?.fecha_hora_final;
      if (!f || typeof f !== 'string') {
        return res.status(400).json({ error: 'fecha_hora_final requerida si no es inmediato' });
      }
      const d = new Date(f);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ error: 'fecha_hora_final inválida' });
      }
      fechaFinal = d.toISOString();
      const mysqlStr = d.toISOString().slice(0, 19).replace('T', ' ');
      const [rSch] = await pool.query(
        `UPDATE email_envios_solicitud
         SET estado = 'programado',
             payload = ?,
             enviar_todos = ?,
             destinatarios = ?,
             fecha_hora_programada = ?
         WHERE id = ? AND estado IN ('pendiente_revision', 'programado')`,
        [
          JSON.stringify(payload),
          enviar_todos ? 1 : 0,
          enviar_todos ? null : destinatarios,
          mysqlStr,
          id,
        ]
      );
      affected = rSch.affectedRows;
    }
    if (affected === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' });
    }

    const [outRows] = await pool.query('SELECT * FROM email_envios_solicitud WHERE id = ?', [id]);
    const fresh = outRows[0];

    let envioMeta = null;
    const smtpTipos = new Set([
      'email1',
      'newsletter_1',
      'email2',
      'email3',
      'email4',
      'cumpleanos_1',
      'aniversarios_1',
      'reconocimientos_1',
    ]);
    const tipoSmtp = smtpTipos.has(fresh.editor_tipo) ? fresh.editor_tipo : null;
    if (enviar_inmediatamente && tipoSmtp) {
      if (fresh.enviado_en) {
        envioMeta = { smtp: 'omitido', motivo: 'ya_enviado' };
      } else {
        try {
          if (tipoSmtp === 'email1' || tipoSmtp === 'newsletter_1') {
            const { sendEmail1ForSolicitud } = require('../services/email1Send');
            await sendEmail1ForSolicitud(fresh, {
              payload,
              enviar_todos,
              destinatarios,
            });
          } else if (tipoSmtp === 'email2') {
            const { sendEmail2ForSolicitud } = require('../services/email2Send');
            await sendEmail2ForSolicitud(fresh, {
              payload,
              enviar_todos,
              destinatarios,
            });
          } else if (tipoSmtp === 'email3') {
            const { sendEmail3ForSolicitud } = require('../services/email3Send');
            await sendEmail3ForSolicitud(fresh, {
              payload,
              enviar_todos,
              destinatarios,
            });
          } else if (tipoSmtp === 'email4') {
            const { sendEmail4ForSolicitud } = require('../services/email4Send');
            await sendEmail4ForSolicitud(fresh, {
              payload,
              enviar_todos,
              destinatarios,
            });
          } else if (tipoSmtp === 'cumpleanos_1') {
            const { sendCumpleanos1ForSolicitud } = require('../services/cumpleanosSend');
            await sendCumpleanos1ForSolicitud(fresh, {
              payload,
              enviar_todos,
              destinatarios,
            });
          } else if (tipoSmtp === 'aniversarios_1') {
            const { sendAniversarios1ForSolicitud } = require('../services/cumpleanosSend');
            await sendAniversarios1ForSolicitud(fresh, {
              payload,
              enviar_todos,
              destinatarios,
            });
          } else if (tipoSmtp === 'reconocimientos_1') {
            const { sendReconocimientos1ForSolicitud } = require('../services/cumpleanosSend');
            await sendReconocimientos1ForSolicitud(fresh, {
              payload,
              enviar_todos,
              destinatarios,
            });
          }
          await pool.query(
            'UPDATE email_envios_solicitud SET enviado_en = NOW(), error_envio = NULL WHERE id = ?',
            [id]
          );
          envioMeta = { smtp: 'ok' };
        } catch (smtpErr) {
          console.error('Email SMTP:', smtpErr);
          const msg = String(smtpErr.message || smtpErr).slice(0, 2000);
          await pool.query('UPDATE email_envios_solicitud SET error_envio = ? WHERE id = ?', [msg, id]);
          const [errRows] = await pool.query('SELECT * FROM email_envios_solicitud WHERE id = ?', [id]);
          return res.status(502).json({
            ok: false,
            error: 'Programado en calendario, pero el envío por correo falló.',
            detalle_smtp: msg,
            solicitud: rowToApi(errRows[0]),
          });
        }
      }
    }

    const [finalRows] = await pool.query('SELECT * FROM email_envios_solicitud WHERE id = ?', [id]);
    let mensaje = 'Solicitud revisada y programada.';
    if (enviar_inmediatamente && tipoSmtp) {
      if (envioMeta?.smtp === 'ok') mensaje = 'Programado y enviado por correo.';
      else if (envioMeta?.motivo === 'ya_enviado') {
        mensaje = 'Programado; este envío ya se había enviado por correo antes.';
      }
    }

    res.json({
      ok: true,
      mensaje,
      fecha_hora_aplicada: fechaFinal,
      solicitud: rowToApi(finalRows[0]),
      envio: envioMeta,
    });
  } catch (err) {
    console.error('POST completar:', err);
    res.status(500).json({ error: 'Error al completar' });
  }
});

/**
 * DELETE /api/email-envios/:id/descartar
 * Solo admin. Borra sin enviar.
 */
router.delete('/:id/descartar', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'id inválido' });
  }

  try {
    const role = await getUserRole(userId);
    if (role === 'admin') {
      const [r] = await pool.query('DELETE FROM email_envios_solicitud WHERE id = ?', [id]);
      return res.json({ ok: true, removed: r.affectedRows > 0 });
    }
    const [rows] = await pool.query(
      'SELECT creado_por_user_id, estado FROM email_envios_solicitud WHERE id = ?',
      [id]
    );
    if (!rows.length) {
      return res.json({ ok: true, removed: false });
    }
    if (rows[0].creado_por_user_id !== userId) {
      return res.status(403).json({ error: 'Solo puedes eliminar o descartar tus propias solicitudes' });
    }
    if (role === 'user' && rows[0].estado !== 'pendiente_revision') {
      return res.status(403).json({
        error: 'Solo puedes descartar tus borradores en revisión, no envíos ya programados.',
      });
    }
    const [r] = await pool.query('DELETE FROM email_envios_solicitud WHERE id = ? AND creado_por_user_id = ?', [
      id,
      userId,
    ]);
    res.json({ ok: true, removed: r.affectedRows > 0 });
  } catch (err) {
    console.error('DELETE descartar:', err);
    res.status(500).json({ error: 'Error al descartar' });
  }
});

module.exports = router;
