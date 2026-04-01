import { useState, useEffect, useRef } from 'react'
import {
  FolderKanban,
  Calendar,
  CheckSquare,
  StickyNote,
  Pin,
  PinOff,
} from 'lucide-react'
import { useUIStore } from '@/store/useUIStore'
import { Button } from '@/components/ui/button'
import type { ActiveView } from '@/types/store'

const VIEW_TABS: { view: ActiveView; label: string; icon: typeof FolderKanban }[] = [
  { view: 'projects', label: 'Projects', icon: FolderKanban },
  { view: 'calendar', label: 'Calendar', icon: Calendar },
  { view: 'tasks', label: 'Tasks', icon: CheckSquare },
  { view: 'notes', label: 'Notes', icon: StickyNote },
]

const TRIGGER_ZONE = 12 // px from top edge to trigger reveal
const HIDE_DELAY = 400 // ms before hiding after mouse leaves

export function TopNav() {
  const activeView = useUIStore((s) => s.activeView)
  const setView = useUIStore((s) => s.setView)
  const navPinned = useUIStore((s) => s.navPinned)
  const toggleNavPin = useUIStore((s) => s.toggleNavPin)

  const [visible, setVisible] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (navPinned) return

    function onMouseMove(e: MouseEvent) {
      if (e.clientY <= TRIGGER_ZONE) {
        if (hideTimer.current) {
          clearTimeout(hideTimer.current)
          hideTimer.current = null
        }
        setVisible(true)
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [navPinned])

  const handleMouseLeave = () => {
    if (navPinned) return
    hideTimer.current = setTimeout(() => setVisible(false), HIDE_DELAY)
  }

  const handleMouseEnter = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }

  const show = navPinned || visible

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`fixed top-0 right-0 left-60 z-40 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 py-2 transition-transform duration-200 ${
        show ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      {/* View tabs */}
      <div className="flex items-center gap-1">
        {VIEW_TABS.map(({ view, label, icon: Icon }) => (
          <Button
            key={view}
            variant={activeView === view ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-2"
            onClick={() => setView(view)}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Button>
        ))}
      </div>

      {/* Pin toggle */}
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleNavPin}>
        {navPinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
      </Button>
    </div>
  )
}
