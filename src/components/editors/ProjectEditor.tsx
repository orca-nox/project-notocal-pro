import { useCallback, useMemo, useState } from 'react'
import { Save, Trash2 } from 'lucide-react'
import { useEditorForm } from '@/hooks/useEditorForm'
import { useGraphStore } from '@/store/useGraphStore'
import { useUIStore } from '@/store/useUIStore'
import { icalToHtmlDate } from '@/lib/caldav/dateUtils'
import { ConflictBanner } from './ConflictBanner'
import { DraftBanner } from './DraftBanner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { Entity, Project, ProjectStatus } from '@/types/entities'

interface ProjectFormData extends Record<string, unknown> {
  summary: string
  description: string
  dtstart: string // YYYY-MM-DD
  dtend: string
  categories: string
  status: ProjectStatus
  priority: string
}

function htmlDateToIcal(s: string): string | undefined {
  if (!s) return undefined
  return s.replace(/-/g, '')
}

function toFormData(entity: Entity): ProjectFormData {
  const p = entity as Project
  return {
    summary: p.summary,
    description: p.description ?? '',
    dtstart: p.dtstart ? icalToHtmlDate(p.dtstart) : '',
    dtend: p.dtend ? icalToHtmlDate(p.dtend) : '',
    categories: p.categories,
    status: p.status,
    priority: String(p.priority),
  }
}

function toEntity(formData: ProjectFormData, original: Entity): Project {
  const p = original as Project
  return {
    ...p,
    summary: formData.summary,
    description: formData.description || undefined,
    dtstart: htmlDateToIcal(formData.dtstart),
    dtend: htmlDateToIcal(formData.dtend),
    categories: formData.categories,
    status: formData.status,
    priority: parseInt(formData.priority, 10) || 0,
  }
}

export function ProjectEditor({ project }: { project: Project }) {
  const calendars = useGraphStore((s) => s.calendars)
  const selectEntity = useUIStore((s) => s.selectEntity)

  const form = useEditorForm<ProjectFormData>({
    entityType: 'project',
    uid: project.uid,
    toFormData,
    toEntity,
  })

  const calendarsArr = useMemo(
    () => Array.from(calendars.values()).sort((a, b) => a.order - b.order),
    [calendars],
  )

  const [deleteOpen, setDeleteOpen] = useState(false)
  const handleDelete = useCallback(async () => {
    await form.deleteEntity()
    selectEntity(null)
  }, [form, selectEntity])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Edit Project</h2>
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
          <label className="text-xs font-medium text-muted-foreground">Name</label>
          <Input
            value={form.formData.summary}
            onChange={(e) => form.setField('summary', e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <Textarea
            value={form.formData.description}
            onChange={(e) => form.setField('description', e.target.value)}
            className="min-h-[80px] text-sm"
            placeholder="Optional"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Start Date</label>
            <input
              type="date"
              value={form.formData.dtstart}
              onChange={(e) => form.setField('dtstart', e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">End Date</label>
            <input
              type="date"
              value={form.formData.dtend}
              onChange={(e) => form.setField('dtend', e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select
              value={form.formData.status}
              onChange={(e) => form.setField('status', e.target.value as ProjectStatus)}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="Active">Active</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Done">Done</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Priority</label>
            <input
              type="number"
              min="0"
              max="99"
              value={form.formData.priority}
              onChange={(e) => form.setField('priority', e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Primary Context (Calendar)</label>
          <select
            value={form.formData.categories}
            onChange={(e) => form.setField('categories', e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {calendarsArr.map((c) => (
              <option key={c.id} value={c.displayName}>{c.displayName}</option>
            ))}
          </select>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &ldquo;{project.summary}&rdquo;? Child items will become unassigned.
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
