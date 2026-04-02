import { Checkbox } from '@/components/ui/checkbox'
import { icalToDate, isToday } from '@/lib/caldav/dateUtils'
import type { Task } from '@/types/entities'

interface TaskCardProps {
  task: Task
  calendarColor: string
  onToggleStatus: (task: Task) => void
  onSelect: (task: Task) => void
  isSelected: boolean
}

export function TaskCard({ task, calendarColor, onToggleStatus, onSelect, isSelected }: TaskCardProps) {
  const isCompleted = task.status === 'COMPLETED'

  let dueBadge = null
  if (task.due) {
    const date = icalToDate(task.due)
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
      className={`rounded-md border border-border bg-background p-2 cursor-pointer transition-colors ${
        isSelected ? 'ring-1 ring-primary' : 'hover:border-primary/50'
      }`}
      onClick={() => onSelect(task)}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={isCompleted}
          onCheckedChange={() => onToggleStatus(task)}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <span className={`text-sm block truncate ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
            {task.summary}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: calendarColor }}
            />
            {task.priority !== undefined && task.priority <= 3 && (
              <span className="text-xs text-red-500">High</span>
            )}
            {dueBadge}
            {task.subtasks.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
