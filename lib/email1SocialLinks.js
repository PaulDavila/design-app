/** Enlaces fijos pie Email 1 — correo HTML y preview (mantener alineado con client/src/email1SocialLinks.js). */

const EMAIL1_SOCIAL_LINKS = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    url: 'https://www.linkedin.com/company/abc-log%C3%ADstica-s-a-de-c-v-/',
    iconSrc: 'https://www.google.com/s2/favicons?domain=linkedin.com&sz=64',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    url: 'https://www.instagram.com/abclogisticamx/?hl=es-la',
    iconSrc: 'https://www.google.com/s2/favicons?domain=instagram.com&sz=64',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    url: 'https://www.tiktok.com/@soyuneibicito',
    iconSrc: 'https://www.google.com/s2/favicons?domain=tiktok.com&sz=64',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    url: 'https://www.youtube.com/channel/UCu6utowbsTekJz1IejktaUg/videos',
    iconSrc: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64',
  },
];

/**
 * Pie social: `imgSrcById` opcional (p. ej. cid: del envío SMTP); si falta, usa `iconSrc` (URL externa).
 * @param {(s: string) => string} escapeAttr
 * @param {(s: string) => string} escapeHtml
 * @param {Record<string, string> | null | undefined} imgSrcById
 */
function buildEmail1SocialLinksHtml(escapeAttr, escapeHtml, imgSrcById) {
  const imgStyle = 'display:inline-block;border:0;outline:none;width:24px;height:24px;vertical-align:middle;';
  const anchorStyle = 'display:inline-block;text-decoration:none;margin:0 8px;line-height:0;';
  const inner = EMAIL1_SOCIAL_LINKS.map(({ id, label, url, iconSrc }) => {
    const src = imgSrcById && imgSrcById[id] ? imgSrcById[id] : iconSrc;
    return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(label)}" style="${anchorStyle}"><img src="${escapeAttr(src)}" width="24" height="24" alt="${escapeHtml(label)}" style="${imgStyle}"/></a>`;
  }).join('');
  return `<p style="margin:12px 0 0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.6;">${inner}</p>`;
}

module.exports = { EMAIL1_SOCIAL_LINKS, buildEmail1SocialLinksHtml };
