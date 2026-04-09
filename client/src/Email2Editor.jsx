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

function mediaUrl(ruta) {
  if (!ruta) return ''
  const clean = String(ruta).replace(/^\//, '')
  return `${API_BASE}/media/plantillas/${clean}`
}

function hasText(s) {
  const t = String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim()
  return t.length > 0
}

function pdfFileBaseName(plantilla) {
  const raw = plantilla?.id_externo || 'preview'
  const sinTpl = String(raw).replace(/^tpl_/i, '')
  return `email-2-${sinTpl}`
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

function EmailNanoBananaPromptField({ label, value, onChange, idSuffix }) {
  const fieldId = `email2-nb-${idSuffix}`
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

export default function Email2Editor({
  plantilla,
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

  const [step, setStep] = useState('edit')
  const [asuntoCorreo, setAsuntoCorreo] = useState('')
  const [fondoCorreoIdx, setFondoCorreoIdx] = useState(0)
  const [imgBox1Idx, setImgBox1Idx] = useState(0)
  const [imgBox2Idx, setImgBox2Idx] = useState(1)
  const [cuerpo1Html, setCuerpo1Html] = useState('<p></p>')
  const [cuerpo2Html, setCuerpo2Html] = useState('<p></p>')
  const [cuerpo3Html, setCuerpo3Html] = useState('<p></p>')
  const [footerHtml, setFooterHtml] = useState('<p></p>')
  const [promptImagen1, setPromptImagen1] = useState('')
  const [promptImagen2, setPromptImagen2] = useState('')
  const [imagenGemini1Url, setImagenGemini1Url] = useState('')
  const [imagenGemini1SizePct, setImagenGemini1SizePct] = useState(100)
  const [generandoImagenGemini1, setGenerandoImagenGemini1] = useState(false)
  const [imagenGemini1Error, setImagenGemini1Error] = useState('')
  const [imagenGemini2Url, setImagenGemini2Url] = useState('')
  const [imagenGemini2SizePct, setImagenGemini2SizePct] = useState(100)
  const [generandoImagenGemini2, setGenerandoImagenGemini2] = useState(false)
  const [imagenGemini2Error, setImagenGemini2Error] = useState('')
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
  const [ctaAfter3Enabled, setCtaAfter3Enabled] = useState(false)
  const [ctaAfter3ColorIdx, setCtaAfter3ColorIdx] = useState(0)
  const [ctaAfter3Text, setCtaAfter3Text] = useState('')
  const [ctaAfter3Url, setCtaAfter3Url] = useState('')
  const [ctaAfter3FontSizePx, setCtaAfter3FontSizePx] = useState(18)
  const [ctaAfter3Align, setCtaAfter3Align] = useState('center')

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

  const d1 = useDebouncedValue(cuerpo1Html, 220)
  const d2 = useDebouncedValue(cuerpo2Html, 220)
  const d3 = useDebouncedValue(cuerpo3Html, 220)
  const dFoot = useDebouncedValue(footerHtml, 280)

  const fondoCorreo = FONDO_CORREO_HEX[fondoCorreoIdx] ?? FONDO_CORREO_HEX[0]
  const bgImg1 = FONDO_CUADRO_IMAGEN_HEX[imgBox1Idx] ?? FONDO_CUADRO_IMAGEN_HEX[0]
  const bgImg2 = FONDO_CUADRO_IMAGEN_HEX[imgBox2Idx] ?? FONDO_CUADRO_IMAGEN_HEX[0]

  const preview1 = useMemo(() => htmlOrPlainToPreview(d1), [d1])
  const preview2 = useMemo(() => htmlOrPlainToPreview(d2), [d2])
  const preview3 = useMemo(() => htmlOrPlainToPreview(d3), [d3])
  const previewFoot = useMemo(() => htmlOrPlainToPreview(dFoot), [dFoot])

  const show1 = hasText(d1)
  const show2 = hasText(d2)
  const show3 = hasText(d3)
  const showFooter = hasText(dFoot)

  const showCta1Preview = useMemo(
    () => isEmail1CtaPreviewVisible(ctaAfter1Enabled, ctaAfter1Text, ctaAfter1Url),
    [ctaAfter1Enabled, ctaAfter1Text, ctaAfter1Url]
  )
  const showCta2Preview = useMemo(
    () => isEmail1CtaPreviewVisible(ctaAfter2Enabled, ctaAfter2Text, ctaAfter2Url),
    [ctaAfter2Enabled, ctaAfter2Text, ctaAfter2Url]
  )
  const showCta3Preview = useMemo(
    () => isEmail1CtaPreviewVisible(ctaAfter3Enabled, ctaAfter3Text, ctaAfter3Url),
    [ctaAfter3Enabled, ctaAfter3Text, ctaAfter3Url]
  )
  const cta1Bg = FONDO_CUADRO_IMAGEN_HEX[ctaAfter1ColorIdx] ?? FONDO_CUADRO_IMAGEN_HEX[0]
  const cta2Bg = FONDO_CUADRO_IMAGEN_HEX[ctaAfter2ColorIdx] ?? FONDO_CUADRO_IMAGEN_HEX[0]
  const cta3Bg = FONDO_CUADRO_IMAGEN_HEX[ctaAfter3ColorIdx] ?? FONDO_CUADRO_IMAGEN_HEX[0]
  const cta1Href = sanitizeCtaHttpUrl(ctaAfter1Url)
  const cta2Href = sanitizeCtaHttpUrl(ctaAfter2Url)
  const cta3Href = sanitizeCtaHttpUrl(ctaAfter3Url)

  const isMobilePreview = vistaPreview === 'mobile'
  const gridRowTexto2Img1 = useMemo(() => {
    if (isMobilePreview) {
      return {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: 10,
        alignItems: 'start',
        width: '100%',
      }
    }
    return {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)',
      gap: 10,
      alignItems: 'start',
      width: '100%',
    }
  }, [isMobilePreview])

  const richClass = EMAIL_RICH_PREVIEW_BODY
  const richStyle = { fontFamily: 'Verdana, Geneva, sans-serif' }
  const anchoCard = vistaPreview === 'mobile' ? 'min(100%, 360px)' : 'min(100%, 600px)'

  const logoRuta = useMemo(() => {
    try {
      const raw = plantilla?.definicion
      const d = typeof raw === 'string' ? JSON.parse(raw) : raw
      return d?.email2?.logoRuta || d?.email1?.logoRuta || 'miniaturas/logo-abc-logistica.svg'
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
      imgBox1Idx,
      imgBox2Idx,
      cuerpo1Html,
      cuerpo2Html,
      cuerpo3Html,
      footerHtml,
      promptImagen1,
      promptImagen2,
      imagenGemini1Url,
      imagenGemini1SizePct,
      imagenGemini2Url,
      imagenGemini2SizePct,
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
      ctaAfter3Enabled,
      ctaAfter3ColorIdx,
      ctaAfter3Text,
      ctaAfter3Url,
      ctaAfter3FontSizePx,
      ctaAfter3Align,
    }),
    [
      asuntoCorreo,
      fondoCorreoIdx,
      imgBox1Idx,
      imgBox2Idx,
      cuerpo1Html,
      cuerpo2Html,
      cuerpo3Html,
      footerHtml,
      promptImagen1,
      promptImagen2,
      imagenGemini1Url,
      imagenGemini1SizePct,
      imagenGemini2Url,
      imagenGemini2SizePct,
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
      ctaAfter3Enabled,
      ctaAfter3ColorIdx,
      ctaAfter3Text,
      ctaAfter3Url,
      ctaAfter3FontSizePx,
      ctaAfter3Align,
    ]
  )

  const applyPayload = useCallback((p) => {
    if (!p || typeof p !== 'object') return
    setAsuntoCorreo(typeof p.asuntoCorreo === 'string' ? p.asuntoCorreo : '')
    if (typeof p.fondoCorreoIdx === 'number') setFondoCorreoIdx(p.fondoCorreoIdx)
    if (typeof p.imgBox1Idx === 'number') setImgBox1Idx(p.imgBox1Idx)
    if (typeof p.imgBox2Idx === 'number') setImgBox2Idx(p.imgBox2Idx)
    if (typeof p.cuerpo1Html === 'string') setCuerpo1Html(p.cuerpo1Html)
    if (typeof p.cuerpo2Html === 'string') setCuerpo2Html(p.cuerpo2Html)
    if (typeof p.cuerpo3Html === 'string') setCuerpo3Html(p.cuerpo3Html)
    if (typeof p.footerHtml === 'string') setFooterHtml(p.footerHtml)
    if (typeof p.promptImagen1 === 'string') setPromptImagen1(p.promptImagen1)
    if (typeof p.promptImagen2 === 'string') setPromptImagen2(p.promptImagen2)
    if (typeof p.imagenGemini1Url === 'string') setImagenGemini1Url(p.imagenGemini1Url)
    if (typeof p.imagenGemini1SizePct === 'number') setImagenGemini1SizePct(p.imagenGemini1SizePct)
    if (typeof p.imagenGemini2Url === 'string') setImagenGemini2Url(p.imagenGemini2Url)
    if (typeof p.imagenGemini2SizePct === 'number') setImagenGemini2SizePct(p.imagenGemini2SizePct)
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
    if (typeof p.ctaAfter3Enabled === 'boolean') setCtaAfter3Enabled(p.ctaAfter3Enabled)
    if (typeof p.ctaAfter3ColorIdx === 'number') setCtaAfter3ColorIdx(p.ctaAfter3ColorIdx)
    if (typeof p.ctaAfter3Text === 'string') setCtaAfter3Text(p.ctaAfter3Text)
    if (typeof p.ctaAfter3Url === 'string') setCtaAfter3Url(p.ctaAfter3Url)
    if (typeof p.ctaAfter3FontSizePx === 'number') setCtaAfter3FontSizePx(p.ctaAfter3FontSizePx)
    if (p.ctaAfter3Align === 'left' || p.ctaAfter3Align === 'center' || p.ctaAfter3Align === 'right') {
      setCtaAfter3Align(p.ctaAfter3Align)
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

  const handleGenerarImagenGemini1 = async () => {
    setImagenGemini1Error('')
    const texto = String(promptImagen1 || '').trim()
    if (!texto) {
      setImagenGemini1Error('Escribe instrucciones para la imagen.')
      return
    }
    setGenerandoImagenGemini1(true)
    try {
      const res = await fetch(`${API_BASE}/api/nano-banana/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratio: '1_1',
          nonce: Date.now(),
          prompt: texto,
          backgroundHex: bgImg1,
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
          /* ignore */
        }
        throw new Error(msg || txt?.slice(0, 500) || `Error ${res.status}`)
      }
      const data = await res.json()
      if (!data?.imageUrl) throw new Error('Respuesta sin imageUrl')
      setImagenGemini1Url(String(data.imageUrl))
    } catch (err) {
      setImagenGemini1Error(err instanceof Error ? err.message : 'No se pudo generar la imagen')
    } finally {
      setGenerandoImagenGemini1(false)
    }
  }

  const handleGenerarImagenGemini2 = async () => {
    setImagenGemini2Error('')
    const texto = String(promptImagen2 || '').trim()
    if (!texto) {
      setImagenGemini2Error('Escribe instrucciones para la imagen.')
      return
    }
    setGenerandoImagenGemini2(true)
    try {
      const res = await fetch(`${API_BASE}/api/nano-banana/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratio: '1_1',
          nonce: Date.now(),
          prompt: texto,
          backgroundHex: bgImg2,
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
          /* ignore */
        }
        throw new Error(msg || txt?.slice(0, 500) || `Error ${res.status}`)
      }
      const data = await res.json()
      if (!data?.imageUrl) throw new Error('Respuesta sin imageUrl')
      setImagenGemini2Url(String(data.imageUrl))
    } catch (err) {
      setImagenGemini2Error(err instanceof Error ? err.message : 'No se pudo generar la imagen')
    } finally {
      setGenerandoImagenGemini2(false)
    }
  }

  const handleImprimirGuardarPdf = useCallback(() => {
    if (typeof document === 'undefined') return
    printTitleBeforeRef.current = document.title
    document.title = pdfFileBaseName(plantilla)
    document.body.classList.add('email1-print-active')
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print()
      })
    })
  }, [plantilla])

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
        editor_tipo: 'email2',
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
        if (row.editor_tipo && row.editor_tipo !== 'email2') {
          setApiError('Esta solicitud es de otro editor (no Email 2).')
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
            editor_tipo: 'email2',
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

  const asideEditorial = (
    <>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Email 2</h2>
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
            . Misma convención que Email 1:{' '}
            <code className="rounded bg-slate-100 px-0.5">?e1_uid=…&amp;e1_role=…</code>
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="email2-asunto-correo" className="mb-1 block text-xs font-medium text-slate-600">
          Asunto del correo
        </label>
        <input
          id="email2-asunto-correo"
          type="text"
          value={asuntoCorreo}
          onChange={(e) => setAsuntoCorreo(e.target.value)}
          placeholder="Ej.: Novedades — ABC Logística"
          maxLength={500}
          className={INPUT_DT_CLASS}
          autoComplete="off"
        />
        <p className="mt-1 text-[10px] leading-snug text-slate-500">
          Si lo dejas vacío, se usará el asunto por defecto del sistema al enviar.
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

      <RichTextEmailField
        label="Primer bloque de texto"
        value={cuerpo1Html}
        onChange={(v) => setCuerpo1Html(v)}
        colors={TEXTO_MARCA_HEX}
        placeholder="Escribe el contenido principal..."
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
      <p className="text-[10px] leading-snug text-slate-500">
        En el correo, este botón va justo después del primer bloque de texto.
      </p>

      <RichTextEmailField
        label="Segundo bloque de texto"
        value={cuerpo2Html}
        onChange={(v) => setCuerpo2Html(v)}
        colors={TEXTO_MARCA_HEX}
        placeholder="Texto secundario..."
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
      <p className="text-[10px] leading-snug text-slate-500">
        En el correo, este botón va entre el segundo bloque y la imagen 1 (columna izquierda).
      </p>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Fondo cuadro imagen 1</label>
        <div className="mb-2 rounded-lg border border-slate-200 bg-white p-2">
          <div
            className="h-16 w-16 rounded-xl border border-white/60 shadow-sm"
            style={{ backgroundColor: bgImg1 }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FONDO_CUADRO_IMAGEN_HEX.map((hex, i) => (
            <button
              key={hex}
              type="button"
              title={hex}
              onClick={() => setImgBox1Idx(i)}
              className={`h-8 w-8 rounded-md border-2 ${
                imgBox1Idx === i ? 'border-violet-600 ring-2 ring-violet-200' : 'border-slate-200'
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      </div>

      <EmailNanoBananaPromptField
        label="Instrucciones para la IA (imagen 1)"
        value={promptImagen1}
        onChange={setPromptImagen1}
        idSuffix="img1"
      />
      <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-amber-50/50 p-3">
        <ImageGenCharactersWarning />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleGenerarImagenGemini1()}
            disabled={generandoImagenGemini1}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60"
          >
            {generandoImagenGemini1 ? 'Generando imagen…' : 'Generar imagen'}
          </button>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Zoom imagen 1 ({imagenGemini1SizePct}%)
          </label>
          <input
            type="range"
            min={25}
            max={200}
            step={1}
            value={imagenGemini1SizePct}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10)
              setImagenGemini1SizePct(Number.isFinite(n) ? Math.min(200, Math.max(25, n)) : 100)
            }}
            className="w-full accent-slate-700"
          />
        </div>
        {imagenGemini1Error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
            {imagenGemini1Error}
          </p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Fondo cuadro imagen 2</label>
        <div className="mb-2 rounded-lg border border-slate-200 bg-white p-2">
          <div
            className="h-12 w-full rounded-xl border border-white/60 shadow-sm"
            style={{ backgroundColor: bgImg2 }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FONDO_CUADRO_IMAGEN_HEX.map((hex, i) => (
            <button
              key={`b-${hex}`}
              type="button"
              title={hex}
              onClick={() => setImgBox2Idx(i)}
              className={`h-8 w-8 rounded-md border-2 ${
                imgBox2Idx === i ? 'border-violet-600 ring-2 ring-violet-200' : 'border-slate-200'
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      </div>

      <EmailNanoBananaPromptField
        label="Instrucciones para la IA (imagen 2)"
        value={promptImagen2}
        onChange={setPromptImagen2}
        idSuffix="img2"
      />
      <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-amber-50/50 p-3">
        <ImageGenCharactersWarning />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleGenerarImagenGemini2()}
            disabled={generandoImagenGemini2}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60"
          >
            {generandoImagenGemini2 ? 'Generando imagen…' : 'Generar imagen'}
          </button>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Zoom imagen 2 ({imagenGemini2SizePct}%)
          </label>
          <input
            type="range"
            min={25}
            max={200}
            step={1}
            value={imagenGemini2SizePct}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10)
              setImagenGemini2SizePct(Number.isFinite(n) ? Math.min(200, Math.max(25, n)) : 100)
            }}
            className="w-full accent-slate-700"
          />
        </div>
        {imagenGemini2Error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
            {imagenGemini2Error}
          </p>
        ) : null}
      </div>

      <RichTextEmailField
        label="Tercer bloque de texto"
        value={cuerpo3Html}
        onChange={(v) => setCuerpo3Html(v)}
        colors={TEXTO_MARCA_HEX}
        placeholder="Tercer bloque de texto…"
      />

      <EmailCtaAsideBlock
        enabled={ctaAfter3Enabled}
        onEnabledChange={setCtaAfter3Enabled}
        colorIdx={ctaAfter3ColorIdx}
        onColorIdxChange={setCtaAfter3ColorIdx}
        text={ctaAfter3Text}
        onTextChange={setCtaAfter3Text}
        url={ctaAfter3Url}
        onUrlChange={setCtaAfter3Url}
        fontSizePx={ctaAfter3FontSizePx}
        onFontSizeChange={setCtaAfter3FontSizePx}
        align={ctaAfter3Align}
        onAlignChange={setCtaAfter3Align}
      />
      <p className="text-[10px] leading-snug text-slate-500">
        En el correo, este botón va justo después del tercer bloque de texto.
      </p>

      <RichTextEmailField
        label="Footer (texto enriquecido)"
        value={footerHtml}
        onChange={(v) => setFooterHtml(v)}
        colors={TEXTO_MARCA_HEX}
        placeholder="Legal, contacto..."
      />
    </>
  )

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

  const previewBlock = (
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
            {show1 && (
              <div className={richClass} style={richStyle} dangerouslySetInnerHTML={{ __html: preview1 }} />
            )}

            {showCta1Preview && cta1Href ? (
              <div className={`mt-2 flex w-full pb-2 ${ctaPreviewJustify(ctaAfter1Align)}`}>
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

            <div className="w-full max-w-full min-w-0" style={gridRowTexto2Img1}>
              <div className={`min-w-0 max-w-full space-y-3 ${richClass}`} style={richStyle}>
                {show2 ? <div dangerouslySetInnerHTML={{ __html: preview2 }} /> : null}
                {showCta2Preview && cta2Href ? (
                  <div className={`flex w-full ${ctaPreviewJustify(ctaAfter2Align)}`}>
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
              <div
                className="relative w-full max-w-full min-w-0 shrink-0 overflow-hidden rounded-2xl"
                style={{ backgroundColor: bgImg1, aspectRatio: '4 / 3' }}
              >
                {imagenGemini1Url ? (
                  <div className="absolute inset-0 overflow-hidden rounded-2xl">
                    <img
                      src={imagenGemini1Url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover object-center"
                      style={{
                        transform: `scale(${imagenGemini1SizePct / 100})`,
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

            <div
              className="relative w-full max-w-full min-h-[170px] shrink-0 overflow-hidden rounded-2xl"
              style={{ backgroundColor: bgImg2 }}
            >
              {imagenGemini2Url ? (
                <div className="absolute inset-0 overflow-hidden rounded-2xl">
                  <img
                    src={imagenGemini2Url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover object-center"
                    style={{
                      transform: `scale(${imagenGemini2SizePct / 100})`,
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

            {show3 && (
              <div className={richClass} style={richStyle} dangerouslySetInnerHTML={{ __html: preview3 }} />
            )}

            {showCta3Preview && cta3Href ? (
              <div className={`mt-2 flex w-full pb-2 ${ctaPreviewJustify(ctaAfter3Align)}`}>
                <a
                  href={cta3Href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-[30px] px-5 py-3.5 text-center no-underline"
                  style={{
                    backgroundColor: cta3Bg,
                    color: '#ffffff',
                    fontFamily: "'Nunito Sans', Verdana, Geneva, sans-serif",
                    fontWeight: 900,
                    fontSize: clampCtaFontSizePx(ctaAfter3FontSizePx),
                    lineHeight: 1.25,
                  }}
                >
                  {ctaAfter3Text.trim()}
                </a>
              </div>
            ) : null}
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

        {(promptImagen1.trim() || promptImagen2.trim()) && step === 'edit' ? (
          <p className="email1-print-hide mt-2 text-xs text-amber-800/90">
            <strong>IA (borrador):</strong>{' '}
            {[
              promptImagen1.trim() && `Imagen 1: ${promptImagen1.trim().slice(0, 120)}`,
              promptImagen2.trim() && `Imagen 2: ${promptImagen2.trim().slice(0, 120)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
            {(promptImagen1.length > 120 || promptImagen2.length > 120) && '…'}
          </p>
        ) : null}
      </section>
    </div>
  )
}
