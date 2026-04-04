import type { Event, Task, Note, Project } from '@/types/entities'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape text values per RFC 5545 */
function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/** Format the current time as a DTSTAMP value */
function nowStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Build a line only if the value is defined */
function optLine(name: string, value: string | undefined): string {
  if (value === undefined) return ''
  return `${name}:${value}\r\n`
}

/** Build a line with an escaped text value, only if defined */
function optTextLine(name: string, value: string | undefined): string {
  if (value === undefined) return ''
  return `${name}:${escapeIcs(value)}\r\n`
}

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

export function serializeEvent(event: Event): string {
  return (
    `BEGIN:VCALENDAR\r\n` +
    `VERSION:2.0\r\n` +
    `PRODID:-//Notocal Pro//EN\r\n` +
    `BEGIN:VEVENT\r\n` +
    `UID:${event.uid}\r\n` +
    `DTSTAMP:${nowStamp()}\r\n` +
    `DTSTART:${event.dtstart}\r\n` +
    `DTEND:${event.dtend}\r\n` +
    `SUMMARY:${escapeIcs(event.summary)}\r\n` +
    optTextLine('DESCRIPTION', event.description) +
    optTextLine('LOCATION', event.location) +
    optLine('RELATED-TO', event.relatedTo) +
    `END:VEVENT\r\n` +
    `END:VCALENDAR\r\n`
  )
}

export function serializeTask(task: Task): string {
  // Build prerequisite RELATED-TO lines with RELTYPE=DEPENDS-ON
  const prereqLines = task.prerequisites
    .map((p) => `RELATED-TO;RELTYPE=DEPENDS-ON:${p.uid}\r\n`)
    .join('')

  return (
    `BEGIN:VCALENDAR\r\n` +
    `VERSION:2.0\r\n` +
    `PRODID:-//Notocal Pro//EN\r\n` +
    `BEGIN:VTODO\r\n` +
    `UID:${task.uid}\r\n` +
    `DTSTAMP:${nowStamp()}\r\n` +
    `SUMMARY:${escapeIcs(task.summary)}\r\n` +
    optLine('DUE', task.due) +
    `STATUS:${task.status}\r\n` +
    (task.priority !== undefined ? `PRIORITY:${task.priority}\r\n` : '') +
    optTextLine('DESCRIPTION', task.description) +
    optLine('RELATED-TO', task.relatedTo) +
    prereqLines +
    `END:VTODO\r\n` +
    `END:VCALENDAR\r\n`
  )
}

export function serializeNote(note: Note): string {
  return (
    `BEGIN:VCALENDAR\r\n` +
    `VERSION:2.0\r\n` +
    `PRODID:-//Notocal Pro//EN\r\n` +
    `BEGIN:VJOURNAL\r\n` +
    `UID:${note.uid}\r\n` +
    `DTSTAMP:${nowStamp()}\r\n` +
    `SUMMARY:${escapeIcs(note.summary)}\r\n` +
    optTextLine('DESCRIPTION', note.description) +
    optLine('RELATED-TO', note.relatedTo) +
    `END:VJOURNAL\r\n` +
    `END:VCALENDAR\r\n`
  )
}

export function serializeProject(project: Project): string {
  return (
    `BEGIN:VCALENDAR\r\n` +
    `VERSION:2.0\r\n` +
    `PRODID:-//Notocal Pro//EN\r\n` +
    `BEGIN:VJOURNAL\r\n` +
    `UID:${project.uid}\r\n` +
    `DTSTAMP:${nowStamp()}\r\n` +
    `SUMMARY:${escapeIcs(project.summary)}\r\n` +
    optTextLine('DESCRIPTION', project.description) +
    optLine('DTSTART', project.dtstart) +
    optLine('DTEND', project.dtend) +
    `CATEGORIES:${escapeIcs(project.categories)}\r\n` +
    `X-PROJECT-STATUS:${project.status}\r\n` +
    `X-PROJECT-PRIORITY:${project.priority}\r\n` +
    `END:VJOURNAL\r\n` +
    `END:VCALENDAR\r\n`
  )
}

