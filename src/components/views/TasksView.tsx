import { useState, useCallback, useMemo } from 'react'
import { List, Columns3 } from 'lucide-react'
import { useGraphStore } from '@/store/useGraphStore'
import { useFilterStore } from '@/store/useFilterStore'
import { useUIStore } from '@/store/useUIStore'
import { useCalDAV } from '@/hooks/useCalDAV'
import { useFilteredTasks } from '@/hooks/useFilteredTasks'
import { serializeTask } from '@/lib/caldav/serializer'
import { formatICalDate } from '@/lib/caldav/dateUtils'
import { TaskFilterBar } from '@/components/tasks/TaskFilterBar'
import { TaskQuickAdd } from '@/components/tasks/TaskQuickAdd'
import { TaskListView } from '@/components/tasks/TaskListView'
import { TaskKanbanView } from '@/components/tasks/TaskKanbanView'
import { DeleteTaskDialog } from '@/components/tasks/DeleteTaskDialog'
import type { Task, TaskStatus } from '@/types/entities'

export function TasksView() {
  const tasks = useGraphStore((s) => s.tasks)
  const calendars = useGraphStore((s) => s.calendars)
  const projects = useGraphStore((s) => s.projects)
  const updateEntity = useGraphStore((s) => s.updateEntity)
  const removeEntity = useGraphStore((s) => s.removeEntity)

  const taskFilters = useFilterStore((s) => s.taskFilters)
  const setTaskFilter = useFilterStore((s) => s.setTaskFilter)
  const resetFilters = useFilterStore((s) => s.resetFilters)

  const tasksViewMode = useUIStore((s) => s.tasksViewMode)
  const setTasksViewMode = useUIStore((s) => s.setTasksViewMode)
  const selectedEntityId = useUIStore((s) => s.selectedEntityId)
  const selectEntity = useUIStore((s) => s.selectEntity)

  const { putTask, deleteTask } = useCalDAV()
  const { groups, flatSorted, totalCount, filteredCount } = useFilteredTasks()

  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)

  const calendarsArr = useMemo(
    () => Array.from(calendars.values()).sort((a, b) => a.order - b.order),
    [calendars],
  )

  const calendarColors = useMemo(
    () => new Map(Array.from(calendars.values()).map((c) => [c.id, c.color])),
    [calendars],
  )

  const projectNames = useMemo(
    () => new Map(Array.from(projects.values()).map((p) => [p.uid, p.summary])),
    [projects],
  )

  // Count tasks that depend on the delete target as a prerequisite
  const dependentCount = useMemo(() => {
    if (!deleteTarget) return 0
    return Array.from(tasks.values()).filter((t) =>
      t.prerequisites.some((p) => p.uid === deleteTarget.uid),
    ).length
  }, [deleteTarget, tasks])

  // Count subtasks of the delete target
  const subtaskCount = useMemo(() => {
    if (!deleteTarget) return 0
    return Array.from(tasks.values()).filter((t) => t.relatedTo === deleteTarget.uid).length
  }, [deleteTarget, tasks])

  // --- Handlers ---

  const handleToggleStatus = useCallback(async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'COMPLETED' ? 'NEEDS-ACTION' : 'COMPLETED'
    const updated: Task = { ...task, status: newStatus }
    const result = await putTask(updated, task.etag)
    if (result.ok) {
      updateEntity('task', { ...updated, etag: result.etag, rawIcs: serializeTask(updated) })
    }
  }, [putTask, updateEntity])

  const handleQuickAdd = useCallback(async (title: string, calendarId: string) => {
    const uid = crypto.randomUUID()
    const now = formatICalDate(new Date())
    const task: Task = {
      uid,
      calendarId,
      dtstamp: now,
      summary: title,
      status: 'NEEDS-ACTION',
      prerequisites: [],
      etag: '',
      rawIcs: '',
    }
    const result = await putTask(task)
    if (result.ok) {
      updateEntity('task', { ...task, etag: result.etag, rawIcs: serializeTask(task) })
    }
  }, [putTask, updateEntity])

  const handleDeleteConfirm = useCallback(async (task: Task) => {
    const allTasks = Array.from(tasks.values())

    // 1. Delete subtasks (tasks whose relatedTo points to this task)
    const subtasks = allTasks.filter((t) => t.relatedTo === task.uid)
    for (const sub of subtasks) {
      await deleteTask(sub)
      removeEntity('task', sub.uid)
    }

    // 2. Clean up prerequisites in dependent tasks
    const dependents = allTasks.filter((t) =>
      t.prerequisites.some((p) => p.uid === task.uid),
    )
    for (const dep of dependents) {
      const cleaned: Task = {
        ...dep,
        prerequisites: dep.prerequisites.filter((p) => p.uid !== task.uid),
      }
      const result = await putTask(cleaned, dep.etag)
      if (result.ok) {
        updateEntity('task', { ...cleaned, etag: result.etag, rawIcs: serializeTask(cleaned) })
      }
    }

    // 3. Delete the task itself
    await deleteTask(task)
    removeEntity('task', task.uid)

    // 4. Close dialog and deselect if needed
    setDeleteTarget(null)
    if (selectedEntityId === task.uid) selectEntity(null)
  }, [tasks, putTask, deleteTask, updateEntity, removeEntity, selectedEntityId, selectEntity])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
        <h1 className="text-lg font-bold">Tasks</h1>
        <div className="ml-auto flex items-center rounded-md border border-border">
          <button
            onClick={() => setTasksViewMode('list')}
            className={`flex items-center gap-1.5 rounded-l-md px-3 py-1 text-xs transition-colors ${
              tasksViewMode === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
          <button
            onClick={() => setTasksViewMode('kanban')}
            className={`flex items-center gap-1.5 rounded-r-md px-3 py-1 text-xs transition-colors ${
              tasksViewMode === 'kanban'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Columns3 className="h-3.5 w-3.5" />
            Kanban
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="shrink-0 border-b border-border px-4 py-2">
        <TaskFilterBar
          filters={taskFilters}
          projects={projects}
          onFilterChange={setTaskFilter}
          onReset={resetFilters}
          totalCount={totalCount}
          filteredCount={filteredCount}
        />
      </div>

      {/* Quick Add */}
      <div className="shrink-0 border-b border-border px-4 py-2">
        <TaskQuickAdd calendars={calendarsArr} onSubmit={handleQuickAdd} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tasksViewMode === 'list' ? (
          <div className="p-4">
            <TaskListView
              groups={groups}
              calendarColors={calendarColors}
              projectNames={projectNames}
              selectedTaskId={selectedEntityId}
              onToggleStatus={handleToggleStatus}
              onDelete={setDeleteTarget}
              onSelect={(t) => selectEntity(t.uid)}
            />
          </div>
        ) : (
          <TaskKanbanView
            tasks={flatSorted}
            calendarColors={calendarColors}
            selectedTaskId={selectedEntityId}
            onToggleStatus={handleToggleStatus}
            onSelect={(t) => selectEntity(t.uid)}
          />
        )}
      </div>

      {/* Delete confirmation */}
      <DeleteTaskDialog
        task={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        onConfirm={handleDeleteConfirm}
        dependentCount={dependentCount}
        subtaskCount={subtaskCount}
      />
    </div>
  )
}
