import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import html2canvas from 'html2canvas'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { EMAIL_RICH_EDITOR_LIST_CLASSES } from './emailRichTextClasses.js'
import { htmlOrPlainToPreview } from './utils/sanitizeEmailHtml.js'
import { LogoCarruselMedio } from './LogoCarruselMedio.jsx'
import ImageGenCharactersWarning from './ImageGenCharactersWarning.jsx'
import { syncCloneComputedColorsForHtml2Canvas } from './utils/syncCloneComputedColorsForHtml2Canvas.js'
import { inlineRasterImagesAsDataUrls } from './utils/html2CanvasClonePrep.js'

const RATIOS = {
  '1_1': { label: '1:1', ancho: 1080, alto: 1080, aspectCss: '1 / 1' },
  '4_5': { label: '4:5', ancho: 1080, alto: 1350, aspectCss: '4 / 5' },
}

/** Si no llega numSlidesTotal desde el flujo del grid, asumimos 5 (incl. portada). */
const FALLBACK_SLIDES_TOTAL = 5

const API_BASE =
  import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '')

const RUTA_LOGO_PORTADA = 'miniaturas/logo-portada.svg'
const RUTA_LOGO_PORTADA_4_5 = 'miniaturas/logo-portada-4-5.svg'
/** Slides 4:5: mismo patrón que portada (`img` + `mediaUrl`). */
const RUTA_LOGO_CARRUSEL_4_5 = 'miniaturas/logo-carrusel-4-5.svg'
const RUTA_LOGO_CARRUSEL_FINAL_1_1 = 'miniaturas/logo-carrusel-final-1-1.svg'
const RUTA_LOGO_CARRUSEL_FINAL_4_5 = 'miniaturas/logo-carrusel-final-4-5.svg'
/** Gris del contenedor de la portada en vista previa (carruseles distintos de carrusel 1). */
const PORTADA_VISTA_PREVIA_FONDO_HEX = '#eceff1'
/** Gris fijo carrusel 1: vista previa, prompt y API (sin selector). */
const PORTADA_CARRUSEL_1_FONDO_IMAGEN_HEX = '#e9edef'
/** Instrucciones generales enviadas a la IA (el usuario no las ve). El orden importa: primero fondo obligatorio. */
const PROMPT_FONDO_OBLIGATORIA_PORTADA =
  `REGLA OBLIGATORIA SIN EXCEPCION: todo el fondo de la imagen debe ser color plano y uniforme exactamente ${PORTADA_CARRUSEL_1_FONDO_IMAGEN_HEX}, sin degradados, sin textura, sin patron de cuadros, damero, grid ni checkerboard. ` +
  'Sin transparencia: relleno opaco de ese color en toda la lamina fuera del motivo ilustrado.'
const PROMPT_BASE_PORTADA_CARRUSEL_1 =
  'Ilustracion corporativa en estilo limpio y amigable, sujeto aislado como asset digital (referencia tipo sticker o die-cut, tono profesional, no infantil), mismos personajes de marca, composicion equilibrada, enfoque para comunicacion interna, sin texto incrustado en imagen.'

/** Colores del cuadro superior de la portada (mismo patrón de botones que el editor de emails). */
const PORTADA_CUADRO_COLORS_HEX = [
  '#003B49',
  '#008da8',
  '#5aba47',
  '#f9a05c',
  '#cd4a9b',
  '#ef3842',
]

function mediaUrl(ruta) {
  if (!ruta) return ''
  const clean = String(ruta).replace(/^\//, '')
  return `${API_BASE}/media/plantillas/${clean}`
}

/** Igual que `LogoCarruselMedio`: pastilla = 32% acento + 68% blanco. */
function pillFillFromAccent(accentHex) {
  const raw = String(accentHex || '').trim()
  const m = raw.match(/^#?([0-9a-fA-F]{6})$/)
  if (!m) return '#bcdae7'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const accentShare = 0.32
  const whiteShare = 1 - accentShare
  const mix = (c) => Math.round(c * accentShare + 255 * whiteShare)
  const toHex = (x) => x.toString(16).padStart(2, '0')
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`
}

function markupFinalSlideSvg(svgText, accentHex) {
  const pillFill = pillFillFromAccent(accentHex)
  let s = svgText.replace(/<\?xml[^?]*\?>\s*/i, '')
  s = s.replace(/#bcdae7/gi, pillFill)
  s = s.replace(/<svg\b([^>]*)>/i, '<svg$1 preserveAspectRatio="xMidYMax slice" class="block h-full w-full">')
  return s
}

function parseDefinicion(raw) {
  try {
    const d = typeof raw === 'string' ? JSON.parse(raw) : raw
    return d && typeof d === 'object' ? d : {}
  } catch {
    return {}
  }
}

function portadaContentHasText(html) {
  const raw = String(html || '').trim()
  if (!raw) return false
  try {
    if (typeof document !== 'undefined') {
      const txt = new DOMParser().parseFromString(raw, 'text/html').body.textContent || ''
      return txt.replace(/\u00a0/g, ' ').trim().length > 0
    }
  } catch {
    /* ignore */
  }
  return raw.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim().length > 0
}

function PortadaRichTextField({ label, editorId, value, onChange, placeholder }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
    ],
    content: htmlOrPlainToPreview(value || '') || '<p></p>',
    editorProps: {
      attributes: {
        id: editorId,
        class: `portada-tiptap min-h-[120px] rounded-b-lg border border-t-0 border-slate-200 bg-white px-3 py-2 text-sm !font-light leading-relaxed text-slate-800 outline-none ring-violet-500/20 focus:ring-2 [&_.ProseMirror]:!font-light [&_.ProseMirror_p]:!font-light [&_.ProseMirror_span]:!font-light [&_strong]:!font-black [&_b]:!font-black ${EMAIL_RICH_EDITOR_LIST_CLASSES}`,
        'data-placeholder': placeholder,
        style: 'font-family: ui-sans-serif, system-ui, sans-serif; font-weight: 300 !important;',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    const next = htmlOrPlainToPreview(value || '') || '<p></p>'
    const current = editor.getHTML()
    if (current !== next) {
      editor.commands.setContent(next, false)
    }
  }, [editor, value])

  if (!editor) return null

  return (
    <div className="space-y-1.5">
      <label htmlFor={editorId} className="mb-0 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-1.5">
        <div className="mb-1.5 flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`rounded px-2 py-1 text-xs font-light ${
              editor.isActive('bold') ? 'font-black bg-violet-100 text-violet-900' : 'bg-slate-100 text-slate-700'
            }`}
            aria-label="Negrita"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`rounded px-2 py-1 text-xs italic ${
              editor.isActive('italic') ? 'bg-violet-100 text-violet-900' : 'bg-slate-100 text-slate-700'
            }`}
            aria-label="Cursiva"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`rounded px-2 py-1 text-xs ${
              editor.isActive('bulletList')
                ? 'bg-violet-100 text-violet-900'
                : 'bg-slate-100 text-slate-700'
            }`}
            aria-label="Lista con viñetas"
          >
            • Lista
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`rounded px-2 py-1 text-xs ${
              editor.isActive('orderedList')
                ? 'bg-violet-100 text-violet-900'
                : 'bg-slate-100 text-slate-700'
            }`}
            aria-label="Lista numerada"
          >
            1. Lista
          </button>
        </div>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

function SlideAccordionItem({ itemId, title, open, onToggle, children }) {
  const baseId = useId()
  const panelId = `${baseId}-panel-${itemId}`

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"
      >
        <span>{title}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={title}
          className="border-t border-slate-100 px-4 py-3 text-xs text-slate-600"
        >
          {children}
        </div>
      )}
    </div>
  )
}

/** Mismo patrón visual que «Instrucciones para la IA (imagen)» en Email1Editor. */
function CarruselNanoBananaImageField({ panelId, value, onChange }) {
  const fieldId = `carrusel-nb-img-${panelId}`
  return (
    <div className="mt-3 space-y-1">
      <label htmlFor={fieldId} className="mb-0 block text-xs font-medium text-slate-600">
        Descripción de imagen (Nano Banana)
      </label>
      <textarea
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Describe la imagen que debe generar Nano Banana…"
        className="w-full rounded-xl border border-dashed border-slate-300 bg-amber-50/50 px-3 py-2 text-sm text-slate-800 outline-none ring-amber-500/20 focus:ring-2"
      />
    </div>
  )
}

export default function Carrusel1Editor({ plantilla, numSlidesTotal }) {
  const def = useMemo(() => parseDefinicion(plantilla?.definicion), [plantilla])
  const isCarrusel1 = plantilla?.grupo_layout === 'carrusel_1'
  const isCarruselNumerado = plantilla?.grupo_layout === 'carrusel_numerado'
  const isCarrusel2 =
    plantilla?.grupo_layout === 'carrusel_2' || isCarruselNumerado

  const ratioInicial = useMemo(() => {
    const r = def?.carrusel1?.ratioDefault
    if (r === '4_5' || r === '1_1') return r
    return '1_1'
  }, [def])

  const [ratio, setRatio] = useState(ratioInicial)
  const [openedAccordionId, setOpenedAccordionId] = useState(null)
  /** Mapa futuro `id` → datos del slide (texto, assets, etc.). */
  const [slidesContenido, setSlidesContenido] = useState({})
  /** Descripción de imagen por panel cuando NO es carrusel 1 (UI legacy). */
  const [descripcionesImagenNanoBanana, setDescripcionesImagenNanoBanana] = useState({})
  /** HTML de portada (TipTap: base 300, negrita 900, cursiva). */
  const [textoPortadaPlano, setTextoPortadaPlano] = useState('')
  const portadaTextareaId = useId()

  // Portada: bloque azul + texto auto-fit (solo en preview de portada)
  const [portadaBluePct, setPortadaBluePct] = useState(20)
  const [portadaFontSize, setPortadaFontSize] = useState(25)
  const [portadaCuadroColor, setPortadaCuadroColor] = useState(PORTADA_CUADRO_COLORS_HEX[1])
  const portadaGrayRef = useRef(null)
  const portadaBlueRef = useRef(null)
  const portadaTextBoxRef = useRef(null)
  const portadaTextBoxInnerRef = useRef(null)
  const portadaTextRef = useRef(null)

  /** Slides: misma banda superior que portada (20–40% alto), transparente; texto #003b49. */
  const [slideBoxPct, setSlideBoxPct] = useState(20)
  const [slideFontSize, setSlideFontSize] = useState(25)
  const slideBandRef = useRef(null)
  const slideTextBoxRef = useRef(null)
  const slideTextBoxInnerRef = useRef(null)
  const slideTextRef = useRef(null)
  const prevActiveSlideIdRef = useRef(null)
  const carruselExportRef = useRef(null)
  const jpgExportLockRef = useRef(false)
  const [exportingJpg, setExportingJpg] = useState(false)
  const [jpgExportError, setJpgExportError] = useState(null)
  /** Carrusel 1: IA por panel (`portada`, `slide-1`, …): prompt, url, zoom, pan. */
  const [nbPromptByPanel, setNbPromptByPanel] = useState({})
  const [nbUrlByPanel, setNbUrlByPanel] = useState({})
  const [nbZoomByPanel, setNbZoomByPanel] = useState({})
  const [nbPanXByPanel, setNbPanXByPanel] = useState({})
  const [nbPanYByPanel, setNbPanYByPanel] = useState({})
  const [nbGenPanelId, setNbGenPanelId] = useState(null)
  const [nbErrByPanel, setNbErrByPanel] = useState({})

  useEffect(() => {
    setRatio(ratioInicial)
  }, [ratioInicial, plantilla?.id])

  const totalInclPortada = useMemo(() => {
    if (typeof numSlidesTotal === 'number' && Number.isFinite(numSlidesTotal)) {
      return Math.min(20, Math.max(1, Math.floor(numSlidesTotal)))
    }
    return FALLBACK_SLIDES_TOTAL
  }, [numSlidesTotal])

  const slidePanels = useMemo(() => {
    const list = [{ id: 'portada', label: 'Portada' }]
    for (let i = 1; i < totalInclPortada; i++) {
      list.push({ id: `slide-${i}`, label: `Slide ${i}` })
    }
    return list
  }, [totalInclPortada])

  const lastSlidePanelId = useMemo(() => {
    if (totalInclPortada < 2) return null
    return `slide-${totalInclPortada - 1}`
  }, [totalInclPortada])

  const isEditingLastSlide = Boolean(
    lastSlidePanelId && openedAccordionId === lastSlidePanelId,
  )

  const [finalSlideSvgHtml, setFinalSlideSvgHtml] = useState('')

  useEffect(() => {
    if (
      openedAccordionId &&
      !slidePanels.some((p) => p.id === openedAccordionId)
    ) {
      setOpenedAccordionId(null)
    }
  }, [openedAccordionId, slidePanels])

  useEffect(() => {
    if (!isEditingLastSlide) {
      setFinalSlideSvgHtml('')
      return
    }
    const path = ratio === '4_5' ? RUTA_LOGO_CARRUSEL_FINAL_4_5 : RUTA_LOGO_CARRUSEL_FINAL_1_1
    let cancelled = false
    fetch(mediaUrl(path))
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.text()
      })
      .then((t) => {
        if (cancelled) return
        setFinalSlideSvgHtml(markupFinalSlideSvg(t, portadaCuadroColor))
      })
      .catch(() => {
        if (!cancelled) setFinalSlideSvgHtml('')
      })
    return () => {
      cancelled = true
    }
  }, [isEditingLastSlide, ratio, portadaCuadroColor])

  useLayoutEffect(() => {
    if (openedAccordionId !== 'portada') return

    const grayEl = portadaGrayRef.current
    const blueEl = portadaBlueRef.current
    const textBoxEl = portadaTextBoxRef.current
    const textEl = portadaTextRef.current

    if (!grayEl || !blueEl || !textBoxEl || !textEl) return

    const MIN_PCT = 20
    const MAX_PCT = 40
    const START_FONT = 25
    const MIN_FONT = 0

    // Helpers that mutate DOM for synchronous measurement (then we sync state once).
    const setBluePctDom = (pct) => {
      const p = Math.max(MIN_PCT, Math.min(MAX_PCT, pct))
      blueEl.style.height = `${p}%`
      textBoxEl.style.height = `${p}%`
      // force reflow boundary
      void textBoxEl.offsetHeight
      return p
    }

    const setFontDom = (px) => {
      const f = Math.max(MIN_FONT, Math.min(START_FONT, px))
      textEl.style.fontSize = `${f}px`
      void textEl.offsetHeight
      return f
    }

    const fitsNow = () => {
      const inner = portadaTextBoxInnerRef.current
      if (!inner) return true
      return inner.scrollHeight <= inner.clientHeight
    }

    const raf = requestAnimationFrame(() => {
      // If empty, keep defaults
      const hasText = portadaContentHasText(textoPortadaPlano)
      if (!hasText) {
        setPortadaBluePct(MIN_PCT)
        setPortadaFontSize(START_FONT)
        setFontDom(START_FONT)
        setBluePctDom(MIN_PCT)
        return
      }

      // Start from current state; do not change box until needed.
      let chosenPct = setBluePctDom(portadaBluePct)
      let chosenFont = setFontDom(portadaFontSize)

      // Grow only if content doesn't fit.
      if (!fitsNow()) {
        for (let pct = chosenPct; pct <= MAX_PCT; pct += 1) {
          chosenPct = setBluePctDom(pct)
          if (fitsNow()) break
        }
      }

      // If still doesn't fit at 40%, keep 40% and reduce font size (binary search down to 0).
      if (!fitsNow()) {
        chosenPct = setBluePctDom(MAX_PCT)
        let lo = MIN_FONT
        let hi = START_FONT
        let best = MIN_FONT
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2)
          setFontDom(mid)
          if (fitsNow()) {
            best = mid
            lo = mid + 1
          } else {
            hi = mid - 1
          }
        }
        chosenFont = setFontDom(best)
      }

      // Sync React state once (avoid loops by checking before set)
      if (portadaBluePct !== chosenPct) setPortadaBluePct(chosenPct)
      if (portadaFontSize !== chosenFont) setPortadaFontSize(chosenFont)
    })

    return () => cancelAnimationFrame(raf)
  }, [openedAccordionId, textoPortadaPlano, portadaBluePct, portadaFontSize])

  const previewPanelId = openedAccordionId ?? 'portada'

  const activeSlideId =
    previewPanelId && String(previewPanelId).startsWith('slide-')
      ? previewPanelId
      : null
  const activeSlideHtml = activeSlideId ? slidesContenido[activeSlideId] || '' : ''

  const slidePreviewHtml = useMemo(
    () => (activeSlideId ? htmlOrPlainToPreview(activeSlideHtml) || '' : ''),
    [activeSlideId, activeSlideHtml],
  )

  useLayoutEffect(() => {
    if (!activeSlideId) {
      prevActiveSlideIdRef.current = null
      return
    }

    const grayEl = portadaGrayRef.current
    const bandEl = slideBandRef.current
    const textBoxEl = slideTextBoxRef.current
    const textEl = slideTextRef.current

    if (!grayEl || !bandEl || !textBoxEl || !textEl) return

    const MIN_PCT = 20
    const MAX_PCT = 40
    const START_FONT = 25
    const MIN_FONT = 0

    const idChanged = prevActiveSlideIdRef.current !== activeSlideId

    const setBandPctDom = (pct) => {
      const p = Math.max(MIN_PCT, Math.min(MAX_PCT, pct))
      bandEl.style.height = `${p}%`
      textBoxEl.style.height = `${p}%`
      void textBoxEl.offsetHeight
      return p
    }

    const setFontDom = (px) => {
      const f = Math.max(MIN_FONT, Math.min(START_FONT, px))
      textEl.style.fontSize = `${f}px`
      void textEl.offsetHeight
      return f
    }

    const fitsNow = () => {
      const inner = slideTextBoxInnerRef.current
      if (!inner) return true
      return inner.scrollHeight <= inner.clientHeight
    }

    const raf = requestAnimationFrame(() => {
      const hasText = portadaContentHasText(activeSlideHtml)
      if (!hasText) {
        prevActiveSlideIdRef.current = activeSlideId
        setSlideBoxPct(MIN_PCT)
        setSlideFontSize(START_FONT)
        setFontDom(START_FONT)
        setBandPctDom(MIN_PCT)
        return
      }

      const pctSeed = idChanged ? MIN_PCT : slideBoxPct
      const fontSeed = idChanged ? START_FONT : slideFontSize

      let chosenPct = setBandPctDom(pctSeed)
      let chosenFont = setFontDom(fontSeed)

      if (!fitsNow()) {
        for (let pct = chosenPct; pct <= MAX_PCT; pct += 1) {
          chosenPct = setBandPctDom(pct)
          if (fitsNow()) break
        }
      }

      if (!fitsNow()) {
        chosenPct = setBandPctDom(MAX_PCT)
        let lo = MIN_FONT
        let hi = START_FONT
        let best = MIN_FONT
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2)
          setFontDom(mid)
          if (fitsNow()) {
            best = mid
            lo = mid + 1
          } else {
            hi = mid - 1
          }
        }
        chosenFont = setFontDom(best)
      }

      prevActiveSlideIdRef.current = activeSlideId
      if (slideBoxPct !== chosenPct) setSlideBoxPct(chosenPct)
      if (slideFontSize !== chosenFont) setSlideFontSize(chosenFont)
    })

    return () => cancelAnimationFrame(raf)
  }, [activeSlideId, activeSlideHtml, slideBoxPct, slideFontSize])

  const spec = RATIOS[ratio] ?? RATIOS['1_1']

  const handleDescargarCuadroJpg = async (panelId) => {
    const targetW = spec.ancho
    const targetH = spec.alto
    if (jpgExportLockRef.current) return

    if (openedAccordionId !== panelId) {
      setOpenedAccordionId(panelId)
      await new Promise((r) => setTimeout(r, 550))
    }

    const node = carruselExportRef.current
    if (!node) return

    jpgExportLockRef.current = true
    setExportingJpg(true)
    setJpgExportError(null)
    try {
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        await document.fonts.ready
      }
      const nw = Math.max(1, node.offsetWidth)
      const scale = targetW / nw
      const canvas = await html2canvas(node, {
        scale,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 30000,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: async (_clonedDoc, clonedElement) => {
          syncCloneComputedColorsForHtml2Canvas(node, clonedElement)
          await inlineRasterImagesAsDataUrls(clonedElement)
        },
      })
      const out = document.createElement('canvas')
      out.width = targetW
      out.height = targetH
      const ctx = out.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, targetW, targetH)
      ctx.drawImage(canvas, 0, 0, targetW, targetH)
      const dataUrl = out.toDataURL('image/jpeg', 0.92)
      const safeId = String(panelId).replace(/[^a-z0-9-]+/gi, '_')
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `carrusel-${safeId}-${targetW}x${targetH}.jpg`
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (err) {
      console.error(err)
      setJpgExportError(
        err instanceof Error ? err.message : 'No se pudo generar el JPG. Revisa la consola.',
      )
    } finally {
      jpgExportLockRef.current = false
      setExportingJpg(false)
    }
  }

  const toggleAccordion = (id) => {
    setOpenedAccordionId((prev) => (prev === id ? null : id))
  }

  const previewLabel = useMemo(() => {
    return slidePanels.find((p) => p.id === previewPanelId)?.label ?? null
  }, [previewPanelId, slidePanels])

  const previewMarcoPadding =
    previewPanelId === 'portada'
      ? '60px 60px 80px 60px'
      : ratio === '4_5'
        ? '60px 60px 65px 60px'
        : '60px 60px 75px 60px'

  const portadaPreviewHtml = useMemo(
    () => htmlOrPlainToPreview(textoPortadaPlano || '') || '',
    [textoPortadaPlano],
  )

  const carrusel1PreviewPanelKey = useMemo(() => {
    if (previewPanelId === 'portada') return 'portada'
    if (String(previewPanelId).startsWith('slide-')) return previewPanelId
    return null
  }, [previewPanelId])

  /** Pan + zoom en el cuadro gris (misma lógica portada y slides). */
  const carrusel1ImagenPanTransform = useMemo(() => {
    if (!isCarrusel1 || !carrusel1PreviewPanelKey) {
      return {
        transform: 'translate(0%,0%) scale(1)',
        transformOrigin: 'center center',
      }
    }
    const pid = carrusel1PreviewPanelKey
    const z = (nbZoomByPanel[pid] ?? 100) / 100
    const lim = 62 * Math.max(1, z)
    const px = nbPanXByPanel[pid] ?? 50
    const py = nbPanYByPanel[pid] ?? 50
    const tx = ((50 - px) / 50) * lim
    const ty = ((50 - py) / 50) * lim
    return {
      transform: `translate(${tx}%, ${ty}%) scale(${z})`,
      transformOrigin: 'center center',
    }
  }, [isCarrusel1, carrusel1PreviewPanelKey, nbZoomByPanel, nbPanXByPanel, nbPanYByPanel])

  const carrusel1PreviewImageUrl = useMemo(() => {
    if (!isCarrusel1 || !carrusel1PreviewPanelKey) return ''
    return nbUrlByPanel[carrusel1PreviewPanelKey] || ''
  }, [isCarrusel1, carrusel1PreviewPanelKey, nbUrlByPanel])

  const handleGenerarImagenPanel = async (panelId) => {
    setNbErrByPanel((prev) => ({ ...prev, [panelId]: '' }))
    setNbGenPanelId(panelId)
    try {
      const idea = String(nbPromptByPanel[panelId] || '').trim()
      const promptFinal = [
        PROMPT_FONDO_OBLIGATORIA_PORTADA,
        PROMPT_BASE_PORTADA_CARRUSEL_1,
        idea ? `Idea del usuario: ${idea}` : '',
      ]
        .filter(Boolean)
        .join(' ')
      const res = await fetch(`${API_BASE}/api/nano-banana/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratio: '1_1',
          nonce: Date.now(),
          prompt: promptFinal,
          backgroundHex: PORTADA_CARRUSEL_1_FONDO_IMAGEN_HEX,
          carouselStyleBackground: true,
        }),
      })
      if (!res.ok) {
        const txt = await res.text()
        let msg = ''
        try {
          const j = JSON.parse(txt)
          if (typeof j?.error === 'string') msg = j.error
          else if (j?.error && typeof j.error === 'object' && j.error.message) {
            msg = String(j.error.message)
          }
        } catch {
          /* cuerpo no JSON */
        }
        throw new Error(msg || txt?.slice(0, 500) || `Error ${res.status}`)
      }
      const data = await res.json()
      if (!data?.imageUrl) throw new Error('Respuesta sin imageUrl')
      setNbUrlByPanel((prev) => ({ ...prev, [panelId]: String(data.imageUrl) }))
    } catch (err) {
      setNbErrByPanel((prev) => ({
        ...prev,
        [panelId]: err instanceof Error ? err.message : 'No se pudo generar la imagen',
      }))
    } finally {
      setNbGenPanelId(null)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:w-[380px] lg:self-start">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Ajustes Generales</h2>
          {typeof numSlidesTotal === 'number' && (
            <p className="mt-1 text-xs text-slate-600">
              Slides elegidos (incl. portada): <strong>{numSlidesTotal}</strong>
            </p>
          )}
          {typeof numSlidesTotal !== 'number' && (
            <p className="mt-1 text-xs text-amber-800/90">
              Sin total desde el grid; usando <strong>{FALLBACK_SLIDES_TOTAL}</strong> slides para el
              acordeón.
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-slate-600">Tamaño del arte</label>
          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
            {Object.keys(RATIOS).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setRatio(key)}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  ratio === key
                    ? 'bg-violet-100 text-violet-900'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {RATIOS[key].label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            Salida: {spec.ancho} × {spec.alto} px ({spec.label})
          </p>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-slate-600">Color del cuadro</label>
          <div className="flex flex-wrap items-center gap-1.5">
            {PORTADA_CUADRO_COLORS_HEX.map((hex) => (
              <button
                key={hex}
                type="button"
                title={hex}
                onClick={() => setPortadaCuadroColor(hex)}
                className={`h-5 w-5 rounded border ${
                  portadaCuadroColor === hex ? 'border-black' : 'border-slate-300'
                }`}
                style={{ backgroundColor: hex }}
                aria-label={`Color ${hex}`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Slides del carrusel
          </h3>
          {slidePanels.map((panel) => (
            <SlideAccordionItem
              key={panel.id}
              itemId={panel.id}
              title={panel.label}
              open={openedAccordionId === panel.id}
              onToggle={() => toggleAccordion(panel.id)}
            >
              <>
                {panel.id === 'portada' ? (
                  <PortadaRichTextField
                    label="Texto de la portada"
                    editorId={portadaTextareaId}
                    value={textoPortadaPlano}
                    onChange={setTextoPortadaPlano}
                    placeholder="Escribe el título..."
                  />
                ) : (
                  <PortadaRichTextField
                    label={`Texto de ${panel.label}`}
                    editorId={`carrusel-slide-rt-${panel.id}`}
                    value={slidesContenido[panel.id] || ''}
                    onChange={(html) =>
                      setSlidesContenido((prev) => ({ ...prev, [panel.id]: html }))
                    }
                    placeholder="Escribe el texto del slide..."
                  />
                )}
                {isCarrusel1 ? (
                  <div className="mt-3 space-y-2 rounded-xl border border-dashed border-slate-300 bg-amber-50/50 p-3">
                    <ImageGenCharactersWarning />
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Idea del usuario (se suma al prompt base)
                    </label>
                    <textarea
                      value={nbPromptByPanel[panel.id] || ''}
                      onChange={(e) =>
                        setNbPromptByPanel((prev) => ({ ...prev, [panel.id]: e.target.value }))
                      }
                      rows={3}
                      placeholder={
                        panel.id === 'portada'
                          ? 'Describe lo que quieres para la portada…'
                          : `Describe lo que quieres para ${panel.label.toLowerCase()}…`
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-amber-500/20 focus:ring-2"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleGenerarImagenPanel(panel.id)}
                        disabled={nbGenPanelId === panel.id}
                        className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60"
                      >
                        {nbGenPanelId === panel.id ? 'Generando imagen…' : 'Generar imagen'}
                      </button>
                    </div>
                    <div className="pt-1">
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Zoom ({nbZoomByPanel[panel.id] ?? 100}%): 100 llena el cuadro gris; más grande recorta
                        bordes; más chico deja margen.
                      </label>
                      <input
                        type="range"
                        min={25}
                        max={200}
                        step={1}
                        value={nbZoomByPanel[panel.id] ?? 100}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10)
                          const v = Number.isFinite(n) ? Math.min(200, Math.max(25, n)) : 100
                          setNbZoomByPanel((prev) => ({ ...prev, [panel.id]: v }))
                        }}
                        className="w-full accent-slate-700"
                      />
                    </div>
                    <div className="pt-1">
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Posición horizontal ({nbPanXByPanel[panel.id] ?? 50}%): 0 a la izquierda del cuadro gris —
                        50 centro — 100 a la derecha. Con zoom alto puedes recorrer toda el área.
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={nbPanXByPanel[panel.id] ?? 50}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10)
                          const v = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 50
                          setNbPanXByPanel((prev) => ({ ...prev, [panel.id]: v }))
                        }}
                        className="w-full accent-slate-700"
                      />
                    </div>
                    <div className="pt-1">
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Posición vertical ({nbPanYByPanel[panel.id] ?? 50}%): 0 arriba del cuadro gris — 50 centro —
                        100 abajo (sube el encuadre para ver los pies). A mayor zoom, más recorrido.
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={nbPanYByPanel[panel.id] ?? 50}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10)
                          const v = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 50
                          setNbPanYByPanel((prev) => ({ ...prev, [panel.id]: v }))
                        }}
                        className="w-full accent-slate-700"
                      />
                    </div>
                    {nbErrByPanel[panel.id] ? (
                      <p className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
                        {nbErrByPanel[panel.id]}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <CarruselNanoBananaImageField
                    panelId={panel.id}
                    value={descripcionesImagenNanoBanana[panel.id] || ''}
                    onChange={(v) =>
                      setDescripcionesImagenNanoBanana((prev) => ({ ...prev, [panel.id]: v }))
                    }
                  />
                )}
                <button
                  type="button"
                  disabled={exportingJpg}
                  onClick={() => void handleDescargarCuadroJpg(panel.id)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50"
                >
                  <Download className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
                  {exportingJpg
                    ? 'Generando JPG…'
                    : `Descargar cuadro JPG (${spec.ancho}×${spec.alto})`}
                </button>
              </>
            </SlideAccordionItem>
          ))}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Vista previa
          </span>
          {previewLabel && (
            <span className="text-xs font-medium text-violet-800">Editando: {previewLabel}</span>
          )}
        </div>

        {jpgExportError ? (
          <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
            {jpgExportError}
          </p>
        ) : null}

        <div className="min-h-[480px] flex-1 overflow-auto bg-slate-200/60 p-4">
          <div
            className="mx-auto flex w-full max-w-[600px] flex-col overflow-hidden border border-slate-200 bg-white shadow-inner"
            style={{ aspectRatio: spec.aspectCss }}
          >
            <div
              ref={carruselExportRef}
              className="relative box-border flex min-h-0 flex-1 flex-col overflow-hidden"
              style={{ padding: previewMarcoPadding, backgroundColor: '#ffffff' }}
            >
              <div
                ref={portadaGrayRef}
                className={`relative box-border flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[20px] ${
                  previewPanelId !== 'portada' ? 'z-0' : ''
                }`}
                style={{
                  backgroundColor:
                    isCarruselNumerado && previewPanelId === 'portada'
                      ? '#ffffff'
                      : isCarrusel1
                        ? PORTADA_CARRUSEL_1_FONDO_IMAGEN_HEX
                        : PORTADA_VISTA_PREVIA_FONDO_HEX,
                }}
              >
                {isCarrusel1 && carrusel1PreviewImageUrl ? (
                  <div
                    className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[20px]"
                    aria-hidden
                  >
                    <div className="h-full w-full" style={carrusel1ImagenPanTransform}>
                      <img
                        src={carrusel1PreviewImageUrl}
                        alt=""
                        className="block h-full w-full object-cover"
                        draggable={false}
                        crossOrigin={
                          /^https?:\/\//i.test(String(carrusel1PreviewImageUrl || ''))
                            ? 'anonymous'
                            : undefined
                        }
                      />
                    </div>
                  </div>
                ) : null}

                {previewPanelId === 'portada' ? (
                  <div
                    ref={portadaBlueRef}
                    className="pointer-events-none absolute left-0 top-0 z-[5] w-full rounded-[20px]"
                    style={{
                      backgroundColor: portadaCuadroColor,
                      height: `${portadaBluePct}%`,
                    }}
                    aria-hidden
                  />
                ) : null}

                {activeSlideId ? (
                  <>
                    {isCarruselNumerado ? (
                      <div
                        className="pointer-events-none absolute z-[16] flex h-[100px] w-[100px] items-center justify-center"
                        style={{
                          top: 30,
                          left: 30,
                          backgroundColor: portadaCuadroColor,
                          borderRadius: 20,
                        }}
                        aria-hidden
                      >
                        <span
                          className="block tabular-nums text-center text-[56px] font-black leading-none text-white"
                          style={{ fontFamily: '"Nunito Sans", sans-serif' }}
                        >
                          {Number.parseInt(String(activeSlideId).replace('slide-', ''), 10) || ''}
                        </span>
                      </div>
                    ) : null}
                    <div
                      ref={slideBandRef}
                      className="pointer-events-none absolute left-0 top-0 z-0 w-full rounded-[20px]"
                      style={{
                        backgroundColor: 'transparent',
                        height: `${slideBoxPct}%`,
                      }}
                      aria-hidden
                    />
                    <div
                      ref={slideTextBoxRef}
                      className={`absolute left-0 top-0 z-[15] flex w-full ${
                        isCarruselNumerado
                          ? 'items-start justify-start text-left'
                          : 'items-center justify-center text-center'
                      }`}
                      style={{
                        height: `${slideBoxPct}%`,
                        paddingTop: isCarruselNumerado ? 35 : 20,
                        paddingRight: 20,
                        paddingBottom: 20,
                        paddingLeft: isCarruselNumerado ? 150 : 20,
                        boxSizing: 'border-box',
                        pointerEvents: 'none',
                      }}
                      aria-hidden
                    >
                      <div
                        ref={slideTextBoxInnerRef}
                        className={`flex h-full min-h-0 w-full flex-col ${
                          isCarruselNumerado ? 'items-start justify-start' : 'items-center justify-center'
                        } overflow-hidden`}
                      >
                        <div
                          ref={slideTextRef}
                          className="slide-preview-rich block w-full whitespace-pre-wrap break-words [&_em]:italic [&_p]:m-0 [&_strong]:font-black [&_ul]:my-[0.25em] [&_ul]:list-disc [&_ul]:pl-[1.2em] [&_ol]:my-[0.25em] [&_ol]:list-decimal [&_ol]:pl-[1.2em] [&_li]:my-[0.1em]"
                          style={{
                            fontFamily: '"Nunito Sans", sans-serif',
                            fontWeight: 300,
                            fontSize: slideFontSize,
                            lineHeight: 1.2,
                            color: '#003b49',
                          }}
                          dangerouslySetInnerHTML={{ __html: slidePreviewHtml }}
                        />
                      </div>
                    </div>
                  </>
                ) : null}

                {previewPanelId === 'portada' ? (
                  <div
                    ref={portadaTextBoxRef}
                    className="absolute left-0 top-0 z-[10] flex w-full items-center justify-center text-center"
                    style={{
                      height: `${portadaBluePct}%`,
                      padding: 20,
                      boxSizing: 'border-box',
                      pointerEvents: 'none',
                    }}
                    aria-hidden
                  >
                    <div
                      ref={portadaTextBoxInnerRef}
                      className="flex h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden"
                    >
                      <div
                        ref={portadaTextRef}
                        className="portada-preview-rich block w-full whitespace-pre-wrap break-words text-white [&_em]:italic [&_p]:m-0 [&_strong]:font-black [&_ul]:my-[0.25em] [&_ul]:list-disc [&_ul]:pl-[1.2em] [&_ol]:my-[0.25em] [&_ol]:list-decimal [&_ol]:pl-[1.2em] [&_li]:my-[0.1em]"
                        style={{
                          fontFamily: '"Nunito Sans", sans-serif',
                          fontWeight: 300,
                          fontSize: portadaFontSize,
                          lineHeight: 1.2,
                        }}
                        dangerouslySetInnerHTML={{ __html: portadaPreviewHtml }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {previewPanelId !== 'portada' ? (
                isCarrusel2 ? (
                  <img
                    src={mediaUrl(ratio === '4_5' ? RUTA_LOGO_PORTADA_4_5 : RUTA_LOGO_PORTADA)}
                    alt=""
                    className="pointer-events-none absolute inset-0 z-[2] h-full w-full object-cover"
                    crossOrigin="anonymous"
                    aria-hidden
                  />
                ) : isEditingLastSlide ? (
                  <div
                    className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: finalSlideSvgHtml }}
                    aria-hidden
                  />
                ) : ratio === '4_5' ? (
                  <img
                    src={mediaUrl(RUTA_LOGO_CARRUSEL_4_5)}
                    alt=""
                    className="pointer-events-none absolute inset-0 z-30 h-full w-full object-cover"
                    crossOrigin="anonymous"
                    aria-hidden
                  />
                ) : (
                  <div
                    className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
                    aria-hidden
                  >
                    <LogoCarruselMedio
                      accentHex={portadaCuadroColor}
                      preserveAspectRatio="xMidYMax slice"
                      className="block h-full w-full"
                    />
                  </div>
                )
              ) : null}

              {previewPanelId === 'portada' ? (
                <img
                  src={mediaUrl(ratio === '4_5' ? RUTA_LOGO_PORTADA_4_5 : RUTA_LOGO_PORTADA)}
                  alt=""
                  className="pointer-events-none absolute inset-0 z-[2] h-full w-full object-cover"
                  crossOrigin="anonymous"
                  aria-hidden
                />
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
