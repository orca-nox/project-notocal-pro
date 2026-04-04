import { useMemo } from 'react'
import { FolderOpen, Inbox, StickyNote } from 'lucide-react'
import { useGraphStore } from '@/store/useGraphStore'

export type NoteFolder = 'all' | 'unassigned' | string // string = project uid

interface NotesFolderListProps {
  selectedFolder: NoteFolder
  onSelectFolder: (folder: NoteFolder) => void
}

export function NotesFolderList({ selectedFolder, onSelectFolder }: NotesFolderListProps) {
  const notes = useGraphStore((s) => s.notes)
  const projects = useGraphStore((s) => s.projects)

  const { projectsArr, allCount, unassignedCount, projectCounts } = useMemo(() => {
    const notesArr = Array.from(notes.values())
    const pArr = Array.from(projects.values()).sort((a, b) => a.priority - b.priority)

    const counts = new Map<string, number>()
    let unassigned = 0

    for (const n of notesArr) {
      if (n.relatedTo) {
        counts.set(n.relatedTo, (counts.get(n.relatedTo) ?? 0) + 1)
      } else {
        unassigned++
      }
    }

    return {
      projectsArr: pArr,
      allCount: notesArr.length,
      unassignedCount: unassigned,
      projectCounts: counts,
    }
  }, [notes, projects])

  const itemClass = (folder: NoteFolder) =>
    `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors ${
      selectedFolder === folder
        ? 'bg-accent text-accent-foreground font-medium'
        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
    }`

  return (
    <div className="flex flex-col gap-0.5 p-2">
      <button className={itemClass('all')} onClick={() => onSelectFolder('all')}>
        <StickyNote className="h-4 w-4 shrink-0" />
        <span className="truncate">All Notes</span>
        <span className="ml-auto text-xs tabular-nums">{allCount}</span>
      </button>

      <button className={itemClass('unassigned')} onClick={() => onSelectFolder('unassigned')}>
        <Inbox className="h-4 w-4 shrink-0" />
        <span className="truncate">Unassigned</span>
        <span className="ml-auto text-xs tabular-nums">{unassignedCount}</span>
      </button>

      {projectsArr.length > 0 && (
        <div className="mt-2 border-t border-border pt-2">
          <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Projects
          </span>
          <div className="mt-1 flex flex-col gap-0.5">
            {projectsArr.map((p) => (
              <button key={p.uid} className={itemClass(p.uid)} onClick={() => onSelectFolder(p.uid)}>
                <FolderOpen className="h-4 w-4 shrink-0" />
                <span className="truncate">{p.summary}</span>
                <span className="ml-auto text-xs tabular-nums">
                  {projectCounts.get(p.uid) ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
