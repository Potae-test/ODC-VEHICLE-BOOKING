const API_BASE_URL = "https://odc-vehicle-api.kooysky.workers.dev";
// const API_BASE_URL = "http://localhost:8787";

const API_CACHE_TTL_MS = 60000;
const apiCache = new Map();

function cloneData(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function invalidateApiCache(keys) {
  keys.forEach((key) => apiCache.delete(key));
}

function emitNotificationsRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("odc-notifications-refresh"));
}

function getStoredCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("odc_user") || "null");
  } catch {
    return null;
  }
}

function withCurrentUserMeta(payload = {}) {
  const user = getStoredCurrentUser() || {};
  return {
    ...payload,
    current_user_id: payload.current_user_id || user.user_id || "",
    current_user_role: payload.current_user_role || user.role || "",
    current_user_name: payload.current_user_name || user.name || user.email || "",
  };
}

function getStoredSessionToken() {
  try {
    return localStorage.getItem("odc_session_token") || "";
  } catch {
    return "";
  }
}

function getAuthHeaders(extraHeaders = {}) {
  const token = getStoredSessionToken();
  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchJson(url, options) {
  const { skipAuth, headers, ...fetchOptions } = options || {};
  const mergedHeaders = skipAuth
    ? { ...(headers || {}) }
    : getAuthHeaders(headers || {});
  const res = await fetch(url, {
    ...fetchOptions,
    headers: mergedHeaders,
  });
  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message || "Request failed");
  }

  return json;
}

async function getCachedCollection(key, fetcher) {
  const now = Date.now();
  const entry = apiCache.get(key);

  if (entry?.data && now - entry.timestamp < API_CACHE_TTL_MS) {
    return cloneData(entry.data);
  }

  if (entry?.promise) {
    const data = await entry.promise;
    return cloneData(data);
  }

  const promise = (async () => {
    try {
      const data = await fetcher();
      apiCache.set(key, {
        data,
        timestamp: Date.now(),
        promise: null,
      });
      return data;
    } catch (err) {
      apiCache.delete(key);
      throw err;
    }
  })();

  apiCache.set(key, {
    data: entry?.data || null,
    timestamp: entry?.timestamp || 0,
    promise,
  });

  const data = await promise;
  return cloneData(data);
}

async function apiRequest(action, options = {}) {
  const isDeletePayload = action.startsWith("delete") && options && !options.method;

  if (options.method === "POST" || isDeletePayload) {
    const json = await fetchJson(`${API_BASE_URL}/api/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        data: withCurrentUserMeta(options.body || options || {}),
      }),
    });

    return json;
  }

  if (options.fresh) {
    const json = await fetchJson(`${API_BASE_URL}/api/${action}?ts=${Date.now()}`);
    return json.data || [];
  }

  return getCachedCollection(action, async () => {
    const json = await fetchJson(`${API_BASE_URL}/api/${action}`);
    return json.data || [];
  });
}

function toVehiclePayload(data = {}) {
  const vehicleName = data.vehicle_name ?? data.vehicle_code ?? "";
  const licensePlate = data.license_plate ?? data.plate_no ?? "";
  const note = data.note ?? data.driver_name ?? data.next_booking ?? "";

  return {
    vehicle_id: data.vehicle_id,
    vehicle_name: vehicleName,
    vehicle_code: data.vehicle_code ?? vehicleName,
    license_plate: licensePlate,
    plate_no: data.plate_no ?? licensePlate,
    vehicle_type: data.vehicle_type ?? "",
    status: data.status ?? "AVAILABLE",
    note,
    driver_name: data.driver_name ?? note,
    next_booking: data.next_booking ?? "",
  };
}

// ---------------------
// VEHICLES
// ---------------------

export async function getVehicles() {
  return getCachedCollection("vehicles", async () => {
    const json = await fetchJson(`${API_BASE_URL}/api/vehicles`);

    return (json.data || []).map((vehicle) => {
      const vehicleName = vehicle.vehicle_name ?? vehicle.vehicle_code ?? "";
      const licensePlate = vehicle.license_plate ?? vehicle.plate_no ?? "";
      const note = vehicle.note ?? vehicle.driver_name ?? vehicle.next_booking ?? "";

      return {
        ...vehicle,
        vehicle_name: vehicleName,
        vehicle_code: vehicle.vehicle_code ?? vehicleName,
        license_plate: licensePlate,
        plate_no: vehicle.plate_no ?? licensePlate,
        note,
        driver_name: vehicle.driver_name ?? note,
      };
    });
  });
}

export async function createVehicle(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/vehicles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withCurrentUserMeta(toVehiclePayload(data))),
  });

  invalidateApiCache(["vehicles", "bookings"]);
  return json.data;
}

export async function updateVehicle(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/vehicles/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(toVehiclePayload(data))),
  });

  invalidateApiCache(["vehicles", "bookings"]);
  return json.data;
}

export async function deleteVehicle(vehicle_id) {
  const json = await fetchJson(`${API_BASE_URL}/api/vehicles/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta({ vehicle_id })),
  });

  invalidateApiCache(["vehicles", "bookings"]);
  return json.data;
}

// ---------------------
// BOOKINGS
// ---------------------

export async function getBookings(options = {}) {
  if (options.fresh) {
    const json = await fetchJson(`${API_BASE_URL}/api/bookings?ts=${Date.now()}`);
    return (json.data || []).map((booking) => ({
      ...booking,
      assigned_user_id: booking.assigned_user_id ?? booking.driver_id ?? "",
      assigned_user_name: booking.assigned_user_name ?? booking.driver_name ?? "",
    }));
  }

  return getCachedCollection("bookings", async () => {
    const json = await fetchJson(`${API_BASE_URL}/api/bookings`);
    return (json.data || []).map((booking) => ({
      ...booking,
      assigned_user_id: booking.assigned_user_id ?? booking.driver_id ?? "",
      assigned_user_name: booking.assigned_user_name ?? booking.driver_name ?? "",
    }));
  });
}

export async function getBookingsFresh() {
  return getBookings({ fresh: true });
}

export async function getNotifications(params = {}) {
  const search = new URLSearchParams();

  if (params.user_id) search.set("user_id", params.user_id);
  if (params.role) search.set("role", params.role);
  search.set("ts", String(Date.now()));

  const json = await fetchJson(`${API_BASE_URL}/api/notifications?${search.toString()}`);
  return {
    items: json.data || [],
    unreadCount: Number(json.unread_count || 0),
  };
}

export async function markNotificationRead(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/notifications/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data || {}),
  });

  invalidateApiCache(["notifications"]);
  return json.data || json;
}

export async function markAllNotificationsRead(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/notifications/read-all`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data || {}),
  });

  invalidateApiCache(["notifications"]);
  return json.data || json;
}

export async function deleteNotification(notification_id) {
  const json = await fetchJson(`${API_BASE_URL}/api/notifications/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withCurrentUserMeta({ notification_id })),
  });

  invalidateApiCache(["notifications"]);
  emitNotificationsRefresh();
  return json.data || json;
}

export async function deleteAllNotifications(notificationIds = []) {
  const json = await fetchJson(`${API_BASE_URL}/api/notifications/delete-all`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withCurrentUserMeta({ notification_ids: notificationIds })),
  });

  invalidateApiCache(["notifications"]);
  emitNotificationsRefresh();
  return json.data || json;
}

export async function savePushSubscription(data) {
  const fcmToken = String(data?.fcm_token ?? "").trim();
  const endpoint = String(data?.endpoint ?? data?.subscription?.endpoint ?? "").trim();
  const p256dh = String(data?.p256dh ?? data?.subscription?.keys?.p256dh ?? "").trim();
  const auth = String(data?.auth ?? data?.subscription?.keys?.auth ?? "").trim();
  const provider =
    fcmToken
      ? "FCM"
      : endpoint && p256dh && auth
        ? "WEB_PUSH"
        : String(data?.provider ?? "").trim().toUpperCase();
  const payload = {
    ...data,
    fcm_token: fcmToken,
    endpoint,
    p256dh,
    auth,
    provider,
  };
  const json = await fetchJson(`${API_BASE_URL}/api/push-subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return json.data || json;
}

export async function disablePushSubscription(value) {
  const payload = typeof value === "string" ? { endpoint: value } : (value || {});
  const json = await fetchJson(`${API_BASE_URL}/api/push-subscriptions/disable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return json.data || json;
}

export async function getDriverJobLogs(options = {}) {
  return apiRequest("driver_job_logs", options);
}

export async function getBookingCancellationHistory() {
  return getCachedCollection("booking-cancellations", async () => {
    const json = await fetchJson(`${API_BASE_URL}/api/bookings/cancellations`);
    return json.data || [];
  });
}

export async function deleteBookingCancellationHistory(input) {
  const payload =
    typeof input === "object"
      ? input
      : {
          cancellation_id: input,
          booking_id: input,
          id: input,
        };

  const json = await fetchJson(`${API_BASE_URL}/api/bookings/cancellations/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withCurrentUserMeta(payload)),
  });

  invalidateApiCache(["booking-cancellations"]);

  return json.data || json;
}

export async function createBooking(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["bookings"]);
  emitNotificationsRefresh();
  return json.data;
}

export async function approveBooking(data) {
  const payload = {
    booking_id: data.booking_id,
    booking_no: data.booking_no,
    vehicle_id: data.vehicle_id,
    assigned_user_id: data.assigned_user_id ?? data.driver_id ?? "",
    assigned_user_name: data.assigned_user_name ?? data.driver_name ?? "",
    staff_note: data.staff_note ?? "",
    driver_id: data.driver_id ?? "",
    driver_name: data.driver_name ?? "",
  };

  const json = await fetchJson(`${API_BASE_URL}/api/bookings/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withCurrentUserMeta(payload)),
  });

  invalidateApiCache(["bookings", "driver_job_logs"]);
  emitNotificationsRefresh();
  return json.data;
}

export async function assignCentralVehicle(payload) {
  const json = await fetchJson(`${API_BASE_URL}/api/bookings/assign-central-vehicle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(payload || {})),
  });

  invalidateApiCache(["bookings", "notifications", "driver_summary", "driver_job_logs"]);
  emitNotificationsRefresh();
  return json.data || json;
}

export async function backdateCompleteBooking(payload) {
  invalidateApiCache(["bookings", "driver_job_logs"]);
  const json = await fetchJson(`${API_BASE_URL}/api/backdate_complete_booking`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withCurrentUserMeta(payload || {})),
  });

  emitNotificationsRefresh();
  return json;
}

export async function startTrip(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/bookings/start-trip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["bookings", "driver_job_logs"]);
  emitNotificationsRefresh();
  return json.data || json;
}

export async function completeTrip(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/bookings/complete-trip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["bookings", "driver_job_logs"]);
  emitNotificationsRefresh();
  return json.data;
}

export async function completeBookingOnBehalf(payload) {
  const json = await fetchJson(`${API_BASE_URL}/api/bookings/complete-on-behalf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(payload || {})),
  });

  invalidateApiCache(["bookings", "driver_job_logs"]);
  emitNotificationsRefresh();
  return json;
}

export async function driverCancelJob(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/bookings/driver-cancel-job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["bookings", "driver_job_logs"]);
  return json.data;
}

export async function requestDriverCancelJob(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/requestDriverCancelJob`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["bookings", "driver_job_logs"]);
  emitNotificationsRefresh();
  return json.data || json;
}

export async function withdrawDriverCancelRequest(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/withdrawDriverCancelRequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["bookings", "driver_job_logs"]);
  emitNotificationsRefresh();
  return json.data || json;
}

export async function reviewDriverCancelRequest(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/reviewDriverCancelRequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["bookings", "driver_job_logs"]);
  emitNotificationsRefresh();
  return json.data || json;
}

export async function cancelBooking(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/bookings/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["bookings", "booking-cancellations"]);
  emitNotificationsRefresh();
  return json.data;
}

export async function unassignBookingDriver(payload) {
  const json = await fetchJson(`${API_BASE_URL}/api/unassign_booking_driver`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });

  invalidateApiCache(["bookings", "driver_job_logs"]);
  emitNotificationsRefresh();
  return json.data || json;
}

export async function updateBooking(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/bookings/update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["bookings"]);
  emitNotificationsRefresh();
  return json.data;
}

// ---------------------
// DRIVER UNAVAILABLE
// ---------------------

export async function getDriverUnavailable(options = {}) {
  return apiRequest("getDriverUnavailable", options);
}

export async function getDriverUnavailableLogs(options = {}) {
  return apiRequest("getDriverUnavailableLogs", options);
}

export async function getThaiHolidays(options = {}) {
  return apiRequest("thai_holidays", options);
}

export async function createDriverUnavailable(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/createDriverUnavailable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["getDriverUnavailable", "getDriverUnavailableLogs"]);
  return json.data;
}

export async function updateDriverUnavailable(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/updateDriverUnavailable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["getDriverUnavailable", "getDriverUnavailableLogs"]);
  return json.data;
}

export async function cancelDriverUnavailable(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/cancelDriverUnavailable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["getDriverUnavailable", "getDriverUnavailableLogs"]);
  return json.data;
}

export async function checkDriverUnavailable(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/checkDriverUnavailable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return json.data;
}

// ---------------------
// DRIVER QUEUE
// ---------------------

export async function getDriverQueue(options = {}) {
  if (options.fresh) {
    const json = await fetchJson(`${API_BASE_URL}/api/getDriverQueue?ts=${Date.now()}`);
    return {
      data: json.data || [],
      state: json.state || null,
    };
  }

  return getCachedCollection("getDriverQueue", async () => {
    const json = await fetchJson(`${API_BASE_URL}/api/getDriverQueue`);
    return {
      data: json.data || [],
      state: json.state || null,
    };
  });
}

export async function getDriverQueueState(options = {}) {
  return apiRequest("getDriverQueueState", options);
}

export async function getDriverQueueLogs(options = {}) {
  return apiRequest("getDriverQueueLogs", options);
}

export async function deleteDriverQueueLog(payload) {
  return apiRequest("deleteDriverQueueLog", payload);
}

export async function updateDriverQueue(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/updateDriverQueue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["getDriverQueue", "getDriverQueueState", "getDriverQueueLogs", "bookings"]);
  emitNotificationsRefresh();
  return json.data;
}

export async function updateDriverQueueMaster(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/updateDriverQueueMaster`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["getDriverQueue", "getDriverQueueState", "getDriverQueueLogs", "bookings"]);
  return json.data || json;
}

export async function resetDriverQueueState(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/resetDriverQueueState`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["getDriverQueue", "getDriverQueueState", "getDriverQueueLogs", "bookings"]);
  return json.data;
}

export async function resetDriverQueuePointer(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/resetDriverQueuePointer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["getDriverQueue", "getDriverQueueState", "getDriverQueueLogs", "bookings"]);
  return json.data || json;
}

export async function setCurrentDriverQueuePointer(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/setCurrentDriverQueuePointer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["getDriverQueue", "getDriverQueueState", "getDriverQueueLogs", "bookings"]);
  return json.data || json;
}

export async function recommendDriverForBooking(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/recommendDriverForBooking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return json.data || json;
}

export async function confirmDriverQueueAssignment(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/confirmDriverQueueAssignment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["getDriverQueue", "getDriverQueueState", "getDriverQueueLogs", "bookings"]);
  emitNotificationsRefresh();
  return json.data;
}

// ---------------------
// AUTH
// ---------------------

export async function login(email, password) {
  const json = await fetchJson(`${API_BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    skipAuth: true,
    body: JSON.stringify({ email, password }),
  });

  const user = json.data || {};
  const token = user.session_token || user.token || "";
  const expiresAt = user.session_expires_at || user.expires_at || "";

  try {
    if (token) {
      localStorage.setItem("odc_session_token", String(token));
    }
    if (expiresAt) {
      localStorage.setItem("odc_session_expires_at", String(expiresAt));
    }
  } catch {
    // Ignore storage failures and keep login response unchanged.
  }

  return user;
}

export async function logoutSession() {
  const token = getStoredSessionToken();

  try {
    if (token) {
      await fetchJson(`${API_BASE_URL}/api/logout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token: token }),
      });
    }
  } finally {
    try {
      localStorage.removeItem("odc_session_token");
      localStorage.removeItem("odc_session_expires_at");
    } catch {
      // Ignore storage failures during logout cleanup.
    }
  }
}

// ---------------------
// DRIVERS
// ---------------------

export async function getDrivers(options = {}) {
  if (options.fresh) {
    const json = await fetchJson(`${API_BASE_URL}/api/drivers?ts=${Date.now()}`);
    return json.data || [];
  }

  return getCachedCollection("drivers", async () => {
    const json = await fetchJson(`${API_BASE_URL}/api/drivers`);
    return json.data || [];
  });
}

export async function createDriver(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/drivers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["drivers"]);
  return json.data;
}

export async function updateDriverStatus(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/drivers/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["drivers", "bookings"]);
  return json.data;
}

export async function updateDriver(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/drivers/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["drivers"]);
  return json.data;
}

export async function deleteDriver(driver_id) {
  const json = await fetchJson(`${API_BASE_URL}/api/drivers/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta({ driver_id })),
  });

  invalidateApiCache(["drivers", "bookings"]);
  return json.data;
}

// ---------------------
// USERS
// ---------------------

export async function getUsers(options = {}) {
  if (options.fresh) {
    const json = await fetchJson(`${API_BASE_URL}/api/users?ts=${Date.now()}`);
    return json.data || [];
  }

  return getCachedCollection("users", async () => {
    const json = await fetchJson(`${API_BASE_URL}/api/users`);
    return json.data || [];
  });
}

export async function createUser(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["users"]);
  return json.data;
}

export async function updateUser(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/users/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["users"]);
  return json.data;
}

export async function resetUserPassword(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/users/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentUserMeta(data)),
  });

  invalidateApiCache(["users"]);
  return json.data;
}

export async function disableUser(user_id) {
  const json = await fetchJson(`${API_BASE_URL}/api/users/disable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withCurrentUserMeta({ user_id })),
  });

  invalidateApiCache(["users"]);
  return json.data;
}

export async function deleteUser(user_id) {
  const json = await fetchJson(`${API_BASE_URL}/api/users/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withCurrentUserMeta({ user_id })),
  });

  invalidateApiCache(["users"]);
  return json.data;
}
