import { useEffect } from 'react'
import { useUIStore } from '@/store/useUIStore'
import type { ActiveView } from '@/types/store'

const VIEW_KEYS: Record<string, ActiveView> = {
  '1': 'projects',
  '2': 'calendar',
  '3': 'tasks',
  '4': 'notes',
}

export function useKeyboardShortcuts() {
  const setView = useUIStore((s) => s.setView)
  const selectEntity = useUIStore((s) => s.selectEntity)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement)?.isContentEditable) return

      // View switching: 1-4
      if (!e.ctrlKey && !e.metaKey && !e.altKey && VIEW_KEYS[e.key]) {
        e.preventDefault()
        setView(VIEW_KEYS[e.key])
        return
      }

      // Escape: deselect entity
      if (e.key === 'Escape') {
        selectEntity(null)
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setView, selectEntity])
}
