import { useCallback, useMemo, useState } from 'react'
import { Save, Trash2, X, Plus, Search } from 'lucide-react'
import { useEditorForm } from '@/hooks/useEditorForm'
import { useGraphStore } from '@/store/useGraphStore'
import { useUIStore } from '@/store/useUIStore'
import { useCalDAV } from '@/hooks/useCalDAV'
import { icalToHtmlDatetime, htmlDatetimeToIcal, formatICalDate } from '@/lib/caldav/dateUtils'
import { serializeTask } from '@/lib/caldav/serializer'
import { ConflictBanner } from './ConflictBanner'
import { DraftBanner } from './DraftBanner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { Entity, Task, TaskStatus, TaskRef } from '@/types/entities'

interface TaskFormData extends Record<string, unknown> {
  summary: string
  due: string
  status: TaskStatus
  priority: string // '' for none, '1'-'9' for values
  description: string
  calendarId: string
  relatedTo: string
  prerequisites: TaskRef[]
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
    prerequisites: formData.prerequisites,
  }
}

// ---------------------------------------------------------------------------
// Shared task-picker component for both subtasks and prerequisites
// ---------------------------------------------------------------------------

interface TaskPickerProps {
  label: string
  tasks: TaskRef[]
  allTasks: Map<string, Task>
  excludeUids: Set<string>
  currentTaskUid: string
  onAdd: (ref: TaskRef) => void
  onCreate: (title: string) => void
  onRemove: (uid: string) => void
  onToggle?: (uid: string) => void
  onNavigate?: (uid: string) => void
  showStatus?: boolean
}

function TaskPicker({
  label,
  tasks,
  allTasks,
  excludeUids,
  currentTaskUid,
  onAdd,
  onCreate,
  onRemove,
  onToggle,
  onNavigate,
  showStatus,
}: TaskPickerProps) {
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'search' | 'create'>('search')

  const availableTasks = useMemo(() => {
    if (!search) return []
    const q = search.toLowerCase()
    return Array.from(allTasks.values())
      .filter((t) => t.uid !== currentTaskUid && !excludeUids.has(t.uid) && t.summary.toLowerCase().includes(q))
      .slice(0, 8)
  }, [allTasks, search, currentTaskUid, excludeUids])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim()) {
      e.preventDefault()
      if (mode === 'create') {
        onCreate(search.trim())
        setSearch('')
      } else if (availableTasks.length > 0) {
        onAdd({ uid: availableTasks[0].uid, title: availableTasks[0].summary })
        setSearch('')
      }
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <div className="flex items-center gap-0.5">
          <Button
            size="sm"
            variant={mode === 'search' ? 'secondary' : 'ghost'}
            className="h-5 px-1.5 text-[10px]"
            onClick={() => setMode('search')}
            title="Search existing tasks"
          >
            <Search className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant={mode === 'create' ? 'secondary' : 'ghost'}
            className="h-5 px-1.5 text-[10px]"
            onClick={() => setMode('create')}
            title="Create new task"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {tasks.length > 0 && (
        <div className="space-y-1">
          {tasks.map((ref) => {
            const resolved = allTasks.get(ref.uid)
            const title = resolved?.summary ?? ref.title
            const isCompleted = resolved?.status === 'COMPLETED'
            return (
              <div key={ref.uid} className="flex items-center gap-2 rounded-md bg-secondary px-2 py-1 text-xs">
                {showStatus && onToggle && (
                  <Checkbox
                    checked={isCompleted}
                    onCheckedChange={() => onToggle(ref.uid)}
                    className="h-3.5 w-3.5"
                  />
                )}
                <span
                  className={`flex-1 truncate ${isCompleted && showStatus ? 'line-through text-muted-foreground' : ''} ${onNavigate ? 'cursor-pointer hover:underline' : ''}`}
                  onClick={() => onNavigate?.(ref.uid)}
                >
                  {title}
                </span>
                <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => onRemove(ref.uid)}>
                  <X className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <div className="relative">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 text-xs"
          placeholder={mode === 'search' ? `Search tasks to add as ${label.toLowerCase()}...` : `Type name and press Enter to create...`}
        />
        {mode === 'search' && search && availableTasks.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
            <div className="max-h-32 overflow-y-auto p-1">
              {availableTasks.map((t) => (
                <button
                  key={t.uid}
                  className="w-full rounded-sm px-2 py-1 text-left text-xs hover:bg-accent truncate"
                  onClick={() => { onAdd({ uid: t.uid, title: t.summary }); setSearch('') }}
                >
                  {t.summary}
                </button>
              ))}
            </div>
          </div>
        )}
        {mode === 'create' && search.trim() && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
            <div className="p-1">
              <button
                className="w-full rounded-sm px-2 py-1 text-left text-xs hover:bg-accent"
                onClick={() => { onCreate(search.trim()); setSearch('') }}
              >
                <Plus className="inline h-3 w-3 mr-1" />
                Create "{search.trim()}"
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TaskEditor
// ---------------------------------------------------------------------------

export function TaskEditor({ task }: { task: Task }) {
  const calendars = useGraphStore((s) => s.calendars)
  const projects = useGraphStore((s) => s.projects)
  const allTasks = useGraphStore((s) => s.tasks)
  const updateEntity = useGraphStore((s) => s.updateEntity)
  const selectEntity = useUIStore((s) => s.selectEntity)
  const { putTask } = useCalDAV()

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

  // Subtasks: real tasks whose relatedTo points to this task
  const subtaskRefs = useMemo((): TaskRef[] => {
    return Array.from(allTasks.values())
      .filter((t) => t.relatedTo === task.uid)
      .map((t) => ({ uid: t.uid, title: t.summary }))
  }, [allTasks, task.uid])

  // Prerequisite UIDs already selected (from form)
  const prereqUids = useMemo(
    () => new Set(form.formData.prerequisites.map((p) => p.uid)),
    [form.formData.prerequisites],
  )

  // All UIDs to exclude from pickers (self + subtasks + prereqs)
  const subtaskUids = useMemo(() => new Set(subtaskRefs.map((r) => r.uid)), [subtaskRefs])
  const excludeFromSubtasks = useMemo(() => {
    const s = new Set(subtaskUids)
    s.add(task.uid)
    prereqUids.forEach((u) => s.add(u))
    return s
  }, [subtaskUids, prereqUids, task.uid])
  const excludeFromPrereqs = useMemo(() => {
    const s = new Set(prereqUids)
    s.add(task.uid)
    subtaskUids.forEach((u) => s.add(u))
    return s
  }, [prereqUids, subtaskUids, task.uid])

  const [deleteOpen, setDeleteOpen] = useState(false)

  const handleDelete = useCallback(async () => {
    await form.deleteEntity()
    selectEntity(null)
  }, [form, selectEntity])

  // --- Subtask handlers ---

  const handleAddSubtask = useCallback((ref: TaskRef) => {
    // Link an existing task as a subtask by setting its relatedTo to this task
    const existing = allTasks.get(ref.uid)
    if (!existing) return
    const updated: Task = { ...existing, relatedTo: task.uid }
    putTask(updated, existing.etag).then((result) => {
      if (result.ok) {
        updateEntity('task', { ...updated, etag: result.etag, rawIcs: serializeTask(updated) })
      }
    })
  }, [allTasks, task.uid, putTask, updateEntity])

  const handleCreateSubtask = useCallback((title: string) => {
    const uid = crypto.randomUUID()
    const now = formatICalDate(new Date())
    const newTask: Task = {
      uid,
      calendarId: task.calendarId,
      dtstamp: now,
      summary: title,
      status: 'NEEDS-ACTION',
      relatedTo: task.uid,
      prerequisites: [],
      etag: '',
      rawIcs: '',
    }
    putTask(newTask).then((result) => {
      if (result.ok) {
        updateEntity('task', { ...newTask, etag: result.etag, rawIcs: serializeTask(newTask) })
      }
    })
  }, [task.uid, task.calendarId, putTask, updateEntity])

  const handleRemoveSubtask = useCallback((uid: string) => {
    // Unlink: set subtask's relatedTo to undefined
    const sub = allTasks.get(uid)
    if (!sub) return
    const updated: Task = { ...sub, relatedTo: undefined }
    putTask(updated, sub.etag).then((result) => {
      if (result.ok) {
        updateEntity('task', { ...updated, etag: result.etag, rawIcs: serializeTask(updated) })
      }
    })
  }, [allTasks, putTask, updateEntity])

  const handleToggleSubtask = useCallback((uid: string) => {
    const sub = allTasks.get(uid)
    if (!sub) return
    const newStatus: TaskStatus = sub.status === 'COMPLETED' ? 'NEEDS-ACTION' : 'COMPLETED'
    const updated: Task = { ...sub, status: newStatus }
    putTask(updated, sub.etag).then((result) => {
      if (result.ok) {
        updateEntity('task', { ...updated, etag: result.etag, rawIcs: serializeTask(updated) })
      }
    })
  }, [allTasks, putTask, updateEntity])

  // --- Prerequisite handlers ---

  const handleAddPrereq = useCallback((ref: TaskRef) => {
    form.setField('prerequisites', [...form.formData.prerequisites, ref])
  }, [form])

  const handleCreatePrereq = useCallback((title: string) => {
    // Create a new task and add it as prerequisite
    const uid = crypto.randomUUID()
    const now = formatICalDate(new Date())
    const newTask: Task = {
      uid,
      calendarId: task.calendarId,
      dtstamp: now,
      summary: title,
      status: 'NEEDS-ACTION',
      prerequisites: [],
      etag: '',
      rawIcs: '',
    }
    putTask(newTask).then((result) => {
      if (result.ok) {
        updateEntity('task', { ...newTask, etag: result.etag, rawIcs: serializeTask(newTask) })
        form.setField('prerequisites', [...form.formData.prerequisites, { uid, title }])
      }
    })
  }, [task.calendarId, putTask, updateEntity, form])

  const handleRemovePrereq = useCallback((uid: string) => {
    form.setField('prerequisites', form.formData.prerequisites.filter((p) => p.uid !== uid))
  }, [form])

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
              <option value="IN-PROCESS">In Process</option>
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

        {/* Sub-tasks — real VTODOs linked via relatedTo */}
        <TaskPicker
          label="Sub-tasks"
          tasks={subtaskRefs}
          allTasks={allTasks}
          excludeUids={excludeFromSubtasks}
          currentTaskUid={task.uid}
          onAdd={handleAddSubtask}
          onCreate={handleCreateSubtask}
          onRemove={handleRemoveSubtask}
          onToggle={handleToggleSubtask}
          onNavigate={(uid) => selectEntity(uid)}
          showStatus
        />

        {/* Prerequisites — stored as RELATED-TO;RELTYPE=DEPENDS-ON */}
        <TaskPicker
          label="Prerequisites"
          tasks={form.formData.prerequisites}
          allTasks={allTasks}
          excludeUids={excludeFromPrereqs}
          currentTaskUid={task.uid}
          onAdd={handleAddPrereq}
          onCreate={handleCreatePrereq}
          onRemove={handleRemovePrereq}
          onNavigate={(uid) => selectEntity(uid)}
        />
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &ldquo;{task.summary}&rdquo;?
            {subtaskRefs.length > 0 && ` It has ${subtaskRefs.length} sub-task(s) that will be unlinked.`}
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
