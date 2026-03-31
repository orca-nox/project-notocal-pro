import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ActiveView } from '@/types/store'

interface UIState {
  activeView: ActiveView
  selectedEntityId: string | null
  navPinned: boolean
  notesEditorMode: 'split' | 'full'
}

interface UIActions {
  setView(view: ActiveView): void
  selectEntity(id: string | null): void
  toggleNavPin(): void
  setNotesEditorMode(mode: 'split' | 'full'): void
}

export const useUIStore = create<UIState & UIActions>()(
  persist(
    (set) => ({
      activeView: 'calendar',
      selectedEntityId: null,
      navPinned: false,
      notesEditorMode: 'split',

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
    }),
    {
      name: 'notocal-ui',
      // Only persist navPinned and notesEditorMode — view and selection are session-only
      partialize: (state) => ({
        navPinned: state.navPinned,
        notesEditorMode: state.notesEditorMode,
      }),
    },
  ),
)
