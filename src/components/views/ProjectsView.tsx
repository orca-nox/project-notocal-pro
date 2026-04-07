import { useState, useCallback, useMemo, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useGraphStore } from '@/store/useGraphStore'
import { useFilterStore } from '@/store/useFilterStore'
import { useUIStore } from '@/store/useUIStore'
import { useCalDAV } from '@/hooks/useCalDAV'
import { formatICalDate } from '@/lib/caldav/dateUtils'
import { serializeTask, serializeNote, serializeEvent } from '@/lib/caldav/serializer'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Entity, Event, Task, Note, Project, ProjectStatus } from '@/types/entities'
import type { KanbanColumnId } from '@/components/kanban/KanbanCard'
import type { QuickAddEntityType } from '@/components/kanban/KanbanColumn'

export function ProjectsView() {
  const projects = useGraphStore((s) => s.projects)
  const calendars = useGraphStore((s) => s.calendars)
  const tasks = useGraphStore((s) => s.tasks)
  const events = useGraphStore((s) => s.events)
  const notes = useGraphStore((s) => s.notes)
  const childrenOf = useGraphStore((s) => s.childrenOf)
  const updateEntity = useGraphStore((s) => s.updateEntity)
  const removeEntity = useGraphStore((s) => s.removeEntity)

  const enabledCalendars = useFilterStore((s) => s.enabledCalendars)

  const selectedEntityId = useUIStore((s) => s.selectedEntityId)
  const selectEntity = useUIStore((s) => s.selectEntity)

  const { putEvent, putTask, putNote, putProject, deleteTask, deleteNote, deleteEvent, deleteProject } = useCalDAV()

  // Project creation state
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createCalendar, setCreateCalendar] = useState('')
  const [createStartDate, setCreateStartDate] = useState('')
  const [createEndDate, setCreateEndDate] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Project deletion state
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [deleteMode, setDeleteMode] = useState<'cascade' | 'sever' | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // N key → open create project dialog
  useEffect(() => {
    const handler = () => handleCreateOpen()
    window.addEventListener('notocal:quick-add', handler)
    return () => window.removeEventListener('notocal:quick-add', handler)
  }, [])

  // Delete key → delete selected project
  useEffect(() => {
    const handler = ((e: CustomEvent) => {
      const uid = e.detail?.uid
      if (!uid) return
      const project = projects.get(uid)
      if (project) setDeleteTarget(project)
    }) as EventListener
    window.addEventListener('notocal:delete-selected', handler)
    return () => window.removeEventListener('notocal:delete-selected', handler)
  }, [projects])

  const projectsArr = useMemo(
    () => Array.from(projects.values()).sort((a, b) => a.priority - b.priority),
    [projects],
  )

  const calendarsArr = useMemo(
    () => Array.from(calendars.values()).sort((a, b) => a.order - b.order),
    [calendars],
  )

  const calendarColors = useMemo(
    () => new Map(Array.from(calendars.values()).map((c) => [c.id, c.color])),
    [calendars],
  )

  // Recompute children for each project when any entity map changes
  const projectChildren = useMemo(
    () => new Map(projectsArr.map((p) => [p.uid, childrenOf(p.uid)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectsArr, tasks, events, notes],
  )

  // --- Handlers ---

  const handleToggleTaskStatus = useCallback(async (task: Task) => {
    const newStatus = task.status === 'COMPLETED' ? 'NEEDS-ACTION' as const : 'COMPLETED' as const
    const updated: Task = { ...task, status: newStatus }
    // Optimistic: update store immediately
    updateEntity('task', { ...updated, rawIcs: serializeTask(updated) })
    // Persist in background
    const result = await putTask(updated, task.etag)
    if (result.ok) {
      updateEntity('task', { ...updated, etag: result.etag, rawIcs: serializeTask(updated) })
    }
  }, [putTask, updateEntity])

  const handleDrop = useCallback(async (entity: Entity, column: KanbanColumnId) => {
    // Only tasks can be dragged between status columns
    if (!('status' in entity && 'prerequisites' in entity)) return
    const task = entity as Task

    let newStatus: Task['status']

    if (column === 'done') {
      newStatus = 'COMPLETED'
    } else if (column === 'in-progress') {
      newStatus = 'IN-PROCESS'
    } else if (column === 'upcoming') {
      newStatus = 'NEEDS-ACTION'
    } else {
      return // Can't drag tasks to Notes column
    }

    // Skip if nothing changed
    if (task.status === newStatus) return

    const updated: Task = { ...task, status: newStatus }
    // Optimistic: update store immediately
    updateEntity('task', { ...updated, rawIcs: serializeTask(updated) })
    // Persist in background
    const result = await putTask(updated, task.etag)
    if (result.ok) {
      updateEntity('task', { ...updated, etag: result.etag, rawIcs: serializeTask(updated) })
    }
  }, [putTask, updateEntity])

  const handleQuickAdd = useCallback(async (
    projectUid: string,
    column: KanbanColumnId,
    title: string,
    entityType: QuickAddEntityType,
  ) => {
    // Determine which calendar to use — find the project's primary context calendar
    const project = projects.get(projectUid)
    const calMatch = calendarsArr.find((c) => c.displayName === project?.categories)
    const calendarId = calMatch?.id ?? calendarsArr[0]?.id
    if (!calendarId) return

    const uid = crypto.randomUUID()
    const now = formatICalDate(new Date())

    if (entityType === 'note') {
      const note: Note = {
        uid,
        calendarId,
        dtstamp: now,
        summary: title,
        relatedTo: projectUid,
        etag: '',
        rawIcs: '',
      }
      // Optimistic update
      updateEntity('note', { ...note, rawIcs: serializeNote(note) })
      const result = await putNote(note)
      if (result.ok) {
        updateEntity('note', { ...note, etag: result.etag, rawIcs: serializeNote(note) })
      }
    } else if (entityType === 'event') {
      // Create an event with default time range based on column
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      let startDate: Date
      if (column === 'done') {
        // Yesterday 9am–10am
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 1)
      } else if (column === 'in-progress') {
        // Today
        startDate = new Date(today)
      } else {
        // Tomorrow
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() + 1)
      }
      startDate.setHours(9, 0, 0, 0)
      const endDate = new Date(startDate)
      endDate.setHours(10, 0, 0, 0)

      const event: Event = {
        uid,
        calendarId,
        dtstamp: now,
        dtstart: formatICalDate(startDate),
        dtend: formatICalDate(endDate),
        summary: title,
        relatedTo: projectUid,
        etag: '',
        rawIcs: '',
      }
      // Optimistic update
      updateEntity('event', { ...event, rawIcs: serializeEvent(event) })
      const result = await putEvent(event)
      if (result.ok) {
        updateEntity('event', { ...event, etag: result.etag, rawIcs: serializeEvent(event) })
      }
    } else {
      // Create a task — status matches the target column
      let status: Task['status'] = 'NEEDS-ACTION'
      if (column === 'done') {
        status = 'COMPLETED'
      } else if (column === 'in-progress') {
        status = 'IN-PROCESS'
      }

      const task: Task = {
        uid,
        calendarId,
        dtstamp: now,
        summary: title,
        status,
        relatedTo: projectUid,
        prerequisites: [],
        etag: '',
        rawIcs: '',
      }
      // Optimistic update
      updateEntity('task', { ...task, rawIcs: serializeTask(task) })
      const result = await putTask(task)
      if (result.ok) {
        updateEntity('task', { ...task, etag: result.etag, rawIcs: serializeTask(task) })
      }
    }
  }, [projects, calendarsArr, putEvent, putTask, putNote, updateEntity])

  const handleSelect = useCallback((entity: Entity) => {
    selectEntity(entity.uid)
  }, [selectEntity])

  // --- Project Creation ---

  const handleCreateOpen = () => {
    setCreateName('')
    setCreateCalendar(calendarsArr[0]?.displayName ?? '')
    setCreateStartDate('')
    setCreateEndDate('')
    setCreateOpen(true)
  }

  const handleCreateProject = useCallback(async () => {
    if (!createName.trim()) return
    setIsCreating(true)

    const uid = crypto.randomUUID()
    const now = formatICalDate(new Date())
    const project: Project = {
      uid,
      dtstamp: now,
      summary: createName.trim(),
      categories: createCalendar,
      status: 'Active' as ProjectStatus,
      priority: projectsArr.length,
      dtstart: createStartDate ? createStartDate.replace(/-/g, '') : undefined,
      dtend: createEndDate ? createEndDate.replace(/-/g, '') : undefined,
      etag: '',
      rawIcs: '',
    }

    // Optimistic update
    updateEntity('project', project)
    selectEntity(uid)
    setCreateOpen(false)

    const result = await putProject(project)
    if (result.ok) {
      updateEntity('project', { ...project, etag: result.etag })
    }
    setIsCreating(false)
  }, [createName, createCalendar, createStartDate, createEndDate, projectsArr.length, putProject, updateEntity, selectEntity])

  // --- Project Deletion ---

  const handleDeleteRequest = useCallback((project: Project) => {
    setDeleteTarget(project)
    setDeleteMode(null)
  }, [])

  const handleDeleteConfirm = useCallback(async (cascade: boolean) => {
    if (!deleteTarget) return
    setIsDeleting(true)

    const children = childrenOf(deleteTarget.uid)

    if (cascade) {
      for (const child of children) {
        if ('prerequisites' in child && 'status' in child) {
          await deleteTask(child as Task)
          removeEntity('task', child.uid)
        } else if ('dtend' in child) {
          await deleteEvent(child as Event)
          removeEntity('event', child.uid)
        } else {
          await deleteNote(child as Note)
          removeEntity('note', child.uid)
        }
      }
    } else {
      for (const child of children) {
        if ('prerequisites' in child && 'status' in child) {
          const task = child as Task
          const updated = { ...task, relatedTo: undefined }
          const result = await putTask(updated, task.etag)
          if (result.ok) {
            updateEntity('task', { ...updated, etag: result.etag, rawIcs: serializeTask(updated) })
          }
        } else if ('dtend' in child) {
          const event = child as Event
          const updated = { ...event, relatedTo: undefined }
          const result = await putEvent(updated, event.etag)
          if (result.ok) {
            updateEntity('event', { ...updated, etag: result.etag, rawIcs: serializeEvent(updated) })
          }
        } else {
          const note = child as Note
          const updated = { ...note, relatedTo: undefined }
          const result = await putNote(updated, note.etag)
          if (result.ok) {
            updateEntity('note', { ...updated, etag: result.etag, rawIcs: serializeNote(updated) })
          }
        }
      }
    }

    await deleteProject(deleteTarget)
    removeEntity('project', deleteTarget.uid)
    if (selectedEntityId === deleteTarget.uid) selectEntity(null)

    setDeleteTarget(null)
    setIsDeleting(false)
  }, [deleteTarget, childrenOf, deleteTask, deleteNote, deleteEvent, deleteProject, putEvent, putTask, putNote, updateEntity, removeEntity, selectedEntityId, selectEntity])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
        <h1 className="text-lg font-bold">Projects</h1>
        <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={handleCreateOpen}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          New Project
        </Button>
      </div>

      {/* Boards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {projectsArr.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p>No projects yet.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={handleCreateOpen}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Create your first project
            </Button>
          </div>
        ) : (
          projectsArr.map((project) => (
              <div key={project.uid} className="rounded-lg border border-border p-4">
                <KanbanBoard
                  project={project}
                  children={projectChildren.get(project.uid) ?? []}
                  calendarColors={calendarColors}
                  enabledCalendars={enabledCalendars}
                  selectedEntityId={selectedEntityId}
                  onSelect={handleSelect}
                  onToggleTaskStatus={handleToggleTaskStatus}
                  onDrop={handleDrop}
                  onQuickAdd={handleQuickAdd}
                  onDelete={handleDeleteRequest}
                />
              </div>
            ))
        )}
      </div>

      {/* Create Project Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                autoFocus
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject() }}
                placeholder="Project name"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Primary Context (Calendar)</label>
              <select
                value={createCalendar}
                onChange={(e) => setCreateCalendar(e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {calendarsArr.map((c) => (
                  <option key={c.id} value={c.displayName}>{c.displayName}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Start Date (optional)</label>
                <input
                  type="date"
                  value={createStartDate}
                  onChange={(e) => setCreateStartDate(e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">End Date (optional)</label>
                <input
                  type="date"
                  value={createEndDate}
                  onChange={(e) => setCreateEndDate(e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateProject} disabled={!createName.trim() || isCreating}>
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Delete all items under &ldquo;{deleteTarget.summary}&rdquo;?
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={deleteMode === 'cascade'}
                    onChange={() => setDeleteMode('cascade')}
                    className="accent-destructive"
                  />
                  <span className="text-sm">Yes — cascade delete all children</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={deleteMode === 'sever'}
                    onChange={() => setDeleteMode('sever')}
                    className="accent-primary"
                  />
                  <span className="text-sm">No — sever links, children become unassigned</span>
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMode === null || isDeleting}
              onClick={() => handleDeleteConfirm(deleteMode === 'cascade')}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
