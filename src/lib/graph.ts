import type { Event, Task, Note, Entity } from '@/types/entities'

export interface RelationshipGraph {
  /** projectId -> set of child entity UIDs */
  childrenMap: Map<string, Set<string>>
  /** entityId -> projectId */
  parentMap: Map<string, string>
  /** Entity UIDs with no RELATED-TO link */
  unassigned: Set<string>
}

/**
 * Pure function: builds the RELATED-TO relationship graph from entity arrays.
 * Projects themselves are not included as children — only events, tasks, and notes.
 */
export function buildGraph(
  events: Event[],
  tasks: Task[],
  notes: Note[],
): RelationshipGraph {
  const childrenMap = new Map<string, Set<string>>()
  const parentMap = new Map<string, string>()
  const unassigned = new Set<string>()

  const processEntity = (entity: Entity & { relatedTo?: string; uid: string }) => {
    if (entity.relatedTo) {
      parentMap.set(entity.uid, entity.relatedTo)
      let children = childrenMap.get(entity.relatedTo)
      if (!children) {
        children = new Set()
        childrenMap.set(entity.relatedTo, children)
      }
      children.add(entity.uid)
    } else {
      unassigned.add(entity.uid)
    }
  }

  events.forEach(processEntity)
  tasks.forEach(processEntity)
  notes.forEach(processEntity)

  return { childrenMap, parentMap, unassigned }
}
