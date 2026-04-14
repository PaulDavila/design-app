/**
 * html2canvas 1.x no parsea `oklch()` / `oklab()` (p. ej. Tailwind v4).
 * Estrategia: NO borrar style inline del clon. Solo:
 * 1. Quitar class (para que Tailwind con oklch no aplique).
 * 2. Copiar los colores computados como inline (bg, color, border) ya convertidos a rgb().
 * 3. Copiar propiedades de layout/posición computadas como inline (para reemplazar las clases eliminadas).
 * 4. Los style inline originales del JSX (padding, height, transform, etc.) se CONSERVAN.
 */

import { formatRgb, parse } from 'culori'

const MODERN_COLOR_SYNTAX = /oklch|oklab|lch\s*\(|lab\s*\(|color\s*\(|hwb\s*\(|color-mix\s*\(/i

let canvas2d = null
function getCanvas2d() {
  if (canvas2d) return canvas2d
  try {
    canvas2d = document.createElement('canvas').getContext('2d')
  } catch {
    canvas2d = null
  }
  return canvas2d
}

/** Convierte un color CSS a `rgb()`/`rgba()` legible por html2canvas. */
export function normalizeCssColorForHtml2Canvas(value) {
  if (!value || typeof value !== 'string') return value
  const t = value.trim()
  if (t === 'transparent') return 'transparent'
  if (t === 'none') return 'none'
  if (t.startsWith('url(')) return value
  try {
    const p = parse(t)
    if (p) {
      const s = formatRgb(p)
      if (s) return s
    }
  } catch {
    /* seguir al fallback */
  }
  if (!MODERN_COLOR_SYNTAX.test(t)) return t
  const ctx = getCanvas2d()
  if (!ctx) return t
  try {
    ctx.fillStyle = '#000000'
    ctx.fillStyle = t
    const out = ctx.fillStyle
    return typeof out === 'string' && out ? out : t
  } catch {
    return t
  }
}

/**
 * Propiedades de layout que necesitamos copiar del computedStyle al inline
 * porque al quitar class se pierden. Solo se escriben si NO están ya en el style inline.
 */
const LAYOUT_PROPS = [
  'display', 'position', 'top', 'left', 'right', 'bottom', 'inset',
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'padding', 'margin', 'borderRadius',
  'flex', 'flexDirection', 'flexWrap', 'flexGrow', 'flexShrink', 'flexBasis',
  'alignItems', 'justifyContent', 'alignContent', 'alignSelf',
  'gap', 'rowGap', 'columnGap', 'order',
  'overflow', 'overflowX', 'overflowY',
  'zIndex', 'transform', 'transformOrigin',
  'boxSizing', 'aspectRatio',
  'objectFit', 'objectPosition',
  'fontSize', 'fontFamily', 'fontWeight', 'lineHeight',
  'textAlign', 'verticalAlign', 'whiteSpace',
  'overflowWrap', 'wordBreak', 'letterSpacing', 'textDecoration',
  'opacity', 'visibility', 'pointerEvents',
  'listStyleType', 'listStylePosition',
  'paddingInlineStart', 'paddingInlineEnd',
]

function syncNode(orig, clone) {
  if (!(orig instanceof Element) || !(clone instanceof Element)) return

  if (orig instanceof HTMLElement && clone instanceof HTMLElement) {
    const cs = window.getComputedStyle(orig)

    clone.style.backgroundColor = normalizeCssColorForHtml2Canvas(cs.backgroundColor)
    clone.style.color = normalizeCssColorForHtml2Canvas(cs.color)

    const bc = normalizeCssColorForHtml2Canvas(cs.borderColor)
    if (bc && bc !== 'rgba(0, 0, 0, 0)') {
      clone.style.borderColor = bc
    }
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      clone.style[`border${side}Width`] = cs[`border${side}Width`]
      clone.style[`border${side}Style`] = cs[`border${side}Style`]
      clone.style[`border${side}Color`] = normalizeCssColorForHtml2Canvas(cs[`border${side}Color`])
    }

    let bs = cs.boxShadow
    if (bs && bs !== 'none') {
      clone.style.boxShadow = MODERN_COLOR_SYNTAX.test(bs) ? 'none' : bs
    }
    const bgImg = cs.backgroundImage
    if (bgImg && bgImg !== 'none') {
      clone.style.backgroundImage = MODERN_COLOR_SYNTAX.test(bgImg) ? 'none' : bgImg
    }

    for (const prop of LAYOUT_PROPS) {
      if (clone.style[prop]) continue
      const val = cs[prop]
      if (val != null && val !== '' && !MODERN_COLOR_SYNTAX.test(String(val))) {
        clone.style[prop] = val
      }
    }

    clone.removeAttribute('class')
  }

  if (orig instanceof SVGElement && clone instanceof SVGElement) {
    const cs = window.getComputedStyle(orig)
    const fill = cs.fill
    if (fill && fill !== 'none') {
      clone.setAttribute('fill', normalizeCssColorForHtml2Canvas(fill))
    }
    const stroke = cs.stroke
    if (stroke && stroke !== 'none') {
      clone.setAttribute('stroke', normalizeCssColorForHtml2Canvas(stroke))
    }
    const sw = cs.strokeWidth
    if (sw && sw !== '0px') clone.setAttribute('stroke-width', sw)
    const w = cs.width
    const h = cs.height
    if (w && w !== 'auto' && w !== '0px') clone.setAttribute('width', w)
    if (h && h !== 'auto' && h !== '0px') clone.setAttribute('height', h)
    clone.removeAttribute('class')
    clone.removeAttribute('style')
  }

  for (let i = 0; i < orig.children.length; i++) {
    const oc = orig.children[i]
    const cc = clone.children[i]
    if (oc instanceof Element && cc instanceof Element) {
      syncNode(oc, cc)
    }
  }
}

/** Quita CSS global del documento del iframe de html2canvas (Tailwind / tipografías con oklch). */
export function stripHtml2CanvasCloneDocumentStyles(doc) {
  if (!doc) return
  doc.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => el.remove())
}

export function syncCloneComputedColorsForHtml2Canvas(orig, clone) {
  syncNode(orig, clone)
}
