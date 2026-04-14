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

function setLayoutProp(clone, prop, val) {
  if (val == null || val === '') return
  const s = String(val).trim()
  if (s === '' || s === 'initial' || s === 'inherit') return
  if (MODERN_COLOR_SYNTAX.test(s)) return
  clone.style[prop] = val
}

/**
 * Sin las hojas de estilo del iframe (quitadas por oklch), el clon solo se pinta con lo que copiamos aquí.
 * Incluye flex/posicionamiento/absolutos que Tailwind aplicaba por clase.
 */
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
  set('minWidth', cs.minWidth)
  set('maxHeight', cs.maxHeight)
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

  const flexPosKeys = [
    'position',
    'top',
    'left',
    'right',
    'bottom',
    'inset',
    'zIndex',
    'transform',
    'transformOrigin',
    'flex',
    'flexDirection',
    'flexWrap',
    'flexFlow',
    'flexGrow',
    'flexShrink',
    'flexBasis',
    'alignItems',
    'justifyContent',
    'alignContent',
    'alignSelf',
    'gap',
    'rowGap',
    'columnGap',
    'order',
    'boxSizing',
    'aspectRatio',
    'objectPosition',
    'visibility',
    'pointerEvents',
    'overflowX',
    'overflowY',
    'float',
    'clear',
    'textOverflow',
    'listStyleType',
    'listStylePosition',
    'paddingInlineStart',
    'paddingInlineEnd',
    'marginBlock',
    'marginInline',
  ]
  for (const prop of flexPosKeys) {
    const val = cs[prop]
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      setLayoutProp(clone, prop, val)
    }
  }
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

    const bgImg = cs.backgroundImage
    if (bgImg && bgImg !== 'none' && MODERN_COLOR_SYNTAX.test(bgImg)) {
      clone.style.backgroundImage = 'none'
    } else if (bgImg && bgImg !== 'none') {
      clone.style.backgroundImage = bgImg
    }

    const txtSh = cs.textShadow
    if (txtSh && txtSh !== 'none' && MODERN_COLOR_SYNTAX.test(txtSh)) {
      clone.style.textShadow = 'none'
    } else if (txtSh && txtSh !== 'none') {
      clone.style.textShadow = txtSh
    }

    const filt = cs.filter
    if (filt && filt !== 'none' && MODERN_COLOR_SYNTAX.test(filt)) {
      clone.style.filter = 'none'
    }

    const outline = cs.outline
    if (outline && outline !== 'none' && MODERN_COLOR_SYNTAX.test(outline)) {
      clone.style.outline = 'none'
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
    const w = cs.width
    const h = cs.height
    if (w && w !== 'auto' && w !== '0px') clone.setAttribute('width', w)
    if (h && h !== 'auto' && h !== '0px') clone.setAttribute('height', h)
    clone.removeAttribute('style')
  }

  if (orig instanceof HTMLImageElement && clone instanceof HTMLImageElement) {
    const cs = window.getComputedStyle(orig)
    setLayoutProp(clone, 'width', cs.width)
    setLayoutProp(clone, 'height', cs.height)
    setLayoutProp(clone, 'objectFit', cs.objectFit)
    setLayoutProp(clone, 'objectPosition', cs.objectPosition)
    setLayoutProp(clone, 'maxWidth', cs.maxWidth)
    setLayoutProp(clone, 'maxHeight', cs.maxHeight)
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

function cleanInlineStyleString(st) {
  if (!st || !MODERN_COLOR_SYNTAX.test(st)) return st
  const parts = String(st)
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
  const kept = parts.filter((p) => !MODERN_COLOR_SYNTAX.test(p))
  return kept.length ? kept.join('; ') : ''
}

function stripUnsupportedColorInlineStyles(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return
  root.querySelectorAll('[style]').forEach((el) => {
    const st = el.getAttribute('style')
    if (!st || !MODERN_COLOR_SYNTAX.test(st)) return
    const next = cleanInlineStyleString(st)
    if (next) el.setAttribute('style', next)
    else el.removeAttribute('style')
  })
}

export function syncCloneComputedColorsForHtml2Canvas(orig, clone) {
  syncCloneComputedColorsRecursive(orig, clone)
  if (clone instanceof HTMLElement) {
    clone.querySelectorAll('[class]').forEach((el) => el.removeAttribute('class'))
    stripUnsupportedColorInlineStyles(clone)
  }
}
