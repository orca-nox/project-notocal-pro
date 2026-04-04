import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface AIState {
  isOpen: boolean
  messages: ChatMessage[]
  isStreaming: boolean
}

interface AIActions {
  toggle(): void
  setOpen(open: boolean): void
  addMessage(message: ChatMessage): void
  updateLastAssistantMessage(content: string): void
  clearMessages(): void
  setStreaming(streaming: boolean): void
}

export const useAIStore = create<AIState & AIActions>()((set) => ({
  isOpen: false,
  messages: [],
  isStreaming: false,

  toggle() {
    set((s) => ({ isOpen: !s.isOpen }))
  },
  setOpen(open) {
    set({ isOpen: open })
  },
  addMessage(message) {
    set((s) => ({ messages: [...s.messages, message] }))
  },
  updateLastAssistantMessage(content) {
    set((s) => {
      const msgs = [...s.messages]
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], content }
          break
        }
      }
      return { messages: msgs }
    })
  },
  clearMessages() {
    set({ messages: [] })
  },
  setStreaming(streaming) {
    set({ isStreaming: streaming })
  },
}))
