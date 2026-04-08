/**
 * ============================================================================
 * GUÍA MUY CONCRETA — Diagnóstico PDF Email 1
 * ============================================================================
 *
 * DÓNDE ESTÁ ESTE ARCHIVO (para abrirlo en Cursor):
 *   Carpeta del proyecto → design-app → client → src → email1PdfDiagnostics.js
 *   Ruta completa de ejemplo en tu Mac:
 *   .../ABCLOGISTICA/design-app/client/src/email1PdfDiagnostics.js
 *
 * CÓMO ABRIRLO EN CURSOR:
 *   1) Clic en el ícono de carpetas a la izquierda (Explorador).
 *   2) Despliega: design-app → client → src
 *   3) Haz clic en "email1PdfDiagnostics.js"
 *
 * ----------------------------------------------------------------------------
 * PRUEBA A — Ver números en la consola (NO tienes que cambiar nada si usas dev)
 * ----------------------------------------------------------------------------
 *   1) En una terminal: cd design-app/client  y  npm run dev  (modo desarrollo).
 *   2) Abre el navegador en la app (ej. localhost:5173).
 *   3) Pulsa F12 (o clic derecho → Inspeccionar).
 *   4) Arriba en DevTools elige la pestaña "Console" / "Consola".
 *   5) Ve al editor Email 1 y pulsa "Exportar PDF A4".
 *   6) Debes ver líneas que empiezan por [PDF-DIAG] (A1, A2, B0).
 *      Si NO ves [PDF-DIAG] pero sí el error oklch: escríbenos; puede que no
 *      estés en npm run dev sino en otro entorno.
 *
 * ----------------------------------------------------------------------------
 * PRUEBA B — Solo si quieres probar "sin CSS en el iframe del clon"
 * ----------------------------------------------------------------------------
 *   1) Abre ESTE archivo (email1PdfDiagnostics.js).
 *   2) Busca la línea (más abajo) que dice exactamente:
 *        export const PDF_DIAG_STRIP_CLONE_STYLES = false
 *   3) Cámbiala a:
 *        export const PDF_DIAG_STRIP_CLONE_STYLES = true
 *   4) Guarda el archivo (Cmd+S en Mac, Ctrl+S en Windows).
 *   5) En el navegador recarga la página del editor (F5).
 *   6) Exportar PDF otra vez. ¿Descarga PDF o sigue el error?
 *   7) Vuelve a poner false y guarda (no dejes true para siempre).
 *
 * ----------------------------------------------------------------------------
 * PRUEBA C — Más texto de html2canvas en consola
 * ----------------------------------------------------------------------------
 *   1) En ESTE archivo, busca:
 *        export const PDF_DIAG_HTML2CANVAS_LOGGING = false
 *   2) Cámbiala a true. Guarda. F5 en el navegador. Exportar PDF.
 *   3) Vuelve a false cuando acabes.
 *
 * ----------------------------------------------------------------------------
 * PRUEBA D — Pausar donde revienta (Chrome / Edge)
 * ----------------------------------------------------------------------------
 *   1) F12 → pestaña "Sources" / "Fuentes".
 *   2) A la derecha busca un ícono de pausa con un rayo (break on exceptions).
 *   3) Activa "Pause on uncaught exceptions" (pausar en excepciones no capturadas).
 *   4) Pulsa Exportar PDF. El navegador se detiene en html2canvas.
 *   5) Panel derecho "Scope": busca variables cuyo valor contenga "oklch".
 *
 * ============================================================================
 */

/**
 * En `npm run dev` esto es true SIN editar nada → verás [PDF-DIAG] en consola.
 * En build de producción es false.
 */
export const PDF_DIAG_LOG_CLONE = import.meta.env.DEV

/** Prueba B: edita a true solo para la prueba, luego false. */
export const PDF_DIAG_STRIP_CLONE_STYLES = false

/** Prueba C: edita a true solo para la prueba, luego false. */
export const PDF_DIAG_HTML2CANVAS_LOGGING = false

export function stripCloneDocumentStylesForPdfDiag(doc) {
  if (!doc) return
  doc.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => el.remove())
}

export function runEmail1PdfDiagnostics(clonedRoot, cloneDocument) {
  const tag = '[PDF-DIAG]'

  if (!(clonedRoot instanceof HTMLElement)) {
    console.warn(`${tag} raíz clon no es HTMLElement`, clonedRoot)
    return
  }

  const withClass = clonedRoot.querySelectorAll('[class]')
  console.group(`${tag} A1 — clases restantes en subárbol clonado (ideal: 0)`)
  console.log('count:', withClass.length)
  withClass.forEach((el, i) => {
    if (i < 20) console.log(String(i), el.tagName, el.className)
  })
  if (withClass.length > 20) console.log(`… y ${withClass.length - 20} nodos más con class`)
  console.groupEnd()

  const oklchInline = []
  const tw = cloneDocument.createTreeWalker(clonedRoot, NodeFilter.SHOW_ELEMENT)
  while (tw.nextNode()) {
    const el = tw.currentNode
    const st = el.getAttribute('style')
    if (st && /oklch/i.test(st)) {
      oklchInline.push({ tag: el.tagName, style: st.slice(0, 200) })
    }
  }
  console.group(`${tag} A2 — atributo style con "oklch" (ideal: 0)`)
  console.log('count:', oklchInline.length, oklchInline)
  console.groupEnd()

  if (cloneDocument) {
    const sheets = cloneDocument.querySelectorAll('link[rel="stylesheet"], style')
    console.group(`${tag} B0 — <link stylesheet> + <style> en el documento del clon`)
    console.log('count:', sheets.length)
    sheets.forEach((n, i) => {
      const href = n.getAttribute?.('href')
      const preview = href || (n.textContent || '').replace(/\s+/g, ' ').slice(0, 100)
      console.log(String(i), n.tagName, preview)
    })
    console.groupEnd()
  }
}
