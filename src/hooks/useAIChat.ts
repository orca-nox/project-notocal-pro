import { useRef, useCallback } from 'react'
import { useAIStore, type ChatMessage } from '@/store/useAIStore'
import { useUIStore } from '@/store/useUIStore'
import { useGraphStore } from '@/store/useGraphStore'
import { useFilterStore } from '@/store/useFilterStore'

const AI_CHAT_URL = '/api/ai/chat'

function buildSystemPrompt(
  activeView: string,
  selectedEntityId: string | null,
  events: Map<string, unknown>,
  tasks: Map<string, unknown>,
  notes: Map<string, unknown>,
  projects: Map<string, unknown>,
  enabledCalendars: Set<string>,
): string {
  const lines: string[] = [
    'You are Notocal AI, a helpful assistant embedded in a productivity app that manages calendars, tasks, notes, and projects.',
    `The user is currently viewing the "${activeView}" view.`,
    '',
  ]

  // Summarize visible data based on active view
  if (activeView === 'projects') {
    const projectList = [...projects.values()] as Array<{ uid: string; summary: string; status?: string }>
    lines.push(`There are ${projectList.length} projects:`)
    for (const p of projectList.slice(0, 20)) {
      lines.push(`- ${p.summary} (${p.status || 'active'})`)
    }
  } else if (activeView === 'calendar') {
    const eventList = [...events.values()] as Array<{ uid: string; summary: string; dtstart?: string; dtend?: string; calendarId?: string }>
    const visible = eventList.filter((e) => !e.calendarId || enabledCalendars.has(e.calendarId))
    lines.push(`There are ${visible.length} visible events:`)
    for (const e of visible.slice(0, 30)) {
      lines.push(`- ${e.summary} (${e.dtstart || 'no date'})`)
    }
  } else if (activeView === 'tasks') {
    const taskList = [...tasks.values()] as Array<{ uid: string; summary: string; status?: string; calendarId?: string }>
    const visible = taskList.filter((t) => !t.calendarId || enabledCalendars.has(t.calendarId))
    lines.push(`There are ${visible.length} visible tasks:`)
    for (const t of visible.slice(0, 30)) {
      lines.push(`- ${t.summary} (${t.status || 'needs-action'})`)
    }
  } else if (activeView === 'notes') {
    const noteList = [...notes.values()] as Array<{ uid: string; summary: string }>
    lines.push(`There are ${noteList.length} notes:`)
    for (const n of noteList.slice(0, 20)) {
      lines.push(`- ${n.summary}`)
    }
  }

  // If an entity is selected, include its full details
  if (selectedEntityId) {
    const entity =
      events.get(selectedEntityId) ||
      tasks.get(selectedEntityId) ||
      notes.get(selectedEntityId) ||
      projects.get(selectedEntityId)
    if (entity) {
      lines.push('', 'The user has the following entity selected:', JSON.stringify(entity, null, 2))
    }
  }

  return lines.join('\n')
}

export function useAIChat() {
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (userContent: string) => {
    const store = useAIStore.getState()
    if (store.isStreaming) return

    // Add user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
    }
    useAIStore.getState().addMessage(userMsg)

    // Add placeholder assistant message
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    useAIStore.getState().addMessage(assistantMsg)
    useAIStore.getState().setStreaming(true)

    // Build context
    const activeView = useUIStore.getState().activeView
    const selectedEntityId = useUIStore.getState().selectedEntityId
    const { events, tasks, notes, projects } = useGraphStore.getState()
    const { enabledCalendars } = useFilterStore.getState()

    const systemPrompt = buildSystemPrompt(
      activeView,
      selectedEntityId,
      events,
      tasks,
      notes,
      projects,
      enabledCalendars,
    )

    // Build message history for Ollama
    const currentMessages = useAIStore.getState().messages
    const ollamaMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...currentMessages
        .filter((m) => m.content.length > 0)
        .map((m) => ({ role: m.role, content: m.content })),
    ]

    // Stream from Ollama
    const controller = new AbortController()
    abortRef.current = controller
    let accumulated = ''

    try {
      const res = await fetch(AI_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: ollamaMessages }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`AI error: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Ollama streams newline-delimited JSON
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const json = JSON.parse(line)
            if (json.message?.content) {
              accumulated += json.message.content
              useAIStore.getState().updateLastAssistantMessage(accumulated)
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer)
          if (json.message?.content) {
            accumulated += json.message.content
            useAIStore.getState().updateLastAssistantMessage(accumulated)
          }
        } catch {
          // skip
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // User cancelled
      } else {
        const message = (err as Error).message ?? ''
        const isUnavailable = message.includes('Failed to fetch')
          || message.includes('NetworkError')
          || message.includes('net::ERR_CONNECTION_REFUSED')
          || message.includes('Load failed')
        const errorContent = accumulated
          ? accumulated + '\n\n*[Error: connection lost]*'
          : isUnavailable
            ? '*AI endpoint unavailable.* Check that the proxy and Ollama are running.'
            : `*Error: ${message}*`
        useAIStore.getState().updateLastAssistantMessage(errorContent)
      }
    } finally {
      useAIStore.getState().setStreaming(false)
      abortRef.current = null
    }
  }, [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { sendMessage, abort }
}
