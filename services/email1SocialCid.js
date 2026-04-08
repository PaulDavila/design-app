const sharp = require('sharp');

/** SVG oficiales (v9 incluye LinkedIn); versión fija para builds reproducibles. */
const SIMPLE_ICONS_V9_BASE =
  'https://cdn.jsdelivr.net/npm/simple-icons@9.14.0/icons';

const SOCIAL_SLUGS = [
  { id: 'linkedin', slug: 'linkedin' },
  { id: 'instagram', slug: 'instagram' },
  { id: 'tiktok', slug: 'tiktok' },
  { id: 'youtube', slug: 'youtube' },
];

/** Gris tipo slate-500 (los SVG de Simple Icons son negros por defecto). */
const SOCIAL_ICON_FILL_HEX = '#64748b';

/**
 * Fuerza el color del glifo antes de rasterizar (evita PNG negro en el correo).
 * @param {string} svg
 * @returns {string}
 */
function svgWithGrayFill(svg) {
  const g = SOCIAL_ICON_FILL_HEX;
  if (/\sfill\s*=\s*"/i.test(svg)) {
    return svg.replace(/\sfill\s*=\s*"[^"]*"/gi, ` fill="${g}"`);
  }
  return svg.replace(/<svg\s/i, `<svg fill="${g}" `);
}

/**
 * Descarga SVG, rasteriza a PNG y prepara adjuntos CID (mismo patrón que logo / imagen cuerpo).
 * @returns {Promise<{ attachments: object[], imgSrcById: Record<string, string> }>}
 */
async function buildEmail1SocialCidAttachments() {
  const attachments = [];
  const imgSrcById = {};

  for (const { id, slug } of SOCIAL_SLUGS) {
    const url = `${SIMPLE_ICONS_V9_BASE}/${slug}.svg`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`No se pudo descargar icono social ${slug}: HTTP ${res.status}`);
    }
    const svg = await res.text();
    const tinted = svgWithGrayFill(svg);
    const png = await sharp(Buffer.from(tinted)).resize(48, 48).png().toBuffer();
    const cid = `email1-soc-${id}@abclogistica`;
    attachments.push({
      filename: `${id}-social.png`,
      content: png,
      contentType: 'image/png',
      cid,
    });
    imgSrcById[id] = `cid:${cid}`;
  }

  return { attachments, imgSrcById };
}

module.exports = { buildEmail1SocialCidAttachments, SOCIAL_SLUGS };
