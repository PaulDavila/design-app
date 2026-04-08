const { pool } = require('../config/db');
const { parseDataUriForEmail } = require('../lib/parseDataUri');
const { rasterizeGeminiBufferForEmail, fetchImageBufferFromUrl } = require('./email1GeminiRaster');
const { buildEmail1SocialCidAttachments } = require('./email1SocialCid');
const { resolveSolicitudSubject } = require('../lib/mailFrom');
const {
  buildEmail4Html,
  readLogoRutaEmail4,
  EMAIL4_IMG1_W,
  EMAIL4_IMG1_H,
  EMAIL4_IMG2_W,
  EMAIL4_IMG2_H,
} = require('./email4BuildHtml');
const { sendEmail1Message, buildLogoAttachmentAndSrc } = require('./email1Send');

const CID_GEM1 = 'email4-gemini1@abclogistica';
const CID_GEM2 = 'email4-gemini2@abclogistica';

async function buildOneGeminiCid(payload, urlKey, boxIdxKey, sizePctKey, targetW, targetH, cid, filename) {
  const attachments = [];
  const raw = typeof payload?.[urlKey] === 'string' ? payload[urlKey].trim() : '';

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
      console.error('Email4 Gemini URL:', e);
      return { attachments, bodyImage: { mode: 'placeholder', kind: 'bad' } };
    }
  } else {
    return { attachments, bodyImage: { mode: 'placeholder', kind: 'bad' } };
  }

  const imgBoxIdx = Number.isFinite(Number(payload?.[boxIdxKey])) ? Number(payload[boxIdxKey]) : 0;
  const imagenGeminiSizePct = Number.isFinite(Number(payload?.[sizePctKey]))
    ? Number(payload[sizePctKey])
    : 100;

  try {
    const jpegBuf = await rasterizeGeminiBufferForEmail(inputBuffer, {
      imgBoxIdx,
      imagenGeminiSizePct,
      targetW,
      targetH,
    });
    attachments.push({
      filename,
      content: jpegBuf,
      contentType: 'image/jpeg',
      cid,
    });
    return { attachments, bodyImage: { mode: 'img', src: `cid:${cid}` } };
  } catch (e) {
    console.error('email4 rasterize:', e);
    return { attachments, bodyImage: { mode: 'placeholder', kind: 'bad' } };
  }
}

async function sendEmail4ForSolicitud(row, body) {
  if (row.editor_tipo !== 'email4') {
    throw new Error('Solo editor_tipo email4 admite este envío SMTP');
  }
  const payload = body.payload;
  if (!payload || typeof payload !== 'object') {
    throw new Error('payload inválido');
  }

  const [plRows] = await pool.query('SELECT definicion FROM plantillas WHERE id = ?', [row.plantilla_id]);
  const definicion = plRows[0]?.definicion;
  const logoRel = readLogoRutaEmail4(definicion);

  const { attachments: logoAtt, logoImgSrc } = buildLogoAttachmentAndSrc(logoRel);

  const { attachments: g1Att, bodyImage: image1 } = await buildOneGeminiCid(
    payload,
    'imagenGemini1Url',
    'imgBox1Idx',
    'imagenGemini1SizePct',
    EMAIL4_IMG1_W,
    EMAIL4_IMG1_H,
    CID_GEM1,
    'imagen-email4-1.jpg'
  );
  const { attachments: g2Att, bodyImage: image2 } = await buildOneGeminiCid(
    payload,
    'imagenGemini2Url',
    'imgBox2Idx',
    'imagenGemini2SizePct',
    EMAIL4_IMG2_W,
    EMAIL4_IMG2_H,
    CID_GEM2,
    'imagen-email4-2.jpg'
  );

  let socialAtt = [];
  let socialImgSrcById = null;
  try {
    const built = await buildEmail1SocialCidAttachments();
    socialAtt = built.attachments;
    socialImgSrcById = built.imgSrcById;
  } catch (e) {
    console.error('Iconos pie Email4 (CID):', e);
  }

  const attachments = [...logoAtt, ...g1Att, ...g2Att, ...socialAtt];

  const html = buildEmail4Html({
    payload,
    logoImgSrc,
    image1,
    image2,
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

module.exports = { sendEmail4ForSolicitud };
