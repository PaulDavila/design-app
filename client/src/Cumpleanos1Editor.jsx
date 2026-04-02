import { useMemo, useRef, useState } from 'react'
import { Download, Facebook, Instagram, Linkedin, Monitor, Smartphone, Trash2 } from 'lucide-react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { FONDO_CORREO_HEX, TEXTO_MARCA_HEX } from './emailPalettes'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { htmlOrPlainToPreview } from './utils/sanitizeEmailHtml'
import RichTextEmailField from './RichTextEmailField.jsx'
import { EMAIL_RICH_PREVIEW_BODY, EMAIL_RICH_PREVIEW_FOOTER } from './emailRichTextClasses.js'

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

const HERO_IMAGE_CUMPLEANOS = `${import.meta.env.BASE_URL}miniaturas/cumpleanos-editor-hero.png`
const HERO_IMAGE_ANIVERSARIOS = `${import.meta.env.BASE_URL}miniaturas/aniversarios-editor-hero.png`

function tarjetaVacia(variant) {
  return variant === 'aniversarios'
    ? { nombre: '', desde: '', area: '' }
    : { fecha: '', nombre: '' }
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

function hexToRgb(hex) {
  const h = String(hex).replace('#', '')
  const clean = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = Number.parseInt(clean, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export default function Cumpleanos1Editor({ plantilla, variant = 'cumpleanos' }) {
  const [accentIdx, setAccentIdx] = useState(0)
  const [titulo, setTitulo] = useState('')
  const [cuerpoHtml, setCuerpoHtml] = useState('<p></p>')
  const [footerHtml, setFooterHtml] = useState('<p></p>')
  const [tablaTarjetas, setTablaTarjetas] = useState(() => [tarjetaVacia(variant)])

  const [vistaPreview, setVistaPreview] = useState('desktop')
  const previewCardRef = useRef(null)
  const [exporting, setExporting] = useState(false)

  const dCuerpo = useDebouncedValue(cuerpoHtml, 220)
  const dFoot = useDebouncedValue(footerHtml, 280)
  const previewCuerpo = useMemo(() => htmlOrPlainToPreview(dCuerpo), [dCuerpo])
  const previewFoot = useMemo(() => htmlOrPlainToPreview(dFoot), [dFoot])

  const accentColor = ACCENT_PALETTE_HEX[accentIdx] ?? ACCENT_PALETTE_HEX[0]
  const fondoCorreo = FONDO_CORREO_HEX[0]

  const showCuerpo = hasText(cuerpoHtml)
  const showFooter = hasText(dFoot)

  const anchoCard = vistaPreview === 'mobile' ? 'min(100%, 360px)' : 'min(100%, 600px)'

  const heading = variant === 'aniversarios' ? 'Aniversarios' : 'Cumpleaños'

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
      const slug = variant === 'aniversarios' ? 'aniversarios-1' : 'cumpleanos-1'
      pdf.save(`${slug}-${plantilla?.id_externo || 'preview'}.pdf`)
    } finally {
      setExporting(false)
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

  const heroSrc = variant === 'aniversarios' ? HERO_IMAGE_ANIVERSARIOS : HERO_IMAGE_CUMPLEANOS
  const esAniversarios = variant === 'aniversarios'

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:w-[380px] lg:self-start">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{heading}</h2>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Color</label>
          <div className="flex flex-wrap gap-2">
            {ACCENT_PALETTE_HEX.map((hex, i) => (
              <button
                key={hex}
                type="button"
                title={hex}
                onClick={() => setAccentIdx(i)}
                className={`h-8 w-8 rounded-md border-2 ${
                  accentIdx === i ? 'border-violet-600 ring-2 ring-violet-200' : 'border-slate-200'
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
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
                  {esAniversarios ? (
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
          </div>
        </div>

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
            style={{ backgroundColor: fondoCorreo, maxWidth: anchoCard }}
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
                {titulo.trim() ? (
                  <div
                    className="text-center text-4xl font-bold leading-snug p-[20px]"
                    style={{ fontFamily: 'Verdana, Geneva, sans-serif', color: accentColor }}
                  >
                    {titulo}
                  </div>
                ) : null}

                {showCuerpo ? (
                  <div className="p-[20px]">
                    <div
                      className={EMAIL_RICH_PREVIEW_BODY}
                      style={{ fontFamily: 'Verdana, Geneva, sans-serif' }}
                      dangerouslySetInnerHTML={{ __html: previewCuerpo }}
                    />
                  </div>
                ) : null}

                <div className="flex w-full justify-center overflow-hidden rounded-2xl">
                  <img
                    src={heroSrc}
                    alt=""
                    className="block w-[90%] max-w-full object-cover"
                  />
                </div>

                <div>
                  <div className="mb-2 h-3" />
                  <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: accentColor, borderWidth: 1 }}>
                    {esAniversarios ? (
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
                <div className="mt-4 flex justify-center gap-4 text-slate-500">
                  <Facebook className="h-6 w-6 shrink-0" strokeWidth={1.5} aria-hidden />
                  <Linkedin className="h-6 w-6 shrink-0" strokeWidth={1.5} aria-hidden />
                  <Instagram className="h-6 w-6 shrink-0" strokeWidth={1.5} aria-hidden />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
