import type { SubTask } from '@/types/entities'

/**
 * Parse sub-tasks from the ## Sub-tasks section of a VTODO DESCRIPTION.
 *
 * Format:
 *   ## Sub-tasks
 *   - [x] Completed item
 *   - [ ] Pending item
 */
export function parseSubtasks(description: string): SubTask[] {
  const subtasks: SubTask[] = []
  const lines = description.split('\n')
  let inSection = false

  for (const line of lines) {
    if (/^## Sub-tasks$/i.test(line.trim())) {
      inSection = true
      continue
    }
    if (inSection && /^## /.test(line)) {
      break
    }
    if (!inSection) continue

    const match = line.match(/^- \[(x| )\] (.+)$/i)
    if (match) {
      subtasks.push({
        completed: match[1].toLowerCase() === 'x',
        title: match[2].trim(),
      })
    }
  }

  return subtasks
}

/**
 * Serialize sub-tasks back into the markdown format.
 */
export function serializeSubtasks(subtasks: SubTask[]): string {
  if (subtasks.length === 0) return ''

  const lines = subtasks.map(
    (st) => `- [${st.completed ? 'x' : ' '}] ${st.title}`,
  )
  return `## Sub-tasks\n${lines.join('\n')}`
}
