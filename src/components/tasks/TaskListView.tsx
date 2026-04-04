import { TaskGroup } from './TaskGroup'
import type { TaskGroup as TaskGroupType } from '@/hooks/useFilteredTasks'
import type { Task } from '@/types/entities'

interface TaskListViewProps {
  groups: TaskGroupType[]
  calendarColors: Map<string, string>
  projectNames: Map<string, string>
  selectedTaskId: string | null
  onToggleStatus: (task: Task) => void
  onDelete: (task: Task) => void
  onSelect: (task: Task) => void
}

export function TaskListView({
  groups,
  calendarColors,
  projectNames,
  selectedTaskId,
  onToggleStatus,
  onDelete,
  onSelect,
}: TaskListViewProps) {
  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No tasks match the current filters.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <TaskGroup
          key={group.key}
          title={group.project?.summary ?? 'Unassigned'}
          count={group.tasks.length}
          tasks={group.tasks}
          calendarColors={calendarColors}
          projectNames={projectNames}
          selectedTaskId={selectedTaskId}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
