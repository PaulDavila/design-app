/**
 * Paridad con Email1Editor: parseEmailsCsv + validación básica.
 */

function parseEmailsCsv(s) {
  return String(s || '')
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailsLookValid(list) {
  return list.length > 0 && list.every((e) => EMAIL_RE.test(e));
}

/**
 * @returns {{ ok: true, emails: string[] } | { ok: false, error: string }}
 */
function resolveRecipients(enviarTodos, destinatariosRaw) {
  if (enviarTodos) {
    return { ok: true, emails: [], mode: 'broadcast' };
  }
  const list = parseEmailsCsv(destinatariosRaw);
  const dedup = [...new Set(list.map((e) => e.toLowerCase()))];
  if (dedup.length === 0) {
    return { ok: false, error: 'No hay correos en la lista manual' };
  }
  if (!emailsLookValid(dedup)) {
    return { ok: false, error: 'Hay direcciones de correo inválidas en la lista' };
  }
  return { ok: true, emails: dedup, mode: 'list' };
}

module.exports = { parseEmailsCsv, emailsLookValid, resolveRecipients };
