import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Task } from '@/types/entities'

interface DeleteTaskDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (task: Task) => void
  dependentCount: number
}

export function DeleteTaskDialog({
  task,
  open,
  onOpenChange,
  onConfirm,
  dependentCount,
}: DeleteTaskDialogProps) {
  if (!task) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Task</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{task.summary}"?
            {task.subtasks.length > 0 && (
              <span className="block mt-1">
                This task has {task.subtasks.length} sub-task{task.subtasks.length > 1 ? 's' : ''} that will also be removed.
              </span>
            )}
            {dependentCount > 0 && (
              <span className="block mt-1">
                {dependentCount} other task{dependentCount > 1 ? 's' : ''} reference{dependentCount === 1 ? 's' : ''} this as a prerequisite and will be updated.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(task)}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
