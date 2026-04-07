import { useCallback } from 'react'
import { toast } from 'sonner'
import {
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'
import { useGraphStore } from '@/store/useGraphStore'
import { useUIStore } from '@/store/useUIStore'
import { useCalDAV } from '@/hooks/useCalDAV'
import type { Project } from '@/types/entities'

interface ProjectContextMenuProps {
  project: Project
  onDelete?: (project: Project) => void
  children: React.ReactNode
}

export function ProjectContextMenu({
  project,
  onDelete,
  children,
}: ProjectContextMenuProps) {
  const updateEntity = useGraphStore((s) => s.updateEntity)
  const selectEntity = useUIStore((s) => s.selectEntity)
  const { putProject } = useCalDAV()

  const handleEdit = useCallback(() => {
    selectEntity(project.uid)
  }, [selectEntity, project.uid])

  const handlePriorityChange = useCallback(async (delta: number) => {
    const newPriority = Math.max(0, project.priority + delta)
    const updated: Project = { ...project, priority: newPriority }
    updateEntity('project', updated)
    const result = await putProject(updated, project.etag)
    if (result.ok) {
      updateEntity('project', { ...updated, etag: result.etag })
      toast.success(delta < 0 ? 'Priority raised' : 'Priority lowered')
    }
  }, [project, putProject, updateEntity])

  return (
    <ContextMenu>
      <ContextMenuTrigger className="w-full">
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleEdit}>
          <Pencil className="h-4 w-4" />
          Edit
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => handlePriorityChange(-1)}>
          <ArrowUp className="h-4 w-4" />
          Raise Priority
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handlePriorityChange(1)}>
          <ArrowDown className="h-4 w-4" />
          Lower Priority
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => onDelete?.(project)}>
          <Trash2 className="h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
