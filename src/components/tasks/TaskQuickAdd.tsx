import { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { CalendarInfo } from '@/types/entities'

interface TaskQuickAddProps {
  calendars: CalendarInfo[]
  onSubmit: (title: string, calendarId: string) => void
}

export function TaskQuickAdd({ calendars, onSubmit }: TaskQuickAddProps) {
  const [title, setTitle] = useState('')
  const [calendarId, setCalendarId] = useState(calendars[0]?.id ?? '')

  const handleSubmit = useCallback(() => {
    const trimmed = title.trim()
    if (!trimmed || !calendarId) return
    onSubmit(trimmed, calendarId)
    setTitle('')
  }, [title, calendarId, onSubmit])

  return (
    <div className="flex items-center gap-2">
      <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
      <Input
        placeholder="Add a task..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
        className="h-8 text-sm"
      />
      {calendars.length > 1 && (
        <select
          value={calendarId}
          onChange={(e) => setCalendarId(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs shrink-0 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {calendars.map((c) => (
            <option key={c.id} value={c.id}>{c.displayName}</option>
          ))}
        </select>
      )}
      <Button size="sm" className="h-8 shrink-0" onClick={handleSubmit} disabled={!title.trim()}>
        Add
      </Button>
    </div>
  )
}
