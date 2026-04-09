import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Monitor, Printer, Smartphone, Upload } from 'lucide-react'
import { readEmail1IdentityFromSearch } from './email1Identity.js'
import { FONDO_CORREO_HEX, FONDO_CUADRO_IMAGEN_HEX, TEXTO_MARCA_HEX } from './emailPalettes'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { htmlOrPlainToPreview } from './utils/sanitizeEmailHtml'
import RichTextEmailField from './RichTextEmailField.jsx'
import ImageGenCharactersWarning from './ImageGenCharactersWarning.jsx'
import EmailCtaAsideBlock from './EmailCtaAsideBlock.jsx'
import { EMAIL_RICH_PREVIEW_BODY, EMAIL_RICH_PREVIEW_FOOTER } from './emailRichTextClasses.js'
import {
  clampCtaFontSizePx,
  isEmail1CtaPreviewVisible,
  sanitizeCtaHttpUrl,
} from './email1CtaUtils.js'
import { EMAIL1_SOCIAL_LINKS } from './email1SocialLinks.js'

const API_BASE =
  import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '')

const INPUT_DT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-violet-500/20 focus:ring-2'

/** Logo del encabezado para la plantilla Newsletter (archivo en storage/plantillas/miniaturas/). */
const LOGO_RUTA_NEWSLETTER = 'miniaturas/logo-newsletter.svg'

function mediaUrl(ruta) {
  if (!ruta) return ''
  const clean = String(ruta).replace(/^\//, '')
  return `${API_BASE}/media/plantillas/${clean}`
}

function hasText(s) {
  const t = String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim()
  return t.length > 0
}

function pdfFileBaseName(plantilla, variant = 'email1') {
  const raw = plantilla?.id_externo || 'preview'
  const sinTpl = String(raw).replace(/^tpl_/i, '')
  const slug = variant === 'newsletter' ? 'newsletter-1' : 'email-1'
  return `${slug}-${sinTpl}`
}

function parseEmailsCsv(s) {
  return String(s || '')
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function emailsLookValid(list) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return list.length > 0 && list.every((e) => re.test(e))
}

/** Extrae direcciones de un CSV o texto plano (varias columnas o líneas). */
function extractEmailsFromImportedText(text) {
  const re =
    /[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}/g
  const raw = String(text || '').match(re) || []
  return [...new Set(raw.map((e) => e.toLowerCase()))]
}

function defaultDateStrings() {
  const min = new Date()
  const y = min.getFullYear()
  const m = String(min.getMonth() + 1).padStart(2, '0')
  const d = String(min.getDate()).padStart(2, '0')
  return { fecha: `${y}-${m}-${d}`, hora: '09:00' }
}

function isoFromFechaHoraLocal(fecha, hora) {
  const d = new Date(`${fecha}T${hora}:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function applyFechaHoraToState(iso, setFecha, setHora) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  setFecha(`${y}-${m}-${day}`)
  setHora(`${hh}:${mm}`)
}

function ctaPreviewJustify(align) {
  const a = String(align || 'center').toLowerCase()
  if (a === 'left') return 'justify-start'
  if (a === 'right') return 'justify-end'
  return 'justify-center'
}

function formatNewsletterDateDisplay(iso) {
  const s = String(iso || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return ''
  try {
    return dt.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

function EmailNanoBananaPromptField({ label, value, onChange, idSuffix }) {
  const fieldId = `email1-nb-${idSuffix}`
  return (
    <div>
      <label htmlFor={fieldId} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <textarea
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Describe cómo debe ser la imagen…"
        className="w-full rounded-xl border border-dashed border-slate-300 bg-amber-50/50 px-3 py-2 text-sm text-slate-800 outline-none ring-amber-500/20 focus:ring-2"
      />
    </div>
  )
}

export default function Email1Editor({
  plantilla,
  variant = 'email1',
  userId = 1,
  role: roleProp = 'user',
  bootstrapSolicitudId = null,
  bootstrapAutoPrintPdf = false,
  onBootstrapSolicitudDone,
  onVolverAlInicio,
}) {
  const editorTipoApi = variant === 'newsletter' ? 'newsletter_1' : 'email1'
  const editorHeading = variant === 'newsletter' ? 'Newsletter' : 'Email 1'
  const {
    userId: effectiveUserId,
    role: effectiveRole,
    canSelfSchedule: effectiveCanSelfSchedule,
    fromUrl: identityFromUrl,
  } = readEmail1IdentityFromSearch(userId, roleProp)

  const [step, setStep] = useState('edit')
  const [asuntoCorreo, setAsuntoCorreo] = useState('')
  const [fondoCorreoIdx, setFondoCorreoIdx] = useState(0)
  const [imgBoxIdx, setImgBoxIdx] = useState(0)
  const [cuerpo1Html, setCuerpo1Html] = useState('<p></p>')
  const [cuerpo2Html, setCuerpo2Html] = useState('<p></p>')
  const [footerHtml, setFooterHtml] = useState('<p></p>')
  const [promptImagen, setPromptImagen] = useState('')
  const [imagenGeminiUrl, setImagenGeminiUrl] = useState('')
  const [imagenGeminiSizePct, setImagenGeminiSizePct] = useState(100)
  const [generandoImagenGemini, setGenerandoImagenGemini] = useState(false)
  const [imagenGeminiError, setImagenGeminiError] = useState('')
  const [vistaPreview, setVistaPreview] = useState('desktop')

  const [ctaAfter1Enabled, setCtaAfter1Enabled] = useState(false)
  const [ctaAfter1ColorIdx, setCtaAfter1ColorIdx] = useState(0)
  const [ctaAfter1Text, setCtaAfter1Text] = useState('')
  const [ctaAfter1Url, setCtaAfter1Url] = useState('')
  const [ctaAfter1FontSizePx, setCtaAfter1FontSizePx] = useState(18)
  const [ctaAfter1Align, setCtaAfter1Align] = useState('center')
  const [ctaAfter2Enabled, setCtaAfter2Enabled] = useState(false)
  const [ctaAfter2ColorIdx, setCtaAfter2ColorIdx] = useState(0)
  const [ctaAfter2Text, setCtaAfter2Text] = useState('')
  const [ctaAfter2Url, setCtaAfter2Url] = useState('')
  const [ctaAfter2FontSizePx, setCtaAfter2FontSizePx] = useState(18)
  const [ctaAfter2Align, setCtaAfter2Align] = useState('center')

  const [newsletterFecha, setNewsletterFecha] = useState(() => defaultDateStrings().fecha)
  const [newsletterFechaColorIdx, setNewsletterFechaColorIdx] = useState(0)
  const [newsletterTitulo, setNewsletterTitulo] = useState('')
  const [newsletterTituloColorIdx, setNewsletterTituloColorIdx] = useState(0)

  const def = useMemo(() => defaultDateStrings(), [])
  const [fechaProg, setFechaProg] = useState(def.fecha)
  const [horaProg, setHoraProg] = useState(def.hora)
  const [enviarTodos, setEnviarTodos] = useState(true)
  const [destinatariosCsv, setDestinatariosCsv] = useState('')
  const [enviarInmediatamenteAdmin, setEnviarInmediatamenteAdmin] = useState(false)

  const [solicitudActivaId, setSolicitudActivaId] = useState(null)
  const [apiError, setApiError] = useState('')
  const [apiBusy, setApiBusy] = useState(false)

  const previewCardRef = useRef(null)
  const printTitleBeforeRef = useRef(null)
  const importContactsInputRef = useRef(null)
  /** Evita doble clic en “Enviar inmediatamente” → varios POST /api/email-envios. */
  const adminCompletarLockRef = useRef(false)

  const d1 = useDebouncedValue(cuerpo1Html, 220)
  const d2 = useDebouncedValue(cuerpo2Html, 220)
  const dFoot = useDebouncedValue(footerHtml, 280)

  const fondoCorreo = FONDO_CORREO_HEX[fondoCorreoIdx] ?? FONDO_CORREO_HEX[0]
  const bgImg = FONDO_CUADRO_IMAGEN_HEX[imgBoxIdx] ?? FONDO_CUADRO_IMAGEN_HEX[0]

  const previewInner1 = useMemo(() => htmlOrPlainToPreview(d1), [d1])
  const previewInner2 = useMemo(() => htmlOrPlainToPreview(d2), [d2])
  const previewFoot = useMemo(() => htmlOrPlainToPreview(dFoot), [dFoot])

  const showBlock1 = hasText(d1)
  const showBlock2 = hasText(d2)
  const showFooter = hasText(dFoot)

  const showCta1Preview = useMemo(
    () => isEmail1CtaPreviewVisible(ctaAfter1Enabled, ctaAfter1Text, ctaAfter1Url),
    [ctaAfter1Enabled, ctaAfter1Text, ctaAfter1Url]
  )
  const showCta2Preview = useMemo(
    () => isEmail1CtaPreviewVisible(ctaAfter2Enabled, ctaAfter2Text, ctaAfter2Url),
    [ctaAfter2Enabled, ctaAfter2Text, ctaAfter2Url]
  )
  const cta1Bg = FONDO_CUADRO_IMAGEN_HEX[ctaAfter1ColorIdx] ?? FONDO_CUADRO_IMAGEN_HEX[0]
  const cta2Bg = FONDO_CUADRO_IMAGEN_HEX[ctaAfter2ColorIdx] ?? FONDO_CUADRO_IMAGEN_HEX[0]
  const cta1Href = sanitizeCtaHttpUrl(ctaAfter1Url)
  const cta2Href = sanitizeCtaHttpUrl(ctaAfter2Url)

  const newsletterFechaDisplay = useMemo(
    () => formatNewsletterDateDisplay(newsletterFecha),
    [newsletterFecha]
  )
  const newsletterFechaHex =
    FONDO_CUADRO_IMAGEN_HEX[newsletterFechaColorIdx] ?? FONDO_CUADRO_IMAGEN_HEX[0]
  const newsletterTituloHex =
    TEXTO_MARCA_HEX[newsletterTituloColorIdx] ?? TEXTO_MARCA_HEX[0]

  const anchoCard = vistaPreview === 'mobile' ? 'min(100%, 360px)' : 'min(100%, 600px)'

  const logoRuta = useMemo(() => {
    if (variant === 'newsletter') {
      return LOGO_RUTA_NEWSLETTER
    }
    try {
      const raw = plantilla?.definicion
      const d = typeof raw === 'string' ? JSON.parse(raw) : raw
      return d?.email1?.logoRuta || 'miniaturas/logo-abc-logistica.svg'
    } catch {
      return 'miniaturas/logo-abc-logistica.svg'
    }
  }, [plantilla, variant])

  const logoSrc = mediaUrl(logoRuta)

  const minDateStr = useMemo(() => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  }, [])
  const maxDateStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 365)
    return d.toISOString().slice(0, 10)
  }, [])

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      'X-User-Id': String(effectiveUserId),
    }),
    [effectiveUserId]
  )

  const fetchApi = useCallback(
    async (path, options = {}) => {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { ...authHeaders, ...(options.headers || {}) },
      })
      const txt = await res.text()
      let data = null
      try {
        data = txt ? JSON.parse(txt) : null
      } catch {
        data = { error: txt || res.statusText }
      }
      if (!res.ok) {
        let msg = typeof data?.error === 'string' ? data.error : txt || res.statusText
        if (data?.hint) msg += ` ${data.hint}`
        if (data?.dbMessage) msg += ` (${data.dbMessage})`
        if (data?.usersEnBd != null) msg += ` [users en BD: ${data.usersEnBd}]`
        if (data?.plantillasEnBd != null) msg += ` [plantillas en BD: ${data.plantillasEnBd}]`
        throw new Error(msg)
      }
      return data
    },
    [authHeaders]
  )

  const serializePayload = useCallback(() => {
    const base = {
      asuntoCorreo,
      fondoCorreoIdx,
      imgBoxIdx,
      cuerpo1Html,
      cuerpo2Html,
      footerHtml,
      promptImagen,
      imagenGeminiUrl,
      imagenGeminiSizePct,
      vistaPreview,
      ctaAfter1Enabled: variant === 'newsletter' ? true : ctaAfter1Enabled,
      ctaAfter1ColorIdx,
      ctaAfter1Text,
      ctaAfter1Url,
      ctaAfter1FontSizePx,
      ctaAfter1Align,
      ctaAfter2Enabled,
      ctaAfter2ColorIdx,
      ctaAfter2Text,
      ctaAfter2Url,
      ctaAfter2FontSizePx,
      ctaAfter2Align,
    }
    if (variant === 'newsletter') {
      return {
        ...base,
        newsletterFecha,
        newsletterFechaColorIdx,
        newsletterTitulo,
        newsletterTituloColorIdx,
      }
    }
    return base
  }, [
    variant,
    asuntoCorreo,
    fondoCorreoIdx,
    imgBoxIdx,
    cuerpo1Html,
    cuerpo2Html,
    footerHtml,
    promptImagen,
    imagenGeminiUrl,
    imagenGeminiSizePct,
    vistaPreview,
    ctaAfter1Enabled,
    ctaAfter1ColorIdx,
    ctaAfter1Text,
    ctaAfter1Url,
    ctaAfter1FontSizePx,
    ctaAfter1Align,
    ctaAfter2Enabled,
    ctaAfter2ColorIdx,
    ctaAfter2Text,
    ctaAfter2Url,
    ctaAfter2FontSizePx,
    ctaAfter2Align,
    newsletterFecha,
    newsletterFechaColorIdx,
    newsletterTitulo,
    newsletterTituloColorIdx,
  ])

  const applyPayload = useCallback((p) => {
    if (!p || typeof p !== 'object') return
    setAsuntoCorreo(typeof p.asuntoCorreo === 'string' ? p.asuntoCorreo : '')
    if (typeof p.fondoCorreoIdx === 'number') setFondoCorreoIdx(p.fondoCorreoIdx)
    if (typeof p.imgBoxIdx === 'number') setImgBoxIdx(p.imgBoxIdx)
    if (typeof p.cuerpo1Html === 'string') setCuerpo1Html(p.cuerpo1Html)
    if (typeof p.cuerpo2Html === 'string') setCuerpo2Html(p.cuerpo2Html)
    if (typeof p.footerHtml === 'string') setFooterHtml(p.footerHtml)
    if (typeof p.promptImagen === 'string') setPromptImagen(p.promptImagen)
    if (typeof p.imagenGeminiUrl === 'string') setImagenGeminiUrl(p.imagenGeminiUrl)
    if (typeof p.imagenGeminiSizePct === 'number') setImagenGeminiSizePct(p.imagenGeminiSizePct)
    if (p.vistaPreview === 'desktop' || p.vistaPreview === 'mobile') setVistaPreview(p.vistaPreview)
    if (typeof p.ctaAfter1Enabled === 'boolean') setCtaAfter1Enabled(p.ctaAfter1Enabled)
    if (typeof p.ctaAfter1ColorIdx === 'number') setCtaAfter1ColorIdx(p.ctaAfter1ColorIdx)
    if (typeof p.ctaAfter1Text === 'string') setCtaAfter1Text(p.ctaAfter1Text)
    if (typeof p.ctaAfter1Url === 'string') setCtaAfter1Url(p.ctaAfter1Url)
    if (typeof p.ctaAfter1FontSizePx === 'number') setCtaAfter1FontSizePx(p.ctaAfter1FontSizePx)
    if (p.ctaAfter1Align === 'left' || p.ctaAfter1Align === 'center' || p.ctaAfter1Align === 'right') {
      setCtaAfter1Align(p.ctaAfter1Align)
    }
    if (typeof p.ctaAfter2Enabled === 'boolean') setCtaAfter2Enabled(p.ctaAfter2Enabled)
    if (typeof p.ctaAfter2ColorIdx === 'number') setCtaAfter2ColorIdx(p.ctaAfter2ColorIdx)
    if (typeof p.ctaAfter2Text === 'string') setCtaAfter2Text(p.ctaAfter2Text)
    if (typeof p.ctaAfter2Url === 'string') setCtaAfter2Url(p.ctaAfter2Url)
    if (typeof p.ctaAfter2FontSizePx === 'number') setCtaAfter2FontSizePx(p.ctaAfter2FontSizePx)
    if (p.ctaAfter2Align === 'left' || p.ctaAfter2Align === 'center' || p.ctaAfter2Align === 'right') {
      setCtaAfter2Align(p.ctaAfter2Align)
    }
    if (typeof p.newsletterFecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.newsletterFecha)) {
      setNewsletterFecha(p.newsletterFecha)
    }
    if (typeof p.newsletterFechaColorIdx === 'number' && Number.isFinite(p.newsletterFechaColorIdx)) {
      setNewsletterFechaColorIdx(
        Math.min(
          FONDO_CUADRO_IMAGEN_HEX.length - 1,
          Math.max(0, Math.floor(p.newsletterFechaColorIdx))
        )
      )
    }
    if (typeof p.newsletterTitulo === 'string') setNewsletterTitulo(p.newsletterTitulo)
    if (typeof p.newsletterTituloColorIdx === 'number' && Number.isFinite(p.newsletterTituloColorIdx)) {
      setNewsletterTituloColorIdx(
        Math.min(
          TEXTO_MARCA_HEX.length - 1,
          Math.max(0, Math.floor(p.newsletterTituloColorIdx))
        )
      )
    }
  }, [])

  useEffect(() => {
    const onAfterPrint = () => {
      document.body.classList.remove('email1-print-active')
      if (printTitleBeforeRef.current != null) {
        document.title = printTitleBeforeRef.current
        printTitleBeforeRef.current = null
      }
    }
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      window.removeEventListener('afterprint', onAfterPrint)
      onAfterPrint()
    }
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--email1-fondo-correo', fondoCorreo)
    return () => {
      document.documentElement.style.removeProperty('--email1-fondo-correo')
    }
  }, [fondoCorreo])

  useEffect(() => {
    if (variant === 'newsletter') setCtaAfter1Enabled(true)
  }, [variant])

  const handleGenerarImagenGemini = async () => {
    setImagenGeminiError('')
    const texto = String(promptImagen || '').trim()
    if (!texto) {
      setImagenGeminiError('Escribe instrucciones para la imagen.')
      return
    }
    setGenerandoImagenGemini(true)
    try {
      const res = await fetch(`${API_BASE}/api/nano-banana/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratio: '1_1',
          nonce: Date.now(),
          prompt: texto,
          backgroundHex: bgImg,
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
      setImagenGeminiUrl(String(data.imageUrl))
    } catch (err) {
      setImagenGeminiError(err instanceof Error ? err.message : 'No se pudo generar la imagen')
    } finally {
      setGenerandoImagenGemini(false)
    }
  }

  const handleImprimirGuardarPdf = useCallback(() => {
    if (typeof document === 'undefined') return
    printTitleBeforeRef.current = document.title
    document.title = pdfFileBaseName(plantilla, variant)
    document.body.classList.add('email1-print-active')
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print()
      })
    })
  }, [plantilla, variant])

  const emailsList = useMemo(() => parseEmailsCsv(destinatariosCsv), [destinatariosCsv])
  const puedeEnviarRevisionUsuario = enviarTodos || emailsLookValid(emailsList)

  const handleImportContactsChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const fromFile = extractEmailsFromImportedText(String(reader.result || ''))
      const existing = parseEmailsCsv(destinatariosCsv)
      const seen = new Set(existing.map((x) => x.toLowerCase()))
      const merged = [...existing]
      for (const em of fromFile) {
        if (!seen.has(em)) {
          seen.add(em)
          merged.push(em)
        }
      }
      setDestinatariosCsv(merged.join(', '))
      e.target.value = ''
    }
    reader.onerror = () => {
      e.target.value = ''
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleContinuarDesdeEdit = () => {
    setApiError('')
    if (!effectiveCanSelfSchedule || solicitudActivaId == null) {
      const { fecha, hora } = defaultDateStrings()
      setFechaProg(fecha)
      setHoraProg(hora)
      setEnviarTodos(true)
      setDestinatariosCsv('')
    }
    setEnviarInmediatamenteAdmin(false)
    setStep('schedule')
  }

  const handleVolverSchedule = () => {
    setStep('edit')
    setApiError('')
  }

  const handleEnviarRevision = async () => {
    if (effectiveCanSelfSchedule) return
    setApiError('')
    const iso = isoFromFechaHoraLocal(fechaProg, horaProg)
    if (!iso) {
      setApiError('Fecha u hora no válida.')
      return
    }
    if (!puedeEnviarRevisionUsuario) {
      setApiError('Indica correos válidos separados por comas o activa «Enviar a todos».')
      return
    }
    setApiBusy(true)
    try {
      const body = {
        plantilla_id: plantilla.id,
        editor_tipo: editorTipoApi,
        payload: serializePayload(),
        enviar_todos: enviarTodos,
        destinatarios: enviarTodos ? '' : destinatariosCsv,
        fecha_hora_programada: iso,
      }
      if (solicitudActivaId != null) {
        await fetchApi(`/api/email-envios/${solicitudActivaId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            payload: body.payload,
            enviar_todos: enviarTodos,
            destinatarios: body.destinatarios,
            fecha_hora_programada: iso,
          }),
        })
      } else {
        await fetchApi('/api/email-envios', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      }
      setStep('edit')
      setSolicitudActivaId(null)
      onVolverAlInicio?.()
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Error al enviar')
    } finally {
      setApiBusy(false)
    }
  }

  const abrirSolicitud = async (id) => {
    setApiError('')
    setApiBusy(true)
    try {
      const row = await fetchApi(`/api/email-envios/${id}`)
      applyPayload(row.payload)
      setEnviarTodos(Boolean(row.enviar_todos))
      setDestinatariosCsv(row.destinatarios || '')
      applyFechaHoraToState(row.fecha_hora_programada, setFechaProg, setHoraProg)
      setSolicitudActivaId(row.id)
      setEnviarInmediatamenteAdmin(false)
      setStep('edit')
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'No se pudo abrir')
    } finally {
      setApiBusy(false)
    }
  }

  useEffect(() => {
    if (bootstrapSolicitudId == null) return
    const id = bootstrapSolicitudId
    let cancelled = false
    ;(async () => {
      setApiError('')
      setApiBusy(true)
      try {
        const row = await fetchApi(`/api/email-envios/${id}`)
        if (cancelled) return
        applyPayload(row.payload)
        setEnviarTodos(Boolean(row.enviar_todos))
        setDestinatariosCsv(row.destinatarios || '')
        applyFechaHoraToState(row.fecha_hora_programada, setFechaProg, setHoraProg)
        setSolicitudActivaId(row.id)
        setEnviarInmediatamenteAdmin(false)
        setStep(bootstrapAutoPrintPdf ? 'schedule' : 'edit')
        if (bootstrapAutoPrintPdf) {
          window.setTimeout(() => {
            if (!cancelled) handleImprimirGuardarPdf()
          }, 450)
        }
      } catch (e) {
        if (!cancelled) setApiError(e instanceof Error ? e.message : 'No se pudo abrir')
      } finally {
        if (!cancelled) {
          setApiBusy(false)
          onBootstrapSolicitudDone?.()
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    bootstrapSolicitudId,
    bootstrapAutoPrintPdf,
    fetchApi,
    applyPayload,
    onBootstrapSolicitudDone,
    handleImprimirGuardarPdf,
  ])

  const handleAdminCompletar = async () => {
    if (adminCompletarLockRef.current || apiBusy) return
    setApiError('')
    let fechaFinalIso = null
    if (!enviarInmediatamenteAdmin) {
      fechaFinalIso = isoFromFechaHoraLocal(fechaProg, horaProg)
      if (!fechaFinalIso) {
        setApiError('Fecha u hora no válida.')
        return
      }
    }
    if (!enviarTodos && !emailsLookValid(emailsList)) {
      setApiError('Correos no válidos o vacíos.')
      return
    }
    adminCompletarLockRef.current = true
    setApiBusy(true)
    try {
      let idCompletar = solicitudActivaId
      if (idCompletar == null) {
        const isoCrear = enviarInmediatamenteAdmin
          ? new Date().toISOString()
          : isoFromFechaHoraLocal(fechaProg, horaProg)
        if (!isoCrear) {
          setApiError('Fecha u hora no válida.')
          return
        }
        const created = await fetchApi('/api/email-envios', {
          method: 'POST',
          body: JSON.stringify({
            plantilla_id: plantilla.id,
            editor_tipo: editorTipoApi,
            payload: serializePayload(),
            enviar_todos: enviarTodos,
            destinatarios: enviarTodos ? '' : destinatariosCsv,
            fecha_hora_programada: isoCrear,
          }),
        })
        idCompletar = created?.id
        if (idCompletar == null || !Number.isFinite(Number(idCompletar))) {
          throw new Error('No se obtuvo id de solicitud al preparar el envío')
        }
      }
      await fetchApi(`/api/email-envios/${idCompletar}/completar`, {
        method: 'POST',
        body: JSON.stringify({
          payload: serializePayload(),
          enviar_inmediatamente: enviarInmediatamenteAdmin,
          fecha_hora_final: fechaFinalIso,
          enviar_todos: enviarTodos,
          destinatarios: enviarTodos ? '' : destinatariosCsv,
        }),
      })
      setStep('edit')
      setSolicitudActivaId(null)
      onVolverAlInicio?.()
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Error al completar')
    } finally {
      adminCompletarLockRef.current = false
      setApiBusy(false)
    }
  }

  const asideSharedTop = (
    <>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{editorHeading}</h2>
        {identityFromUrl ? (
          <p className="mt-1 text-[10px] leading-snug text-slate-500">
            Sesión API (URL): usuario <strong>{effectiveUserId}</strong> — rol{' '}
            <strong>
              {effectiveRole === 'admin'
                ? 'admin'
                : effectiveRole === 'administrativo'
                  ? 'administrativo'
                  : 'usuario'}
            </strong>
            . Otra pestaña puede usar otra
            URL con <code className="rounded bg-slate-100 px-0.5">?e1_uid=…&amp;e1_role=…</code>
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="email1-asunto-correo" className="mb-1 block text-xs font-medium text-slate-600">
          Asunto del correo
        </label>
        <input
          id="email1-asunto-correo"
          type="text"
          value={asuntoCorreo}
          onChange={(e) => setAsuntoCorreo(e.target.value)}
          placeholder="Ej.: Novedades de abril — ABC Logística"
          maxLength={500}
          className={INPUT_DT_CLASS}
          autoComplete="off"
        />
        <p className="mt-1 text-[10px] leading-snug text-slate-500">
          Este texto se usa como asunto al enviar el correo ({editorHeading}). Si lo dejas vacío, se
          usará el asunto por defecto del sistema.
        </p>
      </div>

      <label className="block text-xs font-medium text-slate-600">Fondo del correo</label>
      <div className="flex flex-wrap gap-2">
        {FONDO_CORREO_HEX.map((hex, i) => (
          <button
            key={hex}
            type="button"
            title={hex}
            onClick={() => setFondoCorreoIdx(i)}
            className={`h-9 w-9 rounded-lg border-2 shadow-sm transition ${
              fondoCorreoIdx === i ? 'border-violet-600 ring-2 ring-violet-200' : 'border-slate-200'
            }`}
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
    </>
  )

  const asideFondoCuadroImagen = (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">Fondo cuadro imagen</label>
      <div className="mb-2 rounded-lg border border-slate-200 bg-white p-2">
        <div
          className="h-16 w-16 rounded-xl border border-white/60 shadow-sm"
          style={{ backgroundColor: bgImg }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {FONDO_CUADRO_IMAGEN_HEX.map((hex, i) => (
          <button
            key={hex}
            type="button"
            title={hex}
            onClick={() => setImgBoxIdx(i)}
            className={`h-8 w-8 rounded-md border-2 ${
              imgBoxIdx === i ? 'border-violet-600 ring-2 ring-violet-200' : 'border-slate-200'
            }`}
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
    </div>
  )

  const asideBloqueIaImagen = (
    <>
      <EmailNanoBananaPromptField
        label="Instrucciones para la IA (imagen)"
        value={promptImagen}
        onChange={setPromptImagen}
        idSuffix="img"
      />
      <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-amber-50/50 p-3">
        <ImageGenCharactersWarning />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleGenerarImagenGemini()}
            disabled={generandoImagenGemini}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60"
          >
            {generandoImagenGemini ? 'Generando imagen…' : 'Generar imagen'}
          </button>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Zoom ({imagenGeminiSizePct}%): 100 llena el cuadro; más grande recorta bordes; más chico deja
            margen.
          </label>
          <input
            type="range"
            min={25}
            max={200}
            step={1}
            value={imagenGeminiSizePct}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10)
              setImagenGeminiSizePct(Number.isFinite(n) ? Math.min(200, Math.max(25, n)) : 100)
            }}
            className="w-full accent-slate-700"
          />
        </div>
        {imagenGeminiError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
            {imagenGeminiError}
          </p>
        ) : null}
      </div>
    </>
  )

  const asideNewsletter = (
    <>
      {asideSharedTop}
      <div>
        <label htmlFor="newsletter-fecha" className="mb-1 block text-xs font-medium text-slate-600">
          Fecha (cabecera)
        </label>
        <input
          id="newsletter-fecha"
          type="date"
          min={minDateStr}
          max={maxDateStr}
          value={newsletterFecha}
          onChange={(e) => setNewsletterFecha(e.target.value)}
          className={INPUT_DT_CLASS}
        />
        <span className="mb-1 mt-2 block text-xs font-medium text-slate-600">Color de la fecha</span>
        <div className="flex flex-wrap gap-2">
          {FONDO_CUADRO_IMAGEN_HEX.map((hex, i) => (
            <button
              key={`nf-${hex}`}
              type="button"
              title={hex}
              onClick={() => setNewsletterFechaColorIdx(i)}
              className={`h-8 w-8 rounded-md border-2 ${
                newsletterFechaColorIdx === i
                  ? 'border-violet-600 ring-2 ring-violet-200'
                  : 'border-slate-200'
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="newsletter-titulo" className="mb-1 block text-xs font-medium text-slate-600">
          Título (una línea)
        </label>
        <input
          id="newsletter-titulo"
          type="text"
          value={newsletterTitulo}
          onChange={(e) => setNewsletterTitulo(e.target.value)}
          placeholder="Ej.: Lo más destacado del mes"
          maxLength={200}
          className={INPUT_DT_CLASS}
          autoComplete="off"
        />
        <span className="mb-1 mt-2 block text-xs font-medium text-slate-600">Color del título</span>
        <div className="flex flex-wrap gap-2">
          {TEXTO_MARCA_HEX.map((hex, i) => (
            <button
              key={`nt-${hex}`}
              type="button"
              title={hex}
              onClick={() => setNewsletterTituloColorIdx(i)}
              className={`h-8 w-8 rounded-md border-2 ${
                newsletterTituloColorIdx === i
                  ? 'border-violet-600 ring-2 ring-violet-200'
                  : 'border-slate-200'
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      </div>
      <RichTextEmailField
        label="Texto"
        value={cuerpo1Html}
        onChange={(v) => setCuerpo1Html(v)}
        colors={TEXTO_MARCA_HEX}
        placeholder="Cuerpo del mensaje…"
      />
      <EmailCtaAsideBlock
        alwaysOn
        enabled={ctaAfter1Enabled}
        onEnabledChange={setCtaAfter1Enabled}
        colorIdx={ctaAfter1ColorIdx}
        onColorIdxChange={setCtaAfter1ColorIdx}
        text={ctaAfter1Text}
        onTextChange={setCtaAfter1Text}
        url={ctaAfter1Url}
        onUrlChange={setCtaAfter1Url}
        fontSizePx={ctaAfter1FontSizePx}
        onFontSizeChange={setCtaAfter1FontSizePx}
        align={ctaAfter1Align}
        onAlignChange={setCtaAfter1Align}
      />
      {asideFondoCuadroImagen}
      <RichTextEmailField
        label="Footer (texto enriquecido)"
        value={footerHtml}
        onChange={(v) => setFooterHtml(v)}
        colors={TEXTO_MARCA_HEX}
        placeholder="Legal, contacto..."
      />
      {asideBloqueIaImagen}
    </>
  )

  const asideEmail1 = (
    <>
      {asideSharedTop}
      <RichTextEmailField
        label="Texto 1"
        value={cuerpo1Html}
        onChange={(v) => setCuerpo1Html(v)}
        colors={TEXTO_MARCA_HEX}
        placeholder="Primer bloque de texto…"
      />
      <EmailCtaAsideBlock
        enabled={ctaAfter1Enabled}
        onEnabledChange={setCtaAfter1Enabled}
        colorIdx={ctaAfter1ColorIdx}
        onColorIdxChange={setCtaAfter1ColorIdx}
        text={ctaAfter1Text}
        onTextChange={setCtaAfter1Text}
        url={ctaAfter1Url}
        onUrlChange={setCtaAfter1Url}
        fontSizePx={ctaAfter1FontSizePx}
        onFontSizeChange={setCtaAfter1FontSizePx}
        align={ctaAfter1Align}
        onAlignChange={setCtaAfter1Align}
      />
      {asideFondoCuadroImagen}
      {asideBloqueIaImagen}
      <RichTextEmailField
        label="Texto 2"
        value={cuerpo2Html}
        onChange={(v) => setCuerpo2Html(v)}
        colors={TEXTO_MARCA_HEX}
        placeholder="Segundo bloque de texto…"
      />
      <EmailCtaAsideBlock
        enabled={ctaAfter2Enabled}
        onEnabledChange={setCtaAfter2Enabled}
        colorIdx={ctaAfter2ColorIdx}
        onColorIdxChange={setCtaAfter2ColorIdx}
        text={ctaAfter2Text}
        onTextChange={setCtaAfter2Text}
        url={ctaAfter2Url}
        onUrlChange={setCtaAfter2Url}
        fontSizePx={ctaAfter2FontSizePx}
        onFontSizeChange={setCtaAfter2FontSizePx}
        align={ctaAfter2Align}
        onAlignChange={setCtaAfter2Align}
      />
      <RichTextEmailField
        label="Footer (texto enriquecido)"
        value={footerHtml}
        onChange={(v) => setFooterHtml(v)}
        colors={TEXTO_MARCA_HEX}
        placeholder="Legal, contacto..."
      />
    </>
  )

  const asideEditorial = variant === 'newsletter' ? asideNewsletter : asideEmail1

  const asideSchedule = (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleVolverSchedule}
        className="text-sm font-medium text-violet-700 hover:underline"
      >
        ← Volver al diseño
      </button>

      <div className="space-y-4">
      {!(effectiveCanSelfSchedule && enviarInmediatamenteAdmin) ? (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Fecha de envío</label>
            <input
              type="date"
              min={minDateStr}
              max={maxDateStr}
              value={fechaProg}
              onChange={(e) => setFechaProg(e.target.value)}
              className={INPUT_DT_CLASS}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Hora</label>
            <input
              type="time"
              value={horaProg}
              onChange={(e) => setHoraProg(e.target.value)}
              className={INPUT_DT_CLASS}
            />
          </div>
        </>
      ) : null}

      {effectiveCanSelfSchedule ? (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={enviarInmediatamenteAdmin}
            onChange={(e) => setEnviarInmediatamenteAdmin(e.target.checked)}
          />
          Enviar inmediatamente
        </label>
      ) : null}

      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={enviarTodos}
          onChange={(e) => setEnviarTodos(e.target.checked)}
        />
        Enviar a todos
      </label>

      {!enviarTodos ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Correos (separados por comas)
          </label>
          <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
            <input
              ref={importContactsInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              aria-label="Importar contactos desde CSV"
              onChange={handleImportContactsChange}
            />
            <button
              type="button"
              onClick={() => importContactsInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Upload className="h-4 w-4 shrink-0" />
              Importar contactos
            </button>
            <span className="text-[10px] leading-snug text-slate-500">
              Elige un .csv o .txt: se detectan correos en el archivo y se añaden a la lista (sin
              duplicar).
            </span>
          </div>
          <textarea
            value={destinatariosCsv}
            onChange={(e) => setDestinatariosCsv(e.target.value)}
            rows={4}
            placeholder="uno@empresa.com, otro@empresa.com"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-violet-500/20 focus:ring-2"
          />
        </div>
      ) : null}

      {apiError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
          {apiError}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-slate-200 pt-3">
        {effectiveCanSelfSchedule ? (
          <button
            type="button"
            onClick={handleImprimirGuardarPdf}
            disabled={apiBusy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Guardar PDF (imprimir)
          </button>
        ) : null}

        {effectiveCanSelfSchedule ? (
          <button
            type="button"
            disabled={apiBusy || !puedeEnviarRevisionUsuario}
            onClick={() => void handleAdminCompletar()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
          >
            {enviarInmediatamenteAdmin ? 'Enviar inmediatamente' : 'Programar'}
          </button>
        ) : (
          <button
            type="button"
            disabled={apiBusy || !puedeEnviarRevisionUsuario}
            onClick={() => void handleEnviarRevision()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
          >
            Enviar a revisión
          </button>
        )}
      </div>
      </div>
    </div>
  )

  const previewBlock = (
    <div
      className="email1-preview-canvas min-h-[480px] flex-1 overflow-auto rounded-xl"
      style={{ backgroundColor: fondoCorreo }}
    >
      <div className="flex min-h-full w-full items-center justify-center p-6">
        <div
          ref={previewCardRef}
          className="email1-print-area w-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-md transition-[max-width] duration-200"
          style={{
            maxWidth: anchoCard,
            borderRadius: 16,
          }}
        >
          <div
            className={
              variant === 'newsletter'
                ? 'flex w-full items-center justify-center border-b border-slate-100 px-6 py-0'
                : 'flex w-full items-center justify-center border-b border-slate-100 px-6 py-4'
            }
          >
            <img
              src={logoSrc}
              alt="ABC Logística"
              className={
                variant === 'newsletter'
                  ? 'mx-auto h-[102px] w-auto max-w-[min(390px,92%)] object-contain object-center'
                  : 'mx-auto h-[52px] w-auto max-w-[min(290px,92%)] object-contain object-center'
              }
            />
          </div>

          {variant === 'newsletter' ? (
            <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2 sm:gap-3">
              <div className="min-w-0 space-y-3">
                {newsletterFechaDisplay ? (
                  <p
                    className="text-[13px] font-semibold capitalize leading-snug"
                    style={{ color: newsletterFechaHex, fontFamily: 'Verdana, Geneva, sans-serif' }}
                  >
                    {newsletterFechaDisplay}
                  </p>
                ) : null}
                {newsletterTitulo.trim() ? (
                  <h2
                    className="text-xl font-black leading-tight"
                    style={{
                      color: newsletterTituloHex,
                      fontFamily: "'Nunito Sans', Verdana, Geneva, sans-serif",
                    }}
                  >
                    {newsletterTitulo.trim()}
                  </h2>
                ) : null}
                {showBlock1 ? (
                  <div
                    className={EMAIL_RICH_PREVIEW_BODY}
                    style={{ fontFamily: 'Verdana, Geneva, sans-serif' }}
                    dangerouslySetInnerHTML={{ __html: previewInner1 }}
                  />
                ) : null}
                <div className={`flex w-full pt-1 ${ctaPreviewJustify(ctaAfter1Align)}`}>
                  {cta1Href ? (
                    <a
                      href={cta1Href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded-[30px] px-5 py-3.5 text-center no-underline"
                      style={{
                        backgroundColor: cta1Bg,
                        color: '#ffffff',
                        fontFamily: "'Nunito Sans', Verdana, Geneva, sans-serif",
                        fontWeight: 900,
                        fontSize: clampCtaFontSizePx(ctaAfter1FontSizePx),
                        lineHeight: 1.25,
                      }}
                    >
                      {ctaAfter1Text.trim() || 'Botón'}
                    </a>
                  ) : (
                    <span
                      className="inline-block rounded-[30px] px-5 py-3.5 text-center opacity-60"
                      style={{
                        backgroundColor: cta1Bg,
                        color: '#ffffff',
                        fontFamily: "'Nunito Sans', Verdana, Geneva, sans-serif",
                        fontWeight: 900,
                        fontSize: clampCtaFontSizePx(ctaAfter1FontSizePx),
                        lineHeight: 1.25,
                      }}
                    >
                      {ctaAfter1Text.trim() || 'Botón'}
                    </span>
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <div
                  className="relative aspect-square w-full max-w-[268px] overflow-hidden rounded-2xl sm:max-w-none sm:justify-self-end"
                  style={{ backgroundColor: bgImg }}
                >
                  {imagenGeminiUrl ? (
                    <div className="absolute inset-0 overflow-hidden rounded-2xl">
                      <img
                        src={imagenGeminiUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover object-center"
                        style={{
                          transform: `scale(${imagenGeminiSizePct / 100})`,
                          transformOrigin: 'center center',
                        }}
                      />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-center text-[11px] font-medium text-slate-700/70">
                      Ilustración Gemini PNG
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 px-6 py-5">
              {showBlock1 && (
                <div
                  className={EMAIL_RICH_PREVIEW_BODY}
                  style={{ fontFamily: 'Verdana, Geneva, sans-serif' }}
                  dangerouslySetInnerHTML={{ __html: previewInner1 }}
                />
              )}

              {showCta1Preview && cta1Href ? (
                <div className={`mt-5 flex w-full pb-5 ${ctaPreviewJustify(ctaAfter1Align)}`}>
                  <a
                    href={cta1Href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-[30px] px-5 py-3.5 text-center no-underline"
                    style={{
                      backgroundColor: cta1Bg,
                      color: '#ffffff',
                      fontFamily: "'Nunito Sans', Verdana, Geneva, sans-serif",
                      fontWeight: 900,
                      fontSize: clampCtaFontSizePx(ctaAfter1FontSizePx),
                      lineHeight: 1.25,
                    }}
                  >
                    {ctaAfter1Text.trim()}
                  </a>
                </div>
              ) : null}

              <div
                className="relative w-full min-h-[170px] overflow-hidden rounded-2xl"
                style={{ backgroundColor: bgImg }}
              >
                {imagenGeminiUrl ? (
                  <div className="absolute inset-0 overflow-hidden rounded-2xl">
                    <img
                      src={imagenGeminiUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover object-center"
                      style={{
                        transform: `scale(${imagenGeminiSizePct / 100})`,
                        transformOrigin: 'center center',
                      }}
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex min-h-[170px] items-center justify-center text-center text-[11px] font-medium text-slate-700/70">
                    Ilustración Gemini PNG
                  </div>
                )}
              </div>

              {showBlock2 && (
                <div
                  className={EMAIL_RICH_PREVIEW_BODY}
                  style={{ fontFamily: 'Verdana, Geneva, sans-serif' }}
                  dangerouslySetInnerHTML={{ __html: previewInner2 }}
                />
              )}

              {showCta2Preview && cta2Href ? (
                <div className={`mt-5 flex w-full pb-5 ${ctaPreviewJustify(ctaAfter2Align)}`}>
                  <a
                    href={cta2Href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-[30px] px-5 py-3.5 text-center no-underline"
                    style={{
                      backgroundColor: cta2Bg,
                      color: '#ffffff',
                      fontFamily: "'Nunito Sans', Verdana, Geneva, sans-serif",
                      fontWeight: 900,
                      fontSize: clampCtaFontSizePx(ctaAfter2FontSizePx),
                      lineHeight: 1.25,
                    }}
                  >
                    {ctaAfter2Text.trim()}
                  </a>
                </div>
              ) : null}
            </div>
          )}

          <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-4">
            {showFooter && (
              <div
                className={EMAIL_RICH_PREVIEW_FOOTER}
                style={{ fontFamily: 'Verdana, Geneva, sans-serif' }}
                dangerouslySetInnerHTML={{ __html: previewFoot }}
              />
            )}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
              {EMAIL1_SOCIAL_LINKS.map(({ id, url, label, previewSvgUrl }) => (
                <a
                  key={id}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded focus-visible:outline focus-visible:ring-2 focus-visible:ring-violet-400"
                  aria-label={label}
                  title={label}
                >
                  <img
                    src={previewSvgUrl}
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 shrink-0 object-contain opacity-[0.55] transition-opacity group-hover:opacity-[0.85]"
                    aria-hidden
                  />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:w-[380px] lg:self-start">
        {step === 'edit' ? asideEditorial : asideSchedule}
      </aside>

      <section className="email1-print-section flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
        <div className="email1-print-hide mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Vista previa
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setVistaPreview('desktop')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  vistaPreview === 'desktop'
                    ? 'bg-violet-100 text-violet-900'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Monitor className="h-4 w-4" />
                Escritorio
              </button>
              <button
                type="button"
                onClick={() => setVistaPreview('mobile')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  vistaPreview === 'mobile'
                    ? 'bg-violet-100 text-violet-900'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Smartphone className="h-4 w-4" />
                Móvil
              </button>
            </div>
            {step === 'edit' ? (
              <button
                type="button"
                onClick={handleContinuarDesdeEdit}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Continuar
              </button>
            ) : null}
          </div>
        </div>

        {step === 'edit' ? (
          <p className="email1-print-hide mb-2 text-[11px] leading-snug text-slate-500">
            {effectiveCanSelfSchedule && solicitudActivaId != null
              ? 'Revisa y edita el correo. Después pulsa Continuar para programar o enviar.'
              : effectiveCanSelfSchedule
                ? 'Pulsa Continuar para programar o enviar inmediatamente (sin enviar a revisión).'
                : solicitudActivaId != null
                  ? 'Pulsa Continuar para actualizar fecha, hora y destinatarios, y guardar de nuevo en revisión.'
                  : 'Pulsa Continuar para elegir fecha, hora y destinatarios, y enviar a revisión.'}
          </p>
        ) : null}

        {previewBlock}

        {step === 'edit' && promptImagen.trim() ? (
          <p className="email1-print-hide mt-2 text-xs text-amber-800/90">
            <strong>IA (borrador):</strong> {promptImagen.trim().slice(0, 200)}
            {promptImagen.length > 200 ? '…' : ''}
          </p>
        ) : null}
      </section>
    </div>
  )
}
