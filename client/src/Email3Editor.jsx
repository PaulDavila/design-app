import { useMemo, useRef, useState } from 'react'
import { Download, Facebook, Instagram, Linkedin, Monitor, Smartphone } from 'lucide-react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { FONDO_CORREO_HEX, FONDO_CUADRO_IMAGEN_HEX, TEXTO_MARCA_HEX } from './emailPalettes'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { htmlOrPlainToPreview } from './utils/sanitizeEmailHtml'
import RichTextEmailField from './RichTextEmailField.jsx'
import {
  EMAIL_RICH_PREVIEW_BODY,
  EMAIL_RICH_PREVIEW_FOOTER,
  EMAIL_RICH_PREVIEW_TITLE,
} from './emailRichTextClasses.js'

const API_BASE =
  import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL || 'http://localhost:4000'

function mediaUrl(ruta) {
  if (!ruta) return ''
  const clean = String(ruta).replace(/^\//, '')
  return `${API_BASE}/media/plantillas/${clean}`
}

function hasText(s) {
  const t = String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim()
  return t.length > 0
}

function EmailNanoBananaPromptField({ label, value, onChange, idSuffix }) {
  const fieldId = `email3-nb-${idSuffix}`
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
        placeholder="Describe cómo debe ser la imagen… (aún no conectado a IA)"
        className="w-full rounded-xl border border-dashed border-slate-300 bg-amber-50/50 px-3 py-2 text-sm text-slate-800 outline-none ring-amber-500/20 focus:ring-2"
      />
    </div>
  )
}

export default function Email3Editor({ plantilla }) {
  const [fondoCorreoIdx, setFondoCorreoIdx] = useState(0)
  const [imgBox1Idx, setImgBox1Idx] = useState(0)
  const [imgBox2Idx, setImgBox2Idx] = useState(1)
  const [tituloHtml, setTituloHtml] = useState('<p></p>')
  const [cuerpo1Html, setCuerpo1Html] = useState('<p></p>')
  const [cuerpo2Html, setCuerpo2Html] = useState('<p></p>')
  const [cuerpo3Html, setCuerpo3Html] = useState('<p></p>')
  const [cuerpo4Html, setCuerpo4Html] = useState('<p></p>')
  const [cuerpo5Html, setCuerpo5Html] = useState('<p></p>')
  const [footerHtml, setFooterHtml] = useState('<p></p>')
  const [promptImagen1, setPromptImagen1] = useState('')
  const [promptImagen2, setPromptImagen2] = useState('')
  const [vistaPreview, setVistaPreview] = useState('desktop')
  const previewCardRef = useRef(null)
  const [exporting, setExporting] = useState(false)

  const dTitle = useDebouncedValue(tituloHtml, 220)
  const d1 = useDebouncedValue(cuerpo1Html, 220)
  const d2 = useDebouncedValue(cuerpo2Html, 220)
  const d3 = useDebouncedValue(cuerpo3Html, 220)
  const d4 = useDebouncedValue(cuerpo4Html, 220)
  const d5 = useDebouncedValue(cuerpo5Html, 220)
  const dFoot = useDebouncedValue(footerHtml, 280)

  const fondoCorreo = FONDO_CORREO_HEX[fondoCorreoIdx] ?? FONDO_CORREO_HEX[0]
  const bgImg1 = FONDO_CUADRO_IMAGEN_HEX[imgBox1Idx] ?? FONDO_CUADRO_IMAGEN_HEX[0]
  const bgImg2 = FONDO_CUADRO_IMAGEN_HEX[imgBox2Idx] ?? FONDO_CUADRO_IMAGEN_HEX[0]

  const previewTitle = useMemo(() => htmlOrPlainToPreview(dTitle), [dTitle])
  const preview1 = useMemo(() => htmlOrPlainToPreview(d1), [d1])
  const preview2 = useMemo(() => htmlOrPlainToPreview(d2), [d2])
  const preview3 = useMemo(() => htmlOrPlainToPreview(d3), [d3])
  const preview4 = useMemo(() => htmlOrPlainToPreview(d4), [d4])
  const preview5 = useMemo(() => htmlOrPlainToPreview(d5), [d5])
  const previewFoot = useMemo(() => htmlOrPlainToPreview(dFoot), [dFoot])

  const showTitle = hasText(dTitle)
  const show1 = hasText(d1)
  const show2 = hasText(d2)
  const show3 = hasText(d3)
  const show4 = hasText(d4)
  const show5 = hasText(d5)
  const showFooter = hasText(dFoot)

  const isMobilePreview = vistaPreview === 'mobile'

  /** Email 3: texto 2 + imagen 1 siempre dos columnas en escritorio (60/40), gap 10px. */
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

  /** Email 3: texto 4 + imagen 2 siempre dos columnas en escritorio (70/30), gap 10px. */
  const gridRowTexto4Img2 = useMemo(() => {
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
      gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 3fr)',
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
      return (
        d?.email3?.logoRuta ||
        d?.email1?.logoRuta ||
        'miniaturas/logo-abc-logistica.svg'
      )
    } catch {
      return 'miniaturas/logo-abc-logistica.svg'
    }
  }, [plantilla])

  const logoSrc = mediaUrl(logoRuta)

  const exportarPdf = async () => {
    if (!previewCardRef.current || exporting) return
    setExporting(true)
    try {
      const canvas = await html2canvas(previewCardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()

      const rgb = hexToRgb(fondoCorreo)
      pdf.setFillColor(rgb.r, rgb.g, rgb.b)
      pdf.rect(0, 0, pageW, pageH, 'F')

      const margen = 40
      const maxW = pageW - margen * 2
      const maxH = pageH - margen * 2
      const ratio = Math.min(maxW / canvas.width, maxH / canvas.height)
      const drawW = canvas.width * ratio
      const drawH = canvas.height * ratio
      const x = (pageW - drawW) / 2
      const y = (pageH - drawH) / 2
      pdf.addImage(imgData, 'PNG', x, y, drawW, drawH, undefined, 'FAST')
      pdf.save(`email-3-${plantilla?.id_externo || 'preview'}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:w-[380px] lg:self-start">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Email 3</h2>
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
          label="Título"
          value={tituloHtml}
          onChange={(v) => setTituloHtml(v)}
          colors={TEXTO_MARCA_HEX}
          placeholder="Título del correo…"
        />

        <RichTextEmailField
          label="Texto 1"
          value={cuerpo1Html}
          onChange={(v) => setCuerpo1Html(v)}
          colors={TEXTO_MARCA_HEX}
          placeholder="Primer cuerpo de texto…"
        />

        <RichTextEmailField
          label="Texto 2"
          value={cuerpo2Html}
          onChange={(v) => setCuerpo2Html(v)}
          colors={TEXTO_MARCA_HEX}
          placeholder="Segundo cuerpo de texto…"
        />

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Fondo cuadro imagen 1
          </label>
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

        <RichTextEmailField
          label="Texto 3"
          value={cuerpo3Html}
          onChange={(v) => setCuerpo3Html(v)}
          colors={TEXTO_MARCA_HEX}
          placeholder="Tercer cuerpo de texto…"
        />

        <RichTextEmailField
          label="Texto 4"
          value={cuerpo4Html}
          onChange={(v) => setCuerpo4Html(v)}
          colors={TEXTO_MARCA_HEX}
          placeholder="Cuarto cuerpo de texto…"
        />

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Fondo cuadro imagen 2
          </label>
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

        <RichTextEmailField
          label="Texto 5"
          value={cuerpo5Html}
          onChange={(v) => setCuerpo5Html(v)}
          colors={TEXTO_MARCA_HEX}
          placeholder="Quinto cuerpo de texto…"
        />

        <RichTextEmailField
          label="Footer (texto enriquecido)"
          value={footerHtml}
          onChange={(v) => setFooterHtml(v)}
          colors={TEXTO_MARCA_HEX}
          placeholder="Legal, contacto..."
        />
      </aside>

      <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
            <button
              type="button"
              onClick={exportarPdf}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Generando PDF…' : 'Exportar PDF A4'}
            </button>
          </div>
        </div>

        <div className="min-h-[480px] flex-1 overflow-auto rounded-xl bg-slate-200/60 p-4">
          <div
            ref={previewCardRef}
            className="mx-auto rounded-2xl p-6 shadow-inner transition-[max-width] duration-200"
            style={{
              backgroundColor: fondoCorreo,
              maxWidth: anchoCard,
            }}
          >
            <div
              className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-md"
              style={{ borderRadius: 16 }}
            >
              <div className="flex w-full items-center justify-center border-b border-slate-100 px-6 py-4">
                <img
                  src={logoSrc}
                  alt="ABC Logística"
                  className="mx-auto h-[52px] w-auto max-w-[min(290px,92%)] object-contain object-center"
                />
              </div>

              <div className="space-y-4 px-6 py-5">
                {showTitle && (
                  <div
                    className={EMAIL_RICH_PREVIEW_TITLE}
                    style={richStyle}
                    dangerouslySetInnerHTML={{ __html: previewTitle }}
                  />
                )}

                {show1 && (
                  <div className={richClass} style={richStyle} dangerouslySetInnerHTML={{ __html: preview1 }} />
                )}

                <div className="w-full max-w-full" style={gridRowTexto2Img1}>
                  <div className={`min-w-0 max-w-full ${richClass}`} style={richStyle}>
                    {show2 ? (
                      <div dangerouslySetInnerHTML={{ __html: preview2 }} />
                    ) : null}
                  </div>
                  <div
                    className="relative min-h-[170px] w-full max-w-full min-w-0 shrink-0 overflow-hidden rounded-2xl"
                    style={{ backgroundColor: bgImg1 }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center text-center text-[11px] font-medium text-slate-700/70">
                      Ilustración Gemini PNG
                    </div>
                  </div>
                </div>

                {show3 && (
                  <div className={richClass} style={richStyle} dangerouslySetInnerHTML={{ __html: preview3 }} />
                )}

                <div className="w-full max-w-full" style={gridRowTexto4Img2}>
                  <div className={`min-w-0 max-w-full ${richClass}`} style={richStyle}>
                    {show4 ? (
                      <div dangerouslySetInnerHTML={{ __html: preview4 }} />
                    ) : null}
                  </div>
                  <div
                    className="relative min-h-[170px] w-full max-w-full min-w-0 shrink-0 overflow-hidden rounded-2xl"
                    style={{ backgroundColor: bgImg2 }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center text-center text-[11px] font-medium text-slate-700/70">
                      Ilustración Gemini PNG
                    </div>
                  </div>
                </div>

                {show5 && (
                  <div className={richClass} style={richStyle} dangerouslySetInnerHTML={{ __html: preview5 }} />
                )}
              </div>

              <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-4">
                {showFooter && (
                  <div
                    className={EMAIL_RICH_PREVIEW_FOOTER}
                    style={{ fontFamily: 'Verdana, Geneva, sans-serif' }}
                    dangerouslySetInnerHTML={{ __html: previewFoot }}
                  />
                )}
                <div className="mt-4 flex justify-center gap-4 text-slate-500">
                  <Facebook className="h-6 w-6 shrink-0" strokeWidth={1.5} aria-hidden />
                  <Linkedin className="h-6 w-6 shrink-0" strokeWidth={1.5} aria-hidden />
                  <Instagram className="h-6 w-6 shrink-0" strokeWidth={1.5} aria-hidden />
                </div>
              </div>
            </div>
          </div>
        </div>

        {(promptImagen1.trim() || promptImagen2.trim()) && (
          <p className="mt-2 text-xs text-amber-800/90">
            <strong>IA (borrador):</strong>{' '}
            {[
              promptImagen1.trim() && `Imagen 1: ${promptImagen1.trim().slice(0, 120)}`,
              promptImagen2.trim() && `Imagen 2: ${promptImagen2.trim().slice(0, 120)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
            {(promptImagen1.length > 120 || promptImagen2.length > 120) && '…'}
          </p>
        )}
      </section>
    </div>
  )
}

function hexToRgb(hex) {
  const h = String(hex).replace('#', '')
  const clean = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = Number.parseInt(clean, 16)
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  }
}
