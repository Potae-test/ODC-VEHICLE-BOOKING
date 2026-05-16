# AGENTS.md

# ODC Vehicle Booking System

System architecture and engineering rules for Codex / AI agents.

---

# 1. Project Stack

Frontend:
- React Vite
- JSX (NOT TypeScript)
- SweetAlert2
- Flatpickr
- React Big Calendar

Backend:
- Google Apps Script
- Google Sheets
- Cloudflare Worker API Proxy

Language:
- Thai UI
- UTF-8 only

Timezone:
- Asia/Bangkok

---

# 2. Critical Encoding Rules

ALWAYS preserve UTF-8 encoding.

NEVER:
- convert charset
- rewrite Thai text
- save with ANSI
- corrupt Thai text

All Thai text must remain readable.

Before modifying files:
- preserve original encoding
- do not rewrite whole file unnecessarily

---

# 3. Build Rules

After every frontend change:

```bash
npm run build
```

After Apps Script changes:
- syntax check
- preserve existing APIs

---

# 4. UI/UX Standards

Use:
- clean government-style UI
- large readable fonts
- Thai senior-friendly layout
- simple spacing
- clear status colors

Avoid:
- over-complex layouts
- tiny buttons
- cramped tables

Default font:
- Tahoma
- TH Sarabun where specified

---

# 5. Date/Time Rules

Use:
- Asia/Bangkok timezone
- Thai Buddhist year (+543)

Use Flatpickr style consistent with Booking page.

Date format:
- DD/MM/YYYY HH:mm

---

# 6. Booking Rules

Statuses:

PENDING
APPROVED
IN_USE
COMPLETED
CANCELLED
DRIVER_CANCELLED

Rules:
- APPROVED and IN_USE appear on Calendar
- COMPLETED/CANCELLED hidden from Calendar

Do not overwrite:
- start_datetime
- end_datetime

Use:
- actual_start_datetime
- actual_return_datetime

for real timestamps.

---

# 7. Driver Rules

Drivers:
- can login even if unavailable
- should NOT become INACTIVE for leave

Use:
DriverUnavailable

instead of changing Users.status.

---

# 8. Driver Queue Rules

Queue system:
- circular queue
- loop continuously

Staff/Admin:
- can manual override

When manual override:
- log MANUAL_OVERRIDE
- move queue pointer to selected driver if driver exists in queue

Skip:
- unavailable drivers
- overlapping bookings
- inactive drivers

---

# 9. Google Sheets Architecture

Important Sheets:

Users
Bookings
Vehicles
DriverUnavailable
DriverUnavailableLogs
DriverQueue
DriverQueueLogs
DriverQueueState
DriverJobLogs
BookingCancellationHistory

NEVER rename sheet headers without migration handling.

---

# 10. Logging Rules

Every important action must create logs.

Examples:
- driver assignment
- manual override
- driver cancellation
- unavailable creation/update/cancel
- queue movement

Use append-only logs.

Do not silently overwrite history.

---

# 11. Permission Rules

Permissions are managed centrally.

Always:
- add permissions to Admin management UI
- check permissions before rendering actions

Roles:

ADMIN
STAFF
DRIVER
USER

DRIVER:
- only own records

ADMIN/STAFF:
- full access

---

# 12. Calendar Rules

Calendar shows:
- APPROVED
- IN_USE
- DriverUnavailable events

Use different colors:
- booking
- leave
- holiday
- unavailable

Calendar must still render even with no events.

---

# 13. API Rules

Use existing apiRequest style.

Always:
- invalidate cache after mutations
- return success boolean
- return readable Thai messages

Avoid:
- direct fetch unless necessary

---

# 14. Cache Rules

After create/update/delete:
always invalidate related caches.

Examples:
- bookings
- users
- vehicles
- driver_queue
- driver_unavailable

---

# 15. React Rules

Project uses:
- JSX
- functional components
- hooks

Avoid:
- class components
- unnecessary re-renders
- giant components

Prefer:
- helper functions
- memoized lists
- reusable modal sections

---

# 16. Table Rules

Tables must:
- support empty states
- support pagination if large
- support readable mobile overflow

Never:
- hardcode wrong colSpan

---

# 17. Modal Rules

Use SweetAlert2.

Large detail content:
- expandable sections
- textarea style for long text

Avoid:
- cramped inline labels

---

# 18. Safety Rules

Before deleting:
- confirm dialog required

Before assignment:
- validate overlaps
- validate unavailable
- validate queue logic

---

# 19. Driver Availability Rules

Unavailable overlap:

booking.start < unavailable.end
AND
booking.end > unavailable.start

Unavailable types:
- ลา
- หยุด
- อื่นๆ

---

# 20. Code Modification Rules

Do NOT:
- rewrite unrelated code
- rename APIs randomly
- change response shape unexpectedly

Only modify requested areas.

---

# 21. Preferred Architecture Style

Prefer:
- helper functions
- pure logic functions
- centralized validation
- reusable formatting helpers

Avoid:
- duplicated logic
- inline giant JSX blocks

---

# 22. Future System Direction

System is evolving toward:

- Dispatch system
- Queue recommendation engine
- Driver workload balancing
- Driver availability management
- Audit logging
- Smart assignment
- LINE notification integration

# 23. Skeleton Loading Rules

Use skeleton loading instead of plain loading text.

Prefer:
- page skeleton
- table skeleton
- card skeleton
- calendar skeleton for month/week grids

Rules:
- keep loading UI lightweight and reusable
- use shared components from `src/components/skeletons/`
- do not render heavy widgets while loading
- in calendar views, do not render `react-big-calendar` until loading is finished
- page-level loading should use `useMinimumLoading(loading, 350)` to avoid flicker

Avoid:
- rendering giant skeleton DOM trees
- skeleton flickering
- custom one-off text placeholders on major pages
- layout shifting

All skeletons must:
- preserve layout size
- use consistent border radius
- use pulse animation

Design code extensibly.

After changes:
- summarize modified files
- summarize schema changes
- summarize required deployment
