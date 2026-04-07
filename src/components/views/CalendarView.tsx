import { useState, useMemo, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useGraphStore } from '@/store/useGraphStore'
import { useFilterStore } from '@/store/useFilterStore'
import { useUIStore } from '@/store/useUIStore'
import { useCalDAV } from '@/hooks/useCalDAV'
import { serializeEvent } from '@/lib/caldav/serializer'
import {
  addDays,
  addMonths,
  startOfWeek,
  formatMonthYear,
  formatWeekRange,
  formatICalDate,
} from '@/lib/caldav/dateUtils'
import { Button } from '@/components/ui/button'
import { MonthGrid } from '@/components/calendar/MonthGrid'
import { WeekGrid } from '@/components/calendar/WeekGrid'
import { QuickAddModal } from '@/components/calendar/QuickAddModal'
import type { Event } from '@/types/entities'

type CalendarMode = 'month' | 'week'

interface QuickAddSlot {
  date: Date
  isAllDay: boolean
}

export function CalendarView() {
  const [mode, setMode] = useState<CalendarMode>('month')
  const [viewDate, setViewDate] = useState<Date>(() => new Date())
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddSlot, setQuickAddSlot] = useState<QuickAddSlot | null>(null)

  const events = useGraphStore((s) => s.events)
  const calendars = useGraphStore((s) => s.calendars)
  const projects = useGraphStore((s) => s.projects)
  const updateEntity = useGraphStore((s) => s.updateEntity)
  const enabledCalendars = useFilterStore((s) => s.enabledCalendars)
  const selectedEntityId = useUIStore((s) => s.selectedEntityId)
  const selectEntity = useUIStore((s) => s.selectEntity)

  const { putEvent } = useCalDAV()

  // Filtered events for visible calendars
  const visibleEvents = useMemo(
    () => Array.from(events.values()).filter((e) => enabledCalendars.has(e.calendarId)),
    [events, enabledCalendars],
  )

  // Navigation
  const goNext = useCallback(() => {
    setViewDate((d) => (mode === 'month' ? addMonths(d, 1) : addDays(d, 7)))
  }, [mode])

  const goPrev = useCallback(() => {
    setViewDate((d) => (mode === 'month' ? addMonths(d, -1) : addDays(d, -7)))
  }, [mode])

  // Title
  const title = useMemo(() => {
    if (mode === 'month') return formatMonthYear(viewDate)
    return formatWeekRange(startOfWeek(viewDate))
  }, [mode, viewDate])

  // 'C' key → open quick add
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key !== 'c' && e.key !== 'C') return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement)?.isContentEditable) return
      openQuickAdd({ date: new Date(), isAllDay: false })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // N key → open quick add (from global shortcut)
  useEffect(() => {
    const handler = () => openQuickAdd({ date: new Date(), isAllDay: false })
    window.addEventListener('notocal:quick-add', handler)
    return () => window.removeEventListener('notocal:quick-add', handler)
  }, [])

  function openQuickAdd(slot: QuickAddSlot) {
    setQuickAddSlot(slot)
    setQuickAddOpen(true)
  }

  // Quick-add submit
  const handleQuickAddSubmit = useCallback(async (event: Event) => {
    const result = await putEvent(event)
    if (result.ok) {
      const rawIcs = serializeEvent({ ...event, etag: result.etag })
      updateEntity('event', { ...event, etag: result.etag, rawIcs })
    }
  }, [putEvent, updateEntity])

  // Event move (drag-to-move in week view)
  const handleEventMove = useCallback(async (event: Event, newStart: Date, newEnd: Date) => {
    const updated: Event = {
      ...event,
      dtstart: formatICalDate(newStart),
      dtend: formatICalDate(newEnd),
    }
    const result = await putEvent(updated, event.etag)
    if (result.ok) {
      updateEntity('event', { ...updated, etag: result.etag, rawIcs: serializeEvent(updated) })
    }
  }, [putEvent, updateEntity])

  // Event resize (drag-to-resize in week view)
  const handleEventResize = useCallback(async (event: Event, newEnd: Date) => {
    const updated: Event = {
      ...event,
      dtend: formatICalDate(newEnd),
    }
    const result = await putEvent(updated, event.etag)
    if (result.ok) {
      updateEntity('event', { ...updated, etag: result.etag, rawIcs: serializeEvent(updated) })
    }
  }, [putEvent, updateEntity])

  // Event duplicate: clone with new UID, shift by event duration
  const handleEventDuplicate = useCallback(async (event: Event) => {
    const duration =
      new Date(event.dtend).getTime() - new Date(event.dtstart).getTime()
    const newStart = new Date(new Date(event.dtstart).getTime() + 7 * 24 * 60 * 60_000)
    const newEnd = new Date(newStart.getTime() + duration)
    const cloned: Event = {
      ...event,
      uid: crypto.randomUUID(),
      dtstamp: formatICalDate(new Date()),
      dtstart: formatICalDate(newStart),
      dtend: formatICalDate(newEnd),
      etag: '',
      rawIcs: '',
    }
    const result = await putEvent(cloned)
    if (result.ok) {
      updateEntity('event', { ...cloned, etag: result.etag, rawIcs: serializeEvent(cloned) })
    }
  }, [putEvent, updateEntity])
  void handleEventDuplicate // available for wiring in detail pane later

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
        <Button variant="ghost" size="icon" onClick={goPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={goNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="min-w-40 text-sm font-medium">{title}</span>
        <Button variant="outline" size="sm" onClick={() => setViewDate(new Date())}>
          Today
        </Button>
        <div className="ml-auto flex items-center rounded-md border border-border">
          <button
            onClick={() => setMode('month')}
            className={`rounded-l-md px-3 py-1 text-xs transition-colors ${
              mode === 'month' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setMode('week')}
            className={`rounded-r-md px-3 py-1 text-xs transition-colors ${
              mode === 'week' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Week
          </button>
        </div>
      </div>

      {/* Empty state overlay */}
      {visibleEvents.length === 0 && (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          Nothing scheduled. Press <kbd className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs font-mono">C</kbd> to add an event.
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-hidden">
        {mode === 'month' ? (
          <MonthGrid
            viewDate={viewDate}
            events={visibleEvents}
            calendars={calendars}
            selectedEventId={selectedEntityId}
            onEventClick={(ev) => selectEntity(ev.uid)}
            onSlotClick={(date) => openQuickAdd({ date, isAllDay: false })}
          />
        ) : (
          <WeekGrid
            viewDate={viewDate}
            events={visibleEvents}
            calendars={calendars}
            selectedEventId={selectedEntityId}
            onEventClick={(ev) => selectEntity(ev.uid)}
            onSlotClick={(date) => openQuickAdd({ date, isAllDay: false })}
            onEventMove={handleEventMove}
            onEventResize={handleEventResize}
          />
        )}
      </div>

      <QuickAddModal
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        initialSlot={quickAddSlot}
        calendars={calendars}
        projects={projects}
        onSubmit={handleQuickAddSubmit}
      />
    </div>
  )
}
