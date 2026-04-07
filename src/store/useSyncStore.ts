import { create } from 'zustand'

export type SyncStatus = 'idle' | 'syncing' | 'connected' | 'error'

interface SyncState {
  status: SyncStatus
  lastError: string | null
  /** Whether the initial load from cache/server has completed */
  initialized: boolean
}

interface SyncActions {
  setStatus(status: SyncStatus): void
  setError(error: string): void
  setInitialized(): void
}

export const useSyncStore = create<SyncState & SyncActions>()((set) => ({
  status: 'idle',
  lastError: null,
  initialized: false,

  setStatus(status) {
    set({ status, lastError: status === 'error' ? undefined : null })
  },
  setError(error) {
    set({ status: 'error', lastError: error })
  },
  setInitialized() {
    set({ initialized: true })
  },
}))
