# CalDAV Client Interoperability

This document tracks how different CalDAV clients generate `.ics` files and what Notocal Pro does to handle the variations. Understanding these differences is critical for reliable multi-device sync.

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [Client-Specific Behaviors](#2-client-specific-behaviors)
3. [Parser Strategy](#3-parser-strategy)
4. [Known Issues & Workarounds](#4-known-issues--workarounds)
5. [Testing Checklist](#5-testing-checklist)

---

## 1. The Problem

RFC 5545 (iCalendar) is a flexible standard. Clients have significant latitude in how they encode events, tasks, and journals. Two valid `.ics` files representing the same event can look very different:

```ics
# Apple Calendar style (minimal, no timezone block)
BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260407T100000Z
DTEND:20260407T110000Z
SUMMARY:Meeting
END:VEVENT
END:VCALENDAR

# DAVx5/Android style (VTIMEZONE block, TZID references)
BEGIN:VCALENDAR
BEGIN:VTIMEZONE
TZID:Asia/Manila
BEGIN:STANDARD
DTSTART:19700101T000000
UTCOFFSET:+0800
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
DTSTART;TZID=Asia/Manila:20260407T180000
DTEND;TZID=Asia/Manila:20260407T190000
SUMMARY:Meeting
END:VEVENT
END:VCALENDAR
```

Both are valid. Notocal Pro must parse both correctly.

---

## 2. Client-Specific Behaviors

### Apple Calendar (macOS / iOS)

- `.ics` files are typically minimal — no `VTIMEZONE` block.
- Uses UTC times with `Z` suffix (e.g., `DTSTART:20260407T100000Z`).
- Always includes `DTEND`.
- Generally uses `CRLF` line endings.

### DAVx5 (Android)

- Embeds `VTIMEZONE` blocks **before** the `VEVENT`/`VTODO` component.
- Uses `TZID` parameter on datetime properties (e.g., `DTSTART;TZID=Asia/Manila:20260407T180000`).
- `VTIMEZONE` blocks contain their own `DTSTART` properties for `STANDARD`/`DAYLIGHT` transition rules — these are **not** event properties.
- May use `DURATION` instead of `DTEND` for some events.

### Thunderbird (Lightning)

- Similar to DAVx5: includes `VTIMEZONE` blocks.
- Tends to include more properties (TRANSP, SEQUENCE, etc.).
- Uses `DTEND` consistently.

### Google Calendar (via CalDAV bridge)

- Occasionally uses `DURATION` instead of `DTEND`.
- May include `VALARM` sub-components.

---

## 3. Parser Strategy

Notocal Pro's parser (`src/lib/caldav/parser.ts`) handles these variations with two key techniques:

### Component Block Isolation

Before extracting any properties, the parser slices out only the target component block:

```
Full .ics → extractComponentBlock(ics, 'VEVENT') → VEVENT block only
```

This prevents `DTSTART` inside `VTIMEZONE/STANDARD` or `VTIMEZONE/DAYLIGHT` from being matched when we're looking for the event's `DTSTART`.

### DURATION → DTEND Fallback

If `DTEND` is absent, the parser checks for `DURATION` and computes `DTEND = DTSTART + DURATION`:

```
DTSTART:20260407T100000Z + DURATION:PT1H → DTEND:20260407T110000Z
```

Supported duration formats per RFC 5545 §3.3.6:
- `PnW` — weeks
- `PnD` — days
- `PTnH` — hours
- `PTnM` — minutes
- `PTnS` — seconds
- Combinations: `P1DT2H30M` (1 day, 2 hours, 30 minutes)

### Property Extraction

The `prop()` function:
1. Unfolds RFC 5545 folded lines (CRLF + whitespace continuation).
2. Matches property names with optional parameters (e.g., `DTSTART;TZID=Asia/Manila:...`).
3. Returns only the value portion after the colon.

### Custom Fetch Filter (All Component Types)

`tsdav`'s `fetchCalendarObjects` defaults to a `comp-filter` that only requests `VEVENT` components. This means VTODOs (tasks) and VJOURNALs (notes) are silently excluded from server responses. Notocal Pro overrides this by passing a custom filter that specifies only the top-level `VCALENDAR` component with no nested component filter, which tells the server to return all objects regardless of type.

### Create vs. Update Distinction

`tsdav` provides separate methods for creating and updating calendar objects. `createCalendarObject` sends `If-None-Match: *` (reject if exists), while `updateCalendarObject` sends `If-Match: <etag>` (reject if modified). Notocal Pro's `putCalendarObject` helper dispatches to the correct method based on whether an etag is provided.

### Direct Parser Calls

Entity classification in `fetchAll()` uses direct parser calls (`parseEvent` → `parseTask` → `parseNote`) rather than duck-typing on property presence. Each parser checks the iCal component type (`BEGIN:VEVENT`, `BEGIN:VTODO`, `BEGIN:VJOURNAL`) for reliable classification.

---

## 4. Known Issues & Workarounds

| Issue | Status | Notes |
|---|---|---|
| VTIMEZONE shadowing event DTSTART | **Fixed** | Component block isolation |
| DURATION without DTEND | **Fixed** | DURATION → DTEND computation |
| RRULE recurring events | **Not supported (v1)** | Deferred to future version; duplicate button as workaround |
| VALARM sub-components | **Ignored** | No alarm/notification support in v1 |
| VTIMEZONE timezone conversion | **Partial** | Parser extracts TZID-qualified values as-is; no timezone conversion to local time |
| tsdav default VEVENT-only filter | **Fixed** | Custom comp-filter fetches all component types (VEVENT, VTODO, VJOURNAL) |
| tsdav create vs update methods | **Fixed** | `putCalendarObject` helper uses `createCalendarObject` for new objects, `updateCalendarObject` for existing |

---

## 5. Testing Checklist

When testing interoperability, create events from each client and verify they appear correctly in Notocal Pro:

- [ ] Apple Calendar → Notocal: events with UTC times
- [ ] DAVx5 → Notocal: events with VTIMEZONE + TZID
- [ ] DAVx5 → Notocal: events with DURATION instead of DTEND
- [ ] Thunderbird → Notocal: events with VTIMEZONE
- [ ] Notocal → Apple Calendar: round-trip (create in Notocal, verify in Apple Calendar)
- [ ] Notocal → DAVx5: round-trip
- [ ] Edit in external client → Notocal: verify edits appear on sync
- [ ] Delete in external client → Notocal: verify deletions appear on sync
