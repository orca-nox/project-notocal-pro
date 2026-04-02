import { useCallback, useMemo, useState } from 'react'
import { Save, Trash2, Plus, X } from 'lucide-react'
import { useEditorForm } from '@/hooks/useEditorForm'
import { useGraphStore } from '@/store/useGraphStore'
import { useUIStore } from '@/store/useUIStore'
import { icalToHtmlDatetime, htmlDatetimeToIcal } from '@/lib/caldav/dateUtils'
import { ConflictBanner } from './ConflictBanner'
import { DraftBanner } from './DraftBanner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { Entity, Task, TaskStatus, SubTask, Prerequisite } from '@/types/entities'

interface TaskFormData extends Record<string, unknown> {
  summary: string
  due: string
  status: TaskStatus
  priority: string // '' for none, '1'-'9' for values
  description: string
  calendarId: string
  relatedTo: string
  subtasks: SubTask[]
  prerequisites: Prerequisite[]
}

function toFormData(entity: Entity): TaskFormData {
  const t = entity as Task
  return {
    summary: t.summary,
    due: t.due ? icalToHtmlDatetime(t.due) : '',
    status: t.status,
    priority: t.priority !== undefined ? String(t.priority) : '',
    description: t.description ?? '',
    calendarId: t.calendarId,
    relatedTo: t.relatedTo ?? '',
    subtasks: [...t.subtasks],
    prerequisites: [...t.prerequisites],
  }
}

function toEntity(formData: TaskFormData, original: Entity): Task {
  const t = original as Task
  return {
    ...t,
    summary: formData.summary,
    due: formData.due ? htmlDatetimeToIcal(formData.due) : undefined,
    status: formData.status,
    priority: formData.priority ? parseInt(formData.priority, 10) : undefined,
    description: formData.description || undefined,
    calendarId: formData.calendarId,
    relatedTo: formData.relatedTo || undefined,
    subtasks: formData.subtasks,
    prerequisites: formData.prerequisites,
  }
}

export function TaskEditor({ task }: { task: Task }) {
  const calendars = useGraphStore((s) => s.calendars)
  const projects = useGraphStore((s) => s.projects)
  const allTasks = useGraphStore((s) => s.tasks)
  const selectEntity = useUIStore((s) => s.selectEntity)

  const form = useEditorForm<TaskFormData>({
    entityType: 'task',
    uid: task.uid,
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

  // Available tasks for prerequisite picker (exclude self and already-selected)
  const availableTasks = useMemo(() => {
    const selectedUids = new Set(form.formData.prerequisites.map((p) => p.uid))
    return Array.from(allTasks.values())
      .filter((t) => t.uid !== task.uid && !selectedUids.has(t.uid))
      .sort((a, b) => a.summary.localeCompare(b.summary))
  }, [allTasks, task.uid, form.formData.prerequisites])

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [prereqSearch, setPrereqSearch] = useState('')

  const handleDelete = useCallback(async () => {
    await form.deleteEntity()
    selectEntity(null)
  }, [form, selectEntity])

  // Sub-task management
  const addSubtask = useCallback(() => {
    form.setField('subtasks', [...form.formData.subtasks, { title: '', completed: false }])
  }, [form])

  const updateSubtask = useCallback((index: number, partial: Partial<SubTask>) => {
    const next = form.formData.subtasks.map((st, i) =>
      i === index ? { ...st, ...partial } : st,
    )
    form.setField('subtasks', next)
  }, [form])

  const removeSubtask = useCallback((index: number) => {
    form.setField('subtasks', form.formData.subtasks.filter((_, i) => i !== index))
  }, [form])

  // Prerequisite management
  const addPrerequisite = useCallback((t: { uid: string; summary: string }) => {
    form.setField('prerequisites', [...form.formData.prerequisites, { uid: t.uid, title: t.summary }])
    setPrereqSearch('')
  }, [form])

  const removePrerequisite = useCallback((uid: string) => {
    form.setField('prerequisites', form.formData.prerequisites.filter((p) => p.uid !== uid))
  }, [form])

  const filteredAvailable = prereqSearch
    ? availableTasks.filter((t) => t.summary.toLowerCase().includes(prereqSearch.toLowerCase()))
    : []

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Edit Task</h2>
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select
              value={form.formData.status}
              onChange={(e) => form.setField('status', e.target.value as TaskStatus)}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="NEEDS-ACTION">Needs Action</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Priority</label>
            <select
              value={form.formData.priority}
              onChange={(e) => form.setField('priority', e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">None</option>
              <option value="1">1 (Highest)</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5 (Medium)</option>
              <option value="6">6</option>
              <option value="7">7</option>
              <option value="8">8</option>
              <option value="9">9 (Lowest)</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Due Date</label>
          <input
            type="datetime-local"
            value={form.formData.due}
            onChange={(e) => form.setField('due', e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <Textarea
            value={form.formData.description}
            onChange={(e) => form.setField('description', e.target.value)}
            className="min-h-[60px] text-sm"
            placeholder="Optional"
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

        {/* Sub-tasks */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Sub-tasks</label>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={addSubtask}>
              <Plus className="mr-1 h-3 w-3" /> Add
            </Button>
          </div>
          {form.formData.subtasks.length > 0 && (
            <div className="space-y-1">
              {form.formData.subtasks.map((st, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox
                    checked={st.completed}
                    onCheckedChange={() => updateSubtask(i, { completed: !st.completed })}
                    className="h-3.5 w-3.5"
                  />
                  <Input
                    value={st.title}
                    onChange={(e) => updateSubtask(i, { title: e.target.value })}
                    className="h-7 flex-1 text-xs"
                    placeholder="Sub-task title"
                  />
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeSubtask(i)}>
                    <X className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Prerequisites */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Prerequisites</label>
          {form.formData.prerequisites.length > 0 && (
            <div className="space-y-1">
              {form.formData.prerequisites.map((p) => (
                <div key={p.uid} className="flex items-center gap-2 rounded-md bg-secondary px-2 py-1 text-xs">
                  <span className="flex-1 truncate">{p.title}</span>
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => removePrerequisite(p.uid)}>
                    <X className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="relative">
            <Input
              value={prereqSearch}
              onChange={(e) => setPrereqSearch(e.target.value)}
              className="h-7 text-xs"
              placeholder="Search tasks to add as prerequisite..."
            />
            {prereqSearch && filteredAvailable.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
                <div className="max-h-32 overflow-y-auto p-1">
                  {filteredAvailable.slice(0, 8).map((t) => (
                    <button
                      key={t.uid}
                      className="w-full rounded-sm px-2 py-1 text-left text-xs hover:bg-accent truncate"
                      onClick={() => addPrerequisite(t)}
                    >
                      {t.summary}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &ldquo;{task.summary}&rdquo;?
            {task.subtasks.length > 0 && ` It has ${task.subtasks.length} sub-task(s).`}
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
