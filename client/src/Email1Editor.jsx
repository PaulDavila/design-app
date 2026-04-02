import { useMemo, useRef, useState } from 'react'
import { Download, Facebook, Instagram, Linkedin, Monitor, Smartphone } from 'lucide-react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { FONDO_CORREO_HEX, FONDO_CUADRO_IMAGEN_HEX, TEXTO_MARCA_HEX } from './emailPalettes'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { htmlOrPlainToPreview } from './utils/sanitizeEmailHtml'
import RichTextEmailField from './RichTextEmailField.jsx'
import { EMAIL_RICH_PREVIEW_BODY, EMAIL_RICH_PREVIEW_FOOTER } from './emailRichTextClasses.js'

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

export default function Email1Editor({ plantilla }) {
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
  const previewCardRef = useRef(null)
  const [exporting, setExporting] = useState(false)

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

  const anchoCard = vistaPreview === 'mobile' ? 'min(100%, 360px)' : 'min(100%, 600px)'

  const logoRuta = useMemo(() => {
    try {
      const raw = plantilla?.definicion
      const d = typeof raw === 'string' ? JSON.parse(raw) : raw
      return d?.email1?.logoRuta || 'miniaturas/logo-abc-logistica.svg'
    } catch {
      return 'miniaturas/logo-abc-logistica.svg'
    }
  }, [plantilla])

  const logoSrc = mediaUrl(logoRuta)

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
      pdf.save(`email-1-${plantilla?.id_externo || 'preview'}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:w-[380px] lg:self-start">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Email 1</h2>
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
          label="Texto 1"
          value={cuerpo1Html}
          onChange={(v) => setCuerpo1Html(v)}
          colors={TEXTO_MARCA_HEX}
          placeholder="Primer bloque de texto…"
        />

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Fondo cuadro imagen
          </label>
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

        <EmailNanoBananaPromptField
          label="Instrucciones para la IA (imagen)"
          value={promptImagen}
          onChange={setPromptImagen}
          idSuffix="img"
        />
        <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-amber-50/50 p-3">
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
              Zoom ({imagenGeminiSizePct}%): 100 llena el cuadro; más grande recorta bordes; más chico deja margen.
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

        <RichTextEmailField
          label="Texto 2"
          value={cuerpo2Html}
          onChange={(v) => setCuerpo2Html(v)}
          colors={TEXTO_MARCA_HEX}
          placeholder="Segundo bloque de texto…"
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
                {showBlock1 && (
                  <div
                    className={EMAIL_RICH_PREVIEW_BODY}
                    style={{ fontFamily: 'Verdana, Geneva, sans-serif' }}
                    dangerouslySetInnerHTML={{ __html: previewInner1 }}
                  />
                )}

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

        {promptImagen.trim() && (
          <p className="mt-2 text-xs text-amber-800/90">
            <strong>IA (borrador):</strong> {promptImagen.trim().slice(0, 200)}
            {promptImagen.length > 200 ? '…' : ''}
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
