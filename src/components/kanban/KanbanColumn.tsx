import type { ReactNode } from 'react'

interface KanbanColumnProps {
  title: string
  count: number
  children: ReactNode
  className?: string
}

export function KanbanColumn({ title, count, children, className }: KanbanColumnProps) {
  return (
    <div className={`flex flex-col min-w-[260px] max-w-[350px] flex-1 rounded-lg bg-muted/30 ${className ?? ''}`}>
      <div className="sticky top-0 flex items-center gap-2 rounded-t-lg bg-muted/50 px-3 py-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">({count})</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {children}
      </div>
    </div>
  )
}
