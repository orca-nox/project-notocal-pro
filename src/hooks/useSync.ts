import { useEffect, useRef, useCallback } from 'react'
import { useCalDAV } from '@/hooks/useCalDAV'
import { useGraphStore } from '@/store/useGraphStore'
import { useFilterStore } from '@/store/useFilterStore'
import { useSyncStore } from '@/store/useSyncStore'

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
  const syncingRef = useRef(false)
  const initializedRef = useRef(false)

  /** Enable any calendars not yet in the filter set (handles first load + new calendars). */
  const autoEnableCalendars = useCallback((calendarIds: string[]) => {
    const current = useFilterStore.getState().enabledCalendars
    const newIds = calendarIds.filter((id) => !current.has(id))
    if (current.size === 0) {
      enableAllCalendars(calendarIds)
    } else if (newIds.length > 0) {
      enableAllCalendars([...Array.from(current), ...newIds])
    }
  }, [enableAllCalendars])

  const doSync = useCallback(async () => {
    if (syncingRef.current) return
    syncingRef.current = true
    useSyncStore.getState().setStatus('syncing')
    try {
      const result = await fetchAll()
      replaceEntities(result)
      autoEnableCalendars(result.calendars.map((c) => c.id))
      useSyncStore.getState().setStatus('connected')
    } catch (err) {
      useSyncStore.getState().setError(
        err instanceof Error ? err.message : 'Sync failed',
      )
    } finally {
      syncingRef.current = false
    }
  }, [fetchAll, replaceEntities, autoEnableCalendars])

  // Initial load: cache first, then background sync
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const init = async () => {
      // Load from cache for instant UI
      const cached = await loadFromCache()
      if (cached.calendars.length > 0) {
        mergeEntities(cached)
        autoEnableCalendars(cached.calendars.map((c) => c.id))
      }
      // Then sync from Radicale in background
      await doSync()
      useSyncStore.getState().setInitialized()
    }
    init()
  }, [loadFromCache, mergeEntities, autoEnableCalendars, doSync])

  // Sync on tab focus
  useEffect(() => {
    const onFocus = () => { doSync() }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') doSync()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [doSync])
}
