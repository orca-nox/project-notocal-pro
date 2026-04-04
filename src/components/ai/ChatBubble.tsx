import { MessageCircle } from 'lucide-react'
import { useAIStore } from '@/store/useAIStore'
import { ChatPanel } from './ChatPanel'
import { cn } from '@/lib/utils'

export function ChatBubble() {
  const isOpen = useAIStore((s) => s.isOpen)
  const isStreaming = useAIStore((s) => s.isStreaming)
  const toggle = useAIStore((s) => s.toggle)

  return (
    <>
      <ChatPanel />
      <button
        onClick={toggle}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:bg-primary/80 hover:scale-105 active:scale-95',
          isStreaming && 'animate-pulse',
          isOpen && 'bg-muted text-muted-foreground hover:bg-muted/80',
        )}
        title="Toggle AI chat (Ctrl+.)"
      >
        <MessageCircle className="size-5" />
      </button>
    </>
  )
}
