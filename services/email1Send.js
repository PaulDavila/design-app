const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const { createSmtpTransport } = require('../lib/smtpTransport');
const { isResendEnabled, sendViaResend } = require('../lib/resendSend');
const {
  buildEmail1Html,
  buildNewsletterHtml,
  readLogoRuta,
  NEWSLETTER_BODY_IMG_PX,
} = require('./email1BuildHtml');
const { resolveRecipients } = require('../lib/parseDestinatarios');
const { parseDataUriForEmail } = require('../lib/parseDataUri');
const { rasterizeGeminiBufferForEmail, fetchImageBufferFromUrl } = require('./email1GeminiRaster');
const { buildEmail1SocialCidAttachments } = require('./email1SocialCid');
const { buildFromHeader, resolveSolicitudSubject } = require('../lib/mailFrom');
const { GEMINI_EMAIL_W, GEMINI_EMAIL_H } = require('./email1GeminiRaster');

const CID_LOGO = 'email1-logo@abclogistica';
const CID_GEMINI = 'email1-gemini@abclogistica';

function getTransport() {
  return createSmtpTransport();
}

/**
 * @param {{ subject: string, html: string, enviarTodos: boolean, destinatariosRaw: string, attachments?: object[] }} opts
 */
async function sendEmail1Message(opts) {
  const { subject, html, enviarTodos, destinatariosRaw, attachments = [] } = opts;
  const broadcast = (process.env.MAIL_BROADCAST_TO || 'usuarios@abclogistica.mx').trim();
  const from = buildFromHeader();

  const r = resolveRecipients(Boolean(enviarTodos), destinatariosRaw);
  if (!r.ok) {
    throw new Error(r.error);
  }

  const baseMail = {
    from,
    subject,
    html,
    attachments: attachments.length ? attachments : undefined,
  };

  let mailOptions;
  if (r.mode === 'broadcast') {
    mailOptions = { ...baseMail, to: broadcast };
  } else {
    const emails = r.emails;
    if (emails.length === 1) {
      mailOptions = { ...baseMail, to: emails[0] };
    } else {
      mailOptions = {
        ...baseMail,
        to: emails[0],
        bcc: emails.slice(1),
      };
    }
  }

  if (isResendEnabled()) {
    const resendOpts = { subject, html, attachments };
    if (r.mode === 'broadcast') {
      resendOpts.to = [broadcast];
    } else if (r.emails.length === 1) {
      resendOpts.to = [r.emails[0]];
    } else {
      resendOpts.to = [r.emails[0]];
      resendOpts.bcc = r.emails.slice(1);
    }
    return sendViaResend(resendOpts);
  }

  const transporter = getTransport();
  return transporter.sendMail(mailOptions);
}

/**
 * Logo desde disco (CID) o URL pública de respaldo.
 */
function buildLogoAttachmentAndSrc(logoRelativePath) {
  const clean = String(logoRelativePath || '').replace(/^\//, '');
  const storageRoot = path.join(__dirname, '..', 'storage', 'plantillas');
  const logoFsPath = path.join(storageRoot, clean);
  const attachments = [];

  if (clean && fs.existsSync(logoFsPath) && fs.statSync(logoFsPath).isFile()) {
    const buf = fs.readFileSync(logoFsPath);
    attachments.push({
      filename: path.basename(clean) || 'logo.svg',
      content: buf,
      cid: CID_LOGO,
    });
    return { attachments, logoImgSrc: `cid:${CID_LOGO}` };
  }

  const base = (process.env.MAIL_ASSET_BASE_URL || '').replace(/\/$/, '');
  const logoAbsoluteUrl = base ? `${base}/media/plantillas/${clean}` : '';
  return { attachments, logoImgSrc: logoAbsoluteUrl };
}

/**
 * Imagen cuerpo: data URI o URL → raster (Email1 552×170 o newsletter cuadrado) → CID JPEG.
 * @param {object} [rasterOpts] - opcional targetW, targetH
 */
async function buildGeminiAttachmentAndBodyImage(payload, rasterOpts = {}) {
  const attachments = [];
  const raw = typeof payload?.imagenGeminiUrl === 'string' ? payload.imagenGeminiUrl.trim() : '';

  const targetW = Number.isFinite(Number(rasterOpts.targetW)) ? Number(rasterOpts.targetW) : GEMINI_EMAIL_W;
  const targetH = Number.isFinite(Number(rasterOpts.targetH)) ? Number(rasterOpts.targetH) : GEMINI_EMAIL_H;

  if (!raw) {
    return { attachments, bodyImage: { mode: 'placeholder', kind: 'empty' } };
  }

  let inputBuffer = null;
  if (raw.startsWith('data:')) {
    try {
      const parsed = parseDataUriForEmail(raw);
      if (!parsed) {
        return { attachments, bodyImage: { mode: 'placeholder', kind: 'bad' } };
      }
      inputBuffer = parsed.buffer;
    } catch (e) {
      throw e;
    }
  } else if (raw.startsWith('https://') || raw.startsWith('http://')) {
    try {
      inputBuffer = await fetchImageBufferFromUrl(raw);
    } catch (e) {
      console.error('Gemini URL imagen:', e);
      return { attachments, bodyImage: { mode: 'placeholder', kind: 'bad' } };
    }
  } else {
    return { attachments, bodyImage: { mode: 'placeholder', kind: 'bad' } };
  }

  try {
    const jpegBuf = await rasterizeGeminiBufferForEmail(inputBuffer, {
      ...payload,
      targetW,
      targetH,
    });
    attachments.push({
      filename: 'imagen-correo.jpg',
      content: jpegBuf,
      contentType: 'image/jpeg',
      cid: CID_GEMINI,
    });
    return { attachments, bodyImage: { mode: 'img', src: `cid:${CID_GEMINI}` } };
  } catch (e) {
    console.error('rasterizeGeminiBufferForEmail:', e);
    return { attachments, bodyImage: { mode: 'placeholder', kind: 'bad' } };
  }
}

/**
 * @param {object} row - fila email_envios_solicitud
 * @param {{ payload: object, enviar_todos: boolean, destinatarios: string }} body
 */
async function sendEmail1ForSolicitud(row, body) {
  if (row.editor_tipo !== 'email1' && row.editor_tipo !== 'newsletter_1') {
    throw new Error('Solo editor_tipo email1 o newsletter_1 admite envío SMTP en esta ruta');
  }
  const payload = body.payload;
  if (!payload || typeof payload !== 'object') {
    throw new Error('payload inválido');
  }

  const [plRows] = await pool.query('SELECT definicion FROM plantillas WHERE id = ?', [row.plantilla_id]);
  const definicion = plRows[0]?.definicion;
  const logoRel = readLogoRuta(definicion, row.editor_tipo);

  const { attachments: logoAtt, logoImgSrc } = buildLogoAttachmentAndSrc(logoRel);
  const isNewsletter = row.editor_tipo === 'newsletter_1';
  const { attachments: gemAtt, bodyImage } = await buildGeminiAttachmentAndBodyImage(
    payload,
    isNewsletter
      ? { targetW: NEWSLETTER_BODY_IMG_PX, targetH: NEWSLETTER_BODY_IMG_PX }
      : {}
  );

  let socialAtt = [];
  let socialImgSrcById = null;
  try {
    const built = await buildEmail1SocialCidAttachments();
    socialAtt = built.attachments;
    socialImgSrcById = built.imgSrcById;
  } catch (e) {
    console.error('Iconos pie Email1 (CID):', e);
  }

  const attachments = [...logoAtt, ...gemAtt, ...socialAtt];

  const html = isNewsletter
    ? buildNewsletterHtml({
        payload,
        logoImgSrc,
        bodyImage,
        socialImgSrcById,
      })
    : buildEmail1Html({
        payload,
        logoImgSrc,
        bodyImage,
        socialImgSrcById,
      });

  const subject = resolveSolicitudSubject(row, payload);

  await sendEmail1Message({
    subject,
    html,
    enviarTodos: Boolean(body.enviar_todos),
    destinatariosRaw: body.destinatarios != null ? String(body.destinatarios) : '',
    attachments,
  });
}

module.exports = {
  sendEmail1Message,
  sendEmail1ForSolicitud,
  getTransport,
  buildLogoAttachmentAndSrc,
};
