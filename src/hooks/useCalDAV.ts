import { useCallback, useRef } from 'react'
import { getClient } from '@/lib/caldav/client'
import { getCalDAVConfig } from '@/lib/caldav/config'
import { parseEvent, parseTask, parseNote, parseProject } from '@/lib/caldav/parser'
import { serializeEvent, serializeTask, serializeNote, serializeProject } from '@/lib/caldav/serializer'
import {
  replaceAllCached,
  cacheEvents,
  cacheTasks,
  cacheNotes,
  cacheProjects,
  getCachedCalendars,
  getCachedEvents,
  getCachedTasks,
  getCachedNotes,
  getCachedProjects,
  removeCachedEvent,
  removeCachedTask,
  removeCachedNote,
  removeCachedProject,
} from '@/lib/cache'
import type { CalendarInfo, Event, Task, Note, Project } from '@/types/entities'
import type { WriteResult } from '@/types/caldav'

const SYSTEM_PROJECTS_PATH = 'system-projects'

export interface FetchResult {
  calendars: CalendarInfo[]
  events: Event[]
  tasks: Task[]
  notes: Note[]
  projects: Project[]
}

export function useCalDAV() {
  const configRef = useRef(getCalDAVConfig())

  /** Get a logged-in DAVClient */
  const client = useCallback(async () => {
    return getClient(configRef.current)
  }, [])

  /** Fetch all calendars from Radicale */
  const fetchCalendars = useCallback(async (): Promise<CalendarInfo[]> => {
    const dav = await client()
    const rawCalendars = await dav.fetchCalendars()

    return rawCalendars
      .filter((c) => {
        // Extract the last path segment to check the collection name
        const pathSegments = (c.url || '').replace(/\/+$/, '').split('/')
        const collectionName = pathSegments[pathSegments.length - 1]
        return collectionName !== SYSTEM_PROJECTS_PATH
      })
      .map((c, i) => ({
        id: c.url || '',
        displayName: (typeof c.displayName === 'string' ? c.displayName : '') || 'Unnamed',
        color: (c as Record<string, unknown>).calendarColor as string || '#3b82f6',
        order: i,
        url: c.url || '',
        syncToken: c.syncToken || undefined,
      }))
  }, [client])

  /** Find the system-projects collection URL */
  const getProjectsCollectionUrl = useCallback(async (): Promise<string | null> => {
    const dav = await client()
    const rawCalendars = await dav.fetchCalendars()
    const projCal = rawCalendars.find((c) => {
      const pathSegments = (c.url || '').replace(/\/+$/, '').split('/')
      return pathSegments[pathSegments.length - 1] === SYSTEM_PROJECTS_PATH
    })
    return projCal?.url || null
  }, [client])

  /** Fetch all entities from all calendars + the projects collection */
  const fetchAll = useCallback(async (): Promise<FetchResult> => {
    const dav = await client()
    const calendars = await fetchCalendars()
    const projectsUrl = await getProjectsCollectionUrl()

    const events: Event[] = []
    const tasks: Task[] = []
    const notes: Note[] = []
    const projects: Project[] = []

    // Custom filter: fetch ALL component types (VEVENT, VTODO, VJOURNAL).
    // tsdav defaults to VEVENT-only if no filters are provided.
    const allComponentsFilter = [
      {
        'comp-filter': {
          _attributes: { name: 'VCALENDAR' },
        },
      },
    ]

    // Fetch from each user calendar
    for (const cal of calendars) {
      const objects = await dav.fetchCalendarObjects({
        calendar: { url: cal.url } as Parameters<typeof dav.fetchCalendarObjects>[0]['calendar'],
        filters: allComponentsFilter,
      })

      for (const obj of objects) {
        const ics = obj.data as string | undefined
        if (!ics) continue
        const etag = (obj.etag || '') as string

        const event = parseEvent(ics, cal.id, etag)
        if (event) { events.push(event); continue }

        const task = parseTask(ics, cal.id, etag)
        if (task) { tasks.push(task); continue }

        const note = parseNote(ics, cal.id, etag)
        if (note) notes.push(note)
      }
    }

    // Fetch projects
    if (projectsUrl) {
      const objects = await dav.fetchCalendarObjects({
        calendar: { url: projectsUrl } as Parameters<typeof dav.fetchCalendarObjects>[0]['calendar'],
        filters: allComponentsFilter,
      })
      for (const obj of objects) {
        const ics = obj.data as string | undefined
        if (!ics) continue
        const etag = (obj.etag || '') as string
        const project = parseProject(ics, etag)
        if (project) projects.push(project)
      }
    }

    // Replace the entire cache with what we just fetched
    await replaceAllCached({ calendars, events, tasks, notes, projects })

    return { calendars, events, tasks, notes, projects }
  }, [client, fetchCalendars, getProjectsCollectionUrl])

  /** Load from IndexedDB cache (for instant UI on cold start) */
  const loadFromCache = useCallback(async (): Promise<FetchResult> => {
    const [calendars, events, tasks, notes, projects] = await Promise.all([
      getCachedCalendars(),
      getCachedEvents(),
      getCachedTasks(),
      getCachedNotes(),
      getCachedProjects(),
    ])
    return { calendars, events, tasks, notes, projects }
  }, [])

  /**
   * Create or update a calendar object.
   * Uses createCalendarObject (If-None-Match: *) for new objects,
   * and updateCalendarObject (If-Match: etag) for existing ones.
   */
  const putCalendarObject = useCallback(async (
    dav: Awaited<ReturnType<typeof client>>,
    collectionUrl: string,
    uid: string,
    ics: string,
    ifMatch?: string,
  ): Promise<{ etag: string }> => {
    const objectUrl = `${collectionUrl.replace(/\/$/, '')}/${uid}.ics`
    if (ifMatch) {
      const result = await dav.updateCalendarObject({
        calendarObject: {
          url: objectUrl,
          data: ics,
          etag: ifMatch,
        } as Parameters<typeof dav.updateCalendarObject>[0]['calendarObject'],
      })
      const etag = (result as Response)?.headers?.get?.('etag') ?? ''
      return { etag }
    } else {
      const result = await dav.createCalendarObject({
        calendar: { url: collectionUrl } as Parameters<typeof dav.createCalendarObject>[0]['calendar'],
        filename: `${uid}.ics`,
        iCalString: ics,
      })
      const etag = (result as Response)?.headers?.get?.('etag') ?? ''
      return { etag }
    }
  }, [client])

  /** Create or update an event */
  const putEvent = useCallback(async (event: Event, ifMatch?: string): Promise<WriteResult> => {
    const dav = await client()
    const ics = serializeEvent(event)
    try {
      const { etag } = await putCalendarObject(dav, event.calendarId, event.uid, ics, ifMatch)
      const updated = { ...event, etag, rawIcs: ics }
      await cacheEvents([updated])
      return { ok: true, etag }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 412) {
        return { ok: false, status: 412, message: 'conflict' }
      }
      return { ok: false, status: 0, message: String(err) }
    }
  }, [client, putCalendarObject])

  /** Create or update a task */
  const putTask = useCallback(async (task: Task, ifMatch?: string): Promise<WriteResult> => {
    const dav = await client()
    const ics = serializeTask(task)
    try {
      const { etag } = await putCalendarObject(dav, task.calendarId, task.uid, ics, ifMatch)
      const updated = { ...task, etag, rawIcs: ics }
      await cacheTasks([updated])
      return { ok: true, etag }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 412) {
        return { ok: false, status: 412, message: 'conflict' }
      }
      return { ok: false, status: 0, message: String(err) }
    }
  }, [client, putCalendarObject])

  /** Create or update a note */
  const putNote = useCallback(async (note: Note, ifMatch?: string): Promise<WriteResult> => {
    const dav = await client()
    const ics = serializeNote(note)
    try {
      const { etag } = await putCalendarObject(dav, note.calendarId, note.uid, ics, ifMatch)
      const updated = { ...note, etag, rawIcs: ics }
      await cacheNotes([updated])
      return { ok: true, etag }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 412) {
        return { ok: false, status: 412, message: 'conflict' }
      }
      return { ok: false, status: 0, message: String(err) }
    }
  }, [client, putCalendarObject])

  /** Create or update a project */
  const putProject = useCallback(async (project: Project, ifMatch?: string): Promise<WriteResult> => {
    const dav = await client()
    const projectsUrl = await getProjectsCollectionUrl()
    if (!projectsUrl) {
      return { ok: false, status: 0, message: 'system-projects collection not found' }
    }
    const ics = serializeProject(project)
    try {
      const { etag } = await putCalendarObject(dav, projectsUrl, project.uid, ics, ifMatch)
      const updated = { ...project, etag, rawIcs: ics }
      await cacheProjects([updated])
      return { ok: true, etag }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 412) {
        return { ok: false, status: 412, message: 'conflict' }
      }
      return { ok: false, status: 0, message: String(err) }
    }
  }, [client, putCalendarObject, getProjectsCollectionUrl])

  /** Delete an event */
  const deleteEvent = useCallback(async (event: Event): Promise<void> => {
    const dav = await client()
    const objectUrl = `${event.calendarId.replace(/\/$/, '')}/${event.uid}.ics`
    await dav.deleteCalendarObject({ calendarObject: { url: objectUrl, etag: event.etag } as Parameters<typeof dav.deleteCalendarObject>[0]['calendarObject'] })
    await removeCachedEvent(event.uid)
  }, [client])

  /** Delete a task */
  const deleteTask = useCallback(async (task: Task): Promise<void> => {
    const dav = await client()
    const objectUrl = `${task.calendarId.replace(/\/$/, '')}/${task.uid}.ics`
    await dav.deleteCalendarObject({ calendarObject: { url: objectUrl, etag: task.etag } as Parameters<typeof dav.deleteCalendarObject>[0]['calendarObject'] })
    await removeCachedTask(task.uid)
  }, [client])

  /** Delete a note */
  const deleteNote = useCallback(async (note: Note): Promise<void> => {
    const dav = await client()
    const objectUrl = `${note.calendarId.replace(/\/$/, '')}/${note.uid}.ics`
    await dav.deleteCalendarObject({ calendarObject: { url: objectUrl, etag: note.etag } as Parameters<typeof dav.deleteCalendarObject>[0]['calendarObject'] })
    await removeCachedNote(note.uid)
  }, [client])

  /** Delete a project */
  const deleteProject = useCallback(async (project: Project): Promise<void> => {
    const dav = await client()
    const projectsUrl = await getProjectsCollectionUrl()
    if (!projectsUrl) return
    const objectUrl = `${projectsUrl.replace(/\/$/, '')}/${project.uid}.ics`
    await dav.deleteCalendarObject({ calendarObject: { url: objectUrl, etag: project.etag } as Parameters<typeof dav.deleteCalendarObject>[0]['calendarObject'] })
    await removeCachedProject(project.uid)
  }, [client, getProjectsCollectionUrl])

  return {
    fetchCalendars,
    fetchAll,
    loadFromCache,
    putEvent,
    putTask,
    putNote,
    putProject,
    deleteEvent,
    deleteTask,
    deleteNote,
    deleteProject,
  }
}

// Re-export parseEvent etc. for direct use in smoke test
export { parseEvent, parseTask, parseNote, parseProject }
