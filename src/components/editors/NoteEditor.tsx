import { useCallback, useMemo, useState } from 'react'
import { Save, Trash2 } from 'lucide-react'
import { useEditorForm } from '@/hooks/useEditorForm'
import { useGraphStore } from '@/store/useGraphStore'
import { useUIStore } from '@/store/useUIStore'
import { ConflictBanner } from './ConflictBanner'
import { DraftBanner } from './DraftBanner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { Entity, Note } from '@/types/entities'

interface NoteFormData extends Record<string, unknown> {
  summary: string
  description: string
  calendarId: string
  relatedTo: string
}

function toFormData(entity: Entity): NoteFormData {
  const n = entity as Note
  return {
    summary: n.summary,
    description: n.description ?? '',
    calendarId: n.calendarId,
    relatedTo: n.relatedTo ?? '',
  }
}

function toEntity(formData: NoteFormData, original: Entity): Note {
  const n = original as Note
  return {
    ...n,
    summary: formData.summary,
    description: formData.description || undefined,
    calendarId: formData.calendarId,
    relatedTo: formData.relatedTo || undefined,
  }
}

export function NoteEditor({ note }: { note: Note }) {
  const calendars = useGraphStore((s) => s.calendars)
  const projects = useGraphStore((s) => s.projects)
  const selectEntity = useUIStore((s) => s.selectEntity)

  const form = useEditorForm<NoteFormData>({
    entityType: 'note',
    uid: note.uid,
    toFormData,
    toEntity,
  })

  const calendarsArr = useMemo(
    () => Array.from(calendars.values()).sort((a, b) => a.order - b.order),
    [calendars],
  )
  const projectsArr = useMemo(
    () => Array.from(projects.values()).sort((a, b) => a.priority - b.priority),
    [projects],
  )

  const [deleteOpen, setDeleteOpen] = useState(false)
  const handleDelete = useCallback(async () => {
    await form.deleteEntity()
    selectEntity(null)
  }, [form, selectEntity])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Edit Note</h2>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={form.save} disabled={form.isSaving}>
            <Save className="mr-1 h-3.5 w-3.5" />
            {form.isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {form.conflict && (
          <ConflictBanner onOverwrite={form.overwrite} onReload={form.reload} isSaving={form.isSaving} />
        )}
        {form.hasDraft && form.draftTimestamp && !form.conflict && (
          <DraftBanner timestamp={form.draftTimestamp} onDiscard={form.discardDraft} />
        )}
        {form.error && (
          <div className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">{form.error}</div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Title</label>
          <Input
            value={form.formData.summary}
            onChange={(e) => form.setField('summary', e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Content</label>
          <Textarea
            value={form.formData.description}
            onChange={(e) => form.setField('description', e.target.value)}
            className="min-h-[200px] text-sm font-mono"
            placeholder="Write your note..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Calendar</label>
            <select
              value={form.formData.calendarId}
              onChange={(e) => form.setField('calendarId', e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {calendarsArr.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Project</label>
            <select
              value={form.formData.relatedTo}
              onChange={(e) => form.setField('relatedTo', e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">None</option>
              {projectsArr.map((p) => (
                <option key={p.uid} value={p.uid}>{p.summary}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &ldquo;{note.summary}&rdquo;? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
