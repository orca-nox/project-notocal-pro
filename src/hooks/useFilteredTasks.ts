import { useMemo } from 'react'
import { useGraphStore } from '@/store/useGraphStore'
import { useFilterStore } from '@/store/useFilterStore'
import { icalToDate, isSameDay, addDays } from '@/lib/caldav/dateUtils'
import type { Task, Project } from '@/types/entities'
import type { TaskFilters } from '@/types/store'

export interface TaskGroup {
  key: string
  project: Project | null
  tasks: Task[]
}

export interface FilteredTasksResult {
  groups: TaskGroup[]
  flatSorted: Task[]
  totalCount: number
  filteredCount: number
}

function matchesStatus(task: Task, filter: TaskFilters['status']): boolean {
  if (filter === 'all') return true
  const map: Record<string, string> = {
    'needs-action': 'NEEDS-ACTION',
    completed: 'COMPLETED',
    cancelled: 'CANCELLED',
  }
  return task.status === map[filter]
}

function matchesDueDate(task: Task, filter: TaskFilters['dueDate']): boolean {
  if (filter === 'all') return true
  if (filter === 'none') return !task.due

  if (!task.due) return false
  const due = icalToDate(task.due)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  switch (filter) {
    case 'overdue':
      return due < today && task.status !== 'COMPLETED'
    case 'today':
      return isSameDay(due, today)
    case 'week':
      return due >= today && due <= addDays(today, 7)
    case 'month':
      return due >= today && due <= addDays(today, 30)
    default:
      return true
  }
}

function matchesPriority(task: Task, filter: TaskFilters['priority']): boolean {
  if (filter === 'all') return true
  if (filter === 'none') return task.priority === undefined
  if (task.priority === undefined) return false
  switch (filter) {
    case 'high': return task.priority >= 1 && task.priority <= 3
    case 'medium': return task.priority >= 4 && task.priority <= 6
    case 'low': return task.priority >= 7 && task.priority <= 9
    default: return true
  }
}

function matchesProject(task: Task, projectId: string | null): boolean {
  if (projectId === null) return true
  if (projectId === '__unassigned__') return !task.relatedTo
  return task.relatedTo === projectId
}

function sortTasks(tasks: Task[], sort: TaskFilters['sort']): Task[] {
  return [...tasks].sort((a, b) => {
    switch (sort) {
      case 'dueDate': {
        if (!a.due && !b.due) return 0
        if (!a.due) return 1
        if (!b.due) return -1
        return icalToDate(a.due).getTime() - icalToDate(b.due).getTime()
      }
      case 'priority': {
        const pa = a.priority ?? 99
        const pb = b.priority ?? 99
        return pa - pb
      }
      case 'project':
        return (a.relatedTo ?? '').localeCompare(b.relatedTo ?? '')
      case 'created':
        return b.dtstamp.localeCompare(a.dtstamp)
      default:
        return 0
    }
  })
}

export function useFilteredTasks(): FilteredTasksResult {
  const tasks = useGraphStore((s) => s.tasks)
  const projects = useGraphStore((s) => s.projects)
  const enabledCalendars = useFilterStore((s) => s.enabledCalendars)
  const taskFilters = useFilterStore((s) => s.taskFilters)

  return useMemo(() => {
    const allTasks = Array.from(tasks.values())

    // Exclude subtasks (tasks whose relatedTo points to another task, not a project)
    const topLevelTasks = allTasks.filter((t) => {
      if (!t.relatedTo) return true
      // If relatedTo points to another task, it's a subtask — hide from top level
      return !tasks.has(t.relatedTo)
    })
    const totalCount = topLevelTasks.length

    const filtered = topLevelTasks.filter((t) =>
      enabledCalendars.has(t.calendarId) &&
      matchesStatus(t, taskFilters.status) &&
      matchesDueDate(t, taskFilters.dueDate) &&
      matchesPriority(t, taskFilters.priority) &&
      matchesProject(t, taskFilters.projectId),
    )

    const flatSorted = sortTasks(filtered, taskFilters.sort)

    // Group by project
    const groupMap = new Map<string, Task[]>()
    for (const task of flatSorted) {
      const key = task.relatedTo ?? '__unassigned__'
      const group = groupMap.get(key)
      if (group) group.push(task)
      else groupMap.set(key, [task])
    }

    const groups: TaskGroup[] = []
    // Projects first (sorted by priority)
    const sortedProjects = Array.from(projects.values()).sort((a, b) => a.priority - b.priority)
    for (const proj of sortedProjects) {
      const tasksInGroup = groupMap.get(proj.uid)
      if (tasksInGroup) {
        groups.push({ key: proj.uid, project: proj, tasks: tasksInGroup })
        groupMap.delete(proj.uid)
      }
    }
    // Unassigned last
    const unassigned = groupMap.get('__unassigned__')
    if (unassigned) {
      groups.push({ key: '__unassigned__', project: null, tasks: unassigned })
    }
    // Any remaining groups (tasks with relatedTo pointing to unknown projects)
    for (const [key, tasksInGroup] of groupMap) {
      if (key !== '__unassigned__') {
        groups.push({ key, project: null, tasks: tasksInGroup })
      }
    }

    return { groups, flatSorted, totalCount, filteredCount: filtered.length }
  }, [tasks, projects, enabledCalendars, taskFilters])
}
