const { FONDO_CORREO_HEX } = require('../lib/email1Palettes');
const { escapeHtmlText, buildEmail1CtaRowHtml } = require('../lib/email1Cta');
const { buildEmail1SocialLinksHtml } = require('../lib/email1SocialLinks');
const { sanitizeEmailHtml } = require('./email1SanitizeHtml');

const ACCENT_HEX = '#008da8';
const NOMBRE_TABLA_COLOR = '#003b49';
const HERO_BG = '#ffffff';

/** Ilustración superior 16:9 (mismo ratio que Gemini + preview). */
const CUMPLE_HERO_W = 560;
const CUMPLE_HERO_H = 315;

function readLogoRutaCumpleanos(definicion) {
  try {
    const d = typeof definicion === 'string' ? JSON.parse(definicion) : definicion;
    return d?.cumpleanos?.logoRuta || d?.email1?.logoRuta || 'miniaturas/logo-abc-logistica.svg';
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

/** Igual que client/src/Cumpleanos1Editor.jsx — sombra de tarjeta Reconocimientos según fondo del correo. */
function rgbaFromHex(hex, alpha) {
  const h = String(hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    return `rgba(15, 23, 42, ${alpha})`;
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function recoTarjetaBoxShadow(fondoCorreoHex) {
  const hex = typeof fondoCorreoHex === 'string' && fondoCorreoHex ? fondoCorreoHex : FONDO_CORREO_HEX[0];
  return `0 2px 8px ${rgbaFromHex(hex, 0.845)}, 0 1px 3px ${rgbaFromHex(hex, 0.473)}`;
}

function injectLinkStyle(fragment, linkStyle) {
  return fragment.replace(/<a\s+/gi, `<a style="${linkStyle}" `);
}

function hasText(html) {
  const t = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();
  return t.length > 0;
}

function parseDesdeLocal(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return null;
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function añosCompletadosHastaHoy(desdeStr) {
  const start = parseDesdeLocal(desdeStr);
  if (!start) return null;
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const mo = now.getMonth() - start.getMonth();
  if (mo < 0 || (mo === 0 && now.getDate() < start.getDate())) years -= 1;
  return years >= 0 ? years : null;
}

function formatDesdeHumano(ymd) {
  const d = parseDesdeLocal(ymd);
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function geminiHeroBlock(w, h, bodyImage) {
  if (bodyImage.mode === 'img') {
    const src = bodyImage.src;
    return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${HERO_BG};border-radius:16px;border-collapse:collapse;border-spacing:0;max-width:100%;">
            <tr>
              <td align="center" style="padding:0;line-height:0;font-size:0;border:0;">
                <img src="${escapeAttr(src)}" alt="" width="${w}" height="${h}" style="display:block;width:${w}px;height:${h}px;max-width:100%;object-fit:cover;margin:0 auto;border:0;border-radius:16px;" />
              </td>
            </tr>
          </table>`;
  }
  if (bodyImage.mode === 'placeholder' && bodyImage.kind === 'bad') {
    return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${HERO_BG};border-radius:16px;min-height:${h}px;border-collapse:collapse;border-spacing:0;">
            <tr><td align="center" valign="middle" style="padding:12px;font-size:11px;color:#334155;border:0;height:${h}px;">Imagen no disponible</td></tr>
          </table>`;
  }
  return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${HERO_BG};border-radius:16px;min-height:${h}px;border-collapse:collapse;border-spacing:0;">
            <tr><td align="center" valign="middle" style="padding:12px;font-size:11px;color:#64748b;border:0;height:${h}px;">Ilustración (sin imagen)</td></tr>
          </table>`;
}

function buildAniversariosTableHtml(tarjetas) {
  const list = Array.isArray(tarjetas) ? tarjetas : [];
  const pairs = [];
  for (let i = 0; i < list.length; i += 2) {
    pairs.push([list[i], list[i + 1]]);
  }

  const rowsLen = pairs.length;
  const RAD = '12px';
  const spanNumStyle = `color:${ACCENT_HEX};font-family:'Nunito Sans',Verdana,sans-serif;font-weight:900;font-size:22px;`;
  const tdNumCell = `padding:8px;vertical-align:middle;text-align:center;width:20%;font-size:14px;`;
  const tdNombreCell = `padding:8px;vertical-align:middle;text-align:left;width:30%;font-size:17px;color:${NOMBRE_TABLA_COLOR};`;

  function tdShell(ri, ci, nCols, extra) {
    let s = '';
    if (ri === 0) s += `border-top:1px solid ${ACCENT_HEX};`;
    if (ci === 0) s += `border-left:1px solid ${ACCENT_HEX};`;
    s += `border-right:1px solid ${ACCENT_HEX};border-bottom:1px solid ${ACCENT_HEX};`;
    const isFirstRow = ri === 0;
    const isLastRow = ri === rowsLen - 1;
    const isFirstCol = ci === 0;
    const isLastCol = ci === nCols - 1;
    if (isFirstRow && isFirstCol) s += `border-top-left-radius:${RAD};`;
    if (isFirstRow && isLastCol) s += `border-top-right-radius:${RAD};`;
    if (isLastRow && isFirstCol) s += `border-bottom-left-radius:${RAD};`;
    if (isLastRow && isLastCol) s += `border-bottom-right-radius:${RAD};`;
    return `${s}${extra || ''}`;
  }

  function innerAños(t) {
    if (!t) return '&nbsp;';
    const años = añosCompletadosHastaHoy(t.desde);
    const desdeFmt = formatDesdeHumano(t.desde);
    const añosHtml =
      años != null
        ? `<span style="${spanNumStyle}">${años} ${años === 1 ? 'año' : 'años'}</span>`
        : `<span style="${spanNumStyle}">&nbsp;</span>`;
    const desdeLine = desdeFmt
      ? `<div style="margin-top:4px;font-size:10px;font-weight:normal;color:${NOMBRE_TABLA_COLOR};font-family:Verdana,Geneva,sans-serif;">Desde ${escapeHtmlText(desdeFmt)}</div>`
      : '';
    return `${añosHtml}${desdeLine}`;
  }

  function innerNombre(t) {
    if (!t) return '&nbsp;';
    const area = t.area
      ? `<div style="margin-top:4px;font-size:13px;color:${NOMBRE_TABLA_COLOR};font-family:Verdana,Geneva,sans-serif;">${escapeHtmlText(String(t.area))}</div>`
      : '';
    return `<div style="word-break:break-word;">${escapeHtmlText(String(t.nombre || ''))}</div>${area}`;
  }

  const rows = pairs
    .map((pair, ri) => {
      const [a, b] = pair;
      if (b) {
        return `<tr>
  <td style="${tdShell(ri, 0, 4, tdNumCell)}">${innerAños(a)}</td>
  <td style="${tdShell(ri, 1, 4, tdNombreCell)}">${innerNombre(a)}</td>
  <td style="${tdShell(ri, 2, 4, tdNumCell)}">${innerAños(b)}</td>
  <td style="${tdShell(ri, 3, 4, tdNombreCell)}">${innerNombre(b)}</td>
</tr>`;
      }
      return `<tr>
  <td style="${tdShell(ri, 0, 2, tdNumCell)}">${innerAños(a)}</td>
  <td style="${tdShell(ri, 1, 2, tdNombreCell)}" colspan="3">${innerNombre(a)}</td>
</tr>`;
    })
    .join('');

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;font-size:14px;font-family:Verdana,Geneva,sans-serif;">
  <tbody>${rows}</tbody>
</table>`;
}

/** Tarjeta Reconocimientos: imagen 4:5 + texto — tablas con anchos en px (Outlook/Gmail ignoran % en muchas celdas). */
const RECO_CARD_OUTER_W = 552;
const RECO_IMG_W = 148;
const RECO_IMG_H = 185;
const RECO_COL_IMG = 168;
const RECO_COL_TXT = RECO_CARD_OUTER_W - RECO_COL_IMG;

function buildReconocimientosCardsHtml(tarjetas, fondoCorreoHex) {
  const list = Array.isArray(tarjetas) ? tarjetas : [];
  const RECO = '#003b49';
  const linkStyle = 'color:#7c3aed;';
  const boxShadow = recoTarjetaBoxShadow(fondoCorreoHex);

  const cardBlocks = list
    .map((t) => {
      const titulo = escapeHtmlText(String(t?.nombre || ''));
      const areaTxt = escapeHtmlText(String(t?.area || ''));
      const cuerpo = hasText(t?.textoTarjetaHtml) ? sanitizeEmailHtml(t.textoTarjetaHtml) : '';
      const cuerpoHtml = cuerpo ? injectLinkStyle(cuerpo, linkStyle) : '';
      const src = t?.imagenTarjetaUrl && String(t.imagenTarjetaUrl).trim()
        ? escapeAttr(String(t.imagenTarjetaUrl).trim())
        : '';

      /** Sin height en la etiqueta: muchos webmails ignoran object-fit y estiran si width+height fijan otro ratio. */
      const imgBlock = src
        ? `<img src="${src}" alt="" width="${RECO_IMG_W}" style="display:block;width:${RECO_IMG_W}px;max-width:${RECO_IMG_W}px;height:auto;max-height:${RECO_IMG_H}px;border:0;line-height:0;outline:none;text-decoration:none;object-fit:cover;vertical-align:top;" />`
        : `<table role="presentation" width="${RECO_IMG_W}" cellpadding="0" cellspacing="0" style="width:${RECO_IMG_W}px;height:${RECO_IMG_H}px;border-collapse:collapse;"><tr><td style="width:${RECO_IMG_W}px;height:${RECO_IMG_H}px;background:#ffffff;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;

      /** Borde 1px: Gmail/Outlook suelen ignorar box-shadow en tablas; el borde siempre delimita la tarjeta. */
      return `
<table role="presentation" width="${RECO_CARD_OUTER_W}" align="center" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${RECO_CARD_OUTER_W}px;border-collapse:separate;border-spacing:0;margin:0 auto 16px auto;border:1px solid ${ACCENT_HEX};border-radius:12px;background:#ffffff;box-shadow:${boxShadow};-webkit-box-shadow:${boxShadow};mso-table-lspace:0pt;mso-table-rspace:0pt;table-layout:fixed;">
  <tr>
    <td width="${RECO_COL_IMG}" valign="middle" style="width:${RECO_COL_IMG}px;max-width:${RECO_COL_IMG}px;padding:10px;vertical-align:middle;background:#ffffff;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
        <tr>
          <td align="center" valign="middle" style="padding:0;line-height:0;font-size:0;mso-line-height-rule:exactly;width:${RECO_IMG_W}px;">
            ${imgBlock}
          </td>
        </tr>
      </table>
    </td>
    <td width="${RECO_COL_TXT}" valign="top" style="width:${RECO_COL_TXT}px;max-width:${RECO_COL_TXT}px;padding:10px;vertical-align:top;background:#ffffff;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
        <tr><td style="font-family:'Nunito Sans',Verdana,Geneva,sans-serif;font-weight:700;font-size:17px;line-height:1.3;color:${RECO};word-break:break-word;padding:0 0 4px 0;">${titulo || '&nbsp;'}</td></tr>
        <tr><td style="font-family:'Nunito Sans',Verdana,Geneva,sans-serif;font-weight:300;font-size:13px;line-height:1.4;color:${RECO};word-break:break-word;padding:0 0 12px 0;">${areaTxt || '&nbsp;'}</td></tr>
        <tr><td style="font-family:Verdana,Geneva,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;padding:0;">${cuerpoHtml || '&nbsp;'}</td></tr>
      </table>
    </td>
  </tr>
</table>`;
    })
    .join('');

  return cardBlocks || '&nbsp;';
}

function buildCumpleanosTableHtml(tarjetas) {
  const list = Array.isArray(tarjetas) ? tarjetas : [];
  const pairs = [];
  for (let i = 0; i < list.length; i += 2) {
    pairs.push([list[i], list[i + 1]]);
  }

  const rowsLen = pairs.length;
  const RAD = '12px';
  const tdNumText = `padding:12px;text-align:center;font-family:'Nunito Sans',Verdana,sans-serif;font-weight:900;font-size:22px;color:${ACCENT_HEX};`;
  const tdNombreText = `padding:12px;text-align:left;color:${NOMBRE_TABLA_COLOR};font-size:17px;`;

  /** Bordes + radius en esquinas (collapse rompe border-radius en muchos clientes de correo). */
  function tdShell(ri, ci, nCols, extra) {
    let s = '';
    if (ri === 0) s += `border-top:1px solid ${ACCENT_HEX};`;
    if (ci === 0) s += `border-left:1px solid ${ACCENT_HEX};`;
    s += `border-right:1px solid ${ACCENT_HEX};border-bottom:1px solid ${ACCENT_HEX};`;
    const isFirstRow = ri === 0;
    const isLastRow = ri === rowsLen - 1;
    const isFirstCol = ci === 0;
    const isLastCol = ci === nCols - 1;
    if (isFirstRow && isFirstCol) s += `border-top-left-radius:${RAD};`;
    if (isFirstRow && isLastCol) s += `border-top-right-radius:${RAD};`;
    if (isLastRow && isFirstCol) s += `border-bottom-left-radius:${RAD};`;
    if (isLastRow && isLastCol) s += `border-bottom-right-radius:${RAD};`;
    return `${s}${extra || ''}`;
  }

  const rows = pairs
    .map((pair, ri) => {
      const [a, b] = pair;
      if (b) {
        return `<tr>
  <td style="${tdShell(ri, 0, 4, `${tdNumText}width:15%;`)}">${escapeHtmlText(String(a?.fecha || '')) || '&nbsp;'}</td>
  <td style="${tdShell(ri, 1, 4, `${tdNombreText}width:35%;word-break:break-word;`)}">${escapeHtmlText(String(a?.nombre || '')) || '&nbsp;'}</td>
  <td style="${tdShell(ri, 2, 4, `${tdNumText}width:15%;`)}">${escapeHtmlText(String(b?.fecha || '')) || '&nbsp;'}</td>
  <td style="${tdShell(ri, 3, 4, `${tdNombreText}width:35%;word-break:break-word;`)}">${escapeHtmlText(String(b?.nombre || '')) || '&nbsp;'}</td>
</tr>`;
      }
      return `<tr>
  <td style="${tdShell(ri, 0, 2, `${tdNumText}width:15%;`)}">${escapeHtmlText(String(a?.fecha || '')) || '&nbsp;'}</td>
  <td style="${tdShell(ri, 1, 2, `${tdNombreText}word-break:break-word;`)} colspan="3">${escapeHtmlText(String(a?.nombre || '')) || '&nbsp;'}</td>
</tr>`;
    })
    .join('');

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;font-family:Verdana,Geneva,sans-serif;">
  <tbody>${rows}</tbody>
</table>`;
}

/**
 * @param {'cumpleanos_1' | 'aniversarios_1' | 'reconocimientos_1'} editorTipo
 * @param {object} opts
 */
function buildCumpleanosFamilyHtml(editorTipo, { payload, logoImgSrc, heroImage, borderColor = '#f1f5f9', socialImgSrcById = null }) {
  const fondoIdx = Number.isFinite(Number(payload?.fondoCorreoIdx)) ? Number(payload.fondoCorreoIdx) : 0;
  const fondoCorreo = FONDO_CORREO_HEX[fondoIdx] ?? FONDO_CORREO_HEX[0];

  const titulo = String(payload?.tituloHtml != null ? payload.tituloHtml : payload?.titulo || '').trim();
  const cuerpo = sanitizeEmailHtml(payload?.cuerpoHtml || '');
  const footer = sanitizeEmailHtml(payload?.footerHtml || '');

  const showTitulo = titulo.length > 0;
  const showCuerpo = hasText(cuerpo);
  const showFoot = hasText(footer);

  const tarjetas = Array.isArray(payload?.tablaTarjetas) ? payload.tablaTarjetas : [];
  const tablaHtml =
    editorTipo === 'reconocimientos_1'
      ? buildReconocimientosCardsHtml(tarjetas, fondoCorreo)
      : editorTipo === 'aniversarios_1'
        ? buildAniversariosTableHtml(tarjetas)
        : buildCumpleanosTableHtml(tarjetas);

  const heroBlock = geminiHeroBlock(CUMPLE_HERO_W, CUMPLE_HERO_H, heroImage);
  const ctaRowAfterCuerpo = buildEmail1CtaRowHtml(payload, 1);

  const bodyStyle = `margin:0;padding:0;background-color:${fondoCorreo};font-family:Verdana,Geneva,sans-serif;`;
  const cardStyle = `max-width:600px;margin:0 auto;background:#ffffff;border:1px solid ${borderColor};border-radius:16px;overflow:hidden;`;
  const innerStyle = 'padding:20px 24px 16px;';
  const textStyle =
    'font-family:Verdana,Geneva,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;';
  const textStyleSmall =
    'font-family:Verdana,Geneva,sans-serif;font-size:12px;line-height:1.5;color:#475569;text-align:center;';
  const linkStyle = 'color:#7c3aed;';

  const tituloBlock = showTitulo
    ? `<div style="text-align:center;padding:20px;font-family:Verdana,Geneva,sans-serif;font-size:36px;font-weight:bold;line-height:1.2;color:${ACCENT_HEX};">${escapeHtmlText(titulo)}</div>`
    : '';

  const logo =
    logoImgSrc && String(logoImgSrc).trim()
      ? `<img src="${escapeAttr(logoImgSrc)}" alt="ABC Logística" height="52" style="display:block;height:52px;max-height:52px;width:auto;max-width:290px;margin:0 auto;" />`
      : '<span style="font-size:18px;font-weight:bold;color:#003b49;">ABC Logística</span>';

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,300;0,6..12,700;0,6..12,900;1,6..12,300;1,6..12,700;1,6..12,900&display=swap" rel="stylesheet">
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
          ${tituloBlock ? `<tr><td style="padding:0;border:0;">${tituloBlock}</td></tr>` : ''}
          ${showCuerpo ? `<tr><td style="${innerStyle}"><div style="${textStyle}">${injectLinkStyle(cuerpo, linkStyle)}</div></td></tr>` : ''}
          ${ctaRowAfterCuerpo}
          <tr><td style="padding:0 24px 16px;border:0;">
            <div style="max-width:90%;margin:0 auto;">${heroBlock}</div>
          </td></tr>
          <tr><td style="padding:0 24px 16px;border:0;">${tablaHtml}</td></tr>
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
  buildCumpleanosFamilyHtml,
  readLogoRutaCumpleanos,
  CUMPLE_HERO_W,
  CUMPLE_HERO_H,
};
