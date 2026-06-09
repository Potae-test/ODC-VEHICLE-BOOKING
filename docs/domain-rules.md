# Domain Rules

Read this file before changing booking logic, driver assignment, permissions, calendars, caching, or Apps Script behavior.

## Core Stack
- Frontend: React + Vite, JSX, SweetAlert2, Flatpickr.
- Backend: Google Apps Script, Google Sheets, Cloudflare Worker proxy.
- Language and encoding: Thai UI, UTF-8 only.
- Timezone: `Asia/Bangkok`.

## Booking Rules
- Valid statuses: `PENDING`, `APPROVED`, `IN_USE`, `COMPLETED`, `CANCELLED`, `DRIVER_CANCELLED`.
- Calendar should show only `APPROVED`, `IN_USE`, and `DriverUnavailable` events.
- Booking and calendar visibility stay global across users; do not filter shared lists by `requester_user_id`.
- Do not overwrite `start_datetime` or `end_datetime`.
- Use `actual_start_datetime` and `actual_return_datetime` for real usage timestamps.
- The `CENTRAL_VEHICLE` flow is a direct `PENDING` -> `COMPLETED` transition for central office usage, must assign driver `U007`, must not create active driver work, and must not move the queue pointer.
- New bookings created by a logged-in `USER` must write the real owner into `requester_user_id`, `requester_name`, `department`, and `phone`, and user-specific notifications must target that owner id.

## Driver and Queue Rules
- Drivers can log in even when unavailable.
- Do not mark a driver inactive for leave; use `DriverUnavailable`.
- Queue assignment is circular and must continue looping.
- Skip unavailable drivers, overlapping bookings, and inactive drivers.
- Manual override is allowed for `ADMIN` and `STAFF`.
- Manual override must log `MANUAL_OVERRIDE` and move the queue pointer when the selected driver exists in queue state.

## Availability Rules
- Overlap rule: `booking.start < unavailable.end && booking.end > unavailable.start`.
- Preserve Thai unavailable types exactly as stored by the system. Do not normalize or rewrite Thai labels unless a deliberate migration is included.

## Google Sheets Rules
- Important sheets: `Users`, `Bookings`, `Vehicles`, `DriverUnavailable`, `DriverUnavailableLogs`, `DriverQueue`, `DriverQueueLogs`, `DriverQueueState`, `DriverJobLogs`, `BookingCancellationHistory`.
- Never rename sheet headers without migration handling.

## Logging and Cache Rules
- Important actions must create append-only logs.
- Log at minimum: driver assignment, manual override, driver cancellation, unavailable create/update/cancel, and queue movement.
- After mutations, invalidate related caches such as `bookings`, `users`, `vehicles`, `driver_queue`, and `driver_unavailable`.

## Push Notification Rules
- Keep non-FCM push subscriptions matched by `endpoint`.
- Keep FCM push subscriptions idempotent per device session by matching `user_id + provider + user_agent` first and falling back to `fcm_token` only when needed.
- When an FCM token is saved, preserve `subscription_id` and `created_at` on update, refresh `fcm_token`, `endpoint`, `p256dh`, `auth`, `provider`, `user_agent`, `status`, and `updated_at`, and keep only the latest row `ACTIVE` for that device session.

## Permission Rules
- Permissions are managed centrally.
- Add new permissions to the admin management UI.
- Check permissions before rendering actions.
- `bookings_assign_central_vehicle` defaults to `ADMIN` and `STAFF` only.
- `bookings_assign_central_vehicle` and `bookings_backdate_complete` are action permissions and must not be hard-coded to UI roles.
- `USER` may view all bookings and calendar entries, but may edit or cancel only their own booking.
- `DRIVER` can access only their own records.
- `ADMIN` and `STAFF` have full access.

## UI Rules
- Use a clean government-style layout with large readable fonts.
- Avoid cramped tables, tiny buttons, and overly complex layouts.
- Tables must support empty states and readable mobile overflow.
- Use SweetAlert2 for modal flows.

## Loading Rules
- Prefer shared skeleton components from `src/components/skeletons/`.
- Avoid plain loading text on major pages.
- Do not render heavy calendar widgets before loading completes.
- Use `useMinimumLoading(loading, 350)` for page-level loading where flicker is a risk.
