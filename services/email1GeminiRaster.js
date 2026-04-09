const sharp = require('sharp');
const { FONDO_CUADRO_IMAGEN_HEX } = require('../lib/email1Palettes');
const { MAX_IMAGE_BYTES } = require('../lib/parseDataUri');

/** Mismo rectángulo lógico que el preview en Email1Editor (ancho útil ~600−48). */
const GEMINI_EMAIL_W = 552;
const GEMINI_EMAIL_H = 170;

function resolveBoxBackgroundHex(opts) {
  const override = opts?.backgroundHexOverride;
  if (typeof override === 'string' && /^#[0-9a-fA-F]{6}$/.test(override.trim())) {
    return override.trim();
  }
  const idx = Number.isFinite(Number(opts?.imgBoxIdx)) ? Number(opts.imgBoxIdx) : 0;
  const hex = FONDO_CUADRO_IMAGEN_HEX[idx] ?? FONDO_CUADRO_IMAGEN_HEX[0];
  return /^#[0-9a-fA-F]{6}$/.test(String(hex)) ? hex : FONDO_CUADRO_IMAGEN_HEX[0];
}

function resolveSizePct(opts) {
  if (!Number.isFinite(Number(opts?.imagenGeminiSizePct))) return 100;
  return Math.min(200, Math.max(25, Number(opts.imagenGeminiSizePct)));
}

function hexToRgb(hex) {
  const n = parseInt(String(hex).replace(/^#/, ''), 16);
  if (!Number.isFinite(n)) return { r: 128, g: 190, b: 218 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Replica object-cover + scale del editor; salida JPEG targetW x targetH (por defecto Email 1).
 * @param {Buffer} inputBuffer
 * @param {object} opts - imgBoxIdx, imagenGeminiSizePct; opcional targetW, targetH
 */
async function rasterizeGeminiBufferForEmail(inputBuffer, opts) {
  const W = Number.isFinite(Number(opts?.targetW)) ? Number(opts.targetW) : GEMINI_EMAIL_W;
  const H = Number.isFinite(Number(opts?.targetH)) ? Number(opts.targetH) : GEMINI_EMAIL_H;
  const s = resolveSizePct(opts) / 100;
  const bgHex = resolveBoxBackgroundHex(opts);

  const rotated = sharp(inputBuffer).rotate();

  if (s >= 1) {
    const outW = Math.max(1, Math.round(W * s));
    const outH = Math.max(1, Math.round((outW * H) / W));
    const resized = await rotated.resize(outW, outH, { fit: 'cover', position: 'centre' }).toBuffer();
    const meta = await sharp(resized).metadata();
    const w0 = meta.width || outW;
    const h0 = meta.height || outH;
    const left = Math.max(0, Math.floor((w0 - W) / 2));
    const top = Math.max(0, Math.floor((h0 - H) / 2));
    return sharp(resized)
      .extract({ left, top, width: W, height: H })
      .flatten({ background: bgHex })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  }

  const covered = await rotated.resize(W, H, { fit: 'cover', position: 'centre' }).toBuffer();
  const smallW = Math.max(1, Math.round(W * s));
  /** Misma relación W:H que el lienzo; redondear ambos por separado rompe el ratio y fill estira la imagen. */
  const smallH = Math.max(1, Math.round((smallW * H) / W));
  const scaled = await sharp(covered).resize(smallW, smallH, { fit: 'fill' }).toBuffer();
  const left = Math.floor((W - smallW) / 2);
  const top = Math.floor((H - smallH) / 2);
  const { r, g, b } = hexToRgb(bgHex);

  return sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: { r, g, b },
    },
  })
    .composite([{ input: scaled, left, top }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

/**
 * @param {string} urlStr
 * @returns {Promise<Buffer>}
 */
async function fetchImageBufferFromUrl(urlStr) {
  if (typeof fetch !== 'function') {
    throw new Error('Se requiere Node.js 18+ (fetch) para descargar imágenes por URL');
  }
  const res = await fetch(urlStr, {
    redirect: 'follow',
    headers: { Accept: 'image/*,*/*' },
  });
  if (!res.ok) {
    throw new Error(`No se pudo descargar la imagen (${res.status})`);
  }
  const len = res.headers.get('content-length');
  if (len != null && Number(len) > MAX_IMAGE_BYTES) {
    throw new Error('La imagen por URL supera el tamaño máximo permitido');
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) {
    throw new Error('La imagen por URL supera el tamaño máximo permitido');
  }
  return buf;
}

module.exports = {
  rasterizeGeminiBufferForEmail,
  fetchImageBufferFromUrl,
  GEMINI_EMAIL_W,
  GEMINI_EMAIL_H,
};
