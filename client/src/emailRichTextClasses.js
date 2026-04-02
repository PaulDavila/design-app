/**
 * Clases Tailwind compartidas para HTML enriquecido en vistas previa de correos
 * (listas ul/ol, enlaces, párrafos).
 */
export const EMAIL_RICH_PREVIEW_BODY =
  'max-w-none text-sm leading-relaxed text-slate-800 [&_a]:text-violet-600 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5'

export const EMAIL_RICH_PREVIEW_TITLE =
  'max-w-none text-lg font-bold leading-snug text-slate-800 [&_a]:text-violet-600 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5'

export const EMAIL_RICH_PREVIEW_FOOTER =
  'max-w-none text-center text-xs leading-relaxed text-slate-600 [&_a]:text-violet-600 [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5'

/** Estilos ProseMirror/TipTap compartidos (listas en el área editable). */
export const EMAIL_RICH_EDITOR_LIST_CLASSES =
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_li]:my-0.5'
