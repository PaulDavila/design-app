/**
 * Envío SMTP real de una fila email_envios_solicitud (Email1, newsletters, cumpleaños, etc.).
 * Usado por POST /completar (inmediato) y por el poller de programados.
 */
async function ejecutarSmtpCompletar(row, payload, enviar_todos, destinatarios, tipoSmtp) {
  if (tipoSmtp === 'email1' || tipoSmtp === 'newsletter_1') {
    const { sendEmail1ForSolicitud } = require('./email1Send');
    await sendEmail1ForSolicitud(row, { payload, enviar_todos, destinatarios });
  } else if (tipoSmtp === 'email2') {
    const { sendEmail2ForSolicitud } = require('./email2Send');
    await sendEmail2ForSolicitud(row, { payload, enviar_todos, destinatarios });
  } else if (tipoSmtp === 'email3') {
    const { sendEmail3ForSolicitud } = require('./email3Send');
    await sendEmail3ForSolicitud(row, { payload, enviar_todos, destinatarios });
  } else if (tipoSmtp === 'email4') {
    const { sendEmail4ForSolicitud } = require('./email4Send');
    await sendEmail4ForSolicitud(row, { payload, enviar_todos, destinatarios });
  } else if (tipoSmtp === 'cumpleanos_1') {
    const { sendCumpleanos1ForSolicitud } = require('./cumpleanosSend');
    await sendCumpleanos1ForSolicitud(row, { payload, enviar_todos, destinatarios });
  } else if (tipoSmtp === 'aniversarios_1') {
    const { sendAniversarios1ForSolicitud } = require('./cumpleanosSend');
    await sendAniversarios1ForSolicitud(row, { payload, enviar_todos, destinatarios });
  } else if (tipoSmtp === 'reconocimientos_1') {
    const { sendReconocimientos1ForSolicitud } = require('./cumpleanosSend');
    await sendReconocimientos1ForSolicitud(row, { payload, enviar_todos, destinatarios });
  }
}

const SMTP_EDITOR_TIPOS = new Set([
  'email1',
  'newsletter_1',
  'email2',
  'email3',
  'email4',
  'cumpleanos_1',
  'aniversarios_1',
  'reconocimientos_1',
]);

function tipoSmtpFromRow(row) {
  const t = row?.editor_tipo;
  return SMTP_EDITOR_TIPOS.has(t) ? t : null;
}

module.exports = { ejecutarSmtpCompletar, tipoSmtpFromRow, SMTP_EDITOR_TIPOS };
