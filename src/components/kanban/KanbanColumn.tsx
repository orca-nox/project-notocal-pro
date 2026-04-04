import { useState, type ReactNode } from 'react'
import { Plus, CheckSquare, Calendar, StickyNote } from 'lucide-react'
import type { KanbanColumnId } from './KanbanCard'

export type QuickAddEntityType = 'task' | 'event' | 'note'

interface KanbanColumnProps {
  title: string
  count: number
  children: ReactNode
  className?: string
  columnId?: KanbanColumnId
  onDrop?: (columnId: KanbanColumnId) => void
  onDragOver?: (e: React.DragEvent) => void
  /** Available entity types for quick-add. Omit for no quick-add. */
  quickAddTypes?: QuickAddEntityType[]
  onQuickAdd?: (title: string, type: QuickAddEntityType) => void
}

const TYPE_ICONS = {
  task: CheckSquare,
  event: Calendar,
  note: StickyNote,
} as const

const TYPE_LABELS = {
  task: 'Task',
  event: 'Event',
  note: 'Note',
} as const

export function KanbanColumn({
  title,
  count,
  children,
  className,
  columnId,
  onDrop,
  onDragOver,
  quickAddTypes,
  onQuickAdd,
}: KanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false)
  const [quickAddValue, setQuickAddValue] = useState('')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [selectedType, setSelectedType] = useState<QuickAddEntityType>(quickAddTypes?.[0] ?? 'task')

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
    onDragOver?.(e)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (columnId && onDrop) onDrop(columnId)
  }

  const handleQuickAddSubmit = () => {
    const trimmed = quickAddValue.trim()
    if (trimmed && onQuickAdd) {
      onQuickAdd(trimmed, selectedType)
      setQuickAddValue('')
      setShowQuickAdd(false)
    }
  }

  const hasQuickAdd = quickAddTypes && quickAddTypes.length > 0 && onQuickAdd

  return (
    <div
      className={`flex flex-col min-w-[240px] max-w-[320px] flex-1 rounded-lg bg-muted/30 ${
        dragOver ? 'ring-2 ring-primary/50' : ''
      } ${className ?? ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="sticky top-0 flex items-center gap-2 rounded-t-lg bg-muted/50 px-3 py-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">({count})</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {children}
      </div>
      {hasQuickAdd && (
        <div className="p-2 border-t border-border/50">
          {showQuickAdd ? (
            <form
              onSubmit={(e) => { e.preventDefault(); handleQuickAddSubmit() }}
              onBlur={(e) => {
                // Only collapse if focus leaves the form entirely
                if (!e.currentTarget.contains(e.relatedTarget as Node) && !quickAddValue.trim()) {
                  setShowQuickAdd(false)
                }
              }}
              className="space-y-1.5"
            >
              <div className="flex gap-1">
                <input
                  autoFocus
                  value={quickAddValue}
                  onChange={(e) => setQuickAddValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setQuickAddValue(''); setShowQuickAdd(false) } }}
                  placeholder="Title..."
                  className="flex-1 h-7 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              {quickAddTypes.length > 1 && (
                <div className="flex gap-0.5">
                  {quickAddTypes.map((type) => {
                    const Icon = TYPE_ICONS[type]
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSelectedType(type)}
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                          selectedType === type
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {TYPE_LABELS[type]}
                      </button>
                    )
                  })}
                </div>
              )}
            </form>
          ) : (
            <button
              onClick={() => setShowQuickAdd(true)}
              className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add item
            </button>
          )}
        </div>
      )}
    </div>
  )
}
