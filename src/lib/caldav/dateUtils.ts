// ---------------------------------------------------------------------------
// Pure date utilities for iCalendar date strings and calendar arithmetic.
// No external date library — operates on plain JS Date objects.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Parse / format iCal date strings
// ---------------------------------------------------------------------------

interface ParsedICalDate {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  second: number
  isAllDay: boolean
  isUTC: boolean
}

const ICAL_RE = /^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})(Z)?)?$/

export function parseICalDate(s: string): ParsedICalDate {
  const m = s.match(ICAL_RE)
  if (!m) throw new Error(`Cannot parse iCal date: ${s}`)
  const hasTime = Boolean(m[4])
  return {
    year:    parseInt(m[1], 10),
    month:   parseInt(m[2], 10),
    day:     parseInt(m[3], 10),
    hour:    hasTime ? parseInt(m[5], 10) : 0,
    minute:  hasTime ? parseInt(m[6], 10) : 0,
    second:  hasTime ? parseInt(m[7], 10) : 0,
    isAllDay: !hasTime,
    isUTC:   m[8] === 'Z',
  }
}

/** Convert a parsed iCal date to a JS Date. Floating times → local, UTC → UTC. */
export function toJSDate(p: ParsedICalDate): Date {
  if (p.isUTC) {
    return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second))
  }
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
}

/** Parse an iCal date string directly to a JS Date. */
export function icalToDate(s: string): Date {
  return toJSDate(parseICalDate(s))
}

/** Format a JS Date as an iCal date string.
 *  All-day → YYYYMMDD (local date).
 *  Timed   → YYYYMMDDTHHmmssZ (UTC). */
export function formatICalDate(date: Date, allDay = false): string {
  if (allDay) {
    const y = date.getFullYear()
    const mo = String(date.getMonth() + 1).padStart(2, '0')
    const d  = String(date.getDate()).padStart(2, '0')
    return `${y}${mo}${d}`
  }
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** True if the iCal string represents an all-day value (no T component). */
export function isAllDay(dtstart: string): boolean {
  return !dtstart.includes('T')
}

// ---------------------------------------------------------------------------
// HTML datetime-local <-> iCal conversion
// ---------------------------------------------------------------------------

/** `YYYY-MM-DDTHH:mm` (datetime-local input value) → iCal UTC string */
export function htmlDatetimeToIcal(s: string): string {
  if (!s) return ''
  // datetime-local value: "2026-04-01T09:30"
  const d = new Date(s) // parsed as local time by the HTML spec
  return formatICalDate(d)
}

/** iCal date string → `YYYY-MM-DDTHH:mm` for datetime-local input */
export function icalToHtmlDatetime(s: string): string {
  if (!s) return ''
  const d = icalToDate(s)
  const y  = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h  = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${day}T${h}:${mi}`
}

/** iCal all-day date string → `YYYY-MM-DD` for date input */
export function icalToHtmlDate(s: string): string {
  if (!s) return ''
  const p = parseICalDate(s)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Date arithmetic (all return new Date instances — no mutation)
// ---------------------------------------------------------------------------

export function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export function addMinutes(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 60_000)
}

export function addMonths(date: Date, n: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + n, 1)
  return d
}

/** Monday-anchored start of the ISO week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sun
  const diff = (day + 6) % 7 // Mon = 0 offset
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/** Snap `date` down to the nearest `snapMinutes` boundary. */
export function clampToGrid(date: Date, snapMinutes: number): Date {
  const totalMinutes = date.getHours() * 60 + date.getMinutes()
  const snapped = Math.round(totalMinutes / snapMinutes) * snapMinutes
  const d = new Date(date)
  d.setHours(Math.floor(snapped / 60), snapped % 60, 0, 0)
  return d
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

// ---------------------------------------------------------------------------
// Display formatting
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function formatMonthYear(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
}

export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  if (weekStart.getMonth() === end.getMonth()) {
    return `${MONTH_SHORT[weekStart.getMonth()]} ${weekStart.getDate()}–${end.getDate()}, ${weekStart.getFullYear()}`
  }
  return `${MONTH_SHORT[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTH_SHORT[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`
}

export function formatDayHeader(date: Date): string {
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()}`
}

export function formatTimeHHMM(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export function formatHour(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return '12 PM'
  return `${hour - 12} PM`
}

export { MONTH_NAMES, DAY_NAMES }
