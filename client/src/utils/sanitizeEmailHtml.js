/**
 * Último `color:` en un atributo style (misma lógica que TipTap Color).
 */
function extractColorFromStyle(styleAttr) {
  if (!styleAttr) return null
  const decls = styleAttr
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
  for (let i = decls.length - 1; i >= 0; i -= 1) {
    const parts = decls[i].split(':')
    if (parts.length >= 2) {
      const prop = parts[0].trim().toLowerCase()
      if (prop === 'color') {
        return parts
          .slice(1)
          .join(':')
          .trim()
          .replace(/['"]+/g, '')
      }
    }
  }
  return null
}

/**
 * Color del texto del ítem (TipTap pone el color en spans dentro del primer párrafo).
 * Sin esto, `::marker` usa el color del `li` (negro) y no el del texto.
 */
function extractColorForListMarker(li) {
  const firstP = li.querySelector(':scope > p')
  if (!firstP) return null
  const inner = firstP.querySelector('[style*="color"]')
  if (inner) return extractColorFromStyle(inner.getAttribute('style'))
  if (firstP.getAttribute('style')?.includes('color')) {
    return extractColorFromStyle(firstP.getAttribute('style'))
  }
  return null
}

function mergeLiColorStyle(li, colorOrNull) {
  const raw = li.getAttribute('style') || ''
  const rules = raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((r) => !r.toLowerCase().startsWith('color:'))
  if (colorOrNull) rules.push(`color: ${colorOrNull}`)
  if (rules.length) li.setAttribute('style', rules.join('; '))
  else li.removeAttribute('style')
}

/**
 * Copia el color del contenido al `<li>` para que viñetas y números (`::marker`) coincidan.
 * Útil en preview (HTML sanitizado) y tras actualizar el DOM del editor TipTap.
 */
export function propagateListItemMarkerColor(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return
  root.querySelectorAll('li').forEach((li) => {
    mergeLiColorStyle(li, extractColorForListMarker(li))
  })
}

/**
 * Sanitización mínima para preview/export (evitar scripts).
 * v1: quitar script/style y on* handlers; no es un sanitizer completo.
 */
export function sanitizeEmailHtml(html) {
  if (!html || typeof html !== 'string') return ''
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const allowed = new Set(['P', 'SPAN', 'STRONG', 'EM', 'UL', 'OL', 'LI', 'BR', 'A'])
  const allowedStyles = new Set([
    'color',
    'font-size',
    'font-weight',
    'font-style',
    'text-align',
    'font-family',
  ])

  const walk = (node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node
      if (!allowed.has(el.tagName)) {
        const parent = el.parentNode
        while (el.firstChild) parent.insertBefore(el.firstChild, el)
        parent.removeChild(el)
        return
      }
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.toLowerCase().startsWith('on')) {
          el.removeAttribute(attr.name)
        }
      }
      if (el.tagName === 'A') {
        const href = el.getAttribute('href') || ''
        if (!/^https?:\/\//i.test(href)) el.removeAttribute('href')
      }
      if (el.hasAttribute('style')) {
        const rules = el
          .getAttribute('style')
          .split(';')
          .map((x) => x.trim())
          .filter(Boolean)
        const safe = []
        for (const r of rules) {
          const [propRaw, valueRaw] = r.split(':')
          const prop = String(propRaw || '').trim().toLowerCase()
          const value = String(valueRaw || '').trim()
          if (!allowedStyles.has(prop)) continue
          if (/url\(|expression|javascript:/i.test(value)) continue
          safe.push(`${prop}: ${value}`)
        }
        if (safe.length) el.setAttribute('style', safe.join('; '))
        else el.removeAttribute('style')
      }
    }
    Array.from(node.childNodes).forEach(walk)
  }

  Array.from(doc.body.childNodes).forEach(walk)
  propagateListItemMarkerColor(doc.body)
  return doc.body.innerHTML
}

export function htmlOrPlainToPreview(html) {
  const raw = String(html || '').trim()
  if (!raw) return ''
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    return sanitizeEmailHtml(raw)
  }
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
}

function escapeHtml(t) {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
