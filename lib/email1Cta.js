const { FONDO_CUADRO_IMAGEN_HEX } = require('./email1Palettes');

/**
 * @param {unknown} s
 * @returns {string|null} URL normalizada o null
 */
function sanitizeCtaHttpUrl(s) {
  const u = String(s || '').trim();
  if (!u.startsWith('https://') && !u.startsWith('http://')) return null;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function escapeHtmlText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clampCtaFontSizePx(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 18;
  return Math.min(32, Math.max(12, Math.round(x)));
}

/**
 * @param {object} payload
 * @param {string} pre
 * @returns {'left'|'center'|'right'}
 */
function normalizeCtaAlign(payload, pre) {
  const a = String(payload[`${pre}Align`] || 'center').toLowerCase();
  if (a === 'left') return 'left';
  if (a === 'right') return 'right';
  return 'center';
}

/** @param {1|2|3|4|5} which */
function ctaPre(which) {
  if (which === 1) return 'ctaAfter1';
  if (which === 2) return 'ctaAfter2';
  if (which === 3) return 'ctaAfter3';
  if (which === 4) return 'ctaAfter4';
  if (which === 5) return 'ctaAfter5';
  return 'ctaAfter1';
}

/**
 * @param {object} payload
 * @param {1|2|3|4|5} which
 * @returns {boolean}
 */
function isEmail1CtaComplete(payload, which) {
  const pre = ctaPre(which);
  if (!payload || payload[`${pre}Enabled`] !== true) return false;
  const text = String(payload[`${pre}Text`] || '').trim();
  const url = sanitizeCtaHttpUrl(payload[`${pre}Url`]);
  return Boolean(text && url);
}

function ctaButtonInnerHtml(payload, pre) {
  const text = String(payload[`${pre}Text`] || '').trim();
  const url = sanitizeCtaHttpUrl(payload[`${pre}Url`]);
  const idx = Number.isFinite(Number(payload[`${pre}ColorIdx`]))
    ? Number(payload[`${pre}ColorIdx`])
    : 0;
  const bg = FONDO_CUADRO_IMAGEN_HEX[idx] ?? FONDO_CUADRO_IMAGEN_HEX[0];
  const fs = clampCtaFontSizePx(payload[`${pre}FontSizePx`]);
  const safeHref = escapeHtmlText(url);
  const safeText = escapeHtmlText(text);
  const innerStyle = `font-family:'Nunito Sans',Verdana,Geneva,sans-serif;font-weight:900;font-size:${fs}px;line-height:1.25;color:#ffffff;text-decoration:none;display:inline-block;text-align:center;border-radius:30px;`;
  return {
    align: normalizeCtaAlign(payload, pre),
    bg,
    safeHref,
    safeText,
    innerStyle,
  };
}

/**
 * Fila HTML para correo (tabla). Vacío si no aplica.
 * @param {object} payload
 * @param {1|2|3|4|5} which
 * @returns {string}
 */
function buildEmail1CtaRowHtml(payload, which) {
  if (!isEmail1CtaComplete(payload, which)) return '';
  const pre = ctaPre(which);
  const { align, bg, safeHref, safeText, innerStyle } = ctaButtonInnerHtml(payload, pre);
  return `
      <tr>
        <td align="${align}" style="padding:20px 24px 16px;border-width:0;border-style:none;border-color:transparent;border-bottom:0;mso-border-bottom-alt:none;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-spacing:0;">
            <tr>
              <td align="center" style="padding:14px 20px;background-color:${bg};border-radius:30px;overflow:hidden;">
                <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="${innerStyle}">${safeText}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
}

/**
 * Bloque CTA para dentro de una celda de tabla (p. ej. columna texto Email 2).
 * @param {object} payload
 * @param {1|2|3|4|5} which
 * @returns {string}
 */
function buildEmail1CtaInCellHtml(payload, which) {
  if (!isEmail1CtaComplete(payload, which)) return '';
  const pre = ctaPre(which);
  const { align, bg, safeHref, safeText, innerStyle } = ctaButtonInnerHtml(payload, pre);
  return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-spacing:0;">
            <tr>
              <td align="${align}" style="padding:14px 0 0 0;border:0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-spacing:0;">
                  <tr>
                    <td align="center" style="padding:14px 20px;background-color:${bg};border-radius:30px;overflow:hidden;">
                      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="${innerStyle}">${safeText}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>`;
}

module.exports = {
  sanitizeCtaHttpUrl,
  escapeHtmlText,
  clampCtaFontSizePx,
  normalizeCtaAlign,
  isEmail1CtaComplete,
  buildEmail1CtaRowHtml,
  buildEmail1CtaInCellHtml,
};
