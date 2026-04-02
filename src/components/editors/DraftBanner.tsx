import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DraftBannerProps {
  timestamp: number
  onDiscard: () => void
}

export function DraftBanner({ timestamp, onDiscard }: DraftBannerProps) {
  const formatted = new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="flex items-center gap-2 rounded-md bg-blue-500/15 px-3 py-2 text-sm text-blue-500">
      <Info className="h-4 w-4 shrink-0" />
      <span className="flex-1">Unsaved changes from {formatted}</span>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onDiscard}>
        Discard
      </Button>
    </div>
  )
}
