import { create } from 'zustand'
import type {
  CalendarInfo,
  Event,
  Task,
  Note,
  Project,
  Entity,
} from '@/types/entities'
import { buildGraph, type RelationshipGraph } from '@/lib/graph'

interface GraphState {
  calendars: Map<string, CalendarInfo>
  events: Map<string, Event>
  tasks: Map<string, Task>
  notes: Map<string, Note>
  projects: Map<string, Project>
  graph: RelationshipGraph
}

interface GraphActions {
  mergeEntities(entities: {
    calendars?: CalendarInfo[]
    events?: Event[]
    tasks?: Task[]
    notes?: Note[]
    projects?: Project[]
  }): void
  removeEntity(type: 'event' | 'task' | 'note' | 'project', uid: string): void
  updateEntity(type: 'event', entity: Event): void
  updateEntity(type: 'task', entity: Task): void
  updateEntity(type: 'note', entity: Note): void
  updateEntity(type: 'project', entity: Project): void
  childrenOf(projectId: string): Entity[]
  parentOf(entityId: string): Project | undefined
  unassigned(): Entity[]
}

const emptyGraph: RelationshipGraph = {
  childrenMap: new Map(),
  parentMap: new Map(),
  unassigned: new Set(),
}

function rebuildGraph(state: GraphState): RelationshipGraph {
  return buildGraph(
    Array.from(state.events.values()),
    Array.from(state.tasks.values()),
    Array.from(state.notes.values()),
  )
}

function findEntityByUid(state: GraphState, uid: string): Entity | undefined {
  return state.events.get(uid) ?? state.tasks.get(uid) ?? state.notes.get(uid) ?? state.projects.get(uid)
}

export const useGraphStore = create<GraphState & GraphActions>()((set, get) => ({
  calendars: new Map(),
  events: new Map(),
  tasks: new Map(),
  notes: new Map(),
  projects: new Map(),
  graph: emptyGraph,

  mergeEntities({ calendars, events, tasks, notes, projects }) {
    set((state) => {
      const newCalendars = new Map(state.calendars)
      const newEvents = new Map(state.events)
      const newTasks = new Map(state.tasks)
      const newNotes = new Map(state.notes)
      const newProjects = new Map(state.projects)

      calendars?.forEach((c) => newCalendars.set(c.id, c))
      events?.forEach((e) => newEvents.set(e.uid, e))
      tasks?.forEach((t) => newTasks.set(t.uid, t))
      notes?.forEach((n) => newNotes.set(n.uid, n))
      projects?.forEach((p) => newProjects.set(p.uid, p))

      const next: GraphState = {
        calendars: newCalendars,
        events: newEvents,
        tasks: newTasks,
        notes: newNotes,
        projects: newProjects,
        graph: emptyGraph,
      }
      next.graph = rebuildGraph(next)
      return next
    })
  },

  removeEntity(type, uid) {
    set((state) => {
      const next = { ...state }
      switch (type) {
        case 'event': {
          const m = new Map(state.events); m.delete(uid); next.events = m; break
        }
        case 'task': {
          const m = new Map(state.tasks); m.delete(uid); next.tasks = m; break
        }
        case 'note': {
          const m = new Map(state.notes); m.delete(uid); next.notes = m; break
        }
        case 'project': {
          const m = new Map(state.projects); m.delete(uid); next.projects = m; break
        }
      }
      next.graph = rebuildGraph(next)
      return next
    })
  },

  updateEntity(type: string, entity: Entity) {
    set((state) => {
      const next = { ...state }
      switch (type) {
        case 'event': {
          const m = new Map(state.events); m.set((entity as Event).uid, entity as Event); next.events = m; break
        }
        case 'task': {
          const m = new Map(state.tasks); m.set((entity as Task).uid, entity as Task); next.tasks = m; break
        }
        case 'note': {
          const m = new Map(state.notes); m.set((entity as Note).uid, entity as Note); next.notes = m; break
        }
        case 'project': {
          const m = new Map(state.projects); m.set((entity as Project).uid, entity as Project); next.projects = m; break
        }
      }
      next.graph = rebuildGraph(next)
      return next
    })
  },

  childrenOf(projectId: string): Entity[] {
    const state = get()
    const childUids = state.graph.childrenMap.get(projectId)
    if (!childUids) return []
    const result: Entity[] = []
    for (const uid of childUids) {
      const entity = findEntityByUid(state, uid)
      if (entity) result.push(entity)
    }
    return result
  },

  parentOf(entityId: string): Project | undefined {
    const state = get()
    const projectId = state.graph.parentMap.get(entityId)
    if (!projectId) return undefined
    return state.projects.get(projectId)
  },

  unassigned(): Entity[] {
    const state = get()
    const result: Entity[] = []
    for (const uid of state.graph.unassigned) {
      const entity = findEntityByUid(state, uid)
      if (entity) result.push(entity)
    }
    return result
  },
}))
