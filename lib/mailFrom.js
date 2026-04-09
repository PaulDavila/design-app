/** Nombre visible y dirección From para todos los envíos SMTP de la app. */

const MAIL_DISPLAY_NAME = 'ABC Logistica';

/**
 * @returns {string}
 */
function buildFromHeader() {
  const raw = (process.env.MAIL_FROM || process.env.SMTP_USER || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  let email = user;
  if (raw) {
    const m = raw.match(/<([^>]+)>/);
    if (m) email = m[1].trim();
    else if (raw.includes('@')) email = raw;
  }
  if (!email) {
    throw new Error('Configura SMTP_USER (o MAIL_FROM con correo) para enviar');
  }
  return `"${MAIL_DISPLAY_NAME}" <${email}>`;
}

/**
 * @param {{ id: number }} row
 * @param {object} payload
 * @returns {string}
 */
function resolveSolicitudSubject(row, payload) {
  const prefix = process.env.MAIL_SUBJECT_PREFIX || 'ABC Logística — Comunicado';
  const customRaw = typeof payload?.asuntoCorreo === 'string' ? payload.asuntoCorreo : '';
  const custom = customRaw.replace(/[\r\n\u0000]+/g, ' ').trim();
  if (custom.length > 0) return custom.slice(0, 998);
  return `${prefix} #${row.id}`;
}

/**
 * Asunto de correo de prueba: mismo criterio que el real salvo que sin id de solicitud se usa "(prueba)".
 * Siempre antepone TEST: (sin duplicar si ya viene).
 * @param {{ id?: number }} row
 * @param {object} payload
 */
function resolveTestEmailSubject(row, payload) {
  const prefix = process.env.MAIL_SUBJECT_PREFIX || 'ABC Logística — Comunicado';
  const customRaw = typeof payload?.asuntoCorreo === 'string' ? payload.asuntoCorreo : '';
  const custom = customRaw.replace(/[\r\n\u0000]+/g, ' ').trim();
  let base;
  if (custom.length > 0) {
    base = custom.slice(0, 998);
  } else {
    const id = Number(row?.id);
    base =
      Number.isFinite(id) && id > 0 ? `${prefix} #${id}` : `${prefix} (prueba)`;
  }
  const b = String(base).trim();
  if (/^TEST:\s/i.test(b)) return b.slice(0, 998);
  return `TEST: ${b}`.slice(0, 998);
}

module.exports = { MAIL_DISPLAY_NAME, buildFromHeader, resolveSolicitudSubject, resolveTestEmailSubject };
