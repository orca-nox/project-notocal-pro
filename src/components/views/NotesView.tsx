import { useGraphStore } from '@/store/useGraphStore'
import { useUIStore } from '@/store/useUIStore'

export function NotesView() {
  const notes = useGraphStore((s) => s.notes)
  const selectedEntityId = useUIStore((s) => s.selectedEntityId)
  const selectEntity = useUIStore((s) => s.selectEntity)

  const notesArr = Array.from(notes.values())

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Notes</h1>
      {notesArr.length === 0 ? (
        <p className="text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notesArr.map((n) => (
            <li
              key={n.uid}
              className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                selectedEntityId === n.uid
                  ? 'border-primary bg-accent'
                  : 'border-border hover:bg-accent/50'
              }`}
              onClick={() => selectEntity(n.uid)}
            >
              <span className="font-medium">{n.summary}</span>
              {n.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {n.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
