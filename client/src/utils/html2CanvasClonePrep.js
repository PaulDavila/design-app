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
 * html2canvas 1.4 pinta mal o ignora muchos <img src="data:image/svg+xml"> aunque el fetch sea 200.
 * Rasterizar a PNG en el mismo tamaño de caja evita ese fallo (HAR ya demostraba 200 en logo-portada.svg).
 */
async function blobToDataUrlForCanvas(blob, mimeHint, imgEl) {
  const mime = (mimeHint || blob.type || '').toLowerCase()
  const isSvg = mime.includes('svg') || mime.includes('image/svg')
  if (!isSvg) {
    return readBlobAsDataUrl(blob)
  }

  const wBox = Math.max(2, imgEl.offsetWidth || imgEl.width || 1080)
  const hBox = Math.max(2, imgEl.offsetHeight || imgEl.height || 1080)
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    await new Promise((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = (err) => reject(err || new Error('svg img load'))
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.min(4096, Math.max(wBox, image.naturalWidth || wBox))
    canvas.height = Math.min(4096, Math.max(hBox, image.naturalHeight || hBox))
    const ctx = canvas.getContext('2d')
    if (!ctx) return readBlobAsDataUrl(blob)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } catch {
    return readBlobAsDataUrl(blob)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Sustituye <img> por data URL. SVG → PNG raster (html2canvas); resto → data original.
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
        const mime = res.headers.get('content-type') || blob.type || ''
        const dataUrl = await blobToDataUrlForCanvas(blob, mime, img)
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
 * - Solo [data-h2c-rich-flow]: overflow visible (texto largo). NO tocar la raíz ni el lienzo gris:
 *   forzar overflow:visible ahí rompía el recorte y html2canvas dejaba el área gris “vacía”.
 * - [data-h2c-clip-art]: recorte redondeado solo en capas de arte.
 */
export function injectCarruselExportCaptureCss(clonedDoc, clonedExportRoot) {
  if (!(clonedExportRoot instanceof HTMLElement) || !clonedDoc?.createElement) return
  clonedExportRoot.id = EXPORT_ROOT_ID
  const st = clonedDoc.createElement('style')
  st.textContent = `
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
