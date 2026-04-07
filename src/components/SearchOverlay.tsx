import { useState, useMemo, useCallback } from 'react'
import {
  Calendar,
  CheckSquare,
  StickyNote,
  FolderKanban,
} from 'lucide-react'
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { useGraphStore } from '@/store/useGraphStore'
import { useUIStore } from '@/store/useUIStore'
import type { Event, Task, Note, Project } from '@/types/entities'
import type { ActiveView } from '@/types/store'

type SearchResult =
  | { type: 'event'; entity: Event; view: ActiveView }
  | { type: 'task'; entity: Task; view: ActiveView }
  | { type: 'note'; entity: Note; view: ActiveView }
  | { type: 'project'; entity: Project; view: ActiveView }

function matchesQuery(query: string, ...fields: (string | undefined)[]): boolean {
  const q = query.toLowerCase()
  return fields.some((f) => f?.toLowerCase().includes(q))
}

export function SearchOverlay() {
  const searchOpen = useUIStore((s) => s.searchOpen)
  const setSearchOpen = useUIStore((s) => s.setSearchOpen)
  const setView = useUIStore((s) => s.setView)
  const selectEntity = useUIStore((s) => s.selectEntity)

  const events = useGraphStore((s) => s.events)
  const tasks = useGraphStore((s) => s.tasks)
  const notes = useGraphStore((s) => s.notes)
  const projects = useGraphStore((s) => s.projects)

  const [query, setQuery] = useState('')

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return []

    const out: SearchResult[] = []

    for (const e of events.values()) {
      if (matchesQuery(query, e.summary, e.description, e.location)) {
        out.push({ type: 'event', entity: e, view: 'calendar' })
      }
    }
    for (const t of tasks.values()) {
      if (matchesQuery(query, t.summary, t.description)) {
        out.push({ type: 'task', entity: t, view: 'tasks' })
      }
    }
    for (const n of notes.values()) {
      if (matchesQuery(query, n.summary, n.description)) {
        out.push({ type: 'note', entity: n, view: 'notes' })
      }
    }
    for (const p of projects.values()) {
      if (matchesQuery(query, p.summary, p.description)) {
        out.push({ type: 'project', entity: p, view: 'projects' })
      }
    }

    return out.slice(0, 50)
  }, [query, events, tasks, notes, projects])

  const grouped = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {}
    for (const r of results) {
      ;(groups[r.type] ??= []).push(r)
    }
    return groups
  }, [results])

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setView(result.view)
      selectEntity(result.entity.uid)
      setSearchOpen(false)
      setQuery('')
    },
    [setView, selectEntity, setSearchOpen],
  )

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setSearchOpen(open)
      if (!open) setQuery('')
    },
    [setSearchOpen],
  )

  const ICONS = {
    event: Calendar,
    task: CheckSquare,
    note: StickyNote,
    project: FolderKanban,
  }

  const LABELS = {
    event: 'Events',
    task: 'Tasks',
    note: 'Notes',
    project: 'Projects',
  }

  return (
    <CommandDialog
      open={searchOpen}
      onOpenChange={handleOpenChange}
      title="Search"
      description="Search across events, tasks, notes, and projects"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search events, tasks, notes, projects..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {query.trim() && results.length === 0 && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}
          {Object.entries(grouped).map(([type, items]) => {
            const Icon = ICONS[type as keyof typeof ICONS]
            return (
              <CommandGroup key={type} heading={LABELS[type as keyof typeof LABELS]}>
                {items.map((r) => (
                  <CommandItem
                    key={r.entity.uid}
                    value={r.entity.uid}
                    onSelect={() => handleSelect(r)}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{r.entity.summary}</span>
                    {'location' in r.entity && r.entity.location && (
                      <span className="ml-auto text-xs text-muted-foreground truncate max-w-32">
                        {r.entity.location}
                      </span>
                    )}
                    {'dtstart' in r.entity && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {r.entity.dtstart?.slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )
          })}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
