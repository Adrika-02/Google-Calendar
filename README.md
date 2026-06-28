# Google Calendar Clone

> A high-fidelity, full-stack Google Calendar clone — month, week, and day views with recurring events, drag-and-drop, optimistic mutations, offline support, and JWT-based auth.

**Live demo:** _https://your-demo-url-here_

| Month view | Week view | Create event |
|---|---|---|
| ![Month view screenshot](docs/screenshots/month.png) | ![Week view screenshot](docs/screenshots/week.png) | ![Create modal screenshot](docs/screenshots/create.png) |

> Replace the placeholder paths above with real screenshots or a GIF. A 1280 × 800 recording of a drag-and-drop interaction works well here.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack & Rationale](#tech-stack--rationale)
3. [Architecture](#architecture)
4. [Local Setup](#local-setup)
5. [API Reference](#api-reference)
6. [Business Logic & Edge Cases](#business-logic--edge-cases)
7. [Animations & Interactions](#animations--interactions)
8. [Future Enhancements](#future-enhancements)
9. [Theory Questions](#theory-questions)

---

## Features

### Core (mandatory)

- [x] **Month / Week / Day views** — animated view transitions, sliding grid
- [x] **Create, edit, delete events** — form modal with title, description, location, color, date/time, all-day toggle
- [x] **Recurring events** — full RFC 5545 RRULE support (daily, weekly, monthly, yearly, custom); edit/delete scope dialog (This event / This and following / All events)
- [x] **Overlap detection** — warns before saving if a new event collides with an existing one (with option to proceed)
- [x] **Optimistic UI** — every mutation updates the local cache instantly; rolls back on server error
- [x] **Undo delete** — 6-second undo window with animated progress bar; network `DELETE` fires only after expiry
- [x] **Drag-and-drop** — week/day timed events (move + bottom-handle resize); month-view chips; 15-min snap; recurring events prompt for edit scope before commit
- [x] **Keyboard shortcuts** — `T`, `M`/`W`/`D`, `←`/`→`, `C`, `Esc`, `?`; focus trap in all modals
- [x] **Responsive layout** — sidebar mini-calendar, collapsible on narrow viewports

### Bonus

- [x] **Email/password auth** — register, login, logout; HttpOnly JWT cookie; `bcrypt` hashing; timing-safe credential check; "Continue as guest" for instant access
- [x] **Offline draft persistence** — in-progress new-event form saved to `localStorage` (`gcal_draft_new_event`) every 500 ms; restored on next modal open with a dismissible "Draft restored" banner
- [x] **Offline mutation queue** — creates/edits queued to `localStorage` (`gcal_offline_queue`) when `navigator.onLine === false`; optimistic cache updates applied immediately; flushed automatically on reconnect with success/failure toast
- [x] **11-color GCal palette** — Tomato, Flamingo, Tangerine, Banana, Sage, Basil, Peacock, Blueberry, Lavender, Grape, Graphite

---

## Tech Stack & Rationale

### Frontend

| Package | Version | Why |
|---|---|---|
| React 18 | `^18` | Concurrent features; `useTransition` ready when needed |
| TypeScript | `^5` | End-to-end type safety from API payload to render |
| Vite | `^5` | Sub-second HMR; native ESM; no webpack config overhead |
| Tailwind CSS | `^3` | Utility classes keep component styles co-located with JSX; purge eliminates dead CSS |
| Framer Motion | `^11` | Declarative spring / keyframe animations without imperative DOM writes |
| Luxon | `^3` | Immutable `DateTime`, IANA timezone support, ISO round-trips — simpler than `date-fns` for UTC-local conversions |
| TanStack Query v5 | `^5` | Server-state cache, optimistic mutations with snapshot rollback, `staleTime` control, `invalidateQueries` |
| rrule | `^2` | RFC 5545 rule parsing and `between()` expansion used in the event expander |
| Zod | `^3` | Runtime validation of form data before API calls; shared schema shape with server |

### Backend

| Package | Why |
|---|---|
| Node + Express | Minimal, well-understood; no framework magic hiding the request/response cycle |
| TypeScript | Same type guarantees on both sides of the wire |
| Prisma + PostgreSQL | Type-safe ORM with excellent migration tooling; Postgres `@@index` on `[userId, startUtc, endUtc]` makes range queries fast |
| Zod | All incoming request bodies validated before touching the database |
| bcryptjs | Constant-work password hashing; timing-safe credential comparison prevents username enumeration |
| jsonwebtoken | Stateless JWT in an HttpOnly, `SameSite=lax` cookie — no session store needed |

---

## Architecture

### Component tree (simplified)

```
App
└── QueryClientProvider
    └── AuthProvider
        └── ToastProvider
            └── AuthGate
                ├── AuthPage          (unauthenticated)
                └── CalendarProvider
                    └── AppShell
                        ├── TopBar
                        ├── Sidebar (MiniCalendar)
                        ├── MonthView | WeekView | DayView
                        ├── EventFormModal
                        ├── EventDetailPopover
                        └── ShortcutsDialog
```

### Data flow — Mermaid diagram

```mermaid
flowchart TD
    subgraph Browser
        UI[React UI]
        TQ[TanStack Query Cache]
        LS[(localStorage)]
        OQ[Offline Queue\ngcal_offline_queue]
        DR[Draft Storage\ngcal_draft_new_event]
    end

    subgraph Server["Express Server :3000"]
        AUTH[/api/auth]
        EV[/api/events]
        OVLP[/api/events/check-overlap]
        MW[attachUser middleware\nJWT → req.userId]
    end

    subgraph DB["PostgreSQL via Prisma"]
        ETBL[(Event table\nmaster / override / standalone)]
        EXTBL[(EventException table\ncancelled occurrences)]
        UTBL[(User table)]
        RECUR[expandMaster\nRRule.between + override/exception sets]
    end

    UI -- "useQuery (GET /api/events?start&end)" --> TQ
    TQ -- "cache miss / stale" --> EV
    EV --> MW --> DB
    DB --> ETBL
    ETBL --> RECUR --> EXTBL
    RECUR -- "EventInstance[]" --> EV --> TQ --> UI

    UI -- "useMutation (POST)" --> TQ
    TQ -- "onMutate: optimistic insert" --> UI
    TQ -- "fetch POST /api/events" --> EV
    EV -- "Zod validate" --> ETBL
    ETBL -- "201 Created" --> TQ
    TQ -- "onSettled: invalidateQueries" --> TQ

    UI -- "PATCH /api/events/:id (version + editScope)" --> EV
    EV -- "version mismatch? → 409" --> UI
    EV -- "editScope=single → create override row" --> ETBL
    EV -- "editScope=thisAndFollowing → cap UNTIL + new master" --> ETBL

    UI -- "DELETE /api/events/:id" --> EV
    EV -- "editScope=single → upsert EventException" --> EXTBL
    EV -- "editScope=all → cascade delete" --> ETBL

    UI -- "POST /api/events/check-overlap" --> OVLP
    OVLP -- "direct DB range query" --> ETBL --> OVLP --> UI

    UI -- "navigator.onLine=false" --> OQ
    OQ -- "optimistic cache update" --> TQ
    OQ -- "online event fires" --> EV

    UI -- "form change (500ms debounce)" --> DR
    DR -- "modal reopen" --> UI

    UI -- "POST /api/auth/register|login" --> AUTH
    AUTH -- "bcrypt.compare" --> UTBL
    AUTH -- "signToken → HttpOnly cookie" --> UI
```

### Key design decisions

| Decision | Rationale |
|---|---|
| All timestamps stored UTC | Removes timezone ambiguity at the DB level; `timezone` field captures the user's local zone for display-only conversions |
| Master / override / exception model | Mirrors RFC 5545: one row per series + one row per modified occurrence + one row per cancelled occurrence — minimal storage, correct semantics |
| Optimistic concurrency via `version` | Server rejects a PATCH where `req.body.version !== event.version`; client echoes the version it last read — no last-write-wins data loss |
| TanStack Query `staleTime: 30_000` | Avoids redundant refetches during navigation while keeping data fresh enough for a calendar |
| Overlap check as a separate endpoint | Keeps the create form UX non-blocking: the check fires on blur/submit without coupling it to the mutation |
| `expandMaster` runs server-side | The client never sees raw RRULE rows — it always receives concrete `EventInstance` objects, simplifying render logic significantly |

---

## Local Setup

### Prerequisites

- Node >= 20
- PostgreSQL running locally (or a `DATABASE_URL` to any Postgres instance — Railway, Supabase, Neon all work)

### 1. Clone and install

```bash
git clone <repo-url>
cd "Google Calender"

# Install both workspaces
(cd client && npm install)
(cd server && npm install)
```

### 2. Server environment

```bash
cd server
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/gcal_clone"

# Optional — defaults to a random secret if omitted (tokens invalidate on restart)
JWT_SECRET="replace-with-a-long-random-string"
```

### 3. Apply database schema

```bash
cd server
npm run db:push       # creates tables from prisma/schema.prisma
# or: npx prisma migrate dev --name init
```

Optionally open Prisma Studio to inspect data:

```bash
npm run db:studio     # opens http://localhost:5555
```

### 4. Run

In two separate terminals:

```bash
# Terminal 1 — backend
cd server && npm run dev        # http://localhost:3000

# Terminal 2 — frontend
cd client && npm run dev        # http://localhost:5173
```

The Vite dev server proxies `/api/*` to the Express server automatically via the `vite.config.ts` proxy config.

### 5. Typecheck

```bash
cd client && npm run typecheck  # tsc --noEmit
```

### Available scripts

| Package | Script | Purpose |
|---|---|---|
| `client` | `dev` | Vite dev server |
| `client` | `build` | Production build to `dist/` |
| `client` | `typecheck` | `tsc --noEmit` |
| `client` | `test` | Vitest (layout algorithm unit tests) |
| `server` | `dev` | nodemon + tsx watch |
| `server` | `build` | Compile TypeScript to `dist/` |
| `server` | `db:push` | Sync Prisma schema to DB (dev) |
| `server` | `db:studio` | Prisma Studio GUI |

---

## API Reference

All endpoints return JSON. Errors follow the shape `{ error: { code, message } }`.

Authentication uses an HttpOnly cookie (`gcal_token`) set on login/register. Guest users have no cookie; their events are stored with `userId = null` and scoped to the guest pool.

### Health

#### `GET /api/health`

```json
{ "status": "ok", "timestamp": "2026-06-28T12:00:00.000Z" }
```

---

### Auth

#### `POST /api/auth/register`

Create a new account. Sets `gcal_token` cookie on success.

**Body**
```json
{
  "email": "user@example.com",
  "name": "Ada Lovelace",
  "password": "min-8-chars"
}
```

**Response `201`**
```json
{
  "data": { "id": "cuid", "email": "user@example.com", "name": "Ada Lovelace" }
}
```

**Errors:** `409 EMAIL_TAKEN`

---

#### `POST /api/auth/login`

**Body**
```json
{ "email": "user@example.com", "password": "..." }
```

**Response `200`**
```json
{
  "data": { "id": "cuid", "email": "user@example.com", "name": "Ada Lovelace" }
}
```

**Errors:** `401 INVALID_CREDENTIALS` (returned for both wrong email and wrong password — no enumeration)

---

#### `POST /api/auth/logout`

Clears the cookie. No body required.

**Response `200`**
```json
{ "message": "Logged out" }
```

---

#### `GET /api/auth/me`

Returns the currently authenticated user. Requires the `gcal_token` cookie.

**Response `200`**
```json
{
  "data": { "id": "cuid", "email": "user@example.com", "name": "Ada Lovelace" }
}
```

**Errors:** `401 UNAUTHORIZED`

---

### Events

#### `GET /api/events`

Returns all event **instances** (recurring events are expanded server-side) overlapping the requested window.

**Query params**

| Param | Type | Required | Description |
|---|---|---|---|
| `start` | ISO 8601 UTC | yes | Window start |
| `end` | ISO 8601 UTC | yes | Window end |
| `tz` | IANA zone string | no | Reserved for future server-side tz conversion |

**Response `200`**
```json
{
  "data": [
    {
      "id": "cuid",
      "masterId": "cuid-or-null",
      "originalStartUtc": "2026-06-28T09:00:00.000Z",
      "isRecurring": true,
      "isOverride": false,
      "title": "Weekly sync",
      "description": null,
      "location": "Zoom",
      "colorId": "peacock",
      "startUtc": "2026-06-28T09:00:00.000Z",
      "endUtc": "2026-06-28T10:00:00.000Z",
      "isAllDay": false,
      "timezone": "America/New_York",
      "rrule": "RRULE:FREQ=WEEKLY;BYDAY=MO",
      "userId": "cuid-or-null",
      "version": 3,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-06-01T00:00:00.000Z"
    }
  ]
}
```

Instances are sorted by `startUtc` ascending. Recurring occurrences share the master's `id` as their own `id`; the combination of `id` + `originalStartUtc` uniquely addresses a specific occurrence.

---

#### `POST /api/events`

Create a new event (standalone or recurring master).

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | min 1 char |
| `startUtc` | ISO 8601 UTC | yes | |
| `endUtc` | ISO 8601 UTC | yes | must be after `startUtc` |
| `isAllDay` | boolean | no | default `false` |
| `timezone` | IANA zone | yes | e.g. `"America/Chicago"` |
| `description` | string | no | |
| `location` | string | no | |
| `colorId` | string | no | default `"graphite"` |
| `rrule` | string | no | RFC 5545 RRULE string, e.g. `"RRULE:FREQ=WEEKLY;BYDAY=TU,TH"` |

**Response `201`**
```json
{ "data": { /* full Event row */ } }
```

---

#### `PATCH /api/events/:id`

Update an event. For recurring series, `editScope` controls which occurrences are affected.

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `version` | integer | yes | Must match current `event.version`; rejected with `409` on mismatch |
| `editScope` | `"single"` \| `"thisAndFollowing"` \| `"all"` | no | default `"all"` |
| `originalStartUtc` | ISO 8601 UTC | required when editScope ≠ `"all"` | Identifies the target occurrence |
| _(all other fields)_ | | no | Same as POST; omit fields you don't want to change |

**Response `200`** — updated event row (or `201` for `single` scope, which creates an override row).

**Errors:**
- `404 NOT_FOUND` — event doesn't exist
- `403 FORBIDDEN` — event belongs to another user
- `409 CONFLICT` — version mismatch; client should reload

---

#### `DELETE /api/events/:id`

Delete an event or occurrences of a recurring series.

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `editScope` | `"single"` \| `"thisAndFollowing"` \| `"all"` | no | default `"all"` |
| `originalStartUtc` | ISO 8601 UTC | required when editScope ≠ `"all"` | |

**Response `204 No Content`**

**Errors:** `403 FORBIDDEN`, `404 NOT_FOUND`

---

#### `POST /api/events/check-overlap`

Check whether a time range collides with existing events (used by the create/edit form before submit).

**Body**

| Field | Type | Required |
|---|---|---|
| `startUtc` | ISO 8601 UTC | yes |
| `endUtc` | ISO 8601 UTC | yes |
| `excludeId` | CUID string | no |

**Response `200`**
```json
{
  "hasOverlap": true,
  "data": [
    {
      "id": "cuid",
      "title": "Existing meeting",
      "startUtc": "2026-06-28T09:00:00.000Z",
      "endUtc": "2026-06-28T10:30:00.000Z",
      "colorId": "tomato"
    }
  ]
}
```

---

## Business Logic & Edge Cases

### UTC storage / local display

Every timestamp is stored as UTC in PostgreSQL. The `timezone` field (IANA zone string, e.g. `"America/New_York"`) is captured at creation time and used exclusively for display. Luxon converts UTC instants to local time via `DateTime.fromISO(utc, { zone: event.timezone })`. This means an event created in Sydney at 9 AM appears at 9 AM to the Sydney user regardless of where the server is hosted.

All-day events store `startUtc` at `T00:00:00Z` and `endUtc` at `T00:00:00Z` of the next calendar day, with `isAllDay = true`. Rendering treats them as date-only regardless of timezone offset.

### DST (Daylight Saving Time)

Luxon's `DateTime` arithmetic is DST-aware. A weekly event stored as `RRULE:FREQ=WEEKLY` with `DTSTART:20260301T090000Z` will still appear at 9 AM local time after a DST transition because `RRule.between()` generates UTC instants from the rule, and Luxon's UTC-to-local conversion handles the offset change automatically.

### Recurring events — the override model

The database uses three row types:

| Row type | `rrule` | `recurrenceId` | Purpose |
|---|---|---|---|
| Standalone | null | null | A single non-recurring event |
| Master | set (RFC 5545) | null | Defines the repeating pattern |
| Override | null | → master ID | Replaces one generated occurrence |

Cancelled occurrences (EXDATE equivalent) live in a separate `EventException` table — one row per cancelled slot — so they don't pollute the `Event` table with phantom rows.

**Edit scope semantics:**

| Scope | Server action |
|---|---|
| `single` | Creates an override row with `recurrenceId → master`; the generator skips that slot if it finds a matching override |
| `thisAndFollowing` | Caps the master's RRULE with `UNTIL = occurrenceStart - 1ms` (via `capRruleUntil`); creates a new master starting at the split point |
| `all` | Updates the master row directly; all future generated occurrences inherit the change |

### Overlap detection

`POST /api/events/check-overlap` queries only master/standalone rows (`recurrenceId = null`, `rrule = null`) that overlap `[startUtc, endUtc)`. Recurring series are deliberately excluded from this query — expanding every series for every overlap check would be expensive. The trade-off is that overlaps with individual occurrences of recurring events are not caught server-side; the client has full event data from its TanStack Query cache and could extend this check client-side if needed.

### Multi-day and midnight-crossing events

Events where `endUtc` falls on a different calendar day than `startUtc` are rendered as chips spanning multiple cells in month view (via a `colSpan` technique) and as tall blocks crossing midnight in week/day view. The `expandMaster` function queries occurrence starts from `(windowStart - event.duration)` to ensure events that began before the window but end inside it are included.

All-day events are displayed in the all-day lane at the top of the week/day grid and span the correct number of day columns.

### Optimistic concurrency

Every `Event` row has a `version: Int` column (default 0, incremented on every update). The client stores the version it last read and sends it back with every PATCH. The server validates: `if (master.version !== body.version) → 409 CONFLICT`. The client shows an error toast asking the user to reload. This prevents silent last-write-wins overwrites when two tabs or two users edit the same event concurrently.

### Overlap layout algorithm (week/day view)

Timed events in the same day column are laid out using a three-pass algorithm in `client/src/lib/layoutEvents.ts`:

1. **Sort** events by `startMinutes`, breaking ties by duration descending (longer events get lower columns).
2. **Greedy column assignment** — reuse the earliest column whose previous event ended at or before the current event's start; otherwise open a new column.
3. **Union-Find connected components** — group transitively-overlapping events so all members share the same `totalCols` value, preventing width gaps in chain cases (A overlaps B, B overlaps C, A and C don't directly overlap).

Each event's CSS position: `left = col / totalCols`, `width = 1 / totalCols`.

### Auth security notes

- Passwords are hashed with `bcrypt` (12 rounds).
- The login endpoint compares a dummy hash even when the email doesn't exist, preventing timing-based username enumeration.
- JWTs are stored in `HttpOnly`, `SameSite=lax` cookies — not in `localStorage` — so they are inaccessible to XSS.
- Token lifetime: 7 days. Refresh is not implemented; users re-login after expiry.
- `attachUser` middleware silently clears an expired/tampered cookie and sets `req.userId = null` (guest mode), so auth failure never hard-crashes the app.

---

## Offline Support & localStorage

### Draft persistence

While composing a **new** event, the form is debounced-saved to `localStorage` (`gcal_draft_new_event`) every 500 ms. On next open of the create modal, if a draft with a non-empty title exists, it is restored and a "Draft restored · Discard" banner animates in. Discard clears the key and resets the form.

Drafts are **not** saved when editing existing server-backed events — those always load from the server record.

### Offline mutation queue

When the browser reports `navigator.onLine === false` at submit time:
1. The payload is written to `gcal_offline_queue` (a JSON array in localStorage).
2. An optimistic entry is applied to the TanStack Query cache immediately.
3. Repeated edits to the same event collapse into one queue slot (no redundant PATCH requests).
4. A toast confirms the queued state.

On reconnect (`window` `"online"` event), `useOfflineSync` (mounted in `AppShell`) flushes the queue: `POST` for creates (swaps the `offline-*` placeholder for the real record), `PATCH` for updates. Items that fail remain in the queue for the next reconnect. `invalidateQueries` ensures full cache consistency after sync.

An amber banner appears below the top bar whenever `navigator.onLine` is false.

### localStorage keys

| Key | Purpose | Cleared when |
|---|---|---|
| `gcal_draft_new_event` | In-progress new-event form state | Save succeeds or user clicks Discard |
| `gcal_offline_queue` | Pending create/update mutations | Per item, after successful sync |
| `gcal_guest` | "Continue as guest" session flag | On sign-in or sign-out |

---

## Animations & Interactions

### View transitions

Navigating between months/weeks/days slides the calendar grid horizontally using Framer Motion `AnimatePresence` + `motion.div`. `navDirection` (±1) stored in `CalendarContext` drives the offset sign (±28 px, 180 ms `easeInOut`). Backward navigation slides right, forward slides left — matching the mental model of a physical calendar.

### Modal entrance

The create/edit dialog uses a spring entrance (`type: "spring"`, `stiffness: 420`, `damping: 28`) so it snaps in with physical energy rather than a flat ease. The detail popover and shortcuts dialog use the same profile for consistency.

### Now-line pulse

The red dot at the current time in week/day view pulses (`scale: 1 → 1.35 → 1`) on a 3-second repeat via Framer Motion `keyframes`, making it easy to spot at a glance without distracting movement.

### Event chip hover (month view)

Month-view chips lift 1 px and gain a `drop-shadow` on `whileHover` (120 ms), giving tactile feedback without triggering React re-renders via inline style updates.

### Skeleton loading (month view)

While the event query is pending, each calendar cell renders two animated gray placeholder bars (`opacity: 0.5 → 0.9 → 0.5`, 1.4 s loop) in place of chips. There is no full-screen spinner — the grid shape is preserved.

### Drag-and-drop

**Week/day timed events:**
- **Move:** `pointerdown` captures pointer; `pointermove` is throttled with `requestAnimationFrame`; position is computed against a cached `gridRect` and snapped to 15-minute slots.
- **Resize:** The bottom 8 px of each chip acts as a resize handle. During resize, `element.style.height` is written directly — zero React state updates during the drag, avoiding paint jank.
- Both operations commit with a `PATCH` mutation on `pointerup`.

**Month chips:** Dragged across day cells using `dragenter` events against a cached `gridRect`. Drop commits a `PATCH` with the new date preserving the original time-of-day.

**Recurring events** trigger the edit-scope dialog before any mutation fires.

### Undo delete

Deleting an event removes it from all TanStack Query cache snapshots immediately (optimistic). A dark toast appears with an **Undo** button and a shrinking progress bar. Clicking Undo cancels the pending `DELETE` (if the timer hasn't fired) and restores all snapshots. The network request fires only after the 6-second window expires — if it fails, the cache rolls back automatically.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `T` | Go to today |
| `M` / `W` / `D` | Switch to Month / Week / Day view |
| `←` / `→` | Previous / next period |
| `C` | Open create-event modal |
| `Esc` | Close focused modal / popover |
| `?` | Open keyboard-shortcuts reference dialog |

Shortcuts are suppressed when focus is inside any `<input>`, `<textarea>`, or `<select>`. All modals install a Tab-cycle focus trap so keyboard users cannot escape accidentally.

### Accessibility

- Month grid: `role="grid"`, cells: `role="gridcell"` with date + event-count `aria-label`, headers: `role="columnheader"`.
- Event chips carry `aria-label` with title and formatted time.
- All modals: `role="dialog"`, `aria-modal="true"`, focus moved to first focusable element on open.
- Icon-only buttons carry `aria-label` and `title` throughout.

---

## Future Enhancements

- **Google OAuth** — `passport-google-oauth20` for one-click sign-in; map Google Calendar events via API.
- **Multiple calendars** — per-user calendar groups (work, personal, birthdays) with independent color and visibility toggles.
- **Invitation / sharing** — invite other registered users to events; accept/decline flow; attendee list on the detail popover.
- **Search** — full-text search across title, description, and location; keyboard-navigable results panel.
- **Event reminders** — `node-cron` or a queue (BullMQ) to send email reminders `N` minutes before event start.
- **Recurring event end conditions** — UI surface for `COUNT` and `UNTIL` in the recurrence picker (currently the RRULE string supports them but the picker only generates `FREQ`+`BYDAY`).
- **Expand recurring overlap detection** — run `expandMaster` on recurring series within the check window so overlaps with individual occurrences are caught.
- **Offline full sync** — use the Cache API and a Service Worker to serve the full app shell offline, not just the mutation queue.
- **E2E tests** — Playwright suite covering create → drag → edit-scope → delete with undo.
- **Deploy** — Dockerize the server; serve the Vite build from the same origin to eliminate CORS in production.

---

## Theory Questions

_This section is reserved for the assignment's theory questions. The structure below is ready for your answers._

---

### Q1. _[Question text to be pasted here]_

**Answer:**

> _Paste your answer here._

---

### Q2. _[Question text to be pasted here]_

**Answer:**

> _Paste your answer here._

---

_Add further questions following the same `### Qn.` pattern._
