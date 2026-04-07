import { useEffect } from 'react'
import { useUIStore } from '@/store/useUIStore'
import { useGraphStore } from '@/store/useGraphStore'
import { useFilterStore } from '@/store/useFilterStore'
import { useAIStore } from '@/store/useAIStore'
import type { ActiveView } from '@/types/store'

const VIEW_KEYS: Record<string, ActiveView> = {
  '1': 'projects',
  '2': 'calendar',
  '3': 'tasks',
  '4': 'notes',
}

/**
 * Returns an ordered list of entity UIDs for arrow-key navigation
 * based on the active view.
 */
function getNavigableIds(): string[] {
  const view = useUIStore.getState().activeView
  const { events, tasks, notes, projects } = useGraphStore.getState()
  const enabledCalendars = useFilterStore.getState().enabledCalendars

  switch (view) {
    case 'calendar': {
      return Array.from(events.values())
        .filter((e) => enabledCalendars.has(e.calendarId))
        .sort((a, b) => a.dtstart.localeCompare(b.dtstart))
        .map((e) => e.uid)
    }
    case 'tasks': {
      return Array.from(tasks.values())
        .filter((t) => enabledCalendars.has(t.calendarId))
        .map((t) => t.uid)
    }
    case 'notes': {
      return Array.from(notes.values())
        .sort((a, b) => b.dtstamp.localeCompare(a.dtstamp))
        .map((n) => n.uid)
    }
    case 'projects': {
      return Array.from(projects.values())
        .sort((a, b) => a.priority - b.priority)
        .map((p) => p.uid)
    }
    default:
      return []
  }
}

export function useKeyboardShortcuts() {
  const setView = useUIStore((s) => s.setView)
  const selectEntity = useUIStore((s) => s.selectEntity)
  const toggleAI = useAIStore((s) => s.toggle)
  const setAIOpen = useAIStore((s) => s.setOpen)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ctrl+K opens global search (works even in inputs)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        useUIStore.getState().setSearchOpen(true)
        return
      }

      // Ctrl+. toggles AI chat (works even in inputs)
      if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        e.preventDefault()
        toggleAI()
        return
      }

      const tag = (e.target as HTMLElement)?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
        || (e.target as HTMLElement)?.isContentEditable

      if (isInput) return

      // View switching: 1-4
      if (!e.ctrlKey && !e.metaKey && !e.altKey && VIEW_KEYS[e.key]) {
        e.preventDefault()
        setView(VIEW_KEYS[e.key])
        return
      }

      // Escape: close search first, then AI chat, then deselect entity
      if (e.key === 'Escape') {
        if (useUIStore.getState().searchOpen) {
          useUIStore.getState().setSearchOpen(false)
          return
        }
        if (useAIStore.getState().isOpen) {
          setAIOpen(false)
          return
        }
        selectEntity(null)
        return
      }

      // Arrow up/down: navigate between items in lists
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const ids = getNavigableIds()
        if (ids.length === 0) return

        const currentId = useUIStore.getState().selectedEntityId
        const currentIdx = currentId ? ids.indexOf(currentId) : -1

        let nextIdx: number
        if (e.key === 'ArrowDown') {
          nextIdx = currentIdx < ids.length - 1 ? currentIdx + 1 : 0
        } else {
          nextIdx = currentIdx > 0 ? currentIdx - 1 : ids.length - 1
        }
        selectEntity(ids[nextIdx])
        return
      }

      // Enter: opens/selects the highlighted item (already selected via arrows)
      // The detail pane already shows the selected item, so Enter is a no-op
      // unless we want to expand/open it. For now it confirms selection.
      if (e.key === 'Enter') {
        // Already handled by selectEntity from arrow keys
        return
      }

      // N: create new item contextually
      if (e.key === 'n' || e.key === 'N') {
        if (e.ctrlKey || e.metaKey || e.altKey) return
        e.preventDefault()
        // Dispatch a custom event that views can listen to
        window.dispatchEvent(new CustomEvent('notocal:quick-add'))
        return
      }

      // Delete / Backspace: delete selected item
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedId = useUIStore.getState().selectedEntityId
        if (!selectedId) return
        e.preventDefault()
        // Dispatch a custom event that views can listen to
        window.dispatchEvent(new CustomEvent('notocal:delete-selected', { detail: { uid: selectedId } }))
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setView, selectEntity, toggleAI, setAIOpen])
}
