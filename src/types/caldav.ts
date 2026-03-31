// ---------------------------------------------------------------------------
// Thin wrappers around tsdav types for CalDAV responses
// ---------------------------------------------------------------------------

import type { DAVCalendar, DAVObject } from 'tsdav'

/** A CalDAV calendar collection as returned by tsdav */
export type CalDAVCalendar = DAVCalendar

/** A CalDAV object (event, task, or journal) as returned by tsdav */
export type CalDAVObject = DAVObject

/** Response from a CalDAV sync-collection report */
export interface SyncReport {
  objects: CalDAVObject[]
  syncToken: string
}

/** Possible outcomes of a CalDAV write operation */
export type WriteResult =
  | { ok: true; etag: string }
  | { ok: false; status: 412; message: 'conflict' }
  | { ok: false; status: number; message: string }
