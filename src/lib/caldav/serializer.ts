import type { Event, Task, Note, Project } from '@/types/entities'
import { serializeSubtasks } from '@/lib/markdown/subtasks'
import { serializePrerequisites } from '@/lib/markdown/prerequisites'

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
  // Build the structured DESCRIPTION from subtasks, prerequisites, and freeform notes
  const parts: string[] = []

  if (task.subtasks.length > 0) {
    parts.push(serializeSubtasks(task.subtasks))
  }
  if (task.prerequisites.length > 0) {
    parts.push(serializePrerequisites(task.prerequisites))
  }
  // Preserve any freeform description text that isn't part of subtasks/prerequisites
  if (task.description) {
    const freeform = extractFreeformDescription(task.description)
    if (freeform) {
      parts.push(`## Notes\n${freeform}`)
    }
  }

  const fullDescription = parts.length > 0 ? parts.join('\n\n') : undefined

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
    optTextLine('DESCRIPTION', fullDescription) +
    optLine('RELATED-TO', task.relatedTo) +
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

// ---------------------------------------------------------------------------
// Description helpers
// ---------------------------------------------------------------------------

/**
 * Extract freeform text from a task description, stripping out
 * the structured ## Sub-tasks, ## Prerequisites, and ## Notes headers.
 */
function extractFreeformDescription(description: string): string | undefined {
  const lines = description.split('\n')
  const freeformLines: string[] = []
  let inStructuredSection = false

  for (const line of lines) {
    if (/^## (Sub-tasks|Prerequisites|Notes)$/i.test(line)) {
      inStructuredSection = line.toLowerCase().includes('notes')
      continue
    }
    if (/^## /.test(line)) {
      inStructuredSection = false
      continue
    }
    if (inStructuredSection) {
      freeformLines.push(line)
    }
  }

  const result = freeformLines.join('\n').trim()
  return result || undefined
}
