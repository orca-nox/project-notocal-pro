import type { Prerequisite } from '@/types/entities'

/**
 * Parse prerequisites from the ## Prerequisites section of a VTODO DESCRIPTION.
 *
 * Format:
 *   ## Prerequisites
 *   - [prereq:<UID>] Task title
 */
export function parsePrerequisites(description: string): Prerequisite[] {
  const prereqs: Prerequisite[] = []
  const lines = description.split('\n')
  let inSection = false

  for (const line of lines) {
    if (/^## Prerequisites$/i.test(line.trim())) {
      inSection = true
      continue
    }
    if (inSection && /^## /.test(line)) {
      break
    }
    if (!inSection) continue

    const match = line.match(/^- \[prereq:([^\]]+)\] (.+)$/)
    if (match) {
      prereqs.push({
        uid: match[1].trim(),
        title: match[2].trim(),
      })
    }
  }

  return prereqs
}

/**
 * Serialize prerequisites back into the markdown format.
 */
export function serializePrerequisites(prereqs: Prerequisite[]): string {
  if (prereqs.length === 0) return ''

  const lines = prereqs.map((p) => `- [prereq:${p.uid}] ${p.title}`)
  return `## Prerequisites\n${lines.join('\n')}`
}
