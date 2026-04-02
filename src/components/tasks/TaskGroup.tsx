import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { TaskRow } from './TaskRow'
import type { Task } from '@/types/entities'

interface TaskGroupProps {
  title: string
  count: number
  tasks: Task[]
  calendarColors: Map<string, string>
  projectNames: Map<string, string>
  selectedTaskId: string | null
  onToggleStatus: (task: Task) => void
  onToggleSubtask: (task: Task, index: number) => void
  onDelete: (task: Task) => void
  onSelect: (task: Task) => void
}

export function TaskGroup({
  title,
  count,
  tasks,
  calendarColors,
  projectNames,
  selectedTaskId,
  onToggleStatus,
  onToggleSubtask,
  onDelete,
  onSelect,
}: TaskGroupProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="space-y-0.5">
      <button
        className="flex items-center gap-2 px-2 py-1 text-sm font-semibold text-muted-foreground hover:text-foreground w-full text-left"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed
          ? <ChevronRight className="h-4 w-4" />
          : <ChevronDown className="h-4 w-4" />}
        <span>{title}</span>
        <span className="text-xs font-normal">({count})</span>
      </button>

      {!collapsed && tasks.map((task) => (
        <TaskRow
          key={task.uid}
          task={task}
          calendarColor={calendarColors.get(task.calendarId) ?? '#3b82f6'}
          projectName={projectNames.get(task.relatedTo ?? '')}
          onToggleStatus={onToggleStatus}
          onToggleSubtask={onToggleSubtask}
          onDelete={onDelete}
          onSelect={onSelect}
          isSelected={selectedTaskId === task.uid}
        />
      ))}
    </div>
  )
}
