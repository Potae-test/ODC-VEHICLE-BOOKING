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
- `bookings_complete_on_behalf` is a separate closing action for `IN_USE` bookings only; it must re-read the latest row before writing, reject rows that are no longer `IN_USE` or that have a pending driver-cancel request, mark `completed_on_behalf = TRUE`, keep existing driver-complete and backdated-complete flows unchanged, and leave `actual_start_datetime` unchanged unless it already exists.
- Before destructive or closing actions such as backdated completion, central-office completion, and cancellation, the backend must re-read the latest booking row and reject the action with `รายการนี้ถูกปิดงานแล้ว กรุณารีเฟรชข้อมูล` when the latest status is already `COMPLETED` or `CANCELLED`, without writing logs, notifications, or row updates.
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
- `DriverUnavailable` supports three canonical types only: `ลา`, `หยุด`, and `OUT_PROVINCE`.
- UI labels must display these canonical types as `ลา / หยุด`, `ติดภารกิจ (ชั่วคราว)`, and `ปฏิบัติงานต่างจังหวัด`.
- Keep legacy unavailable-type compatibility when reading older rows: `holiday` -> `ลา`, `unable to complete a task.` -> `หยุด`, and Thai display labels should still resolve to the matching canonical type.

## Google Sheets Rules
- Important sheets: `Users`, `Bookings`, `Vehicles`, `DriverUnavailable`, `DriverUnavailableLogs`, `DriverQueue`, `DriverQueueLogs`, `DriverQueueState`, `DriverJobLogs`, `BookingCancellationHistory`, `BookingActivityLogs`.
- Notification visibility hides must use a separate `NotificationDeletes` sheet with columns `delete_id`, `notification_id`, `user_id`, `deleted_at`, and `created_by`; do not immediately delete shared `Notifications` rows when one user removes a notification from NotificationBell.
- Never rename sheet headers without migration handling.

## Logging and Cache Rules
- Important actions must create append-only logs.
- Log at minimum: booking create/update/cancel, booking approval and reassignment, driver assignment recall, central-vehicle completion, driver cancel request/withdraw/review, backdated completion, on-behalf completion, unavailable create/update/cancel, and queue movement.
- After mutations, invalidate related caches such as `bookings`, `users`, `vehicles`, `driver_queue`, and `driver_unavailable`.
- Apps Script may use `CacheService` only for mostly static master-data reads such as `users`, `drivers`, `vehicles`, and `thai_holidays`; do not cache frequently changing data such as bookings, notifications, driver queue state, or sessions.
- Master-data read APIs that support `fresh=true` must bypass `CacheService`, read from Sheets directly, and then refresh the cached value without changing the API response shape.

## Push Notification Rules
- Keep non-FCM push subscriptions matched by `endpoint`.
- Keep FCM push subscriptions idempotent per device session by matching `user_id + provider + user_agent` first and falling back to `fcm_token` only when needed.
- When an FCM token is saved, preserve `subscription_id` and `created_at` on update, refresh `fcm_token`, `endpoint`, `p256dh`, `auth`, `provider`, `user_agent`, `status`, and `updated_at`, and keep only the latest row `ACTIVE` for that device session.
- Per-user notification delete/hide must only hide NotificationBell rows for the current session user by writing `NotificationDeletes` markers keyed by `notification_id + user_id`; do not change notification creation, stored title/message/category, or FCM/Web Push dispatch behavior when a user hides a notification.
- NotificationBell `ลบทั้งหมด` must also stay per-user only by upserting `NotificationDeletes` markers for the current session user's currently visible notifications instead of deleting shared `Notifications` rows, and must not change notification creation or FCM/Web Push dispatch behavior.
- Scheduled booking reminders must keep NotificationBell, FCM, and Web Push title/message/category identical by dispatching the stored notification record through the Worker `created_notifications` path.
- Scheduled reminder dedupe must stay append-only in `Notifications` by using stable per-recipient reminder keys, not by mutating or deleting older rows.
- Current scheduled reminder types are `BOOKING_REMINDER_1H`, `BOOKING_REMINDER_TOMORROW`, and `BOOKING_OPEN_JOB_DAILY`.
- If a scheduled reminder is triggered by Apps Script time-driven automation, it must call the Worker reminder endpoint instead of running the Apps Script reminder action alone, otherwise NotificationBell rows will be created without FCM/Web Push dispatch.
- Recommended schedules: `BOOKING_REMINDER_TOMORROW` around `18:00` Asia/Bangkok and `BOOKING_OPEN_JOB_DAILY` around `21:00` Asia/Bangkok.
- The protected Worker reminder endpoints are `POST /api/reminders/run` and `POST /api/run-scheduled-reminders`; they require header `X-Reminder-Runner-Secret`, and the Worker must forward the same secret to Apps Script as internal auth for `runScheduledReminderNotifications`.

## Permission Rules
- Permissions are managed centrally.
- Add new permissions to the admin management UI.
- Check permissions before rendering actions.
- `bookings_assign_central_vehicle` defaults to `ADMIN` and `STAFF` only.
- `bookings_assign_central_vehicle` and `bookings_backdate_complete` are action permissions and must not be hard-coded to UI roles.
- `bookings_complete_on_behalf` is an action permission managed in the admin permission UI; `USER` may use it only on bookings they own, while `STAFF` and `ADMIN` follow the configured action-permission grants.
- `USER` may view all bookings and calendar entries, but may edit or cancel only their own booking.
- `DRIVER` can access only their own records.
- `ADMIN` and `STAFF` have full access.

## Session Rules
- Frontend login persistence uses both `odc_user` and `odc_session_expires_at`.
- Default session lifetime is 30 minutes unless a frontend config explicitly overrides it.
- App startup must reject persisted login when the expiry is missing or already expired, and logout/timeout cleanup must remove both keys together.
- User activity may extend the current session expiry, but must not change booking, permission, or page business rules.

## UI Rules
- Use a clean government-style layout with large readable fonts.
- Avoid cramped tables, tiny buttons, and overly complex layouts.
- Tables must support empty states and readable mobile overflow.
- Use SweetAlert2 for modal flows.
- NotificationBell delete controls must stay compact, preserve the unread dot and category badge, and avoid crowding the mobile card layout.

## Cleanup Rules
- `clearOldNotifications()` should run daily around `02:00` Asia/Bangkok, remove `Notifications` rows older than 14 days, and clean `NotificationDeletes` rows that are older than 14 days or point to missing notifications.
- Notification cleanup must use `LockService` plus batched sheet operations where possible so concurrent cleanup runs do not delete overlapping rows.

## Loading Rules
- Prefer shared skeleton components from `src/components/skeletons/`.
- Avoid plain loading text on major pages.
- Do not render heavy calendar widgets before loading completes.
- Use `useMinimumLoading(loading, 350)` for page-level loading where flicker is a risk.
