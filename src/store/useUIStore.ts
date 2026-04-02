import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ActiveView } from '@/types/store'

interface UIState {
  activeView: ActiveView
  selectedEntityId: string | null
  navPinned: boolean
  notesEditorMode: 'split' | 'full'
  tasksViewMode: 'list' | 'kanban'
}

interface UIActions {
  setView(view: ActiveView): void
  selectEntity(id: string | null): void
  toggleNavPin(): void
  setNotesEditorMode(mode: 'split' | 'full'): void
  setTasksViewMode(mode: 'list' | 'kanban'): void
}

export const useUIStore = create<UIState & UIActions>()(
  persist(
    (set) => ({
      activeView: 'calendar',
      selectedEntityId: null,
      navPinned: false,
      notesEditorMode: 'split',
      tasksViewMode: 'list',

      setView(view) {
        set({ activeView: view, selectedEntityId: null })
      },
      selectEntity(id) {
        set({ selectedEntityId: id })
      },
      toggleNavPin() {
        set((state) => ({ navPinned: !state.navPinned }))
      },
      setNotesEditorMode(mode) {
        set({ notesEditorMode: mode })
      },
      setTasksViewMode(mode) {
        set({ tasksViewMode: mode })
      },
    }),
    {
      name: 'notocal-ui',
      partialize: (state) => ({
        navPinned: state.navPinned,
        notesEditorMode: state.notesEditorMode,
        tasksViewMode: state.tasksViewMode,
      }),
    },
  ),
)
