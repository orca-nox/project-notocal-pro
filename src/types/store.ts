// ---------------------------------------------------------------------------
// Zustand store state & action interfaces
// ---------------------------------------------------------------------------

import type {
  CalendarInfo,
  Event,
  Task,
  Note,
  Project,
  Entity,
} from './entities'

// ---------------------------------------------------------------------------
// Graph Store
// ---------------------------------------------------------------------------

export interface GraphState {
  calendars: Map<string, CalendarInfo>
  events: Map<string, Event>
  tasks: Map<string, Task>
  notes: Map<string, Note>
  projects: Map<string, Project>
}

export interface GraphActions {
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

export type GraphStore = GraphState & GraphActions

// ---------------------------------------------------------------------------
// UI Store
// ---------------------------------------------------------------------------

export type ActiveView = 'projects' | 'calendar' | 'tasks' | 'notes'

export interface UIState {
  activeView: ActiveView
  selectedEntityId: string | null
  navPinned: boolean
  notesEditorMode: 'split' | 'full'
}

export interface UIActions {
  setView(view: ActiveView): void
  selectEntity(id: string | null): void
  toggleNavPin(): void
  setNotesEditorMode(mode: 'split' | 'full'): void
}

export type UIStore = UIState & UIActions

// ---------------------------------------------------------------------------
// Filter Store
// ---------------------------------------------------------------------------

export type TaskSortField = 'dueDate' | 'priority' | 'project' | 'created'

export interface TaskFilters {
  status: 'all' | 'needs-action' | 'in-process' | 'completed' | 'cancelled'
  dueDate: 'all' | 'overdue' | 'today' | 'week' | 'month' | 'none'
  projectId: string | null
  priority: 'all' | 'high' | 'medium' | 'low' | 'none'
  sort: TaskSortField
}

export interface FilterState {
  enabledCalendars: Set<string>
  taskFilters: TaskFilters
}

export interface FilterActions {
  toggleCalendar(calendarId: string): void
  setTaskFilter<K extends keyof TaskFilters>(key: K, value: TaskFilters[K]): void
  resetFilters(): void
}

export type FilterStore = FilterState & FilterActions

// ---------------------------------------------------------------------------
// Draft Store
// ---------------------------------------------------------------------------

export interface DraftData {
  entityUid: string
  data: Record<string, unknown>
  savedAt: number
}

export interface DraftState {
  drafts: Map<string, DraftData>
}

export interface DraftActions {
  saveDraft(uid: string, data: Record<string, unknown>): void
  getDraft(uid: string): DraftData | undefined
  clearDraft(uid: string): void
}

export type DraftStore = DraftState & DraftActions
