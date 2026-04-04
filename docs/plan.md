# Notocal Pro: Project Plan

**NOtes, TO-dos, CALendars, and PROjects. Not a Pro subscription!**

Notocal Pro is a self-hosted, desktop-first productivity suite that unifies notes, tasks, calendar events, and projects into a single multi-pane web application. It uses Radicale (CalDAV/CardDAV) as its sole data backend, storing everything as standard `.ics` files — making the data portable, scriptable, and AI-accessible without proprietary lock-in.

---

## Table of Contents

1. [Core Philosophy & Constraints](#1-core-philosophy--constraints)
2. [Tech Stack](#2-tech-stack)
3. [Data Model Overview](#3-data-model-overview)
4. [UI/UX Overview](#4-uiux-overview)
5. [Architecture Overview](#5-architecture-overview)
6. [Future Roadmap](#6-future-roadmap)
7. [Implementation Roadmap](#7-implementation-roadmap) — 11-phase build plan with task checklists

> **Detailed specs** are broken out into companion documents:
>
> - [Data Model & CalDAV Mapping](./data-model.md) — entity schemas, custom properties, relationships, deletion semantics
> - [UI/UX Layout Specification](./ui-layout.md) — pane structure, views, keyboard shortcuts, interaction flows
> - [Architecture & Module Strategy](./architecture.md) — component hierarchy, state management, sync strategy, file structure

---

## 1. Core Philosophy & Constraints

### Environment

- **Self-hosted** on a home lab server.
- **Network access** via [Tailscale](https://tailscale.com/) — no public exposure, zero-trust mesh VPN.
- **Single-user deployment** (current scope). Multi-user is not a goal for v1.

### Data Sovereignty

- **Radicale** is the single source of truth for all persistent data.
- Radicale was chosen specifically because it stores calendars and contacts as **plain `.ics` text files** on disk. This means:
  - Local AI scripts can read/write calendar data directly via the filesystem, outside the web app entirely.
  - Backups are trivial (rsync the data directory).
  - No database server to maintain.
- The web app communicates with Radicale exclusively over the **CalDAV/CardDAV protocol** (via `tsdav`).

### Target Platform

- **Desktop-first web application**, primarily used on Windows.
- Built with modular, platform-agnostic components to facilitate a **future React Native (Android) port** via NativeWind.
- No SSR, no SEO concerns — this is a private tool accessed by one person.

### UX Philosophy

- **Multi-pane layout** — persistent sidebar, flexible main content, and a context-sensitive right panel.
- **Keyboard-shortcut heavy** — power-user oriented, minimal mouse dependency.
- **Local-first feel** — aggressive caching (IndexedDB), persisted drafts (Zustand + localStorage), and optimistic UI updates to eliminate perceived latency.
- **Modular and composable** — every view is built from the same entity primitives (events, tasks, notes, projects), displayed in different arrangements.

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Build / Dev** | Vite | Fast HMR, zero-config React SPA. Avoids SSR overhead and hydration complexity of Next.js. Ideal for heavily stateful, local-first client applications. |
| **UI Framework** | React (SPA) | Component model, massive ecosystem, React Native portability. |
| **Styling** | Tailwind CSS | Utility-first, co-located styling. Migration path to React Native via NativeWind. |
| **Component Library** | shadcn/ui (Radix UI) | Accessible, unstyled primitives that we own and customize. No black-box component library. |
| **State Management** | Zustand | Lightweight, minimal boilerplate. `persist` middleware for crash-safe drafts. |
| **Local Cache** | IndexedDB | Stores the full CalDAV entity graph locally. Prevents re-downloading the entire Radicale dataset on every page load. |
| **CalDAV Client** | tsdav | TypeScript-first library for CalDAV operations: fetch, parse, create, update, delete, ETag handling, WebDAV sync. |
| **Icons** | lucide-react | Clean, consistent, tree-shakeable icon set. |
| **Auth / Proxy** | Minimal Node/Express proxy (or CORS config) | Handles Radicale authentication and proxying. Keeps credentials out of the browser. |

---

## 3. Data Model Overview

All persistent data lives in Radicale as standard iCalendar (`.ics`) entities. Notocal Pro maps its four core concepts onto CalDAV component types:

| Notocal Concept | iCalendar Component | Storage Location |
|---|---|---|
| **Event** | `VEVENT` | User's standard CalDAV calendars |
| **Task** | `VTODO` | User's standard CalDAV calendars |
| **Note** | `VJOURNAL` | User's standard CalDAV calendars |
| **Project** | `VJOURNAL` (with custom properties) | Hidden `system-projects` collection |

**Calendars** (Work, Personal, Travel, etc.) serve as "Areas of Responsibility" — top-level containers that provide global filtering.

**Projects** are cross-cutting entities that span multiple calendars. Events, tasks, and notes link to a project via the standard `RELATED-TO` property, forming an in-memory relationship graph.

> Full property schemas, custom `X-` properties, relationship semantics, and deletion rules are detailed in [Data Model & CalDAV Mapping](./data-model.md).

---

## 4. UI/UX Overview

The application uses a **three-column desktop layout** with a slide-down top navigation bar:

```
┌─────────────────────────────────────────────────────┐
│  [Top Nav - slide-down, pinnable]                   │
│  [1] Projects  [2] Calendar  [3] Tasks  [4] Notes   │
├──────────┬──────────────────────┬───────────────────┤
│ Sidebar  │   Main Context Pane  │  AI & Detail Pane │
│ (Col 1)  │      (Col 2)         │     (Col 3)       │
│          │                      │                   │
│ Search   │  Adapts to active    │  Default: AI chat │
│ Calendar │  view (1-4):         │  Active: Editor + │
│ Toggles  │  Kanban / Grid /     │    mini-AI chat   │
│          │  List / Notes        │                   │
└──────────┴──────────────────────┴───────────────────┘
```

- **Number keys (1-4)** switch between the four main views.
- **Ctrl+K** opens a global search omnibar.
- **C** quick-creates a new item in context.
- Column 3 splits vertically (resizable) when editing an item: editor form on top, AI chat on bottom.

> Full layout spec, per-view behavior, keyboard shortcuts, and interaction flows are detailed in [UI/UX Layout Specification](./ui-layout.md).

---

## 5. Architecture Overview

The codebase follows a clear separation between data, state, and presentation:

```
src/
├── hooks/          # Data fetching & CalDAV operations
│   └── useCalDAV.ts
├── store/          # Zustand state management
│   └── useGraphStore.ts
├── components/
│   ├── ui/         # Dumb components (shadcn/ui, Tailwind-styled)
│   └── panes/      # Smart panes (Sidebar, MainPane, AIPane)
└── ...
```

1. **Data Hooks** (`useCalDAV`) — own the CalDAV lifecycle: fetching, writing, ETag conflict detection, cascading deletes, first-launch bootstrapping, and sync-on-focus.
2. **Graph Store** (`useGraphStore`) — Zustand store that ingests the IndexedDB cache and materializes the `RELATED-TO` relationship graph in memory.
3. **Dumb Components** (`/components/ui/`) — stateless, styled primitives from shadcn/ui.
4. **Smart Panes** (`/components/panes/`) — the three columns, connecting data hooks and the graph store to the UI.

> Full module breakdown, data flow diagrams, and sync strategy are detailed in [Architecture & Module Strategy](./architecture.md).

---

## 6. Future Roadmap

### AI Privacy Model

The current deployment is single-user on a private home lab, making cloud LLM API usage an acceptable trade-off. For any future public or multi-user release:

- **Opt-in API Key model** — users bring their own API key; no data leaves the app without explicit consent.
- **Local LLM support** — native integration with [Ollama](https://ollama.ai/) (or similar) for 100% offline, private inference.

### React Native (Android) Port

The tech stack was deliberately chosen to minimize porting friction:

- Tailwind CSS -> NativeWind
- Radix UI primitives -> React Native equivalents
- Zustand + IndexedDB -> Zustand + AsyncStorage/SQLite
- tsdav -> same library (runs in any JS environment)

### Desktop Context Menus

Full right-click context menus (via `@radix-ui/react-context-menu`) will be layered in after the core keyboard navigation and click targets feel natural. Not a v1 priority.

### Recurring Events

v1 uses a manual "Duplicate" button instead of `RRULE` recurrence. Full `RRULE` support (with exception handling, series editing, etc.) is a post-v1 enhancement.

---

## 7. Implementation Roadmap

A phased build plan, ordered by dependency. Each phase produces a working (if incomplete) application that can be tested end-to-end before moving on. AI integration is intentionally last — every phase before it delivers standalone value.

---

### Phase 1: Project Scaffolding & CalDAV Foundation

**Goal:** A running Vite app that can authenticate with Radicale and prove two-way CalDAV communication.

#### 1.1 — Vite + React + Tailwind Bootstrap

- [x] Initialize Vite with the React-TS template.
- [x] Install and configure Tailwind CSS (with `@tailwindcss/typography` for future markdown rendering).
- [x] Install shadcn/ui, run `init`, add foundational primitives: `button`, `input`, `card`, `dialog`, `dropdown-menu`, `checkbox`, `command`, `separator`, `tooltip`.
- [x] Install `lucide-react`.
- [x] Set up path aliases (`@/components`, `@/lib`, `@/hooks`, `@/store`, `@/types`).
- [x] Create the `src/` directory structure from [architecture.md](./architecture.md) (empty placeholder files are fine).
- [x] Verify `npm run dev` serves a blank page with Tailwind working.

#### 1.2 — TypeScript Type Definitions

- [x] Define core entity types in `src/types/entities.ts`: `CalendarInfo`, `Event`, `Task`, `Note`, `Project`, `TaskRef`.
- [x] Define CalDAV response types in `src/types/caldav.ts` (thin wrappers around `tsdav` types).
- [x] Define store state/action interfaces in `src/types/store.ts`.

#### 1.3 — CalDAV Client & Parsers

- [x] Install `tsdav`.
- [x] Implement `lib/caldav/client.ts` — configure the `tsdav` `DAVClient` with Radicale server URL and credentials. Support basic auth via environment variables (or a minimal proxy).
- [x] Implement `lib/caldav/parser.ts` — parse raw `.ics` strings into typed entities (`Event`, `Task`, `Note`, `Project`). Handle standard properties and custom `X-` properties.
- [x] Implement `lib/caldav/serializer.ts` — convert typed entities back into valid `.ics` strings.
- [x] ~~`lib/markdown/subtasks.ts` and `lib/markdown/prerequisites.ts`~~ — replaced by real VTODO hierarchy (see fix-subtask-hierarchy).
- [ ] Write unit tests for parsers and serializers (round-trip: parse -> serialize -> parse should be identity).

#### 1.4 — IndexedDB Cache Layer

- [x] Set up IndexedDB (via `idb` or raw API) with object stores: `calendars`, `events`, `tasks`, `notes`, `projects`, `sync_tokens`.
- [x] Implement read/write helpers: `cacheEntities()`, `getCachedEntities()`, `clearCache()`.
- [x] Store both raw `.ics` and parsed data per entity for faithful round-tripping.

#### 1.5 — Core Data Hook (`useCalDAV`)

- [x] Implement `hooks/useCalDAV.ts`:
  - Fetch all calendars from Radicale.
  - Fetch all entities (events, tasks, journals) per calendar.
  - Write entities (create / update via `PUT`, delete via `DELETE`).
  - Track ETags per entity. Send `If-Match` on updates.
  - Populate IndexedDB on fetch. Read from cache on cold start.
- [x] Implement `hooks/useBootstrap.ts` — check for and create the `system-projects` collection on first launch (`MKCOL` / `MKCALENDAR`).

#### 1.6 — Smoke Test

- [x] Create a temporary debug page that:
  - Connects to a running Radicale instance.
  - Lists all calendars.
  - Lists all events/tasks/notes.
  - Creates a test event and reads it back.
  - Deletes the test event.
- [ ] Confirm round-trip works: Notocal creates an event -> Radicale stores it -> another CalDAV client (e.g., Thunderbird) can see it -> Notocal reads it back.

> **Dev proxy note:** `tsdav`'s service discovery compares hrefs from Radicale's PROPFIND responses against the local URL — hostnames differ through a reverse proxy, causing `urlContains()` to fail. Workaround: skip `tsdav`'s `login()` and manually populate the `account` object (`rootUrl`, `principalUrl`, `homeUrl`) using the known Radicale URL structure (`/<username>/`). Vite proxies `/.well-known/caldav` and `/<username>/*` to the real Radicale server. This is a dev-only concern; Phase 11's Express proxy resolves it cleanly for production.

**Phase 1 exit criteria:** The app connects to Radicale, reads/writes entities, caches them in IndexedDB, and survives a page refresh using the cache.

---

### Phase 2: State Management & Relationship Graph

**Goal:** Zustand stores are wired up, the `RELATED-TO` graph is materialized in memory, and filters/drafts persist across sessions.

#### 2.1 — Graph Store (`useGraphStore`)

- [x] Implement `lib/graph.ts` — pure function that takes arrays of entities and returns adjacency maps (`projectId -> childIds`, `entityId -> projectId`, `unassigned` bucket).
- [x] Implement `store/useGraphStore.ts`:
  - Ingest entities from IndexedDB cache.
  - Expose `events`, `tasks`, `notes`, `projects` maps.
  - Expose derived accessors: `childrenOf(projectId)`, `parentOf(entityId)`, `unassigned`.
  - Provide actions: `mergeEntities()`, `removeEntity()`, `updateEntity()`.

#### 2.2 — UI Store (`useUIStore`)

- [x] Implement `store/useUIStore.ts`:
  - `activeView`: `'projects' | 'calendar' | 'tasks' | 'notes'` (default: `'calendar'`).
  - `selectedEntityId`: `string | null`.
  - `navPinned`: `boolean` (persisted).
  - `notesEditorMode`: `'split' | 'full'` (persisted).
  - Actions: `setView()`, `selectEntity()`, `toggleNavPin()`, `setNotesEditorMode()`.

#### 2.3 — Filter Store (`useFilterStore`)

- [x] Implement `store/useFilterStore.ts`:
  - `enabledCalendars`: `Set<string>` — IDs of calendars currently toggled on (default: all on).
  - `taskFilters`: status, due date range, project, priority, sort order.
  - Fully persisted via Zustand `persist` middleware.
  - Actions: `toggleCalendar()`, `setTaskFilter()`, `resetFilters()`.

#### 2.4 — Draft Store (`useDraftStore`)

- [x] Implement `store/useDraftStore.ts`:
  - `drafts`: `Map<entityUID, draftData>` — in-progress edits.
  - Persisted via Zustand `persist` middleware (localStorage, IndexedDB fallback for large notes).
  - Actions: `saveDraft()`, `getDraft()`, `clearDraft()`.
  - Draft lifecycle: created on first keystroke, cleared on successful CalDAV save, restored on next open if abandoned.

#### 2.5 — Sync Hook (`useSync`)

- [x] Implement `hooks/useSync.ts`:
  - Listen for `visibilitychange` / `focus` events.
  - On tab focus: trigger a WebDAV `sync-collection` report (or full ETag comparison).
  - Delta processing: compare incoming ETags with cached ETags, fetch only changed entities.
  - Update IndexedDB and `useGraphStore` on sync completion.
  - Optional periodic polling fallback (configurable interval, default off).

#### 2.6 — Integration Verification

- [x] Update the debug page to display the graph: list projects with their children.
- [ ] Create a project and a task linked via `RELATED-TO` directly in Radicale (or via the debug page). Verify the graph store resolves the relationship.
- [x] Toggle a calendar filter. Verify entities are filtered from the graph's derived accessors.
- [x] Start editing, refresh the page, confirm the draft survives.

**Phase 2 exit criteria:** All four Zustand stores are functional. The relationship graph correctly resolves `RELATED-TO` links. Filters, drafts, and UI preferences persist across sessions.

---

### Phase 3: App Shell & Navigation

**Goal:** The three-column layout is rendered, view switching works, and the slide-down top nav is functional. No real content yet — just the skeleton.

#### 3.1 — App Shell Layout

- [x] Implement `App.tsx` — three-column flexbox layout with a resizable divider between Columns 2 and 3.
- [x] Implement `components/panes/Sidebar.tsx` — fixed-width Column 1 placeholder.
- [x] Implement `components/panes/MainPane.tsx` — flexible Column 2 with a view router (renders the correct view component based on `useUIStore.activeView`).
- [x] Implement `components/panes/DetailPane.tsx` — flexible Column 3 placeholder (will show "select an item" empty state for now).
- [x] Install a resizable panel library (e.g., `react-resizable-panels`) or implement a custom drag divider.

#### 3.2 — Top Navigation Bar

- [x] Implement `components/TopNav.tsx`:
  - Slide-down behavior: hidden by default, appears on cursor near top edge (CSS transition + mouse event listener).
  - Pin toggle: locks the bar visible (persisted via `useUIStore.navPinned`).
  - View switcher: four buttons wired to `useUIStore.setView()`.
  - Connection status indicator (placeholder — wired to real sync status in Phase 5).

#### 3.3 — Global Keyboard Shortcuts

- [x] Register global keyboard listeners (at the `App` level or via a `useHotkeys` hook):
  - `1` / `2` / `3` / `4` — switch views (disabled when a text input is focused).
  - `Ctrl+K` — open search overlay (placeholder for now).
  - `Escape` — close modals, deselect entity.
- [x] Verify shortcuts don't fire while typing in inputs.

#### 3.4 — Sidebar Content

- [x] Wire `Sidebar.tsx` to `useGraphStore` and `useFilterStore`:
  - Render the list of CalDAV calendars with color swatches and toggle checkboxes.
  - Render a "Global Search" button / input (opens overlay, placeholder action).
  - Render "+ New Project" and "+ New Calendar" buttons (placeholder actions).

**Phase 3 exit criteria:** The app renders a three-column layout. Number keys switch the active view label in Column 2. The sidebar shows real calendar data from Radicale with working toggle checkboxes. The top nav slides down and pins correctly.

---

### Bug Fixes: CalDAV Interoperability & Sync (between Phase 3 → 4)

These issues were discovered during Phase 4 development and testing with real-world CalDAV clients.

- [x] **Fix: New calendars not auto-enabled.** `enabledCalendars` was persisted in localStorage. After the first load, `enabledCalendars.size === 0` was never true again, so calendars added later (Travel, Work) were never auto-enabled. Fixed with `autoEnableCalendars()` that detects and enables missing calendar IDs after every sync.
- [x] **Fix: Entity classification duck-typing.** `fetchAll()` used fragile `'location' in entity` checks to classify parsed entities. Replaced with direct parser calls (`parseEvent` → `parseTask` → `parseNote`), each checking the iCal component type.
- [x] **Fix: VTIMEZONE shadowing event properties.** DAVx5 and other clients embed `VTIMEZONE` blocks containing their own `DTSTART` properties. The `prop()` function searched the entire `.ics` string, matching timezone properties instead of event properties. Fixed by extracting only the target component block (`BEGIN:VEVENT...END:VEVENT`) before parsing properties.
- [x] **Fix: Events with DURATION instead of DTEND dropped.** RFC 5545 allows `DURATION` as an alternative to `DTEND`. Events from clients using `DURATION` were silently dropped because `parseEvent` required `DTEND`. Added `computeDtend(dtstart, duration)` fallback.
- [x] **Fix: visibilitychange listener leak.** The cleanup function removed the wrong reference (`onFocus` instead of the anonymous `visibilitychange` handler). Each re-render leaked a new listener. Fixed by naming both handlers.
- [x] **Fix: Server edits not reflected on sync.** Combination of the above issues. With `replaceEntities` (full replace) and correct parsing, edits from other devices now appear on tab focus.

---

### Phase 4: Calendar View (View [2])

**Goal:** A functional month/week calendar grid displaying real events from Radicale.

Starting with the Calendar view because it's the most visually immediate proof that the CalDAV pipeline works end-to-end.

#### 4.1 — Calendar Grid Components

- [x] Implement `components/calendar/MonthGrid.tsx` — standard month grid. Each date cell shows event chips (title + color from calendar).
- [x] Implement `components/calendar/WeekGrid.tsx` — 7-day view with hourly time slots. Events rendered as positioned, colored blocks.
- [x] Implement `components/calendar/EventBlock.tsx` — the event chip/block used in both grids.
- [x] Implement `components/views/CalendarView.tsx` — view wrapper with a month/week toggle. Fetches events from `useGraphStore`, filtered by `useFilterStore.enabledCalendars`.

#### 4.2 — Event Interactions

- [x] Click an empty time slot (Week view) or date cell (Month view) to open a quick-add modal pre-filled with that date/time.
- [x] Press `C` to open the quick-add modal without a pre-filled time.
- [x] Click an existing event to select it — sets `useUIStore.selectedEntityId`, which triggers Column 3 to show the editor (Phase 6).
- [x] Drag-to-resize events in Week view (adjust `DTEND`).
- [x] Drag-to-move events between time slots / dates (adjust `DTSTART` + `DTEND`).

#### 4.3 — Quick-Add Event Modal

- [x] Implement a lightweight modal (`shadcn/ui` Dialog):
  - Fields: Title, Start, End, Calendar (dropdown), Project (optional dropdown).
  - On submit: serialize to `.ics`, `PUT` to Radicale, update IndexedDB + GraphStore, close modal.
  - Keyboard: `Enter` to submit, `Escape` to cancel.

#### 4.4 — Event Duplication

- [x] "Duplicate" action on events (via a button in the event block or context menu later).
- [x] Clones the event with a new `UID` and `DTSTART`/`DTEND` shifted by the original event's duration (default: +1 week). User can adjust before saving.

**Phase 4 exit criteria:** The Calendar view displays real events from Radicale in month and week grids. Events can be created, duplicated, moved, and resized. Calendar toggle filters in the sidebar hide/show events by calendar.

---

### Phase 5: Tasks View (View [3])

**Goal:** A hierarchical task list with filters, sub-task rendering, and a global Kanban alternative.

#### 5.1 — Task List Components

- [x] Implement `components/views/TasksView.tsx` — list view with grouped tasks (by project, or "Unassigned").
- [x] Render each task row: checkbox (toggle status), title, due date badge, priority indicator, project badge, calendar color dot.
- [x] Render sub-tasks as indented children with their own checkboxes. Sub-tasks are real VTODOs whose `RELATED-TO` points to the parent task's UID.
- [x] Toggling a sub-task checkbox writes the updated `STATUS` to Radicale immediately (the sub-task is a full VTODO).

#### 5.2 — Filter Bar

- [x] Implement a horizontal filter bar at the top of the task list:
  - Status: All / Needs Action / Completed / Cancelled.
  - Due Date: Overdue / Today / This Week / This Month / No Date / Custom Range.
  - Project: dropdown of all projects + "Unassigned".
  - Priority: High / Medium / Low / None.
  - Sort: Due Date / Priority / Project / Date Created.
- [x] Wire filters to `useFilterStore.taskFilters`. Filters are persisted.

#### 5.3 — Global Kanban Toggle

- [x] Implement a view toggle button in the TasksView header: List vs. Kanban.
- [x] Kanban mode reuses `components/kanban/` (built in Phase 7 for Projects, or built here first and shared). Three columns: Upcoming, In Progress, Done. Aggregates all tasks regardless of project.

#### 5.4 — Quick-Add Task

- [x] Inline quick-add input at the top of the task list (or bottom of each group).
- [x] Minimal fields: title, calendar. Creates a `VTODO` with `STATUS:NEEDS-ACTION` and no due date.
- [ ] Optional: press `Tab` after title to expand inline fields for due date and project.

#### 5.5 — Task Deletion

- [x] Delete action on tasks.
- [x] If the task has sub-tasks (real VTODOs linked via `RELATED-TO`), show a confirmation and cascade-delete them.
- [x] If the task is a prerequisite of another task, remove the `RELATED-TO;RELTYPE=DEPENDS-ON` line from the dependent task and update it via CalDAV.

**Phase 5 exit criteria:** Tasks view shows a filterable, sortable hierarchical list. Sub-tasks render inline and toggle independently. Global Kanban alternative works. Tasks can be created, completed, and deleted with proper cascade logic.

---

### Refactor: Subtask Hierarchy (after Phase 6)

Subtasks and prerequisites were originally stored as structured markdown in `VTODO` `DESCRIPTION` fields, making them invisible to other CalDAV clients (DAVx5, Thunderbird, etc.).

- [x] **Refactor: subtasks are now real VTODOs with `RELATED-TO` parent pointers.** A sub-task is a full `VTODO` whose `RELATED-TO` property points to the parent task's UID — identical to how tasks relate to projects. Subtasks are filtered from the top-level task list (`useFilteredTasks`) and rendered inline under their parent.
- [x] **Refactor: prerequisites stored as `RELATED-TO;RELTYPE=DEPENDS-ON`.** Previously parsed from `## Prerequisites` markdown in `DESCRIPTION`. Now stored as a proper iCal property per RFC 5545, fully interoperable with other CalDAV clients.
- [x] **Unified TaskPicker UI.** Both subtasks and prerequisites use the same `TaskPicker` component in `TaskEditor.tsx` — toggle between search-existing and create-new modes with Enter-to-confirm.
- [x] **Cascade delete.** Deleting a task deletes its VTODO subtasks and removes `DEPENDS-ON` references in dependent tasks.
- [x] **Removed `lib/markdown/subtasks.ts` and `lib/markdown/prerequisites.ts`** — no longer needed.

---

### Bug Fixes: tsdav Fetch & Write Semantics (during Phase 5)

These issues were discovered during Phase 5 development and testing with real task data.

- [x] **Fix: tsdav default comp-filter excludes VTODOs and VJOURNALs.** `tsdav`'s `fetchCalendarObjects` defaults to a `comp-filter` requesting only `VEVENT` components. Tasks (VTODO) and notes (VJOURNAL) were never returned by the server during sync, making them invisible after creation. Fixed by passing a custom filter specifying only `VCALENDAR` (no nested component filter), which returns all component types.
- [x] **Fix: createCalendarObject used for updates.** All four put methods used `createCalendarObject`, which sends `If-None-Match: *` (reject if object already exists). Updating an existing task/event/note/project would silently fail. Extracted a shared `putCalendarObject` helper that dispatches to `createCalendarObject` for new objects and `updateCalendarObject` (with `If-Match: etag`) for existing ones.

---

### Phase 6: Detail Pane & Editor Forms (Column 3)

**Goal:** Selecting any entity opens a structured editor form in Column 3, with draft persistence and ETag conflict handling.

#### 6.1 — Detail Pane Modes

- [x] Implement the mode switch in `DetailPane.tsx`:
  - **Default (nothing selected):** show a placeholder/empty state (AI chat placeholder — actual AI comes in Phase 10).
  - **Active (entity selected):** show the editor form. (The vertical split with mini-AI is deferred to Phase 10.)
  - Resolves entity type by checking which store map contains the UID, routes to the correct editor.

#### 6.2 — Event Editor

- [x] Implement `components/editors/EventEditor.tsx`:
  - Fields: Title, Start date/time, End date/time, Location, Description (plain textarea), Calendar (dropdown), Project (optional dropdown).
  - Pre-populate from the selected entity in `useGraphStore`.
  - On change: auto-save draft to `useDraftStore` (debounced).
  - On `Ctrl+S` or save button: serialize, `PUT` to Radicale with `If-Match` ETag, update cache + store, clear draft.

#### 6.3 — Task Editor

- [x] Implement `components/editors/TaskEditor.tsx`:
  - Fields: Title, Due date, Status (toggle/dropdown), Priority, Calendar, Project.
  - **Sub-tasks section:** unified `TaskPicker` — search existing tasks to link, or create new inline. Sub-tasks are real VTODOs with `RELATED-TO` pointing to this task.
  - **Prerequisites section:** same unified `TaskPicker` — search or create. Stored as `RELATED-TO;RELTYPE=DEPENDS-ON:<uid>` per RFC 5545.
  - Same draft + save behavior as Event Editor.

#### 6.4 — Project Editor

- [x] Implement `components/editors/ProjectEditor.tsx`:
  - Fields: Name, Description, Start/End dates, Primary Context (calendar dropdown), Status (`X-PROJECT-STATUS` dropdown), Priority (`X-PROJECT-PRIORITY` number input).
  - Same draft + save behavior.

#### 6.5 — ETag Conflict Handling

- [x] Detect `412 Precondition Failed` responses in `useCalDAV`.
- [x] Surface a conflict banner in Column 3: *"This item was modified externally. Overwrite / Reload."*
- [x] "Overwrite" re-fetches fresh etag from server then retries PUT with correct etag.
- [x] "Reload" fetches the server version, replaces the editor state, and clears the draft.

#### 6.6 — Draft Restoration

- [x] On selecting an entity for editing, check `useDraftStore` for an existing draft.
- [x] If a draft exists, restore it into the editor with a subtle banner: *"You have unsaved changes from [timestamp]. Discard?"*
- [x] "Discard" clears the draft and loads the server version.

#### Additional: Note Editor & View Selection Wiring

- [x] Implement `components/editors/NoteEditor.tsx` (basic: title, content textarea, calendar, project).
- [x] Wire `selectEntity` into `ProjectsView` — clicking projects and child items opens the editor.
- [x] Wire `selectEntity` into `NotesView` — clicking notes opens the editor.
- [x] Shared `useEditorForm<T>` hook encapsulates the full editor lifecycle (draft, save, conflict, Ctrl+S).

**Phase 6 exit criteria:** Clicking any event, task, or project opens a full editor in Column 3. Edits are draft-saved automatically and survive refresh. Saves go through CalDAV with ETag checking. Conflicts are surfaced and resolvable.

---

### Phase 7: Projects View (View [1])

**Goal:** Per-project Kanban boards with the four fixed columns, sorted by priority, with cross-calendar filter awareness.

#### 7.1 — Kanban Components

- [x] Implement `components/kanban/KanbanBoard.tsx` — a single project's Kanban board. Receives the project and its children from the graph store.
- [x] Implement `components/kanban/KanbanColumn.tsx` — one of the four columns (Needs Action, In Process, Completed, Notes). Filters children by status/date logic. Supports drag-and-drop target highlighting and inline quick-add with entity type selector.
- [x] Implement `components/kanban/KanbanCard.tsx` — a draggable card representing an event, task, or note. Shows title, type icon, due date, calendar color.

#### 7.2 — Projects View

- [x] Implement `components/views/ProjectsView.tsx`:
  - Fetch all projects from `useGraphStore`, sorted by `X-PROJECT-PRIORITY`.
  - For each project, render a `KanbanBoard` with its children (from `childrenOf(projectId)`).
  - Apply calendar filters from `useFilterStore` — hide items from disabled calendars.
  - Show a banner per board when items are hidden: *"X items hidden by calendar filters."*
  - Reactive: subscribes to `tasks`, `events`, `notes` maps so boards update immediately on any entity change.

#### 7.3 — Drag-and-Drop

- [x] Drag tasks between Kanban columns to change status (optimistic update, persists to Radicale in background):
  - Task dragged to "Completed" → `STATUS:COMPLETED`.
  - Task dragged to "In Process" → `STATUS:IN-PROCESS`.
  - Task dragged to "Needs Action" → `STATUS:NEEDS-ACTION`.
- [x] Events are not draggable (their column placement is read-only, derived from `DTSTART`/`DTEND`).

#### 7.4 — Inline Quick-Add

- [x] Quick-add input at the bottom of each Kanban column.
- [x] Needs Action / In Process / Completed columns offer a Task/Event type toggle. Notes column creates notes only.
- [x] New tasks get a status matching the target column (`NEEDS-ACTION`, `IN-PROCESS`, or `COMPLETED`). No auto due dates.
- [x] New events get a default 1-hour time slot (9–10 AM) on a date derived from the column.
- [x] All entities linked to the project via `RELATED-TO`. Optimistic store update before CalDAV write.

#### 7.5 — Project Creation & Deletion

- [x] "+ New Project" button in the Projects view header opens a creation modal:
  - Fields: Name, Primary Context (calendar), optional start/end dates.
  - Creates a `VJOURNAL` in the `system-projects` collection. Optimistic store update.
- [x] Delete button on each board header. Deletion dialog with hierarchical prompt:
  - *"Delete all items under this project?"*
  - Yes: cascade delete all children.
  - No: sever `RELATED-TO` links, children become unassigned.

**Notes / deviations from plan:**
- Column names aligned to VTODO RFC 5545 standard: Needs Action, In Process, Completed (instead of Upcoming, In Progress, Done).
- `IN-PROCESS` added to `TaskStatus` type and propagated across filters, editor, and kanban categorization.
- `TaskKanbanView` (Tasks view) also updated to use the new column names and `IN-PROCESS` routing.

**Phase 7 exit criteria:** ✅ Projects view shows per-project Kanban boards. Cards can be dragged between columns. Projects can be created and deleted with proper cascade semantics. Cross-calendar filter indicators work.

---

### Phase 8: Notes View (View [4])

**Goal:** A global notes aggregator with project-based folder navigation and a markdown editor.

#### 8.1 — Notes Navigation

- [x] Implement `components/views/NotesView.tsx`:
  - Left sub-panel: folder list (All Notes, Unassigned, one folder per project).
  - Middle sub-panel: note list for the selected folder (title, date, preview snippet).
  - Right sub-panel (or full-width toggle): markdown editor for the selected note.
- [x] Folder counts: show note count per folder.

#### 8.2 — Markdown Editor

- [x] Integrate a markdown editor component (e.g., `@uiw/react-md-editor`, or a custom textarea with live preview using `react-markdown` + `@tailwindcss/typography`).
- [x] Formatting toolbar: bold, italic, headings, bullet/numbered lists, code blocks, horizontal rule.
- [x] Auto-save drafts to `useDraftStore` on every keystroke (debounced, ~500ms).
- [x] Explicit save to Radicale on `Ctrl+S` or save button.

#### 8.3 — Editor Modes

- [x] **Split mode** (default): folder list + note list + editor all visible in Column 2.
- [x] **Full mode**: editor expands to fill all of Column 2. Toggle via a button or keyboard shortcut. Persisted in `useUIStore.notesEditorMode`.

#### 8.4 — Note Editor in Column 3

- [x] Implement `components/editors/NoteEditor.tsx` for the Column 3 detail pane:
  - Fields: Title (SUMMARY), Project (RELATED-TO dropdown), Calendar assignment.
  - This is the metadata editor. The actual content editing happens in Column 2's markdown editor.
- [x] Selecting a note in the Notes view simultaneously opens its metadata in Column 3 and its content in Column 2.

#### 8.5 — Note CRUD

- [x] Create note: from the Notes view (+ button), or from a Project Kanban's Notes column (Phase 7 quick-add).
- [x] Delete note: straightforward CalDAV `DELETE`.
- [x] Notes created from the Project Kanban automatically have `RELATED-TO` set and appear in the corresponding project folder.

**Phase 8 exit criteria:** Notes view provides folder navigation by project, a searchable note list, and a markdown editor with auto-draft persistence. Notes can be created, edited, and deleted. Split and full editor modes work.

---

### Phase 9: Global Search & Polish

**Goal:** The `Ctrl+K` omnibar works across all entity types. Final UX polish pass before AI integration.

#### 9.1 — Global Search Omnibar

- [ ] Implement `components/SearchOverlay.tsx` using shadcn/ui's `Command` component (cmdk):
  - Full-screen overlay triggered by `Ctrl+K` or clicking the sidebar search button.
  - Searches across all entity types: events, tasks, notes, projects.
  - Search targets: `SUMMARY`, `DESCRIPTION`, `LOCATION`.
  - Results grouped by type, ranked by relevance (simple substring match is fine for v1; fuzzy matching is a nice-to-have).
  - Selecting a result: navigates to the appropriate view and selects the entity (sets `activeView` + `selectedEntityId`).
  - `Escape` or clicking outside closes the overlay.

#### 9.2 — Connection Status Indicator

- [ ] Wire the Top Nav's connection status indicator to real sync state from `useSync`:
  - **Connected** (green dot): last sync succeeded.
  - **Syncing** (animated): sync in progress.
  - **Error** (red dot + tooltip): last sync failed (network error, auth failure, etc.).

#### 9.3 — Keyboard Navigation Polish

- [ ] `↑` / `↓` arrow keys navigate between items in lists (task list, note list, search results).
- [ ] `Enter` opens/selects the highlighted item.
- [ ] `Tab` cycles focus between the three columns.
- [ ] `N` creates a new item contextually (event in Calendar view, task in Tasks view, note in Notes view, project in Projects view).
- [ ] `Delete` / `Backspace` on a selected item triggers deletion (with confirmation).

#### 9.4 — Empty States

- [ ] Design and implement empty states for each view:
  - No projects: *"Create your first project to get started."*
  - No events this month: *"Nothing scheduled. Press C to add an event."*
  - No tasks matching filters: *"No tasks match your filters."*
  - No notes: *"Create a note to capture your thoughts."*

#### 9.5 — Loading & Error States

- [ ] Skeleton loaders while initial CalDAV fetch is in progress (cache miss on first load).
- [ ] Toast notifications for successful saves, deletions, and errors.
- [ ] Graceful offline handling: if Radicale is unreachable, show a persistent banner and operate from cache in read-only mode.

#### 9.6 — Context Menus (Optional)

- [ ] If time permits, add right-click context menus via `@radix-ui/react-context-menu`:
  - On events/tasks/notes: Edit, Delete, Duplicate, Move to Project, Move to Calendar.
  - On projects: Edit, Delete, Change Priority.
  - On calendars (sidebar): Toggle, Edit Color/Name.
- [ ] This is a nice-to-have and can be deferred past v1.

**Phase 9 exit criteria:** Global search finds entities across all types. Keyboard navigation is fluid. Empty/loading/error states are handled. The app feels complete as a standalone productivity tool — before any AI features.

---

### Phase 10: AI Integration

**Goal:** A context-aware AI assistant in Column 3 that understands the user's schedule, tasks, and projects.

#### 10.1 — AI Backend Setup

- [ ] Choose an LLM provider for v1 (cloud API — e.g., Anthropic Claude, OpenAI).
- [ ] Implement a minimal backend proxy (extend the existing auth proxy, or a new Express route) that:
  - Accepts chat messages from the frontend.
  - Injects system context (current view data, selected entity, recent items).
  - Forwards to the LLM API.
  - Streams responses back to the frontend.
- [ ] Store the API key server-side (environment variable). Never expose it to the browser.

#### 10.2 — Chat Panel (Default State)

- [ ] Implement `components/ai/ChatPanel.tsx`:
  - Message history (scrollable).
  - Input box with send button.
  - Streaming response rendering (token-by-token display).
  - Markdown rendering in AI responses.
- [ ] Wire into `DetailPane.tsx` as the default content when no entity is selected.

#### 10.3 — Context Injection

- [ ] The AI chat automatically receives context about the user's current view:
  - **Projects view:** list of visible projects with their item counts and statuses.
  - **Calendar view:** events in the currently visible date range.
  - **Tasks view:** tasks matching the current filter set.
  - **Notes view:** the currently open note's content (if any).
- [ ] When an entity is selected, the AI also receives the full details of that entity.
- [ ] Context is injected as a system message, updated on every view/selection change.

#### 10.4 — Mini-AI Chat (Active State)

- [ ] Implement `components/ai/MiniChat.tsx` — a compressed chat panel for the bottom of the Column 3 vertical split.
- [ ] When an entity is selected for editing, Column 3 splits vertically (resizable drag divider):
  - Top: Editor form (from Phase 6).
  - Bottom: MiniChat with the selected entity as primary context.
- [ ] The AI can answer questions about the specific item being edited (e.g., *"What's blocking this task?"*, *"Suggest a better title"*).

#### 10.5 — AI Actions (Stretch)

- [ ] Allow the AI to propose actions that the user confirms:
  - *"Create a task: [title]"* -> user clicks approve -> task is created via CalDAV.
  - *"Reschedule this event to [date]"* -> user clicks approve -> event is updated.
  - *"Summarize this project's status"* -> generates a summary from child item statuses.
- [ ] Actions appear as interactive cards in the chat, not auto-executed.

#### 10.6 — Local LLM Fallback (Stretch)

- [ ] Add a settings panel for AI configuration:
  - Provider: Cloud API (default) / Ollama (local).
  - API key input (for cloud providers).
  - Ollama endpoint URL (for local).
  - Model selection.
- [ ] Implement Ollama integration: same chat interface, different backend endpoint.

**Phase 10 exit criteria:** Column 3 hosts a working AI chat that understands the current view context. The chat compresses into a mini-panel when editing an entity. Optionally, the AI can propose actionable changes that the user confirms.

---

### Phase 11: Dockerization & Deployment

**Goal:** Package the entire stack (frontend, backend proxy, Radicale) into a single `docker compose up` deployment. The app should be reproducibly deployable to the home lab with persistent data and zero manual setup.

The stack has three services:
- **`radicale`** — CalDAV/CardDAV server; data lives in a named volume.
- **`proxy`** — Node/Express backend: handles auth, proxies CalDAV requests to Radicale, and serves the AI chat endpoint.
- **`frontend`** — Nginx serving the Vite production build.

#### 11.1 — Radicale Container

- [ ] Write `docker/radicale/Dockerfile` based on the official Radicale image (or `python:3-alpine` with `pip install radicale`).
- [ ] Write `docker/radicale/config` — configure Radicale for filesystem storage, basic auth, and binding to `0.0.0.0:5232` (internal only, not exposed to the host).
- [ ] Mount a named Docker volume (`radicale-data`) to the Radicale storage path. This is the only persistent state in the stack.
- [ ] Mount a `docker/radicale/users` htpasswd file (populated via `.env` or a setup script) for basic auth credentials.

#### 11.2 — Backend Proxy Container

- [ ] Write `proxy/Dockerfile` — multi-stage: `node:lts-alpine` build stage to install deps, then a minimal runtime image.
- [ ] The proxy reads `RADICALE_URL`, `RADICALE_USER`, `RADICALE_PASS`, and `LLM_API_KEY` from environment variables. No credentials hardcoded.
- [ ] Expose only the proxy port (e.g., `3001`) to the Nginx container via the internal Docker network. Do not expose it to the host directly.

#### 11.3 — Frontend Container

- [ ] Write `Dockerfile` at the project root — multi-stage:
  1. `node:lts-alpine` build stage: `npm ci && npm run build` to produce `dist/`.
  2. `nginx:alpine` runtime stage: copy `dist/` into `/usr/share/nginx/html`.
- [ ] Write `docker/nginx/default.conf`:
  - Serve static assets from `/usr/share/nginx/html`.
  - Proxy `/api/` requests to the `proxy` service (e.g., `http://proxy:3001`).
  - Set cache headers for hashed assets (`/assets/*`); no-cache for `index.html`.
- [ ] Expose port `80` to the host (or `8080` if running rootless). Tailscale ACLs handle external access.

#### 11.4 — Docker Compose

- [ ] Write `compose.yaml` at the project root:
  - Services: `radicale`, `proxy`, `frontend`.
  - Internal network (`notocal-net`) connecting all three services; only `frontend:80` published to the host.
  - Named volume `radicale-data` for Radicale's storage directory.
  - `depends_on` ordering: `proxy` depends on `radicale`; `frontend` depends on `proxy`.
  - `restart: unless-stopped` on all services.
- [ ] Write `.env.example` with all required variables and explanatory comments: `RADICALE_USER`, `RADICALE_PASS`, `LLM_API_KEY`, `LLM_PROVIDER`, `VITE_PROXY_BASE_URL`.
- [ ] Add `.env` to `.gitignore`.

#### 11.5 — Development Compose Override

- [ ] Write `compose.override.yaml` for the local dev workflow:
  - Replaces the `frontend` service with a bind-mounted Vite dev server (`npm run dev`) for HMR.
  - Replaces the `proxy` service with a bind-mounted Node process (`npm run dev`) for hot-reload.
  - Keeps the production `radicale` service unchanged — dev and prod share the same Radicale setup.
- [ ] Document the two workflows in `README.md` (or an inline comment in `compose.yaml`): `docker compose up` for production, `docker compose up` (with override auto-applied) for dev.

#### 11.6 — Health Checks & Smoke Test

- [ ] Add Docker `HEALTHCHECK` directives:
  - `radicale`: `curl -f http://localhost:5232/.well-known/caldav` (or a simple TCP check).
  - `proxy`: `curl -f http://localhost:3001/health` (add a `/health` route to the Express app).
  - `frontend`: `curl -f http://localhost/` .
- [ ] Verify `docker compose up --build` from a clean state reaches healthy status on all three services.
- [ ] Confirm the full round-trip: browser -> Nginx -> proxy -> Radicale -> back.
- [ ] Confirm Radicale data persists across `docker compose down && docker compose up` (volume survives).

**Phase 11 exit criteria:** `docker compose up --build` produces a fully functional deployment. All credentials come from `.env`. Radicale data persists across restarts. The dev compose override provides HMR for frontend and proxy code. The app is accessible via Tailscale on the home lab.
