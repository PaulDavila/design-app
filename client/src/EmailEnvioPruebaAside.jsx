const INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-violet-500/20 focus:ring-2'

/**
 * Paso intermedio: vista previa ya visible a la derecha; aquí prueba SMTP y continuar al envío real.
 */
export default function EmailEnvioPruebaAside({
  onVolverEdit,
  onContinuarEnvio,
  correosPrueba,
  onCorreosPruebaChange,
  onEnviarPrueba,
  apiError,
  apiBusy,
  testOkMessage,
}) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onVolverEdit}
        className="text-sm font-medium text-violet-700 hover:underline"
      >
        ← Volver al diseño
      </button>
      <p className="text-xs leading-snug text-slate-600">
        Revisa la vista previa. Opcionalmente envía un correo de prueba: el asunto llevará el prefijo{' '}
        <strong>TEST:</strong> y no cuenta como envío real. Después continúa para programar o enviar de
        verdad.
      </p>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Correos de prueba (separados por comas)
        </label>
        <textarea
          value={correosPrueba}
          onChange={(e) => onCorreosPruebaChange(e.target.value)}
          rows={3}
          placeholder="tu@correo.com, otro@empresa.mx"
          className={INPUT_CLASS}
        />
      </div>
      {testOkMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
          {testOkMessage}
        </p>
      ) : null}
      {apiError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">{apiError}</p>
      ) : null}
      <div className="flex flex-col gap-2 border-t border-slate-200 pt-3">
        <button
          type="button"
          onClick={onEnviarPrueba}
          disabled={apiBusy}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50"
        >
          Enviar correo de prueba
        </button>
        <button
          type="button"
          onClick={onContinuarEnvio}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Continuar al envío real
        </button>
      </div>
    </div>
  )
}
