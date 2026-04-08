/** Paridad con design-app/lib/email1Cta.js para preview. */

export function sanitizeCtaHttpUrl(s) {
  const u = String(s || '').trim()
  if (!u.startsWith('https://') && !u.startsWith('http://')) return null
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.href
  } catch {
    return null
  }
}

export function clampCtaFontSizePx(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 18
  return Math.min(32, Math.max(12, Math.round(x)))
}

export function isEmail1CtaPreviewVisible(enabled, text, url) {
  if (!enabled) return false
  const t = String(text || '').trim()
  return Boolean(t && sanitizeCtaHttpUrl(url))
}
