/**
 * Prueba Resend (HTTPS) desde Railway — no usa SMTP.
 * Requiere RESEND_API_KEY. Opcional: RESEND_FROM, RESEND_TEST_TO (destino de prueba).
 */
require('dotenv').config();
const { sendViaResend } = require('../lib/resendSend');

async function main() {
  if (!String(process.env.RESEND_API_KEY || '').trim()) {
    console.error('Falta RESEND_API_KEY en el entorno.');
    process.exitCode = 1;
    return;
  }
  const toRaw = String(process.env.RESEND_TEST_TO || process.env.SMTP_USER || '').trim();
  if (!toRaw) {
    console.error('Define RESEND_TEST_TO o SMTP_USER como correo destino de la prueba.');
    process.exitCode = 1;
    return;
  }
  if (!String(process.env.RESEND_FROM || '').trim()) {
    process.env.RESEND_FROM = 'ABC Logística <onboarding@resend.dev>';
    console.log('RESEND_FROM vacío → usando onboarding@resend.dev (solo válido en pruebas de Resend).\n');
  }
  try {
    await sendViaResend({
      subject: 'Prueba design-app (Resend)',
      html: '<p>Si ves esto, el envío por API desde Railway funciona.</p>',
      to: [toRaw],
    });
    console.log('OK: Resend aceptó el envío. Revisa la bandeja de', toRaw, '(y spam).');
  } catch (e) {
    console.error('FALLO:', e.message || e);
    console.error(
      '\nSi el error habla de dominio no verificado: en resend.com añade tu dominio o usa temporalmente\n' +
        'RESEND_FROM="ABC Logística <onboarding@resend.dev>" (solo a tu correo de prueba según docs de Resend).'
    );
    process.exitCode = 1;
  }
}

main();
