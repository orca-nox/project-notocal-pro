import { useState, useCallback, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { useGraphStore } from '@/store/useGraphStore'
import { useCalDAV } from '@/hooks/useCalDAV'
import { formatICalDate } from '@/lib/caldav/dateUtils'
import { serializeNote } from '@/lib/caldav/serializer'
import { Input } from '@/components/ui/input'
import type { Note } from '@/types/entities'
import type { NoteFolder } from './NotesFolderList'

interface NoteQuickAddProps {
  selectedFolder: NoteFolder
  onCreated?: (uid: string) => void
}

export function NoteQuickAdd({ selectedFolder, onCreated }: NoteQuickAddProps) {
  const calendars = useGraphStore((s) => s.calendars)
  const projects = useGraphStore((s) => s.projects)
  const updateEntity = useGraphStore((s) => s.updateEntity)
  const { putNote } = useCalDAV()

  const [title, setTitle] = useState('')

  const defaultCalendarId = useMemo(() => {
    // If we're in a project folder, try to match the project's categories to a calendar
    if (selectedFolder !== 'all' && selectedFolder !== 'unassigned') {
      const project = projects.get(selectedFolder)
      if (project) {
        const match = Array.from(calendars.values()).find(
          (c) => c.displayName === project.categories,
        )
        if (match) return match.id
      }
    }
    // Fallback to first calendar
    const first = Array.from(calendars.values()).sort((a, b) => a.order - b.order)[0]
    return first?.id ?? ''
  }, [selectedFolder, projects, calendars])

  const handleSubmit = useCallback(async () => {
    const trimmed = title.trim()
    if (!trimmed || !defaultCalendarId) return

    const uid = crypto.randomUUID()
    const now = formatICalDate(new Date())

    const relatedTo =
      selectedFolder !== 'all' && selectedFolder !== 'unassigned'
        ? selectedFolder
        : undefined

    const note: Note = {
      uid,
      calendarId: defaultCalendarId,
      dtstamp: now,
      summary: trimmed,
      relatedTo,
      etag: '',
      rawIcs: '',
    }

    // Optimistic update
    updateEntity('note', { ...note, rawIcs: serializeNote(note) })
    setTitle('')

    const result = await putNote(note)
    if (result.ok) {
      updateEntity('note', { ...note, etag: result.etag, rawIcs: serializeNote(note) })
    }

    onCreated?.(uid)
  }, [title, defaultCalendarId, selectedFolder, putNote, updateEntity, onCreated])

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
        }}
        placeholder="New note..."
        className="h-7 text-sm"
      />
    </div>
  )
}
