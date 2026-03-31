import type { Event, Task, Note, Project, TaskStatus, ProjectStatus } from '@/types/entities'
import { parseSubtasks } from '@/lib/markdown/subtasks'
import { parsePrerequisites } from '@/lib/markdown/prerequisites'

// ---------------------------------------------------------------------------
// Low-level .ics property extraction
// ---------------------------------------------------------------------------

/** Extract a single property value from raw .ics text (handles line folding) */
function prop(ics: string, name: string): string | undefined {
  // Unfold: RFC 5545 says long lines are folded with CRLF + whitespace
  const unfolded = ics.replace(/\r?\n[ \t]/g, '')
  // Match the property name, optionally with parameters (e.g. DTSTART;VALUE=DATE:...)
  const re = new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, 'm')
  const match = unfolded.match(re)
  return match?.[1]?.trim()
}

/** Unescape iCalendar text values */
function unescapeIcs(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\\\/g, '\\')
    .replace(/\\;/g, ';')
}

// ---------------------------------------------------------------------------
// Component type detection
// ---------------------------------------------------------------------------

type ComponentType = 'VEVENT' | 'VTODO' | 'VJOURNAL'

function detectComponent(ics: string): ComponentType | null {
  if (ics.includes('BEGIN:VEVENT')) return 'VEVENT'
  if (ics.includes('BEGIN:VTODO')) return 'VTODO'
  if (ics.includes('BEGIN:VJOURNAL')) return 'VJOURNAL'
  return null
}

// ---------------------------------------------------------------------------
// Public parsers
// ---------------------------------------------------------------------------

export function parseEvent(ics: string, calendarId: string, etag: string): Event | null {
  if (detectComponent(ics) !== 'VEVENT') return null

  const uid = prop(ics, 'UID')
  const dtstamp = prop(ics, 'DTSTAMP')
  const dtstart = prop(ics, 'DTSTART')
  const dtend = prop(ics, 'DTEND')
  const summary = prop(ics, 'SUMMARY')

  if (!uid || !dtstamp || !dtstart || !dtend || !summary) return null

  return {
    uid,
    calendarId,
    dtstamp,
    dtstart,
    dtend,
    summary: unescapeIcs(summary),
    description: prop(ics, 'DESCRIPTION') ? unescapeIcs(prop(ics, 'DESCRIPTION')!) : undefined,
    location: prop(ics, 'LOCATION') ? unescapeIcs(prop(ics, 'LOCATION')!) : undefined,
    relatedTo: prop(ics, 'RELATED-TO'),
    etag,
    rawIcs: ics,
  }
}

export function parseTask(ics: string, calendarId: string, etag: string): Task | null {
  if (detectComponent(ics) !== 'VTODO') return null

  const uid = prop(ics, 'UID')
  const dtstamp = prop(ics, 'DTSTAMP')
  const summary = prop(ics, 'SUMMARY')
  const status = prop(ics, 'STATUS') as TaskStatus | undefined

  if (!uid || !dtstamp || !summary || !status) return null

  const rawDescription = prop(ics, 'DESCRIPTION')
  const description = rawDescription ? unescapeIcs(rawDescription) : undefined
  const priorityStr = prop(ics, 'PRIORITY')

  return {
    uid,
    calendarId,
    dtstamp,
    summary: unescapeIcs(summary),
    due: prop(ics, 'DUE'),
    status,
    priority: priorityStr ? parseInt(priorityStr, 10) : undefined,
    description,
    relatedTo: prop(ics, 'RELATED-TO'),
    subtasks: description ? parseSubtasks(description) : [],
    prerequisites: description ? parsePrerequisites(description) : [],
    etag,
    rawIcs: ics,
  }
}

export function parseNote(ics: string, calendarId: string, etag: string): Note | null {
  if (detectComponent(ics) !== 'VJOURNAL') return null

  const uid = prop(ics, 'UID')
  const dtstamp = prop(ics, 'DTSTAMP')
  const summary = prop(ics, 'SUMMARY')

  if (!uid || !dtstamp || !summary) return null

  return {
    uid,
    calendarId,
    dtstamp,
    summary: unescapeIcs(summary),
    description: prop(ics, 'DESCRIPTION') ? unescapeIcs(prop(ics, 'DESCRIPTION')!) : undefined,
    relatedTo: prop(ics, 'RELATED-TO'),
    etag,
    rawIcs: ics,
  }
}

export function parseProject(ics: string, etag: string): Project | null {
  if (detectComponent(ics) !== 'VJOURNAL') return null

  const uid = prop(ics, 'UID')
  const dtstamp = prop(ics, 'DTSTAMP')
  const summary = prop(ics, 'SUMMARY')
  const categories = prop(ics, 'CATEGORIES')
  const projectStatus = prop(ics, 'X-PROJECT-STATUS') as ProjectStatus | undefined
  const priorityStr = prop(ics, 'X-PROJECT-PRIORITY')

  if (!uid || !dtstamp || !summary || !categories) return null

  return {
    uid,
    dtstamp,
    summary: unescapeIcs(summary),
    description: prop(ics, 'DESCRIPTION') ? unescapeIcs(prop(ics, 'DESCRIPTION')!) : undefined,
    dtstart: prop(ics, 'DTSTART'),
    dtend: prop(ics, 'DTEND'),
    categories: unescapeIcs(categories),
    status: projectStatus ?? 'Active',
    priority: priorityStr ? parseInt(priorityStr, 10) : 99,
    etag,
    rawIcs: ics,
  }
}

/**
 * Parse a raw .ics string into the appropriate entity type.
 * For VJOURNAL, `isProjectCollection` distinguishes projects from notes.
 */
export function parseEntity(
  ics: string,
  calendarId: string,
  etag: string,
  isProjectCollection: boolean,
): Event | Task | Note | Project | null {
  const component = detectComponent(ics)
  if (!component) return null

  switch (component) {
    case 'VEVENT':
      return parseEvent(ics, calendarId, etag)
    case 'VTODO':
      return parseTask(ics, calendarId, etag)
    case 'VJOURNAL':
      return isProjectCollection
        ? parseProject(ics, etag)
        : parseNote(ics, calendarId, etag)
  }
}
