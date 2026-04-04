import { useMemo, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { KanbanColumn, type QuickAddEntityType } from './KanbanColumn'
import { KanbanCard, type KanbanColumnId } from './KanbanCard'
import { icalToDate } from '@/lib/caldav/dateUtils'
import type { Entity, Event, Task, Note, Project } from '@/types/entities'

interface KanbanBoardProps {
  project: Project
  children: Entity[]
  calendarColors: Map<string, string>
  enabledCalendars: Set<string>
  selectedEntityId: string | null
  onSelect: (entity: Entity) => void
  onToggleTaskStatus: (task: Task) => void
  onDrop: (entity: Entity, column: KanbanColumnId) => void
  onQuickAdd: (projectUid: string, column: KanbanColumnId, title: string, type: QuickAddEntityType) => void
  onDelete?: (project: Project) => void
}

function getCalendarId(entity: Entity): string | undefined {
  if ('calendarId' in entity) return (entity as Event | Task | Note).calendarId
  return undefined
}

function categorize(children: Entity[], enabledCalendars: Set<string>) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const upcoming: Entity[] = []
  const inProgress: Entity[] = []
  const done: Entity[] = []
  const notes: Entity[] = []
  let hiddenCount = 0

  for (const entity of children) {
    // Filter by enabled calendars
    const calId = getCalendarId(entity)
    if (calId && !enabledCalendars.has(calId)) {
      hiddenCount++
      continue
    }

    // Notes column
    if (!('status' in entity && 'prerequisites' in entity) && !('dtend' in entity)) {
      notes.push(entity)
      continue
    }

    // Tasks
    if ('status' in entity && 'prerequisites' in entity) {
      const task = entity as Task
      if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
        done.push(entity)
      } else if (task.status === 'IN-PROCESS') {
        inProgress.push(entity)
      } else if (task.due) {
        const due = icalToDate(task.due)
        if (due <= today) {
          inProgress.push(entity)
        } else {
          upcoming.push(entity)
        }
      } else {
        upcoming.push(entity)
      }
      continue
    }

    // Events
    if ('dtend' in entity) {
      const event = entity as Event
      const end = icalToDate(event.dtend)
      const start = icalToDate(event.dtstart)
      if (end < today) {
        done.push(entity)
      } else if (start <= today) {
        inProgress.push(entity)
      } else {
        upcoming.push(entity)
      }
      continue
    }
  }

  return { upcoming, inProgress, done, notes, hiddenCount }
}

const STATUS_COLUMN_TYPES: QuickAddEntityType[] = ['task', 'event']
const NOTES_COLUMN_TYPES: QuickAddEntityType[] = ['note']

export function KanbanBoard({
  project,
  children,
  calendarColors,
  enabledCalendars,
  selectedEntityId,
  onSelect,
  onToggleTaskStatus,
  onDrop,
  onQuickAdd,
  onDelete,
}: KanbanBoardProps) {
  const dragEntityRef = useRef<Entity | null>(null)

  const { upcoming, inProgress, done, notes, hiddenCount } = useMemo(
    () => categorize(children, enabledCalendars),
    [children, enabledCalendars],
  )

  const handleDragStart = (_e: React.DragEvent, entity: Entity) => {
    dragEntityRef.current = entity
  }

  const handleDrop = (columnId: KanbanColumnId) => {
    if (dragEntityRef.current) {
      onDrop(dragEntityRef.current, columnId)
      dragEntityRef.current = null
    }
  }

  const renderCards = (entities: Entity[]) =>
    entities.map((entity) => {
      const calId = getCalendarId(entity)
      return (
        <KanbanCard
          key={entity.uid}
          entity={entity}
          calendarColor={calId ? calendarColors.get(calId) ?? '#3b82f6' : '#6b7280'}
          isSelected={selectedEntityId === entity.uid}
          onSelect={onSelect}
          onToggleTaskStatus={onToggleTaskStatus}
          onDragStart={handleDragStart}
        />
      )
    })

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
          onClick={() => onSelect(project as unknown as Entity)}
        >
          <h2 className="text-base font-semibold truncate">{project.summary}</h2>
          <span className="text-xs text-muted-foreground shrink-0">[{project.status}]</span>
        </div>
        {hiddenCount > 0 && (
          <span className="text-xs text-amber-500 shrink-0">
            {hiddenCount} item{hiddenCount > 1 ? 's' : ''} hidden by calendar filters
          </span>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(project) }}
            className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete project"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        <KanbanColumn
          title="Needs Action"
          count={upcoming.length}
          columnId="upcoming"
          onDrop={handleDrop}
          quickAddTypes={STATUS_COLUMN_TYPES}
          onQuickAdd={(title, type) => onQuickAdd(project.uid, 'upcoming', title, type)}
        >
          {renderCards(upcoming)}
        </KanbanColumn>
        <KanbanColumn
          title="In Process"
          count={inProgress.length}
          columnId="in-progress"
          onDrop={handleDrop}
          quickAddTypes={STATUS_COLUMN_TYPES}
          onQuickAdd={(title, type) => onQuickAdd(project.uid, 'in-progress', title, type)}
        >
          {renderCards(inProgress)}
        </KanbanColumn>
        <KanbanColumn
          title="Completed"
          count={done.length}
          columnId="done"
          onDrop={handleDrop}
          quickAddTypes={STATUS_COLUMN_TYPES}
          onQuickAdd={(title, type) => onQuickAdd(project.uid, 'done', title, type)}
        >
          {renderCards(done)}
        </KanbanColumn>
        <KanbanColumn
          title="Notes"
          count={notes.length}
          columnId="notes"
          quickAddTypes={NOTES_COLUMN_TYPES}
          onQuickAdd={(title, type) => onQuickAdd(project.uid, 'notes', title, type)}
        >
          {renderCards(notes)}
        </KanbanColumn>
      </div>
    </div>
  )
}
