/**
 * html2canvas 1.x no soporta oklch() / oklab() (Tailwind v4).
 *
 * Estrategia MÍNIMA: NO tocar stylesheets, NO quitar clases, NO copiar layout.
 * Solo recorrer el árbol orig↔clone en paralelo y, para cada propiedad de color
 * cuyo valor computado contenga oklch/oklab/etc., escribir un override inline
 * con el equivalente rgb(). Los inline tienen mayor especificidad → html2canvas
 * lee rgb() en vez de oklch().
 */

import { formatRgb, parse } from 'culori'

const MODERN_COLOR_RE =
  /oklch|oklab|lch\s*\(|lab\s*\(|color\s*\(|hwb\s*\(|color-mix\s*\(/i

let _canvas2d = null
function getCanvas2d() {
  if (_canvas2d) return _canvas2d
  try {
    _canvas2d = document.createElement('canvas').getContext('2d')
  } catch {
    _canvas2d = null
  }
  return _canvas2d
}

/** Convierte cualquier color CSS a rgb()/rgba() que html2canvas entiende. */
export function normalizeCssColorForHtml2Canvas(value) {
  if (!value || typeof value !== 'string') return value
  const t = value.trim()
  if (t === 'transparent' || t === 'none') return t
  if (t.startsWith('url(')) return value
  try {
    const p = parse(t)
    if (p) {
      const s = formatRgb(p)
      if (s) return s
    }
  } catch {
    /* culori no pudo → fallback canvas */
  }
  if (!MODERN_COLOR_RE.test(t)) return t
  const ctx = getCanvas2d()
  if (!ctx) return t
  try {
    ctx.fillStyle = '#000000'
    ctx.fillStyle = t
    return ctx.fillStyle || t
  } catch {
    return t
  }
}

const SIMPLE_COLOR_PROPS = [
  'color',
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'outlineColor',
  'textDecorationColor',
  'caretColor',
]

const COMPLEX_COLOR_PROPS = ['boxShadow', 'textShadow', 'backgroundImage']

function overrideOklchOnNode(orig, clone) {
  if (!(orig instanceof Element) || !(clone instanceof Element)) return

  if (orig instanceof HTMLElement && clone instanceof HTMLElement) {
    const cs = window.getComputedStyle(orig)
    for (const prop of SIMPLE_COLOR_PROPS) {
      const val = cs[prop]
      if (val && MODERN_COLOR_RE.test(val)) {
        clone.style[prop] = normalizeCssColorForHtml2Canvas(val)
      }
    }
    for (const prop of COMPLEX_COLOR_PROPS) {
      const val = cs[prop]
      if (val && val !== 'none' && MODERN_COLOR_RE.test(val)) {
        clone.style[prop] = 'none'
      }
    }
  }

  if (orig instanceof SVGElement && clone instanceof SVGElement) {
    const cs = window.getComputedStyle(orig)
    for (const attr of ['fill', 'stroke']) {
      const val = cs[attr]
      if (val && val !== 'none' && MODERN_COLOR_RE.test(val)) {
        clone.setAttribute(attr, normalizeCssColorForHtml2Canvas(val))
      }
    }
  }

  const origKids = orig.children
  const cloneKids = clone.children
  for (let i = 0; i < origKids.length && i < cloneKids.length; i++) {
    overrideOklchOnNode(origKids[i], cloneKids[i])
  }
}

/**
 * Recorre orig y clone en paralelo; donde un color computado usa oklch,
 * escribe el rgb equivalente como inline style en el clon.
 * NO toca clases, NO toca stylesheets, NO copia layout.
 */
export function syncCloneComputedColorsForHtml2Canvas(orig, clone) {
  overrideOklchOnNode(orig, clone)
}
