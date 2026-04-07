import { useUIStore } from '@/store/useUIStore'
import { useSyncStore } from '@/store/useSyncStore'
import { ProjectsView } from '@/components/views/ProjectsView'
import { CalendarView } from '@/components/views/CalendarView'
import { TasksView } from '@/components/views/TasksView'
import { NotesView } from '@/components/views/NotesView'
import { ViewSkeleton } from '@/components/Skeleton'

const VIEWS = {
  projects: ProjectsView,
  calendar: CalendarView,
  tasks: TasksView,
  notes: NotesView,
} as const

export function MainPane() {
  const activeView = useUIStore((s) => s.activeView)
  const initialized = useSyncStore((s) => s.initialized)
  const View = VIEWS[activeView]

  if (!initialized) {
    return (
      <div className="h-full overflow-hidden">
        <ViewSkeleton />
      </div>
    )
  }

  return (
    <div className="h-full overflow-hidden">
      <View />
    </div>
  )
}
