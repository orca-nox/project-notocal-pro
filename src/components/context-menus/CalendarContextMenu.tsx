import { useState, useCallback } from 'react'
import {
  Eye,
  EyeOff,
  Pencil,
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CalendarInfo } from '@/types/entities'

const PALETTE = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
]

interface CalendarContextMenuProps {
  calendar: CalendarInfo
  enabled: boolean
  onToggle: () => void
  onUpdate?: (calendarId: string, updates: { displayName?: string; color?: string }) => void
  children: React.ReactNode
}

export function CalendarContextMenu({
  calendar,
  enabled,
  onToggle,
  onUpdate,
  children,
}: CalendarContextMenuProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState(calendar.displayName)
  const [editColor, setEditColor] = useState(calendar.color)

  const handleSave = useCallback(() => {
    onUpdate?.(calendar.id, { displayName: editName, color: editColor })
    setEditOpen(false)
  }, [calendar.id, editName, editColor, onUpdate])

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger className="w-full">
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onToggle}>
            {enabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {enabled ? 'Hide Calendar' : 'Show Calendar'}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => {
            setEditName(calendar.displayName)
            setEditColor(calendar.color)
            setEditOpen(true)
          }}>
            <Pencil className="h-4 w-4" />
            Edit Name/Color
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Calendar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Color</label>
              <div className="flex flex-wrap gap-2">
                {PALETTE.map((color) => (
                  <button
                    key={color}
                    onClick={() => setEditColor(color)}
                    className={`h-6 w-6 rounded-full transition-transform ${
                      editColor === color ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
