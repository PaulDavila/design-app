const { pool } = require('../config/db');
const { parseDataUriForEmail } = require('../lib/parseDataUri');
const { rasterizeGeminiBufferForEmail, fetchImageBufferFromUrl } = require('./email1GeminiRaster');
const { buildEmail1SocialCidAttachments } = require('./email1SocialCid');
const { resolveSolicitudSubject, resolveTestEmailSubject } = require('../lib/mailFrom');
const {
  buildCumpleanosFamilyHtml,
  readLogoRutaCumpleanos,
  CUMPLE_HERO_W,
  CUMPLE_HERO_H,
} = require('./cumpleanosAniversariosBuildHtml');
const { sendEmail1Message, buildLogoAttachmentAndSrc } = require('./email1Send');

const CID_HERO = 'cumple-hero@abclogistica';

const HERO_WHITE = '#ffffff';
/** Mismo fondo que tarjeta Reconocimientos en HTML/editor (#f8fafc). */
const RECO_TARJETA_BG = '#f8fafc';
const RECO_CARD_W = 148;
const RECO_CARD_H = 185;

/**
 * Incrusta cada foto de tarjeta como CID (URLs externas caducan o los clientes bloquean el layout).
 * @param {object} payload
 * @returns {Promise<{ payload: object, attachments: object[] }>}
 */
async function embedReconocimientosCardImages(payload) {
  const tabla = Array.isArray(payload?.tablaTarjetas) ? payload.tablaTarjetas : [];
  if (!tabla.length) {
    return { payload, attachments: [] };
  }
  const outTarjetas = [];
  const extra = [];
  for (let i = 0; i < tabla.length; i += 1) {
    const t = tabla[i];
    const raw = typeof t?.imagenTarjetaUrl === 'string' ? t.imagenTarjetaUrl.trim() : '';
    let imagenTarjetaUrl = t.imagenTarjetaUrl;
    if (raw && !raw.startsWith('cid:')) {
      const cid = `reco-card-${i}@abclogistica`;
      try {
        let inputBuffer = null;
        if (raw.startsWith('data:')) {
          const parsed = parseDataUriForEmail(raw);
          if (parsed) inputBuffer = parsed.buffer;
        } else if (raw.startsWith('https://') || raw.startsWith('http://')) {
          inputBuffer = await fetchImageBufferFromUrl(raw);
        }
        if (inputBuffer) {
          const pct = Number.isFinite(Number(t?.imagenTarjetaSizePct)) ? Number(t.imagenTarjetaSizePct) : 100;
          const jpegBuf = await rasterizeGeminiBufferForEmail(inputBuffer, {
            imgBoxIdx: 0,
            imagenGeminiSizePct: pct,
            targetW: RECO_CARD_W,
            targetH: RECO_CARD_H,
            backgroundHexOverride: RECO_TARJETA_BG,
            recoTarjetaReplacePureWhite: true,
          });
          extra.push({
            filename: `reco-card-${i}.jpg`,
            content: jpegBuf,
            contentType: 'image/jpeg',
            cid,
          });
          imagenTarjetaUrl = `cid:${cid}`;
        }
      } catch (e) {
        console.error(`Reconocimientos tarjeta ${i} (imagen):`, e);
      }
    }
    outTarjetas.push({ ...t, imagenTarjetaUrl });
  }
  return {
    payload: { ...payload, tablaTarjetas: outTarjetas },
    attachments: extra,
  };
}

/**
 * @param {'cumpleanos_1' | 'aniversarios_1' | 'reconocimientos_1'} editorTipo
 */
async function compileCumpleanosFamilyOutgoing(plantilla_id, editorTipo, payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('payload inválido');
  }

  const [plRows] = await pool.query('SELECT definicion FROM plantillas WHERE id = ?', [plantilla_id]);
  const definicion = plRows[0]?.definicion;
  const logoRel = readLogoRutaCumpleanos(definicion);

  const { attachments: logoAtt, logoImgSrc } = buildLogoAttachmentAndSrc(logoRel);

  const heroAttachments = [];
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
        heroAttachments.push({
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

  let payloadForHtml = payload;
  let cardAtt = [];
  if (editorTipo === 'reconocimientos_1') {
    const emb = await embedReconocimientosCardImages(payload);
    payloadForHtml = emb.payload;
    cardAtt = emb.attachments;
  }

  const allAttachments = [...logoAtt, ...heroAttachments, ...cardAtt, ...socialAtt];

  const html = buildCumpleanosFamilyHtml(editorTipo, {
    payload: payloadForHtml,
    logoImgSrc,
    heroImage,
    socialImgSrcById,
  });

  return { html, attachments: allAttachments };
}

/**
 * @param {'cumpleanos_1' | 'aniversarios_1' | 'reconocimientos_1'} editorTipo
 */
async function sendCumpleanosFamilyForSolicitud(row, body, editorTipo) {
  if (row.editor_tipo !== editorTipo) {
    throw new Error(`Solo editor_tipo ${editorTipo} admite este envío SMTP`);
  }
  const payload = body.payload;
  const { html, attachments } = await compileCumpleanosFamilyOutgoing(row.plantilla_id, editorTipo, payload);
  const subject = resolveSolicitudSubject(row, payload);

  await sendEmail1Message({
    subject,
    html,
    enviarTodos: Boolean(body.enviar_todos),
    destinatariosRaw: body.destinatarios != null ? String(body.destinatarios) : '',
    attachments,
  });
}

async function sendCumpleanosFamilyPrueba(opts) {
  const plantilla_id = Number(opts.plantilla_id);
  const editorTipo = String(opts.editor_tipo || '').trim();
  const payload = opts.payload;
  const destinatariosRaw = opts.destinatariosRaw != null ? String(opts.destinatariosRaw) : '';
  const sid = Number(opts.solicitud_id);
  const row = { id: Number.isFinite(sid) && sid > 0 ? sid : 0 };
  const { html, attachments } = await compileCumpleanosFamilyOutgoing(plantilla_id, editorTipo, payload);
  const subject = resolveTestEmailSubject(row, payload);
  await sendEmail1Message({
    subject,
    html,
    enviarTodos: false,
    destinatariosRaw,
    attachments,
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
  sendCumpleanosFamilyPrueba,
  compileCumpleanosFamilyOutgoing,
};
