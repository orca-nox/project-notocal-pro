import { useUIStore } from '@/store/useUIStore'
import { useGraphStore } from '@/store/useGraphStore'

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

  const entity =
    events.get(selectedEntityId) ??
    tasks.get(selectedEntityId) ??
    notes.get(selectedEntityId) ??
    projects.get(selectedEntityId)

  if (!entity) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        <p>Entity not found</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <h2 className="text-xl font-bold mb-2">{entity.summary}</h2>
      {'description' in entity && entity.description && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entity.description}</p>
      )}
    </div>
  )
}
