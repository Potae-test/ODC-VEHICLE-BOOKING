# System Change Log

Record repository-level rule changes here. Read this file before editing shared architecture, domain logic, API contracts, sheet schema, or common UI patterns.

## 2026-05-25
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
