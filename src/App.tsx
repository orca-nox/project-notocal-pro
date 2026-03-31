import { useState, useCallback } from 'react'
import { useBootstrap } from '@/hooks/useBootstrap'
import { useCalDAV } from '@/hooks/useCalDAV'
import { useSync } from '@/hooks/useSync'
import { useGraphStore } from '@/store/useGraphStore'
import { useFilterStore } from '@/store/useFilterStore'
import { useUIStore } from '@/store/useUIStore'
import { useDraftStore } from '@/store/useDraftStore'
import type { Event } from '@/types/entities'

function App() {
  const { ready, error: bootstrapError } = useBootstrap()
  useSync()

  const { putEvent, deleteEvent, fetchAll } = useCalDAV()
  const mergeEntities = useGraphStore((s) => s.mergeEntities)

  // Read from stores
  const calendars = useGraphStore((s) => s.calendars)
  const events = useGraphStore((s) => s.events)
  const tasks = useGraphStore((s) => s.tasks)
  const notes = useGraphStore((s) => s.notes)
  const projects = useGraphStore((s) => s.projects)
  const childrenOf = useGraphStore((s) => s.childrenOf)
  const unassigned = useGraphStore((s) => s.unassigned)

  const enabledCalendars = useFilterStore((s) => s.enabledCalendars)
  const toggleCalendar = useFilterStore((s) => s.toggleCalendar)

  const activeView = useUIStore((s) => s.activeView)
  const setView = useUIStore((s) => s.setView)
  const navPinned = useUIStore((s) => s.navPinned)
  const toggleNavPin = useUIStore((s) => s.toggleNavPin)

  const saveDraft = useDraftStore((s) => s.saveDraft)
  const getDraft = useDraftStore((s) => s.getDraft)
  const clearDraft = useDraftStore((s) => s.clearDraft)

  const [log, setLog] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [draftTestUid] = useState('draft-test-001')

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  const calendarsArr = Array.from(calendars.values())
  const eventsArr = Array.from(events.values())
  const tasksArr = Array.from(tasks.values())
  const notesArr = Array.from(notes.values())
  const projectsArr = Array.from(projects.values())

  const handleRefresh = async () => {
    setLoading(true)
    addLog('Syncing with Radicale...')
    try {
      const result = await fetchAll()
      mergeEntities(result)
      addLog(`Synced: ${result.calendars.length} calendars, ${result.events.length} events, ${result.tasks.length} tasks, ${result.notes.length} notes, ${result.projects.length} projects`)
    } catch (err) {
      addLog(`Sync error: ${err}`)
    }
    setLoading(false)
  }

  const handleCreateTestEvent = async () => {
    if (calendarsArr.length === 0) {
      addLog('No calendars available.')
      return
    }
    const calendarId = calendarsArr[0].id
    const uid = `test-${Date.now()}`
    const now = new Date()
    const later = new Date(now.getTime() + 3600000)
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

    const event: Event = {
      uid, calendarId, dtstamp: fmt(now), dtstart: fmt(now), dtend: fmt(later),
      summary: `Smoke Test Event ${uid.slice(-6)}`,
      description: 'Created by Notocal Pro smoke test',
      etag: '', rawIcs: '',
    }

    addLog(`Creating "${event.summary}"...`)
    const result = await putEvent(event)
    if (result.ok) {
      addLog(`Created! ETag: ${result.etag}`)
      await handleRefresh()
    } else {
      addLog(`Create failed: ${result.message}`)
    }
  }

  const handleDeleteEvent = async (event: Event) => {
    addLog(`Deleting "${event.summary}"...`)
    try {
      await deleteEvent(event)
      addLog('Deleted')
      await handleRefresh()
    } catch (err) {
      addLog(`Delete error: ${err}`)
    }
  }

  const handleDraftTest = () => {
    saveDraft(draftTestUid, { title: 'Draft test', timestamp: Date.now() })
    addLog(`Draft saved for ${draftTestUid}. Refresh the page to verify persistence.`)
  }

  const handleDraftCheck = () => {
    const draft = getDraft(draftTestUid)
    if (draft) {
      addLog(`Draft found! Saved at ${new Date(draft.savedAt).toLocaleTimeString()}: ${JSON.stringify(draft.data)}`)
    } else {
      addLog('No draft found.')
    }
  }

  const handleDraftClear = () => {
    clearDraft(draftTestUid)
    addLog('Draft cleared.')
  }

  // Filter events by enabled calendars
  const filteredEvents = eventsArr.filter((e) => enabledCalendars.has(e.calendarId))
  const filteredTasks = tasksArr.filter((t) => enabledCalendars.has(t.calendarId))

  return (
    <div className="dark min-h-screen bg-background text-foreground p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-3xl font-bold">Notocal Pro — Phase 2 Debug</h1>

        {/* Bootstrap */}
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">Bootstrap</h2>
          {bootstrapError ? (
            <p className="text-destructive">Error: {bootstrapError}</p>
          ) : ready ? (
            <p className="text-green-500">system-projects collection ready</p>
          ) : (
            <p className="text-muted-foreground">Bootstrapping...</p>
          )}
        </div>

        {/* UI Store */}
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">UI Store</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground">View:</span>
            {(['projects', 'calendar', 'tasks', 'notes'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded px-3 py-1 text-sm ${activeView === v ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                {v}
              </button>
            ))}
            <span className="text-sm text-muted-foreground ml-4">Nav pinned:</span>
            <button onClick={toggleNavPin}
              className={`rounded px-3 py-1 text-sm ${navPinned ? 'bg-green-600 text-white' : 'bg-secondary text-secondary-foreground'}`}>
              {navPinned ? 'Yes' : 'No'}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          <button onClick={handleRefresh} disabled={loading || !ready}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {loading ? 'Syncing...' : 'Sync from Radicale'}
          </button>
          <button onClick={handleCreateTestEvent} disabled={loading || !ready || calendarsArr.length === 0}
            className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50">
            Create Test Event
          </button>
        </div>

        {/* Calendar Filters */}
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">Calendar Filters</h2>
          {calendarsArr.length === 0 ? (
            <p className="text-muted-foreground">No calendars loaded</p>
          ) : (
            <div className="space-y-1">
              {calendarsArr.map((c) => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={enabledCalendars.has(c.id)}
                    onChange={() => toggleCalendar(c.id)} className="rounded" />
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                  <span>{c.displayName}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Filtered Events */}
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">
            Events ({filteredEvents.length} shown / {eventsArr.length} total)
          </h2>
          {filteredEvents.length === 0 ? (
            <p className="text-muted-foreground">No events (or all filtered out)</p>
          ) : (
            <ul className="space-y-1">
              {filteredEvents.map((e) => (
                <li key={e.uid} className="flex items-center gap-2">
                  <span className="font-medium">{e.summary}</span>
                  <span className="text-muted-foreground text-sm">{e.dtstart}</span>
                  {e.relatedTo && (
                    <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">
                      project: {projects.get(e.relatedTo)?.summary ?? e.relatedTo}
                    </span>
                  )}
                  {e.summary.startsWith('Smoke Test') && (
                    <button onClick={() => handleDeleteEvent(e)}
                      className="ml-auto text-sm text-destructive hover:underline">Delete</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Filtered Tasks */}
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">
            Tasks ({filteredTasks.length} shown / {tasksArr.length} total)
          </h2>
          {filteredTasks.length === 0 ? (
            <p className="text-muted-foreground">No tasks</p>
          ) : (
            <ul className="space-y-1">
              {filteredTasks.map((t) => (
                <li key={t.uid} className="flex items-center gap-2">
                  <span className={t.status === 'COMPLETED' ? 'line-through' : ''}>{t.summary}</span>
                  <span className="text-muted-foreground text-sm">[{t.status}]</span>
                  {t.relatedTo && (
                    <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">
                      project: {projects.get(t.relatedTo)?.summary ?? t.relatedTo}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Notes */}
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">Notes ({notesArr.length})</h2>
          {notesArr.length === 0 ? (
            <p className="text-muted-foreground">No notes</p>
          ) : (
            <ul className="space-y-1">
              {notesArr.map((n) => (
                <li key={n.uid}>{n.summary}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Relationship Graph */}
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">Relationship Graph</h2>
          {projectsArr.length === 0 ? (
            <p className="text-muted-foreground">No projects</p>
          ) : (
            <div className="space-y-3">
              {projectsArr.map((p) => {
                const children = childrenOf(p.uid)
                return (
                  <div key={p.uid}>
                    <h3 className="font-medium">{p.summary} <span className="text-muted-foreground text-sm">[{p.status}]</span></h3>
                    {children.length === 0 ? (
                      <p className="text-muted-foreground text-sm ml-4">No linked items</p>
                    ) : (
                      <ul className="ml-4 space-y-0.5">
                        {children.map((c) => (
                          <li key={c.uid} className="text-sm">
                            {'status' in c && 'subtasks' in c ? 'task' : 'dtend' in c && 'dtstart' in c ? 'event' : 'note'}
                            {': '}{c.summary}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
              {(() => {
                const unassignedItems = unassigned()
                if (unassignedItems.length === 0) return null
                return (
                  <div>
                    <h3 className="font-medium text-muted-foreground">Unassigned ({unassignedItems.length})</h3>
                    <ul className="ml-4 space-y-0.5">
                      {unassignedItems.slice(0, 10).map((c) => (
                        <li key={c.uid} className="text-sm text-muted-foreground">{c.summary}</li>
                      ))}
                      {unassignedItems.length > 10 && (
                        <li className="text-sm text-muted-foreground">...and {unassignedItems.length - 10} more</li>
                      )}
                    </ul>
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        {/* Draft Store */}
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold mb-2">Draft Store</h2>
          <div className="flex gap-3">
            <button onClick={handleDraftTest}
              className="rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-secondary/80">
              Save Draft
            </button>
            <button onClick={handleDraftCheck}
              className="rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-secondary/80">
              Check Draft
            </button>
            <button onClick={handleDraftClear}
              className="rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-secondary/80">
              Clear Draft
            </button>
          </div>
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
