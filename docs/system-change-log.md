# System Change Log

Record repository-level rule changes here. Read this file before editing shared architecture, domain logic, API contracts, sheet schema, or common UI patterns.

## 2026-05-26
- Added `bookings_create_backdated` as a managed action permission and wired the shared booking modal to show the "บันทึกรายการย้อนหลัง" checkbox in both create and edit flows only for users who have that permission, instead of hard-coding the checkbox to STAFF/ADMIN roles.
- Preserved `requester_user_id` ownership when STAFF/ADMIN edit bookings, and restored Booking page action gating so `USER` can still see all bookings but may edit or cancel only bookings owned by that user, with requester-name fallback for legacy rows that do not yet have `requester_user_id`.
- Restored the Booking page `ใช้รถ สนง.กลาง` action under `bookings_assign_central_vehicle`, bumped the action-permission config version to refresh cached role grants, and decoupled the `บันทึกงานย้อนหลัง` action from the create/edit `is_backdated` flag so STAFF/ADMIN can backdate-complete any eligible booking while still selecting the assigned driver in the completion form.
- Added `bookings_backdate_complete` under booking action permissions so it appears automatically in the Admin permission UI under "รายการจอง", granted it by default to `USER` and `STAFF`, and simplified the Booking page backdated-completion popup to only collect the assigned driver and actual trip timestamps.

## 2026-05-25
- Enforced true booking ownership through `requester_user_id` for new user-created bookings, kept Booking and Calendar globally visible, limited USER edit/cancel actions to their own bookings, and routed owner-facing booking notifications to the booking owner instead of relying on requester name.
- Switched `DriverSummary` workload counting to use live booking rows as the primary source instead of relying on `DriverJobLogs`, and preserved assigned-driver identity in `DriverJobs` start/completion payloads so STAFF actions no longer zero out or overwrite driver workload counts.
- Added a `CENTRAL_VEHICLE` completion flow so STAFF/ADMIN can finish a pending booking immediately as "ใช้รถ สนง.กลาง", persist central-vehicle fields on the booking row, notify only the requester, and surface the completed workload under driver `U007` without creating active driver jobs.
- Refactored the shared app shell scroll layout so `#root` uses a full-height flex container, the main content area owns vertical scrolling, and the sidebar keeps its own scroll context. This fixes mouse-wheel scrolling failing over page content in the React UI without changing booking logic.
- Expanded the admin page into a real booking-management surface by reusing the shared booking modal for create/edit flows and exposing backdated booking completion from the admin booking list, while keeping permission management on the same page.
- Tightened driver summary workload counting so cards and table rows only include bookings that are currently assigned by `assigned_user_id` and in `APPROVED`, `IN_USE`, or `COMPLETED`, while pending cancel requests are kept out of normal workload totals.
- Created root `AGENTS.md` as the active repository guide and required pre-edit reading of `AGENTS.md`, `docs/domain-rules.md`, and `docs/system-change-log.md`.
- Moved persistent booking, queue, permission, cache, and loading rules into `docs/domain-rules.md` so future updates have a single source of truth.
- Archived legacy agent guidance to `docs/archive/AGENTS_OLD.md` and stopped using the archive as the place for new rules.
- Updated notification center pagination to a compact bounded layout and converted the panel to a fixed-height flex container so list scrolling no longer pushes footer actions out of view.
- Added unread-state bell animation with pulse and reduced-motion handling so the notification trigger only animates while unread notifications exist.
- Added a dedicated close button to the notification panel header so users can dismiss the dropdown without affecting unread state, polling, or pagination.
- Added a mobile-first responsive layer for header, navigation, notifications, forms, cards, modal sizing, and key list pages so the app stays usable at phone width without changing business logic or API behavior.
- Added PWA-ready foundations with `vite-plugin-pwa`, a merged Firebase messaging and offline-capable service worker, manifest metadata, generated app icons, install prompt support, and offline fallback content while keeping the existing booking and notification logic intact.
- Added push-debug instrumentation across Apps Script and the Cloudflare Worker so `created_notifications` are returned consistently and FCM delivery can be traced in `wrangler tail` without changing booking or queue logic.
- Normalized push subscription provider handling so blank `provider` values are treated as `FCM` for backward compatibility and FCM lookups no longer miss valid active tokens.
