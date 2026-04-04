import type { Event, Task, Note, Project, TaskStatus, ProjectStatus, TaskRef } from '@/types/entities'

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

interface RelatedToEntry {
  uid: string
  reltype: string // 'PARENT' (default), 'DEPENDS-ON', etc.
}

/** Extract all RELATED-TO properties with their RELTYPE parameter. */
function propAllRelatedTo(ics: string): RelatedToEntry[] {
  const unfolded = ics.replace(/\r?\n[ \t]/g, '')
  const results: RelatedToEntry[] = []
  const re = /^RELATED-TO(?:;([^:]*))?\s*:(.*)$/gm
  let match
  while ((match = re.exec(unfolded)) !== null) {
    const params = match[1] ?? ''
    const uid = match[2].trim()
    // Extract RELTYPE from parameters (e.g. "RELTYPE=DEPENDS-ON")
    const reltypeMatch = params.match(/RELTYPE=([^;]+)/i)
    const reltype = reltypeMatch ? reltypeMatch[1].toUpperCase() : 'PARENT'
    results.push({ uid, reltype })
  }
  return results
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

/** Extract the inner block of the target component (VEVENT/VTODO/VJOURNAL)
 *  so that prop() doesn't accidentally match properties from VTIMEZONE etc. */
function extractComponentBlock(ics: string, component: ComponentType): string {
  const begin = `BEGIN:${component}`
  const end = `END:${component}`
  const startIdx = ics.indexOf(begin)
  if (startIdx === -1) return ics
  const endIdx = ics.indexOf(end, startIdx)
  if (endIdx === -1) return ics
  return ics.slice(startIdx, endIdx + end.length)
}

// ---------------------------------------------------------------------------
// DURATION → DTEND conversion (RFC 5545 §3.3.6)
// ---------------------------------------------------------------------------

function durationToMs(dur: string): number | null {
  const m = dur.match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/)
  if (!m) return null
  let ms = 0
  if (m[1]) ms += parseInt(m[1]) * 7 * 86400000
  if (m[2]) ms += parseInt(m[2]) * 86400000
  if (m[3]) ms += parseInt(m[3]) * 3600000
  if (m[4]) ms += parseInt(m[4]) * 60000
  if (m[5]) ms += parseInt(m[5]) * 1000
  return ms
}

/** Parse an iCal date/datetime string into a Date, then add duration ms, return formatted string. */
function computeDtend(dtstart: string, duration: string): string | null {
  const ms = durationToMs(duration)
  if (ms === null) return null

  const hasTime = dtstart.includes('T')
  const clean = dtstart.replace(/[-:]/g, '')
  const y = parseInt(clean.slice(0, 4))
  const mo = parseInt(clean.slice(4, 6)) - 1
  const d = parseInt(clean.slice(6, 8))

  let start: Date
  if (hasTime) {
    const h = parseInt(clean.slice(9, 11))
    const mi = parseInt(clean.slice(11, 13))
    const s = parseInt(clean.slice(13, 15) || '0')
    start = clean.endsWith('Z')
      ? new Date(Date.UTC(y, mo, d, h, mi, s))
      : new Date(y, mo, d, h, mi, s)
  } else {
    start = new Date(y, mo, d)
  }

  const end = new Date(start.getTime() + ms)

  if (!hasTime) {
    const ey = end.getFullYear()
    const emo = String(end.getMonth() + 1).padStart(2, '0')
    const ed = String(end.getDate()).padStart(2, '0')
    return `${ey}${emo}${ed}`
  }
  return end.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// ---------------------------------------------------------------------------
// Public parsers
// ---------------------------------------------------------------------------

export function parseEvent(ics: string, calendarId: string, etag: string): Event | null {
  const component = detectComponent(ics)
  if (component !== 'VEVENT') return null

  // Extract only the VEVENT block so we don't match VTIMEZONE properties
  const block = extractComponentBlock(ics, component)

  const uid = prop(block, 'UID')
  const dtstamp = prop(block, 'DTSTAMP')
  const dtstart = prop(block, 'DTSTART')
  let dtend = prop(block, 'DTEND')
  const summary = prop(block, 'SUMMARY')

  // Fallback: compute DTEND from DURATION if not explicitly set
  if (!dtend && dtstart) {
    const duration = prop(block, 'DURATION')
    if (duration) dtend = computeDtend(dtstart, duration) ?? undefined
  }

  if (!uid || !dtstamp || !dtstart || !dtend || !summary) return null

  return {
    uid,
    calendarId,
    dtstamp,
    dtstart,
    dtend,
    summary: unescapeIcs(summary),
    description: prop(block, 'DESCRIPTION') ? unescapeIcs(prop(block, 'DESCRIPTION')!) : undefined,
    location: prop(block, 'LOCATION') ? unescapeIcs(prop(block, 'LOCATION')!) : undefined,
    relatedTo: prop(block, 'RELATED-TO'),
    etag,
    rawIcs: ics,
  }
}

export function parseTask(ics: string, calendarId: string, etag: string): Task | null {
  const component = detectComponent(ics)
  if (component !== 'VTODO') return null

  const block = extractComponentBlock(ics, component)

  const uid = prop(block, 'UID')
  const dtstamp = prop(block, 'DTSTAMP')
  const summary = prop(block, 'SUMMARY')
  const status = prop(block, 'STATUS') as TaskStatus | undefined

  if (!uid || !dtstamp || !summary || !status) return null

  const rawDescription = prop(block, 'DESCRIPTION')
  const description = rawDescription ? unescapeIcs(rawDescription) : undefined
  const priorityStr = prop(block, 'PRIORITY')

  // Parse RELATED-TO properties with RELTYPE discrimination
  const allRelated = propAllRelatedTo(block)
  const parentRel = allRelated.find((r) => r.reltype === 'PARENT')
  const dependsOn: TaskRef[] = allRelated
    .filter((r) => r.reltype === 'DEPENDS-ON')
    .map((r) => ({ uid: r.uid, title: '' })) // titles resolved post-parse

  return {
    uid,
    calendarId,
    dtstamp,
    summary: unescapeIcs(summary),
    due: prop(block, 'DUE'),
    status,
    priority: priorityStr ? parseInt(priorityStr, 10) : undefined,
    description,
    relatedTo: parentRel?.uid,
    prerequisites: dependsOn,
    etag,
    rawIcs: ics,
  }
}

export function parseNote(ics: string, calendarId: string, etag: string): Note | null {
  const component = detectComponent(ics)
  if (component !== 'VJOURNAL') return null

  const block = extractComponentBlock(ics, component)

  const uid = prop(block, 'UID')
  const dtstamp = prop(block, 'DTSTAMP')
  const summary = prop(block, 'SUMMARY')

  if (!uid || !dtstamp || !summary) return null

  return {
    uid,
    calendarId,
    dtstamp,
    summary: unescapeIcs(summary),
    description: prop(block, 'DESCRIPTION') ? unescapeIcs(prop(block, 'DESCRIPTION')!) : undefined,
    relatedTo: prop(block, 'RELATED-TO'),
    etag,
    rawIcs: ics,
  }
}

export function parseProject(ics: string, etag: string): Project | null {
  const component = detectComponent(ics)
  if (component !== 'VJOURNAL') return null

  const block = extractComponentBlock(ics, component)

  const uid = prop(block, 'UID')
  const dtstamp = prop(block, 'DTSTAMP')
  const summary = prop(block, 'SUMMARY')
  const categories = prop(block, 'CATEGORIES')
  const projectStatus = prop(block, 'X-PROJECT-STATUS') as ProjectStatus | undefined
  const priorityStr = prop(block, 'X-PROJECT-PRIORITY')

  if (!uid || !dtstamp || !summary || !categories) return null

  return {
    uid,
    dtstamp,
    summary: unescapeIcs(summary),
    description: prop(block, 'DESCRIPTION') ? unescapeIcs(prop(block, 'DESCRIPTION')!) : undefined,
    dtstart: prop(block, 'DTSTART'),
    dtend: prop(block, 'DTEND'),
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
