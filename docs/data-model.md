# Data Model & CalDAV Mapping

This document defines how Notocal Pro's four core entities — Events, Tasks, Notes, and Projects — map onto standard iCalendar (RFC 5545) components stored in Radicale. Strict adherence to CalDAV standards ensures interoperability with any compliant client.

---

## Table of Contents

1. [Guiding Principles](#1-guiding-principles)
2. [Calendars (Areas of Responsibility)](#2-calendars-areas-of-responsibility)
3. [Projects](#3-projects)
4. [Events (VEVENT)](#4-events-vevent)
5. [Tasks (VTODO)](#5-tasks-vtodo)
6. [Notes (VJOURNAL)](#6-notes-vjournal)
7. [The Relationship Graph](#7-the-relationship-graph)
8. [Deletion & Hierarchy Logic](#8-deletion--hierarchy-logic)
9. [Conflict Resolution](#9-conflict-resolution)

---

## 1. Guiding Principles

- **Standard properties first.** Use RFC 5545 properties wherever possible. Custom `X-` properties are reserved for features that have no standard equivalent.
- **Plain-text portability.** Every entity must remain a valid `.ics` file readable by any CalDAV client (Thunderbird, DAVx5, Apple Calendar, etc.). Notocal-specific features degrade gracefully in other clients.
- **Smart parsing over custom schemas.** Advanced features (sub-tasks, prerequisites) are encoded within standard fields using structured conventions (e.g., markdown checklists in `DESCRIPTION`) rather than inventing new component types.

---

## 2. Calendars (Areas of Responsibility)

Calendars are standard CalDAV collections. They serve as the **top-level organizational containers** and "Areas of Responsibility" in the GTD sense.

| Example Calendars | Purpose |
|---|---|
| `Work` | Professional obligations |
| `Personal` | Personal life |
| `Travel` | Trip planning |

### Behavior

- Calendars appear in the **Global Sidebar** (Column 1) as toggleable checkboxes.
- Toggling a calendar on/off **globally filters** all views — the Projects Kanban, Calendar grid, Task list, and Notes list all respect the active filter set.
- Calendars are arranged in a **user-defined strict hierarchy** (e.g., Work > Travel > Personal) for consistent display ordering.

### What Calendars Contain

Events, Tasks, and Notes are stored inside standard CalDAV calendars. A single calendar can contain all three component types simultaneously.

Projects are the exception — they live in a dedicated hidden collection (see below).

---

## 3. Projects

A **Project** is a cross-cutting grouping entity that can span items across multiple calendars. For example, a "Website Redesign" project might contain Work tasks, Personal notes, and Travel events.

### Storage

| Property | Value |
|---|---|
| **iCalendar Component** | `VJOURNAL` |
| **Collection** | `/user/system-projects/` (hidden, dedicated Radicale collection) |

Projects are stored as `VJOURNAL` entities in a **dedicated, hidden-by-default** Radicale collection. This separation ensures projects don't pollute the user's regular calendars and remain invisible to external CalDAV clients that don't know to look for them.

### First-Launch Bootstrapping

On initial login, the app sends a WebDAV `MKCOL` / `MKCALENDAR` request to ensure the `system-projects` collection exists. This prevents 404 errors on fresh Radicale environments and makes onboarding seamless.

### Schema

```ics
BEGIN:VCALENDAR
BEGIN:VJOURNAL
UID:proj-website-redesign-uuid
DTSTAMP:20260315T120000Z
SUMMARY:Website Redesign
DESCRIPTION:Complete overhaul of the company marketing site.
DTSTART;VALUE=DATE:20260401
DTEND;VALUE=DATE:20260630
CATEGORIES:Work
X-PROJECT-STATUS:Active
X-PROJECT-PRIORITY:1
END:VJOURNAL
END:VCALENDAR
```

### Standard Properties

| Property | Required | Description |
|---|---|---|
| `UID` | Yes | Unique identifier. All child items reference this via `RELATED-TO`. |
| `DTSTAMP` | Yes | Creation/modification timestamp. |
| `SUMMARY` | Yes | Project name/title. |
| `DESCRIPTION` | No | Freeform project description. |
| `DTSTART` | No | Optional project start date. |
| `DTEND` | No | Optional project deadline/end date. |
| `CATEGORIES` | Yes | **Primary Context** — the calendar name (e.g., `Work`) this project is associated with. Ensures the project responds to global calendar filters even when it has no children. |

### Custom Properties

| Property | Type | Values | Description |
|---|---|---|---|
| `X-PROJECT-STATUS` | String | `Active`, `Scheduled`, `Done`, `Cancelled` | Overall project state. **Dynamically derived** from the aggregate status of child items by default, but supports manual override for edge cases (e.g., marking a project "Done" even if one stale task remains open). |
| `X-PROJECT-PRIORITY` | Integer | `1`, `2`, `3`, ... | Sorting weight. Lower = higher priority. Used exclusively for display ordering in the Projects view. |

### Empty Project Handling

When a project is first created, it must be assigned a **Primary Context** (`CATEGORIES`) to bind it to a calendar. This ensures:
- The project appears correctly when calendar filters are applied.
- It doesn't become an "orphan" invisible to all views.

---

## 4. Events (`VEVENT`)

Standard calendar events with optional project linkage.

### Schema

```ics
BEGIN:VCALENDAR
BEGIN:VEVENT
UID:evt-team-standup-uuid
DTSTAMP:20260315T120000Z
DTSTART:20260401T090000Z
DTEND:20260401T093000Z
SUMMARY:Team Standup
DESCRIPTION:Daily sync with the engineering team.
LOCATION:Conference Room B
RELATED-TO:proj-website-redesign-uuid
END:VEVENT
END:VCALENDAR
```

### Properties

| Property | Required | Description |
|---|---|---|
| `UID` | Yes | Unique identifier. |
| `DTSTAMP` | Yes | Creation/modification timestamp. |
| `DTSTART` | Yes | Event start time. |
| `DTEND` | Yes* | Event end time. *See DURATION fallback below.* |
| `DURATION` | No | Alternative to `DTEND`. If `DTEND` is absent, the parser computes it from `DTSTART + DURATION`. |
| `SUMMARY` | Yes | Event title. |
| `DESCRIPTION` | No | Freeform event details. |
| `LOCATION` | No | Event location. |
| `RELATED-TO` | No | UID of the parent Project (if any). |

### DURATION Fallback

RFC 5545 allows events to specify either `DTEND` or `DURATION` (but not both). Some CalDAV clients (notably Google Calendar exports) use `DURATION` instead of `DTEND`. Notocal Pro's parser handles this transparently:

1. If `DTEND` is present, it is used directly.
2. If `DTEND` is absent and `DURATION` is present (e.g., `DURATION:PT1H30M`), the parser computes `DTEND = DTSTART + DURATION`.
3. If neither is present, the event is unparseable and skipped.

Supported `DURATION` formats: `PnW` (weeks), `PnD` (days), `PTnH` (hours), `PTnM` (minutes), `PTnS` (seconds), and combinations (e.g., `P1DT2H30M`).

### VTIMEZONE Handling

Many CalDAV clients (DAVx5, Thunderbird, etc.) embed `VTIMEZONE` blocks in `.ics` files before the `VEVENT` component. These timezone definitions contain their own `DTSTART` properties (for `STANDARD`/`DAYLIGHT` transition rules) which are **not** event properties:

```ics
BEGIN:VCALENDAR
BEGIN:VTIMEZONE
TZID:Asia/Manila
BEGIN:STANDARD
DTSTART:19700101T000000        ← This is NOT the event's start time
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
DTSTART;TZID=Asia/Manila:20260407T100000   ← This IS the event's start time
...
END:VEVENT
END:VCALENDAR
```

The parser extracts only the `BEGIN:VEVENT...END:VEVENT` (or `VTODO`/`VJOURNAL`) block before reading properties, ensuring timezone-related properties are never confused with entity properties.

### Recurrence (v1 Simplification)

v1 does **not** implement `RRULE` recurring events. Instead, the UI provides a **"Duplicate" button** that clones an event with a new UID and adjusted dates. This avoids the substantial complexity of recurrence rule parsing, exception handling, and series-vs-instance editing.

Full `RRULE` support is deferred to a future version.

---

## 5. Tasks (`VTODO`)

Tasks support a deadline, status tracking, sub-tasks, and prerequisites — all within the CalDAV standard.

### Schema

```ics
BEGIN:VCALENDAR
BEGIN:VTODO
UID:task-design-mockups-uuid
DTSTAMP:20260315T120000Z
SUMMARY:Create design mockups
DUE:20260410T170000Z
STATUS:NEEDS-ACTION
PRIORITY:2
RELATED-TO:proj-website-redesign-uuid
DESCRIPTION:## Sub-tasks\n- [x] Homepage layout\n- [ ] About page layout\n- [ ] Contact form\n\n## Prerequisites\n- [prereq:task-gather-requirements-uuid] Gather requirements
END:VTODO
END:VCALENDAR
```

### Properties

| Property | Required | Description |
|---|---|---|
| `UID` | Yes | Unique identifier. |
| `DTSTAMP` | Yes | Creation/modification timestamp. |
| `SUMMARY` | Yes | Task title. |
| `DUE` | No | Task deadline. |
| `STATUS` | Yes | One of: `NEEDS-ACTION`, `COMPLETED`, `CANCELLED`. |
| `PRIORITY` | No | Standard iCal priority (1-9, where 1 = highest). |
| `RELATED-TO` | No | UID of the parent Project (if any). |
| `DESCRIPTION` | No | Structured content (see below). |

### Sub-tasks & Prerequisites (UI-Masked Markdown)

Sub-tasks and prerequisites are stored **entirely within the `DESCRIPTION` field** as structured markdown. This keeps the data portable (other CalDAV clients see readable text) while allowing Notocal Pro to parse and render rich UI.

#### Encoding Format

```markdown
## Sub-tasks
- [x] Completed sub-task
- [ ] Pending sub-task

## Prerequisites
- [prereq:<UID>] Prerequisite task title
```

#### UX Contract

- The user **never sees or edits raw markdown.** The UI renders dedicated React input components (checkboxes for sub-tasks, linked task pickers for prerequisites).
- On save, Notocal Pro **serializes the structured data back** into the markdown format within `DESCRIPTION`.
- Any freeform text the user writes in the task description is preserved in a separate `## Notes` section.

#### Graceful Degradation

Other CalDAV clients will display the `DESCRIPTION` as plain text, showing readable markdown. The checkbox syntax (`- [x]`, `- [ ]`) is widely recognized even without rendering.

---

## 6. Notes (`VJOURNAL`)

Notes are `VJOURNAL` entities used for freeform markdown content, designed to function similarly to the default Apple Notes app.

### Schema

```ics
BEGIN:VCALENDAR
BEGIN:VJOURNAL
UID:note-meeting-minutes-uuid
DTSTAMP:20260315T120000Z
SUMMARY:Sprint Retro Minutes
DESCRIPTION:## What went well\n- Shipped feature X on time\n\n## Action items\n- Follow up with design team
RELATED-TO:proj-website-redesign-uuid
END:VJOURNAL
END:VCALENDAR
```

### Properties

| Property | Required | Description |
|---|---|---|
| `UID` | Yes | Unique identifier. |
| `DTSTAMP` | Yes | Creation/modification timestamp. |
| `SUMMARY` | Yes | Note title. |
| `DESCRIPTION` | No | Markdown content body. |
| `RELATED-TO` | No | UID of the parent Project (if any). |

### Intentional Omissions

- **No image attachments.** Notes are strictly plain text / markdown. This maintains the pure-text simplicity of the `.ics` backend and avoids the complexity of binary attachment storage in CalDAV.

### Notes vs. Projects (Both `VJOURNAL`)

Both Notes and Projects use `VJOURNAL`, but they are distinguished by:

| Criterion | Note | Project |
|---|---|---|
| **Collection** | User's regular calendars | `system-projects` hidden collection |
| **Custom properties** | None | `X-PROJECT-STATUS`, `X-PROJECT-PRIORITY` |
| **Role** | Leaf content entity | Grouping/organizational entity |

The app disambiguates based on which collection the `VJOURNAL` resides in.

---

## 7. The Relationship Graph

### How Relationships Work

Any Event, Task, or Note can belong to a Project by including a `RELATED-TO` property pointing to the Project's `UID`:

```ics
RELATED-TO:proj-website-redesign-uuid
```

This is a standard iCalendar property (RFC 5545 Section 3.8.4.5), ensuring full interoperability.

### Graph Construction

1. On app load, the CalDAV client fetches all entities from Radicale (or loads them from the IndexedDB cache).
2. The **Graph Store** (`useGraphStore`) iterates over all entities and builds an in-memory adjacency map:
   - `projectId -> [eventIds, taskIds, noteIds]` (children lookup)
   - `entityId -> projectId` (parent lookup)
3. This graph is recalculated on every sync cycle.

### Cross-Calendar Nature

A Project's children can live in **different calendars**. For example:

- Project "Conference Talk" might have:
  - A `VEVENT` in the `Work` calendar (the talk itself)
  - A `VTODO` in the `Personal` calendar (buy travel snacks)
  - A `VJOURNAL` in the `Work` calendar (speaker notes)

When calendar filters hide certain calendars, the Project Kanban board displays a prominent indicator: **"X items hidden by calendar filters"** to prevent confusion.

---

## 8. Deletion & Hierarchy Logic

Deletion is **hierarchical, not lateral.** Deleting a container prompts about its children; deleting a leaf never affects siblings or parents.

### Project Deletion

1. User initiates project deletion.
2. **Prompt:** *"Delete all events, tasks, and notes under this project?"* (Default: **No**)
3. If **Yes:** All child entities (events, tasks, notes with `RELATED-TO` pointing to this project) are deleted via CalDAV `DELETE` requests.
4. If **No:** Each child entity's `RELATED-TO` property is **removed** (via CalDAV `PUT` update), severing the link. The children remain in their respective calendars, now belonging to no project (the "Unassigned" bucket).
5. The project `VJOURNAL` is deleted from `system-projects`.

### Task Deletion

1. If the task has **sub-tasks** (encoded in `DESCRIPTION`), the UI prompts: *"This task has sub-tasks. Delete them as well?"*
2. Sub-tasks are inline (part of `DESCRIPTION`), so deleting the parent task inherently deletes them. The prompt is informational.
3. If the task is a **prerequisite** of another task, deleting it removes the prerequisite link from the dependent task's `DESCRIPTION` (the `[prereq:<UID>]` line is stripped).

### Prerequisite Deletion

Removing a prerequisite relationship only **removes the relational link** (`[prereq:<UID>]` line in the dependent task's `DESCRIPTION`). It does **not** delete the target task itself.

### Event / Note Deletion

Straightforward `DELETE` via CalDAV. If the entity had a `RELATED-TO` link to a project, the project's child count decreases but no further action is needed.

---

## 9. Conflict Resolution

Notocal Pro uses **ETag-based optimistic concurrency** (standard CalDAV behavior):

1. When fetching an entity, the client stores its `ETag`.
2. On save, the client sends the `ETag` in an `If-Match` header.
3. If the server's `ETag` has changed (another client modified the entity), the `PUT` request fails with `412 Precondition Failed`.
4. Notocal Pro surfaces a **conflict prompt** in Column 3 (the Detail Pane): *"This item was modified externally. Overwrite with your changes?"*
5. The user can choose to overwrite (force `PUT`) or reload the server version.

This is a **Last-Write-Wins** model with user confirmation — simple, transparent, and appropriate for a single-user deployment.
