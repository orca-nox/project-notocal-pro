import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConflictBannerProps {
  onOverwrite: () => void
  onReload: () => void
  isSaving: boolean
}

export function ConflictBanner({ onOverwrite, onReload, isSaving }: ConflictBannerProps) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-amber-500/15 px-3 py-2 text-sm text-amber-500">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">This item was modified externally.</span>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onOverwrite} disabled={isSaving}>
        Overwrite
      </Button>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onReload} disabled={isSaving}>
        Reload
      </Button>
    </div>
  )
}
