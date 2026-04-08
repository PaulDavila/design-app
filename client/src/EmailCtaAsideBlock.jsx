import { FONDO_CUADRO_IMAGEN_HEX } from './emailPalettes'

const INPUT_DT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-violet-500/20 focus:ring-2'

export default function EmailCtaAsideBlock({
  enabled,
  onEnabledChange,
  colorIdx,
  onColorIdxChange,
  text,
  onTextChange,
  url,
  onUrlChange,
  fontSizePx,
  onFontSizeChange,
  align,
  onAlignChange,
  /** Newsletter: sin checkbox; campos siempre visibles. */
  alwaysOn = false,
}) {
  const showFields = alwaysOn || enabled
  return (
    <div className="mt-5 space-y-3 border-b border-slate-100 pb-5">
      {alwaysOn ? (
        <span className="block text-sm font-medium text-slate-800">Botón</span>
      ) : (
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
          />
          Botón
        </label>
      )}
      {showFields ? (
        <div className="space-y-3">
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-600">Alineación</span>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'left', label: 'Izquierda' },
                { id: 'center', label: 'Centro' },
                { id: 'right', label: 'Derecha' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onAlignChange(id)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium ${
                    align === id
                      ? 'border-violet-600 bg-violet-50 text-violet-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-600">Color del botón</span>
            <div className="flex flex-wrap gap-2">
              {FONDO_CUADRO_IMAGEN_HEX.map((hex, i) => (
                <button
                  key={hex}
                  type="button"
                  title={hex}
                  onClick={() => onColorIdxChange(i)}
                  className={`h-8 w-8 rounded-md border-2 ${
                    colorIdx === i ? 'border-violet-600 ring-2 ring-violet-200' : 'border-slate-200'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Texto del enlace</label>
            <input
              type="text"
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Ej. Ver más"
              className={INPUT_DT_CLASS}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://…"
              className={INPUT_DT_CLASS}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Tamaño del texto (px)</label>
            <input
              type="number"
              min={12}
              max={32}
              value={fontSizePx}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10)
                onFontSizeChange(Number.isFinite(n) ? Math.min(32, Math.max(12, n)) : 18)
              }}
              className={INPUT_DT_CLASS}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
