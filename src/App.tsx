import { useState, useEffect, useCallback } from 'react'
import { useBootstrap } from '@/hooks/useBootstrap'
import { useCalDAV } from '@/hooks/useCalDAV'
import type { CalendarInfo, Event, Task, Note, Project } from '@/types/entities'

function App() {
  const { ready, error: bootstrapError } = useBootstrap()
  const {
    fetchAll,
    loadFromCache,
    putEvent,
    deleteEvent,
  } = useCalDAV()

  const [calendars, setCalendars] = useState<CalendarInfo[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [log, setLog] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  // Load from cache on mount
  useEffect(() => {
    loadFromCache().then((cached) => {
      if (cached.calendars.length > 0) {
        setCalendars(cached.calendars)
        setEvents(cached.events)
        setTasks(cached.tasks)
        setNotes(cached.notes)
        setProjects(cached.projects)
        addLog(`Loaded from cache: ${cached.calendars.length} calendars, ${cached.events.length} events, ${cached.tasks.length} tasks, ${cached.notes.length} notes, ${cached.projects.length} projects`)
      } else {
        addLog('No cached data found')
      }
    })
  }, [loadFromCache, addLog])

  const handleFetchAll = async () => {
    setLoading(true)
    addLog('Fetching all data from Radicale...')
    try {
      const result = await fetchAll()
      setCalendars(result.calendars)
      setEvents(result.events)
      setTasks(result.tasks)
      setNotes(result.notes)
      setProjects(result.projects)
      addLog(`Fetched: ${result.calendars.length} calendars, ${result.events.length} events, ${result.tasks.length} tasks, ${result.notes.length} notes, ${result.projects.length} projects`)
    } catch (err) {
      addLog(`Fetch error: ${err}`)
    }
    setLoading(false)
  }

  const handleCreateTestEvent = async () => {
    if (calendars.length === 0) {
      addLog('No calendars available. Fetch calendars first.')
      return
    }
    const calendarId = calendars[0].id
    const uid = `test-${Date.now()}`
    const now = new Date()
    const later = new Date(now.getTime() + 3600000)
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

    const event: Event = {
      uid,
      calendarId,
      dtstamp: fmt(now),
      dtstart: fmt(now),
      dtend: fmt(later),
      summary: `Smoke Test Event ${uid.slice(-6)}`,
      description: 'Created by Notocal Pro smoke test',
      etag: '',
      rawIcs: '',
    }

    addLog(`Creating test event "${event.summary}" in ${calendars[0].displayName}...`)
    const result = await putEvent(event)
    if (result.ok) {
      addLog(`Created! ETag: ${result.etag}`)
      await handleFetchAll()
    } else {
      addLog(`Create failed: ${result.message}`)
    }
  }

  const handleDeleteEvent = async (event: Event) => {
    addLog(`Deleting event "${event.summary}"...`)
    try {
      await deleteEvent(event)
      addLog('Deleted successfully')
      await handleFetchAll()
    } catch (err) {
      addLog(`Delete error: ${err}`)
    }
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-3xl font-bold">Notocal Pro — Smoke Test</h1>

        {/* Bootstrap status */}
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">Bootstrap Status</h2>
          {bootstrapError ? (
            <p className="text-destructive">Error: {bootstrapError}</p>
          ) : ready ? (
            <p className="text-green-500">system-projects collection ready</p>
          ) : (
            <p className="text-muted-foreground">Bootstrapping...</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleFetchAll}
            disabled={loading || !ready}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Fetching...' : 'Fetch All from Radicale'}
          </button>
          <button
            onClick={handleCreateTestEvent}
            disabled={loading || !ready || calendars.length === 0}
            className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
          >
            Create Test Event
          </button>
        </div>

        {/* Calendars */}
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">Calendars ({calendars.length})</h2>
          {calendars.length === 0 ? (
            <p className="text-muted-foreground">No calendars loaded</p>
          ) : (
            <ul className="space-y-1">
              {calendars.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <span>{c.displayName}</span>
                  <span className="text-muted-foreground text-sm">({c.url})</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Events */}
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">Events ({events.length})</h2>
          {events.length === 0 ? (
            <p className="text-muted-foreground">No events</p>
          ) : (
            <ul className="space-y-1">
              {events.map((e) => (
                <li key={e.uid} className="flex items-center gap-2">
                  <span className="font-medium">{e.summary}</span>
                  <span className="text-muted-foreground text-sm">{e.dtstart}</span>
                  {e.summary.startsWith('Smoke Test') && (
                    <button
                      onClick={() => handleDeleteEvent(e)}
                      className="ml-auto text-sm text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tasks */}
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">Tasks ({tasks.length})</h2>
          {tasks.length === 0 ? (
            <p className="text-muted-foreground">No tasks</p>
          ) : (
            <ul className="space-y-1">
              {tasks.map((t) => (
                <li key={t.uid} className="flex items-center gap-2">
                  <span className={t.status === 'COMPLETED' ? 'line-through' : ''}>{t.summary}</span>
                  <span className="text-muted-foreground text-sm">[{t.status}]</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Notes */}
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">Notes ({notes.length})</h2>
          {notes.length === 0 ? (
            <p className="text-muted-foreground">No notes</p>
          ) : (
            <ul className="space-y-1">
              {notes.map((n) => (
                <li key={n.uid}>{n.summary}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Projects */}
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">Projects ({projects.length})</h2>
          {projects.length === 0 ? (
            <p className="text-muted-foreground">No projects</p>
          ) : (
            <ul className="space-y-1">
              {projects.map((p) => (
                <li key={p.uid} className="flex items-center gap-2">
                  <span className="font-medium">{p.summary}</span>
                  <span className="text-muted-foreground text-sm">[{p.status}] Priority: {p.priority}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Log */}
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">Log</h2>
          <div className="max-h-60 overflow-y-auto font-mono text-sm space-y-0.5">
            {log.length === 0 ? (
              <p className="text-muted-foreground">No log entries</p>
            ) : (
              log.map((entry, i) => (
                <div key={i} className="text-muted-foreground">{entry}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
