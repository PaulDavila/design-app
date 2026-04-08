const { pool } = require('../config/db');
const { parseDataUriForEmail } = require('../lib/parseDataUri');
const { rasterizeGeminiBufferForEmail, fetchImageBufferFromUrl } = require('./email1GeminiRaster');
const { buildEmail1SocialCidAttachments } = require('./email1SocialCid');
const { resolveSolicitudSubject } = require('../lib/mailFrom');
const {
  buildCumpleanosFamilyHtml,
  readLogoRutaCumpleanos,
  CUMPLE_HERO_W,
  CUMPLE_HERO_H,
} = require('./cumpleanosAniversariosBuildHtml');
const { sendEmail1Message, buildLogoAttachmentAndSrc } = require('./email1Send');

const CID_HERO = 'cumple-hero@abclogistica';

const HERO_WHITE = '#ffffff';

/**
 * @param {'cumpleanos_1' | 'aniversarios_1' | 'reconocimientos_1'} editorTipo
 */
async function sendCumpleanosFamilyForSolicitud(row, body, editorTipo) {
  if (row.editor_tipo !== editorTipo) {
    throw new Error(`Solo editor_tipo ${editorTipo} admite este envío SMTP`);
  }
  const payload = body.payload;
  if (!payload || typeof payload !== 'object') {
    throw new Error('payload inválido');
  }

  const [plRows] = await pool.query('SELECT definicion FROM plantillas WHERE id = ?', [row.plantilla_id]);
  const definicion = plRows[0]?.definicion;
  const logoRel = readLogoRutaCumpleanos(definicion);

  const { attachments: logoAtt, logoImgSrc } = buildLogoAttachmentAndSrc(logoRel);

  const attachments = [];
  let heroImage = { mode: 'placeholder', kind: 'empty' };
  const rawHero = typeof payload?.imagenHeroUrl === 'string' ? payload.imagenHeroUrl.trim() : '';

  if (rawHero) {
    let inputBuffer = null;
    if (rawHero.startsWith('data:')) {
      const parsed = parseDataUriForEmail(rawHero);
      if (parsed) inputBuffer = parsed.buffer;
    } else if (rawHero.startsWith('https://') || rawHero.startsWith('http://')) {
      try {
        inputBuffer = await fetchImageBufferFromUrl(rawHero);
      } catch (e) {
        console.error('Cumpleaños hero URL:', e);
        heroImage = { mode: 'placeholder', kind: 'bad' };
      }
    } else {
      heroImage = { mode: 'placeholder', kind: 'bad' };
    }

    if (inputBuffer) {
      const imagenHeroSizePct = Number.isFinite(Number(payload?.imagenHeroSizePct))
        ? Number(payload.imagenHeroSizePct)
        : 100;
      try {
        const jpegBuf = await rasterizeGeminiBufferForEmail(inputBuffer, {
          imgBoxIdx: 0,
          imagenGeminiSizePct: imagenHeroSizePct,
          targetW: CUMPLE_HERO_W,
          targetH: CUMPLE_HERO_H,
          backgroundHexOverride: HERO_WHITE,
        });
        attachments.push({
          filename: 'imagen-hero.jpg',
          content: jpegBuf,
          contentType: 'image/jpeg',
          cid: CID_HERO,
        });
        heroImage = { mode: 'img', src: `cid:${CID_HERO}` };
      } catch (e) {
        console.error('cumpleanos hero rasterize:', e);
        heroImage = { mode: 'placeholder', kind: 'bad' };
      }
    }
  }

  let socialAtt = [];
  let socialImgSrcById = null;
  try {
    const built = await buildEmail1SocialCidAttachments();
    socialAtt = built.attachments;
    socialImgSrcById = built.imgSrcById;
  } catch (e) {
    console.error('Iconos pie cumpleaños (CID):', e);
  }

  const allAttachments = [...logoAtt, ...attachments, ...socialAtt];

  const html = buildCumpleanosFamilyHtml(editorTipo, {
    payload,
    logoImgSrc,
    heroImage,
    socialImgSrcById,
  });

  const subject = resolveSolicitudSubject(row, payload);

  await sendEmail1Message({
    subject,
    html,
    enviarTodos: Boolean(body.enviar_todos),
    destinatariosRaw: body.destinatarios != null ? String(body.destinatarios) : '',
    attachments: allAttachments,
  });
}

async function sendCumpleanos1ForSolicitud(row, body) {
  return sendCumpleanosFamilyForSolicitud(row, body, 'cumpleanos_1');
}

async function sendAniversarios1ForSolicitud(row, body) {
  return sendCumpleanosFamilyForSolicitud(row, body, 'aniversarios_1');
}

async function sendReconocimientos1ForSolicitud(row, body) {
  return sendCumpleanosFamilyForSolicitud(row, body, 'reconocimientos_1');
}

module.exports = {
  sendCumpleanos1ForSolicitud,
  sendAniversarios1ForSolicitud,
  sendReconocimientos1ForSolicitud,
  sendCumpleanosFamilyForSolicitud,
};
