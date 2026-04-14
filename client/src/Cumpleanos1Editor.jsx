import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Monitor, Printer, Smartphone, Trash2, Upload } from 'lucide-react'
import { EMAIL1_SOCIAL_LINKS } from './email1SocialLinks.js'
import { readEmail1IdentityFromSearch } from './email1Identity.js'
import { FONDO_CORREO_HEX, FONDO_CUADRO_IMAGEN_HEX, TEXTO_MARCA_HEX } from './emailPalettes'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { htmlOrPlainToPreview } from './utils/sanitizeEmailHtml'
import RichTextEmailField from './RichTextEmailField.jsx'
import ImageGenCharactersWarning from './ImageGenCharactersWarning.jsx'
import EmailCtaAsideBlock from './EmailCtaAsideBlock.jsx'
import EmailEnvioPruebaAside from './EmailEnvioPruebaAside.jsx'
import {
  clampCtaFontSizePx,
  isEmail1CtaPreviewVisible,
  sanitizeCtaHttpUrl,
} from './email1CtaUtils.js'
import { EMAIL_RICH_PREVIEW_BODY, EMAIL_RICH_PREVIEW_FOOTER } from './emailRichTextClasses.js'
import { postProcessRecoTarjetaImageDataUrl } from './utils/reconocimientosTarjetaImageBg.js'

const MAX_TARJETAS_TABLA = 30

const ACCENT_PALETTE_HEX = [
  '#008da8',
  '#003b49',
  '#5aba47',
  '#f9a05c',
  '#cd4a9b',
  '#ef3842',
]

const NOMBRE_TABLA_COLOR = '#003b49'

/** Acento fijo (tabla y título); ya no hay selector de color en el panel. */
const ACCENT_FIJO = ACCENT_PALETTE_HEX[0]

const HERO_BG_BLANCO = '#ffffff'

/** Mismo fondo que la tarjeta Reconocimientos en vista previa / HTML (#f8fafc ≈ slate-50). */
const RECO_TARJETA_IMAGEN_BG = '#f8fafc'

/** Prefijo enviado a la IA: fondo siempre blanco puro. */
const PROMPT_HERO_BLANCO_PREFIX =
  'The entire image background must be solid pure white #ffffff rgb(255,255,255) only—no gradients, textures, patterns, grey, cream, or transparency. All illustration sits on this white ground. Subject and style: '

/** Prefijo para imagen IA de tarjeta Reconocimientos: mismo gris que el cuadro (no blanco). */
const PROMPT_RECO_TARJETA_BG_PREFIX =
  'The entire image background must be one flat opaque fill only, exact color #f8fafc rgb(248,250,252) only—no gradients, textures, patterns, white, cream, or transparency. All illustration sits on this exact ground. Subject and style: '

/** Misma tabla que aniversarios (Desde / Nombre / Área) en vista previa. */
function esVarianteTablaAniversarios(variant) {
  return variant === 'aniversarios' || variant === 'reconocimientos'
}

function normalizeRecoTarjeta(raw) {
  const t = raw && typeof raw === 'object' ? raw : {}
  return {
    nombre: typeof t.nombre === 'string' ? t.nombre : '',
    area: typeof t.area === 'string' ? t.area : '',
    textoTarjetaHtml: typeof t.textoTarjetaHtml === 'string' ? t.textoTarjetaHtml : '<p></p>',
    promptImagenTarjeta: typeof t.promptImagenTarjeta === 'string' ? t.promptImagenTarjeta : '',
    imagenTarjetaUrl: typeof t.imagenTarjetaUrl === 'string' ? t.imagenTarjetaUrl : '',
    imagenTarjetaSizePct:
      typeof t.imagenTarjetaSizePct === 'number' && Number.isFinite(t.imagenTarjetaSizePct)
        ? Math.min(200, Math.max(25, t.imagenTarjetaSizePct))
        : 100,
  }
}

function tarjetaVacia(variant) {
  if (variant === 'reconocimientos') {
    return normalizeRecoTarjeta({})
  }
  if (variant === 'aniversarios') {
    return { nombre: '', desde: '', area: '' }
  }
  return { fecha: '', nombre: '' }
}

/** Fecha local YYYY-MM-DD sin desfase UTC */
function parseDesdeLocal(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return null
  const [y, m, d] = String(ymd).split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Años completos de antigüedad desde Desde hasta hoy (fecha de envío / vista previa). Se recalcula con la fecha actual del navegador. */
function añosCompletadosHastaHoy(desdeStr) {
  const start = parseDesdeLocal(desdeStr)
  if (!start) return null
  const now = new Date()
  let years = now.getFullYear() - start.getFullYear()
  const m = now.getMonth() - start.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < start.getDate())) years -= 1
  return years >= 0 ? years : null
}

function formatDesdeHumano(ymd) {
  const d = parseDesdeLocal(ymd)
  if (!d) return ''
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const API_BASE =
  import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '')

function mediaUrl(ruta) {
  if (!ruta) return ''
  const clean = String(ruta).replace(/^\//, '')
  return `${API_BASE}/media/plantillas/${clean}`
}

function hasText(s) {
  const t = String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim()
  return t.length > 0
}

const INPUT_DT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-violet-500/20 focus:ring-2'

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

function pdfFileBaseName(plantilla, variant) {
  const raw = plantilla?.id_externo || 'preview'
  const sinTpl = String(raw).replace(/^tpl_/i, '')
  const slug =
    variant === 'aniversarios'
      ? 'aniversarios-1'
      : variant === 'reconocimientos'
        ? 'reconocimientos-1'
        : 'cumpleanos-1'
  return `${slug}-${sinTpl}`
}

export default function Cumpleanos1Editor({
  plantilla,
  variant = 'cumpleanos',
  userId = 1,
  role: roleProp = 'user',
  forceSelfSchedule = false,
  bootstrapSolicitudId = null,
  bootstrapAutoPrintPdf = false,
  onBootstrapSolicitudDone,
  onVolverAlInicio,
}) {
  const idn = readEmail1IdentityFromSearch(userId, roleProp)
  const effectiveCanSelfSchedule = Boolean(forceSelfSchedule) || idn.canSelfSchedule
  const effectiveUserId = idn.userId
  const effectiveRole = idn.role
  const identityFromUrl = idn.fromUrl

  const editorTipoApi =
    variant === 'aniversarios'
      ? 'aniversarios_1'
      : variant === 'reconocimientos'
        ? 'reconocimientos_1'
        : 'cumpleanos_1'

  const accentColor = ACCENT_FIJO
  const [step, setStep] = useState('edit')
  const [asuntoCorreo, setAsuntoCorreo] = useState('')
  const [fondoCorreoIdx, setFondoCorreoIdx] = useState(0)
  const [titulo, setTitulo] = useState('')
  const [cuerpoHtml, setCuerpoHtml] = useState('<p></p>')
  const [ctaAfter1Enabled, setCtaAfter1Enabled] = useState(false)
  const [ctaAfter1ColorIdx, setCtaAfter1ColorIdx] = useState(0)
  const [ctaAfter1Text, setCtaAfter1Text] = useState('')
  const [ctaAfter1Url, setCtaAfter1Url] = useState('')
  const [ctaAfter1FontSizePx, setCtaAfter1FontSizePx] = useState(18)
  const [ctaAfter1Align, setCtaAfter1Align] = useState('center')
  const [footerHtml, setFooterHtml] = useState('<p></p>')
  const [tablaTarjetas, setTablaTarjetas] = useState(() => [tarjetaVacia(variant)])

  /** Solo URLs de imagen: al cargar borradores con fondo blanco de Gemini, normalizar una vez a #f8fafc. */
  const recoTarjetaDataUrlsKey =
    variant === 'reconocimientos'
      ? tablaTarjetas.map((t) => String(t.imagenTarjetaUrl || '')).join('\f')
      : ''

  useEffect(() => {
    if (!recoTarjetaDataUrlsKey) return
    let cancelled = false
    void (async () => {
      const updates = []
      for (let idx = 0; idx < tablaTarjetas.length; idx += 1) {
        const u = tablaTarjetas[idx]?.imagenTarjetaUrl
        if (!u || !String(u).startsWith('data:')) continue
        try {
          const out = await postProcessRecoTarjetaImageDataUrl(u)
          if (out !== u) updates.push({ idx, out })
        } catch {
          /* ignore */
        }
      }
      if (cancelled || updates.length === 0) return
      setTablaTarjetas((prev) => {
        let changed = false
        const next = prev.map((row, i) => {
          const hit = updates.find((x) => x.idx === i)
          if (!hit) return row
          if (row.imagenTarjetaUrl === hit.out) return row
          changed = true
          return { ...row, imagenTarjetaUrl: hit.out }
        })
        return changed ? next : prev
      })
    })()
    return () => {
      cancelled = true
    }
    // recoTarjetaDataUrlsKey ya refleja solo URLs; no depender de tablaTarjetas completa (evita loop al teclear).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tablaTarjetas leído al disparar el efecto por cambio de URL
  }, [recoTarjetaDataUrlsKey, variant])

  const [promptImagenHero, setPromptImagenHero] = useState('')
  const [imagenHeroUrl, setImagenHeroUrl] = useState('')
  const [imagenHeroSizePct, setImagenHeroSizePct] = useState(100)
  const [generandoHero, setGenerandoHero] = useState(false)
  const [errorHero, setErrorHero] = useState('')

  const [generandoTarjetaIdx, setGenerandoTarjetaIdx] = useState(null)
  const [errorTarjetaGen, setErrorTarjetaGen] = useState('')

  const [vistaPreview, setVistaPreview] = useState('desktop')
  const previewCardRef = useRef(null)
  const printTitleBeforeRef = useRef(null)
  const importContactsInputRef = useRef(null)

  const def = useMemo(() => defaultDateStrings(), [])
  const [fechaProg, setFechaProg] = useState(def.fecha)
  const [horaProg, setHoraProg] = useState(def.hora)
  const [enviarTodos, setEnviarTodos] = useState(true)
  const [destinatariosCsv, setDestinatariosCsv] = useState('')
  const [enviarInmediatamenteAdmin, setEnviarInmediatamenteAdmin] = useState(false)
  const [solicitudActivaId, setSolicitudActivaId] = useState(null)
  const [apiError, setApiError] = useState('')
  const [apiBusy, setApiBusy] = useState(false)
  const [correosPruebaCsv, setCorreosPruebaCsv] = useState('')
  const [testOkMessage, setTestOkMessage] = useState('')

  const dCuerpo = useDebouncedValue(cuerpoHtml, 220)
  const dFoot = useDebouncedValue(footerHtml, 280)
  const previewCuerpo = useMemo(() => htmlOrPlainToPreview(dCuerpo), [dCuerpo])
  const previewFoot = useMemo(() => htmlOrPlainToPreview(dFoot), [dFoot])

  const fondoCorreo = FONDO_CORREO_HEX[fondoCorreoIdx] ?? FONDO_CORREO_HEX[0]

  const showCuerpo = hasText(cuerpoHtml)
  const showFooter = hasText(dFoot)

  const showCta1Preview = useMemo(
    () => isEmail1CtaPreviewVisible(ctaAfter1Enabled, ctaAfter1Text, ctaAfter1Url),
    [ctaAfter1Enabled, ctaAfter1Text, ctaAfter1Url]
  )
  const cta1Bg = FONDO_CUADRO_IMAGEN_HEX[ctaAfter1ColorIdx] ?? FONDO_CUADRO_IMAGEN_HEX[0]
  const cta1Href = sanitizeCtaHttpUrl(ctaAfter1Url)

  const anchoCard = vistaPreview === 'mobile' ? 'min(100%, 360px)' : 'min(100%, 600px)'

  const heading =
    variant === 'aniversarios'
      ? 'Aniversarios'
      : variant === 'reconocimientos'
        ? 'Reconocimientos'
        : 'Cumpleaños'

  const logoRuta = useMemo(() => {
    try {
      const raw = plantilla?.definicion
      const d = typeof raw === 'string' ? JSON.parse(raw) : raw
      return d?.cumpleanos?.logoRuta || d?.email1?.logoRuta || 'miniaturas/logo-abc-logistica.svg'
    } catch {
      return 'miniaturas/logo-abc-logistica.svg'
    }
  }, [plantilla])

  const logoSrc = mediaUrl(logoRuta)

  const minDateStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
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
        const msg = typeof data?.error === 'string' ? data.error : txt || res.statusText
        throw new Error(msg)
      }
      return data
    },
    [authHeaders]
  )

  const serializePayload = useCallback(
    () => ({
      asuntoCorreo,
      fondoCorreoIdx,
      titulo,
      cuerpoHtml,
      ctaAfter1Enabled,
      ctaAfter1ColorIdx,
      ctaAfter1Text,
      ctaAfter1Url,
      ctaAfter1FontSizePx,
      ctaAfter1Align,
      footerHtml,
      tablaTarjetas,
      promptImagenHero,
      imagenHeroUrl,
      imagenHeroSizePct,
      vistaPreview,
    }),
    [
      asuntoCorreo,
      fondoCorreoIdx,
      titulo,
      cuerpoHtml,
      ctaAfter1Enabled,
      ctaAfter1ColorIdx,
      ctaAfter1Text,
      ctaAfter1Url,
      ctaAfter1FontSizePx,
      ctaAfter1Align,
      footerHtml,
      tablaTarjetas,
      promptImagenHero,
      imagenHeroUrl,
      imagenHeroSizePct,
      vistaPreview,
    ]
  )

  const applyPayload = useCallback((p) => {
    if (!p || typeof p !== 'object') return
    setAsuntoCorreo(typeof p.asuntoCorreo === 'string' ? p.asuntoCorreo : '')
    if (typeof p.fondoCorreoIdx === 'number') setFondoCorreoIdx(p.fondoCorreoIdx)
    if (typeof p.titulo === 'string') setTitulo(p.titulo)
    if (typeof p.cuerpoHtml === 'string') setCuerpoHtml(p.cuerpoHtml)
    if (typeof p.ctaAfter1Enabled === 'boolean') setCtaAfter1Enabled(p.ctaAfter1Enabled)
    if (typeof p.ctaAfter1ColorIdx === 'number') setCtaAfter1ColorIdx(p.ctaAfter1ColorIdx)
    if (typeof p.ctaAfter1Text === 'string') setCtaAfter1Text(p.ctaAfter1Text)
    if (typeof p.ctaAfter1Url === 'string') setCtaAfter1Url(p.ctaAfter1Url)
    if (typeof p.ctaAfter1FontSizePx === 'number') setCtaAfter1FontSizePx(p.ctaAfter1FontSizePx)
    if (p.ctaAfter1Align === 'left' || p.ctaAfter1Align === 'center' || p.ctaAfter1Align === 'right') {
      setCtaAfter1Align(p.ctaAfter1Align)
    }
    if (typeof p.footerHtml === 'string') setFooterHtml(p.footerHtml)
    if (Array.isArray(p.tablaTarjetas)) {
      if (variant === 'reconocimientos') {
        setTablaTarjetas(p.tablaTarjetas.map((row) => normalizeRecoTarjeta(row)))
      } else {
        setTablaTarjetas(p.tablaTarjetas)
      }
    }
    if (typeof p.promptImagenHero === 'string') setPromptImagenHero(p.promptImagenHero)
    if (typeof p.imagenHeroUrl === 'string') setImagenHeroUrl(p.imagenHeroUrl)
    if (typeof p.imagenHeroSizePct === 'number') setImagenHeroSizePct(p.imagenHeroSizePct)
    if (p.vistaPreview === 'desktop' || p.vistaPreview === 'mobile') setVistaPreview(p.vistaPreview)
  }, [variant])

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

  const prepareScheduleDefaults = useCallback(() => {
    if (!effectiveCanSelfSchedule || solicitudActivaId == null) {
      const { fecha, hora } = defaultDateStrings()
      setFechaProg(fecha)
      setHoraProg(hora)
      setEnviarTodos(true)
      setDestinatariosCsv('')
    }
    setEnviarInmediatamenteAdmin(false)
  }, [effectiveCanSelfSchedule, solicitudActivaId])

  const handleContinuarDesdeEdit = () => {
    setApiError('')
    setTestOkMessage('')
    prepareScheduleDefaults()
    setStep('review')
  }

  const handleContinuarFromReview = () => {
    setApiError('')
    setTestOkMessage('')
    setStep('schedule')
  }

  const handleVolverReview = () => {
    setStep('edit')
    setApiError('')
    setTestOkMessage('')
  }

  const handleVolverSchedule = () => {
    setStep('review')
    setApiError('')
    setTestOkMessage('')
  }

  const handleEnviarPrueba = async () => {
    setApiError('')
    setTestOkMessage('')
    const list = parseEmailsCsv(correosPruebaCsv)
    if (!emailsLookValid(list)) {
      setApiError('Indica uno o más correos válidos separados por comas.')
      return
    }
    setApiBusy(true)
    try {
      await fetchApi('/api/email-envios/enviar-prueba', {
        method: 'POST',
        body: JSON.stringify({
          editor_tipo: editorTipoApi,
          plantilla_id: plantilla.id,
          payload: serializePayload(),
          destinatarios: correosPruebaCsv.trim(),
          solicitud_id: solicitudActivaId ?? undefined,
        }),
      })
      setTestOkMessage('Correo de prueba enviado. Revisa la bandeja de los destinatarios.')
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Error al enviar')
    } finally {
      setApiBusy(false)
    }
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
        if (row.editor_tipo && row.editor_tipo !== editorTipoApi) {
          setApiError('Esta solicitud es de otro editor.')
          return
        }
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
    editorTipoApi,
    fetchApi,
    applyPayload,
    onBootstrapSolicitudDone,
    handleImprimirGuardarPdf,
  ])

  const handleAdminCompletar = async () => {
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
      setApiBusy(false)
    }
  }

  const handleGenerarImagenHero = async () => {
    setErrorHero('')
    const texto = String(promptImagenHero || '').trim()
    if (!texto) {
      setErrorHero('Escribe una descripción para la imagen.')
      return
    }
    setGenerandoHero(true)
    try {
      const promptCompleto = `${PROMPT_HERO_BLANCO_PREFIX}${texto}`
      const res = await fetch(`${API_BASE}/api/nano-banana/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratio: '16_9',
          nonce: Date.now(),
          prompt: promptCompleto,
          backgroundHex: HERO_BG_BLANCO,
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
      setImagenHeroUrl(String(data.imageUrl))
    } catch (err) {
      setErrorHero(err instanceof Error ? err.message : 'No se pudo generar la imagen')
    } finally {
      setGenerandoHero(false)
    }
  }

  const canAdd = tablaTarjetas.length < MAX_TARJETAS_TABLA

  const agregarTarjeta = () => {
    setTablaTarjetas((prev) => {
      if (prev.length >= MAX_TARJETAS_TABLA) return prev
      return [...prev, tarjetaVacia(variant)]
    })
  }

  const actualizarTarjeta = (idx, patch) => {
    setTablaTarjetas((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)))
  }

  const eliminarTarjeta = (idx) => {
    setTablaTarjetas((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== idx)
    })
  }

  const handleGenerarImagenTarjeta = async (idx, promptText) => {
    setErrorTarjetaGen('')
    const texto = String(promptText || '').trim()
    if (!texto) {
      setErrorTarjetaGen('Escribe una descripción para la imagen.')
      return
    }
    setGenerandoTarjetaIdx(idx)
    try {
      const esReco = variant === 'reconocimientos'
      const bgHex = esReco ? RECO_TARJETA_IMAGEN_BG : HERO_BG_BLANCO
      const prefijo = esReco ? PROMPT_RECO_TARJETA_BG_PREFIX : PROMPT_HERO_BLANCO_PREFIX
      const promptCompleto = `${prefijo}${texto}`
      const res = await fetch(`${API_BASE}/api/nano-banana/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratio: '1_1',
          nonce: Date.now(),
          prompt: promptCompleto,
          backgroundHex: bgHex,
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
      let url = String(data.imageUrl)
      if (esReco) {
        try {
          url = await postProcessRecoTarjetaImageDataUrl(url)
        } catch {
          /* mantener url de la API */
        }
      }
      actualizarTarjeta(idx, { imagenTarjetaUrl: url })
    } catch (err) {
      setErrorTarjetaGen(err instanceof Error ? err.message : 'No se pudo generar la imagen')
    } finally {
      setGenerandoTarjetaIdx(null)
    }
  }

  const tdNumStyle = {
    borderColor: accentColor,
    color: accentColor,
    fontFamily: '"Nunito Sans", sans-serif',
    fontWeight: 900,
    fontSize: '22px',
  }

  const tdNombreStyle = {
    borderColor: accentColor,
    color: NOMBRE_TABLA_COLOR,
  }

  const esAniversarios = esVarianteTablaAniversarios(variant)

  const asideReview = (
    <EmailEnvioPruebaAside
      onVolverEdit={handleVolverReview}
      onContinuarEnvio={handleContinuarFromReview}
      correosPrueba={correosPruebaCsv}
      onCorreosPruebaChange={setCorreosPruebaCsv}
      onEnviarPrueba={() => void handleEnviarPrueba()}
      apiError={apiError}
      apiBusy={apiBusy}
      testOkMessage={testOkMessage}
    />
  )

  const asideSchedule = (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleVolverSchedule}
        className="text-sm font-medium text-violet-700 hover:underline"
      >
        ← Volver a revisión
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
              disabled={apiBusy}
              onClick={handleImprimirGuardarPdf}
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

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:w-[380px] lg:self-start">
        {step === 'edit' ? (
          <>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{heading}</h2>
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
                  . <code className="rounded bg-slate-100 px-0.5">?e1_uid=…&amp;e1_role=…</code>
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="cumple-asunto-correo"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                Asunto del correo
              </label>
              <input
                id="cumple-asunto-correo"
                type="text"
                value={asuntoCorreo}
                onChange={(e) => setAsuntoCorreo(e.target.value)}
                placeholder="Ej.: Felicitaciones — ABC Logística"
                maxLength={500}
                className={INPUT_DT_CLASS}
                autoComplete="off"
              />
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

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Título</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título del correo…"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-violet-500/20 focus:ring-2"
            style={{ color: accentColor }}
          />
        </div>

        <RichTextEmailField
          label="Cuadro de texto"
          value={cuerpoHtml}
          onChange={(v) => setCuerpoHtml(v)}
          colors={TEXTO_MARCA_HEX}
          placeholder={
            esAniversarios
              ? 'Escribe el contenido del aniversario…'
              : 'Escribe el contenido del cumpleaños…'
          }
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

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Ilustración superior (IA) — fondo siempre blanco
          </label>
          <p className="mb-2 text-[11px] text-slate-500">
            Describe la escena; la API fuerza fondo blanco puro (#fff). Sin selector de color de
            imagen.
          </p>
          <textarea
            id="cumple-hero-prompt"
            value={promptImagenHero}
            onChange={(e) => setPromptImagenHero(e.target.value)}
            rows={4}
            placeholder={
              esAniversarios
                ? 'Ej.: pastel y confeti festivo, tonos alegres sobre blanco…'
                : 'Ej.: pastel de cumpleaños, globos y confeti sobre blanco…'
            }
            className="mb-2 w-full rounded-xl border border-dashed border-slate-300 bg-amber-50/50 px-3 py-2 text-sm text-slate-800 outline-none ring-amber-500/20 focus:ring-2"
          />
          <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-amber-50/50 p-3">
            <ImageGenCharactersWarning />
            <button
              type="button"
              onClick={() => void handleGenerarImagenHero()}
              disabled={generandoHero}
              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60"
            >
              {generandoHero ? 'Generando imagen…' : 'Generar imagen'}
            </button>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Zoom ({imagenHeroSizePct}%): 100 llena el cuadro; más grande recorta bordes; más chico
                deja margen.
              </label>
              <input
                type="range"
                min={25}
                max={200}
                step={1}
                value={imagenHeroSizePct}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10)
                  setImagenHeroSizePct(Number.isFinite(n) ? Math.min(200, Math.max(25, n)) : 100)
                }}
                className="w-full accent-slate-700"
              />
            </div>
            {errorHero ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
                {errorHero}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tabla</h3>
            <button
              type="button"
              disabled={!canAdd}
              onClick={agregarTarjeta}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="text-base leading-none" aria-hidden>
                +
              </span>
              Agregar tarjeta
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            {tablaTarjetas.length}/{MAX_TARJETAS_TABLA} tarjetas
          </p>

          <div className="space-y-2">
            {tablaTarjetas.map((t, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Tarjeta {idx + 1}
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminarTarjeta(idx)}
                    disabled={tablaTarjetas.length <= 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50"
                    aria-label={`Eliminar tarjeta ${idx + 1}`}
                    title="Eliminar tarjeta"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Borrar
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {variant === 'aniversarios' ? (
                    <>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-600">Desde</label>
                        <input
                          type="date"
                          value={t.desde ?? ''}
                          onChange={(e) => actualizarTarjeta(idx, { desde: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-violet-500/20 focus:ring-2"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-600">Nombre</label>
                        <input
                          type="text"
                          value={t.nombre}
                          onChange={(e) => actualizarTarjeta(idx, { nombre: e.target.value })}
                          placeholder="Nombre"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-violet-500/20 focus:ring-2"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-[11px] font-medium text-slate-600">Área</label>
                        <input
                          type="text"
                          value={t.area ?? ''}
                          onChange={(e) => actualizarTarjeta(idx, { area: e.target.value })}
                          placeholder="Área"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-violet-500/20 focus:ring-2"
                        />
                      </div>
                    </>
                  ) : variant === 'reconocimientos' ? (
                    <div className="space-y-3 sm:col-span-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-600">Título</label>
                        <input
                          type="text"
                          value={t.nombre ?? ''}
                          onChange={(e) => actualizarTarjeta(idx, { nombre: e.target.value })}
                          placeholder="Título de la tarjeta"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-violet-500/20 focus:ring-2"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-600">Área</label>
                        <input
                          type="text"
                          value={t.area ?? ''}
                          onChange={(e) => actualizarTarjeta(idx, { area: e.target.value })}
                          placeholder="Área"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-violet-500/20 focus:ring-2"
                        />
                      </div>
                      <RichTextEmailField
                        label="Texto"
                        value={t.textoTarjetaHtml ?? '<p></p>'}
                        onChange={(v) => actualizarTarjeta(idx, { textoTarjetaHtml: v })}
                        colors={TEXTO_MARCA_HEX}
                        placeholder="Texto de la tarjeta…"
                      />
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-600">
                          Imagen de la tarjeta (IA) — fondo #f8fafc
                        </label>
                        <p className="mb-2 text-[11px] text-slate-500">
                          Describe la escena; la API fuerza el mismo fondo que el cuadro de la tarjeta (#f8fafc).
                        </p>
                        <textarea
                          value={t.promptImagenTarjeta ?? ''}
                          onChange={(e) => {
                            setErrorTarjetaGen('')
                            actualizarTarjeta(idx, { promptImagenTarjeta: e.target.value })
                          }}
                          rows={3}
                          placeholder="Ej.: ícono de reconocimiento y confeti sobre fondo #f8fafc…"
                          className="mb-2 w-full rounded-xl border border-dashed border-slate-300 bg-amber-50/50 px-3 py-2 text-sm text-slate-800 outline-none ring-amber-500/20 focus:ring-2"
                        />
                        <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-amber-50/50 p-3">
                          <ImageGenCharactersWarning />
                          <button
                            type="button"
                            onClick={() =>
                              void handleGenerarImagenTarjeta(idx, t.promptImagenTarjeta)
                            }
                            disabled={generandoTarjetaIdx === idx}
                            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60"
                          >
                            {generandoTarjetaIdx === idx ? 'Generando imagen…' : 'Generar imagen'}
                          </button>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-700">
                              Zoom ({t.imagenTarjetaSizePct ?? 100}%)
                            </label>
                            <input
                              type="range"
                              min={25}
                              max={200}
                              step={1}
                              value={t.imagenTarjetaSizePct ?? 100}
                              onChange={(e) => {
                                const n = Number.parseInt(e.target.value, 10)
                                actualizarTarjeta(idx, {
                                  imagenTarjetaSizePct: Number.isFinite(n)
                                    ? Math.min(200, Math.max(25, n))
                                    : 100,
                                })
                              }}
                              className="w-full accent-slate-700"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-600">Fecha</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]{1,2}"
                          value={t.fecha}
                          onChange={(e) =>
                            actualizarTarjeta(idx, { fecha: e.target.value.replace(/\D/g, '').slice(0, 2) })
                          }
                          placeholder="DD"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-violet-500/20 focus:ring-2"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-600">Nombre</label>
                        <input
                          type="text"
                          value={t.nombre}
                          onChange={(e) => actualizarTarjeta(idx, { nombre: e.target.value })}
                          placeholder="Nombre"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-violet-500/20 focus:ring-2"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            {variant === 'reconocimientos' && errorTarjetaGen ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                {errorTarjetaGen}
              </p>
            ) : null}
          </div>
        </div>

        <RichTextEmailField
          label="Footer (texto enriquecido)"
          value={footerHtml}
          onChange={(v) => setFooterHtml(v)}
          colors={TEXTO_MARCA_HEX}
          placeholder="Legal, contacto..."
        />
          </>
        ) : step === 'review' ? (
          asideReview
        ) : (
          asideSchedule
        )}
      </aside>

      <section className="email1-print-section flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
        <div className="email1-print-hide mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Vista previa</span>
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
        ) : step === 'review' ? (
          <p className="email1-print-hide mb-2 text-[11px] leading-snug text-slate-500">
            Misma vista previa que recibirán los destinatarios. Puedes enviar una prueba con asunto{' '}
            <strong>TEST:</strong> o continuar al paso de programación y envío real.
          </p>
        ) : null}

        <div
          className="email1-preview-canvas min-h-[480px] flex-1 overflow-auto rounded-xl"
          style={{ backgroundColor: fondoCorreo }}
        >
          <div className="flex min-h-full w-full min-w-0 items-center justify-center p-6">
            <div
              ref={previewCardRef}
              className="email1-print-area w-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-md transition-[max-width] duration-200"
              style={{ maxWidth: anchoCard, borderRadius: 16 }}
            >
              <div className="flex w-full items-center justify-center border-b border-slate-100 px-6 py-4">
                <img
                  src={logoSrc}
                  alt="ABC Logística"
                  className="mx-auto h-[52px] w-auto max-w-[min(290px,92%)] object-contain object-center"
                />
              </div>

              <div className="space-y-4 px-6 py-5">
                {titulo.trim() ? (
                  <div
                    className="text-center text-4xl font-bold leading-snug px-[20px] pb-0 pt-[20px]"
                    style={{ fontFamily: 'Verdana, Geneva, sans-serif', color: accentColor }}
                  >
                    {titulo}
                  </div>
                ) : null}

                {showCuerpo ? (
                  <div
                    className={`px-[20px] pb-[20px] ${titulo.trim() ? 'pt-0 -mt-[10px]' : 'pt-[20px]'}`}
                  >
                    <div
                      className={EMAIL_RICH_PREVIEW_BODY}
                      style={{ fontFamily: 'Verdana, Geneva, sans-serif' }}
                      dangerouslySetInnerHTML={{ __html: previewCuerpo }}
                    />
                  </div>
                ) : null}

                {showCta1Preview && cta1Href ? (
                  <div className={`flex w-full px-5 pb-2 ${ctaPreviewJustify(ctaAfter1Align)}`}>
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
                  className="relative mx-auto w-[90%] max-w-full overflow-hidden rounded-2xl"
                  style={{ backgroundColor: HERO_BG_BLANCO, aspectRatio: '16 / 9' }}
                >
                  {imagenHeroUrl ? (
                    <div className="absolute inset-0 overflow-hidden rounded-2xl">
                      <img
                        src={imagenHeroUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover object-center"
                        style={{
                          transform: `scale(${imagenHeroSizePct / 100})`,
                          transformOrigin: 'center center',
                        }}
                      />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-[11px] font-medium text-slate-500">
                      Genera la ilustración con la descripción (fondo blanco)
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 h-3" />
                  {variant === 'reconocimientos' ? (
                    <div className="py-[10px] px-[20px]">
                      <div className="space-y-4">
                      {tablaTarjetas.map((t, idx) => (
                        <div
                          key={idx}
                          className="flex min-h-0 w-full flex-row items-stretch overflow-hidden rounded-xl bg-[#f8fafc]"
                        >
                          <div className="box-border flex w-[30%] shrink-0 self-stretch min-h-0 bg-[#f8fafc] pr-[10px]">
                            <div className="relative h-full min-h-[140px] w-full min-w-0 overflow-hidden bg-[#f8fafc]">
                              {t.imagenTarjetaUrl ? (
                                <img
                                  src={t.imagenTarjetaUrl}
                                  alt=""
                                  className="absolute inset-0 h-full w-full object-cover object-center"
                                  style={{
                                    transform: `scale(${(t.imagenTarjetaSizePct ?? 100) / 100})`,
                                    transformOrigin: 'center center',
                                  }}
                                />
                              ) : (
                                <div className="absolute inset-0 bg-[#f8fafc]" />
                              )}
                            </div>
                          </div>
                          <div className="box-border flex w-[70%] flex-col bg-[#f8fafc] pl-0 pr-[10px] pb-[10px] pt-[15px]">
                            <div
                              className="w-full break-words text-[17px] font-bold leading-snug"
                              style={{
                                fontFamily: "'Nunito Sans', sans-serif",
                                color: NOMBRE_TABLA_COLOR,
                              }}
                            >
                              {t.nombre?.trim() ? t.nombre : '\u00A0'}
                            </div>
                            <div className="h-px shrink-0 bg-transparent" aria-hidden />
                            <div
                              className="w-full break-words text-[13px] font-light leading-snug"
                              style={{
                                fontFamily: "'Nunito Sans', sans-serif",
                                color: NOMBRE_TABLA_COLOR,
                              }}
                            >
                              {t.area?.trim() ? t.area : '\u00A0'}
                            </div>
                            <div className="h-[10px] shrink-0" aria-hidden />
                            <div
                              className={`${EMAIL_RICH_PREVIEW_BODY} w-full`}
                              style={{ fontFamily: 'Verdana, Geneva, sans-serif' }}
                              dangerouslySetInnerHTML={{
                                __html: htmlOrPlainToPreview(t.textoTarjetaHtml || ''),
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      </div>
                    </div>
                  ) : (
                  <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: accentColor, borderWidth: 1 }}>
                    {variant === 'aniversarios' ? (
                      <table className="w-full table-fixed border-collapse text-left text-[14px]">
                        <colgroup>
                          {vistaPreview === 'mobile' ? (
                            <>
                              <col style={{ width: '32%' }} />
                              <col style={{ width: '68%' }} />
                            </>
                          ) : (
                            <>
                              <col style={{ width: '20%' }} />
                              <col style={{ width: '30%' }} />
                              <col style={{ width: '20%' }} />
                              <col style={{ width: '30%' }} />
                            </>
                          )}
                        </colgroup>
                        <tbody>
                          {vistaPreview === 'mobile'
                            ? tablaTarjetas.map((t, idx) => {
                                const años = añosCompletadosHastaHoy(t.desde)
                                const desdeFmt = formatDesdeHumano(t.desde)
                                return (
                                  <tr key={idx}>
                                    <td
                                      className="border-b border-r px-2 py-2 align-middle text-center"
                                      style={{ borderColor: accentColor }}
                                    >
                                      <div className="flex min-w-0 flex-col items-center justify-center gap-0.5">
                                        {años != null ? (
                                          <span
                                            className="inline-flex flex-wrap items-baseline justify-center gap-1 leading-tight"
                                            style={tdNumStyle}
                                          >
                                            <span>{años}</span>
                                            <span>{años === 1 ? 'año' : 'años'}</span>
                                          </span>
                                        ) : (
                                          <span style={tdNumStyle} className="inline-block min-h-[1.25em]">
                                            {'\u00A0'}
                                          </span>
                                        )}
                                        {desdeFmt ? (
                                          <span
                                            className="max-w-full break-words px-0.5 text-center text-[10px] font-normal leading-snug"
                                            style={{
                                              borderColor: accentColor,
                                              color: NOMBRE_TABLA_COLOR,
                                              fontFamily: 'Verdana, Geneva, sans-serif',
                                            }}
                                          >
                                            Desde {desdeFmt}
                                          </span>
                                        ) : null}
                                      </div>
                                    </td>
                                    <td
                                      className="border-b px-2 py-2 align-middle text-left"
                                      style={tdNombreStyle}
                                    >
                                      <div className="min-w-0 max-w-full">
                                        <div className="break-words text-[17px]">{t.nombre || '\u00A0'}</div>
                                        {t.area ? (
                                          <div
                                            className="mt-0.5 max-w-full break-words text-[13px] font-normal leading-snug"
                                            style={{
                                              color: NOMBRE_TABLA_COLOR,
                                              fontFamily: 'Verdana, Geneva, sans-serif',
                                            }}
                                          >
                                            {t.area}
                                          </div>
                                        ) : null}
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })
                            : tablaTarjetas
                                .reduce((rows, item, i) => {
                                  if (i % 2 === 0) rows.push([item])
                                  else rows[rows.length - 1].push(item)
                                  return rows
                                }, [])
                                .map((pair, idx) => {
                                  const celdaAños = (t) => {
                                    const años = añosCompletadosHastaHoy(t?.desde)
                                    const desdeFmt = formatDesdeHumano(t?.desde)
                                    return (
                                      <td
                                        className="border-b border-r px-2 py-2 align-middle text-center"
                                        style={{ borderColor: accentColor }}
                                      >
                                        <div className="flex min-w-0 flex-col items-center justify-center gap-0.5">
                                          {años != null ? (
                                            <span
                                              className="inline-flex flex-wrap items-baseline justify-center gap-1 leading-tight"
                                              style={tdNumStyle}
                                            >
                                              <span>{años}</span>
                                              <span>{años === 1 ? 'año' : 'años'}</span>
                                            </span>
                                          ) : (
                                            <span style={tdNumStyle} className="inline-block min-h-[1.25em]">
                                              {'\u00A0'}
                                            </span>
                                          )}
                                          {desdeFmt ? (
                                            <span
                                              className="max-w-full break-words px-0.5 text-center text-[10px] font-normal leading-snug"
                                              style={{
                                                borderColor: accentColor,
                                                color: NOMBRE_TABLA_COLOR,
                                                fontFamily: 'Verdana, Geneva, sans-serif',
                                              }}
                                            >
                                              Desde {desdeFmt}
                                            </span>
                                          ) : null}
                                        </div>
                                      </td>
                                    )
                                  }
                                  const celdaNombre = (t, opts) => (
                                    <td
                                      className={`border-b px-2 py-2 align-middle text-left ${opts?.borderR ? 'border-r' : ''}`}
                                      style={tdNombreStyle}
                                      colSpan={opts?.colSpan}
                                    >
                                      <div className="min-w-0 max-w-full">
                                        <div className="break-words text-[17px]">{t?.nombre || '\u00A0'}</div>
                                        {t?.area ? (
                                          <div
                                            className="mt-0.5 max-w-full break-words text-[13px] font-normal leading-snug"
                                            style={{
                                              color: NOMBRE_TABLA_COLOR,
                                              fontFamily: 'Verdana, Geneva, sans-serif',
                                            }}
                                          >
                                            {t.area}
                                          </div>
                                        ) : null}
                                      </div>
                                    </td>
                                  )
                                  return (
                                    <tr key={idx}>
                                      {celdaAños(pair[0])}
                                      {celdaNombre(pair[0], {
                                        borderR: Boolean(pair[1]),
                                        colSpan: pair[1] ? undefined : 3,
                                      })}
                                      {pair[1] ? (
                                        <>
                                          {celdaAños(pair[1])}
                                          {celdaNombre(pair[1], {})}
                                        </>
                                      ) : null}
                                    </tr>
                                  )
                                })}
                        </tbody>
                      </table>
                    ) : (
                      <table className="w-full table-fixed border-collapse text-left text-[17px]">
                        <colgroup>
                          <col style={{ width: vistaPreview === 'mobile' ? '20%' : '15%' }} />
                          <col style={{ width: vistaPreview === 'mobile' ? '80%' : '35%' }} />
                          {vistaPreview !== 'mobile' ? <col style={{ width: '15%' }} /> : null}
                          {vistaPreview !== 'mobile' ? <col style={{ width: '35%' }} /> : null}
                        </colgroup>
                        <tbody>
                          {vistaPreview === 'mobile'
                            ? tablaTarjetas.map((t, idx) => (
                                <tr key={idx}>
                                  <td className="border-b border-r px-3 py-2 text-center" style={tdNumStyle}>
                                    {t.fecha || '\u00A0'}
                                  </td>
                                  <td className="border-b px-3 py-2 text-left" style={tdNombreStyle}>
                                    {t.nombre || '\u00A0'}
                                  </td>
                                </tr>
                              ))
                            : tablaTarjetas
                                .reduce((rows, item, i) => {
                                  if (i % 2 === 0) rows.push([item])
                                  else rows[rows.length - 1].push(item)
                                  return rows
                                }, [])
                                .map((pair, idx) => (
                                  <tr key={idx}>
                                    <td className="border-b border-r px-3 py-2 text-center" style={tdNumStyle}>
                                      {pair[0]?.fecha || '\u00A0'}
                                    </td>
                                    <td
                                      className={`border-b px-3 py-2 text-left ${pair[1] ? 'border-r' : ''}`}
                                      style={tdNombreStyle}
                                      colSpan={pair[1] ? 1 : 3}
                                    >
                                      {pair[0]?.nombre || '\u00A0'}
                                    </td>
                                    {pair[1] ? (
                                      <>
                                        <td className="border-b border-r px-3 py-2 text-center" style={tdNumStyle}>
                                          {pair[1]?.fecha || '\u00A0'}
                                        </td>
                                        <td className="border-b px-3 py-2 text-left" style={tdNombreStyle}>
                                          {pair[1]?.nombre || '\u00A0'}
                                        </td>
                                      </>
                                    ) : null}
                                  </tr>
                                ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  )}
                </div>
              </div>

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

        {promptImagenHero.trim() && step === 'edit' ? (
          <p className="email1-print-hide mt-2 text-xs text-amber-800/90">
            <strong>IA (borrador):</strong> {promptImagenHero.trim().slice(0, 120)}
            {promptImagenHero.length > 120 && '…'}
          </p>
        ) : null}
      </section>
    </div>
  )
}
