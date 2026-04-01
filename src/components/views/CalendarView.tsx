import { useGraphStore } from '@/store/useGraphStore'
import { useFilterStore } from '@/store/useFilterStore'

export function CalendarView() {
  const events = useGraphStore((s) => s.events)
  const enabledCalendars = useFilterStore((s) => s.enabledCalendars)

  const filtered = Array.from(events.values()).filter((e) =>
    enabledCalendars.has(e.calendarId),
  )

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Calendar</h1>
      {filtered.length === 0 ? (
        <p className="text-muted-foreground">No events to display.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((e) => (
            <li key={e.uid} className="rounded-lg border border-border p-3">
              <span className="font-medium">{e.summary}</span>
              <span className="ml-2 text-sm text-muted-foreground">{e.dtstart}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
