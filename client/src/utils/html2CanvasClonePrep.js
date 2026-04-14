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

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result || ''))
    fr.onerror = () => reject(new Error('FileReader'))
    fr.readAsDataURL(blob)
  })
}

/**
 * html2canvas a veces no pinta <img> aunque haya CORS; pasar a data: evita el fallo (logos / NanoBanana).
 */
export async function inlineRasterImagesAsDataUrls(root) {
  if (!root?.querySelectorAll) return
  const imgs = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src') || ''
      if (!src || src.startsWith('data:')) return
      try {
        const res = await fetch(src, { mode: 'cors', credentials: 'omit', cache: 'force-cache' })
        if (!res.ok) return
        const blob = await res.blob()
        if (!blob || blob.size === 0) return
        const dataUrl = await readBlobAsDataUrl(blob)
        if (!dataUrl.startsWith('data:')) return
        img.removeAttribute('crossorigin')
        img.src = dataUrl
        await img.decode().catch(() => {})
      } catch (e) {
        console.warn('[carrusel jpg] inline img omitido:', src.slice(0, 120), e)
      }
    }),
  )
}

/**
 * - Rich text: márgenes de <p> al quitar Tailwind.
 * - Overflow: el preview usa overflow-hidden en cadenas flex; en export eso recorta texto largo.
 *   Se relaja salvo [data-h2c-clip-art] (imagen IA / SVG con bordes redondos).
 */
export function injectCarruselExportCaptureCss(clonedDoc, clonedExportRoot) {
  if (!(clonedExportRoot instanceof HTMLElement) || !clonedDoc?.createElement) return
  clonedExportRoot.id = EXPORT_ROOT_ID
  const st = clonedDoc.createElement('style')
  st.textContent = `
#${EXPORT_ROOT_ID} {
  overflow: visible !important;
}
#${EXPORT_ROOT_ID} [data-h2c-portada-canvas] {
  overflow: visible !important;
}
#${EXPORT_ROOT_ID} [data-h2c-rich-flow] {
  overflow: visible !important;
  max-height: none !important;
}
#${EXPORT_ROOT_ID} [data-h2c-clip-art] {
  overflow: hidden !important;
  border-radius: 20px;
}
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

/** @deprecated usar injectCarruselExportCaptureCss */
export function injectCarruselRichTextResetCss(clonedDoc, clonedExportRoot) {
  injectCarruselExportCaptureCss(clonedDoc, clonedExportRoot)
}
