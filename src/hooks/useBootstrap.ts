import { useCallback, useEffect, useRef, useState } from 'react'
import { getClient } from '@/lib/caldav/client'
import { getCalDAVConfig } from '@/lib/caldav/config'

const SYSTEM_PROJECTS_PATH = 'system-projects'

/**
 * Ensures the system-projects collection exists on Radicale.
 * Runs once on mount, idempotent on subsequent loads.
 */
export function useBootstrap() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ranRef = useRef(false)

  const bootstrap = useCallback(async () => {
    try {
      const config = getCalDAVConfig()
      const dav = await getClient(config)
      const calendars = await dav.fetchCalendars()

      const exists = calendars.some((c) => {
        const pathSegments = (c.url || '').replace(/\/+$/, '').split('/')
        return pathSegments[pathSegments.length - 1] === SYSTEM_PROJECTS_PATH
      })

      if (!exists) {
        const base = config.serverUrl.replace(/\/$/, '')
        const collectionUrl = `${base}/${config.username}/${SYSTEM_PROJECTS_PATH}/`
        await dav.makeCalendar({
          url: collectionUrl,
          props: { displayname: 'System Projects' },
        })
      }

      setReady(true)
    } catch (err) {
      setError(String(err))
    }
  }, [])

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    bootstrap()
  }, [bootstrap])

  return { ready, error }
}
