import { WifiOff } from 'lucide-react'
import { useSyncStore } from '@/store/useSyncStore'

export function OfflineBanner() {
  const status = useSyncStore((s) => s.status)
  const lastError = useSyncStore((s) => s.lastError)
  const initialized = useSyncStore((s) => s.initialized)

  // Only show after initial load attempt, and only when in error state
  if (!initialized || status !== 'error') return null

  return (
    <div className="shrink-0 flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-400">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        Radicale is unreachable — operating from cache in read-only mode.
        {lastError && <span className="text-amber-500/70"> ({lastError})</span>}
      </span>
    </div>
  )
}
