import { useMemo } from 'react'
import { useGraphStore } from '@/store/useGraphStore'
import { icalToDate } from '@/lib/caldav/dateUtils'
import type { NoteFolder } from './NotesFolderList'

interface NotesNoteListProps {
  selectedFolder: NoteFolder
  selectedNoteId: string | null
  onSelectNote: (uid: string) => void
  searchQuery: string
}

function formatDate(dtstamp: string): string {
  try {
    const d = icalToDate(dtstamp)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function snippetFromDescription(desc?: string): string {
  if (!desc) return ''
  // Strip markdown formatting for the preview
  return desc
    .replace(/^#+\s/gm, '')
    .replace(/[*_~`]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .slice(0, 120)
}

export function NotesNoteList({ selectedFolder, selectedNoteId, onSelectNote, searchQuery }: NotesNoteListProps) {
  const notes = useGraphStore((s) => s.notes)

  const filteredNotes = useMemo(() => {
    let arr = Array.from(notes.values())

    // Filter by folder
    if (selectedFolder === 'unassigned') {
      arr = arr.filter((n) => !n.relatedTo)
    } else if (selectedFolder !== 'all') {
      arr = arr.filter((n) => n.relatedTo === selectedFolder)
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      arr = arr.filter(
        (n) =>
          n.summary.toLowerCase().includes(q) ||
          (n.description?.toLowerCase().includes(q) ?? false),
      )
    }

    // Sort by dtstamp descending (newest first)
    arr.sort((a, b) => {
      try {
        return icalToDate(b.dtstamp).getTime() - icalToDate(a.dtstamp).getTime()
      } catch {
        return 0
      }
    })

    return arr
  }, [notes, selectedFolder, searchQuery])

  if (filteredNotes.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
        No notes found.
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {filteredNotes.map((n) => (
        <button
          key={n.uid}
          className={`flex flex-col gap-0.5 border-b border-border px-3 py-2.5 text-left transition-colors ${
            selectedNoteId === n.uid
              ? 'bg-accent'
              : 'hover:bg-accent/50'
          }`}
          onClick={() => onSelectNote(n.uid)}
        >
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-medium">
              {n.summary || 'Untitled'}
            </span>
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
              {formatDate(n.dtstamp)}
            </span>
          </div>
          {n.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {snippetFromDescription(n.description)}
            </p>
          )}
        </button>
      ))}
    </div>
  )
}
