// ---------------------------------------------------------------------------
// Core entity types mapping iCalendar components to TypeScript
// ---------------------------------------------------------------------------

export interface CalendarInfo {
  id: string
  displayName: string
  color: string
  /** User-defined ordering weight (lower = higher in sidebar) */
  order: number
  /** CalDAV collection URL */
  url: string
  /** WebDAV sync token for delta sync */
  syncToken?: string
}

// ---------------------------------------------------------------------------
// Events (VEVENT)
// ---------------------------------------------------------------------------

export interface Event {
  uid: string
  calendarId: string
  dtstamp: string
  dtstart: string
  dtend: string
  summary: string
  description?: string
  location?: string
  /** UID of the parent Project, if any */
  relatedTo?: string
  etag: string
  /** Raw .ics string for faithful round-tripping */
  rawIcs: string
}

// ---------------------------------------------------------------------------
// Tasks (VTODO)
// ---------------------------------------------------------------------------

export type TaskStatus = 'NEEDS-ACTION' | 'IN-PROCESS' | 'COMPLETED' | 'CANCELLED'

/** Reference to a related task (subtask or prerequisite). */
export interface TaskRef {
  uid: string
  title: string
}

export interface Task {
  uid: string
  calendarId: string
  dtstamp: string
  summary: string
  due?: string
  status: TaskStatus
  /** iCal priority (1-9, lower = higher). Undefined means no priority. */
  priority?: number
  description?: string
  /** UID of the parent entity (Project or parent Task for subtasks) */
  relatedTo?: string
  /** UIDs of tasks this task depends on (RELATED-TO;RELTYPE=DEPENDS-ON) */
  prerequisites: TaskRef[]
  etag: string
  rawIcs: string
}

// ---------------------------------------------------------------------------
// Notes (VJOURNAL in user calendars)
// ---------------------------------------------------------------------------

export interface Note {
  uid: string
  calendarId: string
  dtstamp: string
  summary: string
  /** Markdown content body */
  description?: string
  /** UID of the parent Project, if any */
  relatedTo?: string
  etag: string
  rawIcs: string
}

// ---------------------------------------------------------------------------
// Projects (VJOURNAL in system-projects collection)
// ---------------------------------------------------------------------------

export type ProjectStatus = 'Active' | 'Scheduled' | 'Done' | 'Cancelled'

export interface Project {
  uid: string
  dtstamp: string
  summary: string
  description?: string
  dtstart?: string
  dtend?: string
  /** Primary Context — the calendar name this project is associated with */
  categories: string
  status: ProjectStatus
  /** Sorting weight: lower = higher priority */
  priority: number
  etag: string
  rawIcs: string
}

// ---------------------------------------------------------------------------
// Union type for any entity
// ---------------------------------------------------------------------------

export type EntityType = 'event' | 'task' | 'note' | 'project'

export type Entity = Event | Task | Note | Project
