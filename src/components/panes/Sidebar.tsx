import {
  FolderKanban,
  Calendar,
  CheckSquare,
  StickyNote,
  Pin,
  PinOff,
  Search,
} from 'lucide-react'
import { useGraphStore } from '@/store/useGraphStore'
import { useFilterStore } from '@/store/useFilterStore'
import { useUIStore } from '@/store/useUIStore'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import type { ActiveView } from '@/types/store'

const NAV_ITEMS: { view: ActiveView; label: string; icon: typeof FolderKanban; key: string }[] = [
  { view: 'projects', label: 'Projects', icon: FolderKanban, key: '1' },
  { view: 'calendar', label: 'Calendar', icon: Calendar, key: '2' },
  { view: 'tasks', label: 'Tasks', icon: CheckSquare, key: '3' },
  { view: 'notes', label: 'Notes', icon: StickyNote, key: '4' },
]

export function Sidebar() {
  const activeView = useUIStore((s) => s.activeView)
  const setView = useUIStore((s) => s.setView)
  const navPinned = useUIStore((s) => s.navPinned)
  const toggleNavPin = useUIStore((s) => s.toggleNavPin)

  const calendars = useGraphStore((s) => s.calendars)
  const enabledCalendars = useFilterStore((s) => s.enabledCalendars)
  const toggleCalendar = useFilterStore((s) => s.toggleCalendar)

  const calendarsArr = Array.from(calendars.values())

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-lg font-bold tracking-tight">Notocal</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleNavPin}>
          {navPinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
        </Button>
      </div>

      {/* Search placeholder */}
      <div className="px-3 pb-2">
        <Button variant="outline" className="w-full justify-start gap-2 text-muted-foreground" size="sm">
          <Search className="h-4 w-4" />
          <span>Search...</span>
          <kbd className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">Ctrl K</kbd>
        </Button>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {NAV_ITEMS.map(({ view, label, icon: Icon, key }) => (
          <button
            key={view}
            onClick={() => setView(view)}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              activeView === view
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            <kbd className="ml-auto text-[10px] text-muted-foreground font-mono">{key}</kbd>
          </button>
        ))}
      </nav>

      <Separator />

      {/* Calendar toggles */}
      <div className="px-3 py-3 space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Calendars
        </span>
        {calendarsArr.length === 0 ? (
          <p className="text-xs text-muted-foreground">No calendars loaded</p>
        ) : (
          <div className="space-y-1.5">
            {calendarsArr.map((c) => (
              <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox
                  checked={enabledCalendars.has(c.id)}
                  onCheckedChange={() => toggleCalendar(c.id)}
                />
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                <span className="truncate">{c.displayName}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
