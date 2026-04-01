import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  formatICalDate,
  icalToHtmlDatetime,
  htmlDatetimeToIcal,
  addMinutes,
} from '@/lib/caldav/dateUtils'
import type { Event, CalendarInfo, Project } from '@/types/entities'

interface QuickAddSlot {
  date: Date
  isAllDay: boolean
}

interface QuickAddModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSlot: QuickAddSlot | null
  calendars: Map<string, CalendarInfo>
  projects: Map<string, Project>
  onSubmit: (event: Event) => Promise<void>
}

function toDatetimeLocal(date: Date): string {
  return icalToHtmlDatetime(formatICalDate(date))
}

export function QuickAddModal({
  open,
  onOpenChange,
  initialSlot,
  calendars,
  projects,
  onSubmit,
}: QuickAddModalProps) {
  const calendarsArr = Array.from(calendars.values()).sort((a, b) => a.order - b.order)
  const projectsArr = Array.from(projects.values())

  const [summary, setSummary] = useState('')
  const [dtstart, setDtstart] = useState('')
  const [dtend, setDtend] = useState('')
  const [calendarId, setCalendarId] = useState('')
  const [relatedTo, setRelatedTo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Populate form when slot / open changes
  useEffect(() => {
    if (!open) return
    const slot = initialSlot ?? { date: new Date(), isAllDay: false }
    const start = slot.date
    const end = addMinutes(start, 60)
    setDtstart(toDatetimeLocal(start))
    setDtend(toDatetimeLocal(end))
    setCalendarId(calendarsArr[0]?.id ?? '')
    setSummary('')
    setRelatedTo('')
    setError('')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!summary.trim()) { setError('Title is required.'); return }
    if (!calendarId) { setError('Select a calendar.'); return }

    const uid = crypto.randomUUID()
    const now = formatICalDate(new Date())
    const event: Event = {
      uid,
      calendarId,
      dtstamp: now,
      dtstart: htmlDatetimeToIcal(dtstart),
      dtend: htmlDatetimeToIcal(dtend),
      summary: summary.trim(),
      relatedTo: relatedTo || undefined,
      etag: '',
      rawIcs: '',
    }

    setSubmitting(true)
    try {
      await onSubmit(event)
      onOpenChange(false)
    } catch (err) {
      setError(`Failed to save: ${err}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Event</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            placeholder="Title"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            autoFocus
          />

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Start</label>
              <input
                type="datetime-local"
                value={dtstart}
                onChange={(e) => setDtstart(e.target.value)}
                className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">End</label>
              <input
                type="datetime-local"
                value={dtend}
                onChange={(e) => setDtend(e.target.value)}
                className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Calendar</label>
            <select
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            >
              {calendarsArr.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
          </div>

          {projectsArr.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Project (optional)</label>
              <select
                value={relatedTo}
                onChange={(e) => setRelatedTo(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">None</option>
                {projectsArr.map((p) => (
                  <option key={p.uid} value={p.uid}>{p.summary}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Add Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
