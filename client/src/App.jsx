import { useCallback, useEffect, useMemo, useState } from 'react'

function CarruselPlantillaFooter({ plantilla, onContinuar }) {
  const [value, setValue] = useState('5')
  const editorDisponible =
    plantilla.grupo_layout === 'carrusel_1' ||
    plantilla.grupo_layout === 'carrusel_2' ||
    plantilla.grupo_layout === 'carrusel_numerado'
  const parsed = parseInt(String(value).trim(), 10)
  const num = Number.isFinite(parsed) ? parsed : NaN
  const valid = num >= 1 && num <= 20

  return (
    <>
      <p className="mt-1 text-xs text-slate-500">(1:1) (4:5)</p>
      <p className="mt-1 text-xs text-slate-500">Varios colores</p>
      <p className="mt-2 text-xs leading-snug text-slate-600">
        Cuántos slides necesitas, recuerda contar también la portada:
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={1}
          max={20}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Número de slides (incluye portada)"
          className="w-[4.5rem] rounded-lg border border-slate-200 px-2 py-1.5 text-sm tabular-nums outline-none ring-violet-500/20 focus:ring-2"
        />
        <button
          type="button"
          disabled={!valid || !editorDisponible}
          title={!editorDisponible ? 'Editor disponible pronto para este layout' : undefined}
          onClick={() => {
            if (valid && editorDisponible) onContinuar(plantilla, num)
          }}
          className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continuar
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">Hasta 20 slides</p>
    </>
  )
}
import {
  ArrowLeft,
  Heart,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Mail,
  Search,
  Share2,
} from 'lucide-react'
import AdminEmailEnviosHomePanel from './AdminEmailEnviosHomePanel.jsx'
import Carrusel1Editor from './Carrusel1Editor.jsx'
import Email1Editor from './Email1Editor.jsx'
import Newsletter1Editor from './Newsletter1Editor.jsx'
import { readEmail1IdentityFromSearch } from './email1Identity.js'
import Email2Editor from './Email2Editor.jsx'
import Email3Editor from './Email3Editor.jsx'
import Email4Editor from './Email4Editor.jsx'
import Cumpleanos1Editor from './Cumpleanos1Editor.jsx'
import Aniversarios1Editor from './Aniversarios1Editor.jsx'
import Reconocimientos1Editor from './Reconocimientos1Editor.jsx'

/** En dev, Vite proxy envía /api y /media al backend :4000 */
const API_BASE =
  import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '')

const DEMO_USER_ID = 1

/** Email 1: `VITE_USER_ID` / `VITE_USER_ROLE` (build-time). Si el valor en Railway tiene espacios o es inválido, parseInt da NaN y el API falla. */
const _rawUid = String(import.meta.env.VITE_USER_ID ?? '')
  .trim()
  .replace(/^["']|["']$/g, '')
const _parsedUid = parseInt(_rawUid || String(DEMO_USER_ID), 10)
const EMAIL1_USER_ID =
  Number.isFinite(_parsedUid) && _parsedUid > 0 ? _parsedUid : DEMO_USER_ID

const _rawRole = String(import.meta.env.VITE_USER_ROLE ?? 'user')
  .trim()
  .toLowerCase()
const EMAIL1_ENV_ROLE = ['user', 'admin', 'administrativo'].includes(_rawRole) ? _rawRole : 'user'

function thumbUrl(rutaMiniatura) {
  if (!rutaMiniatura) return ''
  const clean = String(rutaMiniatura).replace(/^\//, '')
  return `${API_BASE}/media/plantillas/${clean}`
}

async function fetchJson(path, options) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || res.statusText)
  }
  if (res.status === 204) return null
  return res.json()
}

function PlantillasGrid({
  items,
  loading,
  error,
  busqueda,
  setBusqueda,
  cargarPlantillas,
  toggleFavorito,
  onClickTarjeta,
  onContinuarCarrusel,
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          {loading ? 'Cargando…' : `${items.length} plantilla(s)`}
        </p>
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && cargarPlantillas()}
            placeholder="Buscar por nombre…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none ring-violet-500/20 focus:ring-2"
          />
        </div>
        <button
          type="button"
          onClick={() => cargarPlantillas()}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Buscar
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-violet-600" />
        </div>
      )}

      {!loading && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => {
            const clicTarjeta =
              onClickTarjeta &&
              !(p.formato_redes === 'carrusel' && typeof onContinuarCarrusel === 'function')
            return (
            <li
              key={p.id}
              className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${
                clicTarjeta ? 'cursor-pointer transition hover:border-violet-300 hover:shadow-md' : ''
              }`}
            >
              <div
                role={clicTarjeta ? 'button' : undefined}
                tabIndex={clicTarjeta ? 0 : undefined}
                onClick={() => clicTarjeta && onClickTarjeta(p)}
                onKeyDown={(e) => {
                  if (clicTarjeta && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onClickTarjeta(p)
                  }
                }}
                className="relative aspect-square bg-slate-100"
              >
                <img
                  src={thumbUrl(p.ruta_miniatura)}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFavorito(p)
                  }}
                  className="absolute right-2 top-2 rounded-full bg-white/90 p-2 shadow-md backdrop-blur hover:bg-white"
                  aria-label={Number(p.es_favorito) === 1 ? 'Quitar favorito' : 'Favorito'}
                >
                  <Heart
                    className={`h-5 w-5 ${
                      Number(p.es_favorito) === 1
                        ? 'fill-red-500 text-red-500'
                        : 'text-slate-400'
                    }`}
                  />
                </button>
              </div>
              <div
                className="p-4 text-left"
                onClick={() => clicTarjeta && onClickTarjeta(p)}
                role={clicTarjeta ? 'button' : undefined}
              >
                <div className="font-medium text-slate-900">{p.nombre}</div>
                {p.categoria === 'avisos_comunicados_emails' && (
                  <p className="mt-1 text-xs text-slate-500">Móvil + Escritorio</p>
                )}
                {p.categoria === 'newsletter' && (
                  <p className="mt-1 text-xs text-slate-500">Móvil + Escritorio</p>
                )}
                {p.categoria === 'redes_sociales' &&
                  p.formato_redes === 'carrusel' &&
                  typeof onContinuarCarrusel === 'function' && (
                    <CarruselPlantillaFooter plantilla={p} onContinuar={onContinuarCarrusel} />
                  )}
                {p.categoria === 'redes_sociales' &&
                  p.formato_redes === 'carrusel' &&
                  typeof onContinuarCarrusel !== 'function' && (
                  <>
                    <p className="mt-1 text-xs text-slate-500">(1:1) (4:5)</p>
                    <p className="mt-1 text-xs text-slate-500">Varios colores</p>
                    <p className="mt-1 text-xs text-slate-500">Hasta 20 slides</p>
                  </>
                )}
                {p.categoria === 'redes_sociales' && p.formato_redes === 'imagen' && (
                  <p className="mt-1 text-xs text-slate-500">(1:1) (9:16)</p>
                )}
                {p.categoria === 'redes_sociales' &&
                  (p.formato_redes === 'portadas_redes_sociales' ||
                    p.formato_redes === 'portadas_google_forms') && (
                    <p className="mt-1 text-xs text-slate-500">Varios Colores</p>
                  )}
                {p.categoria === 'redes_sociales' &&
                  p.formato_redes === 'portadas_redes_sociales' && (
                    <p className="mt-1 text-xs text-slate-500">
                      Para Linked In, Youtube y Facebook
                    </p>
                  )}
              </div>
            </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function App() {
  const email1Identity = readEmail1IdentityFromSearch(EMAIL1_USER_ID, EMAIL1_ENV_ROLE)
  const { userId: email1UserId, role: email1Role } = email1Identity

  const [vista, setVista] = useState('inicio') // … | cumpleanos1_editor | aniversarios1_editor | reconocimientos1_editor
  const [plantillaEmail1, setPlantillaEmail1] = useState(null)
  const [email1OpenFromHome, setEmail1OpenFromHome] = useState(null)
  const [plantillaEmail2, setPlantillaEmail2] = useState(null)
  const [email2OpenFromHome, setEmail2OpenFromHome] = useState(null)
  const [email3OpenFromHome, setEmail3OpenFromHome] = useState(null)
  const [plantillaEmail3, setPlantillaEmail3] = useState(null)
  const [plantillaEmail4, setPlantillaEmail4] = useState(null)
  const [email4OpenFromHome, setEmail4OpenFromHome] = useState(null)
  const [plantillaCarrusel1, setPlantillaCarrusel1] = useState(null)
  const [plantillaCarrusel2, setPlantillaCarrusel2] = useState(null)
  const [plantillaCarruselNumerado, setPlantillaCarruselNumerado] = useState(null)
  const [plantillaCumpleanos1, setPlantillaCumpleanos1] = useState(null)
  const [cumpleanosOpenFromHome, setCumpleanosOpenFromHome] = useState(null)
  const [plantillaAniversarios1, setPlantillaAniversarios1] = useState(null)
  const [aniversariosOpenFromHome, setAniversariosOpenFromHome] = useState(null)
  const [plantillaReconocimientos1, setPlantillaReconocimientos1] = useState(null)
  const [reconocimientosOpenFromHome, setReconocimientosOpenFromHome] = useState(null)
  const [plantillaNewsletter1, setPlantillaNewsletter1] = useState(null)
  const [newsletterOpenFromHome, setNewsletterOpenFromHome] = useState(null)
  const [carruselNumSlides, setCarruselNumSlides] = useState(null)
  const [categoria, setCategoria] = useState(null)
  const [formatoRedes, setFormatoRedes] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  /** Contador real para la tarjeta de inicio (evita texto fijo desalineado con la BD) */
  const [avisosPlantillasCount, setAvisosPlantillasCount] = useState(null)

  const redesMuestraGrid = useMemo(() => {
    if (
      formatoRedes === 'portadas_redes_sociales' ||
      formatoRedes === 'portadas_google_forms'
    )
      return true
    if (formatoRedes === 'carrusel' || formatoRedes === 'imagen') return true
    return false
  }, [formatoRedes])

  const titulo = useMemo(() => {
    if (vista === 'inicio') return 'Plantillas de diseño'
    if (vista === 'email1_editor') return 'Email 1 — Editor'
    if (vista === 'newsletter1_editor') return 'Newsletter — Editor'
    if (vista === 'email2_editor') return 'Email 2 — Editor'
    if (vista === 'email3_editor') return 'Email 3 — Editor'
    if (vista === 'email4_editor') return 'Email 4 — Editor'
    if (vista === 'carrusel1_editor') return 'Carrusel 1 — Editor'
    if (vista === 'carrusel2_editor') return 'Carrusel 2 — Editor'
    if (vista === 'carrusel_numerado_editor') return 'Carrusel Numerado — Editor'
    if (vista === 'cumpleanos1_editor') return 'Cumpleaños — Editor'
    if (vista === 'aniversarios1_editor') return 'Aniversarios — Editor'
    if (vista === 'reconocimientos1_editor') return 'Reconocimientos — Editor'
    if (vista === 'favoritos') return 'Mis favoritos'
    if (categoria === 'avisos_comunicados_emails') return 'Avisos / Comunicados / Emails'
    if (categoria === 'newsletter') return 'Newsletter'
    if (categoria === 'redes_sociales' && formatoRedes === 'portadas_redes_sociales')
      return 'Portadas redes sociales'
    if (categoria === 'redes_sociales' && formatoRedes === 'portadas_google_forms')
      return 'Portadas Google Forms'
    if (categoria === 'redes_sociales' && formatoRedes === 'carrusel') return 'Carrusel'
    if (categoria === 'redes_sociales' && formatoRedes === 'imagen') return 'Imagen'
    if (categoria === 'redes_sociales') return 'Redes sociales'
    return 'Plantillas'
  }, [vista, categoria, formatoRedes])

  const handleEmail1BootstrapDone = useCallback(() => setEmail1OpenFromHome(null), [])
  const handleNewsletterBootstrapDone = useCallback(() => setNewsletterOpenFromHome(null), [])
  const handleEmail2BootstrapDone = useCallback(() => setEmail2OpenFromHome(null), [])
  const handleEmail3BootstrapDone = useCallback(() => setEmail3OpenFromHome(null), [])
  const handleEmail4BootstrapDone = useCallback(() => setEmail4OpenFromHome(null), [])
  const handleCumpleanosBootstrapDone = useCallback(() => setCumpleanosOpenFromHome(null), [])
  const handleAniversariosBootstrapDone = useCallback(() => setAniversariosOpenFromHome(null), [])
  const handleReconocimientosBootstrapDone = useCallback(
    () => setReconocimientosOpenFromHome(null),
    []
  )

  const volverInicioDesdeEmail1 = useCallback(() => {
    setPlantillaEmail1(null)
    setEmail1OpenFromHome(null)
    setVista('inicio')
  }, [])

  const volverInicioDesdeNewsletter = useCallback(() => {
    setPlantillaNewsletter1(null)
    setNewsletterOpenFromHome(null)
    setVista('inicio')
  }, [])

  const volverInicioDesdeEmail2 = useCallback(() => {
    setPlantillaEmail2(null)
    setEmail2OpenFromHome(null)
    setVista('inicio')
  }, [])

  const volverInicioDesdeEmail3 = useCallback(() => {
    setPlantillaEmail3(null)
    setEmail3OpenFromHome(null)
    setVista('inicio')
  }, [])

  const volverInicioDesdeEmail4 = useCallback(() => {
    setPlantillaEmail4(null)
    setEmail4OpenFromHome(null)
    setVista('inicio')
  }, [])

  const volverInicioDesdeCumpleanos = useCallback(() => {
    setPlantillaCumpleanos1(null)
    setCumpleanosOpenFromHome(null)
    setVista('inicio')
  }, [])

  const volverInicioDesdeAniversarios = useCallback(() => {
    setPlantillaAniversarios1(null)
    setAniversariosOpenFromHome(null)
    setVista('inicio')
  }, [])

  const volverInicioDesdeReconocimientos = useCallback(() => {
    setPlantillaReconocimientos1(null)
    setReconocimientosOpenFromHome(null)
    setVista('inicio')
  }, [])

  const abrirEmailRevisionDesdeHome = useCallback(
    async (solicitudId, plantillaId, options = {}) => {
      const plantilla = await fetchJson(
        `/api/plantillas/${plantillaId}?usuario_id=${email1UserId}`
      )
      const boot = {
        solicitudId,
        autoPrintPdf: Boolean(options?.autoPrintPdf),
      }
      const tipo = options.editor_tipo

      setPlantillaEmail1(null)
      setPlantillaEmail2(null)
      setPlantillaEmail3(null)
      setPlantillaEmail4(null)
      setPlantillaCumpleanos1(null)
      setPlantillaAniversarios1(null)
      setPlantillaReconocimientos1(null)
      setPlantillaNewsletter1(null)
      setEmail1OpenFromHome(null)
      setEmail2OpenFromHome(null)
      setEmail3OpenFromHome(null)
      setEmail4OpenFromHome(null)
      setCumpleanosOpenFromHome(null)
      setAniversariosOpenFromHome(null)
      setReconocimientosOpenFromHome(null)
      setNewsletterOpenFromHome(null)

      if (tipo === 'email3') {
        setPlantillaEmail3(plantilla)
        setEmail3OpenFromHome(boot)
        setVista('email3_editor')
      } else if (tipo === 'email2') {
        setPlantillaEmail2(plantilla)
        setEmail2OpenFromHome(boot)
        setVista('email2_editor')
      } else if (tipo === 'email4') {
        setPlantillaEmail4(plantilla)
        setEmail4OpenFromHome(boot)
        setVista('email4_editor')
      } else if (tipo === 'cumpleanos_1') {
        setPlantillaCumpleanos1(plantilla)
        setCumpleanosOpenFromHome(boot)
        setVista('cumpleanos1_editor')
      } else if (tipo === 'aniversarios_1') {
        setPlantillaAniversarios1(plantilla)
        setAniversariosOpenFromHome(boot)
        setVista('aniversarios1_editor')
      } else if (tipo === 'reconocimientos_1') {
        setPlantillaReconocimientos1(plantilla)
        setReconocimientosOpenFromHome(boot)
        setVista('reconocimientos1_editor')
      } else if (tipo === 'newsletter_1') {
        setPlantillaNewsletter1(plantilla)
        setNewsletterOpenFromHome(boot)
        setVista('newsletter1_editor')
      } else {
        setPlantillaEmail1(plantilla)
        setEmail1OpenFromHome(boot)
        setVista('email1_editor')
      }
    },
    [email1UserId]
  )

  const cargarPlantillas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (vista === 'favoritos') {
        params.set('favoritos', '1')
        params.set('usuario_id', String(DEMO_USER_ID))
        if (busqueda.trim()) params.set('q', busqueda.trim())
      } else {
        params.set('usuario_id', String(DEMO_USER_ID))
        if (categoria) params.set('categoria', categoria)
        if (formatoRedes) params.set('formato_redes', formatoRedes)
        if (busqueda.trim()) params.set('q', busqueda.trim())
      }
      const data = await fetchJson(`/api/plantillas?${params}`)
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message || 'Error al cargar')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [vista, categoria, formatoRedes, busqueda])

  const debeCargarLista =
    vista === 'lista' ||
    vista === 'favoritos' ||
    (vista === 'redes' && categoria === 'redes_sociales' && redesMuestraGrid)

  useEffect(() => {
    if (debeCargarLista) void cargarPlantillas()
  }, [debeCargarLista, cargarPlantillas])

  useEffect(() => {
    if (vista !== 'inicio') return
    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams()
        params.set('categoria', 'avisos_comunicados_emails')
        const data = await fetchJson(`/api/plantillas?${params}`)
        if (!cancelled) {
          setAvisosPlantillasCount(Array.isArray(data) ? data.length : 0)
        }
      } catch {
        if (!cancelled) setAvisosPlantillasCount(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [vista])

  const toggleFavorito = async (p) => {
    const favorito = Number(p.es_favorito) === 1
    try {
      if (favorito) {
        await fetchJson(
          `/api/favoritos/${p.id}?usuario_id=${DEMO_USER_ID}`,
          { method: 'DELETE' }
        )
      } else {
        await fetchJson('/api/favoritos', {
          method: 'POST',
          body: JSON.stringify({ plantilla_id: p.id, usuario_id: DEMO_USER_ID }),
        })
      }
      if (favorito && vista === 'favoritos') {
        setItems((prev) => prev.filter((x) => x.id !== p.id))
      } else {
        setItems((prev) =>
          prev.map((x) =>
            x.id === p.id ? { ...x, es_favorito: favorito ? 0 : 1 } : x
          )
        )
      }
    } catch (e) {
      setError(e.message || 'Error favorito')
    }
  }

  const irInicio = () => {
    setVista('inicio')
    setCategoria(null)
    setFormatoRedes(null)
    setBusqueda('')
    setItems([])
    setError(null)
    setPlantillaEmail1(null)
    setEmail1OpenFromHome(null)
    setPlantillaEmail2(null)
    setEmail2OpenFromHome(null)
    setPlantillaEmail3(null)
    setEmail3OpenFromHome(null)
    setPlantillaEmail4(null)
    setEmail4OpenFromHome(null)
    setPlantillaCarrusel1(null)
    setPlantillaCarrusel2(null)
    setPlantillaCarruselNumerado(null)
    setPlantillaCumpleanos1(null)
    setCumpleanosOpenFromHome(null)
    setPlantillaAniversarios1(null)
    setAniversariosOpenFromHome(null)
    setPlantillaReconocimientos1(null)
    setReconocimientosOpenFromHome(null)
    setPlantillaNewsletter1(null)
    setNewsletterOpenFromHome(null)
    setCarruselNumSlides(null)
  }

  const irLista = (cat) => {
    setCategoria(cat)
    setFormatoRedes(null)
    setVista('lista')
  }

  const irFavoritos = () => {
    setCategoria(null)
    setFormatoRedes(null)
    setBusqueda('')
    setItems([])
    setError(null)
    setVista('favoritos')
  }

  const limpiarSeleccionRedes = () => {
    setFormatoRedes(null)
    setBusqueda('')
    setItems([])
    setError(null)
  }

  const handleAtras = () => {
    if (vista === 'carrusel1_editor') {
      setPlantillaCarrusel1(null)
      setPlantillaCarrusel2(null)
      setCarruselNumSlides(null)
      setVista('redes')
      return
    }
    if (vista === 'carrusel2_editor') {
      setPlantillaCarrusel2(null)
      setPlantillaCarrusel1(null)
      setPlantillaCarruselNumerado(null)
      setCarruselNumSlides(null)
      setVista('redes')
      return
    }
    if (vista === 'carrusel_numerado_editor') {
      setPlantillaCarruselNumerado(null)
      setPlantillaCarrusel1(null)
      setPlantillaCarrusel2(null)
      setCarruselNumSlides(null)
      setVista('redes')
      return
    }
    if (vista === 'email1_editor') {
      setPlantillaEmail1(null)
      setEmail1OpenFromHome(null)
      setVista('lista')
      return
    }
    if (vista === 'newsletter1_editor') {
      setPlantillaNewsletter1(null)
      setNewsletterOpenFromHome(null)
      setVista('lista')
      return
    }
    if (vista === 'email2_editor') {
      setPlantillaEmail2(null)
      setEmail2OpenFromHome(null)
      setVista('lista')
      return
    }
    if (vista === 'email3_editor') {
      setPlantillaEmail3(null)
      setEmail3OpenFromHome(null)
      setVista('lista')
      return
    }
    if (vista === 'email4_editor') {
      setPlantillaEmail4(null)
      setEmail4OpenFromHome(null)
      setVista('lista')
      return
    }
    if (vista === 'cumpleanos1_editor') {
      setPlantillaCumpleanos1(null)
      setCumpleanosOpenFromHome(null)
      setVista('lista')
      return
    }
    if (vista === 'aniversarios1_editor') {
      setPlantillaAniversarios1(null)
      setAniversariosOpenFromHome(null)
      setVista('lista')
      return
    }
    if (vista === 'reconocimientos1_editor') {
      setPlantillaReconocimientos1(null)
      setReconocimientosOpenFromHome(null)
      setVista('lista')
      return
    }
    if (vista === 'favoritos') {
      irInicio()
      return
    }
    if (vista === 'redes') {
      if (redesMuestraGrid) {
        limpiarSeleccionRedes()
        return
      }
      irInicio()
      return
    }
    if (vista === 'lista') {
      irInicio()
      return
    }
    irInicio()
  }

  const abrirPortadasRedes = () => {
    setCategoria('redes_sociales')
    setFormatoRedes('portadas_redes_sociales')
    setVista('redes')
  }

  const abrirPortadasGoogle = () => {
    setCategoria('redes_sociales')
    setFormatoRedes('portadas_google_forms')
    setVista('redes')
  }

  const seleccionarFormatoRed = (formato) => {
    setCategoria('redes_sociales')
    setFormatoRedes(formato)
    setVista('redes')
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div
          className={`mx-auto flex items-center gap-3 px-4 py-3 ${
            vista === 'email1_editor' ||
            vista === 'newsletter1_editor' ||
            vista === 'email2_editor' ||
            vista === 'email3_editor' ||
            vista === 'email4_editor' ||
            vista === 'carrusel1_editor' ||
            vista === 'carrusel2_editor' ||
            vista === 'carrusel_numerado_editor' ||
            vista === 'cumpleanos1_editor' ||
            vista === 'aniversarios1_editor' ||
            vista === 'reconocimientos1_editor'
              ? 'max-w-[1600px]'
              : 'max-w-6xl'
          }`}
        >
          {vista !== 'inicio' && (
            <button
              type="button"
              onClick={handleAtras}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Atrás
            </button>
          )}
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">{titulo}</h1>
        </div>
      </header>

      <main
        className={`mx-auto px-4 py-8 ${
          vista === 'email1_editor' ||
          vista === 'newsletter1_editor' ||
          vista === 'email2_editor' ||
          vista === 'email3_editor' ||
          vista === 'email4_editor' ||
          vista === 'carrusel1_editor' ||
          vista === 'carrusel2_editor' ||
          vista === 'carrusel_numerado_editor' ||
          vista === 'cumpleanos1_editor' ||
          vista === 'aniversarios1_editor' ||
          vista === 'reconocimientos1_editor'
            ? 'max-w-[1600px]'
            : 'max-w-6xl'
        }`}
      >
        {vista === 'carrusel1_editor' && plantillaCarrusel1 && (
          <Carrusel1Editor
            plantilla={plantillaCarrusel1}
            numSlidesTotal={carruselNumSlides ?? undefined}
          />
        )}
        {vista === 'carrusel2_editor' && plantillaCarrusel2 && (
          <Carrusel1Editor
            plantilla={plantillaCarrusel2}
            numSlidesTotal={carruselNumSlides ?? undefined}
          />
        )}
        {vista === 'carrusel_numerado_editor' && plantillaCarruselNumerado && (
          <Carrusel1Editor
            plantilla={plantillaCarruselNumerado}
            numSlidesTotal={carruselNumSlides ?? undefined}
          />
        )}

        {vista === 'email1_editor' && plantillaEmail1 && (
          <Email1Editor
            plantilla={plantillaEmail1}
            userId={email1UserId}
            role={email1Role}
            bootstrapSolicitudId={email1OpenFromHome?.solicitudId ?? null}
            bootstrapAutoPrintPdf={email1OpenFromHome?.autoPrintPdf ?? false}
            onBootstrapSolicitudDone={handleEmail1BootstrapDone}
            onVolverAlInicio={volverInicioDesdeEmail1}
          />
        )}

        {vista === 'newsletter1_editor' && plantillaNewsletter1 && (
          <Newsletter1Editor
            plantilla={plantillaNewsletter1}
            userId={email1UserId}
            role={email1Role}
            bootstrapSolicitudId={newsletterOpenFromHome?.solicitudId ?? null}
            bootstrapAutoPrintPdf={newsletterOpenFromHome?.autoPrintPdf ?? false}
            onBootstrapSolicitudDone={handleNewsletterBootstrapDone}
            onVolverAlInicio={volverInicioDesdeNewsletter}
          />
        )}

        {vista === 'email2_editor' && plantillaEmail2 && (
          <Email2Editor
            plantilla={plantillaEmail2}
            userId={email1UserId}
            role={email1Role}
            bootstrapSolicitudId={email2OpenFromHome?.solicitudId ?? null}
            bootstrapAutoPrintPdf={email2OpenFromHome?.autoPrintPdf ?? false}
            onBootstrapSolicitudDone={handleEmail2BootstrapDone}
            onVolverAlInicio={volverInicioDesdeEmail2}
          />
        )}

        {vista === 'email3_editor' && plantillaEmail3 && (
          <Email3Editor
            plantilla={plantillaEmail3}
            userId={email1UserId}
            role={email1Role}
            bootstrapSolicitudId={email3OpenFromHome?.solicitudId ?? null}
            bootstrapAutoPrintPdf={email3OpenFromHome?.autoPrintPdf ?? false}
            onBootstrapSolicitudDone={handleEmail3BootstrapDone}
            onVolverAlInicio={volverInicioDesdeEmail3}
          />
        )}

        {vista === 'email4_editor' && plantillaEmail4 && (
          <Email4Editor
            plantilla={plantillaEmail4}
            userId={email1UserId}
            role={email1Role}
            bootstrapSolicitudId={email4OpenFromHome?.solicitudId ?? null}
            bootstrapAutoPrintPdf={email4OpenFromHome?.autoPrintPdf ?? false}
            onBootstrapSolicitudDone={handleEmail4BootstrapDone}
            onVolverAlInicio={volverInicioDesdeEmail4}
          />
        )}
        {vista === 'cumpleanos1_editor' && plantillaCumpleanos1 && (
          <Cumpleanos1Editor
            plantilla={plantillaCumpleanos1}
            userId={email1UserId}
            role={email1Role}
            bootstrapSolicitudId={cumpleanosOpenFromHome?.solicitudId ?? null}
            bootstrapAutoPrintPdf={cumpleanosOpenFromHome?.autoPrintPdf ?? false}
            onBootstrapSolicitudDone={handleCumpleanosBootstrapDone}
            onVolverAlInicio={volverInicioDesdeCumpleanos}
          />
        )}
        {vista === 'aniversarios1_editor' && plantillaAniversarios1 && (
          <Aniversarios1Editor
            plantilla={plantillaAniversarios1}
            userId={email1UserId}
            role={email1Role}
            bootstrapSolicitudId={aniversariosOpenFromHome?.solicitudId ?? null}
            bootstrapAutoPrintPdf={aniversariosOpenFromHome?.autoPrintPdf ?? false}
            onBootstrapSolicitudDone={handleAniversariosBootstrapDone}
            onVolverAlInicio={volverInicioDesdeAniversarios}
          />
        )}
        {vista === 'reconocimientos1_editor' && plantillaReconocimientos1 && (
          <Reconocimientos1Editor
            plantilla={plantillaReconocimientos1}
            userId={email1UserId}
            role={email1Role}
            bootstrapSolicitudId={reconocimientosOpenFromHome?.solicitudId ?? null}
            bootstrapAutoPrintPdf={reconocimientosOpenFromHome?.autoPrintPdf ?? false}
            onBootstrapSolicitudDone={handleReconocimientosBootstrapDone}
            onVolverAlInicio={volverInicioDesdeReconocimientos}
          />
        )}

        {vista === 'inicio' && (
          <div className="space-y-0">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => irLista('avisos_comunicados_emails')}
                className="group flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <Mail className="h-6 w-6" />
                </span>
                <span className="text-base font-semibold text-slate-900">
                  Avisos / Comunicados / Emails
                </span>
                <span className="text-sm text-slate-500">
                  {avisosPlantillasCount == null
                    ? '…'
                    : `${avisosPlantillasCount} plantilla${avisosPlantillasCount === 1 ? '' : 's'}`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => irLista('newsletter')}
                className="group flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <LayoutGrid className="h-6 w-6" />
                </span>
                <span className="text-base font-semibold text-slate-900">Newsletter</span>
                <span className="text-sm text-slate-500">1 plantilla</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCategoria('redes_sociales')
                  setFormatoRedes(null)
                  setItems([])
                  setBusqueda('')
                  setError(null)
                  setVista('redes')
                }}
                className="group flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                  <Share2 className="h-6 w-6" />
                </span>
                <span className="text-base font-semibold text-slate-900">Redes sociales</span>
                <span className="text-sm text-slate-500">Carrusel, imagen y portadas</span>
              </button>

              <button
                type="button"
                onClick={irFavoritos}
                className="group flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-rose-200 hover:shadow-md"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <Heart className="h-6 w-6" />
                </span>
                <span className="text-base font-semibold text-slate-900">Mis favoritos</span>
                <span className="text-sm text-slate-500">Plantillas guardadas</span>
              </button>
            </div>

            <AdminEmailEnviosHomePanel
              userId={email1UserId}
              viewerRole={email1Role}
              onAbrirEnEditor={abrirEmailRevisionDesdeHome}
            />
          </div>
        )}

        {vista === 'redes' && (
          <div className="space-y-10">
            <section>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">
                Portadas globales
              </h2>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={abrirPortadasRedes}
                  className={`w-full rounded-2xl border px-4 py-4 text-left shadow-sm transition hover:shadow md:w-auto md:min-w-[260px] ${
                    formatoRedes === 'portadas_redes_sociales'
                      ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200'
                      : 'border-slate-200 bg-white hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ImageIcon className="h-8 w-8 text-amber-600" />
                    <div>
                      <div className="font-semibold text-slate-900">Portadas redes sociales</div>
                      <div className="text-sm text-slate-500">LinkedIn, YouTube, Facebook</div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={abrirPortadasGoogle}
                  className={`w-full rounded-2xl border px-4 py-4 text-left shadow-sm transition hover:shadow md:w-auto md:min-w-[260px] ${
                    formatoRedes === 'portadas_google_forms'
                      ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200'
                      : 'border-slate-200 bg-white hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ImageIcon className="h-8 w-8 text-amber-600" />
                    <div>
                      <div className="font-semibold text-slate-900">Portadas Google Forms</div>
                      <div className="text-sm text-slate-500">Encabezado de formularios</div>
                    </div>
                  </div>
                </button>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-medium text-slate-600">
                Para redes sociales (Instagram, LinkedIn, Facebook):
              </h2>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'carrusel', label: 'Carrusel' },
                  { id: 'imagen', label: 'Imagen' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => seleccionarFormatoRed(f.id)}
                    className={`rounded-xl border px-4 py-3 text-left text-sm font-medium shadow-sm transition hover:shadow ${
                      formatoRedes === f.id
                        ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-violet-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </section>

            {redesMuestraGrid && (
              <section className="border-t border-slate-200 pt-10">
                <PlantillasGrid
                  items={items}
                  loading={loading}
                  error={error}
                  busqueda={busqueda}
                  setBusqueda={setBusqueda}
                  cargarPlantillas={cargarPlantillas}
                  toggleFavorito={toggleFavorito}
                  onContinuarCarrusel={
                    formatoRedes === 'carrusel'
                      ? (p, slides) => {
                          if (
                            p.grupo_layout !== 'carrusel_1' &&
                            p.grupo_layout !== 'carrusel_2' &&
                            p.grupo_layout !== 'carrusel_numerado'
                          )
                            return
                          setCarruselNumSlides(slides)
                          if (p.grupo_layout === 'carrusel_numerado') {
                            setPlantillaCarruselNumerado(p)
                            setPlantillaCarrusel1(null)
                            setPlantillaCarrusel2(null)
                            setVista('carrusel_numerado_editor')
                            return
                          }
                          if (p.grupo_layout === 'carrusel_2') {
                            setPlantillaCarrusel2(p)
                            setPlantillaCarruselNumerado(null)
                            setPlantillaCarrusel1(null)
                            setVista('carrusel2_editor')
                            return
                          }
                          setPlantillaCarrusel1(p)
                          setPlantillaCarrusel2(null)
                          setPlantillaCarruselNumerado(null)
                          setVista('carrusel1_editor')
                        }
                      : undefined
                  }
                />
              </section>
            )}
          </div>
        )}

        {vista === 'lista' && (
          <PlantillasGrid
            items={items}
            loading={loading}
            error={error}
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            cargarPlantillas={cargarPlantillas}
            toggleFavorito={toggleFavorito}
            onClickTarjeta={
              categoria === 'avisos_comunicados_emails'
                ? (p) => {
                    if (p.grupo_layout === 'email_1' || p.nombre === 'Email 1') {
                      setPlantillaEmail1(p)
                      setVista('email1_editor')
                    } else if (p.grupo_layout === 'email_2' || p.nombre === 'Email 2') {
                      setPlantillaEmail2(p)
                      setVista('email2_editor')
                    } else if (p.grupo_layout === 'email_3' || p.nombre === 'Email 3') {
                      setPlantillaEmail3(p)
                      setVista('email3_editor')
                    } else if (p.grupo_layout === 'email_4' || p.nombre === 'Email 4') {
                      setPlantillaEmail4(p)
                      setVista('email4_editor')
                    } else if (p.grupo_layout === 'cumpleanos_1' || p.nombre === 'Cumpleaños') {
                      setPlantillaCumpleanos1(p)
                      setVista('cumpleanos1_editor')
                    } else if (p.grupo_layout === 'aniversarios_1' || p.nombre === 'Aniversarios') {
                      setPlantillaAniversarios1(p)
                      setVista('aniversarios1_editor')
                    } else if (
                      p.grupo_layout === 'reconocimientos_1' ||
                      p.nombre === 'Reconocimientos'
                    ) {
                      setPlantillaReconocimientos1(p)
                      setVista('reconocimientos1_editor')
                    }
                  }
                : categoria === 'newsletter'
                  ? (p) => {
                      if (p.grupo_layout === 'newsletter_1' || p.nombre === 'Newsletter 1') {
                        setPlantillaNewsletter1(p)
                        setVista('newsletter1_editor')
                      }
                    }
                  : undefined
            }
          />
        )}

        {vista === 'favoritos' && (
          <PlantillasGrid
            items={items}
            loading={loading}
            error={error}
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            cargarPlantillas={cargarPlantillas}
            toggleFavorito={toggleFavorito}
          />
        )}
      </main>
    </div>
  )
}
