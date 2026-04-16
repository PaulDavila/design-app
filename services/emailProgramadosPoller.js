const { pool } = require('../config/db');
const { ejecutarSmtpCompletar, tipoSmtpFromRow } = require('./emailSolicitudEjecutar');

const LOCK_NAME = 'design_app_email_programados';

function parsePayload(row) {
  let payload = row.payload;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = {};
    }
  }
  return payload && typeof payload === 'object' ? payload : {};
}

/**
 * Una pasada: envía solicitudes programadas cuya hora ya pasó y aún no tienen enviado_en.
 * Usa GET_LOCK para que, si hay varias instancias Node, solo una ejecute a la vez.
 */
async function procesarColaEmailProgramadosUnaPasada() {
  const conn = await pool.getConnection();
  try {
    const [[lockRow]] = await conn.query('SELECT GET_LOCK(?, 0) AS got', [LOCK_NAME]);
    if (!lockRow?.got) {
      return;
    }
    try {
      // Solo ids en el ORDER BY: evita ER_OUT_OF_SORTMEMORY cuando hay muchos
      // programados y payload JSON grande (SELECT * metía todo en el sort buffer).
      const [idRows] = await conn.query(
        `SELECT id FROM email_envios_solicitud
         WHERE estado = 'programado'
           AND enviado_en IS NULL
           AND (error_envio IS NULL OR error_envio = '')
           AND fecha_hora_programada <= UTC_TIMESTAMP()
         ORDER BY fecha_hora_programada ASC, id ASC
         LIMIT 10`
      );
      const ids = idRows.map((r) => r.id).filter((id) => id != null);
      if (!ids.length) {
        return;
      }
      const ph = ids.map(() => '?').join(',');
      const [fullRows] = await conn.query(
        `SELECT * FROM email_envios_solicitud WHERE id IN (${ph})`,
        ids
      );
      const byId = new Map(fullRows.map((r) => [r.id, r]));
      const rows = ids.map((id) => byId.get(id)).filter(Boolean);
      for (const row of rows) {
        const tipoSmtp = tipoSmtpFromRow(row);
        if (!tipoSmtp) {
          console.warn(`[email-programados] id=${row.id} editor_tipo no enviable por SMTP, se omite`);
          continue;
        }
        const payload = parsePayload(row);
        const enviar_todos = Boolean(row.enviar_todos);
        const destinatarios = row.destinatarios != null ? String(row.destinatarios).trim() : '';
        try {
          const [chk] = await conn.query('SELECT enviado_en FROM email_envios_solicitud WHERE id = ?', [row.id]);
          if (chk[0]?.enviado_en) continue;

          await ejecutarSmtpCompletar(row, payload, enviar_todos, destinatarios, tipoSmtp);
          await conn.query(
            'UPDATE email_envios_solicitud SET enviado_en = UTC_TIMESTAMP(), error_envio = NULL WHERE id = ? AND enviado_en IS NULL',
            [row.id]
          );
          console.log(`[email-programados] enviado id=${row.id}`);
        } catch (smtpErr) {
          console.error(`[email-programados] error id=${row.id}:`, smtpErr);
          const msg = String(smtpErr.message || smtpErr).slice(0, 2000);
          await conn.query('UPDATE email_envios_solicitud SET error_envio = ? WHERE id = ?', [msg, row.id]);
        }
      }
    } finally {
      await conn.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]);
    }
  } finally {
    conn.release();
  }
}

let intervalId = null;

function startEmailProgramadosPoller() {
  const raw = String(process.env.EMAIL_PROGRAMADOS_POLL_MS || '').trim();
  const ms = raw ? parseInt(raw, 10) : 60000;
  const intervalMs = Number.isFinite(ms) && ms >= 15000 ? ms : 60000;

  if (intervalId != null) return;

  const tick = () => {
    void procesarColaEmailProgramadosUnaPasada().catch((e) =>
      console.error('[email-programados] tick:', e)
    );
  };
  setTimeout(tick, 5000);
  intervalId = setInterval(tick, intervalMs);
  console.log(
    `[design-app] Poller correos programados cada ${intervalMs} ms (EMAIL_PROGRAMADOS_POLL_MS)`
  );
}

module.exports = { startEmailProgramadosPoller, procesarColaEmailProgramadosUnaPasada };
