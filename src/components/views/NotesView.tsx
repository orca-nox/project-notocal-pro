import { useGraphStore } from '@/store/useGraphStore'

export function NotesView() {
  const notes = useGraphStore((s) => s.notes)

  const notesArr = Array.from(notes.values())

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Notes</h1>
      {notesArr.length === 0 ? (
        <p className="text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notesArr.map((n) => (
            <li key={n.uid} className="rounded-lg border border-border p-3">
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
