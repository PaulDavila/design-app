const { FONDO_CORREO_HEX, FONDO_CUADRO_IMAGEN_HEX, TEXTO_MARCA_HEX } = require('../lib/email1Palettes');
const { buildEmail1CtaRowHtml, buildEmail1CtaInCellHtml, escapeHtmlText } = require('../lib/email1Cta');
const { buildEmail1SocialLinksHtml } = require('../lib/email1SocialLinks');
const { sanitizeEmailHtml } = require('./email1SanitizeHtml');

/** Lado útil de la imagen 1:1 en columna derecha (debe coincidir con raster en email1Send). */
const NEWSLETTER_BODY_IMG_PX = 268;

function hasText(html) {
  const t = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();
  return t.length > 0;
}

/**
 * @param {string|object|null} definicion - JSON plantilla
 * @param {string} [editorTipo] - p. ej. newsletter_1 fuerza logo de newsletter
 */
function readLogoRuta(definicion, editorTipo) {
  if (editorTipo === 'newsletter_1') {
    return 'miniaturas/logo-newsletter.svg';
  }
  try {
    const d = typeof definicion === 'string' ? JSON.parse(definicion) : definicion;
    return d?.email1?.logoRuta || 'miniaturas/logo-abc-logistica.svg';
  } catch {
    return 'miniaturas/logo-abc-logistica.svg';
  }
}

/**
 * @param {object} opts
 * @param {object} opts.payload - serializePayload Email 1
 * @param {string} opts.logoImgSrc - src final del logo (https o cid:...); vacío = texto
 * @param {{ mode: 'img', src: string } | { mode: 'placeholder', kind: 'empty' | 'bad' }} opts.bodyImage
 * @param {string} [opts.borderColor]
 * @param {Record<string, string> | null} [opts.socialImgSrcById] src por id de red (p. ej. cid: al enviar)
 */
function buildEmail1Html({ payload, logoImgSrc, bodyImage, borderColor = '#f1f5f9', socialImgSrcById = null }) {
  const fondoIdx = Number.isFinite(Number(payload?.fondoCorreoIdx)) ? Number(payload.fondoCorreoIdx) : 0;
  const imgBoxIdx = Number.isFinite(Number(payload?.imgBoxIdx)) ? Number(payload.imgBoxIdx) : 0;
  const fondoCorreo = FONDO_CORREO_HEX[fondoIdx] ?? FONDO_CORREO_HEX[0];
  const bgImg = FONDO_CUADRO_IMAGEN_HEX[imgBoxIdx] ?? FONDO_CUADRO_IMAGEN_HEX[0];

  const cuerpo1 = sanitizeEmailHtml(payload?.cuerpo1Html || '');
  const cuerpo2 = sanitizeEmailHtml(payload?.cuerpo2Html || '');
  const footer = sanitizeEmailHtml(payload?.footerHtml || '');

  const show1 = hasText(cuerpo1);
  const show2 = hasText(cuerpo2);
  const showFoot = hasText(footer);

  const bodyStyle = `margin:0;padding:0;background-color:${fondoCorreo};font-family:Verdana,Geneva,sans-serif;`;
  const cardStyle = `max-width:600px;margin:0 auto;background:#ffffff;border:1px solid ${borderColor};border-radius:16px;overflow:hidden;`;
  const innerStyle = 'padding:20px 24px 16px;';
  const textStyle =
    'font-family:Verdana,Geneva,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;';
  const textStyleSmall =
    'font-family:Verdana,Geneva,sans-serif;font-size:12px;line-height:1.5;color:#475569;text-align:center;';
  const linkStyle = 'color:#7c3aed;';

  let imageBlock = '';
  if (bodyImage.mode === 'img') {
    const src = bodyImage.src;
    imageBlock = `
      <tr>
        <td style="padding:0 24px 16px;border:0;border-top:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bgImg};border-radius:16px;border-collapse:collapse;border-spacing:0;">
            <tr>
              <td align="center" style="padding:0;line-height:0;font-size:0;border:0;">
                <img src="${escapeAttr(src)}" alt="" width="552" height="170" style="display:block;width:552px;height:170px;max-width:100%;margin:0 auto;border:0;border-radius:16px;" />
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  } else if (bodyImage.mode === 'placeholder' && bodyImage.kind === 'bad') {
    imageBlock = `
      <tr>
        <td style="padding:0 24px 16px;border:0;border-top:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bgImg};border-radius:16px;min-height:120px;border-collapse:collapse;border-spacing:0;">
            <tr><td align="center" style="padding:16px;font-size:11px;color:#334155;border:0;">Imagen no disponible (URL no pública o demasiado grande)</td></tr>
          </table>
        </td>
      </tr>`;
  } else {
    imageBlock = `
      <tr>
        <td style="padding:0 24px 16px;border:0;border-top:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bgImg};border-radius:16px;min-height:120px;border-collapse:collapse;border-spacing:0;">
            <tr><td align="center" style="padding:16px;font-size:11px;color:#64748b;border:0;">Ilustración (sin imagen)</td></tr>
          </table>
        </td>
      </tr>`;
  }

  const logo =
    logoImgSrc && String(logoImgSrc).trim()
      ? `<img src="${escapeAttr(logoImgSrc)}" alt="ABC Logística" height="52" style="display:block;height:52px;max-height:52px;width:auto;max-width:290px;margin:0 auto;" />`
      : '<span style="font-size:18px;font-weight:bold;color:#003b49;">ABC Logística</span>';

  const ctaRow1 = buildEmail1CtaRowHtml(payload, 1);
  const ctaRow2 = buildEmail1CtaRowHtml(payload, 2);

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
          ${show1 ? `<tr><td style="${innerStyle}"><div style="${textStyle}">${injectLinkStyle(cuerpo1, linkStyle)}</div></td></tr>` : ''}
          ${ctaRow1}
          ${imageBlock}
          ${show2 ? `<tr><td style="${innerStyle}"><div style="${textStyle}">${injectLinkStyle(cuerpo2, linkStyle)}</div></td></tr>` : ''}
          ${ctaRow2}
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

function formatNewsletterFechaDisplay(iso) {
  const s = String(iso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return '';
  try {
    return dt.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return s;
  }
}

/**
 * Newsletter: logo, fila 50/50 (texto + CTA | imagen cuadrada), pie.
 * @param {object} opts - mismo contrato que buildEmail1Html
 */
function buildNewsletterHtml({
  payload,
  logoImgSrc,
  bodyImage,
  borderColor = '#f1f5f9',
  socialImgSrcById = null,
}) {
  const fondoIdx = Number.isFinite(Number(payload?.fondoCorreoIdx)) ? Number(payload.fondoCorreoIdx) : 0;
  const imgBoxIdx = Number.isFinite(Number(payload?.imgBoxIdx)) ? Number(payload.imgBoxIdx) : 0;
  const fondoCorreo = FONDO_CORREO_HEX[fondoIdx] ?? FONDO_CORREO_HEX[0];
  const bgImg = FONDO_CUADRO_IMAGEN_HEX[imgBoxIdx] ?? FONDO_CUADRO_IMAGEN_HEX[0];

  const fechaIdx = Number.isFinite(Number(payload?.newsletterFechaColorIdx))
    ? Number(payload.newsletterFechaColorIdx)
    : 0;
  const tituloIdx = Number.isFinite(Number(payload?.newsletterTituloColorIdx))
    ? Number(payload.newsletterTituloColorIdx)
    : 0;
  const fechaHex = FONDO_CUADRO_IMAGEN_HEX[fechaIdx] ?? FONDO_CUADRO_IMAGEN_HEX[0];
  const tituloHex = TEXTO_MARCA_HEX[tituloIdx] ?? TEXTO_MARCA_HEX[0];

  const cuerpo1 = sanitizeEmailHtml(payload?.cuerpo1Html || '');
  const footer = sanitizeEmailHtml(payload?.footerHtml || '');
  const show1 = hasText(cuerpo1);
  const showFoot = hasText(footer);

  const fechaStr = formatNewsletterFechaDisplay(payload?.newsletterFecha);
  const tituloPlain = String(payload?.newsletterTitulo || '').trim();

  const bodyStyle = `margin:0;padding:0;background-color:${fondoCorreo};font-family:Verdana,Geneva,sans-serif;`;
  const cardStyle = `max-width:600px;margin:0 auto;background:#ffffff;border:1px solid ${borderColor};border-radius:16px;overflow:hidden;`;
  const textStyle =
    'font-family:Verdana,Geneva,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;';
  const textStyleSmall =
    'font-family:Verdana,Geneva,sans-serif;font-size:12px;line-height:1.5;color:#475569;text-align:center;';
  const linkStyle = 'color:#7c3aed;';
  const sq = NEWSLETTER_BODY_IMG_PX;

  const logo =
    logoImgSrc && String(logoImgSrc).trim()
      ? `<img src="${escapeAttr(logoImgSrc)}" alt="ABC Logística" height="102" style="display:block;height:102px;max-height:102px;width:auto;max-width:390px;margin:0 auto;" />`
      : '<span style="font-size:18px;font-weight:bold;color:#003b49;">ABC Logística</span>';

  let rightCol = '';
  if (bodyImage.mode === 'img') {
    const src = bodyImage.src;
    rightCol = `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bgImg};border-radius:16px;border-collapse:collapse;border-spacing:0;">
            <tr>
              <td align="center" style="padding:8px;line-height:0;font-size:0;border:0;">
                <img src="${escapeAttr(src)}" alt="" width="${sq}" height="${sq}" style="display:block;width:${sq}px;height:${sq}px;max-width:100%;margin:0 auto;border:0;border-radius:16px;" />
              </td>
            </tr>
          </table>`;
  } else if (bodyImage.mode === 'placeholder' && bodyImage.kind === 'bad') {
    rightCol = `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bgImg};border-radius:16px;min-height:${sq}px;border-collapse:collapse;border-spacing:0;">
            <tr><td align="center" style="padding:16px;font-size:11px;color:#334155;border:0;">Imagen no disponible</td></tr>
          </table>`;
  } else {
    rightCol = `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bgImg};border-radius:16px;min-height:${sq}px;border-collapse:collapse;border-spacing:0;">
            <tr><td align="center" style="padding:16px;font-size:11px;color:#64748b;border:0;">Ilustración (sin imagen)</td></tr>
          </table>`;
  }

  const fechaBlock = fechaStr
    ? `<div style="font-family:Verdana,Geneva,sans-serif;font-size:13px;line-height:1.4;font-weight:600;color:${fechaHex};text-transform:capitalize;margin:0 0 12px 0;">${escapeHtmlText(fechaStr)}</div>`
    : '';

  const tituloBlock = tituloPlain
    ? `<div style="font-family:'Nunito Sans',Verdana,Geneva,sans-serif;font-size:20px;line-height:1.25;font-weight:900;color:${tituloHex};margin:0 0 14px 0;">${escapeHtmlText(tituloPlain)}</div>`
    : '';

  const cuerpoBlock = show1
    ? `<div style="${textStyle} margin-bottom:8px;">${injectLinkStyle(cuerpo1, linkStyle)}</div>`
    : '';

  const ctaPayload = { ...payload, ctaAfter1Enabled: true };
  const ctaInCell = buildEmail1CtaInCellHtml(ctaPayload, 1);

  const twoColRow = `
      <tr>
        <td style="padding:0;border:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-spacing:0;">
            <tr>
              <td width="50%" valign="top" style="padding:20px 12px 20px 24px;border:0;">
                ${fechaBlock}
                ${tituloBlock}
                ${cuerpoBlock}
                ${ctaInCell}
              </td>
              <td width="50%" valign="top" style="padding:20px 24px 20px 12px;border:0;">
                ${rightCol}
              </td>
            </tr>
          </table>
        </td>
      </tr>`;

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
            <td style="border-bottom:1px solid ${borderColor};padding:12px 24px;text-align:center;">
              ${logo}
            </td>
          </tr>
          ${twoColRow}
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

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function injectLinkStyle(fragment, linkStyle) {
  return fragment.replace(/<a\s+/gi, `<a style="${linkStyle}" `);
}

module.exports = {
  buildEmail1Html,
  buildNewsletterHtml,
  readLogoRuta,
  NEWSLETTER_BODY_IMG_PX,
};
