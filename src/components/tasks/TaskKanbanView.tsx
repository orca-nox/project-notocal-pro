import { useMemo } from 'react'
import { KanbanColumn } from '@/components/kanban/KanbanColumn'
import { TaskCard } from '@/components/kanban/TaskCard'
import { icalToDate } from '@/lib/caldav/dateUtils'
import type { Task } from '@/types/entities'

interface TaskKanbanViewProps {
  tasks: Task[]
  calendarColors: Map<string, string>
  selectedTaskId: string | null
  onToggleStatus: (task: Task) => void
  onSelect: (task: Task) => void
}

export function TaskKanbanView({
  tasks,
  calendarColors,
  selectedTaskId,
  onToggleStatus,
  onSelect,
}: TaskKanbanViewProps) {
  const { upcoming, inProgress, done } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const upcoming: Task[] = []
    const inProgress: Task[] = []
    const done: Task[] = []

    for (const task of tasks) {
      if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
        done.push(task)
      } else if (task.status === 'IN-PROCESS') {
        inProgress.push(task)
      } else if (task.due) {
        const due = icalToDate(task.due)
        if (due <= today) {
          inProgress.push(task)
        } else {
          upcoming.push(task)
        }
      } else {
        upcoming.push(task)
      }
    }

    return { upcoming, inProgress, done }
  }, [tasks])

  return (
    <div className="flex gap-4 h-full overflow-x-auto p-4">
      <KanbanColumn title="Needs Action" count={upcoming.length}>
        {upcoming.map((t) => (
          <TaskCard
            key={t.uid}
            task={t}
            calendarColor={calendarColors.get(t.calendarId) ?? '#3b82f6'}
            onToggleStatus={onToggleStatus}
            onSelect={onSelect}
            isSelected={selectedTaskId === t.uid}
          />
        ))}
      </KanbanColumn>
      <KanbanColumn title="In Process" count={inProgress.length}>
        {inProgress.map((t) => (
          <TaskCard
            key={t.uid}
            task={t}
            calendarColor={calendarColors.get(t.calendarId) ?? '#3b82f6'}
            onToggleStatus={onToggleStatus}
            onSelect={onSelect}
            isSelected={selectedTaskId === t.uid}
          />
        ))}
      </KanbanColumn>
      <KanbanColumn title="Completed" count={done.length}>
        {done.map((t) => (
          <TaskCard
            key={t.uid}
            task={t}
            calendarColor={calendarColors.get(t.calendarId) ?? '#3b82f6'}
            onToggleStatus={onToggleStatus}
            onSelect={onSelect}
            isSelected={selectedTaskId === t.uid}
          />
        ))}
      </KanbanColumn>
    </div>
  )
}
