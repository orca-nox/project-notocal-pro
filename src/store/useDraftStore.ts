import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DraftData } from '@/types/store'

interface DraftState {
  drafts: Map<string, DraftData>
}

interface DraftActions {
  saveDraft(uid: string, data: Record<string, unknown>): void
  getDraft(uid: string): DraftData | undefined
  clearDraft(uid: string): void
}

export const useDraftStore = create<DraftState & DraftActions>()(
  persist(
    (set, get) => ({
      drafts: new Map(),

      saveDraft(uid, data) {
        set((state) => {
          const next = new Map(state.drafts)
          next.set(uid, { entityUid: uid, data, savedAt: Date.now() })
          return { drafts: next }
        })
      },

      getDraft(uid) {
        return get().drafts.get(uid)
      },

      clearDraft(uid) {
        set((state) => {
          const next = new Map(state.drafts)
          next.delete(uid)
          return { drafts: next }
        })
      },
    }),
    {
      name: 'notocal-drafts',
      storage: {
        getItem(name) {
          const raw = localStorage.getItem(name)
          if (!raw) return null
          const parsed = JSON.parse(raw)
          // Rehydrate Map from entries array
          if (parsed?.state?.drafts) {
            parsed.state.drafts = new Map(parsed.state.drafts)
          }
          return parsed
        },
        setItem(name, value) {
          // Serialize Map to entries array
          const serializable = {
            ...value,
            state: {
              ...value.state,
              drafts: Array.from(value.state.drafts.entries()),
            },
          }
          localStorage.setItem(name, JSON.stringify(serializable))
        },
        removeItem(name) {
          localStorage.removeItem(name)
        },
      },
    },
  ),
)
