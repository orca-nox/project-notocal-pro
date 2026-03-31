# UI/UX Layout Specification

This document defines the multi-pane desktop layout, per-view behavior, keyboard shortcuts, and interaction patterns for Notocal Pro.

---

## Table of Contents

1. [Layout Overview](#1-layout-overview)
2. [Top Navigation Bar](#2-top-navigation-bar)
3. [Column 1: Global Sidebar](#3-column-1-global-sidebar)
4. [Column 2: Main Context Pane](#4-column-2-main-context-pane)
5. [Column 3: AI & Detail Pane](#5-column-3-ai--detail-pane)
6. [Keyboard Shortcuts](#6-keyboard-shortcuts)
7. [Draft Management](#7-draft-management)
8. [Responsive Behavior](#8-responsive-behavior)

---

## 1. Layout Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                    Top Navigation (Slide-Down)                    │
│   [1] Projects   [2] Calendar   [3] Tasks   [4] Notes   [Pin]   │
├────────────┬──────────────────────────────┬───────────────────────┤
│  Column 1  │         Column 2             │       Column 3        │
│  Sidebar   │     Main Context Pane        │   AI & Detail Pane    │
│            │                              │                       │
│  200-250px │      Flexible (largest)      │   Flexible (right)    │
│   Fixed    │                              │                       │
└────────────┴──────────────────────────────┴───────────────────────┘
```

The application is a **three-column layout** with a collapsible top navigation bar. All three columns are always visible on desktop. Column 2 is the primary workspace and takes the majority of horizontal space.

---

## 2. Top Navigation Bar

### Visibility

- **Hidden by default.** The bar is not visible on page load.
- **Trigger:** Slides down smoothly when the user's cursor reaches the **top edge** of the viewport.
- **Pin toggle:** A pin/unpin button in the bar locks it as a **permanent, always-visible top bar**. The pinned state persists across sessions (stored in Zustand/localStorage).
- When unpinned, the bar slides back up after the cursor moves away from the top region.

### Contents

| Element | Description |
|---|---|
| **View switcher** | Four labeled buttons: `[1] Projects`, `[2] Calendar`, `[3] Tasks`, `[4] Notes`. The active view is visually highlighted. Clicking or pressing the corresponding number key switches the view. |
| **Pin toggle** | Locks/unlocks the nav bar's visibility. |
| **Connection status** | Small indicator showing CalDAV sync status (connected / syncing / error). |

### Keyboard Integration

The number keys `1`, `2`, `3`, `4` switch views **globally**, regardless of whether the nav bar is visible. The nav bar is purely a visual affordance — the keyboard shortcuts are the primary interaction path.

---

## 3. Column 1: Global Sidebar

**Width:** 200-250px, fixed.

The sidebar is a **static, always-visible** navigation column that anchors the application. Its contents rarely change regardless of the active view.

### Sections

#### Global Search (`Ctrl+K`)

- A search input / button at the top of the sidebar.
- Clicking it (or pressing `Ctrl+K` anywhere) opens a **full-screen omnibar overlay** (command palette style).
- Searches across **all entity types**: Events, Tasks, Notes, and Projects.
- Results are grouped by type, with the most relevant matches surfaced first.
- Selecting a result navigates to the appropriate view and selects the item.

#### Calendar Toggles

- A list of all CalDAV calendars fetched from Radicale.
- Each calendar has a **checkbox** and a **color swatch**.
- Toggling a calendar on/off **globally filters** every view in the application:
  - Projects Kanban hides/shows items from that calendar (with a "hidden items" indicator).
  - Calendar grid hides/shows events from that calendar.
  - Task list hides/shows tasks from that calendar.
  - Notes list hides/shows notes from that calendar.
- Calendars are displayed in a **user-defined strict hierarchy** (e.g., Work > Travel > Personal). The ordering is persistent.

#### Quick Actions (Below Calendars)

- **"+ New Project"** button — opens the project creation flow.
- **"+ New Calendar"** button — creates a new CalDAV collection on Radicale.

---

## 4. Column 2: Main Context Pane

**Width:** Flexible, takes the remaining space between Columns 1 and 3. This is the **largest workspace**.

Column 2's content is driven entirely by the active **Main View** (1-4). Each view is described below.

---

### View [1]: Projects

Displays a **vertically stacked set of Kanban boards**, one per project, filtered by the active calendar toggles.

#### Kanban Board Structure

Each project renders as a horizontal Kanban board with **four fixed columns**:

| Column | Contents |
|---|---|
| **Upcoming** | Tasks with `STATUS:NEEDS-ACTION` and a future `DUE` date, plus future Events. |
| **In Progress** | Tasks with `STATUS:NEEDS-ACTION` and a past or today `DUE` date (overdue / active). |
| **Done** | Tasks with `STATUS:COMPLETED` and past Events. |
| **Notes** | All `VJOURNAL` notes linked to this project. |

#### Sorting & Filtering

- Projects are sorted by `X-PROJECT-PRIORITY` (lower value = higher on the page).
- Within each Kanban column, items are sorted by date (earliest first).
- **Cross-calendar filtering:** When global calendar toggles hide items that belong to a project, the board displays a prominent banner: *"X items hidden by calendar filters"*. This prevents confusion when a project appears unexpectedly empty.

#### Interactions

- **Drag-and-drop** cards between Kanban columns to change status.
- **Click** a card to select it for editing in Column 3.
- **Inline quick-add** at the bottom of each column to create a new item.

---

### View [2]: Calendar

Displays a traditional **calendar grid** with month and week views.

#### View Modes

| Mode | Description |
|---|---|
| **Month** | Standard month grid. Events appear as colored bars/chips on their date cells. |
| **Week** | 7-day horizontal view with hourly time slots. Events are rendered as positioned blocks. |

#### Interactions

- **Toggle** between Month and Week via a button or keyboard shortcut.
- **Click** an empty time slot to create a new event at that time.
- **Press `C`** to open a **lightweight quick-add modal** for creating an event without clicking a specific slot.
- **Click** an existing event to select it for editing in Column 3.
- **Drag** event edges to resize (change duration) in Week view.
- **Drag** events to different time slots or dates to reschedule.

---

### View [3]: Tasks

Displays a **hierarchical task list** with robust filtering, or alternatively a **Global Kanban** board.

#### Default: Hierarchical List

- Tasks are displayed in a flat/nested list, grouped by project (or "Unassigned" for project-less tasks).
- Sub-tasks (parsed from `DESCRIPTION`) are rendered as indented children.
- Each task row shows: checkbox, title, due date, priority indicator, project badge, calendar color.

#### Filter Bar

A horizontal filter bar at the top of the list with:

| Filter | Options |
|---|---|
| **Status** | All, Needs Action, Completed, Cancelled |
| **Due Date** | Overdue, Today, This Week, This Month, No Date, Custom Range |
| **Project** | Dropdown of all projects + "Unassigned" |
| **Priority** | High, Medium, Low, None |
| **Sort** | Due Date, Priority, Project, Date Created |

#### Alternative: Global Kanban

A **view toggle** button switches the Task view between the hierarchical list and a **Global Kanban** board. The Global Kanban aggregates **all tasks** regardless of project into the same Upcoming / In Progress / Done columns used in the Projects view. This provides a project-agnostic "what's on my plate" overview.

#### Interactions

- **Click** a checkbox to toggle `STATUS` between `NEEDS-ACTION` and `COMPLETED`.
- **Click** a task row to select it for editing in Column 3.
- **Inline quick-add** at the top or bottom of the list.

---

### View [4]: Notes

Acts as a **global aggregator** for all notes across all calendars and projects.

#### Navigation

The left portion of Column 2 displays a **folder/category sidebar** (within the column, not Column 1):

| Folder | Contents |
|---|---|
| **All Notes** | Every `VJOURNAL` note, regardless of project. |
| **Unassigned** | Notes not linked to any project. |
| **[Project Name]** | Notes linked to that project (one folder per project). |

This ensures notes created within a Project's Kanban board (View [1]) are always accessible and browsable from the Notes view.

#### Editor Behavior

When a note is selected, the Notes view has **two modes**:

1. **Split mode:** The folder list stays visible on the left, the note list in the middle, and the selected note's content on the right (still within Column 2). Column 3 shows the AI assistant.
2. **Full mode:** The markdown editor expands to take over the entire Column 2 area, maximizing writing space. The folder list is temporarily hidden. Toggle via a button or shortcut.

#### Markdown Editor

- Rich markdown editing with live preview (or WYSIWYG-style editing).
- Standard formatting toolbar (bold, italic, headings, lists, code blocks).
- **Auto-save** drafts to Zustand/localStorage on every keystroke (debounced).
- Save to Radicale on explicit save action (`Ctrl+S`) or on blur/view switch.

---

## 5. Column 3: AI & Detail Pane

**Width:** Flexible, right-aligned. Can be resized by dragging the divider between Columns 2 and 3.

Column 3 is **context-sensitive** and operates in two modes:

### Default State: AI Assistant

When **no item is selected** for editing, Column 3 displays the **AI chat interface**:

- A conversational chat panel with message history.
- The AI has **full context** of the currently active view:
  - In Projects view: awareness of all visible projects and their items.
  - In Calendar view: awareness of the current date range and visible events.
  - In Tasks view: awareness of the current filter set and visible tasks.
  - In Notes view: awareness of the currently open note (if any).
- Users can ask the AI to:
  - Summarize their schedule.
  - Suggest task prioritization.
  - Draft note content.
  - Identify scheduling conflicts.
  - Provide context from related items.

### Active State: Editor + Mini-AI

When a user **explicitly selects an item** for deep editing (clicks an event, task, or project card), Column 3 **splits vertically** with a **user-resizable drag divider**:

```
┌─────────────────────┐
│                     │
│   Editor Form       │
│   (Top section)     │
│                     │
├─ ─ drag divider ─ ─ ┤
│                     │
│   Mini-AI Chat      │
│   (Bottom section)  │
│                     │
└─────────────────────┘
```

#### Editor Form (Top)

A structured form for editing the selected entity's properties:

**For Events:**
- Title (SUMMARY)
- Start date/time (DTSTART)
- End date/time (DTEND)
- Location (LOCATION)
- Description (DESCRIPTION) — plain text area
- Project link (RELATED-TO) — dropdown selector
- Calendar assignment — dropdown of available calendars

**For Tasks:**
- Title (SUMMARY)
- Due date (DUE)
- Status (STATUS) — toggle/dropdown
- Priority (PRIORITY) — selector
- Sub-tasks — dedicated checkbox list UI (serialized to DESCRIPTION markdown)
- Prerequisites — linked task picker (serialized to DESCRIPTION markdown)
- Project link (RELATED-TO) — dropdown selector
- Calendar assignment — dropdown

**For Projects:**
- Name (SUMMARY)
- Description (DESCRIPTION)
- Start/End dates (DTSTART/DTEND)
- Primary Context / Calendar (CATEGORIES)
- Status (X-PROJECT-STATUS) — dropdown
- Priority (X-PROJECT-PRIORITY) — number input

#### Mini-AI Chat (Bottom)

A compressed version of the AI chat, maintaining conversation context. The AI is now aware of the **specific item being edited** and can provide targeted assistance (e.g., "suggest a better title," "what's blocking this task?").

### Conflict Resolution UI

When a CalDAV ETag conflict is detected during save, Column 3 surfaces a **conflict banner** above the editor form:

> **Conflict detected:** This item was modified externally since you opened it.
> `[Overwrite with my changes]` `[Reload server version]`

---

## 6. Keyboard Shortcuts

### Global (Always Active)

| Shortcut | Action |
|---|---|
| `1` | Switch to Projects view |
| `2` | Switch to Calendar view |
| `3` | Switch to Tasks view |
| `4` | Switch to Notes view |
| `Ctrl+K` | Open global search omnibar |
| `Escape` | Close modal / deselect item / close search |

### Context-Sensitive

| Shortcut | Context | Action |
|---|---|---|
| `C` | Calendar view | Open quick-add event modal |
| `N` | Any view | Create new item (type depends on active view) |
| `Delete` / `Backspace` | Item selected | Delete selected item (with confirmation) |
| `Ctrl+S` | Editor active | Save current edits to Radicale |
| `Ctrl+Z` | Editor active | Undo last edit |
| `Ctrl+Shift+Z` | Editor active | Redo |

### Navigation

| Shortcut | Action |
|---|---|
| `↑` / `↓` | Navigate between items in a list |
| `Enter` | Open/select highlighted item for editing |
| `Tab` | Move focus between panes (Col 1 -> Col 2 -> Col 3) |

> **Note:** Number key shortcuts (`1-4`) are **disabled** when a text input is focused, to prevent accidental view switches while typing.

---

## 7. Draft Management

Notocal Pro aggressively preserves unsaved work using **Zustand's `persist` middleware** backed by `localStorage` (with IndexedDB fallback for larger payloads).

### What's Persisted

- Any text the user has typed in an editor form (Column 3) that hasn't been saved to Radicale yet.
- The current state of in-progress item creation modals.
- The content of the markdown note editor.

### Survival Scenarios

Drafts survive all of the following:

| Scenario | Draft preserved? |
|---|---|
| Browser refresh (`F5`) | Yes |
| Browser crash | Yes |
| Tab close + reopen | Yes |
| Rapid view switching (1-2-3-4) | Yes |
| Network disconnection | Yes (saved locally, synced when reconnected) |

### Draft Lifecycle

1. User starts editing an item -> draft created in Zustand store (auto-persisted).
2. User saves (`Ctrl+S` or explicit save) -> draft is written to Radicale via CalDAV, then **cleared** from the draft store.
3. User abandons edit (navigates away without saving) -> draft **remains** in the store. Next time the user opens that item, the draft is restored with a subtle indicator: *"You have unsaved changes from [timestamp]."*

---

## 8. Responsive Behavior

While Notocal Pro is **desktop-first**, the layout should degrade gracefully on smaller viewports for future portability:

| Viewport | Behavior |
|---|---|
| **>= 1200px** | Full three-column layout (default). |
| **900-1199px** | Column 1 collapses to icons-only (tooltips on hover). Column 3 becomes an overlay panel instead of a fixed column. |
| **< 900px** | Single-column mode. Navigation via bottom tab bar. Column 3 is a full-screen modal. (Primarily for future React Native considerations.) |

These breakpoints are rough guidelines for future implementation, not a v1 requirement.
