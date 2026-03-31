import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TaskFilters, TaskSortField } from '@/types/store'

interface FilterState {
  enabledCalendars: Set<string>
  taskFilters: TaskFilters
}

interface FilterActions {
  toggleCalendar(calendarId: string): void
  enableAllCalendars(calendarIds: string[]): void
  setTaskFilter<K extends keyof TaskFilters>(key: K, value: TaskFilters[K]): void
  resetFilters(): void
}

const defaultTaskFilters: TaskFilters = {
  status: 'all',
  dueDate: 'all',
  projectId: null,
  priority: 'all',
  sort: 'dueDate' as TaskSortField,
}

export const useFilterStore = create<FilterState & FilterActions>()(
  persist(
    (set) => ({
      enabledCalendars: new Set<string>(),
      taskFilters: { ...defaultTaskFilters },

      toggleCalendar(calendarId) {
        set((state) => {
          const next = new Set(state.enabledCalendars)
          if (next.has(calendarId)) {
            next.delete(calendarId)
          } else {
            next.add(calendarId)
          }
          return { enabledCalendars: next }
        })
      },

      enableAllCalendars(calendarIds) {
        set({ enabledCalendars: new Set(calendarIds) })
      },

      setTaskFilter(key, value) {
        set((state) => ({
          taskFilters: { ...state.taskFilters, [key]: value },
        }))
      },

      resetFilters() {
        set({ taskFilters: { ...defaultTaskFilters } })
      },
    }),
    {
      name: 'notocal-filters',
      storage: {
        getItem(name) {
          const raw = localStorage.getItem(name)
          if (!raw) return null
          const parsed = JSON.parse(raw)
          // Rehydrate Set from array
          if (parsed?.state?.enabledCalendars) {
            parsed.state.enabledCalendars = new Set(parsed.state.enabledCalendars)
          }
          return parsed
        },
        setItem(name, value) {
          // Serialize Set to array
          const serializable = {
            ...value,
            state: {
              ...value.state,
              enabledCalendars: Array.from(value.state.enabledCalendars),
            },
          }
          localStorage.setItem(name, JSON.stringify(serializable))
        },
        removeItem(name) {
          localStorage.removeItem(name)
        },
      },
    },
  ),
)
