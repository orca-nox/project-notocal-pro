import type { CSSProperties, MouseEvent, Ref } from 'react'
import { formatTimeHHMM, icalToDate } from '@/lib/caldav/dateUtils'
import type { Event } from '@/types/entities'

interface EventBlockProps {
  event: Event
  calendarColor: string
  mode: 'month' | 'week'
  // week-mode positioning
  style?: CSSProperties
  isDragging?: boolean
  // interaction
  resizeHandleRef?: Ref<HTMLDivElement>
  onMouseDown?: (e: MouseEvent<HTMLDivElement>) => void
  onResizeMouseDown?: (e: MouseEvent<HTMLDivElement>) => void
  onClick: (e: MouseEvent<HTMLDivElement>) => void
  isSelected?: boolean
}

export function EventBlock({
  event,
  calendarColor,
  mode,
  style,
  isDragging,
  resizeHandleRef,
  onMouseDown,
  onResizeMouseDown,
  onClick,
  isSelected,
}: EventBlockProps) {
  const bg = calendarColor + '33' // 20% alpha fill
  const border = calendarColor

  if (mode === 'month') {
    return (
      <div
        onClick={onClick}
        className={`mb-0.5 cursor-pointer truncate rounded px-1 py-0.5 text-xs leading-tight select-none ${
          isSelected ? 'ring-1 ring-white/60' : ''
        }`}
        style={{ backgroundColor: bg, borderLeft: `3px solid ${border}`, color: 'inherit' }}
        title={event.summary}
      >
        {event.summary}
      </div>
    )
  }

  // Week mode
  const startLabel = formatTimeHHMM(icalToDate(event.dtstart))

  return (
    <div
      onMouseDown={onMouseDown}
      onClick={onClick}
      className={`absolute overflow-hidden rounded text-xs select-none ${
        isDragging ? 'opacity-70 cursor-grabbing' : 'cursor-grab'
      } ${isSelected ? 'ring-1 ring-white/60' : ''}`}
      style={{
        ...style,
        backgroundColor: bg,
        borderLeft: `3px solid ${border}`,
      }}
      title={event.summary}
    >
      <div className="px-1 pt-0.5 font-medium leading-tight truncate">{event.summary}</div>
      <div className="px-1 text-[10px] opacity-70">{startLabel}</div>

      {/* Resize handle */}
      <div
        ref={resizeHandleRef}
        onMouseDown={(e) => {
          e.stopPropagation()
          onResizeMouseDown?.(e)
        }}
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize"
        style={{ backgroundColor: border + '55' }}
      />
    </div>
  )
}
