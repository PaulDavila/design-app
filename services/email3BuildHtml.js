const { FONDO_CORREO_HEX, FONDO_CUADRO_IMAGEN_HEX } = require('../lib/email1Palettes');
const {
  buildEmail1CtaRowHtml,
  buildEmail1CtaInCellHtml,
  escapeHtmlText,
} = require('../lib/email1Cta');
const { buildEmail1SocialLinksHtml } = require('../lib/email1SocialLinks');
const { sanitizeEmailHtml } = require('./email1SanitizeHtml');

/** Texto 2 + imagen 1 (4:3 en columna estrecha). */
const EMAIL3_IMG1_W = 220;
const EMAIL3_IMG1_H = 165;
/** Texto 4 + imagen 2 (proporción ~5:7 del preview). */
const EMAIL3_IMG2_W = 200;
const EMAIL3_IMG2_H = 280;

function hasText(html) {
  const t = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();
  return t.length > 0;
}

function readLogoRutaEmail3(definicion) {
  try {
    const d = typeof definicion === 'string' ? JSON.parse(definicion) : definicion;
    return d?.email3?.logoRuta || d?.email1?.logoRuta || 'miniaturas/logo-abc-logistica.svg';
  } catch {
    return 'miniaturas/logo-abc-logistica.svg';
  }
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function injectLinkStyle(fragment, linkStyle) {
  return fragment.replace(/<a\s+/gi, `<a style="${linkStyle}" `);
}

function geminiCellBlock(w, h, bodyImage, bgHex) {
  if (bodyImage.mode === 'img') {
    const src = bodyImage.src;
    // Solo ancho fijo + max-width:100%; height:auto para no forzar alto cuando la columna
    // (p. ej. 30% en imagen 2) es más estrecha que w: si height queda en px, el cliente
    // estira verticalmente al reducir el ancho. El JPEG ya sale w×h desde el rasterizador.
    return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bgHex};border-radius:16px;border-collapse:collapse;border-spacing:0;">
            <tr>
              <td align="center" style="padding:0;line-height:0;font-size:0;border:0;">
                <img src="${escapeAttr(src)}" alt="" width="${w}" style="display:block;width:${w}px;max-width:100%;height:auto;margin:0 auto;border:0;border-radius:16px;" />
              </td>
            </tr>
          </table>`;
  }
  if (bodyImage.mode === 'placeholder' && bodyImage.kind === 'bad') {
    return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bgHex};border-radius:16px;min-height:80px;border-collapse:collapse;border-spacing:0;">
            <tr><td align="center" style="padding:12px;font-size:11px;color:#334155;border:0;">Imagen no disponible</td></tr>
          </table>`;
  }
  return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bgHex};border-radius:16px;min-height:80px;border-collapse:collapse;border-spacing:0;">
            <tr><td align="center" style="padding:12px;font-size:11px;color:#64748b;border:0;">Ilustración (sin imagen)</td></tr>
          </table>`;
}

function twoColRow(leftInner, blockRight) {
  return `
      <tr>
        <td style="padding:0 24px 16px;border:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td valign="top" width="60%" style="padding:0 10px 0 0;vertical-align:top;">
                ${leftInner}
              </td>
              <td valign="top" width="40%" style="padding:0;vertical-align:top;">
                ${blockRight}
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
}

function twoColRow7030(leftInner, blockRight) {
  return `
      <tr>
        <td style="padding:0 24px 16px;border:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td valign="top" width="70%" style="padding:0 10px 0 0;vertical-align:top;">
                ${leftInner}
              </td>
              <td valign="top" width="30%" style="padding:0;vertical-align:top;">
                ${blockRight}
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
}

/**
 * @param {object} opts
 * @param {object} opts.payload
 * @param {string} opts.logoImgSrc
 * @param {object} opts.image1
 * @param {object} opts.image2
 * @param {Record<string, string> | null} [opts.socialImgSrcById]
 */
function buildEmail3Html({ payload, logoImgSrc, image1, image2, borderColor = '#f1f5f9', socialImgSrcById = null }) {
  const fondoIdx = Number.isFinite(Number(payload?.fondoCorreoIdx)) ? Number(payload.fondoCorreoIdx) : 0;
  const imgBox1Idx = Number.isFinite(Number(payload?.imgBox1Idx)) ? Number(payload.imgBox1Idx) : 0;
  const imgBox2Idx = Number.isFinite(Number(payload?.imgBox2Idx)) ? Number(payload.imgBox2Idx) : 0;
  const fondoCorreo = FONDO_CORREO_HEX[fondoIdx] ?? FONDO_CORREO_HEX[0];
  const bgImg1 = FONDO_CUADRO_IMAGEN_HEX[imgBox1Idx] ?? FONDO_CUADRO_IMAGEN_HEX[0];
  const bgImg2 = FONDO_CUADRO_IMAGEN_HEX[imgBox2Idx] ?? FONDO_CUADRO_IMAGEN_HEX[0];

  const titulo = sanitizeEmailHtml(payload?.tituloHtml || '');
  const cuerpo1 = sanitizeEmailHtml(payload?.cuerpo1Html || '');
  const cuerpo2 = sanitizeEmailHtml(payload?.cuerpo2Html || '');
  const cuerpo3 = sanitizeEmailHtml(payload?.cuerpo3Html || '');
  const cuerpo4 = sanitizeEmailHtml(payload?.cuerpo4Html || '');
  const cuerpo5 = sanitizeEmailHtml(payload?.cuerpo5Html || '');
  const footer = sanitizeEmailHtml(payload?.footerHtml || '');

  const showTitle = hasText(titulo);
  const show1 = hasText(cuerpo1);
  const show2 = hasText(cuerpo2);
  const show3 = hasText(cuerpo3);
  const show4 = hasText(cuerpo4);
  const show5 = hasText(cuerpo5);
  const showFoot = hasText(footer);

  const bodyStyle = `margin:0;padding:0;background-color:${fondoCorreo};font-family:Verdana,Geneva,sans-serif;`;
  const cardStyle = `max-width:600px;margin:0 auto;background:#ffffff;border:1px solid ${borderColor};border-radius:16px;overflow:hidden;`;
  const innerStyle = 'padding:20px 24px 16px;';
  const textStyle =
    'font-family:Verdana,Geneva,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;';
  const titleStyle =
    'font-family:Verdana,Geneva,sans-serif;font-size:20px;font-weight:bold;line-height:1.3;color:#0f172a;';
  const textStyleSmall =
    'font-family:Verdana,Geneva,sans-serif;font-size:12px;line-height:1.5;color:#475569;text-align:center;';
  const linkStyle = 'color:#7c3aed;';

  const block1 = geminiCellBlock(EMAIL3_IMG1_W, EMAIL3_IMG1_H, image1, bgImg1);
  const block2 = geminiCellBlock(EMAIL3_IMG2_W, EMAIL3_IMG2_H, image2, bgImg2);

  const cta2InCell = buildEmail1CtaInCellHtml(payload, 2);
  const leftCol21 = [
    show2 ? `<div style="${textStyle}">${injectLinkStyle(cuerpo2, linkStyle)}</div>` : '',
    cta2InCell,
  ].join('');
  const left21 = leftCol21.trim() ? leftCol21 : '&nbsp;';

  const cta4InCell = buildEmail1CtaInCellHtml(payload, 4);
  const leftCol43 = [
    show4 ? `<div style="${textStyle}">${injectLinkStyle(cuerpo4, linkStyle)}</div>` : '',
    cta4InCell,
  ].join('');
  const left43 = leftCol43.trim() ? leftCol43 : '&nbsp;';

  const logo =
    logoImgSrc && String(logoImgSrc).trim()
      ? `<img src="${escapeAttr(logoImgSrc)}" alt="ABC Logística" height="52" style="display:block;height:52px;max-height:52px;width:auto;max-width:290px;margin:0 auto;" />`
      : '<span style="font-size:18px;font-weight:bold;color:#003b49;">ABC Logística</span>';

  const ctaRow1 = buildEmail1CtaRowHtml(payload, 1);
  const ctaRow3 = buildEmail1CtaRowHtml(payload, 3);
  const ctaRow5 = buildEmail1CtaRowHtml(payload, 5);

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,900;1,6..12,900&display=swap" rel="stylesheet">
</head>
<body style="${bodyStyle}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${fondoCorreo};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${cardStyle}" border="0">
          <tr>
            <td style="border-bottom:1px solid ${borderColor};padding:16px 24px;text-align:center;">
              ${logo}
            </td>
          </tr>
          ${showTitle ? `<tr><td style="${innerStyle}"><div style="${titleStyle}">${injectLinkStyle(titulo, linkStyle)}</div></td></tr>` : ''}
          ${show1 ? `<tr><td style="${innerStyle}"><div style="${textStyle}">${injectLinkStyle(cuerpo1, linkStyle)}</div></td></tr>` : ''}
          ${ctaRow1}
          ${twoColRow(left21, block1)}
          ${show3 ? `<tr><td style="${innerStyle}"><div style="${textStyle}">${injectLinkStyle(cuerpo3, linkStyle)}</div></td></tr>` : ''}
          ${ctaRow3}
          ${twoColRow7030(left43, block2)}
          ${show5 ? `<tr><td style="${innerStyle}"><div style="${textStyle}">${injectLinkStyle(cuerpo5, linkStyle)}</div></td></tr>` : ''}
          ${ctaRow5}
          <tr>
            <td style="border-top:1px solid ${borderColor};background-color:#f8fafc;padding:16px 24px;">
              ${showFoot ? `<div style="${textStyleSmall}">${injectLinkStyle(footer, linkStyle)}</div>` : ''}
              ${buildEmail1SocialLinksHtml(escapeAttr, escapeHtmlText, socialImgSrcById)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return html.trim();
}

module.exports = {
  buildEmail3Html,
  readLogoRutaEmail3,
  EMAIL3_IMG1_W,
  EMAIL3_IMG1_H,
  EMAIL3_IMG2_W,
  EMAIL3_IMG2_H,
};
