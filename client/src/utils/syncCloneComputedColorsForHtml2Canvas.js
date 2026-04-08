/**
 * html2canvas 1.x no parsea `oklch()` / `oklab()` (p. ej. Tailwind v4).
 * Chrome puede devolver esos formatos en getComputedStyle; los convertimos con culori
 * a `rgb()` / `rgba()` antes de copiar al clon.
 *
 * - HTML: vaciamos `style` del clon y reaplicamos solo propiedades seguras (colores + layout).
 * - SVG: fill/stroke en atributos y luego removemos `style` (evita variables `--color-*` con oklch).
 * - Quitamos `class` en cada nodo y al final un barrido `[class]` en todo el subárbol (p. ej. IMG).
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

function applyLayoutFromComputed(clone, cs) {
  const set = (prop, val) => {
    if (val && val !== 'none') clone.style[prop] = val
  }
  set('borderRadius', cs.borderRadius)
  set('padding', cs.padding)
  set('margin', cs.margin)
  set('width', cs.width)
  set('height', cs.height)
  set('maxWidth', cs.maxWidth)
  set('minHeight', cs.minHeight)
  set('display', cs.display)
  set('overflow', cs.overflow)
  set('objectFit', cs.objectFit)
  set('fontSize', cs.fontSize)
  set('fontFamily', cs.fontFamily)
  set('fontWeight', cs.fontWeight)
  set('lineHeight', cs.lineHeight)
  set('textAlign', cs.textAlign)
  set('verticalAlign', cs.verticalAlign)
  set('whiteSpace', cs.whiteSpace)
  set('overflowWrap', cs.overflowWrap)
  set('wordBreak', cs.wordBreak)
  set('letterSpacing', cs.letterSpacing)
  set('textDecoration', cs.textDecoration)
  set('opacity', cs.opacity)
}

function syncCloneComputedColorsRecursive(orig, clone) {
  if (!(orig instanceof Element) || !(clone instanceof Element)) return

  if (orig instanceof HTMLElement && clone instanceof HTMLElement) {
    clone.removeAttribute('style')
    const cs = window.getComputedStyle(orig)

    const bg = normalizeCssColorForHtml2Canvas(cs.backgroundColor)
    clone.style.backgroundColor =
      bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' ? bg : 'transparent'

    clone.style.color = normalizeCssColorForHtml2Canvas(cs.color)

    const bc = normalizeCssColorForHtml2Canvas(cs.borderColor)
    if (bc && bc !== 'rgba(0, 0, 0, 0)') {
      clone.style.borderColor = bc
    }

    let bs = cs.boxShadow
    if (bs && bs !== 'none') {
      clone.style.boxShadow = MODERN_COLOR_SYNTAX.test(bs) ? 'none' : bs
    }

    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const wKey = `border${side}Width`
      const sKey = `border${side}Style`
      const cKey = `border${side}Color`
      clone.style[wKey] = cs[wKey]
      clone.style[sKey] = cs[sKey]
      clone.style[cKey] = normalizeCssColorForHtml2Canvas(cs[cKey])
    }

    applyLayoutFromComputed(clone, cs)
  }

  if (orig instanceof SVGElement && clone instanceof SVGElement) {
    const cs = window.getComputedStyle(orig)
    const fill = cs.fill
    if (fill && fill !== 'none') {
      clone.setAttribute('fill', normalizeCssColorForHtml2Canvas(fill))
    } else {
      clone.removeAttribute('fill')
    }
    const stroke = cs.stroke
    if (stroke && stroke !== 'none') {
      clone.setAttribute('stroke', normalizeCssColorForHtml2Canvas(stroke))
    } else {
      clone.removeAttribute('stroke')
    }
    const sw = cs.strokeWidth
    if (sw && sw !== '0px') clone.setAttribute('stroke-width', sw)
    clone.removeAttribute('style')
  }

  clone.removeAttribute('class')

  for (let i = 0; i < orig.children.length; i++) {
    const oc = orig.children[i]
    const cc = clone.children[i]
    if (oc instanceof Element && cc instanceof Element) {
      syncCloneComputedColorsRecursive(oc, cc)
    }
  }
}

/** Quita CSS global del documento del iframe de html2canvas (Tailwind / tipografías con oklch). */
export function stripHtml2CanvasCloneDocumentStyles(doc) {
  if (!doc) return
  doc.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => el.remove())
}

export function syncCloneComputedColorsForHtml2Canvas(orig, clone) {
  syncCloneComputedColorsRecursive(orig, clone)
  if (clone instanceof HTMLElement) {
    clone.querySelectorAll('[class]').forEach((el) => el.removeAttribute('class'))
  }
}
