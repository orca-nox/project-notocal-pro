# Architecture & Module Strategy

This document defines the codebase structure, module responsibilities, data flow, and sync strategy for Notocal Pro.

---

## Table of Contents

1. [Directory Structure](#1-directory-structure)
2. [Module Responsibilities](#2-module-responsibilities)
3. [Data Flow](#3-data-flow)
4. [Sync Strategy](#4-sync-strategy)
5. [State Management Details](#5-state-management-details)
6. [Component Hierarchy](#6-component-hierarchy)

---

## 1. Directory Structure

```
src/
├── hooks/                    # Data fetching & CalDAV operations
│   ├── useCalDAV.ts          # Core CalDAV client hook (fetch, put, delete)
│   ├── useSync.ts            # Sync-on-focus with auto calendar enablement
│   ├── useBootstrap.ts       # First-launch collection setup
│   └── useKeyboardShortcuts.ts # Global keyboard shortcuts (1-4 views, Esc)
│
├── store/                    # Zustand state management
│   ├── useGraphStore.ts      # Entity relationship graph
│   ├── useDraftStore.ts      # Persisted draft management
│   ├── useUIStore.ts         # UI state (active view, selections, nav pin)
│   └── useFilterStore.ts     # Calendar toggle & filter state
│
├── lib/                      # Pure utilities (no React dependencies)
│   ├── caldav/               # CalDAV protocol helpers
│   │   ├── client.ts         # tsdav wrapper (bypasses service discovery)
│   │   ├── config.ts         # CalDAV config from environment variables
│   │   ├── parser.ts         # .ics parsing with VTIMEZONE isolation & DURATION support
│   │   ├── serializer.ts     # Entity -> .ics string conversion
│   │   └── dateUtils.ts      # Date math helpers (addDays, startOfWeek, formatICalDate, etc.)
│   ├── markdown/             # Markdown parsing for task descriptions
│   │   ├── subtasks.ts       # Parse/serialize sub-task checklists
│   │   └── prerequisites.ts  # Parse/serialize prerequisite links
│   ├── cache.ts              # IndexedDB layer via idb (replaceAllCached, per-entity CRUD)
│   ├── graph.ts              # RELATED-TO graph construction logic
│   └── utils.ts              # General utilities (cn, etc.)
│
├── components/
│   ├── ui/                   # Dumb components (shadcn/ui, stateless)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── checkbox.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── input.tsx
│   │   ├── input-group.tsx
│   │   ├── textarea.tsx
│   │   ├── separator.tsx
│   │   ├── tooltip.tsx
│   │   └── command.tsx        # Omnibar / command palette (Ctrl+K)
│   │
│   ├── panes/                # Smart panes (the three columns + top nav)
│   │   ├── Sidebar.tsx        # Column 1: search, nav items, calendar toggles
│   │   ├── TopNav.tsx         # Slide-down nav bar with view switcher + pin
│   │   ├── MainPane.tsx       # Column 2: view router
│   │   └── DetailPane.tsx     # Column 3: entity detail / empty state
│   │
│   ├── views/                # Column 2 view implementations
│   │   ├── ProjectsView.tsx   # [1] Project list with children + unassigned
│   │   ├── CalendarView.tsx   # [2] Month/Week grid with event CRUD
│   │   ├── TasksView.tsx      # [3] Filtered task list
│   │   └── NotesView.tsx      # [4] Notes list with description preview
│   │
│   ├── calendar/             # Calendar grid components (Phase 4)
│   │   ├── MonthGrid.tsx      # Month grid with date cells + event chips
│   │   ├── WeekGrid.tsx       # 7-day hourly grid with drag move/resize
│   │   ├── EventBlock.tsx     # Colored event chip/block for both grids
│   │   └── QuickAddModal.tsx  # Lightweight event creation dialog
│   │
│   ├── editors/              # Column 3 editor forms (planned Phase 6)
│   │
│   ├── kanban/               # Kanban board components (planned Phase 7)
│   │
│   └── ai/                   # AI chat components (planned Phase 10)
│
├── types/                    # TypeScript type definitions
│   ├── entities.ts            # Event, Task, Note, Project types
│   ├── caldav.ts              # CalDAV response types
│   └── store.ts               # Store state types
│
├── App.tsx                   # Root layout (Sidebar + resizable panels + TopNav)
├── main.tsx                  # Vite entry point
└── index.css                 # Tailwind base styles
```

---

## 2. Module Responsibilities

### Data Hooks

#### `useCalDAV` — Core CalDAV Client Hook

The single most important hook. Owns the entire CalDAV lifecycle:

| Responsibility | Description |
|---|---|
| **Fetching** | Uses `tsdav` to fetch calendars, events, tasks, and journals from Radicale. Passes a custom `comp-filter` (VCALENDAR-only, no nested component filter) to override `tsdav`'s default VEVENT-only filter, ensuring all component types (VEVENT, VTODO, VJOURNAL) are returned. |
| **Writing** | Creates and updates entities via CalDAV `PUT` / `DELETE`. Uses `createCalendarObject` (with `If-None-Match: *`) for new objects and `updateCalendarObject` (with `If-Match: etag`) for existing ones, via a shared `putCalendarObject` helper. |
| **ETag tracking** | Stores ETags per entity. Sends `If-Match` on updates. Detects `412 Precondition Failed` for conflict resolution. |
| **Cascading deletion** | Implements the hierarchical deletion logic (project -> children, task -> sub-tasks). |
| **IndexedDB caching** | Writes fetched entities to IndexedDB. Reads from cache on cold start for instant UI, then syncs in background. |

#### `useSync` — Sync-on-Focus

| Responsibility | Description |
|---|---|
| **Tab focus sync** | Listens for `visibilitychange` and `focus` events. When the browser tab regains focus, triggers a full fetch from Radicale and calls `replaceEntities` for a complete store refresh (handles adds, edits, and deletions). |
| **Cache-first cold start** | Loads entities from IndexedDB cache for instant UI, then syncs from Radicale in the background. |
| **Auto-enable calendars** | After each sync, detects any new calendars not yet in `enabledCalendars` and auto-enables them. Uses `useFilterStore.getState()` to avoid stale closure issues. |

#### `useBootstrap` — First-Launch Setup

| Responsibility | Description |
|---|---|
| **Collection check** | On app load, verifies that the `system-projects` collection exists on Radicale. |
| **Auto-creation** | If missing, sends `MKCOL` / `MKCALENDAR` to create it. |
| **Idempotent** | Safe to run on every load — becomes a no-op if the collection already exists. |

---

### Stores (Zustand)

#### `useGraphStore` — Entity Relationship Graph

The central data store. Ingests raw CalDAV entities (from IndexedDB or fresh fetch) and maintains:

| State | Description |
|---|---|
| `events` | Map of `UID -> Event` |
| `tasks` | Map of `UID -> Task` |
| `notes` | Map of `UID -> Note` |
| `projects` | Map of `UID -> Project` |
| `childrenOf(projectId)` | Derived: all entities with `RELATED-TO` pointing to this project. |
| `parentOf(entityId)` | Derived: the project an entity belongs to (if any). |
| `unassigned` | Derived: all entities with no `RELATED-TO` link. |

**Not persisted** — rebuilt from IndexedDB cache on every app load. The cache is the persistence layer.

#### `useDraftStore` — Draft Management

| State | Description |
|---|---|
| `drafts` | Map of `entityUID -> draftData`. Stores in-progress edits. |
| **Persistence** | Uses Zustand `persist` middleware -> `localStorage` (with IndexedDB fallback for large notes). |
| **Lifecycle** | Draft created on first keystroke. Cleared on successful save to Radicale. Restored on next open if abandoned. |

#### `useUIStore` — UI State

| State | Description |
|---|---|
| `activeView` | Current main view: `'projects'`, `'calendar'`, `'tasks'`, `'notes'`. |
| `selectedEntityId` | UID of the entity currently open in Column 3's editor (or `null`). |
| `navPinned` | Whether the top nav bar is pinned visible. |
| `notesEditorMode` | `'split'` or `'full'` for the Notes view editor layout. |
| **Persistence** | Partially persisted (navPinned, notesEditorMode). View and selection are session-only. |

#### `useFilterStore` — Filter State

| State | Description |
|---|---|
| `enabledCalendars` | Set of calendar IDs currently toggled on. |
| `taskFilters` | Active filters for the Task view (status, due date, project, priority, sort). |
| **Persistence** | Fully persisted — the user's filter preferences survive across sessions. |

---

### Library Modules (`/lib`)

These are **pure functions with no React dependencies**, making them testable in isolation and portable to React Native.

#### `lib/caldav/parser.ts`

Parses raw `.ics` strings (from `tsdav` responses) into typed TypeScript objects (`Event`, `Task`, `Note`, `Project`). Handles:

- **Component block isolation:** Extracts the target component (VEVENT/VTODO/VJOURNAL) block before reading properties, preventing `VTIMEZONE` properties (e.g., `DTSTART` inside `STANDARD`/`DAYLIGHT` sub-components) from shadowing the actual event/task data. This is critical for interoperability with clients like DAVx5 that embed timezone definitions.
- **DURATION → DTEND fallback:** If a VEVENT lacks `DTEND` but has a `DURATION` property (valid per RFC 5545 §3.3.6), the parser computes `DTEND` from `DTSTART + DURATION`. Supports weeks, days, hours, minutes, and seconds.
- Standard property extraction (SUMMARY, DTSTART, etc.) with iCal line unfolding
- Custom `X-` property extraction (X-PROJECT-STATUS, X-PROJECT-PRIORITY)
- RELATED-TO extraction for graph construction

#### `lib/caldav/dateUtils.ts`

Pure date math helpers used by the calendar views. Avoids external date libraries:

- `addDays`, `addMonths`, `startOfWeek`, `startOfMonth`
- `formatMonthYear`, `formatWeekRange`, `formatICalDate`
- iCal datetime string ↔ `Date` object conversion

#### `lib/caldav/serializer.ts`

Converts typed TypeScript objects back into valid `.ics` strings for `PUT` requests to Radicale. Ensures:

- All required properties are present
- Custom properties are correctly formatted
- DESCRIPTION markdown structure is preserved

#### `lib/markdown/subtasks.ts` & `prerequisites.ts`

Parse and serialize the structured markdown within `VTODO` `DESCRIPTION` fields:

- `parseSubtasks(description: string) -> SubTask[]`
- `serializeSubtasks(subtasks: SubTask[]) -> string`
- `parsePrerequisites(description: string) -> Prerequisite[]`
- `serializePrerequisites(prereqs: Prerequisite[]) -> string`

---

### Components

#### Dumb Components (`/components/ui/`)

Sourced from **shadcn/ui** (Radix UI primitives styled with Tailwind). These are:

- **Stateless** — accept props, render UI, emit callbacks.
- **Accessible** — keyboard navigable, ARIA-compliant (inherited from Radix).
- **Owned** — copied into the project (not an npm dependency), fully customizable.

#### Smart Panes (`/components/panes/`)

The three columns of the application. Each pane:

- Connects to the relevant Zustand stores.
- Calls data hooks as needed.
- Passes data down to dumb components.

| Pane | Connects To |
|---|---|
| `Sidebar.tsx` | `useFilterStore` (calendar toggles), `useGraphStore` (project list for quick nav) |
| `MainPane.tsx` | `useUIStore` (active view), `useGraphStore` (entities), `useFilterStore` (active filters) |
| `DetailPane.tsx` | `useUIStore` (selected entity), `useGraphStore` (entity data), `useDraftStore` (draft state), `useCalDAV` (save/delete) |

---

## 3. Data Flow

### Cold Start (App Load)

```
1. useBootstrap: Ensure system-projects collection exists on Radicale
         │
2. useCalDAV: Read from IndexedDB cache
         │
3. useGraphStore: Build in-memory graph from cached entities
         │
4. UI renders immediately from cache
         │
5. useSync: Background sync with Radicale (delta via ETags)
         │
6. useGraphStore: Merge deltas, re-derive graph
         │
7. UI updates reactively
```

### User Edits an Entity

```
1. User modifies fields in Column 3 editor
         │
2. useDraftStore: Auto-save draft on every change (debounced)
         │
3. User presses Ctrl+S (or explicit save button)
         │
4. useCalDAV: Serialize entity -> .ics, PUT to Radicale with If-Match ETag
         │
    ┌─────┴──────┐
    │             │
  200 OK     412 Conflict
    │             │
5a. Update      5b. Surface conflict
    IndexedDB       banner in Column 3
    + GraphStore
    + Clear draft
```

### Sync-on-Focus

```
1. User returns to browser tab (focus / visibilitychange event)
         │
2. useSync: Full fetch from Radicale (all calendars + projects collection)
         │
3. replaceAllCached: Clear and rewrite IndexedDB with fresh data
         │
4. useGraphStore.replaceEntities: Full replace of all entity maps
         │
5. autoEnableCalendars: Enable any new calendars not yet in filter set
         │
6. UI updates reactively (adds, edits, and deletions all reflected)
```

> **Note:** The current sync strategy uses full-fetch + full-replace rather than incremental delta sync. This is simple and correct — it handles additions, edits, and deletions uniformly. ETag-based delta sync (`sync-collection` REPORT) is a future optimization for large datasets.

---

## 4. Sync Strategy

### Cache-First Architecture

Notocal Pro follows a **cache-first** pattern:

1. **IndexedDB is the primary read source** for the UI. The app never waits for a network request to render.
2. **Radicale is the write target** and source of truth. Every mutation goes through CalDAV.
3. **Sync is background and incremental.** The app uses WebDAV `sync-collection` reports (or ETag comparison) to detect changes, fetching only modified entities.

### Why Not Real-Time?

Radicale doesn't support WebSocket push notifications. The sync strategy is:

| Trigger | Method |
|---|---|
| App load | Cache-first render, then full sync from Radicale |
| Tab focus / visibility | Full fetch + replaceEntities (handles adds, edits, deletions) |
| After write | Optimistic local update via `updateEntity` |
| Periodic | Not yet implemented (planned future enhancement) |

For a single-user deployment, this is more than sufficient — the only "external" changes come from mobile CalDAV clients, and those are picked up within seconds of switching back to the desktop app.

### IndexedDB Schema

```
Object Stores:
├── calendars    { calendarId, displayName, color, order, ... }
├── events       { uid, calendarId, etag, raw_ics, parsed_data, ... }
├── tasks        { uid, calendarId, etag, raw_ics, parsed_data, ... }
├── notes        { uid, calendarId, etag, raw_ics, parsed_data, ... }
├── projects     { uid, etag, raw_ics, parsed_data, ... }
└── sync_tokens  { calendarId, syncToken }
```

Each entity store keeps both the **raw `.ics` string** (for faithful round-tripping) and the **parsed data** (for fast UI reads without re-parsing).

---

## 5. State Management Details

### Store Interaction Diagram

```
                    ┌─────────────────┐
                    │    Radicale      │
                    │  (CalDAV Server) │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │   useCalDAV     │
                    │   (data hook)   │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │   IndexedDB     │
                    │   (cache)       │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────┴───┐  ┌──────┴─────┐  ┌─────┴──────┐
     │ GraphStore │  │ DraftStore │  │ FilterStore│
     │ (entities) │  │ (edits)    │  │ (toggles)  │
     └────────┬───┘  └──────┬─────┘  └─────┬──────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                    ┌────────┴────────┐
                    │    UIStore      │
                    │ (view, selection│
                    │  nav state)     │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │   React UI      │
                    │  (Components)   │
                    └─────────────────┘
```

### Why Multiple Stores?

Zustand supports multiple independent stores, which is preferable to a single monolithic store because:

- **Selective re-rendering:** Components subscribe only to the store slices they need. Changing a filter doesn't re-render the draft manager.
- **Independent persistence:** Each store can have different persistence strategies (or none).
- **Separation of concerns:** UI state, entity data, drafts, and filters are conceptually distinct.

---

## 6. Component Hierarchy

### App Shell

```tsx
<App>                                       // flex h-screen, dark mode
  <Sidebar />                               // Fixed 240px, outside PanelGroup
  <div className="flex-1 flex-col">
    <TopNav />                              // position: fixed, slide-down on mouse proximity
    {navPinned && <Spacer />}               // 44px spacer when nav is pinned
    <Group orientation="horizontal">        // react-resizable-panels, id="notocal-panels"
      <Panel defaultSize={65} minSize={40}>
        <MainPane />                        // Column 2: view router
      </Panel>
      <Separator />                         // Drag handle between Col 2 & 3
      <Panel defaultSize={35} minSize={20}>
        <DetailPane />                      // Column 3: entity detail
      </Panel>
    </Group>
  </div>
</App>
```

Panel sizes are persisted to localStorage via `react-resizable-panels` `id` prop. The Sidebar is **outside** the PanelGroup (fixed width), so only MainPane and DetailPane are resizable.

### MainPane View Router

```tsx
<MainPane>
  {activeView === 'projects' && <ProjectsView />}
  {activeView === 'calendar' && <CalendarView />}
  {activeView === 'tasks'    && <TasksView />}
  {activeView === 'notes'    && <NotesView />}
</MainPane>
```

### DetailPane Mode Switch

```tsx
<DetailPane>
  {selectedEntity ? (
    <ResizableVerticalSplit>
      <EditorForm entity={selectedEntity} />   // Top
      <MiniChat context={selectedEntity} />     // Bottom
    </ResizableVerticalSplit>
  ) : (
    <ChatPanel context={activeViewContext} />   // Full AI chat
  )}
  {conflict && <ConflictBanner />}
</DetailPane>
```
