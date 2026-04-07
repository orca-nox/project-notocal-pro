import { useCallback } from 'react'
import { toast } from 'sonner'
import {
  Pencil,
  Trash2,
  Copy,
  FolderKanban,
  Calendar,
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/components/ui/context-menu'
import { useGraphStore } from '@/store/useGraphStore'
import { useUIStore } from '@/store/useUIStore'
import { useCalDAV } from '@/hooks/useCalDAV'
import { serializeEvent, serializeTask, serializeNote } from '@/lib/caldav/serializer'
import { formatICalDate } from '@/lib/caldav/dateUtils'
import type { Event, Task, Note } from '@/types/entities'

interface EntityContextMenuProps {
  entityType: 'event' | 'task' | 'note'
  entityUid: string
  onDelete?: () => void
  children: React.ReactNode
}

export function EntityContextMenu({
  entityType,
  entityUid,
  onDelete,
  children,
}: EntityContextMenuProps) {
  const events = useGraphStore((s) => s.events)
  const tasks = useGraphStore((s) => s.tasks)
  const notes = useGraphStore((s) => s.notes)
  const projects = useGraphStore((s) => s.projects)
  const calendars = useGraphStore((s) => s.calendars)
  const updateEntity = useGraphStore((s) => s.updateEntity)
  const selectEntity = useUIStore((s) => s.selectEntity)

  const { putEvent, putTask, putNote } = useCalDAV()

  const entity = entityType === 'event'
    ? events.get(entityUid)
    : entityType === 'task'
      ? tasks.get(entityUid)
      : notes.get(entityUid)

  const projectsArr = Array.from(projects.values()).sort((a, b) => a.priority - b.priority)
  const calendarsArr = Array.from(calendars.values()).sort((a, b) => a.order - b.order)

  const handleEdit = useCallback(() => {
    selectEntity(entityUid)
  }, [selectEntity, entityUid])

  const handleDuplicate = useCallback(async () => {
    if (!entity) return

    const uid = crypto.randomUUID()
    const now = formatICalDate(new Date())

    if (entityType === 'event') {
      const e = entity as Event
      const cloned: Event = {
        ...e,
        uid,
        dtstamp: now,
        summary: `${e.summary} (copy)`,
        etag: '',
        rawIcs: '',
      }
      updateEntity('event', { ...cloned, rawIcs: serializeEvent(cloned) })
      const result = await putEvent(cloned)
      if (result.ok) {
        updateEntity('event', { ...cloned, etag: result.etag, rawIcs: serializeEvent(cloned) })
      }
      toast.success('Event duplicated')
    } else if (entityType === 'task') {
      const t = entity as Task
      const cloned: Task = {
        ...t,
        uid,
        dtstamp: now,
        summary: `${t.summary} (copy)`,
        etag: '',
        rawIcs: '',
        prerequisites: [],
      }
      updateEntity('task', { ...cloned, rawIcs: serializeTask(cloned) })
      const result = await putTask(cloned)
      if (result.ok) {
        updateEntity('task', { ...cloned, etag: result.etag, rawIcs: serializeTask(cloned) })
      }
      toast.success('Task duplicated')
    } else {
      const n = entity as Note
      const cloned: Note = {
        ...n,
        uid,
        dtstamp: now,
        summary: `${n.summary} (copy)`,
        etag: '',
        rawIcs: '',
      }
      updateEntity('note', { ...cloned, rawIcs: serializeNote(cloned) })
      const result = await putNote(cloned)
      if (result.ok) {
        updateEntity('note', { ...cloned, etag: result.etag, rawIcs: serializeNote(cloned) })
      }
      toast.success('Note duplicated')
    }
  }, [entity, entityType, putEvent, putTask, putNote, updateEntity])

  const handleMoveToProject = useCallback(async (projectUid: string | undefined) => {
    if (!entity) return

    const updated = { ...entity, relatedTo: projectUid }
    if (entityType === 'event') {
      const result = await putEvent(updated as Event, entity.etag)
      if (result.ok) {
        updateEntity('event', { ...updated, etag: result.etag, rawIcs: serializeEvent(updated as Event) } as Event)
      }
    } else if (entityType === 'task') {
      const result = await putTask(updated as Task, entity.etag)
      if (result.ok) {
        updateEntity('task', { ...updated, etag: result.etag, rawIcs: serializeTask(updated as Task) } as Task)
      }
    } else {
      const result = await putNote(updated as Note, entity.etag)
      if (result.ok) {
        updateEntity('note', { ...updated, etag: result.etag, rawIcs: serializeNote(updated as Note) } as Note)
      }
    }
    toast.success(projectUid ? 'Moved to project' : 'Unassigned from project')
  }, [entity, entityType, putEvent, putTask, putNote, updateEntity])

  const handleMoveToCalendar = useCallback(async (calendarId: string) => {
    if (!entity || !('calendarId' in entity)) return

    const updated = { ...entity, calendarId }
    if (entityType === 'event') {
      const result = await putEvent(updated as Event, entity.etag)
      if (result.ok) {
        updateEntity('event', { ...updated, etag: result.etag, rawIcs: serializeEvent(updated as Event) } as Event)
      }
    } else if (entityType === 'task') {
      const result = await putTask(updated as Task, entity.etag)
      if (result.ok) {
        updateEntity('task', { ...updated, etag: result.etag, rawIcs: serializeTask(updated as Task) } as Task)
      }
    } else {
      const result = await putNote(updated as Note, entity.etag)
      if (result.ok) {
        updateEntity('note', { ...updated, etag: result.etag, rawIcs: serializeNote(updated as Note) } as Note)
      }
    }
    toast.success('Moved to calendar')
  }, [entity, entityType, putEvent, putTask, putNote, updateEntity])

  if (!entity) return <>{children}</>

  const currentCalendarId = 'calendarId' in entity ? (entity as Event | Task | Note).calendarId : undefined
  const currentRelatedTo = entity.relatedTo

  return (
    <ContextMenu>
      <ContextMenuTrigger className="w-full">
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleEdit}>
          <Pencil className="h-4 w-4" />
          Edit
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDuplicate}>
          <Copy className="h-4 w-4" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <FolderKanban className="h-4 w-4" />
            Move to Project
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem
              onClick={() => handleMoveToProject(undefined)}
              disabled={!currentRelatedTo}
            >
              Unassigned
            </ContextMenuItem>
            {projectsArr.map((p) => (
              <ContextMenuItem
                key={p.uid}
                onClick={() => handleMoveToProject(p.uid)}
                disabled={currentRelatedTo === p.uid}
              >
                {p.summary}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Calendar className="h-4 w-4" />
            Move to Calendar
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {calendarsArr.map((c) => (
              <ContextMenuItem
                key={c.id}
                onClick={() => handleMoveToCalendar(c.id)}
                disabled={currentCalendarId === c.id}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                {c.displayName}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
