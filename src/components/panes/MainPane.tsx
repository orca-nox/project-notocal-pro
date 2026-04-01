import { useUIStore } from '@/store/useUIStore'
import { ProjectsView } from '@/components/views/ProjectsView'
import { CalendarView } from '@/components/views/CalendarView'
import { TasksView } from '@/components/views/TasksView'
import { NotesView } from '@/components/views/NotesView'

const VIEWS = {
  projects: ProjectsView,
  calendar: CalendarView,
  tasks: TasksView,
  notes: NotesView,
} as const

export function MainPane() {
  const activeView = useUIStore((s) => s.activeView)
  const View = VIEWS[activeView]

  return (
    <div className="h-full overflow-hidden">
      <View />
    </div>
  )
}
