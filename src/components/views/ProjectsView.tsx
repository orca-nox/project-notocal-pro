import { useGraphStore } from '@/store/useGraphStore'
import { useUIStore } from '@/store/useUIStore'

export function ProjectsView() {
  const projects = useGraphStore((s) => s.projects)
  const childrenOf = useGraphStore((s) => s.childrenOf)
  const unassigned = useGraphStore((s) => s.unassigned)
  const selectedEntityId = useUIStore((s) => s.selectedEntityId)
  const selectEntity = useUIStore((s) => s.selectEntity)

  const projectsArr = Array.from(projects.values())
  const unassignedItems = unassigned()

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Projects</h1>
      {projectsArr.length === 0 && unassignedItems.length === 0 ? (
        <p className="text-muted-foreground">No projects yet.</p>
      ) : (
        <div className="space-y-4">
          {projectsArr.map((p) => {
            const children = childrenOf(p.uid)
            return (
              <div
                key={p.uid}
                className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                  selectedEntityId === p.uid
                    ? 'border-primary bg-accent'
                    : 'border-border hover:bg-accent/50'
                }`}
                onClick={() => selectEntity(p.uid)}
              >
                <h2 className="font-semibold">
                  {p.summary}{' '}
                  <span className="text-muted-foreground text-sm font-normal">[{p.status}]</span>
                </h2>
                {children.length > 0 && (
                  <ul className="mt-2 ml-4 space-y-0.5 text-sm text-muted-foreground">
                    {children.map((c) => (
                      <li
                        key={c.uid}
                        className={`cursor-pointer rounded px-1 py-0.5 transition-colors hover:text-foreground ${
                          selectedEntityId === c.uid ? 'text-foreground bg-accent' : ''
                        }`}
                        onClick={(e) => { e.stopPropagation(); selectEntity(c.uid) }}
                      >
                        {c.summary}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
          {unassignedItems.length > 0 && (
            <div className="rounded-lg border border-border p-4">
              <h2 className="font-semibold text-muted-foreground">
                Unassigned ({unassignedItems.length})
              </h2>
              <ul className="mt-2 ml-4 space-y-0.5 text-sm text-muted-foreground">
                {unassignedItems.map((c) => (
                  <li
                    key={c.uid}
                    className={`cursor-pointer rounded px-1 py-0.5 transition-colors hover:text-foreground ${
                      selectedEntityId === c.uid ? 'text-foreground bg-accent' : ''
                    }`}
                    onClick={() => selectEntity(c.uid)}
                  >
                    {c.summary}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
