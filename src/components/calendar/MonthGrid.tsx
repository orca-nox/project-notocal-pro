import { useMemo } from 'react'
import {
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
  icalToDate,
  isAllDay,
} from '@/lib/caldav/dateUtils'
import { EventBlock } from './EventBlock'
import type { Event, CalendarInfo } from '@/types/entities'

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_VISIBLE_CHIPS = 3

interface DayCell {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  events: Event[]
}

interface MonthGridProps {
  viewDate: Date
  events: Event[]
  calendars: Map<string, CalendarInfo>
  selectedEventId: string | null
  onEventClick: (event: Event) => void
  onSlotClick: (date: Date) => void
}

export function MonthGrid({
  viewDate,
  events,
  calendars,
  selectedEventId,
  onEventClick,
  onSlotClick,
}: MonthGridProps) {
  const cells = useMemo<DayCell[][]>(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()

    // First Monday on or before the 1st of the month
    const monthStart = new Date(year, month, 1)
    const gridStart = startOfWeek(monthStart)

    const rows: DayCell[][] = []
    for (let row = 0; row < 6; row++) {
      const week: DayCell[] = []
      for (let col = 0; col < 7; col++) {
        const date = addDays(gridStart, row * 7 + col)
        const dayEvents = events
          .filter((e) => {
            try {
              return isSameDay(icalToDate(e.dtstart), date)
            } catch {
              return false
            }
          })
          .sort((a, b) => {
            // All-day events first, then by start time
            const aAllDay = isAllDay(a.dtstart) ? 0 : 1
            const bAllDay = isAllDay(b.dtstart) ? 0 : 1
            if (aAllDay !== bAllDay) return aAllDay - bAllDay
            return a.dtstart.localeCompare(b.dtstart)
          })
        week.push({
          date,
          isCurrentMonth: date.getMonth() === month,
          isToday: isToday(date),
          events: dayEvents,
        })
      }
      rows.push(week)
    }
    return rows
  }, [viewDate, events])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* 6-week grid */}
      <div className="flex-1 grid grid-rows-6 overflow-hidden">
        {cells.map((week, ri) => (
          <div key={ri} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {week.map((cell, ci) => {
              const overflow = cell.events.length - MAX_VISIBLE_CHIPS
              return (
                <div
                  key={ci}
                  onClick={() => onSlotClick(cell.date)}
                  className={`relative min-h-0 overflow-hidden border-r border-border last:border-r-0 p-1 cursor-pointer hover:bg-accent/30 transition-colors ${
                    cell.isToday ? 'bg-primary/5' : ''
                  } ${!cell.isCurrentMonth ? 'opacity-40' : ''}`}
                >
                  {/* Day number */}
                  <div
                    className={`mb-0.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium ${
                      cell.isToday
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    {cell.date.getDate()}
                  </div>

                  {/* Event chips */}
                  {cell.events.slice(0, MAX_VISIBLE_CHIPS).map((ev) => (
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

                  {overflow > 0 && (
                    <div className="px-1 text-[10px] text-muted-foreground">
                      +{overflow} more
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
