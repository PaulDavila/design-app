import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Printer, Trash2 } from 'lucide-react'

const API_BASE =
  import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '')

function esPendiente(s) {
  return s.estado === 'pendiente_revision' || s.estado == null
}

function esMio(s, userId) {
  return Number(s.creado_por_user_id) === Number(userId)
}

function statsDia(list) {
  if (!list.length) return { clickable: false, todoVerde: false }
  const hayPendiente = list.some((s) => esPendiente(s))
  return { clickable: true, todoVerde: !hayPendiente }
}

function puedeAbrirEditor(viewerRole, s, userId) {
  if (viewerRole === 'admin') return true
  if (!esMio(s, userId)) return false
  if (viewerRole === 'user' && !esPendiente(s)) return false
  return true
}

/** Botones en fila: admin todo lo suyo/ajeno; administrativo solo lo suyo; user solo pendientes propios. */
function puedeAccionesEnFila(viewerRole, s, userId) {
  const mio = esMio(s, userId)
  if (viewerRole === 'admin') return true
  if (!mio) return false
  if (viewerRole === 'user' && !esPendiente(s)) return false
  return true
}

/**
 * @param {object} props
 * @param {number} props.userId
 * @param {'admin'|'administrativo'|'user'} props.viewerRole
 * @param {(solicitudId: number, plantillaId: number, options?: { autoPrintPdf?: boolean, editor_tipo?: string }) => void} props.onAbrirEnEditor
 */
export default function AdminEmailEnviosHomePanel({ userId, viewerRole = 'user', onAbrirEnEditor }) {
  const [solicitudes, setSolicitudes] = useState([])
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date()
    return { y: n.getFullYear(), m: n.getMonth() }
  })
  const [selectedDay, setSelectedDay] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      'X-User-Id': String(userId),
    }),
    [userId]
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

  const loadSolicitudes = useCallback(async () => {
    try {
      const list = await fetchApi('/api/email-envios')
      setSolicitudes(Array.isArray(list) ? list : [])
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la cola')
    }
  }, [fetchApi])

  useEffect(() => {
    void loadSolicitudes()
  }, [loadSolicitudes])

  useEffect(() => {
    const run = () => void loadSolicitudes()
    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', run)
    const intervalId = window.setInterval(run, 6000)
    return () => {
      window.removeEventListener('focus', run)
      document.removeEventListener('visibilitychange', run)
      window.clearInterval(intervalId)
    }
  }, [loadSolicitudes])

  const pendientesCola = useMemo(
    () => solicitudes.filter((s) => esPendiente(s)),
    [solicitudes]
  )

  const cambiarMes = useCallback((fn) => {
    setSelectedDay(null)
    setCalMonth(fn)
  }, [])

  const diasCalendario = useMemo(() => {
    const { y, m } = calMonth
    const first = new Date(y, m, 1)
    const startWeekday = first.getDay()
    const numDays = new Date(y, m + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < startWeekday; i++) cells.push(null)
    for (let d = 1; d <= numDays; d++) cells.push(d)
    return cells
  }, [calMonth])

  const solicitudesPorDia = useMemo(() => {
    const map = new Map()
    for (const s of solicitudes) {
      const dt = new Date(s.fecha_hora_programada)
      if (Number.isNaN(dt.getTime())) continue
      if (dt.getFullYear() !== calMonth.y || dt.getMonth() !== calMonth.m) continue
      const key = dt.getDate()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(s)
    }
    for (const [, arr] of map) {
      arr.sort(
        (a, b) =>
          new Date(a.fecha_hora_programada).getTime() -
          new Date(b.fecha_hora_programada).getTime()
      )
    }
    return map
  }, [solicitudes, calMonth])

  const listaDiaSeleccionado = useMemo(() => {
    if (selectedDay == null) return []
    return solicitudesPorDia.get(selectedDay) || []
  }, [selectedDay, solicitudesPorDia])

  const descartar = async (id) => {
    if (!window.confirm('¿Descartar esta solicitud sin enviar?')) return
    setError('')
    try {
      await fetchApi(`/api/email-envios/${id}/descartar`, { method: 'DELETE' })
      void loadSolicitudes()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descartar')
    }
  }

  const eliminarProgramado = async (id) => {
    if (!window.confirm('¿Eliminar este envío programado del calendario?')) return
    setError('')
    try {
      await fetchApi(`/api/email-envios/${id}/descartar`, { method: 'DELETE' })
      void loadSolicitudes()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  const abrirEnEditor = async (s, options = {}) => {
    if (!onAbrirEnEditor || s.plantilla_id == null) return
    if (!puedeAbrirEditor(viewerRole, s, userId)) return
    setBusyId(s.id)
    setError('')
    try {
      await onAbrirEnEditor(s.id, s.plantilla_id, { ...options, editor_tipo: s.editor_tipo })
      void loadSolicitudes()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el editor')
    } finally {
      setBusyId(null)
    }
  }

  const labelEditarPendiente =
    viewerRole === 'admin' ? 'Abrir en editor' : 'Editar'

  const descripcionPanel =
    viewerRole === 'admin'
      ? 'Cola global de revisión, calendario y envíos por día. El calendario marca en ámbar si falta aprobar algún envío ese día y en verde cuando ya están programados.'
      : viewerRole === 'administrativo'
        ? 'Solo ves correos ya programados en calendario (no la cola de revisión). Editar, eliminar y PDF solo en los tuyos; el resto es informativo.'
        : 'Ves los correos ya programados (todos) y tus borradores en revisión. Solo puedes editar o descartar los tuyos mientras siguen en revisión; una vez programados, todos los envíos (incluidos los tuyos) son solo informativos.'

  const renderAccionesListaDia = (s) => {
    const mio = esMio(s, userId)
    const pend = esPendiente(s)
    const puedeAbrir = puedeAbrirEditor(viewerRole, s, userId)
    const puedeActuar = puedeAccionesEnFila(viewerRole, s, userId)

    if (pend) {
      if (!puedeActuar) return null
      return (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busyId === s.id || !puedeAbrir}
            onClick={() => void abrirEnEditor(s)}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {busyId === s.id ? 'Abriendo…' : labelEditarPendiente}
          </button>
          <button
            type="button"
            onClick={() => void descartar(s.id)}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Descartar
          </button>
        </div>
      )
    }

    if (!puedeActuar) return null

    return (
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busyId === s.id || !puedeAbrir}
          onClick={() => void abrirEnEditor(s)}
          className="rounded-lg border border-emerald-600 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
        >
          {busyId === s.id ? 'Abriendo…' : 'Editar de nuevo'}
        </button>
        <button
          type="button"
          onClick={() => void eliminarProgramado(s.id)}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
        >
          Eliminar
        </button>
        <button
          type="button"
          disabled={busyId === s.id || !puedeAbrir}
          onClick={() => void abrirEnEditor(s, { autoPrintPdf: true })}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          <Printer className="h-3.5 w-3.5" />
          Descargar PDF
        </button>
      </div>
    )
  }

  const calendarioBlock = (
    <div className="space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        Calendario · clica un día con envíos
      </p>
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            className="rounded p-1 hover:bg-white"
            aria-label="Mes anterior"
            onClick={() =>
              cambiarMes((c) => {
                const nm = c.m - 1
                return nm < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: nm }
              })
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-slate-700">
            {new Date(calMonth.y, calMonth.m, 1).toLocaleDateString('es-MX', {
              month: 'long',
              year: 'numeric',
            })}
          </span>
          <button
            type="button"
            className="rounded p-1 hover:bg-white"
            aria-label="Mes siguiente"
            onClick={() =>
              cambiarMes((c) => {
                const nm = c.m + 1
                return nm > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: nm }
              })
            }
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-slate-500">
          {['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'].map((d) => (
            <div key={d} className="font-semibold">
              {d}
            </div>
          ))}
          {diasCalendario.map((day, idx) => {
            if (day == null) return <div key={`e-${idx}`} />
            const list = solicitudesPorDia.get(day) || []
            const { clickable, todoVerde } = statsDia(list)
            const selected = selectedDay === day
            const title = clickable
              ? list
                  .map(
                    (x, i) =>
                      `${i + 1}. #${x.id} ${esPendiente(x) ? '(pendiente)' : '(programado)'} ${new Date(x.fecha_hora_programada).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
                  )
                  .join(' · ')
              : undefined

            if (!clickable) {
              return (
                <div
                  key={day}
                  className="relative min-h-[1.85rem] rounded border border-transparent p-0.5 text-slate-400"
                >
                  <span className="block text-center font-medium">{day}</span>
                </div>
              )
            }

            return (
              <button
                key={day}
                type="button"
                title={title}
                onClick={() => setSelectedDay(day)}
                className={`relative min-h-[1.85rem] rounded border-2 p-0.5 text-slate-800 transition ${
                  todoVerde
                    ? 'border-emerald-500 bg-emerald-100/90 ring-1 ring-emerald-300/80 hover:bg-emerald-100'
                    : 'border-amber-400 bg-amber-50 ring-1 ring-amber-200/80 hover:bg-amber-100/80'
                } ${selected ? 'ring-2 ring-violet-500 ring-offset-1' : ''}`}
              >
                <span className="block text-center font-medium">{day}</span>
                <span
                  className={`absolute bottom-0 right-0.5 text-[9px] font-bold ${
                    todoVerde ? 'text-emerald-800' : 'text-amber-800'
                  }`}
                >
                  {list.length}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  const listaDiaBlock = (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        Envíos del día seleccionado
      </p>
      {selectedDay == null ? (
        <p className="mt-2 text-xs text-slate-500">
          Elige un día del calendario que tenga correos (solo esos días permiten clic).
        </p>
      ) : listaDiaSeleccionado.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">No hay datos para este día.</p>
      ) : (
        <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto text-sm lg:max-h-[28rem]">
          {listaDiaSeleccionado.map((s) => {
            const ok = !esPendiente(s)
            return (
              <li
                key={s.id}
                className={`rounded-xl border-2 p-3 shadow-sm ${
                  ok ? 'border-emerald-500 bg-emerald-50/90' : 'border-amber-400 bg-amber-50/90'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">#{s.id}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      ok ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                    }`}
                  >
                    {ok ? 'Revisado y programado' : 'En revisión'}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  Plantilla #{s.plantilla_id}
                  {s.creado_por_user_id != null ? ` · usuario ${s.creado_por_user_id}` : ''}
                </div>
                <div className="text-xs text-slate-600">
                  {new Date(s.fecha_hora_programada).toLocaleString('es-MX')}
                </div>
                {renderAccionesListaDia(s)}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )

  return (
    <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Correos por enviar</h2>
      <p className="mt-1 text-xs text-slate-500">{descripcionPanel}</p>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {viewerRole === 'admin' && (
        <div className="mt-6 border-b border-slate-200 pb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Pendientes de revisar
          </p>
          {pendientesCola.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No hay solicitudes pendientes de aprobación.</p>
          ) : (
            <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-sm">
              {pendientesCola.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border-2 border-amber-400 bg-amber-50/80 p-3 shadow-sm"
                >
                  <div className="font-medium text-slate-900">#{s.id}</div>
                  <div className="text-xs text-amber-900/80">Falta revisar y programar</div>
                  <div className="text-xs text-slate-600">
                    Plantilla #{s.plantilla_id} ·{' '}
                    {new Date(s.fecha_hora_programada).toLocaleString('es-MX')}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === s.id}
                      onClick={() => void abrirEnEditor(s)}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      {busyId === s.id ? 'Abriendo…' : 'Abrir en editor'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void descartar(s.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Descartar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div>{listaDiaBlock}</div>
        <div>{calendarioBlock}</div>
      </div>
    </section>
  )
}
