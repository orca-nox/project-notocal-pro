import { openDB, type IDBPDatabase } from 'idb'
import type { CalendarInfo, Event, Task, Note, Project } from '@/types/entities'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const DB_NAME = 'notocal-pro'
const DB_VERSION = 1

interface NotocalDB {
  calendars: { key: string; value: CalendarInfo }
  events: { key: string; value: Event }
  tasks: { key: string; value: Task }
  notes: { key: string; value: Note }
  projects: { key: string; value: Project }
  sync_tokens: { key: string; value: { calendarId: string; syncToken: string } }
}

type StoreName = keyof NotocalDB

let dbPromise: Promise<IDBPDatabase<NotocalDB>> | null = null

function getDb(): Promise<IDBPDatabase<NotocalDB>> {
  if (!dbPromise) {
    dbPromise = openDB<NotocalDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const stores: StoreName[] = [
          'calendars',
          'events',
          'tasks',
          'notes',
          'projects',
          'sync_tokens',
        ]
        for (const name of stores) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name)
          }
        }
      },
    })
  }
  return dbPromise
}

// ---------------------------------------------------------------------------
// Generic read/write helpers
// ---------------------------------------------------------------------------

async function putAll(
  store: StoreName,
  items: unknown[],
  keyFn: (item: unknown) => string,
): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(store, 'readwrite')
  for (const item of items) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await tx.store.put(item as any, keyFn(item))
  }
  await tx.done
}

async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await getDb()
  return (await db.getAll(store)) as T[]
}

async function deleteByKey(store: StoreName, key: string): Promise<void> {
  const db = await getDb()
  await db.delete(store, key)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Calendars
export async function cacheCalendars(calendars: CalendarInfo[]): Promise<void> {
  await putAll('calendars', calendars, (c) => (c as CalendarInfo).id)
}
export async function getCachedCalendars(): Promise<CalendarInfo[]> {
  return getAll('calendars')
}

// Events
export async function cacheEvents(events: Event[]): Promise<void> {
  await putAll('events', events, (e) => (e as Event).uid)
}
export async function getCachedEvents(): Promise<Event[]> {
  return getAll('events')
}
export async function removeCachedEvent(uid: string): Promise<void> {
  await deleteByKey('events', uid)
}

// Tasks
export async function cacheTasks(tasks: Task[]): Promise<void> {
  await putAll('tasks', tasks, (t) => (t as Task).uid)
}
export async function getCachedTasks(): Promise<Task[]> {
  return getAll('tasks')
}
export async function removeCachedTask(uid: string): Promise<void> {
  await deleteByKey('tasks', uid)
}

// Notes
export async function cacheNotes(notes: Note[]): Promise<void> {
  await putAll('notes', notes, (n) => (n as Note).uid)
}
export async function getCachedNotes(): Promise<Note[]> {
  return getAll('notes')
}
export async function removeCachedNote(uid: string): Promise<void> {
  await deleteByKey('notes', uid)
}

// Projects
export async function cacheProjects(projects: Project[]): Promise<void> {
  await putAll('projects', projects, (p) => (p as Project).uid)
}
export async function getCachedProjects(): Promise<Project[]> {
  return getAll('projects')
}
export async function removeCachedProject(uid: string): Promise<void> {
  await deleteByKey('projects', uid)
}

// Sync tokens
export async function saveSyncToken(calendarId: string, syncToken: string): Promise<void> {
  const db = await getDb()
  await db.put('sync_tokens', { calendarId, syncToken }, calendarId)
}
export async function getSyncToken(calendarId: string): Promise<string | undefined> {
  const db = await getDb()
  const record = await db.get('sync_tokens', calendarId)
  return record?.syncToken
}

// Clear everything
export async function clearCache(): Promise<void> {
  const db = await getDb()
  const stores: StoreName[] = ['calendars', 'events', 'tasks', 'notes', 'projects', 'sync_tokens']
  for (const store of stores) {
    const tx = db.transaction(store, 'readwrite')
    await tx.store.clear()
    await tx.done
  }
}
