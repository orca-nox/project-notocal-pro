import { useGraphStore } from '@/store/useGraphStore'
import { useFilterStore } from '@/store/useFilterStore'

export function TasksView() {
  const tasks = useGraphStore((s) => s.tasks)
  const enabledCalendars = useFilterStore((s) => s.enabledCalendars)

  const filtered = Array.from(tasks.values()).filter((t) =>
    enabledCalendars.has(t.calendarId),
  )

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Tasks</h1>
      {filtered.length === 0 ? (
        <p className="text-muted-foreground">No tasks to display.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => (
            <li key={t.uid} className="rounded-lg border border-border p-3 flex items-center gap-2">
              <span className={t.status === 'COMPLETED' ? 'line-through text-muted-foreground' : 'font-medium'}>
                {t.summary}
              </span>
              <span className="text-xs text-muted-foreground">[{t.status}]</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
