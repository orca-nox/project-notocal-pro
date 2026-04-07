import type { CalDAVConfig } from './client'

export function getCalDAVConfig(): CalDAVConfig {
  const username = import.meta.env.VITE_CALDAV_USERNAME

  if (!username) {
    throw new Error('Missing CalDAV configuration. Set VITE_CALDAV_USERNAME in .env')
  }

  // Point tsdav at the same origin. The proxy forwards /<username>/* to Radicale.
  return { serverUrl: window.location.origin, username }
}
