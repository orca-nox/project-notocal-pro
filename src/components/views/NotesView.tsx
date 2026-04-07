import { useState, useCallback, useEffect, useRef } from 'react'
import { Search, Maximize2, Minimize2 } from 'lucide-react'
import { useGraphStore } from '@/store/useGraphStore'
import { useUIStore } from '@/store/useUIStore'
import { useCalDAV } from '@/hooks/useCalDAV'
import { NotesFolderList, type NoteFolder } from '@/components/notes/NotesFolderList'
import { NotesNoteList } from '@/components/notes/NotesNoteList'
import { NotesMarkdownEditor } from '@/components/notes/NotesMarkdownEditor'
import { NoteQuickAdd } from '@/components/notes/NoteQuickAdd'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Note } from '@/types/entities'

export function NotesView() {
  const notes = useGraphStore((s) => s.notes)
  const removeEntity = useGraphStore((s) => s.removeEntity)
  const selectedEntityId = useUIStore((s) => s.selectedEntityId)
  const selectEntity = useUIStore((s) => s.selectEntity)
  const notesEditorMode = useUIStore((s) => s.notesEditorMode)
  const setNotesEditorMode = useUIStore((s) => s.setNotesEditorMode)

  const { deleteNote } = useCalDAV()

  const [selectedFolder, setSelectedFolder] = useState<NoteFolder>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)
  const quickAddRef = useRef<HTMLInputElement>(null)

  // N key → focus quick-add input
  useEffect(() => {
    const handler = () => quickAddRef.current?.focus()
    window.addEventListener('notocal:quick-add', handler)
    return () => window.removeEventListener('notocal:quick-add', handler)
  }, [])

  // Delete key → delete selected note
  useEffect(() => {
    const handler = ((e: CustomEvent) => {
      const uid = e.detail?.uid
      if (!uid) return
      const note = notes.get(uid)
      if (note) setDeleteTarget(note)
    }) as EventListener
    window.addEventListener('notocal:delete-selected', handler)
    return () => window.removeEventListener('notocal:delete-selected', handler)
  }, [notes])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    await deleteNote(deleteTarget)
    removeEntity('note', deleteTarget.uid)
    if (selectedEntityId === deleteTarget.uid) selectEntity(null)
    setDeleteTarget(null)
  }, [deleteTarget, deleteNote, removeEntity, selectedEntityId, selectEntity])

  const selectedNote = selectedEntityId ? notes.get(selectedEntityId) : null

  const handleSelectNote = useCallback(
    (uid: string) => {
      selectEntity(uid)
    },
    [selectEntity],
  )

  const handleNoteCreated = useCallback(
    (uid: string) => {
      selectEntity(uid)
    },
    [selectEntity],
  )

  const toggleEditorMode = useCallback(() => {
    setNotesEditorMode(notesEditorMode === 'split' ? 'full' : 'split')
  }, [notesEditorMode, setNotesEditorMode])

  const isFull = notesEditorMode === 'full'

  // Full mode: editor takes over Column 2 entirely
  if (isFull && selectedNote) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
          <h1 className="text-lg font-bold">Notes</h1>
          <span className="text-sm text-muted-foreground truncate">
            — {selectedNote.summary || 'Untitled'}
          </span>
          <button
            onClick={toggleEditorMode}
            className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Exit full editor"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Full-width editor */}
        <div className="flex-1 overflow-hidden">
          <NotesMarkdownEditor key={selectedNote.uid} note={selectedNote} />
        </div>
      </div>
    )
  }

  // Split mode: 3-panel layout
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
        <h1 className="text-lg font-bold">Notes</h1>
        {selectedNote && (
          <button
            onClick={toggleEditorMode}
            className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Full editor mode"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 3-panel body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: folders */}
        <div className="w-44 shrink-0 overflow-y-auto border-r border-border">
          <NotesFolderList
            selectedFolder={selectedFolder}
            onSelectFolder={setSelectedFolder}
          />
        </div>

        {/* Middle panel: note list */}
        <div className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-border">
          {/* Search */}
          <div className="shrink-0 border-b border-border px-2 py-1.5">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="h-7 pl-7 text-xs"
              />
            </div>
          </div>

          {/* Quick add */}
          <div className="shrink-0 border-b border-border">
            <NoteQuickAdd
              selectedFolder={selectedFolder}
              onCreated={handleNoteCreated}
              inputRef={quickAddRef}
            />
          </div>

          {/* Note list */}
          <div className="flex-1 overflow-y-auto">
            <NotesNoteList
              selectedFolder={selectedFolder}
              selectedNoteId={selectedEntityId}
              onSelectNote={handleSelectNote}
              searchQuery={searchQuery}
            />
          </div>
        </div>

        {/* Right panel: markdown editor */}
        <div className="flex-1 overflow-hidden">
          {selectedNote ? (
            <NotesMarkdownEditor key={selectedNote.uid} note={selectedNote} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a note to start editing
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete &ldquo;{deleteTarget?.summary || 'Untitled'}&rdquo;? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
