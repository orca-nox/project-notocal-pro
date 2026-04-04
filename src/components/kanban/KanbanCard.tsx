import { Calendar, CheckSquare, StickyNote } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { icalToDate, isToday } from '@/lib/caldav/dateUtils'
import type { Entity, Event, Task } from '@/types/entities'

export type KanbanColumnId = 'upcoming' | 'in-progress' | 'done' | 'notes'

interface KanbanCardProps {
  entity: Entity
  calendarColor: string
  isSelected: boolean
  onSelect: (entity: Entity) => void
  onToggleTaskStatus?: (task: Task) => void
  onDragStart?: (e: React.DragEvent, entity: Entity) => void
}

function getEntityType(entity: Entity): 'event' | 'task' | 'note' {
  if ('dtstart' in entity && 'dtend' in entity) return 'event'
  if ('status' in entity && 'prerequisites' in entity) return 'task'
  return 'note'
}

export function KanbanCard({
  entity,
  calendarColor,
  isSelected,
  onSelect,
  onToggleTaskStatus,
  onDragStart,
}: KanbanCardProps) {
  const type = getEntityType(entity)

  const TypeIcon = type === 'event' ? Calendar : type === 'task' ? CheckSquare : StickyNote
  const task = type === 'task' ? (entity as Task) : null
  const event = type === 'event' ? (entity as Event) : null
  const isCompleted = task?.status === 'COMPLETED'

  let dueBadge = null
  const dateStr = task?.due ?? event?.dtstart
  if (dateStr) {
    const date = icalToDate(dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const overdue = date < today && !isCompleted
    const todayDue = isToday(date)
    const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const color = overdue ? 'text-red-500' : todayDue ? 'text-amber-500' : 'text-muted-foreground'
    dueBadge = <span className={`text-xs ${color}`}>{label}</span>
  }

  return (
    <div
      draggable={type === 'task'}
      onDragStart={(e) => onDragStart?.(e, entity)}
      className={`rounded-md border border-border bg-background p-2 cursor-pointer transition-colors ${
        isSelected ? 'ring-1 ring-primary' : 'hover:border-primary/50'
      } ${type === 'task' ? 'cursor-grab active:cursor-grabbing' : ''}`}
      onClick={() => onSelect(entity)}
    >
      <div className="flex items-start gap-2">
        {task && onToggleTaskStatus ? (
          <Checkbox
            checked={isCompleted}
            onCheckedChange={() => onToggleTaskStatus(task)}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5"
          />
        ) : (
          <TypeIcon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <span className={`text-sm block truncate ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
            {entity.summary}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: calendarColor }}
            />
            {task?.priority !== undefined && task.priority <= 3 && (
              <span className="text-xs text-red-500">High</span>
            )}
            {dueBadge}
          </div>
        </div>
      </div>
    </div>
  )
}
