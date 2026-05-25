# System Change Log

Record repository-level rule changes here. Read this file before editing shared architecture, domain logic, API contracts, sheet schema, or common UI patterns.

## 2026-05-25
- Created root `AGENTS.md` as the active repository guide and required pre-edit reading of `AGENTS.md`, `docs/domain-rules.md`, and `docs/system-change-log.md`.
- Moved persistent booking, queue, permission, cache, and loading rules into `docs/domain-rules.md` so future updates have a single source of truth.
- Archived legacy agent guidance to `docs/archive/AGENTS_OLD.md` and stopped using the archive as the place for new rules.
- Updated notification center pagination to a compact bounded layout and converted the panel to a fixed-height flex container so list scrolling no longer pushes footer actions out of view.
- Added unread-state bell animation with pulse and reduced-motion handling so the notification trigger only animates while unread notifications exist.
- Added a dedicated close button to the notification panel header so users can dismiss the dropdown without affecting unread state, polling, or pagination.
