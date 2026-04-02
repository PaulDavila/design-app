import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import { Extension } from '@tiptap/core'
import { EMAIL_RICH_EDITOR_LIST_CLASSES } from './emailRichTextClasses.js'
import { propagateListItemMarkerColor } from './utils/sanitizeEmailHtml.js'

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    }
  },
})

const FONT_SIZES = ['12px', '14px', '16px', '18px', '22px', '28px']

export default function RichTextEmailField({
  label,
  value,
  onChange,
  colors,
  placeholder = 'Escribe aquí...',
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      FontSize,
      TextAlign.configure({ types: ['paragraph'] }),
    ],
    content: value || '<p></p>',
    editorProps: {
      attributes: {
        class: `min-h-[120px] rounded-b-xl border border-t-0 border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none ${EMAIL_RICH_EDITOR_LIST_CLASSES}`,
        style: 'font-family: Verdana, Geneva, sans-serif;',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if ((value || '') !== current) {
      editor.commands.setContent(value || '<p></p>', false)
    }
  }, [editor, value])

  useEffect(() => {
    if (!editor) return
    const sync = () => {
      requestAnimationFrame(() => propagateListItemMarkerColor(editor.view.dom))
    }
    editor.on('update', sync)
    sync()
    return () => editor.off('update', sync)
  }, [editor])

  if (!editor) return null

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2">
        <div className="mb-2 flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5">
          <select
            defaultValue="16px"
            onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
            aria-label="Tamaño de letra"
          >
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size.replace('px', '')} px
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`rounded-md px-2 py-1 text-xs font-semibold ${
              editor.isActive('bold')
                ? 'bg-violet-100 text-violet-900'
                : 'bg-slate-100 text-slate-700'
            }`}
            aria-label="Negrita"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`rounded-md px-2 py-1 text-xs italic ${
              editor.isActive('italic')
                ? 'bg-violet-100 text-violet-900'
                : 'bg-slate-100 text-slate-700'
            }`}
            aria-label="Itálica"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`rounded-md px-2 py-1 text-xs ${
              editor.isActive('bulletList')
                ? 'bg-violet-100 text-violet-900'
                : 'bg-slate-100 text-slate-700'
            }`}
            aria-label="Lista con viñetas"
          >
            • Lista
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`rounded-md px-2 py-1 text-xs ${
              editor.isActive('orderedList')
                ? 'bg-violet-100 text-violet-900'
                : 'bg-slate-100 text-slate-700'
            }`}
            aria-label="Lista numerada"
          >
            1. Lista
          </button>

          <span className="mx-1 h-5 w-px bg-slate-200" />
          {colors.map((hex) => (
            <button
              key={hex}
              type="button"
              title={hex}
              onClick={() => editor.chain().focus().setColor(hex).run()}
              className={`h-5 w-5 rounded border ${
                editor.isActive('textStyle', { color: hex }) ? 'border-black' : 'border-slate-300'
              }`}
              style={{ backgroundColor: hex }}
              aria-label={`Color ${hex}`}
            />
          ))}

          <span className="mx-1 h-5 w-px bg-slate-200" />
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`rounded-md px-2 py-1 text-xs ${
              editor.isActive({ textAlign: 'left' })
                ? 'bg-violet-100 text-violet-900'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            Izq
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`rounded-md px-2 py-1 text-xs ${
              editor.isActive({ textAlign: 'center' })
                ? 'bg-violet-100 text-violet-900'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            Centro
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={`rounded-md px-2 py-1 text-xs ${
              editor.isActive({ textAlign: 'right' })
                ? 'bg-violet-100 text-violet-900'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            Der
          </button>
        </div>
        <EditorContent editor={editor} />
      </div>
      {!value && <p className="text-xs text-slate-400">{placeholder}</p>}
    </div>
  )
}
