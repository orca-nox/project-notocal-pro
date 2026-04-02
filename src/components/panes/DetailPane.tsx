import { useUIStore } from '@/store/useUIStore'
import { useGraphStore } from '@/store/useGraphStore'
import { EventEditor } from '@/components/editors/EventEditor'
import { TaskEditor } from '@/components/editors/TaskEditor'
import { ProjectEditor } from '@/components/editors/ProjectEditor'
import { NoteEditor } from '@/components/editors/NoteEditor'
import type { EntityType, Entity } from '@/types/entities'

function resolveEntity(
  uid: string,
  events: Map<string, unknown>,
  tasks: Map<string, unknown>,
  notes: Map<string, unknown>,
  projects: Map<string, unknown>,
): { entity: Entity; type: EntityType } | null {
  const event = events.get(uid)
  if (event) return { entity: event as Entity, type: 'event' }
  const task = tasks.get(uid)
  if (task) return { entity: task as Entity, type: 'task' }
  const note = notes.get(uid)
  if (note) return { entity: note as Entity, type: 'note' }
  const project = projects.get(uid)
  if (project) return { entity: project as Entity, type: 'project' }
  return null
}

export function DetailPane() {
  const selectedEntityId = useUIStore((s) => s.selectedEntityId)
  const events = useGraphStore((s) => s.events)
  const tasks = useGraphStore((s) => s.tasks)
  const notes = useGraphStore((s) => s.notes)
  const projects = useGraphStore((s) => s.projects)

  if (!selectedEntityId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        <p>Select an item to view details</p>
      </div>
    )
  }

  const resolved = resolveEntity(selectedEntityId, events, tasks, notes, projects)

  if (!resolved) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        <p>Entity not found</p>
      </div>
    )
  }

  // Key on uid so React unmounts/remounts the editor when switching entities
  switch (resolved.type) {
    case 'event':
      return <EventEditor key={resolved.entity.uid} event={resolved.entity as import('@/types/entities').Event} />
    case 'task':
      return <TaskEditor key={resolved.entity.uid} task={resolved.entity as import('@/types/entities').Task} />
    case 'project':
      return <ProjectEditor key={resolved.entity.uid} project={resolved.entity as import('@/types/entities').Project} />
    case 'note':
      return <NoteEditor key={resolved.entity.uid} note={resolved.entity as import('@/types/entities').Note} />
  }
}
