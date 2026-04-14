import { stripHtml2CanvasCloneDocumentStyles } from './syncCloneComputedColorsForHtml2Canvas.js'

/** Sin Tailwind en el iframe, Nunito debe cargarse aquí para igualar métricas al preview. */
const NUNITO_SANS_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400&display=swap'

/**
 * Tras quitar CSS con oklch, inyecta fuentes usadas en el carrusel y espera a que el documento clon las tenga.
 * html2canvas admite onclone async (devuelve Promise).
 */
export async function prepareHtml2CanvasCloneDocument(clonedDoc) {
  if (!clonedDoc?.head) return
  stripHtml2CanvasCloneDocumentStyles(clonedDoc)
  const link = clonedDoc.createElement('link')
  link.rel = 'stylesheet'
  link.href = NUNITO_SANS_STYLESHEET
  clonedDoc.head.appendChild(link)
  if (clonedDoc.fonts?.ready) {
    try {
      await clonedDoc.fonts.ready
    } catch {
      /* ignore */
    }
  }
  await new Promise((r) => setTimeout(r, 120))
}

const EXPORT_ROOT_ID = 'h2c-carrusel-export-root'

/**
 * Al copiar estilos se eliminan clases; reglas tipo [&_p]:m-0 dejan de aplicar y los <p> ganen margen por defecto.
 */
export function injectCarruselRichTextResetCss(clonedDoc, clonedExportRoot) {
  if (!(clonedExportRoot instanceof HTMLElement) || !clonedDoc?.createElement) return
  clonedExportRoot.id = EXPORT_ROOT_ID
  const st = clonedDoc.createElement('style')
  st.textContent = `
#${EXPORT_ROOT_ID} p { margin: 0 !important; }
#${EXPORT_ROOT_ID} ul, #${EXPORT_ROOT_ID} ol { margin-top: 0.25em; margin-bottom: 0.25em; padding-left: 1.2em; }
#${EXPORT_ROOT_ID} ul { list-style: disc; }
#${EXPORT_ROOT_ID} ol { list-style: decimal; }
#${EXPORT_ROOT_ID} li { margin-top: 0.1em; margin-bottom: 0.1em; }
#${EXPORT_ROOT_ID} em, #${EXPORT_ROOT_ID} i { font-style: italic; }
#${EXPORT_ROOT_ID} strong, #${EXPORT_ROOT_ID} b { font-weight: 900; }
`.trim()
  clonedExportRoot.insertBefore(st, clonedExportRoot.firstChild)
}
