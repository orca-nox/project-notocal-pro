import { useMemo, useRef, useEffect, useCallback } from 'react'
import type { CSSProperties } from 'react'
import {
  startOfWeek,
  addDays,
  addMinutes,
  isSameDay,
  isToday,
  icalToDate,
  formatDayHeader,
  formatHour,
  clampToGrid,
  isAllDay,
} from '@/lib/caldav/dateUtils'
import { EventBlock } from './EventBlock'
import type { Event, CalendarInfo } from '@/types/entities'

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const HOUR_HEIGHT = 60   // px per hour == 1px per minute
const SNAP_MINUTES = 15
const TIME_GUTTER_W = 56 // px

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WeekGridProps {
  viewDate: Date
  events: Event[]
  calendars: Map<string, CalendarInfo>
  selectedEventId: string | null
  onEventClick: (event: Event) => void
  onSlotClick: (date: Date) => void
  onEventMove: (event: Event, newStart: Date, newEnd: Date) => void
  onEventResize: (event: Event, newEnd: Date) => void
}

interface DragState {
  type: 'move' | 'resize'
  event: Event
  originY: number
  originX: number
  originalStart: Date
  originalEnd: Date
  node: HTMLDivElement
  columnWidth: number
}

interface PositionedEvent {
  event: Event
  top: number
  height: number
  left: string
  width: string
}

// ---------------------------------------------------------------------------
// Overlap layout: simple column-assignment sweep
// ---------------------------------------------------------------------------
function layoutEvents(events: Event[]): PositionedEvent[] {
  const sorted = [...events].sort((a, b) => a.dtstart.localeCompare(b.dtstart))
  const columns: { end: Date }[] = []
  const assignments: number[] = []

  for (const ev of sorted) {
    let start: Date, end: Date
    try {
      start = icalToDate(ev.dtstart)
      end = icalToDate(ev.dtend)
    } catch {
      assignments.push(0)
      continue
    }

    let col = 0
    while (col < columns.length && columns[col].end > start) col++
    if (col === columns.length) columns.push({ end })
    else columns[col].end = end > columns[col].end ? end : columns[col].end
    assignments.push(col)
  }

  const total = Math.max(columns.length, 1)
  return sorted.map((ev, i) => {
    let start: Date, end: Date
    try {
      start = icalToDate(ev.dtstart)
      end = icalToDate(ev.dtend)
    } catch {
      return { event: ev, top: 0, height: 30, left: '0%', width: '100%' }
    }
    const startMin = start.getHours() * 60 + start.getMinutes()
    const durationMin = Math.max((end.getTime() - start.getTime()) / 60_000, 30)
    const col = assignments[i]
    return {
      event: ev,
      top: startMin,
      height: durationMin,
      left: `${(col / total) * 100}%`,
      width: `${(1 / total) * 100}%`,
    }
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function WeekGrid({
  viewDate,
  events,
  calendars,
  selectedEventId,
  onEventClick,
  onSlotClick,
  onEventMove,
  onEventResize,
}: WeekGridProps) {
  const weekStart = useMemo(() => startOfWeek(viewDate), [viewDate])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const dragRef = useRef<DragState | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Split events into all-day and timed, per day
  const { timedByDay, allDayEvents } = useMemo(() => {
    const timed: Event[][] = days.map(() => [])
    const allDay: Event[] = []
    for (const ev of events) {
      try {
        if (isAllDay(ev.dtstart)) {
          allDay.push(ev)
        } else {
          const start = icalToDate(ev.dtstart)
          const dayIdx = days.findIndex((d) => isSameDay(d, start))
          if (dayIdx >= 0) timed[dayIdx].push(ev)
        }
      } catch {
        // skip unparseable
      }
    }
    return { timedByDay: timed, allDayEvents: allDay }
  }, [days, events])

  const layoutByDay = useMemo(
    () => timedByDay.map(layoutEvents),
    [timedByDay],
  )

  // ---------------------------------------------------------------------------
  // Drag handlers
  // ---------------------------------------------------------------------------
  const handleEventMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, ev: Event, node: HTMLDivElement) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      const columnWidth = (gridRef.current?.getBoundingClientRect().width ?? 0) / 7
      dragRef.current = {
        type: 'move',
        event: ev,
        originY: e.pageY,
        originX: e.pageX,
        originalStart: icalToDate(ev.dtstart),
        originalEnd: icalToDate(ev.dtend),
        node,
        columnWidth,
      }
    },
    [],
  )

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, ev: Event, node: HTMLDivElement) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      const columnWidth = (gridRef.current?.getBoundingClientRect().width ?? 0) / 7
      dragRef.current = {
        type: 'resize',
        event: ev,
        originY: e.pageY,
        originX: e.pageX,
        originalStart: icalToDate(ev.dtstart),
        originalEnd: icalToDate(ev.dtend),
        node,
        columnWidth,
      }
    },
    [],
  )

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const drag = dragRef.current
      if (!drag) return

      const deltaY = e.pageY - drag.originY
      const deltaX = e.pageX - drag.originX
      const deltaMinutes = Math.round(deltaY / (HOUR_HEIGHT / 60) / SNAP_MINUTES) * SNAP_MINUTES
      const deltaDays = Math.round(deltaX / drag.columnWidth)

      if (drag.type === 'move') {
        const totalDeltaMinutes = deltaMinutes + deltaDays * 1440
        drag.node.style.transform = `translate(${deltaDays * drag.columnWidth}px, ${deltaMinutes}px)`
        void totalDeltaMinutes // used on mouseup
      } else {
        // resize: only vertical
        drag.node.style.transform = `translateY(${deltaMinutes}px)`
      }
    }

    function onMouseUp(e: MouseEvent) {
      const drag = dragRef.current
      if (!drag) return

      const deltaY = e.pageY - drag.originY
      const deltaX = e.pageX - drag.originX
      const deltaMinutes = Math.round(deltaY / (HOUR_HEIGHT / 60) / SNAP_MINUTES) * SNAP_MINUTES
      const deltaDays = Math.round(deltaX / drag.columnWidth)

      drag.node.style.transform = ''
      dragRef.current = null

      if (drag.type === 'move') {
        const totalDelta = deltaMinutes + deltaDays * 1440
        if (totalDelta === 0) return
        const newStart = clampToGrid(addMinutes(drag.originalStart, totalDelta), SNAP_MINUTES)
        const duration = drag.originalEnd.getTime() - drag.originalStart.getTime()
        const newEnd = new Date(newStart.getTime() + duration)
        onEventMove(drag.event, newStart, newEnd)
      } else {
        if (deltaMinutes === 0) return
        const newEnd = clampToGrid(addMinutes(drag.originalEnd, deltaMinutes), SNAP_MINUTES)
        const minEnd = addMinutes(drag.originalStart, 30)
        onEventResize(drag.event, newEnd > minEnd ? newEnd : minEnd)
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      if (dragRef.current) {
        dragRef.current.node.style.transform = ''
        dragRef.current = null
      }
    }
  }, [onEventMove, onEventResize])

  // Scroll to 8 AM on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * HOUR_HEIGHT
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Click on empty time slot
  // ---------------------------------------------------------------------------
  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, day: Date) {
    if (dragRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    const totalMinutes = Math.round(offsetY / (HOUR_HEIGHT / 60) / SNAP_MINUTES) * SNAP_MINUTES
    const slotDate = new Date(day)
    slotDate.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0)
    onSlotClick(slotDate)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Day headers */}
      <div className="flex shrink-0 border-b border-border">
        <div style={{ width: TIME_GUTTER_W }} className="shrink-0" />
        {days.map((day, i) => (
          <div
            key={i}
            className={`flex-1 border-l border-border py-2 text-center text-sm ${
              isToday(day) ? 'font-bold text-primary' : 'text-muted-foreground'
            }`}
          >
            {formatDayHeader(day)}
          </div>
        ))}
      </div>

      {/* All-day row */}
      {allDayEvents.length > 0 && (
        <div className="flex shrink-0 border-b border-border">
          <div
            style={{ width: TIME_GUTTER_W }}
            className="shrink-0 py-1 pr-2 text-right text-[10px] text-muted-foreground"
          >
            all day
          </div>
          {days.map((day, i) => {
            const dayAllDay = allDayEvents.filter((ev) => {
              try {
                const start = icalToDate(ev.dtstart)
                const end = icalToDate(ev.dtend)
                return day >= start && day < end
              } catch {
                return false
              }
            })
            return (
              <div key={i} className="flex-1 min-h-[24px] border-l border-border p-0.5">
                {dayAllDay.map((ev) => (
                  <EventBlock
                    key={ev.uid}
                    event={ev}
                    calendarColor={calendars.get(ev.calendarId)?.color ?? '#3b82f6'}
                    mode="month"
                    isSelected={ev.uid === selectedEventId}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventClick(ev)
                    }}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex" style={{ height: 24 * HOUR_HEIGHT }}>
          {/* Time gutter */}
          <div style={{ width: TIME_GUTTER_W }} className="relative shrink-0">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-2 text-[10px] text-muted-foreground"
                style={{ top: h * HOUR_HEIGHT - 7 }}
              >
                {h > 0 && formatHour(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div ref={gridRef} className="flex flex-1">
            {days.map((day, dayIdx) => (
              <div
                key={dayIdx}
                className="relative flex-1 border-l border-border"
                style={{ height: 24 * HOUR_HEIGHT }}
                onClick={(e) => handleColumnClick(e, day)}
              >
                {/* Hour lines */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-border/40"
                    style={{ top: h * HOUR_HEIGHT } as CSSProperties}
                  />
                ))}

                {/* Today highlight */}
                {isToday(day) && (
                  <div className="absolute inset-0 bg-primary/3 pointer-events-none" />
                )}

                {/* Events */}
                {layoutByDay[dayIdx].map(({ event: ev, top, height, left, width }) => {
                  let nodeRef: HTMLDivElement | null = null
                  return (
                    <EventBlock
                      key={ev.uid}
                      event={ev}
                      calendarColor={calendars.get(ev.calendarId)?.color ?? '#3b82f6'}
                      mode="week"
                      isSelected={ev.uid === selectedEventId}
                      style={{
                        top,
                        height,
                        left,
                        width,
                        paddingRight: 2,
                        zIndex: ev.uid === selectedEventId ? 10 : 1,
                      }}
                      onMouseDown={(e) => {
                        if (nodeRef) handleEventMouseDown(e, ev, nodeRef)
                      }}
                      onResizeMouseDown={(e) => {
                        if (nodeRef) handleResizeMouseDown(e, ev, nodeRef)
                      }}
                      resizeHandleRef={(el) => { nodeRef = el?.parentElement as HTMLDivElement | null }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick(ev)
                      }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
