import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { icalToDate, isToday, isSameDay } from '@/lib/caldav/dateUtils'
import type { Task } from '@/types/entities'

interface TaskRowProps {
  task: Task
  calendarColor: string
  projectName?: string
  subtasks: Task[]
  onToggleStatus: (task: Task) => void
  onDelete: (task: Task) => void
  onSelect: (task: Task) => void
  isSelected: boolean
}

function PriorityPip({ priority }: { priority?: number }) {
  if (priority === undefined) return null
  let color = 'bg-muted-foreground/30'
  if (priority >= 1 && priority <= 3) color = 'bg-red-500'
  else if (priority >= 4 && priority <= 6) color = 'bg-amber-500'
  else if (priority >= 7 && priority <= 9) color = 'bg-blue-500'
  return <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${color}`} />
}

function DueBadge({ due, status }: { due?: string; status: string }) {
  if (!due) return null
  const date = icalToDate(due)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const isOverdue = date < today && status !== 'COMPLETED'
  const isTodayDue = isToday(date) || isSameDay(date, today)

  const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  let className = 'text-xs px-1.5 py-0.5 rounded'
  if (isOverdue) className += ' bg-red-500/15 text-red-500'
  else if (isTodayDue) className += ' bg-amber-500/15 text-amber-500'
  else className += ' bg-muted text-muted-foreground'

  return <span className={className}>{label}</span>
}

function SubTaskRow({ task, onToggle, onSelect }: { task: Task; onToggle: () => void; onSelect: () => void }) {
  const isCompleted = task.status === 'COMPLETED'
  return (
    <div
      className="flex items-center gap-2 py-0.5 pl-10 cursor-pointer rounded hover:bg-accent/50"
      onClick={onSelect}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => onToggle()}
        onClick={(e) => e.stopPropagation()}
        className="h-3.5 w-3.5"
      />
      <span className={`text-sm ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
        {task.summary}
      </span>
    </div>
  )
}

export function TaskRow({
  task,
  calendarColor,
  projectName,
  subtasks,
  onToggleStatus,
  onDelete,
  onSelect,
  isSelected,
}: TaskRowProps) {
  const [expanded, setExpanded] = useState(true)
  const hasSubtasks = subtasks.length > 0
  const isCompleted = task.status === 'COMPLETED'

  return (
    <div>
      <div
        className={`group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
          isSelected ? 'bg-accent' : 'hover:bg-accent/50'
        }`}
        onClick={() => onSelect(task)}
      >
        {hasSubtasks ? (
          <button
            className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          >
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        <Checkbox
          checked={isCompleted}
          onCheckedChange={(e) => { e; onToggleStatus(task) }}
          onClick={(e) => e.stopPropagation()}
        />

        <span
          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: calendarColor }}
        />

        <span className={`flex-1 text-sm truncate ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
          {task.summary}
        </span>

        <PriorityPip priority={task.priority} />
        <DueBadge due={task.due} status={task.status} />

        {projectName && (
          <span className="text-xs bg-secondary px-1.5 py-0.5 rounded truncate max-w-24">
            {projectName}
          </span>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
          onClick={(e) => { e.stopPropagation(); onDelete(task) }}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>

      {hasSubtasks && expanded && (
        <div className="ml-2">
          {subtasks.map((st) => (
            <SubTaskRow
              key={st.uid}
              task={st}
              onToggle={() => onToggleStatus(st)}
              onSelect={() => onSelect(st)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
