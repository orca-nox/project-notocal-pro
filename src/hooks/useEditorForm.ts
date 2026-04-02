import { useState, useCallback, useEffect, useRef } from 'react'
import { useGraphStore } from '@/store/useGraphStore'
import { useDraftStore } from '@/store/useDraftStore'
import { useCalDAV } from '@/hooks/useCalDAV'
import { serializeEvent, serializeTask, serializeNote, serializeProject } from '@/lib/caldav/serializer'
import type { Entity, EntityType, Event, Task, Note, Project } from '@/types/entities'
import type { WriteResult } from '@/types/caldav'

export interface EditorFormState<T extends Record<string, unknown>> {
  formData: T
  setField: <K extends keyof T>(key: K, value: T[K]) => void
  setFields: (partial: Partial<T>) => void
  save: () => Promise<void>
  overwrite: () => Promise<void>
  reload: () => Promise<void>
  discardDraft: () => void
  deleteEntity: () => Promise<void>
  isSaving: boolean
  hasDraft: boolean
  draftTimestamp: number | null
  conflict: boolean
  error: string | null
}

interface UseEditorFormOptions<T extends Record<string, unknown>> {
  entityType: EntityType
  uid: string
  /** Convert an entity from the store into flat form data */
  toFormData: (entity: Entity) => T
  /** Convert form data back into a full entity for saving */
  toEntity: (formData: T, original: Entity) => Entity
}

export function useEditorForm<T extends Record<string, unknown>>(
  options: UseEditorFormOptions<T>,
): EditorFormState<T> {
  const { entityType, uid, toFormData, toEntity } = options

  const entity = useGraphStore((s) => {
    switch (entityType) {
      case 'event': return s.events.get(uid)
      case 'task': return s.tasks.get(uid)
      case 'note': return s.notes.get(uid)
      case 'project': return s.projects.get(uid)
    }
  })
  const updateEntity = useGraphStore((s) => s.updateEntity)
  const removeEntity = useGraphStore((s) => s.removeEntity)
  const selectEntity = useGraphStore.getState // we'll import from UIStore below

  const { putEvent, putTask, putNote, putProject, deleteEvent, deleteTask, deleteNote, deleteProject, fetchAll } = useCalDAV()
  const replaceEntities = useGraphStore((s) => s.replaceEntities)

  const saveDraft = useDraftStore((s) => s.saveDraft)
  const clearDraft = useDraftStore((s) => s.clearDraft)

  // Check for existing draft on mount
  const existingDraft = useDraftStore.getState().getDraft(uid)

  const [formData, setFormData] = useState<T>(() => {
    if (existingDraft) return existingDraft.data as T
    if (entity) return toFormData(entity)
    return {} as T
  })

  const [hasDraft, setHasDraft] = useState(() => !!existingDraft)
  const [draftTimestamp, setDraftTimestamp] = useState<number | null>(
    () => existingDraft?.savedAt ?? null,
  )
  const [isSaving, setIsSaving] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track the current server etag so we can detect conflicts
  const etagRef = useRef(entity?.etag ?? '')
  // Track whether user has touched the form (to decide if external sync updates the form)
  const touchedRef = useRef(!!existingDraft)

  // Update etag when entity changes externally (but don't overwrite form if touched)
  useEffect(() => {
    if (!entity) return
    etagRef.current = entity.etag
    if (!touchedRef.current && !hasDraft) {
      setFormData(toFormData(entity))
    }
  }, [entity, toFormData, hasDraft])

  // Debounced draft save
  const draftTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const scheduleDraftSave = useCallback((data: T) => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      saveDraft(uid, data as Record<string, unknown>)
      setHasDraft(true)
      setDraftTimestamp(Date.now())
    }, 500)
  }, [uid, saveDraft])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    }
  }, [])

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    touchedRef.current = true
    setFormData((prev) => {
      const next = { ...prev, [key]: value }
      scheduleDraftSave(next)
      return next
    })
  }, [scheduleDraftSave])

  const setFields = useCallback((partial: Partial<T>) => {
    touchedRef.current = true
    setFormData((prev) => {
      const next = { ...prev, ...partial }
      scheduleDraftSave(next)
      return next
    })
  }, [scheduleDraftSave])

  const putEntity = useCallback(async (ent: Entity, etag?: string): Promise<WriteResult> => {
    switch (entityType) {
      case 'event': return putEvent(ent as Event, etag)
      case 'task': return putTask(ent as Task, etag)
      case 'note': return putNote(ent as Note, etag)
      case 'project': return putProject(ent as Project, etag)
    }
  }, [entityType, putEvent, putTask, putNote, putProject])

  const serializeEntity = useCallback((ent: Entity): string => {
    switch (entityType) {
      case 'event': return serializeEvent(ent as Event)
      case 'task': return serializeTask(ent as Task)
      case 'note': return serializeNote(ent as Note)
      case 'project': return serializeProject(ent as Project)
    }
  }, [entityType])

  const save = useCallback(async () => {
    if (!entity || isSaving) return
    setIsSaving(true)
    setError(null)
    setConflict(false)

    try {
      const updated = toEntity(formData, entity)
      const result = await putEntity(updated, etagRef.current)

      if (result.ok) {
        const saved = { ...updated, etag: result.etag, rawIcs: serializeEntity(updated) }
        updateEntity(entityType, saved as Event & Task & Note & Project)
        etagRef.current = result.etag
        clearDraft(uid)
        setHasDraft(false)
        setDraftTimestamp(null)
        touchedRef.current = false
      } else if (result.status === 412) {
        setConflict(true)
      } else {
        setError(result.message ?? 'Save failed')
      }
    } finally {
      setIsSaving(false)
    }
  }, [entity, isSaving, formData, toEntity, putEntity, serializeEntity, updateEntity, entityType, clearDraft, uid])

  const overwrite = useCallback(async () => {
    if (!entity || isSaving) return
    setIsSaving(true)
    setError(null)

    try {
      // Re-fetch to get fresh etag, then retry with it
      const result = await fetchAll()
      replaceEntities(result)

      // Get fresh entity from the result
      let freshEtag = ''
      switch (entityType) {
        case 'event': {
          const fresh = result.events.find((e) => e.uid === uid)
          if (fresh) freshEtag = fresh.etag
          break
        }
        case 'task': {
          const fresh = result.tasks.find((t) => t.uid === uid)
          if (fresh) freshEtag = fresh.etag
          break
        }
        case 'note': {
          const fresh = result.notes.find((n) => n.uid === uid)
          if (fresh) freshEtag = fresh.etag
          break
        }
        case 'project': {
          const fresh = result.projects.find((p) => p.uid === uid)
          if (fresh) freshEtag = fresh.etag
          break
        }
      }

      const updated = toEntity(formData, entity)
      const writeResult = await putEntity(updated, freshEtag || undefined)

      if (writeResult.ok) {
        const saved = { ...updated, etag: writeResult.etag, rawIcs: serializeEntity(updated) }
        updateEntity(entityType, saved as Event & Task & Note & Project)
        etagRef.current = writeResult.etag
        clearDraft(uid)
        setHasDraft(false)
        setDraftTimestamp(null)
        setConflict(false)
        touchedRef.current = false
      } else {
        setError(writeResult.message ?? 'Overwrite failed')
      }
    } finally {
      setIsSaving(false)
    }
  }, [entity, isSaving, formData, toEntity, putEntity, serializeEntity, updateEntity, entityType, clearDraft, uid, fetchAll, replaceEntities])

  const reload = useCallback(async () => {
    setIsSaving(true)
    try {
      const result = await fetchAll()
      replaceEntities(result)

      // Get fresh entity
      let fresh: Entity | undefined
      switch (entityType) {
        case 'event': fresh = result.events.find((e) => e.uid === uid); break
        case 'task': fresh = result.tasks.find((t) => t.uid === uid); break
        case 'note': fresh = result.notes.find((n) => n.uid === uid); break
        case 'project': fresh = result.projects.find((p) => p.uid === uid); break
      }

      if (fresh) {
        setFormData(toFormData(fresh))
        etagRef.current = fresh.etag
      }
      clearDraft(uid)
      setHasDraft(false)
      setDraftTimestamp(null)
      setConflict(false)
      setError(null)
      touchedRef.current = false
    } finally {
      setIsSaving(false)
    }
  }, [fetchAll, replaceEntities, entityType, uid, toFormData, clearDraft])

  const discardDraft = useCallback(() => {
    clearDraft(uid)
    setHasDraft(false)
    setDraftTimestamp(null)
    touchedRef.current = false
    if (entity) setFormData(toFormData(entity))
  }, [clearDraft, uid, entity, toFormData])

  const deleteEntity_ = useCallback(async () => {
    if (!entity) return
    switch (entityType) {
      case 'event': await deleteEvent(entity as Event); break
      case 'task': await deleteTask(entity as Task); break
      case 'note': await deleteNote(entity as Note); break
      case 'project': await deleteProject(entity as Project); break
    }
    removeEntity(entityType, uid)
    clearDraft(uid)
  }, [entity, entityType, uid, deleteEvent, deleteTask, deleteNote, deleteProject, removeEntity, clearDraft])

  // Ctrl+S handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save])

  return {
    formData,
    setField,
    setFields,
    save,
    overwrite,
    reload,
    discardDraft,
    deleteEntity: deleteEntity_,
    isSaving,
    hasDraft,
    draftTimestamp,
    conflict,
    error,
  }
}
