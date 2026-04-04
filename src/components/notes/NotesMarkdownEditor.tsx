import { useState, useCallback, useEffect, useRef } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code,
  Minus,
  Eye,
  Pencil,
  Save,
} from 'lucide-react'
import { useGraphStore } from '@/store/useGraphStore'
import { useDraftStore } from '@/store/useDraftStore'
import { useCalDAV } from '@/hooks/useCalDAV'
import { serializeNote } from '@/lib/caldav/serializer'
import type { Note } from '@/types/entities'
import { Button } from '@/components/ui/button'

interface NotesMarkdownEditorProps {
  note: Note
}

type PreviewMode = 'edit' | 'preview'

/** Insert markdown syntax around the selection or at the cursor. */
function insertMarkdown(
  textarea: HTMLTextAreaElement,
  prefix: string,
  suffix = '',
  defaultText = '',
) {
  const { selectionStart, selectionEnd, value } = textarea
  const selected = value.slice(selectionStart, selectionEnd)
  const text = selected || defaultText
  const before = value.slice(0, selectionStart)
  const after = value.slice(selectionEnd)
  const newValue = `${before}${prefix}${text}${suffix}${after}`
  const cursorPos = selectionStart + prefix.length + text.length + suffix.length

  // We need to return the new value and cursor position so the caller can update state
  return { newValue, cursorPos }
}

export function NotesMarkdownEditor({ note }: NotesMarkdownEditorProps) {
  const updateEntity = useGraphStore((s) => s.updateEntity)
  const { putNote } = useCalDAV()
  const saveDraft = useDraftStore((s) => s.saveDraft)
  const clearDraft = useDraftStore((s) => s.clearDraft)

  // Check for existing draft content
  const existingDraft = useDraftStore.getState().getDraft(`note-content:${note.uid}`)
  const [content, setContent] = useState(
    () => (existingDraft?.data?.description as string) ?? note.description ?? '',
  )
  const [previewMode, setPreviewMode] = useState<PreviewMode>('edit')
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(!!existingDraft)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const etagRef = useRef(note.etag)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Reset content when note changes
  useEffect(() => {
    const draft = useDraftStore.getState().getDraft(`note-content:${note.uid}`)
    if (draft) {
      setContent((draft.data?.description as string) ?? '')
      setIsDirty(true)
    } else {
      setContent(note.description ?? '')
      setIsDirty(false)
    }
    etagRef.current = note.etag
  }, [note.uid, note.description, note.etag])

  // Debounced draft save
  const scheduleDraftSave = useCallback(
    (text: string) => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
      draftTimerRef.current = setTimeout(() => {
        saveDraft(`note-content:${note.uid}`, { description: text })
      }, 500)
    },
    [note.uid, saveDraft],
  )

  useEffect(() => {
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    }
  }, [])

  const handleChange = useCallback(
    (value: string) => {
      setContent(value)
      setIsDirty(true)
      scheduleDraftSave(value)
    },
    [scheduleDraftSave],
  )

  const handleSave = useCallback(async () => {
    if (isSaving) return
    setIsSaving(true)

    const updated: Note = { ...note, description: content || undefined }
    const result = await putNote(updated, etagRef.current)

    if (result.ok) {
      const saved = { ...updated, etag: result.etag, rawIcs: serializeNote(updated) }
      updateEntity('note', saved)
      etagRef.current = result.etag
      clearDraft(`note-content:${note.uid}`)
      setIsDirty(false)
    }

    setIsSaving(false)
  }, [note, content, isSaving, putNote, updateEntity, clearDraft])

  // Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  // Toolbar actions
  const applyFormat = useCallback(
    (prefix: string, suffix = '', defaultText = '') => {
      const ta = textareaRef.current
      if (!ta) return
      const { newValue, cursorPos } = insertMarkdown(ta, prefix, suffix, defaultText)
      handleChange(newValue)
      // Restore focus and cursor
      requestAnimationFrame(() => {
        ta.focus()
        ta.setSelectionRange(cursorPos, cursorPos)
      })
    },
    [handleChange],
  )

  const toolbarButtons = [
    { icon: Bold, action: () => applyFormat('**', '**', 'bold'), title: 'Bold' },
    { icon: Italic, action: () => applyFormat('*', '*', 'italic'), title: 'Italic' },
    { sep: true },
    { icon: Heading1, action: () => applyFormat('# ', '', 'Heading'), title: 'Heading 1' },
    { icon: Heading2, action: () => applyFormat('## ', '', 'Heading'), title: 'Heading 2' },
    { icon: Heading3, action: () => applyFormat('### ', '', 'Heading'), title: 'Heading 3' },
    { sep: true },
    { icon: List, action: () => applyFormat('- ', '', 'item'), title: 'Bullet List' },
    { icon: ListOrdered, action: () => applyFormat('1. ', '', 'item'), title: 'Numbered List' },
    { icon: Code, action: () => applyFormat('`', '`', 'code'), title: 'Inline Code' },
    { icon: Minus, action: () => applyFormat('\n---\n'), title: 'Horizontal Rule' },
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-0.5 border-b border-border px-2 py-1">
        {toolbarButtons.map((btn, i) =>
          'sep' in btn ? (
            <div key={i} className="mx-1 h-4 w-px bg-border" />
          ) : (
            <button
              key={i}
              title={btn.title}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              onClick={btn.action}
            >
              <btn.icon className="h-4 w-4" />
            </button>
          ),
        )}

        <div className="ml-auto flex items-center gap-1">
          {/* Edit / Preview toggle */}
          <div className="flex items-center rounded-md border border-border">
            <button
              onClick={() => setPreviewMode('edit')}
              className={`flex items-center gap-1 rounded-l-md px-2 py-0.5 text-xs transition-colors ${
                previewMode === 'edit'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
            <button
              onClick={() => setPreviewMode('preview')}
              className={`flex items-center gap-1 rounded-r-md px-2 py-0.5 text-xs transition-colors ${
                previewMode === 'preview'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
          </div>

          {/* Save button */}
          <Button
            size="sm"
            className="h-6 text-xs"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
          >
            <Save className="mr-1 h-3 w-3" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Editor / Preview */}
      <div className="flex-1 overflow-y-auto">
        {previewMode === 'edit' ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            className="h-full w-full resize-none bg-transparent p-4 font-mono text-sm focus:outline-none"
            placeholder="Write your note in Markdown..."
            spellCheck
          />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none p-4">
            <Markdown remarkPlugins={[remarkGfm]}>{content || '*No content yet.*'}</Markdown>
          </div>
        )}
      </div>

      {/* Dirty indicator */}
      {isDirty && (
        <div className="shrink-0 border-t border-border px-3 py-1 text-[11px] text-muted-foreground">
          Unsaved changes — press Ctrl+S to save
        </div>
      )}
    </div>
  )
}
