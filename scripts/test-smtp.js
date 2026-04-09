/**
 * Prueba conexión SMTP desde el mismo entorno que el servidor (ideal: railway ssh → npm run test:smtp).
 * No envía correo; solo verify() TCP+TLS+auth.
 *
 * Railway Free/Trial/Hobby: SMTP saliente está DESHABILITADO (documentación Railway).
 * Ahí debes usar RESEND_API_KEY + npm run test:resend (API HTTPS).
 */
require('dotenv').config();
const { createSmtpTransport } = require('../lib/smtpTransport');

async function main() {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  console.log('SMTP_HOST=', host);
  console.log('SMTP_PORT=', port);
  console.log('SMTP_USER=', process.env.SMTP_USER ? '(definido)' : '(falta)');
  console.log('SMTP_PASS=', process.env.SMTP_PASS ? '(definido)' : '(falta)');
  try {
    const t = createSmtpTransport();
    await t.verify();
    console.log('\nOK: verify() — el relay acepta usuario/contraseña desde esta máquina.');
  } catch (e) {
    console.error('\nFALLO:', e.message || e);
    console.error(
      '\nSi ves "Connection timeout": el host/puerto no responde desde Railway (firewall del proveedor, host interno, puerto mal).\n' +
        'Prueba Resend/SendGrid/Brevo SMTP o el SMTP de Gmail/Outlook con host público documentado.'
    );
    process.exitCode = 1;
  }
}

main();
