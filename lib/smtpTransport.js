const nodemailer = require('nodemailer');

/**
 * Transport SMTP usado por Email 1 y demás envíos que reutilizan email1Send.
 * Variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * Opcional: SMTP_CONNECTION_TIMEOUT_MS (default 30000) — sube si el relay es lento;
 *   no arregla "Connection timeout" si el host/puerto es inalcanzable desde Railway.
 */
function createSmtpTransport() {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  if (!user || !pass) {
    throw new Error('Configura SMTP_USER y SMTP_PASS en el entorno (Railway → Variables).');
  }
  const connectionTimeout = Math.min(
    Math.max(parseInt(process.env.SMTP_CONNECTION_TIMEOUT_MS, 10) || 30000, 5000),
    120000
  );
  const secure = port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS: !secure && port !== 25,
    connectionTimeout,
    greetingTimeout: connectionTimeout,
    socketTimeout: connectionTimeout,
    tls: { minVersion: 'TLSv1.2' },
  });
}

module.exports = { createSmtpTransport };
