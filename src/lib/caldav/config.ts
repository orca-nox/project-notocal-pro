import type { CalDAVConfig } from './client'

export function getCalDAVConfig(): CalDAVConfig {
  const username = import.meta.env.VITE_CALDAV_USERNAME
  const password = import.meta.env.VITE_CALDAV_PASSWORD

  if (!username || !password) {
    throw new Error(
      'Missing CalDAV configuration. Set VITE_CALDAV_USERNAME and VITE_CALDAV_PASSWORD in .env',
    )
  }

  // Point tsdav at the same origin. Vite proxies /.well-known/caldav and /<username>/*
  // to the real Radicale server, so tsdav's service discovery works without CORS issues.
  return { serverUrl: window.location.origin, username, password }
}
