import { useEffect, useRef, useCallback } from 'react'
import { useCalDAV } from '@/hooks/useCalDAV'
import { useGraphStore } from '@/store/useGraphStore'
import { useFilterStore } from '@/store/useFilterStore'

/**
 * Sync-on-focus hook: triggers a full fetch from Radicale when the browser
 * tab regains focus, and merges the result into the graph store.
 *
 * Also handles the initial load: reads from IndexedDB cache for instant UI,
 * then fetches from Radicale in the background.
 */
export function useSync() {
  const { fetchAll, loadFromCache } = useCalDAV()
  const mergeEntities = useGraphStore((s) => s.mergeEntities)
  const replaceEntities = useGraphStore((s) => s.replaceEntities)
  const enableAllCalendars = useFilterStore((s) => s.enableAllCalendars)
  const enabledCalendars = useFilterStore((s) => s.enabledCalendars)
  const syncingRef = useRef(false)
  const initializedRef = useRef(false)

  const doSync = useCallback(async () => {
    if (syncingRef.current) return
    syncingRef.current = true
    try {
      const result = await fetchAll()
      replaceEntities(result)
      // If no calendars are enabled yet (first load), enable all
      if (enabledCalendars.size === 0) {
        enableAllCalendars(result.calendars.map((c) => c.id))
      }
    } finally {
      syncingRef.current = false
    }
  }, [fetchAll, replaceEntities, enableAllCalendars, enabledCalendars.size])

  // Initial load: cache first, then background sync
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const init = async () => {
      // Load from cache for instant UI
      const cached = await loadFromCache()
      if (cached.calendars.length > 0) {
        mergeEntities(cached)
        if (enabledCalendars.size === 0) {
          enableAllCalendars(cached.calendars.map((c) => c.id))
        }
      }
      // Then sync from Radicale in background
      await doSync()
    }
    init()
  }, [loadFromCache, mergeEntities, enableAllCalendars, enabledCalendars.size, doSync])

  // Sync on tab focus
  useEffect(() => {
    const onFocus = () => { doSync() }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') doSync()
    })

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [doSync])
}
