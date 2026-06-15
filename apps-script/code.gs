function doGet(e) {
  try {
    resetRequestCache_();
    const action = e && e.parameter
      ? e.parameter.action || "vehicles"
      : "vehicles";

  if (action === "vehicles") {
    return getVehicles();
  }

  if (action === "bookings") {
    return getBookings();
  }
  if (action === "getNotifications") {
    return getNotifications({
      user_id: e && e.parameter ? e.parameter.user_id : "",
      role: e && e.parameter ? e.parameter.role : "",
    });
  }
  if (action === "drivers") {
    return getDrivers();
  }
  if (action === "users") {
    return getUsers();
  }

  if (action === "bookingCancellations") {
    return getBookingCancellations();
  }

  if (action === "driver_job_logs") {
    return getDriverJobLogs();
  }
  if (action === "getDriverUnavailable") {
    return getDriverUnavailable();
  }
  if (action === "thai_holidays" || action === "getThaiHolidays") {
    return jsonOutput({
      success: true,
      data: getThaiHolidays(),
    });
  }
  if (action === "getDriverUnavailableLogs") {
    return getDriverUnavailableLogs();
  }
  if (action === "getDriverQueue") {
    return getDriverQueue();
  }
  if (action === "getDriverQueueState") {
    return getDriverQueueState();
  }
  if (action === "getDriverQueueLogs") {
    return getDriverQueueLogs();
  }
  if (action === "getPushSubscriptionsByUserId") {
    return getPushSubscriptionsByUserId({
      user_id: e && e.parameter ? e.parameter.user_id : "",
      debug: e && e.parameter ? e.parameter.debug : "",
    });
  }
  
    return jsonOutput({
      success: false,
      message: "Invalid action"
    });
  } catch (err) {
    return jsonOutput({
      success: false,
      message: "Apps Script Error: " + String(err && err.message ? err.message : err),
      error: String(err && err.message ? err.message : err),
      stack: err && err.stack ? String(err.stack) : "",
    });
  }
}

function doPost(e) {
  try {
    resetRequestCache_();
    const body = JSON.parse(e && e.postData ? e.postData.contents || "{}" : "{}");
    const action = body.action;

    if (action === "createVehicle") return createVehicle(body.data);
    if (action === "createNotification") return createNotification(body.data);
    if (action === "createBooking") return createBooking(body.data);
    if (action === "updateBooking") return updateBooking(body.data);
    if (action === "approveBooking") return approveBooking(body.data);
    if (action === "assignCentralVehicle") return assignCentralVehicle(body.data);
    if (action === "startTrip") return startTrip(body.data);
    if (action === "completeTrip") return completeTrip(body.data);
    if (action === "backdate_complete_booking") return backdateCompleteBooking(body.data);
    if (action === "driverCancelJob") return driverCancelJob(body.data);
    if (action === "requestDriverCancelJob") return requestDriverCancelJob(body.data);
    if (action === "withdrawDriverCancelRequest") return withdrawDriverCancelRequest(body.data);
    if (action === "reviewDriverCancelRequest") return reviewDriverCancelRequest(body.data);
    if (action === "cancelBooking") return cancelBooking(body.data);
    if (action === "loginUser") return loginUser(body.data);
    if (action === "createDriver") return createDriver(body.data);
    if (action === "updateDriverStatus") return updateDriverStatus(body.data);
    if (action === "createUser") return createUser(body.data);
    if (action === "updateUser") return updateUser(body.data);
    if (action === "resetUserPassword") return resetUserPassword(body.data);
    if (action === "updateVehicle") return updateVehicle(body.data);
    if (action === "deleteVehicle") return deleteVehicle(body.data);
    if (action === "disableUser") return disableUser(body.data);
    if (action === "deleteUser") return deleteUser(body.data);
    if (action === "updateDriver") return updateDriver(body.data);
    if (action === "deleteDriver") return deleteDriver(body.data);
    if (action === "createDriverUnavailable") return createDriverUnavailable(body.data);
    if (action === "updateDriverUnavailable") return updateDriverUnavailable(body.data);
    if (action === "cancelDriverUnavailable") return cancelDriverUnavailable(body.data);
    if (action === "checkDriverUnavailable") return checkDriverUnavailable(body.data);
    if (action === "thai_holidays" || action === "getThaiHolidays") {
      return jsonOutput({
        success: true,
        data: getThaiHolidays(),
      });
    }
    if (action === "updateDriverQueue") return updateDriverQueue(body.data);
    if (action === "updateDriverQueueMaster") return updateDriverQueueMaster(body.data);
    if (action === "deleteDriverQueueLog") return deleteDriverQueueLog(body.data || body);
    if (action === "resetDriverQueueState") return resetDriverQueueState(body.data);
    if (action === "resetDriverQueuePointer") return resetDriverQueuePointer(body.data);
    if (action === "setCurrentDriverQueuePointer") return setCurrentDriverQueuePointer(body.data);
    if (action === "recommendDriverForBooking") return recommendDriverForBooking(body.data);
    if (action === "confirmDriverQueueAssignment") return confirmDriverQueueAssignment(body.data);
    if (action === "markNotificationRead") return markNotificationRead(body.data);
    if (action === "markAllNotificationsRead") return markAllNotificationsRead(body.data);
    if (action === "savePushSubscription") return savePushSubscription(body.data);
    if (action === "disablePushSubscription") return disablePushSubscription(body.data);
    if (action === "getPushSubscriptionsByUserId") return getPushSubscriptionsByUserId(body.data || body);
    if (action === "sendBookingReminderNotifications1Hour") return sendBookingReminderNotifications1Hour(body.data || body);
    if (action === "unassign_booking_driver") return unassignBookingDriver(body.data);
    if (action === "deleteBookingCancellationHistory" || action === "delete_booking_cancellation_history") return deleteBookingCancellationHistory(body.data || body);
  
    return jsonOutput({
      success: false,
      message: "Invalid action: " + action
    });

  } catch (err) {
    return jsonOutput({
      success: false,
      message: "Apps Script Error: " + String(err && err.message ? err.message : err),
      error: String(err && err.message ? err.message : err),
      stack: err && err.stack ? String(err.stack) : ""
    });
  }
}
function getVehicles() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Vehicles");

  const { headers, rows } = readSheetTable(sheet);

  if (rows.length === 0) {
    return jsonOutput({
      success: true,
      total: 0,
      data: []
    });
  }

  const data = rowsToObjects(headers, rows).map((vehicle) => ({
    ...vehicle,
    vehicle_type: vehicle.vehicle_type || "",
    plate_no: vehicle.plate_no || "",
    status: normalizeVehicleStatus(vehicle.status),
  }));

  return jsonOutput({
    success: true,
    total: data.length,
    data: data
  });
}

function normalizeVehicleStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "MAINTENANCE" || normalized === "INACTIVE") return "UNAVAILABLE";
  if (normalized === "IN_USE") return "IN_USE";
  if (normalized === "UNAVAILABLE") return "UNAVAILABLE";
  return "AVAILABLE";
}

function createVehicle(data) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Vehicles");

  const now = new Date();

  const vehicleId = "VH" + Utilities.formatString(
    "%03d",
    sheet.getLastRow()
  );

  appendSheetRow(sheet, [
    vehicleId,
    data.vehicle_code || "",
    data.vehicle_type || "",
    data.plate_no || "",
    normalizeVehicleStatus(data.status),
    data.driver_name || "-",
    data.next_booking || "-",
  ]);

  return jsonOutput({
    success: true,
    message: "Create vehicle success",
    data: {
      vehicle_id: vehicleId,
      ...data,
      status: normalizeVehicleStatus(data.status)
    }
  });
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function bytesToHex_(bytes) {
  return bytes.map(function (byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ("0" + value.toString(16)).slice(-2);
  }).join("");
}

function makePasswordSalt_() {
  return Utilities.getUuid().replace(/-/g, "");
}

function sha256Hex_(value) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || ""),
    Utilities.Charset.UTF_8
  );
  return bytesToHex_(digest);
}

function hashPassword_(password, salt) {
  const resolvedSalt = salt || makePasswordSalt_();
  const hash = sha256Hex_(resolvedSalt + ":" + String(password || ""));
  return "HASH$SHA256$" + resolvedSalt + "$" + hash;
}

function isHashedPassword_(value) {
  return String(value || "").indexOf("HASH$SHA256$") === 0;
}

function verifyPasswordHash_(inputPassword, storedHash) {
  const stored = String(storedHash || "").trim();
  if (!isHashedPassword_(stored)) return false;

  const parts = stored.split("$");
  if (parts.length !== 4) return false;

  const salt = parts[2];
  const expectedHash = parts[3];
  const actualHash = sha256Hex_(salt + ":" + String(inputPassword || ""));

  return actualHash === expectedHash;
}

function getSheetByName_(sheetName) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
}

function getHeaders_(sheet) {
  if (!sheet) return [];
  const lastColumn = sheet.getLastColumn();
  if (lastColumn <= 0) return [];
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0] || [];
}

function appendDriverJobLog_(payload) {
  const sheet = getSheetByName_("DriverJobLogs");
  if (!sheet) return;

  const headers = getHeaders_(sheet);
  ensureColumn(sheet, headers, "status");
  ensureColumn(sheet, headers, "assigned_user_id");
  ensureColumn(sheet, headers, "assigned_user_name");
  ensureColumn(sheet, headers, "assigned_by_name");
  ensureColumn(sheet, headers, "assigned_by");
  const row = headers.map((header) => payload[header] ?? "");
  sheet.appendRow(row);
}

function createDriverJobLogPayload_(data) {
  const actor = String(
    data.assigned_by_name ||
    data.created_by ||
    data.updated_by ||
    data.staff_name ||
    ""
  ).trim();
  const assignedByName = String(
    data.assigned_by_name || actor
  ).trim();
  const assignedBy = String(
    data.assigned_by || assignedByName
  ).trim();

  return {
    log_id: "DJL-" + Date.now(),
    booking_id: data.booking_id || "",
    booking_no: data.booking_no || "",
    driver_user_id: data.driver_user_id || "",
    driver_name: data.driver_name || "",
    vehicle_id: data.vehicle_id || "",
    status: data.status || "",
    assigned_user_id: data.assigned_user_id || data.driver_user_id || "",
    assigned_user_name: data.assigned_user_name || data.driver_name || "",
    action: data.action || "",
    reason: data.reason || "",
    requester_name: data.requester_name || "",
    start_datetime: data.start_datetime || "",
    end_datetime: data.end_datetime || "",
    destination: data.destination || "",
    purpose: data.purpose || "",
    created_at: new Date().toISOString(),
    created_by: actor,
    assigned_by_name: assignedByName,
    assigned_by: assignedBy,
  };
}

function ensureColumn(sheet, headers, columnName) {
  let index = headers.indexOf(columnName);

  if (index === -1) {
    index = headers.length;
    sheet.getRange(1, index + 1).setValue(columnName);
    headers.push(columnName);
  }

  return index;
}

function normalizePhone_(value) {
  return String(value || "").trim();
}

function ensureTextColumn_(sheet, headers, columnName) {
  const colIndex = headers.indexOf(columnName);
  if (colIndex < 0) return;

  sheet
    .getRange(2, colIndex + 1, Math.max(sheet.getMaxRows() - 1, 1), 1)
    .setNumberFormat("@");
}

function buildColumnMap(headers) {
  const columnMap = {};
  headers.forEach((header, index) => {
    columnMap[header] = index;
  });
  return columnMap;
}

function appendSheetRow(sheet, values) {
  const nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 1, 1, values.length).setValues([values]);
  invalidateSheetCache_(sheet);
  return nextRow;
}

function setRowValues(sheet, row, values) {
  sheet.getRange(row, 1, 1, values.length).setValues([values]);
  invalidateSheetCache_(sheet);
}

var REQUEST_CACHE_ = null;

function resetRequestCache_() {
  REQUEST_CACHE_ = {
    sheetTables: {},
    createdNotifications: [],
  };
}

function getRequestCache_() {
  if (!REQUEST_CACHE_) {
    resetRequestCache_();
  }

  return REQUEST_CACHE_;
}

function getSheetCacheKey_(sheet) {
  return `${sheet.getSheetId()}:${sheet.getName()}`;
}

function trackCreatedNotification_(notification) {
  if (!notification || !notification.notification_id) return;

  const cache = getRequestCache_();
  const exists = cache.createdNotifications.some(function (item) {
    return String(item.notification_id || "").trim() === String(notification.notification_id || "").trim();
  });

  if (!exists) {
    cache.createdNotifications.push(notification);
  }
}

function getCreatedNotifications_() {
  const cache = getRequestCache_();
  return (cache.createdNotifications || []).slice();
}

function invalidateSheetCache_(sheetOrName) {
  const cache = getRequestCache_();

  if (!sheetOrName) return;

  if (typeof sheetOrName === "string") {
    Object.keys(cache.sheetTables).forEach((key) => {
      if (key.endsWith(`:${sheetOrName}`)) {
        delete cache.sheetTables[key];
      }
    });
    return;
  }

  delete cache.sheetTables[getSheetCacheKey_(sheetOrName)];
}

function readSheetTable(sheetOrName) {
  const sheet = typeof sheetOrName === "string"
    ? SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetOrName)
    : sheetOrName;
  const cache = getRequestCache_();
  const cacheKey = getSheetCacheKey_(sheet);

  if (cache.sheetTables[cacheKey]) {
    return cache.sheetTables[cacheKey];
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow === 0 || lastColumn === 0) {
    const emptyTable = {
      sheet,
      headers: [],
      rows: [],
      columnMap: {},
    };
    cache.sheetTables[cacheKey] = emptyTable;
    return emptyTable;
  }

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0] || [];

  const table = {
    sheet,
    headers,
    rows: lastRow > 1 ? values.slice(1) : [],
    columnMap: getHeaderMap(headers),
  };
  cache.sheetTables[cacheKey] = table;
  return table;
}

function getSheetDataCached(sheetName) {
  return readSheetTable(sheetName);
}

function getHeaderMap(headers) {
  return buildColumnMap(headers);
}

function rowsToObjects(headers, rows) {
  return rows.map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

function ensureBookingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Bookings");

  const legacyHeaders = [
    "booking_id",
    "booking_no",
    "requester_name",
    "requester_user_id",
    "department",
    "phone",
    "start_datetime",
    "end_datetime",
    "destination",
    "purpose",
    "vehicle_type_request",
    "vehicle_id",
    "assigned_user_id",
    "assigned_user_name",
    "status",
    "staff_note",
    "created_by_user_id",
    "created_at",
    "updated_at",
  ];
  const baseHeaders = [
    ...legacyHeaders,
    "is_backdated",
    "backdated_completed_at",
    "backdated_completed_by",
  ];
  const headers = [
    ...baseHeaders,
    "assignment_mode",
    "central_vehicle_reason",
    "central_vehicle_completed_at",
    "central_vehicle_completed_by",
    "driver_cancel_request_status",
    "driver_cancel_request_reason",
    "driver_cancel_requested_by",
    "driver_cancel_requested_by_user_id",
    "driver_cancel_requested_at",
    "driver_cancel_review_status",
    "driver_cancel_review_reason",
    "driver_cancel_reviewed_by",
    "driver_cancel_reviewed_at",
  ];

  if (!sheet) {
    sheet = ss.insertSheet("Bookings");
  }

  ensureSheetColumns_(sheet, headers);
  return sheet;
}

function ensureSheetColumns_(sheet, requiredHeaders) {
  if (!sheet) {
    throw new Error("Sheet is required");
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return requiredHeaders.slice();
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map((header) => String(header || "").trim());

  requiredHeaders.forEach((header) => {
    if (!headers.includes(header)) {
      headers.push(header);
      sheet.getRange(1, headers.length).setValue(header);
    }
  });

  return headers;
}

function ensureNotificationsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Notifications");
  const headers = [
    "notification_id",
    "target_user_id",
    "target_role",
    "category",
    "title",
    "message",
    "type",
    "booking_id",
    "url",
    "is_read",
    "created_at",
    "read_at",
    "created_by",
    "payload_json",
  ];

  if (!sheet) {
    sheet = ss.insertSheet("Notifications");
  }

  ensureSheetColumns_(sheet, headers);
  return sheet;
}

function ensurePushSubscriptionsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("PushSubscriptions");
  const headers = [
    "subscription_id",
    "user_id",
    "endpoint",
    "p256dh",
    "auth",
    "fcm_token",
    "provider",
    "user_agent",
    "status",
    "created_at",
    "updated_at",
  ];

  if (!sheet) {
    sheet = ss.insertSheet("PushSubscriptions");
  }

  ensureSheetColumns_(sheet, headers);
  return sheet;
}

function ensureVehicleLogsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("VehicleLogs");

  const headers = [
    "log_id",
    "booking_id",
    "vehicle_id",
    "assigned_user_id",
    "assigned_user_name",
    "out_time",
    "out_mileage",
    "in_time",
    "in_mileage",
    "remark",
    "created_at",
    "updated_at"
  ];

  if (!sheet) {
    sheet = ss.insertSheet("VehicleLogs");
  }

  ensureSheetColumns_(sheet, headers);
  return sheet;
}

function ensureBookingActivityLogsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("BookingActivityLogs");

  const headers = [
    "log_id",
    "booking_id",
    "event_type",
    "event_title",
    "detail",
    "actor_name",
    "actor_user_id",
    "old_driver_user_id",
    "old_driver_name",
    "new_driver_user_id",
    "new_driver_name",
    "old_vehicle_id",
    "new_vehicle_id",
    "created_at",
    "payload_json",
  ];

  if (!sheet) {
    sheet = ss.insertSheet("BookingActivityLogs");
  }

  ensureSheetColumns_(sheet, headers);
  return sheet;
}

function normalizeBookingActivityText_(value) {
  return String(value || "").trim();
}

function normalizeBookingActivityTimestamp_(value) {
  if (!value) return new Date().toISOString();

  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString();
  }

  return String(value || "").trim();
}

function appendBookingActivityLog(bookingId, eventType, payload) {
  const normalizedBookingId = normalizeBookingActivityText_(bookingId);
  const normalizedEventType = normalizeBookingActivityText_(eventType);

  if (!normalizedBookingId || !normalizedEventType) return null;

  const sheet = ensureBookingActivityLogsSheet();
  const table = readSheetTable(sheet);
  const headers = table.headers;
  const rowValues = Array(headers.length).fill("");
  const createdAt = normalizeBookingActivityTimestamp_(payload && payload.created_at);

  rowValues[ensureColumn(sheet, headers, "log_id")] = "BAL-" + Date.now();
  rowValues[ensureColumn(sheet, headers, "booking_id")] = normalizedBookingId;
  rowValues[ensureColumn(sheet, headers, "event_type")] = normalizedEventType;
  rowValues[ensureColumn(sheet, headers, "event_title")] = normalizeBookingActivityText_(
    payload && (payload.event_title || payload.title || normalizedEventType)
  );
  rowValues[ensureColumn(sheet, headers, "detail")] = normalizeBookingActivityText_(payload && payload.detail);
  rowValues[ensureColumn(sheet, headers, "actor_name")] = normalizeBookingActivityText_(
    payload && (payload.actor_name || payload.actor || payload.created_by || payload.updated_by || payload.completed_by || payload.cancelled_by || payload.requested_by || payload.reviewed_by)
  );
  rowValues[ensureColumn(sheet, headers, "actor_user_id")] = normalizeBookingActivityText_(
    payload && (payload.actor_user_id || payload.created_by_user_id || payload.updated_by_user_id || payload.completed_by_user_id)
  );
  rowValues[ensureColumn(sheet, headers, "old_driver_user_id")] = normalizeBookingActivityText_(payload && payload.old_driver_user_id);
  rowValues[ensureColumn(sheet, headers, "old_driver_name")] = normalizeBookingActivityText_(payload && payload.old_driver_name);
  rowValues[ensureColumn(sheet, headers, "new_driver_user_id")] = normalizeBookingActivityText_(payload && payload.new_driver_user_id);
  rowValues[ensureColumn(sheet, headers, "new_driver_name")] = normalizeBookingActivityText_(payload && payload.new_driver_name);
  rowValues[ensureColumn(sheet, headers, "old_vehicle_id")] = normalizeBookingActivityText_(payload && payload.old_vehicle_id);
  rowValues[ensureColumn(sheet, headers, "new_vehicle_id")] = normalizeBookingActivityText_(payload && payload.new_vehicle_id);
  rowValues[ensureColumn(sheet, headers, "created_at")] = createdAt;
  rowValues[ensureColumn(sheet, headers, "payload_json")] = safeStringifyNotificationPayload_(payload || {});

  appendSheetRow(sheet, rowValues);
  return rowsToObjects(headers, [rowValues])[0] || null;
}

function buildBookingActivityLogsMap_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("BookingActivityLogs");
  if (!sheet) return {};

  const table = readSheetTable(sheet);
  if (!table.rows.length) return {};

  const data = rowsToObjects(table.headers, table.rows);
  const map = {};

  data.forEach((entry) => {
    const bookingId = normalizeBookingActivityText_(entry.booking_id);
    if (!bookingId) return;

    if (!map[bookingId]) {
      map[bookingId] = [];
    }

    map[bookingId].push({
      log_id: normalizeBookingActivityText_(entry.log_id),
      booking_id: bookingId,
      event_type: normalizeBookingActivityText_(entry.event_type),
      event_title: normalizeBookingActivityText_(entry.event_title || entry.event_type),
      detail: normalizeBookingActivityText_(entry.detail),
      actor_name: normalizeBookingActivityText_(entry.actor_name),
      actor_user_id: normalizeBookingActivityText_(entry.actor_user_id),
      old_driver_user_id: normalizeBookingActivityText_(entry.old_driver_user_id),
      old_driver_name: normalizeBookingActivityText_(entry.old_driver_name),
      new_driver_user_id: normalizeBookingActivityText_(entry.new_driver_user_id),
      new_driver_name: normalizeBookingActivityText_(entry.new_driver_name),
      old_vehicle_id: normalizeBookingActivityText_(entry.old_vehicle_id),
      new_vehicle_id: normalizeBookingActivityText_(entry.new_vehicle_id),
      created_at: normalizeBookingActivityTimestamp_(entry.created_at),
      payload_json: normalizeBookingActivityText_(entry.payload_json),
    });
  });

  Object.keys(map).forEach((bookingId) => {
    map[bookingId].sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });
  });

  return map;
}

function enrichBookingWithActivityData_(booking, activityLogsMap) {
  const bookingId = normalizeBookingActivityText_(booking && booking.booking_id);
  const timeline = bookingId && activityLogsMap && activityLogsMap[bookingId]
    ? activityLogsMap[bookingId].slice()
    : [];

  return {
    ...booking,
    timeline,
    activity_logs: timeline.slice(),
    booking_logs: timeline.slice(),
    audit_logs: timeline.slice(),
    history: timeline.slice(),
  };
}

function buildBookingResponseWithActivityData_(booking, userLookup) {
  const bookingObject = booking ? { ...booking } : {};
  if (userLookup) {
    applyAssignedUserFallback(bookingObject, userLookup);
  }
  return enrichBookingWithActivityData_(bookingObject, buildBookingActivityLogsMap_());
}

function normalizeRoleValue_(role) {
  return String(role || "").trim().toUpperCase();
}

function normalizeNotificationReadValue_(value) {
  if (value === true) return true;
  return String(value || "").trim().toUpperCase() === "TRUE";
}

function safeStringifyNotificationPayload_(payload) {
  try {
    if (!payload) return "";
    if (typeof payload === "string") return payload;
    return JSON.stringify(payload);
  } catch (err) {
    return "";
  }
}

function formatThaiNotificationDateTime_(value) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value || "").trim();
  }

  const thaiMonthShortNames = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  const day = Utilities.formatDate(date, "Asia/Bangkok", "d");
  const monthIndex = Number(Utilities.formatDate(date, "Asia/Bangkok", "M")) - 1;
  const month = thaiMonthShortNames[monthIndex] || "";
  const christianYear = Number(Utilities.formatDate(date, "Asia/Bangkok", "yyyy")) || 0;
  const buddhistYear = christianYear > 0 ? christianYear + 543 : "";
  const time = Utilities.formatDate(date, "Asia/Bangkok", "HH:mm");

  return `${day} ${month} ${buddhistYear} เวลา ${time} น.`;
}

function buildRequesterDestinationStartMessage_(booking, fallbackMessage) {
  const requesterName = String(booking && booking.requester_name || "").trim();
  const destination = String(booking && booking.destination || "").trim();
  const startDatetime = formatThaiNotificationDateTime_(booking && booking.start_datetime || "");
  const parts = [];

  if (requesterName) parts.push(requesterName);
  if (destination) parts.push(destination);
  if (startDatetime) parts.push(startDatetime);

  return parts.length > 0 ? parts.join(" | ") : String(fallbackMessage || "").trim();
}

function buildDestinationStartMessage_(booking, fallbackMessage) {
  const destination = String(booking && booking.destination || "").trim();
  const startDatetime = formatThaiNotificationDateTime_(booking && booking.start_datetime || "");
  const parts = [];

  if (destination) parts.push(`ปลายทาง: ${destination}`);
  if (startDatetime) parts.push(`เวลาไป: ${startDatetime}`);

  return parts.length > 0 ? parts.join(" | ") : String(fallbackMessage || "").trim();
}

function buildDriverDestinationStartMessage_(booking, driverName, fallbackMessage) {
  const resolvedDriverName = String(driverName || booking && (booking.assigned_user_name || booking.driver_name) || "").trim();
  const destination = String(booking && booking.destination || "").trim();
  const startDatetime = formatThaiNotificationDateTime_(booking && booking.start_datetime || "");
  const parts = [];

  if (resolvedDriverName) parts.push(resolvedDriverName);
  if (destination) parts.push(destination);
  if (startDatetime) parts.push(startDatetime);

  return parts.length > 0 ? parts.join(" | ") : String(fallbackMessage || "").trim();
}

function buildDriverUnavailableNotificationMessage_(payload, includeReason) {
  const driverName = String(payload && payload.driver_name || "").trim();
  const startDatetime = formatThaiNotificationDateTime_(payload && payload.start_datetime || "");
  const endDatetime = formatThaiNotificationDateTime_(payload && payload.end_datetime || "");
  const unavailableType = getDriverUnavailableTypeDisplayLabel_(payload && payload.type || "");
  const parts = [];

  if (driverName) parts.push(driverName);
  if (startDatetime) parts.push(startDatetime);
  if (endDatetime) parts.push(endDatetime);
  if (unavailableType) parts.push(unavailableType);

  return parts.join(" | ");
}

function getDriverUnavailableTypeDisplayLabel_(value) {
  const raw = String(value || "").trim();
  const normalizedUpper = raw.toUpperCase();
  const normalizedLower = raw.toLowerCase();

  if (!raw) return "";
  if (
    normalizedUpper === "LEAVE" ||
    normalizedLower === "holiday" ||
    raw === "ลา" ||
    raw === "ลา / หยุด"
  ) {
    return "ลา / หยุด";
  }
  if (
    normalizedUpper === "TEMP_UNAVAILABLE" ||
    normalizedLower === "unable to complete a task." ||
    raw === "หยุด" ||
    raw === "ติดภารกิจ (ชั่วคราว)"
  ) {
    return "ติดภารกิจ (ชั่วคราว)";
  }
  if (
    normalizedUpper === "OUT_PROVINCE" ||
    normalizedUpper === "OTHER" ||
    raw === "ปฏิบัติงานต่างจังหวัด"
  ) {
    return "ปฏิบัติงานต่างจังหวัด";
  }

  return raw;
}

function inferNotificationCategory_(input) {
  const explicitCategory = String(input && input.category || "").trim();
  if (explicitCategory) return explicitCategory;

  const type = String(input && input.type || "").trim().toUpperCase();
  const title = String(input && input.title || "").trim();

  if (
    type.indexOf("CANCEL") >= 0 ||
    title.indexOf("ยกเลิก") >= 0
  ) {
    return "Cancellation";
  }

  if (
    type.indexOf("UNASSIGN") >= 0 ||
    type.indexOf("APPROVAL") >= 0 ||
    title.indexOf("อนุมัติ") >= 0 ||
    title.indexOf("ดึงรายการจองกลับ") >= 0
  ) {
    return "Approval";
  }

  if (
    type.indexOf("UNAVAILABLE") >= 0 ||
    type.indexOf("DRIVER_") === 0
  ) {
    return "Driver";
  }

  return "Booking";
}

function buildNotificationPayloadFromBooking_(booking, overrides) {
  const source = booking || {};
  const next = {
    booking_id: String(source.booking_id || "").trim(),
    booking_no: String(source.booking_no || "").trim(),
    requester_name: String(source.requester_name || "").trim(),
    driver_name: String(source.assigned_user_name || source.driver_name || "").trim(),
    destination: String(source.destination || "").trim(),
    start_datetime: String(source.start_datetime || "").trim(),
    end_datetime: String(source.end_datetime || "").trim(),
  };

  Object.keys(overrides || {}).forEach((key) => {
    const value = overrides[key];
    next[key] = value === undefined || value === null ? "" : value;
  });

  return next;
}

function buildNotificationRecord_(data) {
  const nowIso = new Date().toISOString();

  return {
    notification_id: "NTF-" + Utilities.getUuid(),
    target_user_id: String(data && data.target_user_id || "").trim(),
    target_role: normalizeRoleValue_(data && data.target_role || ""),
    category: inferNotificationCategory_(data),
    title: String(data && data.title || "").trim(),
    message: String(data && data.message || "").trim(),
    type: String(data && data.type || "").trim(),
    booking_id: String(data && data.booking_id || "").trim(),
    url: String(data && data.url || "").trim(),
    is_read: false,
    created_at: nowIso,
    read_at: "",
    created_by: String(data && data.created_by || "").trim(),
    payload_json: safeStringifyNotificationPayload_(data && data.payload_json),
  };
}

function appendNotificationRecord_(data) {
  const record = buildNotificationRecord_(data);

  if (!record.target_user_id && !record.target_role) {
    throw new Error("target_user_id or target_role is required");
  }

  if (!record.title) {
    throw new Error("title is required");
  }

  if (!record.message) {
    throw new Error("message is required");
  }

  const sheet = ensureNotificationsSheet();
  const table = readSheetTable(sheet);
  const headers = table.headers;
  const duplicateWindowMs = 30 * 1000;
  const isStableReminderType = String(record.type || "").trim().toUpperCase() === "BOOKING_REMINDER_1H";

  for (let index = table.rows.length - 1; index >= 0; index -= 1) {
    const existing = rowsToObjects(headers, [table.rows[index]])[0] || {};
    const createdAt = new Date(existing.created_at || 0).getTime();

    if (
      isStableReminderType &&
      String(existing.target_user_id || "").trim() === record.target_user_id &&
      normalizeRoleValue_(existing.target_role || "") === record.target_role &&
      String(existing.type || "").trim().toUpperCase() === "BOOKING_REMINDER_1H" &&
      String(existing.booking_id || "").trim() === record.booking_id
    ) {
      return {
        ...record,
        notification_id: String(existing.notification_id || "").trim() || record.notification_id,
        category: String(existing.category || "").trim() || record.category,
        created_at: String(existing.created_at || "").trim() || record.created_at,
        is_read: normalizeNotificationReadValue_(existing.is_read),
        read_at: String(existing.read_at || "").trim(),
        payload_json: String(existing.payload_json || "").trim() || record.payload_json,
      };
    }

    if (!isStableReminderType && (!createdAt || Date.now() - createdAt > duplicateWindowMs)) {
      break;
    }

    if (
      String(existing.target_user_id || "").trim() === record.target_user_id &&
      normalizeRoleValue_(existing.target_role || "") === record.target_role &&
      String(existing.title || "").trim() === record.title &&
      String(existing.type || "").trim() === record.type &&
      String(existing.booking_id || "").trim() === record.booking_id &&
      String(existing.url || "").trim() === record.url &&
      String(existing.payload_json || "").trim() === record.payload_json
    ) {
      return {
        ...record,
        notification_id: String(existing.notification_id || "").trim() || record.notification_id,
        category: String(existing.category || "").trim() || record.category,
        created_at: String(existing.created_at || "").trim() || record.created_at,
        is_read: normalizeNotificationReadValue_(existing.is_read),
        read_at: String(existing.read_at || "").trim(),
        payload_json: String(existing.payload_json || "").trim() || record.payload_json,
      };
    }
  }

  const row = headers.map((header) => {
    if (header === "is_read") return false;
    return record[header] !== undefined ? record[header] : "";
  });

  appendSheetRow(sheet, row);
  trackCreatedNotification_(record);
  console.log("[push-debug] notification created", {
    notification_id: record.notification_id,
    target_user_id: record.target_user_id,
    target_role: record.target_role,
    category: record.category,
    title: record.title,
    type: record.type,
    booking_id: record.booking_id,
    created_at: record.created_at,
  });
  return record;
}

function buildNotificationMessageForBooking_(booking, fallbackMessage) {
  return buildRequesterDestinationStartMessage_(booking, fallbackMessage);
}

function createRoleNotifications_(roles, payload) {
  (roles || []).forEach((role) => {
    try {
      console.log("[push-debug] createRoleNotifications start", {
        target_role: normalizeRoleValue_(role),
        title: String(payload && payload.title || "").trim(),
        type: String(payload && payload.type || "").trim(),
        booking_id: String(payload && payload.booking_id || "").trim(),
      });
      appendNotificationRecord_({
        ...payload,
        target_user_id: "",
        target_role: normalizeRoleValue_(role),
      });
    } catch (err) {
      console.warn("createRoleNotifications_ failed", err);
    }
  });
}

function createDriverNotification_(userId, payload) {
  try {
    const targetUserId = String(userId || "").trim();
    if (!targetUserId) return;

    appendNotificationRecord_({
      ...payload,
      target_user_id: targetUserId,
      target_role: "",
    });
  } catch (err) {
    console.warn("createDriverNotification_ failed", err);
  }
}

function resolveRequesterNotificationUserId_(booking) {
  const target = booking || {};
  const candidateFields = [
    "requester_user_id",
    "user_id",
    "created_by_user_id",
    "created_user_id",
    "requested_by_user_id",
  ];

  for (let index = 0; index < candidateFields.length; index += 1) {
    const value = String(target[candidateFields[index]] || "").trim();
    if (value) return value;
  }

  return "";
}

function createBookingAssignmentNotifications_(booking, options) {
  const sourceBooking = booking || {};
  const assignedUserId = String(options && options.assigned_user_id || sourceBooking.assigned_user_id || "").trim();
  const assignedUserName = String(options && options.assigned_user_name || sourceBooking.assigned_user_name || sourceBooking.driver_name || "").trim();
  const previousAssignedUserId = String(options && options.previous_assigned_user_id || "").trim();
  const previousStatus = String(options && options.previous_status || sourceBooking.status || "").trim().toUpperCase();
  const createdBy = String(options && options.created_by || "").trim();
  const requesterNotificationUserId = String(
    options && options.requester_user_id !== undefined
      ? options.requester_user_id
      : resolveRequesterNotificationUserId_(sourceBooking)
  ).trim();
  const assignmentPayload = buildNotificationPayloadFromBooking_(sourceBooking, {
    driver_name: assignedUserName,
    status: "APPROVED",
  });
  const isDriverChanged =
    previousStatus === "APPROVED" &&
    Boolean(previousAssignedUserId) &&
    Boolean(assignedUserId) &&
    previousAssignedUserId !== assignedUserId;

  if (assignedUserId && assignedUserId !== previousAssignedUserId) {
    createNotification({
      target_user_id: assignedUserId,
      target_role: "",
      category: "Booking",
      title: "คุณได้รับมอบหมายงาน",
      message: buildNotificationMessageForBooking_(sourceBooking, "มีการมอบหมายงานใหม่"),
      type: "BOOKING_ASSIGNED",
      booking_id: sourceBooking.booking_id || "",
      url: "/driver-jobs",
      created_by: createdBy,
      payload_json: assignmentPayload,
    });
  }

  if (!requesterNotificationUserId) {
    return;
  }

  if (isDriverChanged) {
    createNotification({
      target_user_id: requesterNotificationUserId,
      target_role: "",
      category: "Booking",
      title: "รายการจองเปลี่ยนคนขับใหม่",
      message: buildRequesterDestinationStartMessage_(sourceBooking, "รายการจองมีการเปลี่ยนแปลง"),
      type: "BOOKING_DRIVER_CHANGED",
      booking_id: sourceBooking.booking_id || "",
      url: "/booking",
      created_by: createdBy,
      payload_json: assignmentPayload,
    });
    return;
  }

  createNotification({
    target_user_id: requesterNotificationUserId,
    target_role: "",
    category: "Booking",
    title: "รายการจองได้รับมอบหมายคนขับแล้ว",
    message: buildRequesterDestinationStartMessage_(sourceBooking, "รายการจองได้รับมอบหมายคนขับแล้ว"),
    type: "BOOKING_ASSIGNED_TO_REQUESTER",
    booking_id: sourceBooking.booking_id || "",
    url: "/booking",
    created_by: createdBy,
    payload_json: assignmentPayload,
  });
}

function isNotificationVisibleToUser_(notification, userId, role) {
  const targetUserId = String(notification && notification.target_user_id || "").trim();
  const targetRole = normalizeRoleValue_(notification && notification.target_role || "");
  const normalizedUserId = String(userId || "").trim();
  const normalizedRole = normalizeRoleValue_(role);

  if (targetUserId) {
    return Boolean(normalizedUserId) && targetUserId === normalizedUserId;
  }

  return Boolean(targetRole && normalizedRole && targetRole === normalizedRole);
}

function getVisibleNotificationEntries_(userId, role) {
  const sheet = ensureNotificationsSheet();
  const table = readSheetTable(sheet);
  const notifications = rowsToObjects(table.headers, table.rows)
    .filter((notification) => isNotificationVisibleToUser_(notification, userId, role))
    .map((notification) => ({
      ...notification,
      target_user_id: String(notification.target_user_id || "").trim(),
      target_role: normalizeRoleValue_(notification.target_role || ""),
      category: String(notification.category || "").trim(),
      is_read: normalizeNotificationReadValue_(notification.is_read),
      created_at: String(notification.created_at || ""),
      read_at: String(notification.read_at || ""),
      payload_json: String(notification.payload_json || ""),
    }));

  notifications.sort((left, right) => {
    const leftTime = new Date(left.created_at || 0).getTime() || 0;
    const rightTime = new Date(right.created_at || 0).getTime() || 0;
    return rightTime - leftTime;
  });

  return notifications;
}

function createNotification(data) {
  try {
    const record = appendNotificationRecord_(data || {});
    return jsonOutput({
      success: true,
      message: "Create notification success",
      data: record,
      created_notifications: getCreatedNotifications_(),
    });
  } catch (err) {
    return jsonOutput({
      success: false,
      message: String(err && err.message ? err.message : err),
    });
  }
}

function getPushSubscriptionsByUserId(data) {
  try {
    const userId = String(data && data.user_id || "").trim();
    const normalizedUserId =
      String(userId || "").trim().toUpperCase();
    const debugEnabled = String(data && data.debug || "").trim() === "1";

    if (!normalizedUserId) {
      return jsonOutput({
        success: false,
        message: "user_id is required",
      });
    }

    const diagnostics = getPushSubscriptionDiagnosticsByUserId_(userId);
    const results = diagnostics
      .filter(function (row) {
        return row.include_row;
      })
      .map(function (row) {
        return row.subscription;
      });

    console.log("[push-subscriptions] matched:", results.length);

    return jsonOutput({
      success: true,
      total: results.length,
      data: results,
      debug: debugEnabled ? diagnostics.map(function (row) {
        return {
          row_number: row.row_number,
          user_id_match: row.user_id_match,
          status: row.status,
          status_match: row.status_match,
          provider: row.provider,
          has_endpoint: row.has_endpoint,
          has_p256dh: row.has_p256dh,
          has_auth: row.has_auth,
          include_reason: row.include_reason,
        };
      }) : undefined,
    });
  } catch (err) {
    return jsonOutput({
      success: false,
      message: String(err && err.message ? err.message : err),
    });
  }
}

function inferPushSubscriptionProvider_(providerValue, fcmToken, endpoint, p256dh, auth) {
  const normalizedProvider = String(providerValue || "").trim().toUpperCase();
  const normalizedFcmToken = String(fcmToken || "").trim();
  const normalizedEndpoint = String(endpoint || "").trim();
  const normalizedP256dh = String(p256dh || "").trim();
  const normalizedAuth = String(auth || "").trim();

  if (normalizedFcmToken) {
    return "FCM";
  }

  if (normalizedEndpoint && normalizedP256dh && normalizedAuth) {
    return "WEB_PUSH";
  }

  return normalizedProvider;
}

function savePushSubscription(data) {
  try {
    const payload = data || {};
    const subscription = payload.subscription || {};
    const keys = subscription.keys || {};
    const userId = String(payload.user_id || "").trim();
    const endpoint = String(subscription.endpoint || payload.endpoint || "").trim();
    const p256dh = String(keys.p256dh || payload.p256dh || "").trim();
    const auth = String(keys.auth || payload.auth || "").trim();
    const fcmToken = String(payload.fcm_token || "").trim();
    const provider = inferPushSubscriptionProvider_(payload.provider, fcmToken, endpoint, p256dh, auth);
    const userAgent = String(payload.user_agent || "").trim();
    const nowIso = new Date().toISOString();

    if (!userId) {
      return jsonOutput({
        success: false,
        message: "user_id is required",
      });
    }

    if (provider === "FCM" && !fcmToken) {
      return jsonOutput({
        success: false,
        message: "fcm_token is required",
      });
    }

    if (provider === "WEB_PUSH" && (!endpoint || !p256dh || !auth)) {
      return jsonOutput({
        success: false,
        message: "WEB_PUSH requires endpoint, p256dh, and auth",
      });
    }

    if (!provider) {
      return jsonOutput({
        success: false,
        message: "provider could not be determined",
      });
    }

    const sheet = ensurePushSubscriptionsSheet();
    const table = readSheetTable(sheet);
    const headers = table.headers;
    const columnMap = table.columnMap;
    let savedRowValues = null;
    let savedRowIndex = -1;

    function updateRow_(rowValues, preserveExistingEndpointFields) {
      const nextValues = rowValues.slice();
      nextValues[columnMap.user_id] = userId;
      if (preserveExistingEndpointFields) {
        if (endpoint) nextValues[columnMap.endpoint] = endpoint;
        if (p256dh) nextValues[columnMap.p256dh] = p256dh;
        if (auth) nextValues[columnMap.auth] = auth;
      } else {
        nextValues[columnMap.endpoint] = endpoint;
        nextValues[columnMap.p256dh] = p256dh;
        nextValues[columnMap.auth] = auth;
      }
      nextValues[columnMap.fcm_token] = fcmToken;
      nextValues[columnMap.provider] = provider;
      nextValues[columnMap.user_agent] = userAgent;
      nextValues[columnMap.status] = "ACTIVE";
      nextValues[columnMap.updated_at] = nowIso;
      if (!String(nextValues[columnMap.created_at] || "").trim()) {
        nextValues[columnMap.created_at] = nowIso;
      }
      if (!String(nextValues[columnMap.subscription_id] || "").trim()) {
        nextValues[columnMap.subscription_id] = "PS-" + Utilities.getUuid();
      }
      return nextValues;
    }

    function deactivateDuplicateWebPushRows_(keepIndex) {
      for (let index = 0; index < table.rows.length; index += 1) {
        if (index === keepIndex) {
          continue;
        }

        const rowValues = table.rows[index];
        const rowUserId = String(rowValues[columnMap.user_id] || "").trim();
        const rowProvider = inferPushSubscriptionProvider_(
          rowValues[columnMap.provider],
          rowValues[columnMap.fcm_token],
          rowValues[columnMap.endpoint],
          rowValues[columnMap.p256dh],
          rowValues[columnMap.auth]
        );
        const rowUserAgent = String(rowValues[columnMap.user_agent] || "").trim();
        const rowStatus = String(rowValues[columnMap.status] || "").trim().toUpperCase();

        if (
          rowUserId !== userId ||
          rowProvider !== "WEB_PUSH" ||
          rowUserAgent !== userAgent ||
          rowStatus !== "ACTIVE"
        ) {
          continue;
        }

        const nextValues = rowValues.slice();
        nextValues[columnMap.status] = "INACTIVE";
        nextValues[columnMap.updated_at] = nowIso;
        setRowValues(sheet, index + 2, nextValues);
      }
    }

    if (provider === "FCM") {
      for (let index = 0; index < table.rows.length; index += 1) {
        const rowValues = table.rows[index];
        const rowUserId = String(rowValues[columnMap.user_id] || "").trim();
        const rowProvider = inferPushSubscriptionProvider_(
          rowValues[columnMap.provider],
          rowValues[columnMap.fcm_token],
          rowValues[columnMap.endpoint],
          rowValues[columnMap.p256dh],
          rowValues[columnMap.auth]
        );
        const rowUserAgent = String(rowValues[columnMap.user_agent] || "").trim();

        if (
          rowUserId === userId &&
          rowProvider === "FCM" &&
          rowUserAgent === userAgent
        ) {
          savedRowValues = updateRow_(rowValues, true);
          savedRowIndex = index;
          setRowValues(sheet, index + 2, savedRowValues);
          break;
        }
      }

      if (!savedRowValues) {
        for (let index = 0; index < table.rows.length; index += 1) {
          const rowValues = table.rows[index];
          if (String(rowValues[columnMap.fcm_token] || "").trim() === fcmToken) {
            savedRowValues = updateRow_(rowValues, true);
            savedRowIndex = index;
            setRowValues(sheet, index + 2, savedRowValues);
            break;
          }
        }
      }

      if (savedRowValues) {
        for (let index = 0; index < table.rows.length; index += 1) {
          if (index === savedRowIndex) {
            continue;
          }

          const rowValues = table.rows[index];
          const rowUserId = String(rowValues[columnMap.user_id] || "").trim();
          const rowProvider = inferPushSubscriptionProvider_(
            rowValues[columnMap.provider],
            rowValues[columnMap.fcm_token],
            rowValues[columnMap.endpoint],
            rowValues[columnMap.p256dh],
            rowValues[columnMap.auth]
          );
          const rowUserAgent = String(rowValues[columnMap.user_agent] || "").trim();
          const rowStatus = String(rowValues[columnMap.status] || "").trim().toUpperCase();

          if (
            rowUserId !== userId ||
            rowProvider !== "FCM" ||
            rowUserAgent !== userAgent ||
            rowStatus !== "ACTIVE"
          ) {
            continue;
          }

          const nextValues = rowValues.slice();
          nextValues[columnMap.status] = "INACTIVE";
          nextValues[columnMap.updated_at] = nowIso;
          setRowValues(sheet, index + 2, nextValues);
        }
      }
    } else {
      for (let index = 0; index < table.rows.length; index += 1) {
        const rowValues = table.rows[index];
        const rowUserId = String(rowValues[columnMap.user_id] || "").trim();
        const rowProvider = inferPushSubscriptionProvider_(
          rowValues[columnMap.provider],
          rowValues[columnMap.fcm_token],
          rowValues[columnMap.endpoint],
          rowValues[columnMap.p256dh],
          rowValues[columnMap.auth]
        );
        const rowEndpoint = String(rowValues[columnMap.endpoint] || "").trim();
        const rowUserAgent = String(rowValues[columnMap.user_agent] || "").trim();

        if (
          rowUserId === userId &&
          rowProvider === "WEB_PUSH" &&
          rowEndpoint === endpoint
        ) {
          savedRowValues = updateRow_(rowValues, false);
          savedRowIndex = index;
          setRowValues(sheet, index + 2, savedRowValues);
          break;
        }
      }

      if (!savedRowValues) {
        for (let index = 0; index < table.rows.length; index += 1) {
          const rowValues = table.rows[index];
          const rowUserId = String(rowValues[columnMap.user_id] || "").trim();
          const rowProvider = inferPushSubscriptionProvider_(
            rowValues[columnMap.provider],
            rowValues[columnMap.fcm_token],
            rowValues[columnMap.endpoint],
            rowValues[columnMap.p256dh],
            rowValues[columnMap.auth]
          );
          const rowUserAgent = String(rowValues[columnMap.user_agent] || "").trim();

          if (
            rowUserId === userId &&
            rowProvider === "WEB_PUSH" &&
            rowUserAgent === userAgent
          ) {
            savedRowValues = updateRow_(rowValues, false);
            savedRowIndex = index;
            setRowValues(sheet, index + 2, savedRowValues);
            break;
          }
        }
      }
    }

    if (!savedRowValues) {
      const row = Array(headers.length).fill("");
      row[columnMap.subscription_id] = "PS-" + Utilities.getUuid();
      row[columnMap.user_id] = userId;
      row[columnMap.endpoint] = endpoint;
      row[columnMap.p256dh] = p256dh;
      row[columnMap.auth] = auth;
      row[columnMap.fcm_token] = fcmToken;
      row[columnMap.provider] = provider;
      row[columnMap.user_agent] = userAgent;
      row[columnMap.status] = "ACTIVE";
      row[columnMap.created_at] = nowIso;
      row[columnMap.updated_at] = nowIso;
      appendSheetRow(sheet, row);
      savedRowValues = row;
      savedRowIndex = table.rows.length;
    }

    if (provider === "FCM") {
      for (let index = 0; index < table.rows.length; index += 1) {
        if (index === savedRowIndex) {
          continue;
        }

        const rowValues = table.rows[index];
        const rowUserId = String(rowValues[columnMap.user_id] || "").trim();
        const rowProvider = inferPushSubscriptionProvider_(
          rowValues[columnMap.provider],
          rowValues[columnMap.fcm_token],
          rowValues[columnMap.endpoint],
          rowValues[columnMap.p256dh],
          rowValues[columnMap.auth]
        );
        const rowUserAgent = String(rowValues[columnMap.user_agent] || "").trim();
        const rowStatus = String(rowValues[columnMap.status] || "").trim().toUpperCase();

        if (
          rowUserId !== userId ||
          rowProvider !== "FCM" ||
          rowUserAgent !== userAgent ||
          rowStatus !== "ACTIVE"
        ) {
          continue;
        }

        const nextValues = rowValues.slice();
        nextValues[columnMap.status] = "INACTIVE";
        nextValues[columnMap.updated_at] = nowIso;
        setRowValues(sheet, index + 2, nextValues);
      }
    } else if (provider === "WEB_PUSH") {
      deactivateDuplicateWebPushRows_(savedRowIndex);
    }

    return jsonOutput({
      success: true,
      message: "Save push subscription success",
      data: rowsToObjects(headers, [savedRowValues])[0] || {},
    });
  } catch (err) {
    return jsonOutput({
      success: false,
      message: String(err && err.message ? err.message : err),
    });
  }
}

function disablePushSubscription(data) {
  try {
    const payload = data || {};
    const endpoint = String(
      payload.endpoint ||
      payload.subscription_endpoint ||
      (payload.subscription && payload.subscription.endpoint) ||
      ""
    ).trim();
    const fcmToken = String(payload.fcm_token || "").trim();
    const matchColumnKey = fcmToken ? "fcm_token" : "endpoint";
    const matchValue = fcmToken || endpoint;

    if (!matchValue) {
      return jsonOutput({
        success: false,
        message: "endpoint or fcm_token is required",
      });
    }

    const sheet = ensurePushSubscriptionsSheet();
    const table = readSheetTable(sheet);
    const headers = table.headers;
    const columnMap = table.columnMap;
    const nowIso = new Date().toISOString();

    for (let index = 0; index < table.rows.length; index += 1) {
      const rowValues = table.rows[index];
      if (String(rowValues[columnMap[matchColumnKey]] || "").trim() !== matchValue) {
        continue;
      }

      const nextValues = rowValues.slice();
      nextValues[columnMap.status] = "INACTIVE";
      nextValues[columnMap.updated_at] = nowIso;
      setRowValues(sheet, index + 2, nextValues);

      return jsonOutput({
        success: true,
        message: "Disable push subscription success",
        data: rowsToObjects(headers, [nextValues])[0] || {},
      });
    }

    return jsonOutput({
      success: true,
      message: "Push subscription already disabled",
      data: {
        endpoint,
        fcm_token: fcmToken,
        updated: false,
      },
    });
  } catch (err) {
    return jsonOutput({
      success: false,
      message: String(err && err.message ? err.message : err),
    });
  }
}

function getActivePushSubscriptionsByUserId_(userId) {
  return getPushSubscriptionDiagnosticsByUserId_(userId)
    .filter(function (row) {
      return row.include_row;
    })
    .map(function (row) {
      return row.subscription;
    });
}

function getPushSubscriptionDiagnosticsByUserId_(userId) {
  const normalizedUserId = String(userId || "").trim().toUpperCase();
  if (!normalizedUserId) return [];

  const sheet = ensurePushSubscriptionsSheet();
  const table = readSheetTable(sheet);
  const objects = rowsToObjects(table.headers, table.rows);

  return objects.map(function (row, index) {
    const rowUserId = String(row.user_id || "").trim();
    const normalizedRowUserId = rowUserId.toUpperCase();
    const provider = inferPushSubscriptionProvider_(
      row.provider,
      row.fcm_token,
      row.endpoint,
      row.p256dh,
      row.auth
    );
    const status = String(row.status || "").trim().toUpperCase();
    const fcmToken = String(row.fcm_token || "").trim();
    const endpoint = String(row.endpoint || "").trim();
    const p256dh = String(row.p256dh || "").trim();
    const auth = String(row.auth || "").trim();
    const userIdMatch = normalizedRowUserId === normalizedUserId;
    const statusMatch = status === "ACTIVE";
    const isFcm = provider === "FCM" && fcmToken.length > 0;
    const isWebPush = provider === "WEB_PUSH" && endpoint.length > 0 && p256dh.length > 0 && auth.length > 0;
    const includeRow = userIdMatch && statusMatch && (isFcm || isWebPush);
    let includeReason = "";

    if (includeRow) {
      includeReason = provider === "WEB_PUSH" ? "include:ACTIVE_WEB_PUSH" : "include:ACTIVE_FCM";
    } else if (!userIdMatch) {
      includeReason = "skip:user_id_mismatch";
    } else if (!statusMatch) {
      includeReason = "skip:status_not_active";
    } else if (provider === "FCM" && !fcmToken) {
      includeReason = "skip:fcm_missing_token";
    } else if (provider === "WEB_PUSH" && !endpoint) {
      includeReason = "skip:web_push_missing_endpoint";
    } else if (provider === "WEB_PUSH" && !p256dh) {
      includeReason = "skip:web_push_missing_p256dh";
    } else if (provider === "WEB_PUSH" && !auth) {
      includeReason = "skip:web_push_missing_auth";
    } else {
      includeReason = "skip:unsupported_provider_or_incomplete_row";
    }

    const subscription = {
      subscription_id: String(row.subscription_id || "").trim(),
      user_id: rowUserId,
      endpoint: endpoint,
      p256dh: p256dh,
      auth: auth,
      fcm_token: fcmToken,
      provider: provider,
      user_agent: String(row.user_agent || "").trim(),
      status: status,
      created_at: String(row.created_at || "").trim(),
      updated_at: String(row.updated_at || "").trim(),
    };

    console.log("[push-subscriptions]", {
      target_user_id: normalizedUserId,
      row_number: index + 2,
      row_user_id: rowUserId,
      user_id_match: userIdMatch,
      provider: provider,
      status: status,
      status_match: statusMatch,
      has_fcm_token: !!fcmToken,
      has_endpoint: !!endpoint,
      has_p256dh: !!p256dh,
      has_auth: !!auth,
      include_reason: includeReason,
    });

    return {
      row_number: index + 2,
      user_id_match: userIdMatch,
      status: status,
      status_match: statusMatch,
      provider: provider,
      has_endpoint: !!endpoint,
      has_p256dh: !!p256dh,
      has_auth: !!auth,
      include_reason: includeReason,
      include_row: includeRow,
      subscription: subscription,
    };
  });
}

function getNotifications(data) {
  try {
    const userId = String(data && data.user_id || "").trim();
    const role = normalizeRoleValue_(data && data.role || "");

    if (!userId && !role) {
      return jsonOutput({
        success: false,
        message: "user_id or role is required",
      });
    }

    const visibleNotifications = getVisibleNotificationEntries_(userId, role);
    const latestNotifications = visibleNotifications.slice(0, 50);
    const unreadCount = visibleNotifications.filter((notification) => !notification.is_read).length;

    return jsonOutput({
      success: true,
      total: latestNotifications.length,
      unread_count: unreadCount,
      data: latestNotifications,
    });
  } catch (err) {
    return jsonOutput({
      success: false,
      message: String(err && err.message ? err.message : err),
    });
  }
}

function markNotificationRead(data) {
  try {
    const notificationId = String(data && data.notification_id || "").trim();
    if (!notificationId) {
      return jsonOutput({
        success: false,
        message: "notification_id is required",
      });
    }

    const sheet = ensureNotificationsSheet();
    const table = readSheetTable(sheet);
    const columnMap = table.columnMap;
    const notificationIdCol = columnMap.notification_id;
    const isReadCol = columnMap.is_read;
    const readAtCol = columnMap.read_at;

    if (notificationIdCol === undefined || isReadCol === undefined || readAtCol === undefined) {
      throw new Error("Notifications sheet columns are invalid");
    }

    for (let index = 0; index < table.rows.length; index += 1) {
      const rowValues = table.rows[index];
      if (String(rowValues[notificationIdCol] || "").trim() !== notificationId) {
        continue;
      }

      const nextValues = rowValues.slice();
      nextValues[isReadCol] = true;
      nextValues[readAtCol] = new Date().toISOString();
      setRowValues(sheet, index + 2, nextValues);

      return jsonOutput({
        success: true,
        message: "Mark notification read success",
        data: rowsToObjects(table.headers, [nextValues])[0] || {},
      });
    }

    return jsonOutput({
      success: false,
      message: "Notification not found",
    });
  } catch (err) {
    return jsonOutput({
      success: false,
      message: String(err && err.message ? err.message : err),
    });
  }
}

function markAllNotificationsRead(data) {
  try {
    const userId = String(data && data.user_id || "").trim();
    const role = normalizeRoleValue_(data && data.role || "");

    if (!userId && !role) {
      return jsonOutput({
        success: false,
        message: "user_id or role is required",
      });
    }

    const sheet = ensureNotificationsSheet();
    const table = readSheetTable(sheet);
    const columnMap = table.columnMap;
    const isReadCol = columnMap.is_read;
    const readAtCol = columnMap.read_at;
    const nowIso = new Date().toISOString();
    let updatedCount = 0;

    for (let index = 0; index < table.rows.length; index += 1) {
      const notification = rowsToObjects(table.headers, [table.rows[index]])[0] || {};
      if (!isNotificationVisibleToUser_(notification, userId, role)) {
        continue;
      }

      if (normalizeNotificationReadValue_(notification.is_read)) {
        continue;
      }

      const nextValues = table.rows[index].slice();
      nextValues[isReadCol] = true;
      nextValues[readAtCol] = nowIso;
      setRowValues(sheet, index + 2, nextValues);
      updatedCount += 1;
    }

    return jsonOutput({
      success: true,
      message: "Mark all notifications read success",
      data: {
        updated_count: updatedCount,
      },
    });
  } catch (err) {
    return jsonOutput({
      success: false,
      message: String(err && err.message ? err.message : err),
    });
  }
}

function findRowByBookingId(sheetOrTable, bookingId) {
  const targetBookingId = String(bookingId || "").trim();
  if (!targetBookingId) {
    return -1;
  }

  const table = sheetOrTable && sheetOrTable.rows ? sheetOrTable : readSheetTable(sheetOrTable);
  const bookingIdCol = table.columnMap.booking_id;

  if (bookingIdCol === undefined) {
    return -1;
  }

  for (let i = 0; i < table.rows.length; i++) {
    const rowBookingId = String(table.rows[i][bookingIdCol] || "").trim();

    if (targetBookingId && rowBookingId === targetBookingId) {
      const row = i + 2;
      if (row <= 1) {
        return -1;
      }
      return row;
    }
  }

  return -1;
}

function logBookingAction(actionName, bookingId, row) {
  return {
    action: actionName,
    booking_id: bookingId || "",
    matched_row: row || -1,
  };
}

function normalizeDriverCancelDecision_(decision) {
  return String(decision || "").trim().toUpperCase();
}

function normalizeKnownNotePhrase_(value) {
  let text = String(value || "").trim().replace(/[ \t]+/g, " ");

  if (!text) return "";

  text = text.replace(/\[ใช้รถ สนง\.กลาง\]\s*\[ใช้รถ สนง\.กลาง\]/g, "[ใช้รถ สนง.กลาง]");
  text = text.replace(/\[ใช้รถ สนง\.กลาง\]\s*ใช้รถ สนง\.กลาง/g, "[ใช้รถ สนง.กลาง]");
  text = text.replace(/(?:ใช้รถ สนง\.กลาง)(?:\s+ใช้รถ สนง\.กลาง)+/g, "ใช้รถ สนง.กลาง");
  text = text.replace(/(?:บันทึกรายการย้อนหลัง)(?:\s*[:：-]?\s*บันทึกรายการย้อนหลัง)+/g, "บันทึกรายการย้อนหลัง");
  text = text.replace(/(?:ไม่อนุมัติการยกเลิก)(?:\s*[:：-]?\s*ไม่อนุมัติการยกเลิก)+/g, "ไม่อนุมัติการยกเลิก");
  text = text.replace(/(?:อนุมัติการยกเลิกงานคนขับ)(?:\s*[:：-]?\s*อนุมัติการยกเลิกงานคนขับ)+/g, "อนุมัติการยกเลิกงานคนขับ");
  text = text.replace(/(?:รอการอนุมัติการยกเลิก)(?:\s*[:：-]?\s*รอการอนุมัติการยกเลิก)+/g, "รอการอนุมัติการยกเลิก");

  return text.trim();
}

function canonicalizeNoteForCompare_(value) {
  return normalizeKnownNotePhrase_(value)
    .replace(/\[ใช้รถ สนง\.กลาง\]/g, "ใช้รถ สนง.กลาง")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNoteParts(parts) {
  const seen = {};
  const normalizedParts = [];

  (parts || []).forEach((part) => {
    String(part || "")
      .replace(/\r/g, "\n")
      .split("\n")
      .forEach((line) => {
        const normalizedLine = normalizeKnownNotePhrase_(line);
        if (!normalizedLine) return;

        const canonical = canonicalizeNoteForCompare_(normalizedLine);
        if (!canonical || seen[canonical]) return;

        seen[canonical] = true;
        normalizedParts.push(normalizedLine);
      });
  });

  return normalizedParts;
}

function appendUniqueNote(existingNote, newNote) {
  return normalizeNoteParts([existingNote, newNote]).join("\n");
}

function applyDriverCancelResolution_(sheet, table, row, data, options) {
  const headers = table.headers;
  const columnMap = table.columnMap;
  const now = options && options.now ? options.now : new Date();
  const reason = normalizeNoteParts([data.reason || options.reason || ""]).join("\n");
  const actor = String(data.cancelled_by || data.reviewed_by || options.actor || "").trim();
  const noteActor = String(options && options.noteActor ? options.noteActor : actor).trim();
  const currentBooking = rowsToObjects(headers, [table.rows[row - 2]])[0] || {};

  const vehicleIdCol = ensureColumn(sheet, headers, "vehicle_id");
  const vehicleNameCol = ensureColumn(sheet, headers, "vehicle_name");
  const vehicleCodeCol = ensureColumn(sheet, headers, "vehicle_code");
  const vehiclePlateCol = ensureColumn(sheet, headers, "vehicle_plate");
  const assignedUserIdCol = ensureColumn(sheet, headers, "assigned_user_id");
  const assignedUserNameCol = ensureColumn(sheet, headers, "assigned_user_name");
  const staffNoteCol = ensureColumn(sheet, headers, "staff_note");
  const driverCancelReasonCol = ensureColumn(sheet, headers, "driver_cancel_reason");
  const driverCancelledByCol = ensureColumn(sheet, headers, "driver_cancelled_by");
  const driverCancelledAtCol = ensureColumn(sheet, headers, "driver_cancelled_at");
  const driverCancelledUserIdCol = ensureColumn(sheet, headers, "driver_cancelled_user_id");
  const updatedAtCol = columnMap.updated_at;

  const currentVehicleId = String(table.rows[row - 2][vehicleIdCol] || "").trim();
  const cancelledUserId = String(data.cancelled_user_id || "").trim();
  const staffNote = normalizeNoteParts(["คนขับยกเลิกงานโดย " + noteActor + ": " + reason]).join("\n");

  const rowValues = table.rows[row - 2].slice();
  rowValues[vehicleIdCol] = "";
  rowValues[vehicleNameCol] = "";
  rowValues[vehicleCodeCol] = "";
  rowValues[vehiclePlateCol] = "";
  rowValues[assignedUserIdCol] = "";
  rowValues[assignedUserNameCol] = "";
  rowValues[staffNoteCol] = appendUniqueNote(rowValues[staffNoteCol], staffNote);
  rowValues[driverCancelReasonCol] = reason;
  rowValues[driverCancelledByCol] = actor;
  rowValues[driverCancelledAtCol] = now;
  rowValues[driverCancelledUserIdCol] = cancelledUserId;
  rowValues[columnMap.status] = "PENDING";
  rowValues[updatedAtCol] = now;
  setRowValues(sheet, row, rowValues);

  const vehicleSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Vehicles");
  if (vehicleSheet && currentVehicleId) {
    const vehicleTable = readSheetTable(vehicleSheet);
    const vehicleColumnMap = vehicleTable.columnMap;
    const vehicleIdLookupCol = vehicleColumnMap.vehicle_id;
    const vehicleStatusCol = vehicleColumnMap.status;

    if (vehicleIdLookupCol !== undefined && vehicleStatusCol !== undefined) {
      for (let i = 0; i < vehicleTable.rows.length; i++) {
        if (String(vehicleTable.rows[i][vehicleIdLookupCol] || "").trim() === currentVehicleId) {
          vehicleSheet.getRange(i + 2, vehicleStatusCol + 1).setValue("AVAILABLE");
          break;
        }
      }
    }
  }

  if (options && options.writeVehicleLog) {
    const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("VehicleLogs");
    if (logSheet) {
      const logTable = readSheetTable(logSheet);
      const logHeaders = logTable.headers;
      const logIdCol = ensureColumn(logSheet, logHeaders, "log_id");
      const logBookingIdCol = ensureColumn(logSheet, logHeaders, "booking_id");
      const logActionCol = ensureColumn(logSheet, logHeaders, "action");
      const logReasonCol = ensureColumn(logSheet, logHeaders, "reason");
      const logCancelledByCol = ensureColumn(logSheet, logHeaders, "cancelled_by");
      const logCreatedAtCol = ensureColumn(logSheet, logHeaders, "created_at");
      const logUpdatedAtCol = ensureColumn(logSheet, logHeaders, "updated_at");
      const logRowValues = Array(logHeaders.length).fill("");

      logRowValues[logIdCol] = "LOG" + Utilities.formatString("%04d", logSheet.getLastRow());
      logRowValues[logBookingIdCol] = data.booking_id;
      logRowValues[logActionCol] = options.vehicleLogAction || "DRIVER_CANCEL";
      logRowValues[logReasonCol] = reason;
      logRowValues[logCancelledByCol] = actor;
      logRowValues[logCreatedAtCol] = now;
      logRowValues[logUpdatedAtCol] = now;
      appendSheetRow(logSheet, logRowValues);
    }
  }

  appendDriverJobLog_(
    createDriverJobLogPayload_({
      booking_id: currentBooking.booking_id || data.booking_id,
      booking_no: currentBooking.booking_no || "",
      driver_user_id: currentBooking.assigned_user_id || cancelledUserId || "",
      driver_name: currentBooking.assigned_user_name || actor || "",
      vehicle_id: currentBooking.vehicle_id || "",
      action: options.logAction || "DRIVER_CANCELLED",
      reason: reason,
      requester_name: currentBooking.requester_name || "",
      start_datetime: currentBooking.start_datetime || "",
      end_datetime: currentBooking.end_datetime || "",
      destination: currentBooking.destination || "",
      purpose: currentBooking.purpose || "",
      created_by: actor || "",
    })
  );

  return {
    staffNote,
    rowValues,
    currentBooking,
    now,
    cancelledUserId,
  };
}

function getNextBookingSequence(table, bookingIdCol) {
  let maxNumber = 0;

  for (let i = 0; i < table.rows.length; i++) {
    const match = String(table.rows[i][bookingIdCol] || "").trim().match(/^BK(\d+)$/);
    if (match) {
      maxNumber = Math.max(maxNumber, Number(match[1]));
    }
  }

  return maxNumber + 1;
}

function buildUserLookup() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  if (!sheet) {
    return {
      byId: new Map(),
      byName: new Map(),
    };
  }

  const { headers, rows } = readSheetTable(sheet);
  const userIdCol = headers.indexOf("user_id");
  const nameCol = headers.indexOf("name");

  const byId = new Map();
  const byName = new Map();

  rows.forEach((row) => {
    const userId = String(userIdCol !== -1 ? row[userIdCol] : "").trim();
    const name = String(nameCol !== -1 ? row[nameCol] : "").trim();
    const nameKey = name.toLowerCase();

    if (userId) {
      byId.set(userId, {
        user_id: userId,
        name,
      });
    }

    if (name && !byName.has(nameKey)) {
      byName.set(nameKey, {
        user_id: userId,
        name,
      });
    }
  });

  return { byId, byName };
}

function applyAssignedUserFallback(obj, userLookup) {
  const assignedUserId = String(obj.assigned_user_id || "").trim();
  const assignedUserName = String(obj.assigned_user_name || "").trim();
  const legacyDriverId = String(obj.driver_id || "").trim();
  const legacyDriverName = String(obj.driver_name || "").trim();
  const legacyDriverNameKey = legacyDriverName.toLowerCase();

  let resolvedUserId = assignedUserId;
  let resolvedUserName = assignedUserName;

  if (!resolvedUserId && legacyDriverId && userLookup.byId.has(legacyDriverId)) {
    const matchedUser = userLookup.byId.get(legacyDriverId);
    resolvedUserId = matchedUser.user_id || legacyDriverId;
    resolvedUserName = resolvedUserName || matchedUser.name || legacyDriverName;
  }

  if (!resolvedUserId && legacyDriverName && userLookup.byName.has(legacyDriverNameKey)) {
    const matchedUser = userLookup.byName.get(legacyDriverNameKey);
    resolvedUserId = matchedUser.user_id || "";
    resolvedUserName = matchedUser.name || legacyDriverName;
  }

  if (!resolvedUserName) {
    resolvedUserName = legacyDriverName || "";
  }

  if (resolvedUserId && !resolvedUserName && userLookup.byId.has(resolvedUserId)) {
    resolvedUserName = userLookup.byId.get(resolvedUserId).name || "";
  }

  obj.assigned_user_id = resolvedUserId;
  obj.assigned_user_name = resolvedUserName;
  delete obj.driver_id;
  delete obj.driver_name;

  return obj;
}

function getBookings() {
  const sheet = ensureBookingsSheet();

  const { headers, rows } = readSheetTable(sheet);

  if (rows.length === 0) {
    return jsonOutput({
      success: true,
      total: 0,
      data: []
    });
  }

  const data = rowsToObjects(headers, rows);
  const userLookup = buildUserLookup();
  const activityLogsMap = buildBookingActivityLogsMap_();
  data.forEach((obj) => {
    applyAssignedUserFallback(obj, userLookup);
  });

  return jsonOutput({
    success: true,
    total: data.length,
    data: data.map((booking) => enrichBookingWithActivityData_(booking, activityLogsMap))
  });
}

function createBooking(data) {
  try {
    data = data || {};

    const sheet = ensureBookingsSheet();

    const now = new Date();
    const table = readSheetTable(sheet);
    const { headers } = table;

    const bookingIdCol = ensureColumn(sheet, headers, "booking_id");
    const bookingNoCol = ensureColumn(sheet, headers, "booking_no");
    const requesterNameCol = ensureColumn(sheet, headers, "requester_name");
    const requesterUserIdCol = ensureColumn(sheet, headers, "requester_user_id");
    const departmentCol = ensureColumn(sheet, headers, "department");
    const phoneCol = ensureColumn(sheet, headers, "phone");
    ensureTextColumn_(sheet, headers, "phone");
    const startCol = ensureColumn(sheet, headers, "start_datetime");
    const endCol = ensureColumn(sheet, headers, "end_datetime");
    const destinationCol = ensureColumn(sheet, headers, "destination");
    const purposeCol = ensureColumn(sheet, headers, "purpose");
    const vehicleTypeRequestCol = ensureColumn(sheet, headers, "vehicle_type_request");
    const vehicleIdCol = ensureColumn(sheet, headers, "vehicle_id");
    const assignedUserIdCol = ensureColumn(sheet, headers, "assigned_user_id");
    const assignedUserNameCol = ensureColumn(sheet, headers, "assigned_user_name");
    const statusCol = ensureColumn(sheet, headers, "status");
    const staffNoteCol = ensureColumn(sheet, headers, "staff_note");
    const createdByUserIdCol = ensureColumn(sheet, headers, "created_by_user_id");
    const createdAtCol = ensureColumn(sheet, headers, "created_at");
    const updatedAtCol = ensureColumn(sheet, headers, "updated_at");
    const isBackdatedCol = ensureColumn(sheet, headers, "is_backdated");
    const backdatedCompletedAtCol = ensureColumn(sheet, headers, "backdated_completed_at");
    const backdatedCompletedByCol = ensureColumn(sheet, headers, "backdated_completed_by");

    const bookingNumber = getNextBookingSequence(table, bookingIdCol);
    const bookingId = "BK" + Utilities.formatString("%04d", bookingNumber);
    const bookingNo = "ODC-CAR-" + Utilities.formatString("%04d", bookingNumber);

    const bookingRow = Array(headers.length).fill("");
    bookingRow[bookingIdCol] = bookingId;
    bookingRow[bookingNoCol] = bookingNo;
    bookingRow[requesterNameCol] = data.requester_name || "";
    bookingRow[requesterUserIdCol] = data.requester_user_id || "";
    bookingRow[departmentCol] = data.department || "";
    bookingRow[phoneCol] = normalizePhone_(data.phone);
    bookingRow[startCol] = data.start_datetime || "";
    bookingRow[endCol] = data.end_datetime || "";
    bookingRow[destinationCol] = data.destination || "";
    bookingRow[purposeCol] = data.purpose || "";
    bookingRow[vehicleTypeRequestCol] = data.vehicle_type_request || "";
    bookingRow[vehicleIdCol] = data.vehicle_id || "";
    bookingRow[assignedUserIdCol] = data.assigned_user_id || "";
    bookingRow[assignedUserNameCol] = data.assigned_user_name || "";
    bookingRow[statusCol] = "PENDING";
    bookingRow[staffNoteCol] = "";
    bookingRow[createdByUserIdCol] = data.created_by_user_id || "";
    bookingRow[createdAtCol] = now;
    bookingRow[updatedAtCol] = now;
    bookingRow[isBackdatedCol] = String(data.is_backdated || "").trim().toUpperCase() === "TRUE" ? "TRUE" : "FALSE";
    bookingRow[backdatedCompletedAtCol] = "";
    bookingRow[backdatedCompletedByCol] = "";

    const row = appendSheetRow(sheet, bookingRow);

    if (row <= 1) {
      logBookingAction("createBooking", bookingId, row);
      throw new Error("Bookings header missing or wrong sheet");
    }

    logBookingAction("createBooking", bookingId, row);

    appendBookingActivityLog(bookingId, "สร้างรายการ", {
      actor_name: String(data.created_by || data.requester_name || "").trim(),
      actor_user_id: String(data.created_by_user_id || data.requester_user_id || "").trim(),
      detail: [
        String(data.requester_name || "").trim(),
        String(data.destination || "").trim(),
        formatThaiNotificationDateTime_(data.start_datetime || ""),
      ].filter(Boolean).join(" | "),
      created_at: now,
      payload: {
        requester_name: data.requester_name || "",
        destination: data.destination || "",
        start_datetime: data.start_datetime || "",
      },
    });

    createRoleNotifications_(["STAFF", "ADMIN"], {
      category: "Booking",
      title: "มีรายการจองใหม่",
      message: buildRequesterDestinationStartMessage_({
        requester_name: data.requester_name || "",
        destination: data.destination || "",
        start_datetime: data.start_datetime || "",
      }, "มีคำขอจองรถใหม่"),
      type: "BOOKING_CREATED",
      booking_id: bookingId,
      url: "/booking",
      created_by: String(data.created_by || data.requester_name || "").trim(),
    });

    return jsonOutput({
      success: true,
      message: "Create booking success",
      data: buildBookingResponseWithActivityData_({
        ...data,
        booking_id: bookingId,
        booking_no: bookingNo,
        requester_user_id: data.requester_user_id || "",
        created_by_user_id: data.created_by_user_id || "",
        status: "PENDING",
        assigned_user_id: data.assigned_user_id || "",
        assigned_user_name: data.assigned_user_name || "",
        is_backdated: bookingRow[isBackdatedCol],
      }),
      created_notifications: getCreatedNotifications_(),
    });
  } catch (err) {
    return jsonOutput({ success: false, message: String(err.message || err) });
  }
}

function updateBooking(data) {
  const sheet = ensureBookingsSheet();
  const table = readSheetTable(sheet);
  const headers = table.headers;
  ensureTextColumn_(sheet, headers, "phone");
  ensureColumn(sheet, headers, "requester_user_id");
  const columnMap = getHeaderMap(headers);

  const editableFields = [
    "requester_user_id",
    "requester_name",
    "department",
    "phone",
    "start_datetime",
    "end_datetime",
    "destination",
    "purpose",
    "vehicle_type_request",
    "assigned_user_id",
    "assigned_user_name",
    "is_backdated",
  ];
  const updatedAtCol = columnMap.updated_at;
  const statusCol = columnMap.status;

  if (!data.booking_id) {
    return jsonOutput({ success: false, message: "booking_id is required" });
  }

  const row = findRowByBookingId(table, data.booking_id);
  logBookingAction("updateBooking", data.booking_id, row);
  if (row <= 1) {
    return jsonOutput({ success: false, message: "Booking not found" });
  }

  const previousBooking = rowsToObjects(headers, [table.rows[row - 2]])[0] || {};
  const rowValues = table.rows[row - 2].slice();
  editableFields.forEach((field) => {
    const col = columnMap[field];
    if (col !== undefined && data[field] !== undefined) {
      if (field === "phone") {
        rowValues[col] = normalizePhone_(data[field]);
      } else if (field === "is_backdated") {
        rowValues[col] = String(data[field] || "").trim().toUpperCase() === "TRUE" ? "TRUE" : "FALSE";
      } else {
        rowValues[col] = data[field];
      }
    }
  });

  if (columnMap.staff_note !== undefined && data.staff_note !== undefined) {
    rowValues[columnMap.staff_note] = appendUniqueNote(rowValues[columnMap.staff_note], data.staff_note);
  }

  if (updatedAtCol !== undefined) {
    rowValues[updatedAtCol] = new Date();
  }
  setRowValues(sheet, row, rowValues);

  const updatedBooking = rowsToObjects(headers, [rowValues])[0] || {};
  const updatedBy = String(data.updated_by || data.created_by || "").trim();
  const updatedByRole = String(data.updated_by_role || "").trim().toUpperCase();
  const updatedByUserId = String(data.updated_by_user_id || data.created_by_user_id || "").trim();
  const changedFieldLabels = {
    requester_name: "ผู้จอง",
    department: "หน่วยงาน",
    phone: "เบอร์โทร",
    start_datetime: "เวลาไป",
    end_datetime: "เวลากลับ",
    destination: "ปลายทาง",
    purpose: "รายละเอียดการใช้รถ",
    vehicle_type_request: "ประเภทรถ",
    assigned_user_name: "คนขับ",
    is_backdated: "รายการย้อนหลัง",
  };
  const changedDetails = Object.keys(changedFieldLabels).reduce((result, field) => {
    const beforeValue = normalizeBookingActivityText_(previousBooking[field]);
    const afterValue = normalizeBookingActivityText_(updatedBooking[field]);
    if (beforeValue === afterValue) return result;
    result.push(`${changedFieldLabels[field]}: ${afterValue || "-"}`);
    return result;
  }, []);

  appendBookingActivityLog(data.booking_id, "แก้ไขรายการ", {
    actor_name: updatedBy,
    actor_user_id: updatedByUserId,
    detail: changedDetails.join(" | ") || "แก้ไขรายละเอียดรายการจอง",
    old_driver_user_id: normalizeBookingActivityText_(previousBooking.assigned_user_id),
    old_driver_name: normalizeBookingActivityText_(previousBooking.assigned_user_name),
    new_driver_user_id: normalizeBookingActivityText_(updatedBooking.assigned_user_id),
    new_driver_name: normalizeBookingActivityText_(updatedBooking.assigned_user_name),
    old_vehicle_id: normalizeBookingActivityText_(previousBooking.vehicle_id),
    new_vehicle_id: normalizeBookingActivityText_(updatedBooking.vehicle_id),
    created_at: rowValues[updatedAtCol],
  });

  try {
    const requesterUserId = resolveRequesterNotificationUserId_(updatedBooking);
    const assignedDriverUserId = String(updatedBooking.assigned_user_id || "").trim();
    const isOwnerEditingOwnBooking =
      Boolean(requesterUserId) &&
      Boolean(updatedByUserId) &&
      requesterUserId === updatedByUserId;
    const shouldNotifyOwner =
      Boolean(requesterUserId) &&
      !isOwnerEditingOwnBooking &&
      (
        (Boolean(updatedByUserId) && requesterUserId !== updatedByUserId) ||
        updatedByRole === "STAFF" ||
        updatedByRole === "ADMIN" ||
        updatedByRole === "DRIVER"
      );

    if (shouldNotifyOwner) {
      createNotification({
        target_user_id: requesterUserId,
        target_role: "",
        category: "Booking",
        title: "รายการจองของคุณถูกแก้ไข",
        message: buildDestinationStartMessage_(updatedBooking, "รายการจองของคุณมีการเปลี่ยนแปลง"),
        type: "BOOKING_UPDATED",
        booking_id: updatedBooking.booking_id || data.booking_id,
        url: "/booking",
        created_by: updatedBy,
        payload_json: buildNotificationPayloadFromBooking_(updatedBooking, {
          status: statusCol !== undefined && statusCol !== -1 ? rowValues[statusCol] || "" : "",
        }),
      });
    }

    if (isOwnerEditingOwnBooking) {
      const editMessage = buildRequesterDestinationStartMessage_(updatedBooking, "รายการจองถูกแก้ไขโดยผู้จอง");
      createRoleNotifications_(["STAFF"], {
        category: "Booking",
        title: "รายการจองถูกแก้ไขโดยผู้จอง",
        message: editMessage,
        type: "BOOKING_UPDATED_BY_REQUESTER",
        booking_id: updatedBooking.booking_id || data.booking_id,
        url: "/booking",
        created_by: updatedBy,
        payload_json: buildNotificationPayloadFromBooking_(updatedBooking, {
          editor_user_id: updatedByUserId,
          status: statusCol !== undefined && statusCol !== -1 ? rowValues[statusCol] || "" : "",
        }),
      });

      if (assignedDriverUserId && assignedDriverUserId !== updatedByUserId) {
        createNotification({
          target_user_id: assignedDriverUserId,
          target_role: "",
          category: "Booking",
          title: "รายการจองถูกแก้ไขโดยผู้จอง",
          message: editMessage,
          type: "BOOKING_UPDATED_BY_REQUESTER",
          booking_id: updatedBooking.booking_id || data.booking_id,
          url: "/driver-jobs",
          created_by: updatedBy,
          payload_json: buildNotificationPayloadFromBooking_(updatedBooking, {
            editor_user_id: updatedByUserId,
            status: statusCol !== undefined && statusCol !== -1 ? rowValues[statusCol] || "" : "",
          }),
        });
      }
    }
  } catch (notificationErr) {
    console.warn("updateBooking notification failed", notificationErr);
  }

  return jsonOutput({
    success: true,
    message: "Update booking success",
    data: buildBookingResponseWithActivityData_({
      ...updatedBooking,
      booking_id: data.booking_id,
    }),
    created_notifications: getCreatedNotifications_(),
  });
}
function approveBooking(data) {
  const sheet = ensureBookingsSheet();

  const table = readSheetTable(sheet);
  const values = [table.headers].concat(table.rows);
  const headers = table.headers;
  const columnMap = table.columnMap;

  const bookingIdCol = columnMap.booking_id;
  const bookingNoCol = columnMap.booking_no;
  const vehicleIdCol = columnMap.vehicle_id;
  const assignedUserIdCol = ensureColumn(sheet, headers, "assigned_user_id");
  const assignedUserNameCol = ensureColumn(sheet, headers, "assigned_user_name");
  const statusCol = columnMap.status;
  const staffNoteCol = columnMap.staff_note;
  const updatedAtCol = columnMap.updated_at;
  const startCol = columnMap.start_datetime;
  const endCol = columnMap.end_datetime;

  if (!data.booking_id) {
    return jsonOutput({
      success: false,
      message: "booking_id is required"
    });
  }
  const row = findRowByBookingId(table, data.booking_id);
  logBookingAction("approveBooking", data.booking_id, row);
  if (row <= 1) {
    return jsonOutput({
      success: false,
      message: "Booking not found"
    });
  }

  const currentRow = row - 1;
  const currentBooking = {
    booking_id: values[currentRow][bookingIdCol],
    booking_no: bookingNoCol !== -1 ? values[currentRow][bookingNoCol] : "",
    vehicle_id: data.vehicle_id || "",
    start_datetime: values[currentRow][startCol],
    end_datetime: values[currentRow][endCol],
    assigned_user_id: values[currentRow][assignedUserIdCol] || "",
    assigned_user_name: values[currentRow][assignedUserNameCol] || "",
    status: values[currentRow][statusCol] || "",
  };

  const assignedDriverUserId = String(data.assigned_user_id || data.driver_id || "").trim();
  const assignedDriverName = String(data.assigned_user_name || data.driver_name || "").trim();
  const activeDriverLookup = getActiveDriverLookup_();
  const assignedDriver =
    (assignedDriverUserId && activeDriverLookup.byId.get(assignedDriverUserId)) ||
    (assignedDriverName && activeDriverLookup.byName.get(assignedDriverName.toLowerCase())) ||
    null;

  if (String(currentBooking.vehicle_id || "").trim()) {
    const availability = checkVehicleAvailability(currentBooking, table);

    if (!availability.available) {
      return jsonOutput({
        success: false,
        message: availability.message,
        conflict_booking_no: availability.conflict_booking_no
      });
    }
  }

  if (!assignedDriver || String(assignedDriver.role || "").trim().toUpperCase() !== "DRIVER" || String(assignedDriver.status || "").trim().toUpperCase() !== "ACTIVE") {
    return jsonOutput({
      success: false,
      message: "คนขับไม่พร้อมรับงาน",
    });
  }

  if (hasDriverActiveAssignment(assignedDriverUserId, currentBooking.booking_id)) {
    return jsonOutput({
      success: false,
      message: "คนขับมีงานที่มอบหมายแล้ว",
    });
  }

  const driverUnavailableConflict = getDriverUnavailableConflict(
    assignedDriverUserId,
    currentBooking.start_datetime,
    currentBooking.end_datetime,
    ""
  );

  if (driverUnavailableConflict) {
    return jsonOutput({
      success: false,
      message: "คนขับไม่พร้อม / ติดภารกิจ",
    });
  }

  const rowValues = table.rows[row - 2].slice();
  rowValues[vehicleIdCol] = data.vehicle_id || "";
  rowValues[assignedUserIdCol] = assignedDriverUserId;
  rowValues[assignedUserNameCol] = assignedDriver ? String(assignedDriver.name || "").trim() || assignedDriverName : assignedDriverName;
  rowValues[statusCol] = "APPROVED";
  rowValues[staffNoteCol] = appendUniqueNote(rowValues[staffNoteCol], data.staff_note || "");
  rowValues[updatedAtCol] = new Date();
  setRowValues(sheet, row, rowValues);

  const updatedAtValue = rowValues[updatedAtCol];
  const resolvedAssignedDriverName = rowValues[assignedUserNameCol];
  const resolvedVehicleId = rowValues[vehicleIdCol];
  const previousAssignedDriverName = String(currentBooking.assigned_user_name || "").trim();
  const previousAssignedDriverId = String(currentBooking.assigned_user_id || "").trim();
  const previousVehicleId = String(currentBooking.vehicle_id || "").trim();
  const previousStatus = String(currentBooking.status || "").trim().toUpperCase();
  const approvalActorName = String(
    data.current_user_name || data.created_by || data.updated_by || data.staff_name || ""
  ).trim();
  const approvalActorUserId = String(
    data.current_user_id || data.created_by_user_id || data.updated_by_user_id || ""
  ).trim();

  if (previousStatus !== "APPROVED") {
    appendBookingActivityLog(data.booking_id, "อนุมัติรายการ", {
      actor_name: approvalActorName,
      actor_user_id: approvalActorUserId,
      detail: [
        resolvedAssignedDriverName ? `คนขับ: ${resolvedAssignedDriverName}` : "",
        resolvedVehicleId ? `รถ: ${resolvedVehicleId}` : "",
      ].filter(Boolean).join(" | ") || "อนุมัติรายการจอง",
      old_driver_user_id: previousAssignedDriverId,
      old_driver_name: previousAssignedDriverName,
      new_driver_user_id: assignedDriverUserId,
      new_driver_name: resolvedAssignedDriverName,
      old_vehicle_id: previousVehicleId,
      new_vehicle_id: resolvedVehicleId,
      created_at: updatedAtValue,
    });
  }

  if (
    previousAssignedDriverId &&
    assignedDriverUserId &&
    previousAssignedDriverId !== assignedDriverUserId
  ) {
    appendBookingActivityLog(data.booking_id, "เปลี่ยนคนขับ", {
      actor_name: approvalActorName,
      actor_user_id: approvalActorUserId,
      detail: `${previousAssignedDriverName || previousAssignedDriverId} → ${resolvedAssignedDriverName || assignedDriverUserId}`,
      old_driver_user_id: previousAssignedDriverId,
      old_driver_name: previousAssignedDriverName,
      new_driver_user_id: assignedDriverUserId,
      new_driver_name: resolvedAssignedDriverName,
      old_vehicle_id: previousVehicleId,
      new_vehicle_id: resolvedVehicleId,
      created_at: updatedAtValue,
    });
  }

  if (
    previousVehicleId &&
    resolvedVehicleId &&
    previousVehicleId !== resolvedVehicleId
  ) {
    appendBookingActivityLog(data.booking_id, "เปลี่ยนรถ", {
      actor_name: approvalActorName,
      actor_user_id: approvalActorUserId,
      detail: `${previousVehicleId} → ${resolvedVehicleId}`,
      old_driver_user_id: previousAssignedDriverId,
      old_driver_name: previousAssignedDriverName,
      new_driver_user_id: assignedDriverUserId,
      new_driver_name: resolvedAssignedDriverName,
      old_vehicle_id: previousVehicleId,
      new_vehicle_id: resolvedVehicleId,
      created_at: updatedAtValue,
    });
  }

  const currentUserName = approvalActorName;
  if (String(rowValues[assignedUserIdCol] || "").trim()) {
    appendDriverJobLog_(
      createDriverJobLogPayload_({
        booking_id: values[currentRow][bookingIdCol],
        booking_no: bookingNoCol !== -1 ? values[currentRow][bookingNoCol] : "",
        driver_user_id: rowValues[assignedUserIdCol],
        driver_name: rowValues[assignedUserNameCol],
        vehicle_id: rowValues[vehicleIdCol],
        action: "ASSIGNED",
        reason: rowValues[staffNoteCol] || "",
        requester_name: rowValues[columnMap.requester_name] || "",
        start_datetime: rowValues[startCol] || "",
        end_datetime: rowValues[endCol] || "",
        destination: rowValues[columnMap.destination] || "",
        purpose: rowValues[columnMap.purpose] || "",
        staff_name: currentUserName || "",
        created_by: currentUserName || "",
        assigned_by_name: currentUserName || "",
      })
    );

    const assignedNotificationUserId = String(rowValues[assignedUserIdCol] || "").trim();
    try {
      const assignedBooking = rowsToObjects(headers, [rowValues])[0] || {};
      createBookingAssignmentNotifications_(assignedBooking, {
        assigned_user_id: assignedNotificationUserId,
        assigned_user_name: String(rowValues[assignedUserNameCol] || "").trim(),
        previous_assigned_user_id: currentBooking.assigned_user_id || "",
        previous_status: currentBooking.status || "",
        created_by: currentUserName || "",
      });
    } catch (notificationErr) {
      console.warn("approveBooking notification failed", notificationErr);
    }
  }

  return jsonOutput({
    success: true,
    message: "Approve booking success",
    data: buildBookingResponseWithActivityData_({
      booking_id: values[currentRow][bookingIdCol],
      booking_no: bookingNoCol !== -1 ? values[currentRow][bookingNoCol] : "",
      vehicle_id: data.vehicle_id || "",
      assigned_user_id: data.assigned_user_id || data.driver_id || "",
      assigned_user_name: data.assigned_user_name || data.driver_name || "",
      status: "APPROVED"
    }),
    created_notifications: getCreatedNotifications_(),
  });
}

function assignCentralVehicle(data) {
  const bookingId = String(data && data.booking_id || "").trim();
  const reason = normalizeNoteParts([data && data.reason || ""]).join("\n");
  const completedBy = String(data && data.completed_by || "").trim();
  const completedByUserId = String(data && data.completed_by_user_id || "").trim();

  if (!bookingId) {
    return jsonOutput({
      success: false,
      message: "booking_id is required",
    });
  }

  if (!reason) {
    return jsonOutput({
      success: false,
      message: "reason is required",
    });
  }

  if (!completedBy) {
    return jsonOutput({
      success: false,
      message: "completed_by is required",
    });
  }

  if (!completedByUserId) {
    return jsonOutput({
      success: false,
      message: "completed_by_user_id is required",
    });
  }

  const centralDriverUserId = "U007";
  const centralDriverName = "พขร.สนง.กลาง";
  const now = new Date();
  const nowIso = now.toISOString();
  const sheet = ensureBookingsSheet();
  const table = readSheetTable(sheet);
  const headers = table.headers;
  const columnMap = table.columnMap;
  const rowNumber = findRowByBookingId(table, bookingId);

  logBookingAction("assignCentralVehicle", bookingId, rowNumber);

  if (rowNumber <= 1) {
    return jsonOutput({
      success: false,
      message: "Booking not found",
    });
  }

  const rowValues = table.rows[rowNumber - 2].slice();
  const statusCol = columnMap.status;
  const bookingNoCol = columnMap.booking_no;
  const requesterNameCol = columnMap.requester_name;
  const startDatetimeCol = columnMap.start_datetime;
  const endDatetimeCol = columnMap.end_datetime;
  const destinationCol = columnMap.destination;
  const purposeCol = columnMap.purpose;
  const vehicleIdCol = ensureColumn(sheet, headers, "vehicle_id");
  const assignedUserIdCol = ensureColumn(sheet, headers, "assigned_user_id");
  const assignedUserNameCol = ensureColumn(sheet, headers, "assigned_user_name");
  const driverUserIdCol = ensureColumn(sheet, headers, "driver_user_id");
  const driverNameCol = ensureColumn(sheet, headers, "driver_name");
  const staffNoteCol = ensureColumn(sheet, headers, "staff_note");
  const updatedAtCol = ensureColumn(sheet, headers, "updated_at");
  const updatedByCol = ensureColumn(sheet, headers, "updated_by");
  const assignmentModeCol = ensureColumn(sheet, headers, "assignment_mode");
  const centralVehicleReasonCol = ensureColumn(sheet, headers, "central_vehicle_reason");
  const centralVehicleCompletedAtCol = ensureColumn(sheet, headers, "central_vehicle_completed_at");
  const centralVehicleCompletedByCol = ensureColumn(sheet, headers, "central_vehicle_completed_by");
  const actualStartDatetimeCol = ensureColumn(sheet, headers, "actual_start_datetime");
  const actualStartByCol = ensureColumn(sheet, headers, "actual_start_by");
  const actualReturnDatetimeCol = ensureColumn(sheet, headers, "actual_return_datetime");
  const actualReturnByCol = ensureColumn(sheet, headers, "actual_return_by");
  const driverCancelRequestStatusCol = ensureColumn(sheet, headers, "driver_cancel_request_status");

  const currentStatus = String(statusCol !== undefined ? rowValues[statusCol] : "").trim().toUpperCase();
  if (currentStatus !== "PENDING") {
    return jsonOutput({
      success: false,
      message: "อนุญาตให้ใช้รถ สนง.กลาง เฉพาะรายการที่รออนุมัติเท่านั้น",
    });
  }

  const driverCancelRequestStatus = String(
    driverCancelRequestStatusCol !== undefined && driverCancelRequestStatusCol !== -1
      ? rowValues[driverCancelRequestStatusCol]
      : ""
  ).trim().toUpperCase();

  if (driverCancelRequestStatus === "PENDING") {
    return jsonOutput({
      success: false,
      message: "รายการนี้มีคำขอยกเลิกงานคนขับที่รออนุมัติอยู่",
    });
  }

  rowValues[assignedUserIdCol] = centralDriverUserId;
  rowValues[assignedUserNameCol] = centralDriverName;
  rowValues[driverUserIdCol] = centralDriverUserId;
  rowValues[driverNameCol] = centralDriverName;
  rowValues[statusCol] = "COMPLETED";
  rowValues[assignmentModeCol] = "CENTRAL_VEHICLE";
  rowValues[centralVehicleReasonCol] = reason;
  rowValues[centralVehicleCompletedAtCol] = nowIso;
  rowValues[centralVehicleCompletedByCol] = completedBy;
  rowValues[actualStartDatetimeCol] = nowIso;
  rowValues[actualStartByCol] = completedBy;
  rowValues[actualReturnDatetimeCol] = nowIso;
  rowValues[actualReturnByCol] = completedBy;
  rowValues[updatedAtCol] = now;
  rowValues[updatedByCol] = completedBy;

  rowValues[staffNoteCol] = appendUniqueNote(rowValues[staffNoteCol], `[ใช้รถ สนง.กลาง] ${reason}`);

  setRowValues(sheet, rowNumber, rowValues);

  appendBookingActivityLog(bookingId, "ใช้รถ สนง.กลาง", {
    actor_name: completedBy,
    actor_user_id: completedByUserId,
    detail: reason,
    new_driver_user_id: centralDriverUserId,
    new_driver_name: centralDriverName,
    new_vehicle_id: normalizeBookingActivityText_(rowValues[vehicleIdCol]),
    created_at: nowIso,
  });

  const updatedBooking = buildBookingResponseWithActivityData_(rowsToObjects(headers, [rowValues])[0] || {});
  const bookingNo = bookingNoCol !== undefined && bookingNoCol !== -1 ? String(rowValues[bookingNoCol] || "").trim() : "";

  appendDriverJobLog_(
    createDriverJobLogPayload_({
      booking_id: bookingId,
      booking_no: bookingNo,
      driver_user_id: centralDriverUserId,
      driver_name: centralDriverName,
      assigned_user_id: centralDriverUserId,
      assigned_user_name: centralDriverName,
      vehicle_id: vehicleIdCol !== undefined && vehicleIdCol !== -1 ? rowValues[vehicleIdCol] || "" : "",
      status: "COMPLETED",
      action: "COMPLETED",
      reason: reason,
      requester_name: requesterNameCol !== undefined && requesterNameCol !== -1 ? rowValues[requesterNameCol] || "" : "",
      start_datetime: startDatetimeCol !== undefined && startDatetimeCol !== -1 ? rowValues[startDatetimeCol] || "" : "",
      end_datetime: endDatetimeCol !== undefined && endDatetimeCol !== -1 ? rowValues[endDatetimeCol] || "" : "",
      destination: destinationCol !== undefined && destinationCol !== -1 ? rowValues[destinationCol] || "" : "",
      purpose: purposeCol !== undefined && purposeCol !== -1 ? rowValues[purposeCol] || "" : "",
      created_by: completedBy,
      assigned_by_name: completedBy,
      assigned_by: completedByUserId,
    })
  );

  try {
    const requesterUserId = resolveRequesterNotificationUserId_(updatedBooking);
    if (requesterUserId) {
      createNotification({
        target_user_id: requesterUserId,
        target_role: "",
        title: String(updatedBooking.destination || "").trim() || "ใช้รถ สนง.กลาง",
        message: reason,
        type: "CENTRAL_VEHICLE_ASSIGNED",
        booking_id: bookingId,
        url: "/booking",
        created_by: completedBy,
        payload_json: buildNotificationPayloadFromBooking_(updatedBooking, {
          driver_user_id: centralDriverUserId,
          driver_name: centralDriverName,
          assignment_mode: "CENTRAL_VEHICLE",
          reason: reason,
          status: "COMPLETED",
        }),
      });
    }
  } catch (notificationErr) {
    console.warn("assignCentralVehicle notification failed", notificationErr);
  }

  return jsonOutput({
    success: true,
    message: "Assign central vehicle success",
    data: updatedBooking,
    created_notifications: getCreatedNotifications_(),
  });
}

function startTrip(data) {
  const bookingSheet = ensureBookingsSheet();
  const logSheet = ensureVehicleLogsSheet();

  const table = readSheetTable(bookingSheet);
  const values = [table.headers].concat(table.rows);
  const headers = table.headers;
  const columnMap = table.columnMap;

  const statusCol = columnMap.status;
  const vehicleIdCol = columnMap.vehicle_id;
  const updatedAtCol = columnMap.updated_at;
  const actualStartDatetimeCol = ensureColumn(bookingSheet, headers, "actual_start_datetime");
  const actualStartByCol = ensureColumn(bookingSheet, headers, "actual_start_by");

  if (!data.booking_id) {
    return jsonOutput({ success: false, message: "booking_id is required" });
  }

  const row = findRowByBookingId(table, data.booking_id);
  logBookingAction("startTrip", data.booking_id, row);
  if (row <= 1) {
    return jsonOutput({ success: false, message: "Booking not found" });
  }

  const userLookup = buildUserLookup();
  const currentRow = row - 1;
  const now = new Date();
  const currentBooking = applyAssignedUserFallback(rowsToObjects(headers, [values[currentRow]])[0] || {}, userLookup);
  const assignedUserId = currentBooking.assigned_user_id || data.assigned_user_id || "";
  const assignedUserName = currentBooking.assigned_user_name || data.assigned_user_name || "";
  const actualStartDatetime = data.actual_start_datetime || data.out_time || now.toISOString();
  const actualStartBy = data.actual_start_by || assignedUserName || "";

  const bookingRowValues = table.rows[row - 2].slice();
  bookingRowValues[statusCol] = "IN_USE";
  bookingRowValues[actualStartDatetimeCol] = actualStartDatetime;
  bookingRowValues[actualStartByCol] = actualStartBy;
  bookingRowValues[updatedAtCol] = now;
  setRowValues(bookingSheet, row, bookingRowValues);

  appendDriverJobLog_(
    createDriverJobLogPayload_({
      booking_id: currentBooking.booking_id,
      booking_no: currentBooking.booking_no || "",
      driver_user_id: assignedUserId,
      driver_name: assignedUserName,
      vehicle_id: currentBooking.vehicle_id || "",
      action: "STARTED",
      reason: "",
      requester_name: currentBooking.requester_name || "",
      start_datetime: currentBooking.start_datetime || "",
      end_datetime: currentBooking.end_datetime || "",
      destination: currentBooking.destination || "",
      purpose: currentBooking.purpose || "",
      created_by: assignedUserName || "",
    })
  );

  const logId = "LOG" + Utilities.formatString("%04d", logSheet.getLastRow());
  const logTable = readSheetTable(logSheet);
  const logHeaders = logTable.headers;
  const logIdCol = ensureColumn(logSheet, logHeaders, "log_id");
  const logBookingIdCol = ensureColumn(logSheet, logHeaders, "booking_id");
  const logVehicleIdCol = ensureColumn(logSheet, logHeaders, "vehicle_id");
  const logAssignedUserIdCol = ensureColumn(logSheet, logHeaders, "assigned_user_id");
  const logAssignedUserNameCol = ensureColumn(logSheet, logHeaders, "assigned_user_name");
  const logOutTimeCol = ensureColumn(logSheet, logHeaders, "out_time");
  const logOutMileageCol = ensureColumn(logSheet, logHeaders, "out_mileage");
  const logInTimeCol = ensureColumn(logSheet, logHeaders, "in_time");
  const logInMileageCol = ensureColumn(logSheet, logHeaders, "in_mileage");
  const logRemarkCol = ensureColumn(logSheet, logHeaders, "remark");
  const logCreatedAtCol = ensureColumn(logSheet, logHeaders, "created_at");
  const logUpdatedAtCol = ensureColumn(logSheet, logHeaders, "updated_at");

  const logRowValues = Array(logHeaders.length).fill("");
  logRowValues[logIdCol] = logId;
  logRowValues[logBookingIdCol] = data.booking_id;
  logRowValues[logVehicleIdCol] = values[currentRow][vehicleIdCol] || "";
  logRowValues[logAssignedUserIdCol] = assignedUserId;
  logRowValues[logAssignedUserNameCol] = assignedUserName;
  logRowValues[logOutTimeCol] = data.out_time || now;
  logRowValues[logOutMileageCol] = data.out_mileage || "";
  logRowValues[logInTimeCol] = "";
  logRowValues[logInMileageCol] = "";
  logRowValues[logRemarkCol] = data.remark || "";
  logRowValues[logCreatedAtCol] = now;
  logRowValues[logUpdatedAtCol] = now;
  appendSheetRow(logSheet, logRowValues);

  const bookingForNotification = rowsToObjects(headers, [bookingRowValues])[0] || currentBooking || {};
  const requesterUserId = String(
    bookingForNotification.requester_user_id ||
      bookingForNotification.created_by_user_id ||
      bookingForNotification.user_id ||
      bookingForNotification.created_user_id ||
      ""
  ).trim();
  const driverName = String(
    data.assigned_user_name ||
      data.actual_start_by ||
      bookingForNotification.assigned_user_name ||
      bookingForNotification.driver_name ||
      ""
  ).trim();
  try {
    if (requesterUserId) {
      createNotification({
        target_user_id: requesterUserId,
        target_role: "",
        category: "Driver",
        title: "คนขับรับงานของคุณแล้ว",
        message: buildDriverDestinationStartMessage_(
          bookingForNotification,
          driverName,
          "คนขับรับงานของคุณแล้ว"
        ),
        type: "DRIVER_STARTED_JOB",
        booking_id: bookingForNotification.booking_id || data.booking_id || "",
        url: "/booking",
        created_by: driverName || data.actual_start_by || "",
        payload_json: buildNotificationPayloadFromBooking_(bookingForNotification, {
          driver_name: driverName || bookingForNotification.assigned_user_name || "",
          status: "IN_USE",
        }),
      });
    }
  } catch (notificationErr) {
    console.warn("startTrip notification failed", notificationErr);
  }

  return jsonOutput({
    success: true,
    message: "Start trip success",
    data: {
      booking_id: data.booking_id,
      status: "IN_USE",
      actual_start_datetime: actualStartDatetime,
      actual_start_by: actualStartBy,
      updated_at: now.toISOString(),
      log_id: logId
    },
    created_notifications: getCreatedNotifications_(),
  });
}

function completeTrip(data) {
  const bookingSheet = ensureBookingsSheet();
  const logSheet = ensureVehicleLogsSheet();

  const bookingTable = readSheetTable(bookingSheet);
  const bookingHeaders = bookingTable.headers;
  const bookingColumnMap = bookingTable.columnMap;

  const statusCol = bookingColumnMap.status;
  const updatedAtCol = bookingColumnMap.updated_at;
  const actualReturnDatetimeCol = ensureColumn(bookingSheet, bookingHeaders, "actual_return_datetime");
  const actualReturnByCol = ensureColumn(bookingSheet, bookingHeaders, "actual_return_by");

  const logTable = readSheetTable(logSheet);
  const logValues = [logTable.headers].concat(logTable.rows);
  const logHeaders = logTable.headers;
  const logColumnMap = logTable.columnMap;

  const logBookingIdCol = logColumnMap.booking_id;
  const inTimeCol = logColumnMap.in_time;
  const inMileageCol = logColumnMap.in_mileage;
  const remarkCol = logColumnMap.remark;
  const logUpdatedAtCol = logColumnMap.updated_at;

  if (!data.booking_id) {
    return jsonOutput({ success: false, message: "booking_id is required" });
  }

  const bookingRow = findRowByBookingId(bookingTable, data.booking_id);
  logBookingAction("completeTrip", data.booking_id, bookingRow);
  if (bookingRow <= 1) {
    return jsonOutput({ success: false, message: "Booking not found" });
  }

  const bookingRowValues = bookingTable.rows[bookingRow - 2].slice();
  bookingRowValues[statusCol] = "COMPLETED";
  const completedBooking = rowsToObjects(bookingHeaders, [bookingRowValues])[0] || {};
  const actualReturnDatetime = data.actual_return_datetime || data.in_time || new Date().toISOString();
  const actualReturnBy = data.actual_return_by || completedBooking.assigned_user_name || data.assigned_user_name || "";
  bookingRowValues[actualReturnDatetimeCol] = actualReturnDatetime;
  bookingRowValues[actualReturnByCol] = actualReturnBy;
  bookingRowValues[updatedAtCol] = new Date();
  setRowValues(bookingSheet, bookingRow, bookingRowValues);

  const completedAssignedUserId = String(completedBooking.assigned_user_id || "").trim();
  const completedAssignedUserName = String(completedBooking.assigned_user_name || "").trim();

  appendDriverJobLog_(
    createDriverJobLogPayload_({
      booking_id: completedBooking.booking_id || data.booking_id,
      booking_no: completedBooking.booking_no || "",
      driver_user_id: completedAssignedUserId,
      driver_name: completedAssignedUserName,
      vehicle_id: completedBooking.vehicle_id || "",
      action: "COMPLETED",
      reason: data.remark || "",
      requester_name: completedBooking.requester_name || "",
      start_datetime: completedBooking.start_datetime || "",
      end_datetime: completedBooking.end_datetime || "",
      destination: completedBooking.destination || "",
      purpose: completedBooking.purpose || "",
      created_by: completedAssignedUserName || "",
    })
  );

  for (let i = logValues.length - 1; i >= 1; i--) {
    if (logValues[i][logBookingIdCol] === data.booking_id) {
      const row = i + 1;
      const now = new Date();

      const logRowValues = logValues[i].slice();
      logRowValues[inTimeCol] = data.in_time || now;
      logRowValues[inMileageCol] = data.in_mileage || "";
      logRowValues[remarkCol] = data.remark || logValues[i][remarkCol] || "";
      logRowValues[logUpdatedAtCol] = now;
      setRowValues(logSheet, row, logRowValues);

      const completedDriverName = String(actualReturnBy || completedAssignedUserName || completedBooking.driver_name || "").trim();
      try {
        createRoleNotifications_(["STAFF", "ADMIN"], {
          title: "ปิดงานแล้ว",
          message: `คนขับ ${completedDriverName || "-"} ปิดงานแล้ว ปลายทาง ${String(completedBooking.destination || "").trim() || "-"}`,
          type: "DRIVER_COMPLETED_JOB",
          booking_id: completedBooking.booking_id || data.booking_id,
          url: "/booking",
          created_by: completedDriverName || completedAssignedUserName || "",
          payload_json: buildNotificationPayloadFromBooking_(completedBooking, {
            driver_name: completedDriverName || completedBooking.assigned_user_name || "",
            actual_return_datetime: actualReturnDatetime,
            status: "COMPLETED",
          }),
        });
      } catch (notificationErr) {
        console.warn("completeTrip notification failed", notificationErr);
      }

      return jsonOutput({
        success: true,
        message: "Complete trip success",
        data: {
          booking_id: data.booking_id,
          status: "COMPLETED",
          actual_return_datetime: actualReturnDatetime,
          actual_return_by: actualReturnBy,
          updated_at: new Date().toISOString()
        },
        created_notifications: getCreatedNotifications_(),
      });
    }
  }

  return jsonOutput({
    success: false,
    message: "ไม่พบประวัติการออกรถ กรุณากดรับงาน/ออกรถก่อน"
  });
}

function appendBookingBypassLog_(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("BookingBypassLogs");
  if (!sheet) return;

  const headers = [
    "log_id",
    "booking_id",
    "booking_no",
    "driver_user_id",
    "driver_name",
    "vehicle_id",
    "action",
    "reason",
    "created_at",
    "created_by",
  ];

  const table = readSheetTable(sheet);
  if (table.headers.length === 0 && sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  const refreshedTable = readSheetTable(sheet);
  const logIdCol = ensureColumn(sheet, refreshedTable.headers, "log_id");
  const bookingIdCol = ensureColumn(sheet, refreshedTable.headers, "booking_id");
  const bookingNoCol = ensureColumn(sheet, refreshedTable.headers, "booking_no");
  const driverUserIdCol = ensureColumn(sheet, refreshedTable.headers, "driver_user_id");
  const driverNameCol = ensureColumn(sheet, refreshedTable.headers, "driver_name");
  const vehicleIdCol = ensureColumn(sheet, refreshedTable.headers, "vehicle_id");
  const actionCol = ensureColumn(sheet, refreshedTable.headers, "action");
  const reasonCol = ensureColumn(sheet, refreshedTable.headers, "reason");
  const createdAtCol = ensureColumn(sheet, refreshedTable.headers, "created_at");
  const createdByCol = ensureColumn(sheet, refreshedTable.headers, "created_by");

  const rowValues = Array(refreshedTable.headers.length).fill("");
  rowValues[logIdCol] = "LOG" + Utilities.formatString("%04d", sheet.getLastRow() + 1);
  rowValues[bookingIdCol] = payload.booking_id || "";
  rowValues[bookingNoCol] = payload.booking_no || "";
  rowValues[driverUserIdCol] = payload.driver_user_id || "";
  rowValues[driverNameCol] = payload.driver_name || "";
  rowValues[vehicleIdCol] = payload.vehicle_id || "";
  rowValues[actionCol] = payload.action || "";
  rowValues[reasonCol] = payload.reason || "";
  rowValues[createdAtCol] = payload.created_at || new Date();
  rowValues[createdByCol] = payload.created_by || "";

  appendSheetRow(sheet, rowValues);
}

function backdateCompleteBooking(data) {
  const bookingSheet = ensureBookingsSheet();
  const table = readSheetTable(bookingSheet);
  const headers = table.headers;
  const columnMap = table.columnMap;
  const userLookup = buildUserLookup();

  const statusCol = columnMap.status;
  const assignedUserIdCol = ensureColumn(bookingSheet, headers, "assigned_user_id");
  const assignedUserNameCol = ensureColumn(bookingSheet, headers, "assigned_user_name");
  const vehicleIdCol = ensureColumn(bookingSheet, headers, "vehicle_id");
  const actualStartDatetimeCol = ensureColumn(bookingSheet, headers, "actual_start_datetime");
  const actualReturnDatetimeCol = ensureColumn(bookingSheet, headers, "actual_return_datetime");
  const actualStartByCol = ensureColumn(bookingSheet, headers, "actual_start_by");
  const actualReturnByCol = ensureColumn(bookingSheet, headers, "actual_return_by");
  const staffNoteCol = ensureColumn(bookingSheet, headers, "staff_note");
  const isBackdatedCol = ensureColumn(bookingSheet, headers, "is_backdated");
  const backdatedCompletedAtCol = ensureColumn(bookingSheet, headers, "backdated_completed_at");
  const backdatedCompletedByCol = ensureColumn(bookingSheet, headers, "backdated_completed_by");
  const updatedAtCol = ensureColumn(bookingSheet, headers, "updated_at");
  const updatedByCol = ensureColumn(bookingSheet, headers, "updated_by");

  if (!data.booking_id) {
    return jsonOutput({ success: false, message: "booking_id is required" });
  }

  const row = findRowByBookingId(table, data.booking_id);
  logBookingAction("backdateCompleteBooking", data.booking_id, row);
  if (row <= 1) {
    return jsonOutput({ success: false, message: "Booking not found" });
  }

  const now = new Date();
  const actor = String(data.actual_start_by || data.actual_return_by || data.updated_by || "").trim();
  const assignedUserId = String(data.assigned_user_id || "").trim();
  const assignedUserName = String(data.assigned_user_name || "").trim();
  const vehicleId = String(data.vehicle_id || "").trim();
  const note = normalizeNoteParts([data.staff_note || ""]).join("\n");

  const rowValues = table.rows[row - 2].slice();
  rowValues[assignedUserIdCol] = assignedUserId;
  rowValues[assignedUserNameCol] = assignedUserName;
  rowValues[vehicleIdCol] = vehicleId;
  rowValues[actualStartDatetimeCol] = data.actual_start_datetime || "-";
  rowValues[actualReturnDatetimeCol] = data.actual_return_datetime || "-";
  rowValues[actualStartByCol] = data.actual_start_by || actor;
  rowValues[actualReturnByCol] = data.actual_return_by || actor;
  rowValues[statusCol] = "COMPLETED";
  rowValues[staffNoteCol] = appendUniqueNote(rowValues[staffNoteCol], note);
  rowValues[isBackdatedCol] = "TRUE";
  rowValues[backdatedCompletedAtCol] = data.backdated_completed_at || now.toISOString();
  rowValues[backdatedCompletedByCol] = data.backdated_completed_by || actor;
  rowValues[updatedAtCol] = now;
  rowValues[updatedByCol] = data.updated_by || actor;
  setRowValues(bookingSheet, row, rowValues);

  const currentBooking = applyAssignedUserFallback(rowsToObjects(headers, [rowValues])[0] || {}, userLookup);
  appendDriverJobLog_(
    createDriverJobLogPayload_({
      booking_id: currentBooking.booking_id || data.booking_id,
      booking_no: currentBooking.booking_no || "",
      driver_user_id: assignedUserId,
      driver_name: assignedUserName,
      vehicle_id: vehicleId,
      action: "BACKDATE_COMPLETE",
      reason: note,
      requester_name: currentBooking.requester_name || "",
      start_datetime: currentBooking.start_datetime || "",
      end_datetime: currentBooking.end_datetime || "",
      destination: currentBooking.destination || "",
      purpose: currentBooking.purpose || "",
      created_by: actor || "",
    })
  );

  appendBookingBypassLog_({
    booking_id: currentBooking.booking_id || data.booking_id,
    booking_no: currentBooking.booking_no || "",
    driver_user_id: assignedUserId,
    driver_name: assignedUserName,
    vehicle_id: vehicleId,
    action: "BACKDATE_COMPLETE",
    reason: note,
    created_at: now,
    created_by: actor || "",
  });

  appendBookingActivityLog(data.booking_id, "บันทึกงานย้อนหลัง", {
    actor_name: actor,
    actor_user_id: String(data.updated_by_user_id || data.created_by_user_id || "").trim(),
    detail: [
      note ? `หมายเหตุ: ${note}` : "",
      rowValues[actualStartDatetimeCol] ? `เวลาออกจริง: ${formatThaiNotificationDateTime_(rowValues[actualStartDatetimeCol])}` : "",
      rowValues[actualReturnDatetimeCol] ? `เวลากลับจริง: ${formatThaiNotificationDateTime_(rowValues[actualReturnDatetimeCol])}` : "",
    ].filter(Boolean).join(" | ") || "บันทึกงานย้อนหลัง",
    new_driver_user_id: assignedUserId,
    new_driver_name: assignedUserName,
    new_vehicle_id: vehicleId,
    created_at: rowValues[updatedAtCol],
  });

  return jsonOutput({
    success: true,
    message: "Backdate complete booking success",
    data: buildBookingResponseWithActivityData_({
      booking_id: currentBooking.booking_id || data.booking_id,
      booking_no: currentBooking.booking_no || "",
      assigned_user_id: assignedUserId,
      assigned_user_name: assignedUserName,
      vehicle_id: vehicleId,
      actual_start_datetime: rowValues[actualStartDatetimeCol] || "-",
      actual_return_datetime: rowValues[actualReturnDatetimeCol] || "-",
      actual_start_by: rowValues[actualStartByCol] || actor,
      actual_return_by: rowValues[actualReturnByCol] || actor,
      status: "COMPLETED",
      staff_note: rowValues[staffNoteCol] || "",
      is_backdated: "TRUE",
      backdated_completed_at: rowValues[backdatedCompletedAtCol] || now.toISOString(),
      backdated_completed_by: rowValues[backdatedCompletedByCol] || actor,
      updated_at: now.toISOString(),
      updated_by: rowValues[updatedByCol] || actor,
    }, userLookup),
  });
}

function driverCancelJob(data) {
  const sheet = ensureBookingsSheet();
  const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("VehicleLogs");
  const table = readSheetTable(sheet);
  const headers = table.headers;

  if (!data.booking_id) {
    return jsonOutput({
      success: false,
      message: "booking_id is required"
    });
  }

  const reason = normalizeNoteParts([data.reason || ""]).join("\n");
  const cancelledBy = String(data.cancelled_by || "").trim();

  if (!reason) {
    return jsonOutput({
      success: false,
      message: "reason is required"
    });
  }

  const row = findRowByBookingId(table, data.booking_id);
  logBookingAction("driverCancelJob", data.booking_id, row);
  if (row <= 1) {
    return jsonOutput({
      success: false,
      message: "Booking not found"
    });
  }

  const now = new Date();
  const resolution = applyDriverCancelResolution_(sheet, table, row, data, {
    now,
    actor: cancelledBy,
    reason,
    logAction: "DRIVER_CANCELLED",
  });

  if (logSheet) {
    const logTable = readSheetTable(logSheet);
    const logHeaders = logTable.headers;
    const logIdCol = ensureColumn(logSheet, logHeaders, "log_id");
    const logBookingIdCol = ensureColumn(logSheet, logHeaders, "booking_id");
    const logActionCol = ensureColumn(logSheet, logHeaders, "action");
    const logReasonCol = ensureColumn(logSheet, logHeaders, "reason");
    const logCancelledByCol = ensureColumn(logSheet, logHeaders, "cancelled_by");
    const logCreatedAtCol = ensureColumn(logSheet, logHeaders, "created_at");
    const logUpdatedAtCol = ensureColumn(logSheet, logHeaders, "updated_at");
    const logRowValues = Array(logHeaders.length).fill("");

    logRowValues[logIdCol] = "LOG" + Utilities.formatString("%04d", logSheet.getLastRow());
    logRowValues[logBookingIdCol] = data.booking_id;
    logRowValues[logActionCol] = "DRIVER_CANCEL";
    logRowValues[logReasonCol] = reason;
    logRowValues[logCancelledByCol] = cancelledBy;
    logRowValues[logCreatedAtCol] = now;
    logRowValues[logUpdatedAtCol] = now;
    appendSheetRow(logSheet, logRowValues);
  }

  return jsonOutput({
    success: true,
    message: "Driver cancelled job success",
    data: {
      booking_id: data.booking_id,
      status: "PENDING",
      vehicle_id: "",
      vehicle_name: "",
      vehicle_code: "",
      vehicle_plate: "",
      assigned_user_id: "",
      assigned_user_name: "",
      staff_note: resolution.staffNote,
      driver_cancel_reason: reason,
      driver_cancelled_by: cancelledBy,
      driver_cancelled_at: now,
      driver_cancelled_user_id: resolution.cancelledUserId,
      updated_at: now
    }
  });
}

function requestDriverCancelJob(data) {
  const sheet = ensureBookingsSheet();
  const table = readSheetTable(sheet);
  const headers = table.headers;
  const columnMap = table.columnMap;

  if (!data.booking_id) {
    return jsonOutput({
      success: false,
      message: "booking_id is required",
    });
  }

  const reason = String(data.reason || "").trim();
  const requestedBy = String(data.requested_by || "").trim();
  const requestedByUserId = String(data.requested_by_user_id || "").trim();

  if (!reason) {
    return jsonOutput({
      success: false,
      message: "reason is required",
    });
  }

  const row = findRowByBookingId(table, data.booking_id);
  logBookingAction("requestDriverCancelJob", data.booking_id, row);
  if (row <= 1) {
    return jsonOutput({
      success: false,
      message: "Booking not found",
    });
  }

  const bookingStatus = String(table.rows[row - 2][columnMap.status] || "").trim().toUpperCase();
  if (bookingStatus === "COMPLETED" || bookingStatus === "CANCELLED") {
    return jsonOutput({
      success: false,
      message: "Booking cannot be cancelled by driver",
    });
  }

  const now = new Date();
  const requestStatusCol = ensureColumn(sheet, headers, "driver_cancel_request_status");
  const requestReasonCol = ensureColumn(sheet, headers, "driver_cancel_request_reason");
  const requestedByCol = ensureColumn(sheet, headers, "driver_cancel_requested_by");
  const requestedByUserIdCol = ensureColumn(sheet, headers, "driver_cancel_requested_by_user_id");
  const requestedAtCol = ensureColumn(sheet, headers, "driver_cancel_requested_at");
  const reviewStatusCol = ensureColumn(sheet, headers, "driver_cancel_review_status");
  const reviewReasonCol = ensureColumn(sheet, headers, "driver_cancel_review_reason");
  const reviewedByCol = ensureColumn(sheet, headers, "driver_cancel_reviewed_by");
  const reviewedAtCol = ensureColumn(sheet, headers, "driver_cancel_reviewed_at");

  const rowValues = table.rows[row - 2].slice();
  rowValues[requestStatusCol] = "PENDING";
  rowValues[requestReasonCol] = reason;
  rowValues[requestedByCol] = requestedBy;
  rowValues[requestedByUserIdCol] = requestedByUserId;
  rowValues[requestedAtCol] = now;
  rowValues[reviewStatusCol] = "";
  rowValues[reviewReasonCol] = "";
  rowValues[reviewedByCol] = "";
  rowValues[reviewedAtCol] = "";
  rowValues[columnMap.updated_at] = now;
  setRowValues(sheet, row, rowValues);

  const currentBooking = rowsToObjects(headers, [rowValues])[0] || {};

  appendBookingActivityLog(data.booking_id, "คนขับขอยกเลิกงาน", {
    actor_name: requestedBy,
    detail: reason,
    new_driver_user_id: normalizeBookingActivityText_(currentBooking.assigned_user_id),
    new_driver_name: normalizeBookingActivityText_(currentBooking.assigned_user_name),
    new_vehicle_id: normalizeBookingActivityText_(currentBooking.vehicle_id),
    created_at: now,
  });

  appendDriverJobLog_(
    createDriverJobLogPayload_({
      booking_id: currentBooking.booking_id || data.booking_id,
      booking_no: currentBooking.booking_no || "",
      driver_user_id: currentBooking.assigned_user_id || "",
      driver_name: currentBooking.assigned_user_name || "",
      vehicle_id: currentBooking.vehicle_id || "",
      action: "DRIVER_CANCEL_REQUESTED",
      reason: reason,
      requester_name: currentBooking.requester_name || "",
      start_datetime: currentBooking.start_datetime || "",
      end_datetime: currentBooking.end_datetime || "",
      destination: currentBooking.destination || "",
      purpose: currentBooking.purpose || "",
      created_by: requestedBy || "",
    })
  );

  createRoleNotifications_(["STAFF"], {
    category: "Cancellation",
    title: "มีคำขอยกเลิกงานคนขับรอพิจารณา",
    message: `คนขับ: ${String(currentBooking.assigned_user_name || "").trim() || "-"} | ผู้จอง: ${String(currentBooking.requester_name || "").trim() || "-"} | ปลายทาง: ${String(currentBooking.destination || "").trim() || "-"}`,
    type: "DRIVER_CANCEL_PENDING",
    booking_id: currentBooking.booking_id || data.booking_id,
    url: "/booking",
    created_by: requestedBy || "",
    payload_json: buildNotificationPayloadFromBooking_(currentBooking, {
      reason,
      status: String(currentBooking.status || "").trim(),
      driver_cancel_request_status: "PENDING",
    }),
  });

  return jsonOutput({
    success: true,
    message: "Driver cancel request created",
    data: buildBookingResponseWithActivityData_({
      ...currentBooking,
      driver_cancel_request_status: "PENDING",
      driver_cancel_request_reason: reason,
      driver_cancel_requested_by: requestedBy,
      driver_cancel_requested_by_user_id: requestedByUserId,
      driver_cancel_requested_at: now.toISOString(),
      driver_cancel_review_status: "",
      driver_cancel_review_reason: "",
      driver_cancel_reviewed_by: "",
      driver_cancel_reviewed_at: "",
      updated_at: now.toISOString(),
    }),
    created_notifications: getCreatedNotifications_(),
  });
}

function withdrawDriverCancelRequest(data) {
  const sheet = ensureBookingsSheet();
  const table = readSheetTable(sheet);
  const headers = table.headers;
  const columnMap = table.columnMap;

  const bookingId = String(data && data.booking_id || "").trim();
  if (!bookingId) {
    return jsonOutput({
      success: false,
      message: "booking_id is required",
    });
  }

  const row = findRowByBookingId(table, bookingId);
  if (row <= 1) {
    return jsonOutput({
      success: false,
      message: "Booking not found",
    });
  }

  const requestStatusCol = ensureColumn(sheet, headers, "driver_cancel_request_status");
  const requestReasonCol = ensureColumn(sheet, headers, "driver_cancel_request_reason");
  const requestedByCol = ensureColumn(sheet, headers, "driver_cancel_requested_by");
  const requestedByUserIdCol = ensureColumn(sheet, headers, "driver_cancel_requested_by_user_id");
  const requestedAtCol = ensureColumn(sheet, headers, "driver_cancel_requested_at");
  const reviewStatusCol = ensureColumn(sheet, headers, "driver_cancel_review_status");
  const reviewReasonCol = ensureColumn(sheet, headers, "driver_cancel_review_reason");
  const reviewedByCol = ensureColumn(sheet, headers, "driver_cancel_reviewed_by");
  const reviewedAtCol = ensureColumn(sheet, headers, "driver_cancel_reviewed_at");
  const updatedAtCol = ensureColumn(sheet, headers, "updated_at");
  const updatedByCol = ensureColumn(sheet, headers, "updated_by");
  const assignedUserIdCol = ensureColumn(sheet, headers, "assigned_user_id");
  const assignedUserNameCol = ensureColumn(sheet, headers, "assigned_user_name");

  const rowValues = table.rows[row - 2].slice();
  const requestStatus = String(rowValues[requestStatusCol] || "").trim().toUpperCase();
  if (requestStatus !== "PENDING") {
    return jsonOutput({
      success: false,
      message: "No pending driver cancel request",
    });
  }

  const currentRole = normalizeRoleValue_(data && data.current_role || "");
  const currentUserId = String(data && data.current_user_id || "").trim();
  const currentUserName = String(data && (data.current_user_name || data.requested_by || data.updated_by) || "").trim();
  const assignedUserId = String(rowValues[assignedUserIdCol] || "").trim();
  const assignedUserName = String(rowValues[assignedUserNameCol] || "").trim();

  if (currentRole === "DRIVER") {
    const userIdMatches = Boolean(currentUserId) && Boolean(assignedUserId) && currentUserId === assignedUserId;
    const userNameMatches = Boolean(currentUserName) && Boolean(assignedUserName) && currentUserName === assignedUserName;

    if (!userIdMatches && !userNameMatches) {
      return jsonOutput({
        success: false,
        message: "Driver is not assigned to this booking",
      });
    }
  }

  const currentBooking = rowsToObjects(headers, [rowValues])[0] || {};
  const driverLabel = String(
    currentBooking.assigned_user_name ||
    currentBooking.driver_name ||
    currentUserName ||
    ""
  ).trim();
  const detailMessage = buildDriverDestinationStartMessage_(
    currentBooking,
    driverLabel,
    "คนขับยกเลิกคำขอยกเลิกรับงาน"
  );
  const now = new Date();
  const actorName = currentUserName || driverLabel || String(rowValues[requestedByCol] || "").trim();
  const actorUserId = currentUserId || String(rowValues[requestedByUserIdCol] || "").trim();

  rowValues[requestStatusCol] = "";
  rowValues[requestReasonCol] = "";
  rowValues[requestedByCol] = "";
  rowValues[requestedByUserIdCol] = "";
  rowValues[requestedAtCol] = "";
  rowValues[reviewStatusCol] = "";
  rowValues[reviewReasonCol] = "";
  rowValues[reviewedByCol] = "";
  rowValues[reviewedAtCol] = "";
  rowValues[updatedAtCol] = now;
  rowValues[updatedByCol] = actorName;
  setRowValues(sheet, row, rowValues);

  const updatedBooking = rowsToObjects(headers, [rowValues])[0] || {};

  appendBookingActivityLog(bookingId, "WITHDRAW_DRIVER_CANCEL_REQUEST", {
    event_title: "คนขับยกเลิกคำขอยกเลิกรับงาน",
    actor_name: actorName,
    actor_user_id: actorUserId,
    detail: detailMessage,
    new_driver_user_id: String(updatedBooking.assigned_user_id || "").trim(),
    new_driver_name: String(updatedBooking.assigned_user_name || "").trim(),
    new_vehicle_id: String(updatedBooking.vehicle_id || "").trim(),
    created_at: now,
  });

  createRoleNotifications_(["STAFF", "ADMIN"], {
    category: "Cancellation",
    title: "คนขับยกเลิกคำขอยกเลิกรับงาน",
    message: detailMessage,
    type: "WITHDRAW_DRIVER_CANCEL_REQUEST",
    booking_id: bookingId,
    url: "/booking",
    created_by: actorName,
    payload_json: buildNotificationPayloadFromBooking_(updatedBooking, {
      status: String(updatedBooking.status || "").trim(),
      actor_name: actorName,
      driver_cancel_request_status: "",
    }),
  });

  return jsonOutput({
    success: true,
    message: "Driver cancel request withdrawn",
    data: buildBookingResponseWithActivityData_(updatedBooking),
    created_notifications: getCreatedNotifications_(),
  });
}

function reviewDriverCancelRequest(data) {
  const sheet = ensureBookingsSheet();
  const table = readSheetTable(sheet);
  const headers = table.headers;
  const columnMap = table.columnMap;

  if (!data.booking_id) {
    return jsonOutput({
      success: false,
      message: "booking_id is required",
    });
  }

  const decision = normalizeDriverCancelDecision_(data.decision);
  if (!decision) {
    return jsonOutput({
      success: false,
      message: "decision is required",
    });
  }

  const row = findRowByBookingId(table, data.booking_id);
  logBookingAction("reviewDriverCancelRequest", data.booking_id, row);
  if (row <= 1) {
    return jsonOutput({
      success: false,
      message: "Booking not found",
    });
  }

  const requestStatusCol = ensureColumn(sheet, headers, "driver_cancel_request_status");
  const requestReasonCol = ensureColumn(sheet, headers, "driver_cancel_request_reason");
  const requestedByCol = ensureColumn(sheet, headers, "driver_cancel_requested_by");
  const requestedAtCol = ensureColumn(sheet, headers, "driver_cancel_requested_at");
  const reviewStatusCol = ensureColumn(sheet, headers, "driver_cancel_review_status");
  const reviewReasonCol = ensureColumn(sheet, headers, "driver_cancel_review_reason");
  const reviewedByCol = ensureColumn(sheet, headers, "driver_cancel_reviewed_by");
  const reviewedAtCol = ensureColumn(sheet, headers, "driver_cancel_reviewed_at");

  const currentRowValues = table.rows[row - 2].slice();
  const currentRequestStatus = String(currentRowValues[requestStatusCol] || "").trim().toUpperCase();
  if (currentRequestStatus !== "PENDING") {
    return jsonOutput({
      success: false,
      message: "No pending driver cancel request",
    });
  }

  const reviewedBy = String(data.reviewed_by || "").trim();
  const reviewReason = normalizeNoteParts([data.review_reason || ""]).join("\n");
  const now = new Date();
  const currentAssignedUserId = String(currentRowValues[columnMap.assigned_user_id] || "").trim();

  if (decision === "APPROVE") {
    const resolution = applyDriverCancelResolution_(sheet, table, row, {
      booking_id: data.booking_id,
      reason: currentRowValues[requestReasonCol] || "",
      cancelled_by: reviewedBy,
      cancelled_user_id: "",
    }, {
      now,
      actor: reviewedBy,
      noteActor: currentRowValues[requestedByCol] || reviewedBy,
      reason: currentRowValues[requestReasonCol] || "",
      logAction: "DRIVER_CANCEL_APPROVED",
      writeVehicleLog: true,
    });

    const updatedValues = resolution.rowValues.slice();
    updatedValues[requestStatusCol] = "APPROVED";
    updatedValues[reviewStatusCol] = "APPROVED";
    updatedValues[reviewReasonCol] = reviewReason || "";
    updatedValues[reviewedByCol] = reviewedBy;
    updatedValues[reviewedAtCol] = now;
    updatedValues[columnMap.updated_at] = now;
    setRowValues(sheet, row, updatedValues);

    const currentBooking = rowsToObjects(headers, [updatedValues])[0] || {};
    appendBookingActivityLog(data.booking_id, "อนุมัติยกเลิกงาน", {
      actor_name: reviewedBy,
      detail: reviewReason || String(currentRowValues[requestReasonCol] || "").trim(),
      old_driver_user_id: currentAssignedUserId,
      old_driver_name: normalizeBookingActivityText_(currentRowValues[columnMap.assigned_user_name]),
      old_vehicle_id: normalizeBookingActivityText_(currentRowValues[columnMap.vehicle_id]),
      created_at: now,
    });
    try {
      const requesterUserId = resolveRequesterNotificationUserId_(currentBooking);
      if (requesterUserId) {
        createNotification({
          target_user_id: requesterUserId,
          target_role: "",
          category: "Cancellation",
          title: "รายการจองของคุณ คนขับได้ยกเลิกงานแล้ว",
          message: `ปลายทาง: ${String(currentBooking.destination || "").trim() || "-"}`,
          type: "BOOKING_DRIVER_CANCELLED",
          booking_id: currentBooking.booking_id || data.booking_id,
          url: "/booking",
          created_by: reviewedBy || "",
          payload_json: buildNotificationPayloadFromBooking_(currentBooking, {
            review_reason: reviewReason || "",
            status: "PENDING",
          }),
        });
      }

      if (currentAssignedUserId) {
        createNotification({
          target_user_id: currentAssignedUserId,
          target_role: "",
          category: "Cancellation",
          title: "คำขอได้รับการอนุมัติแล้ว",
          message: `ผู้จอง: ${String(currentBooking.requester_name || "").trim() || "-"} | ปลายทาง: ${String(currentBooking.destination || "").trim() || "-"}`,
          type: "DRIVER_CANCEL_APPROVED",
          booking_id: currentBooking.booking_id || data.booking_id,
          url: "/driver-jobs",
          created_by: reviewedBy || "",
          payload_json: buildNotificationPayloadFromBooking_(currentBooking, {
            review_reason: reviewReason || "",
            status: "PENDING",
          }),
        });
      }
    } catch (notificationErr) {
      console.warn("reviewDriverCancelRequest approve notification failed", notificationErr);
    }
    return jsonOutput({
      success: true,
      message: "Driver cancel request approved",
      data: buildBookingResponseWithActivityData_({
        ...currentBooking,
        driver_cancel_request_status: "APPROVED",
        driver_cancel_review_status: "APPROVED",
        driver_cancel_review_reason: reviewReason || "",
        driver_cancel_reviewed_by: reviewedBy,
        driver_cancel_reviewed_at: now.toISOString(),
        status: "PENDING",
        assigned_user_id: "",
        assigned_user_name: "",
        vehicle_id: "",
        vehicle_name: "",
        vehicle_code: "",
        vehicle_plate: "",
        updated_at: now.toISOString(),
      }),
      created_notifications: getCreatedNotifications_(),
    });
  }

  if (!reviewReason) {
    return jsonOutput({
      success: false,
      message: "review_reason is required",
    });
  }

  const rejectedValues = currentRowValues.slice();
  rejectedValues[requestStatusCol] = "REJECTED";
  rejectedValues[reviewStatusCol] = "REJECTED";
  rejectedValues[reviewReasonCol] = reviewReason;
  rejectedValues[reviewedByCol] = reviewedBy;
  rejectedValues[reviewedAtCol] = now;
  rejectedValues[columnMap.updated_at] = now;
  setRowValues(sheet, row, rejectedValues);

  const currentBooking = rowsToObjects(headers, [rejectedValues])[0] || {};
  appendBookingActivityLog(data.booking_id, "ไม่อนุมัติยกเลิกงาน", {
    actor_name: reviewedBy,
    detail: reviewReason,
    new_driver_user_id: normalizeBookingActivityText_(currentBooking.assigned_user_id || currentAssignedUserId),
    new_driver_name: normalizeBookingActivityText_(currentBooking.assigned_user_name),
    new_vehicle_id: normalizeBookingActivityText_(currentBooking.vehicle_id),
    created_at: now,
  });
  appendDriverJobLog_(
    createDriverJobLogPayload_({
      booking_id: currentBooking.booking_id || data.booking_id,
      booking_no: currentBooking.booking_no || "",
      driver_user_id: currentBooking.assigned_user_id || "",
      driver_name: currentBooking.assigned_user_name || "",
      vehicle_id: currentBooking.vehicle_id || "",
      action: "DRIVER_CANCEL_REJECTED",
      reason: reviewReason,
      requester_name: currentBooking.requester_name || "",
      start_datetime: currentBooking.start_datetime || "",
      end_datetime: currentBooking.end_datetime || "",
      destination: currentBooking.destination || "",
      purpose: currentBooking.purpose || "",
      created_by: reviewedBy || "",
    })
  );

  const reviewedDriverUserId = String(currentBooking.assigned_user_id || currentAssignedUserId || "").trim();
  try {
    if (reviewedDriverUserId) {
      createNotification({
        target_user_id: reviewedDriverUserId,
        target_role: "",
        title: "ไม่อนุมัติการยกเลิกงาน",
        message: buildNotificationMessageForBooking_(currentBooking, reviewReason),
        type: "DRIVER_CANCEL_REJECTED",
        booking_id: currentBooking.booking_id || data.booking_id,
        url: "/driver-jobs",
        created_by: reviewedBy || "",
      });
    }
  } catch (notificationErr) {
    console.warn("reviewDriverCancelRequest reject notification failed", notificationErr);
  }

  return jsonOutput({
    success: true,
    message: "Driver cancel request rejected",
    data: buildBookingResponseWithActivityData_({
      ...currentBooking,
      driver_cancel_request_status: "REJECTED",
      driver_cancel_review_status: "REJECTED",
      driver_cancel_review_reason: reviewReason,
      driver_cancel_reviewed_by: reviewedBy,
      driver_cancel_reviewed_at: now.toISOString(),
      updated_at: now.toISOString(),
    }),
    created_notifications: getCreatedNotifications_(),
  });
}

function getDriverJobLogs() {
  const sheet = getSheetByName_("DriverJobLogs");

  if (!sheet) {
    return jsonOutput({
      success: true,
      total: 0,
      data: [],
    });
  }

  const { headers, rows } = readSheetTable(sheet);
  const data = rowsToObjects(headers, rows);

  return jsonOutput({
    success: true,
    total: data.length,
    data,
  });
}

function cancelBooking(data) {
  const sheet = ensureBookingsSheet();

  const table = readSheetTable(sheet);
  const values = [table.headers].concat(table.rows);
  const headers = table.headers;
  const columnMap = table.columnMap;

  const bookingIdCol = columnMap.booking_id;
  const bookingNoCol = columnMap.booking_no;
  const requesterNameCol = columnMap.requester_name;
  const departmentCol = columnMap.department;
  const phoneCol = columnMap.phone;
  const startCol = columnMap.start_datetime;
  const endCol = columnMap.end_datetime;
  const destinationCol = columnMap.destination;
  const purposeCol = columnMap.purpose;
  const vehicleTypeRequestCol = columnMap.vehicle_type_request;
  const vehicleIdCol = columnMap.vehicle_id;
  const assignedUserIdCol = ensureColumn(sheet, headers, "assigned_user_id");
  const assignedUserNameCol = ensureColumn(sheet, headers, "assigned_user_name");
  const statusCol = columnMap.status;
  const staffNoteCol = columnMap.staff_note;
  const updatedAtCol = columnMap.updated_at;

  if (!data.booking_id) {
    return jsonOutput({
      success: false,
      message: "booking_id is required"
    });
  }

  const row = findRowByBookingId(table, data.booking_id);
  logBookingAction("cancelBooking", data.booking_id, row);
  if (row <= 1) {
    return jsonOutput({
      success: false,
      message: "Booking not found"
    });
  }

  const now = new Date();
  const reason = normalizeNoteParts([data.reason || ""]).join("\n");
  const cancelledBy = String(data.cancelled_by || data.cancelled_by_name || "").trim();
  const booking = values[row - 1];

  const rowValues = table.rows[row - 2].slice();
  rowValues[statusCol] = "CANCELLED";
  rowValues[staffNoteCol] = appendUniqueNote(rowValues[staffNoteCol], reason);
  rowValues[updatedAtCol] = now;
  setRowValues(sheet, row, rowValues);
  const cancelledBooking = rowsToObjects(headers, [rowValues])[0] || {};

  appendBookingActivityLog(data.booking_id, "ยกเลิกรายการ", {
    actor_name: cancelledBy,
    detail: reason,
    old_driver_user_id: normalizeBookingActivityText_(booking[assignedUserIdCol]),
    old_driver_name: normalizeBookingActivityText_(booking[assignedUserNameCol]),
    old_vehicle_id: normalizeBookingActivityText_(booking[vehicleIdCol]),
    created_at: now,
  });

  const historySheet = ensureCancellationHistorySheet();
  const historyHeaders = readSheetTable(historySheet).headers;
  const historyId = "BCH" + Utilities.formatString("%04d", historySheet.getLastRow());
  const historyRow = Array(historyHeaders.length).fill("");

  setHistoryValue(historyHeaders, historyRow, "cancellation_id", historyId);
  setHistoryValue(historyHeaders, historyRow, "booking_id", booking[bookingIdCol]);
  setHistoryValue(historyHeaders, historyRow, "booking_no", booking[bookingNoCol]);
  setHistoryValue(historyHeaders, historyRow, "requester_name", booking[requesterNameCol]);
  setHistoryValue(historyHeaders, historyRow, "department", booking[departmentCol]);
  setHistoryValue(historyHeaders, historyRow, "phone", booking[phoneCol]);
  setHistoryValue(historyHeaders, historyRow, "start_datetime", booking[startCol]);
  setHistoryValue(historyHeaders, historyRow, "end_datetime", booking[endCol]);
  setHistoryValue(historyHeaders, historyRow, "destination", booking[destinationCol]);
  setHistoryValue(historyHeaders, historyRow, "purpose", booking[purposeCol]);
  setHistoryValue(historyHeaders, historyRow, "vehicle_type_request", booking[vehicleTypeRequestCol]);
  setHistoryValue(historyHeaders, historyRow, "vehicle_id", booking[vehicleIdCol]);
  setHistoryValue(historyHeaders, historyRow, "assigned_user_id", booking[assignedUserIdCol]);
  setHistoryValue(historyHeaders, historyRow, "assigned_user_name", booking[assignedUserNameCol]);
  setHistoryValue(historyHeaders, historyRow, "reason", reason);
  setHistoryValue(historyHeaders, historyRow, "cancelled_by", cancelledBy);
  setHistoryValue(historyHeaders, historyRow, "cancelled_at", now);
  setHistoryValue(historyHeaders, historyRow, "status", "CANCELLED");
  setHistoryValue(historyHeaders, historyRow, "updated_at", now);

  appendSheetRow(historySheet, historyRow);

  const requesterUserId = resolveRequesterNotificationUserId_(cancelledBooking);
  const cancelledAssignedUserId = String(cancelledBooking.assigned_user_id || "").trim();
  try {
    if (requesterUserId) {
      const cancellationPayload = buildNotificationPayloadFromBooking_(cancelledBooking, {
        reason,
        status: "CANCELLED",
      });
      createNotification({
        target_user_id: requesterUserId,
        target_role: "",
        title: "รายการจองถูกยกเลิก",
        message: `รายการจองของคุณถูกยกเลิก เหตุผล: ${reason || "-"}`,
        type: "BOOKING_CANCELLED",
        booking_id: cancelledBooking.booking_id || data.booking_id,
        url: "/booking",
        created_by: cancelledBy,
        payload_json: cancellationPayload,
      });
    }

    if (cancelledAssignedUserId) {
      createNotification({
        target_user_id: cancelledAssignedUserId,
        target_role: "",
        title: "รายการจองถูกยกเลิก",
        message: `รายการงานที่มอบหมายถูกยกเลิก เหตุผล: ${reason || "-"}`,
        type: "BOOKING_CANCELLED",
        booking_id: cancelledBooking.booking_id || data.booking_id,
        url: "/driver-jobs",
        created_by: cancelledBy,
        payload_json: buildNotificationPayloadFromBooking_(cancelledBooking, {
          reason,
          status: "CANCELLED",
        }),
      });
    }
  } catch (notificationErr) {
    console.warn("cancelBooking notification failed", notificationErr);
  }

  return jsonOutput({
    success: true,
    message: "Cancel booking success",
    data: buildBookingResponseWithActivityData_({
      ...cancelledBooking,
      booking_id: data.booking_id,
      status: "CANCELLED",
      reason,
      cancelled_by: cancelledBy,
    }),
    created_notifications: getCreatedNotifications_(),
  });
}

function ensureCancellationHistorySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("BookingCancellationHistory") || ss.getSheetByName("BookingCancellations");

  const headers = [
    "cancellation_id",
    "booking_id",
    "booking_no",
    "requester_name",
    "department",
    "phone",
    "start_datetime",
    "end_datetime",
    "destination",
    "purpose",
    "vehicle_type_request",
    "vehicle_id",
    "assigned_user_id",
    "assigned_user_name",
    "reason",
    "cancelled_by",
    "cancelled_at",
    "status",
    "updated_at",
  ];

  if (!sheet) {
    sheet = ss.insertSheet("BookingCancellationHistory");
    appendSheetRow(sheet, headers);
    return sheet;
  }

  const table = readSheetTable(sheet);
  ensureColumn(sheet, table.headers, "assigned_user_id");
  ensureColumn(sheet, table.headers, "assigned_user_name");

  if (sheet.getLastRow() === 0) {
    appendSheetRow(sheet, headers);
  }

  return sheet;
}

function setHistoryValue(headers, row, columnName, value) {
  const index = headers.indexOf(columnName);
  if (index !== -1) {
    row[index] = value;
  }
}

function getBookingCancellations() {
  const sheet = ensureCancellationHistorySheet();
  const { headers, rows } = readSheetTable(sheet);

  if (rows.length === 0) {
    return jsonOutput({
      success: true,
      total: 0,
      data: []
    });
  }

  const data = rowsToObjects(headers, rows).map((obj, index) => ({
    row_number: index + 2,
    ...obj,
    assigned_user_id: obj.assigned_user_id || obj.driver_id || "",
    assigned_user_name: obj.assigned_user_name || obj.driver_name || ""
  }));

  return jsonOutput({
    success: true,
    total: data.length,
    data: data
  });
}

function deleteBookingCancellationHistory(data) {
  const sheet = ensureCancellationHistorySheet();
  const { headers, rows } = readSheetTable(sheet);

  const searchId = String(data && (data.cancellation_id || data.booking_id || data.id) || "").trim();
  const rowNumber = Number(data && data.row_number);

  if (rowNumber && rowNumber >= 2 && rowNumber <= sheet.getLastRow()) {
    sheet.deleteRow(rowNumber);

    return jsonOutput({
      success: true,
      message: "ลบประวัติการยกเลิกสำเร็จ",
      deleted_id: String(rowNumber)
    });
  }

  if (!searchId) {
    return jsonOutput({
      success: false,
      message: "ไม่พบรายการประวัติการยกเลิกที่ต้องการลบ",
      debug: {
        searchId,
        rowNumber,
        headers
      }
    });
  }

  const matchColumns = ["cancellation_id", "booking_id", "id"]
    .map((columnName) => ({
      columnName,
      columnIndex: headers.indexOf(columnName),
    }))
    .filter((entry) => entry.columnIndex >= 0);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const matched = matchColumns.some((entry) => String(row[entry.columnIndex] || "").trim() === searchId);

    if (matched) {
      sheet.deleteRow(i + 2);

      return jsonOutput({
        success: true,
        message: "ลบประวัติการยกเลิกสำเร็จ",
        deleted_id: searchId
      });
    }
  }

  return jsonOutput({
    success: false,
    message: "ไม่พบรายการประวัติการยกเลิกที่ต้องการลบ",
    debug: {
      searchId,
      rowNumber,
      headers
    }
  });
}

// Attach this function' to a monthly time-driven trigger in Apps Script.
// It removes cancellation history rows older than one month while keeping the header row intact.
function clearBookingCancellationHistoryMonthly() {
  const sheet = ensureCancellationHistorySheet();
  const { headers, rows } = readSheetTable(sheet);

  const cancelledAtCol = headers.indexOf("cancelled_at");
  const updatedAtCol = headers.indexOf("updated_at");
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 1);

  let deletedCount = 0;

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const rawDate = cancelledAtCol !== -1 ? row[cancelledAtCol] : row[updatedAtCol];
    const rowDate = new Date(rawDate);

    if (!rawDate || Number.isNaN(rowDate.getTime())) {
      continue;
    }

    if (rowDate < cutoff) {
      sheet.deleteRow(i + 2);
      deletedCount += 1;
    }
  }

  return jsonOutput({
    success: true,
    message: "Cancellation history cleanup completed",
    deleted: deletedCount
  });
}

function sendBookingReminderNotifications1Hour(data) {
  const sheet = ensureBookingsSheet();
  const table = readSheetTable(sheet);
  const headers = table.headers;
  const bookings = rowsToObjects(headers, table.rows);
  const now = new Date();
  const actor = String(data && (data.created_by || data.updated_by || "SYSTEM") || "SYSTEM").trim() || "SYSTEM";
  const initialCreatedCount = getCreatedNotifications_().length;

  bookings.forEach((booking) => {
    const status = String(booking.status || "").trim().toUpperCase();
    if (status !== "APPROVED") return;

    const bookingId = String(booking.booking_id || "").trim();
    const destination = String(booking.destination || "").trim();
    const startDatetime = booking.start_datetime ? new Date(booking.start_datetime) : null;
    if (!bookingId || !destination || !startDatetime || Number.isNaN(startDatetime.getTime())) {
      return;
    }

    const diffMs = startDatetime.getTime() - now.getTime();
    if (diffMs <= 0 || diffMs > 60 * 60 * 1000) {
      return;
    }

    const message = `ปลายทาง: ${destination} | เวลาไป: ${formatThaiNotificationDateTime_(booking.start_datetime || "") || "-"}`;
    const payload = buildNotificationPayloadFromBooking_(booking, {
      reminder_key: `${bookingId}|BOOKING_REMINDER_1H`,
      status,
    });
    const requesterUserId = resolveRequesterNotificationUserId_(booking);
    const assignedUserId = String(booking.assigned_user_id || "").trim();

    if (requesterUserId) {
      appendNotificationRecord_({
        target_user_id: requesterUserId,
        target_role: "",
        category: "Booking",
        title: "อีก 1 ชั่วโมงจะถึงเวลาใช้งานรถ",
        message,
        type: "BOOKING_REMINDER_1H",
        booking_id: bookingId,
        url: "/booking",
        created_by: actor,
        payload_json: payload,
      });
    }

    if (assignedUserId) {
      appendNotificationRecord_({
        target_user_id: assignedUserId,
        target_role: "",
        category: "Booking",
        title: "อีก 1 ชั่วโมงจะถึงเวลาใช้งานรถ",
        message,
        type: "BOOKING_REMINDER_1H",
        booking_id: bookingId,
        url: "/driver-jobs",
        created_by: actor,
        payload_json: payload,
      });
    }
  });

  const createdCount = Math.max(0, getCreatedNotifications_().length - initialCreatedCount);

  return jsonOutput({
    success: true,
    message: "Booking reminder notification run completed",
    created_notifications: getCreatedNotifications_(),
    created_count: createdCount,
  });
}

function loginUser(data) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Users");

  const { headers, rows } = readSheetTable(sheet);

  if (rows.length === 0) {
    return jsonOutput({
      success: false,
      message: "Users not found"
    });
  }

  const emailCol = headers.indexOf("email");
  const passwordCol = headers.indexOf("password");
  const passwordHashCol = headers.indexOf("password_hash");
  const statusCol = headers.indexOf("status");
  const updatedAtCol = headers.indexOf("updated_at");
  const inputEmail = String(data && data.email || "").trim();
  const inputPassword = String(data && data.password || "").trim();
  let matchedUser = null;
  let matchedRowIndex = -1;
  let matchedUsingPlaintext = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const emailMatches = String(row[emailCol] || "").trim() === inputEmail;
    const active = String(row[statusCol] || "").trim().toUpperCase() === "ACTIVE";

    if (!emailMatches || !active) continue;

    const storedHash = passwordHashCol !== -1 ? row[passwordHashCol] : "";
    if (verifyPasswordHash_(inputPassword, storedHash)) {
      matchedUser = row.slice();
      matchedRowIndex = i;
      break;
    }

    const storedPassword = passwordCol !== -1 ? String(row[passwordCol] || "").trim() : "";
    if (storedPassword && storedPassword !== "HASHED" && storedPassword === inputPassword) {
      matchedUser = row.slice();
      matchedRowIndex = i;
      matchedUsingPlaintext = true;
      break;
    }
  }

  if (!matchedUser) {
    return jsonOutput({
      success: false,
      message: "Email หรือ Password ไม่ถูกต้อง"
    });
  }

  if (matchedUsingPlaintext && passwordCol !== -1 && passwordHashCol !== -1) {
    const migratedHash = hashPassword_(inputPassword);
    const rowNumber = matchedRowIndex + 2;

    sheet.getRange(rowNumber, passwordCol + 1).setValue("HASHED");
    sheet.getRange(rowNumber, passwordHashCol + 1).setValue(migratedHash);
    if (updatedAtCol !== -1) {
      sheet.getRange(rowNumber, updatedAtCol + 1).setValue(new Date());
    }
    invalidateSheetCache_(sheet);

    matchedUser[passwordCol] = "HASHED";
    matchedUser[passwordHashCol] = migratedHash;
    if (updatedAtCol !== -1) {
      matchedUser[updatedAtCol] = new Date();
    }
  }

  let obj = {};

  headers.forEach((header, index) => {
    obj[header] = matchedUser[index];
  });

  delete obj.password;
  delete obj.password_hash;
  delete obj.driver_id;
  delete obj.driver_name;

  return jsonOutput({
    success: true,
    message: "Login success",
    data: obj
  });
}
function isTimeOverlap(startA, endA, startB, endB) {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();

  return aStart < bEnd && bStart < aEnd;
}

function checkVehicleAvailability(data, table) {
  const bookingTable = table || readSheetTable("Bookings");
  const rows = bookingTable.rows;
  const columnMap = bookingTable.columnMap;

  const bookingIdCol = columnMap.booking_id;
  const vehicleIdCol = columnMap.vehicle_id;
  const startCol = columnMap.start_datetime;
  const endCol = columnMap.end_datetime;
  const statusCol = columnMap.status;
  const bookingNoCol = columnMap.booking_no;
  const relevantRows = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const status = String(row[statusCol] || "").trim().toUpperCase();
    const isSameVehicle = String(row[vehicleIdCol] || "").trim() === String(data.vehicle_id || "").trim();

    if (isSameVehicle && (status === "APPROVED" || status === "IN_USE")) {
      relevantRows.push(row);
    }
  }

  for (let i = 0; i < relevantRows.length; i++) {
    const row = relevantRows[i];
    const isSameBooking = String(row[bookingIdCol]) === String(data.booking_id);

    if (!isSameBooking) {
      const overlap = isTimeOverlap(
        data.start_datetime,
        data.end_datetime,
        row[startCol],
        row[endCol]
      );

      if (overlap) {
        return {
          available: false,
          conflict_booking_no: row[bookingNoCol],
          message: "รถคันนี้มีรายการจองช่วงเวลาเดียวกันแล้ว"
        };
      }
    }
  }

  return {
    available: true
  };
}

function ensureDriverUnavailableSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("DriverUnavailable");

  const headers = [
    "unavailable_id",
    "driver_user_id",
    "driver_name",
    "type",
    "reason",
    "start_datetime",
    "end_datetime",
    "status",
    "created_at",
    "created_by",
    "updated_at",
    "updated_by",
    "cancelled_at",
    "cancelled_by",
  ];

  if (!sheet) {
    sheet = ss.insertSheet("DriverUnavailable");
    appendSheetRow(sheet, headers);
    return sheet;
  }

  if (sheet.getLastRow() === 0) {
    appendSheetRow(sheet, headers);
  }

  return sheet;
}

function ensureDriverUnavailableLogsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("DriverUnavailableLogs");

  const headers = [
    "log_id",
    "unavailable_id",
    "driver_user_id",
    "driver_name",
    "action",
    "old_value",
    "new_value",
    "reason",
    "created_at",
    "created_by",
  ];

  if (!sheet) {
    sheet = ss.insertSheet("DriverUnavailableLogs");
    appendSheetRow(sheet, headers);
    return sheet;
  }

  if (sheet.getLastRow() === 0) {
    appendSheetRow(sheet, headers);
  }

  return sheet;
}

function normalizeDriverUnavailableStatus(status, endDatetime) {
  const normalized = String(status || "").trim().toUpperCase();

  if (normalized === "CANCELLED" || normalized === "EXPIRED") {
    return normalized;
  }

  if (normalized && normalized !== "ACTIVE") {
    return normalized;
  }

  const endTime = new Date(endDatetime).getTime();
  if (!Number.isNaN(endTime) && endTime < Date.now()) {
    return "EXPIRED";
  }

  return "ACTIVE";
}

function buildDriverUnavailableLogPayload_(data) {
  return {
    log_id: "DUL-" + Date.now(),
    unavailable_id: data.unavailable_id || "",
    driver_user_id: data.driver_user_id || "",
    driver_name: data.driver_name || "",
    action: data.action || "",
    old_value: typeof data.old_value === "string" ? data.old_value : JSON.stringify(data.old_value || {}),
    new_value: typeof data.new_value === "string" ? data.new_value : JSON.stringify(data.new_value || {}),
    reason: data.reason || "",
    created_at: new Date().toISOString(),
    created_by: data.created_by || "",
  };
}

function appendDriverUnavailableLog_(payload) {
  const sheet = ensureDriverUnavailableLogsSheet();
  const { headers } = readSheetTable(sheet);
  const row = headers.map((header) => payload[header] ?? "");
  appendSheetRow(sheet, row);
}

function getDriverUnavailableRowMap_(headers) {
  const map = {};
  headers.forEach((header, index) => {
    map[header] = index;
  });
  return map;
}

function findDriverUnavailableRowById(table, unavailableId) {
  const targetUnavailableId = String(unavailableId || "").trim();
  if (!targetUnavailableId) {
    return -1;
  }

  const rowMap = table.columnMap || getDriverUnavailableRowMap_(table.headers || []);
  const idCol = rowMap.unavailable_id;

  if (idCol === undefined) {
    return -1;
  }

  for (let i = 0; i < table.rows.length; i++) {
    const rowUnavailableId = String(table.rows[i][idCol] || "").trim();
    if (rowUnavailableId === targetUnavailableId) {
      return i + 2;
    }
  }

  return -1;
}

function getDriverUnavailableRows(table) {
  const now = Date.now();
  return rowsToObjects(table.headers, table.rows).map((row, index) => {
    const status = normalizeDriverUnavailableStatus(row.status, row.end_datetime);
    return {
      row_number: index + 2,
      ...row,
      status,
      is_active_now: status === "ACTIVE" && new Date(row.start_datetime).getTime() < now && new Date(row.end_datetime).getTime() > now,
    };
  });
}

function getDriverUnavailableBookingsConflict(driverUserId, startDatetime, endDatetime, unavailableIdToIgnore) {
  const bookingSheet = ensureBookingsSheet();
  const bookingTable = readSheetTable(bookingSheet);
  const bookings = rowsToObjects(bookingTable.headers, bookingTable.rows);
  const normalizedDriverUserId = String(driverUserId || "").trim();

  if (!normalizedDriverUserId || !startDatetime || !endDatetime) {
    return null;
  }

  for (let i = 0; i < bookings.length; i++) {
    const booking = bookings[i];
    const status = String(booking.status || "").trim().toUpperCase();
    if (status !== "APPROVED" && status !== "IN_USE") {
      continue;
    }

    const assignedUserId = String(booking.assigned_user_id || booking.driver_id || "").trim();
    const assignedUserName = String(booking.assigned_user_name || booking.driver_name || "").trim();
    const sameDriver =
      assignedUserId === normalizedDriverUserId ||
      (!assignedUserId && assignedUserName && assignedUserName === normalizedDriverUserId);

    if (!sameDriver) {
      continue;
    }

    if (
      booking.booking_id &&
      String(booking.booking_id).trim() === String(unavailableIdToIgnore || "").trim()
    ) {
      continue;
    }

    if (
      isTimeOverlap(startDatetime, endDatetime, booking.start_datetime, booking.end_datetime)
    ) {
      return booking;
    }
  }

  return null;
}

function getDriverUnavailableConflict(driverUserId, startDatetime, endDatetime, unavailableIdToIgnore) {
  const sheet = ensureDriverUnavailableSheet();
  const table = readSheetTable(sheet);
  const unavailableRows = getDriverUnavailableRows(table);
  const normalizedDriverUserId = String(driverUserId || "").trim();

  for (let i = 0; i < unavailableRows.length; i++) {
    const row = unavailableRows[i];
    const status = String(row.status || "").trim().toUpperCase();
    if (status !== "ACTIVE") {
      continue;
    }

    if (String(row.driver_user_id || "").trim() !== normalizedDriverUserId) {
      continue;
    }

    if (
      unavailableIdToIgnore &&
      String(row.unavailable_id || "").trim() === String(unavailableIdToIgnore).trim()
    ) {
      continue;
    }

    if (isTimeOverlap(startDatetime, endDatetime, row.start_datetime, row.end_datetime)) {
      return row;
    }
  }

  return null;
}

function hasDriverActiveAssignment(driverUserId, bookingIdToIgnore) {
  const sheet = ensureBookingsSheet();
  const table = readSheetTable(sheet);
  const bookings = rowsToObjects(table.headers, table.rows);
  const normalizedDriverUserId = String(driverUserId || "").trim();
  const ignoredBookingId = String(bookingIdToIgnore || "").trim();

  if (!normalizedDriverUserId) {
    return false;
  }

  for (let i = 0; i < bookings.length; i++) {
    const booking = bookings[i];
    const status = String(booking.status || "").trim().toUpperCase();
    if (status !== "APPROVED" && status !== "IN_USE") {
      continue;
    }

    if (
      ignoredBookingId &&
      String(booking.booking_id || "").trim() === ignoredBookingId
    ) {
      continue;
    }

    const assignedUserId = String(booking.assigned_user_id || booking.driver_id || "").trim();
    if (assignedUserId === normalizedDriverUserId) {
      return true;
    }
  }

  return false;
}

function getDriverUnavailableResponse_(conflict) {
  if (!conflict) {
    return {
      available: true,
      reason: "",
      unavailable: null,
    };
  }

  const typeLabel = conflict.type || "ไม่รับงาน";
  return {
    available: false,
    reason: `${typeLabel}${conflict.reason ? `: ${conflict.reason}` : ""}`,
    unavailable: conflict,
  };
}

function getDriverUnavailable() {
  const sheet = ensureDriverUnavailableSheet();
  const table = readSheetTable(sheet);

  if (table.rows.length === 0) {
    return jsonOutput({
      success: true,
      total: 0,
      data: [],
    });
  }

  const data = getDriverUnavailableRows(table);

  return jsonOutput({
    success: true,
    total: data.length,
    data: data,
  });
}

function getDriverUnavailableLogs() {
  const sheet = ensureDriverUnavailableLogsSheet();
  const { headers, rows } = readSheetTable(sheet);

  if (rows.length === 0) {
    return jsonOutput({
      success: true,
      total: 0,
      data: [],
    });
  }

  const data = rowsToObjects(headers, rows);

  return jsonOutput({
    success: true,
    total: data.length,
    data,
  });
}

function getThaiHolidays() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ThaiHolidays");

  if (!sheet) {
    return [];
  }

  const { headers, rows } = readSheetTable(sheet);

  if (rows.length === 0) {
    return [];
  }

  const data = rowsToObjects(headers, rows)
    .map((row) => {
      const status = String(row.status || "").trim().toUpperCase();
      if (status === "INACTIVE") {
        return null;
      }

      const dateValue = row.date instanceof Date
        ? Utilities.formatDate(row.date, "Asia/Bangkok", "yyyy-MM-dd")
        : String(row.date || "").trim().slice(0, 10);

      if (!dateValue) {
        return null;
      }

      return {
        holiday_id: row.holiday_id || "",
        date: dateValue,
        name_th: row.name_th || "",
        name_en: row.name_en || "",
        type_th: row.type_th || "",
        type_en: row.type_en || "",
        color: row.color || "",
        is_special: row.is_special || "",
        source: row.source || "",
        description: row.description || "",
        status: row.status || "",
      };
    })
    .filter(Boolean);

  return data;
}

function createDriverUnavailable(data) {
  const sheet = ensureDriverUnavailableSheet();
  const table = readSheetTable(sheet);
  const headers = table.headers;
  const columnMap = table.columnMap;
  const now = new Date();

  const driverUserId = String(data.driver_user_id || "").trim();
  const driverName = String(data.driver_name || "").trim();
  const type = String(data.type || "").trim();
  const reason = String(data.reason || "").trim();
  const startDatetime = String(data.start_datetime || "").trim();
  const endDatetime = String(data.end_datetime || "").trim();
  const createdBy = String(data.created_by || "").trim();

  if (!driverUserId || !driverName || !type || !startDatetime || !endDatetime) {
    return jsonOutput({
      success: false,
      message: "กรุณากรอกข้อมูลให้ครบ",
    });
  }

  if (new Date(endDatetime).getTime() <= new Date(startDatetime).getTime()) {
    return jsonOutput({
      success: false,
      message: "วันเวลาสิ้นสุดต้องมากกว่าวันเวลาเริ่ม",
    });
  }

  const bookingConflict = getDriverUnavailableBookingsConflict(driverUserId, startDatetime, endDatetime, "");
  if (bookingConflict) {
    return jsonOutput({
      success: false,
      message: "มีงานที่ได้รับมอบหมายทับช่วงเวลานี้",
    });
  }

  const unavailableId = "DU-" + now.getTime();
  const row = Array(headers.length).fill("");

  row[columnMap.unavailable_id] = unavailableId;
  row[columnMap.driver_user_id] = driverUserId;
  row[columnMap.driver_name] = driverName;
  row[columnMap.type] = type;
  row[columnMap.reason] = reason;
  row[columnMap.start_datetime] = startDatetime;
  row[columnMap.end_datetime] = endDatetime;
  row[columnMap.status] = "ACTIVE";
  row[columnMap.created_at] = now.toISOString();
  row[columnMap.created_by] = createdBy;
  row[columnMap.updated_at] = now.toISOString();
  row[columnMap.updated_by] = createdBy;
  row[columnMap.cancelled_at] = "";
  row[columnMap.cancelled_by] = "";

  appendSheetRow(sheet, row);

  appendDriverUnavailableLog_(
    buildDriverUnavailableLogPayload_({
      unavailable_id: unavailableId,
      driver_user_id: driverUserId,
      driver_name: driverName,
      action: "CREATED",
      old_value: "",
      new_value: {
        unavailable_id: unavailableId,
        driver_user_id: driverUserId,
        driver_name: driverName,
        type,
        reason,
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        status: "ACTIVE",
      },
      reason,
      created_by: createdBy,
    })
  );

  try {
    createRoleNotifications_(["STAFF"], {
      category: "Driver",
      title: "คนขับแจ้งวันไม่ปฏิบัติงาน",
      message: buildDriverUnavailableNotificationMessage_({
        driver_name: driverName,
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        type,
      }, false),
      type: "DRIVER_UNAVAILABLE_CREATED",
      booking_id: unavailableId,
      url: "/driver-unavailable",
      created_by: createdBy,
      payload_json: {
        unavailable_id: unavailableId,
        driver_user_id: driverUserId,
        driver_name: driverName,
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        type,
        reason,
        status: "ACTIVE",
      },
    });
  } catch (notificationErr) {
    console.warn("createDriverUnavailable notification failed", notificationErr);
  }

  return jsonOutput({
    success: true,
    message: "Create driver unavailable success",
    data: {
      unavailable_id: unavailableId,
      driver_user_id: driverUserId,
      driver_name: driverName,
      type,
      reason,
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      status: "ACTIVE",
      created_at: now.toISOString(),
      created_by: createdBy,
      updated_at: now.toISOString(),
      updated_by: createdBy,
      cancelled_at: "",
      cancelled_by: "",
    },
    created_notifications: getCreatedNotifications_(),
  });
}

function updateDriverUnavailable(data) {
  const sheet = ensureDriverUnavailableSheet();
  const table = readSheetTable(sheet);
  const headers = table.headers;
  const columnMap = table.columnMap;
  const rowNumber = findDriverUnavailableRowById(table, data.unavailable_id);

  if (rowNumber <= 1) {
    return jsonOutput({
      success: false,
      message: "Driver unavailable not found",
    });
  }

  const rowIndex = rowNumber - 2;
  const currentRow = table.rows[rowIndex].slice();
  const oldValue = rowsToObjects(headers, [table.rows[rowIndex]])[0] || {};
  const nextDriverUserId = String(data.driver_user_id || oldValue.driver_user_id || "").trim();
  const nextDriverName = String(data.driver_name || oldValue.driver_name || "").trim();
  const nextType = String(data.type || oldValue.type || "").trim();
  const nextReason = String(data.reason || oldValue.reason || "").trim();
  const nextStartDatetime = String(data.start_datetime || oldValue.start_datetime || "").trim();
  const nextEndDatetime = String(data.end_datetime || oldValue.end_datetime || "").trim();
  const updatedBy = String(data.updated_by || data.created_by || oldValue.updated_by || "").trim();
  const nextStatus = normalizeDriverUnavailableStatus(oldValue.status || "ACTIVE", nextEndDatetime);

  if (!nextDriverUserId || !nextDriverName || !nextType || !nextStartDatetime || !nextEndDatetime) {
    return jsonOutput({
      success: false,
      message: "กรุณากรอกข้อมูลให้ครบ",
    });
  }

  if (new Date(nextEndDatetime).getTime() <= new Date(nextStartDatetime).getTime()) {
    return jsonOutput({
      success: false,
      message: "วันเวลาสิ้นสุดต้องมากกว่าวันเวลาเริ่ม",
    });
  }

  const bookingConflict = getDriverUnavailableBookingsConflict(
    nextDriverUserId,
    nextStartDatetime,
    nextEndDatetime,
    data.unavailable_id
  );
  if (bookingConflict) {
    return jsonOutput({
      success: false,
      message: "มีงานที่ได้รับมอบหมายทับช่วงเวลานี้",
    });
  }

  currentRow[columnMap.driver_user_id] = nextDriverUserId;
  currentRow[columnMap.driver_name] = nextDriverName;
  currentRow[columnMap.type] = nextType;
  currentRow[columnMap.reason] = nextReason;
  currentRow[columnMap.start_datetime] = nextStartDatetime;
  currentRow[columnMap.end_datetime] = nextEndDatetime;
  currentRow[columnMap.status] = nextStatus;
  currentRow[columnMap.updated_at] = new Date().toISOString();
  currentRow[columnMap.updated_by] = updatedBy;

  setRowValues(sheet, rowNumber, currentRow);

  const newValue = rowsToObjects(headers, [currentRow])[0] || {};
  appendDriverUnavailableLog_(
    buildDriverUnavailableLogPayload_({
      unavailable_id: data.unavailable_id,
      driver_user_id: nextDriverUserId,
      driver_name: nextDriverName,
      action: "UPDATED",
      old_value: oldValue,
      new_value: newValue,
      reason: nextReason,
      created_by: updatedBy,
    })
  );

  try {
    createRoleNotifications_(["STAFF"], {
      category: "Driver",
      title: "คนขับแก้ไขวันไม่ปฏิบัติงาน",
      message: buildDriverUnavailableNotificationMessage_({
        driver_name: nextDriverName,
        start_datetime: nextStartDatetime,
        end_datetime: nextEndDatetime,
        type: nextType,
      }, false),
      type: "DRIVER_UNAVAILABLE_UPDATED",
      booking_id: data.unavailable_id,
      url: "/driver-unavailable",
      created_by: updatedBy,
      payload_json: {
        unavailable_id: data.unavailable_id,
        driver_user_id: nextDriverUserId,
        driver_name: nextDriverName,
        start_datetime: nextStartDatetime,
        end_datetime: nextEndDatetime,
        type: nextType,
        reason: nextReason,
        status: nextStatus,
      },
    });
  } catch (notificationErr) {
    console.warn("updateDriverUnavailable notification failed", notificationErr);
  }

  return jsonOutput({
    success: true,
    message: "Update driver unavailable success",
    data: newValue,
    created_notifications: getCreatedNotifications_(),
  });
}

function cancelDriverUnavailable(data) {
  const sheet = ensureDriverUnavailableSheet();
  const table = readSheetTable(sheet);
  const headers = table.headers;
  const columnMap = table.columnMap;
  const rowNumber = findDriverUnavailableRowById(table, data.unavailable_id);

  if (rowNumber <= 1) {
    return jsonOutput({
      success: false,
      message: "Driver unavailable not found",
    });
  }

  const rowIndex = rowNumber - 2;
  const currentRow = table.rows[rowIndex].slice();
  const oldValue = rowsToObjects(headers, [table.rows[rowIndex]])[0] || {};
  const cancelledBy = String(data.cancelled_by || data.updated_by || data.created_by || "").trim();
  const now = new Date().toISOString();

  currentRow[columnMap.status] = "CANCELLED";
  currentRow[columnMap.cancelled_at] = now;
  currentRow[columnMap.cancelled_by] = cancelledBy;
  currentRow[columnMap.updated_at] = now;
  currentRow[columnMap.updated_by] = cancelledBy;

  setRowValues(sheet, rowNumber, currentRow);

  const newValue = rowsToObjects(headers, [currentRow])[0] || {};
  appendDriverUnavailableLog_(
    buildDriverUnavailableLogPayload_({
      unavailable_id: data.unavailable_id,
      driver_user_id: oldValue.driver_user_id || "",
      driver_name: oldValue.driver_name || "",
      action: "CANCELLED",
      old_value: oldValue,
      new_value: newValue,
      reason: oldValue.reason || "",
      created_by: cancelledBy,
    })
  );

  try {
    createRoleNotifications_(["STAFF"], {
      category: "Driver",
      title: "คนขับยกเลิกวันไม่ปฏิบัติงาน",
      message: buildDriverUnavailableNotificationMessage_({
        driver_name: oldValue.driver_name || "",
        start_datetime: oldValue.start_datetime || "",
        end_datetime: oldValue.end_datetime || "",
        type: oldValue.type || "",
      }, false),
      type: "DRIVER_UNAVAILABLE_CANCELLED",
      booking_id: data.unavailable_id,
      url: "/driver-unavailable",
      created_by: cancelledBy,
      payload_json: {
        unavailable_id: data.unavailable_id,
        driver_user_id: oldValue.driver_user_id || "",
        driver_name: oldValue.driver_name || "",
        start_datetime: oldValue.start_datetime || "",
        end_datetime: oldValue.end_datetime || "",
        type: oldValue.type || "",
        reason: oldValue.reason || "",
        status: "CANCELLED",
      },
    });
  } catch (notificationErr) {
    console.warn("cancelDriverUnavailable notification failed", notificationErr);
  }

  return jsonOutput({
    success: true,
    message: "Cancel driver unavailable success",
    data: newValue,
    created_notifications: getCreatedNotifications_(),
  });
}

function checkDriverUnavailable(data) {
  const driverUserId = String(data && (data.driver_user_id || data.assigned_user_id || "")).trim();
  const startDatetime = String(data && data.start_datetime || "").trim();
  const endDatetime = String(data && data.end_datetime || "").trim();

  if (!driverUserId || !startDatetime || !endDatetime) {
    return jsonOutput({
      success: true,
      data: {
        available: true,
        reason: "",
        unavailable: null,
      },
    });
  }

  const conflict = getDriverUnavailableConflict(driverUserId, startDatetime, endDatetime, data.unavailable_id || "");

  return jsonOutput({
    success: true,
    data: getDriverUnavailableResponse_(conflict),
  });
}

function ensureDriverQueueSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("DriverQueue");

  const headers = [
    "queue_id",
    "driver_user_id",
    "driver_name",
    "queue_order",
    "status",
    "last_assigned_at",
    "last_booking_id",
    "note",
    "updated_at",
    "updated_by",
  ];

  if (!sheet) {
    sheet = ss.insertSheet("DriverQueue");
    appendSheetRow(sheet, headers);
    return sheet;
  }

  if (sheet.getLastRow() === 0) {
    appendSheetRow(sheet, headers);
  }

  return sheet;
}

function ensureDriverQueueStateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("DriverQueueState");

  const headers = ["state_key", "state_value", "updated_at", "updated_by"];

  if (!sheet) {
    sheet = ss.insertSheet("DriverQueueState");
    appendSheetRow(sheet, headers);
  }

  if (sheet.getLastRow() === 0) {
    appendSheetRow(sheet, headers);
  }

  const table = readSheetTable(sheet);
  const keyCol = table.columnMap.state_key;
  const valueCol = table.columnMap.state_value;
  const updatedAtCol = table.columnMap.updated_at;
  const updatedByCol = table.columnMap.updated_by;

  let found = false;
  for (let i = 0; i < table.rows.length; i++) {
    if (String(table.rows[i][keyCol] || "").trim() === "last_assigned_queue_order") {
      found = true;
      break;
    }
  }

  if (!found) {
    const row = Array(table.headers.length).fill("");
    row[keyCol] = "last_assigned_queue_order";
    row[valueCol] = "0";
    row[updatedAtCol] = new Date().toISOString();
    row[updatedByCol] = "system";
    appendSheetRow(sheet, row);
  }

  return sheet;
}

function ensureDriverQueueLogsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("DriverQueueLogs");

  const headers = [
    "log_id",
    "booking_id",
    "booking_no",
    "recommended_driver_user_id",
    "recommended_driver_name",
    "assigned_driver_user_id",
    "assigned_driver_name",
    "assign_mode",
    "reason",
    "queue_before",
    "queue_after",
    "created_at",
    "created_by",
  ];

  if (!sheet) {
    sheet = ss.insertSheet("DriverQueueLogs");
    appendSheetRow(sheet, headers);
    return sheet;
  }

  if (sheet.getLastRow() === 0) {
    appendSheetRow(sheet, headers);
  }

  return sheet;
}

function normalizeQueueStatus_(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "ACTIVE") return "ACTIVE";
  if (normalized === "INACTIVE") return "INACTIVE";
  return "ACTIVE";
}

function getDriverQueueUserStatusLookup_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  if (!sheet) {
    return {
      byId: new Map(),
      byName: new Map(),
    };
  }

  const { headers, rows } = readSheetTable(sheet);
  const userIdCol = headers.indexOf("user_id");
  const nameCol = headers.indexOf("name");
  const roleCol = headers.indexOf("role");
  const statusCol = headers.indexOf("status");

  const byId = new Map();
  const byName = new Map();

  rows.forEach((row) => {
    const userId = String(userIdCol !== -1 ? row[userIdCol] : "").trim();
    const name = String(nameCol !== -1 ? row[nameCol] : "").trim();
    const role = String(roleCol !== -1 ? row[roleCol] : "").trim().toUpperCase();
    const status = String(statusCol !== -1 ? row[statusCol] : "").trim().toUpperCase();
    const payload = {
      user_id: userId,
      name,
      role,
      status,
    };

    if (userId) {
      byId.set(userId, payload);
    }
    if (name) {
      byName.set(name.toLowerCase(), payload);
    }
  });

  return { byId, byName };
}

function getActiveDriverLookup_() {
  const userLookup = getDriverQueueUserStatusLookup_();
  const byId = new Map();
  const byName = new Map();

  userLookup.byId.forEach((user) => {
    if (String(user.role || "").trim().toUpperCase() !== "DRIVER") return;
    if (String(user.status || "").trim().toUpperCase() !== "ACTIVE") return;

    const userId = String(user.user_id || "").trim();
    const name = String(user.name || "").trim();

    if (userId) {
      byId.set(userId, user);
    }
    if (name) {
      byName.set(name.toLowerCase(), user);
    }
  });

  return { byId, byName };
}

function resolveActiveDriverName_(activeDriverLookup, driverUserId, fallbackName) {
  const normalizedDriverUserId = String(driverUserId || "").trim();
  const activeDriver = normalizedDriverUserId ? activeDriverLookup.byId.get(normalizedDriverUserId) || null : null;
  return activeDriver ? String(activeDriver.name || "").trim() || String(fallbackName || "").trim() : String(fallbackName || "").trim();
}

function getDriverQueueStateValue_() {
  const sheet = ensureDriverQueueStateSheet();
  const table = readSheetTable(sheet);
  const keyCol = table.columnMap.state_key;
  const valueCol = table.columnMap.state_value;
  const updatedAtCol = table.columnMap.updated_at;
  const updatedByCol = table.columnMap.updated_by;

  for (let i = 0; i < table.rows.length; i++) {
    if (String(table.rows[i][keyCol] || "").trim() === "last_assigned_queue_order") {
      return {
        row_number: i + 2,
        state_key: "last_assigned_queue_order",
        state_value: String(table.rows[i][valueCol] || "0").trim() || "0",
        updated_at: table.rows[i][updatedAtCol] || "",
        updated_by: table.rows[i][updatedByCol] || "",
      };
    }
  }

  return {
    row_number: -1,
    state_key: "last_assigned_queue_order",
    state_value: "0",
    updated_at: "",
    updated_by: "",
  };
}

function setDriverQueueStateValue_(value, updatedBy) {
  const sheet = ensureDriverQueueStateSheet();
  const table = readSheetTable(sheet);
  const keyCol = table.columnMap.state_key;
  const valueCol = table.columnMap.state_value;
  const updatedAtCol = table.columnMap.updated_at;
  const updatedByCol = table.columnMap.updated_by;
  const now = new Date().toISOString();

  for (let i = 0; i < table.rows.length; i++) {
    if (String(table.rows[i][keyCol] || "").trim() === "last_assigned_queue_order") {
      const row = table.rows[i].slice();
      row[valueCol] = String(value);
      row[updatedAtCol] = now;
      row[updatedByCol] = updatedBy || "";
      setRowValues(sheet, i + 2, row);
      return {
        state_key: "last_assigned_queue_order",
        state_value: String(value),
        updated_at: now,
        updated_by: updatedBy || "",
      };
    }
  }

  const row = Array(table.headers.length).fill("");
  row[keyCol] = "last_assigned_queue_order";
  row[valueCol] = String(value);
  row[updatedAtCol] = now;
  row[updatedByCol] = updatedBy || "";
  appendSheetRow(sheet, row);
  return {
    state_key: "last_assigned_queue_order",
    state_value: String(value),
    updated_at: now,
    updated_by: updatedBy || "",
  };
}

// LEGACY QUEUE HELPERS (deprecated)
// Shadowed by later queue engine generations below. Kept for backward compatibility review only.
function buildDriverQueueRows_() {
  const queueSheet = ensureDriverQueueSheet();
  const table = readSheetTable(queueSheet);
  const userLookup = getDriverQueueUserStatusLookup_();

  return rowsToObjects(table.headers, table.rows)
    .map((row, index) => {
      const userStatus = userLookup.byId.get(String(row.driver_user_id || "").trim()) ||
        userLookup.byName.get(String(row.driver_name || "").trim().toLowerCase()) ||
        null;
      const queueOrder = Number(row.queue_order || 0) || 0;
      const status = normalizeQueueStatus_(row.status);
      return {
        row_number: index + 2,
        ...row,
        queue_order: queueOrder,
        status,
        driver_status: userStatus ? userStatus.status : "",
        driver_user_status: userStatus ? userStatus.status : "",
        driver_active: !userStatus || userStatus.status === "ACTIVE",
      };
    })
    .sort((a, b) => {
      const orderDiff = Number(a.queue_order || 0) - Number(b.queue_order || 0);
      if (orderDiff !== 0) return orderDiff;
      return String(a.driver_name || "").localeCompare(String(b.driver_name || ""), "th");
    });
}

function getDriverQueueAvailableRows_(startDatetime, endDatetime) {
  const queueRows = buildDriverQueueRows_();
  const skipped = [];
  const available = [];

  queueRows.forEach((row) => {
    if (row.status !== "ACTIVE") {
      skipped.push({
        driver_user_id: row.driver_user_id || "",
        driver_name: row.driver_name || "",
        reason: "คิวไม่ ACTIVE",
      });
      return;
    }

    if (row.driver_status !== "ACTIVE") {
      skipped.push({
        driver_user_id: row.driver_user_id || "",
        driver_name: row.driver_name || "",
        reason: "ผู้ใช้งานไม่ ACTIVE",
      });
      return;
    }

    const bookingConflict = getDriverUnavailableBookingsConflict(
      row.driver_user_id,
      startDatetime,
      endDatetime,
      ""
    );
    if (bookingConflict) {
      skipped.push({
        driver_user_id: row.driver_user_id || "",
        driver_name: row.driver_name || "",
        reason: "มีงานทับช่วงเวลานี้",
      });
      return;
    }

    const unavailableConflict = getDriverUnavailableConflict(
      row.driver_user_id,
      startDatetime,
      endDatetime,
      ""
    );
    if (unavailableConflict) {
      skipped.push({
        driver_user_id: row.driver_user_id || "",
        driver_name: row.driver_name || "",
        reason: "มีช่วงวันไม่รับงานทับ",
      });
      return;
    }

    available.push(row);
  });

  return {
    available,
    skipped,
  };
}

function getDriverQueue() {
  const rows = buildDriverQueueRows_();
  const state = getDriverQueueStateValue_();

  return jsonOutput({
    success: true,
    total: rows.length,
    data: rows,
    state,
  });
}

function getDriverQueueState() {
  const state = getDriverQueueStateValue_();
  return jsonOutput({
    success: true,
    data: state,
  });
}

function resetDriverQueueState(data) {
  const updatedBy = String(data && (data.updated_by || data.created_by || data.reset_by || "")).trim();
  const state = setDriverQueueStateValue_(String(data && data.last_assigned_queue_order !== undefined ? data.last_assigned_queue_order : 0), updatedBy);

  return jsonOutput({
    success: true,
    message: "Reset driver queue state success",
    data: state,
  });
}

function getDriverQueueLogs() {
  const sheet = ensureDriverQueueLogsSheet();
  const { headers, rows } = readSheetTable(sheet);

  if (rows.length === 0) {
    return jsonOutput({
      success: true,
      total: 0,
      data: [],
    });
  }

  const data = rows.map((row, index) => {
    const mappedRow = rowsToObjects(headers, [row])[0] || {};

    return {
      ...mappedRow,
      row_number: index + 2,
    };
  });

  return jsonOutput({
    success: true,
    total: rows.length,
    data,
  });
}

function deleteDriverQueueLog(data) {
  const sheet = ensureDriverQueueLogsSheet();
  const payload = data || {};
  const normalized = payload && payload.data ? payload.data : payload;
  Logger.log("RAW PAYLOAD = " + JSON.stringify(payload));
  Logger.log("NORMALIZED DATA = " + JSON.stringify(normalized));
  Logger.log("SHEET NAME = " + sheet.getName());

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    throw new Error("ไม่พบรายการที่ต้องการลบ");
  }

  const headers = values[0].map((h) => String(h || "").trim());
  Logger.log(JSON.stringify(headers));

  const logIdIndex = headers.indexOf("log_id");
  if (logIdIndex < 0) {
    throw new Error("ไม่พบคอลัมน์ log_id");
  }

  const targetId = String(
    normalized.log_id ||
    normalized.id ||
    normalized.queue_log_id ||
    ""
  ).trim();
  Logger.log("TARGET ID = " + targetId);

  for (let i = 1; i < values.length; i++) {
    const currentId = String(values[i][logIdIndex] || "").trim();
    Logger.log(
      "COMPARE => current=" +
      currentId +
      " target=" +
      targetId
    );

    if (currentId === targetId) {
      Logger.log("MATCH FOUND ROW = " + (i + 1));
      sheet.deleteRow(i + 1);

      return jsonOutput({
        success: true,
        message: "ลบประวัติคิวคนขับสำเร็จ",
      });
    }
  }

  throw new Error(`ไม่พบรายการที่ต้องการลบ (${targetId})`);
}

function getNextQueueOrderFromState_(queueRows, lastAssignedQueueOrder) {
  const sorted = [...queueRows].sort((a, b) => {
    const orderDiff = Number(a.queue_order || 0) - Number(b.queue_order || 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a.driver_name || "").localeCompare(String(b.driver_name || ""), "th");
  });

  if (sorted.length === 0) {
    return [];
  }

  const pointer = Number(lastAssignedQueueOrder || 0) || 0;
  let startIndex = sorted.findIndex((row) => Number(row.queue_order || 0) > pointer);
  if (startIndex === -1) startIndex = 0;

  return [...sorted.slice(startIndex), ...sorted.slice(0, startIndex)];
}

function recommendDriverForBooking(data) {
  const startDatetime = String(data && data.start_datetime || "").trim();
  const endDatetime = String(data && data.end_datetime || "").trim();
  const bookingId = String(data && data.booking_id || "").trim();

  if (!startDatetime || !endDatetime) {
    return jsonOutput({
      success: false,
      message: "วันเวลาไม่ถูกต้อง",
      data: { skipped: [] },
    });
  }

  if (new Date(endDatetime).getTime() <= new Date(startDatetime).getTime()) {
    return jsonOutput({
      success: false,
      message: "วันเวลาสิ้นสุดต้องมากกว่าวันเวลาเริ่ม",
      data: { skipped: [] },
    });
  }

  const queueRows = buildDriverQueueRows_().filter((row) => row.status === "ACTIVE");
  const state = getDriverQueueStateValue_();
  const orderedRows = getNextQueueOrderFromState_(queueRows, state.state_value);
  const skipped = [];

  if (orderedRows.length === 0) {
    return jsonOutput({
      success: false,
      message: "ไม่พบคนขับที่พร้อมรับงานในช่วงเวลานี้",
      data: { skipped: [] },
    });
  }

  for (let i = 0; i < orderedRows.length; i++) {
    const row = orderedRows[i];
    if (row.driver_status !== "ACTIVE") {
      skipped.push({
        driver_user_id: row.driver_user_id || "",
        driver_name: row.driver_name || "",
        reason: "ผู้ใช้งานไม่ ACTIVE",
      });
      continue;
    }

    const bookingConflict = getDriverUnavailableBookingsConflict(row.driver_user_id, startDatetime, endDatetime, bookingId);
    if (bookingConflict) {
      skipped.push({
        driver_user_id: row.driver_user_id || "",
        driver_name: row.driver_name || "",
        reason: "มีงานทับช่วงเวลานี้",
      });
      continue;
    }

    const unavailableConflict = getDriverUnavailableConflict(row.driver_user_id, startDatetime, endDatetime, "");
    if (unavailableConflict) {
      skipped.push({
        driver_user_id: row.driver_user_id || "",
        driver_name: row.driver_name || "",
        reason: "มีช่วงวันไม่รับงานทับ",
      });
      continue;
    }

    return jsonOutput({
      success: true,
      data: {
        recommended_driver_user_id: row.driver_user_id || "",
        recommended_driver_name: row.driver_name || "",
        queue_order: row.queue_order || 0,
        reason: "คิวถัดไป / พร้อมรับงาน",
        skipped,
      },
    });
  }

  return jsonOutput({
    success: false,
    message: "ไม่พบคนขับที่พร้อมรับงานในช่วงเวลานี้",
    data: { skipped },
  });
}

function findDriverQueueRowByUserId_(table, driverUserId) {
  const normalized = String(driverUserId || "").trim();
  if (!normalized) return -1;
  const driverUserIdCol = table.columnMap.driver_user_id;
  if (driverUserIdCol === undefined) return -1;

  for (let i = 0; i < table.rows.length; i++) {
    if (String(table.rows[i][driverUserIdCol] || "").trim() === normalized) {
      return i + 2;
    }
  }

  return -1;
}

function findDriverQueueRowByQueueId_(table, queueId) {
  const normalized = String(queueId || "").trim();
  if (!normalized) return -1;
  const queueIdCol = table.columnMap.queue_id;
  if (queueIdCol === undefined) return -1;

  for (let i = 0; i < table.rows.length; i++) {
    if (String(table.rows[i][queueIdCol] || "").trim() === normalized) {
      return i + 2;
    }
  }

  return -1;
}

function updateDriverQueue(data) {
  const sheet = ensureDriverQueueSheet();
  const table = readSheetTable(sheet);
  const headers = table.headers;
  const columnMap = table.columnMap;
  const updatedBy = String(data && (data.updated_by || data.created_by || data.updatedBy || "")).trim();

  const targetRowNumber = findDriverQueueRowByQueueId_(table, data.queue_id) > 1
    ? findDriverQueueRowByQueueId_(table, data.queue_id)
    : findDriverQueueRowByUserId_(table, data.driver_user_id);

  if (targetRowNumber <= 1) {
    return jsonOutput({
      success: false,
      message: "Driver queue not found",
    });
  }

  const currentRow = table.rows[targetRowNumber - 2].slice();
  const moveDirection = String(data.move_direction || data.direction || "").trim().toUpperCase();

  if (moveDirection === "UP" || moveDirection === "DOWN") {
    const activeRows = buildDriverQueueRows_().filter((row) => normalizeQueueStatus_(row.status) === "ACTIVE");
    const currentIndex = activeRows.findIndex((row) => row.row_number === targetRowNumber);
    if (currentIndex === -1) {
      return jsonOutput({
        success: false,
        message: "Driver queue not found",
      });
    }

    const swapIndex = moveDirection === "UP" ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= activeRows.length) {
      return jsonOutput({
        success: false,
        message: "Move not allowed",
      });
    }

    const otherRow = activeRows[swapIndex];
    const currentQueueOrder = currentRow[columnMap.queue_order];
    const otherTableRow = table.rows[otherRow.row_number - 2].slice();

    currentRow[columnMap.queue_order] = otherRow.queue_order;
    currentRow[columnMap.updated_at] = new Date().toISOString();
    currentRow[columnMap.updated_by] = updatedBy;

    otherTableRow[columnMap.queue_order] = currentQueueOrder;
    otherTableRow[columnMap.updated_at] = new Date().toISOString();
    otherTableRow[columnMap.updated_by] = updatedBy;

    setRowValues(sheet, targetRowNumber, currentRow);
    setRowValues(sheet, otherRow.row_number, otherTableRow);

    return jsonOutput({
      success: true,
      message: "Update driver queue success",
      data: rowsToObjects(headers, [currentRow])[0] || {},
    });
  }

  if (data.queue_order !== undefined) {
    currentRow[columnMap.queue_order] = Number(data.queue_order) || 0;
  }
  if (data.status !== undefined) {
    currentRow[columnMap.status] = normalizeQueueStatus_(data.status);
  }
  if (data.note !== undefined) {
    currentRow[columnMap.note] = String(data.note || "");
  }

  currentRow[columnMap.updated_at] = new Date().toISOString();
  currentRow[columnMap.updated_by] = updatedBy;
  setRowValues(sheet, targetRowNumber, currentRow);

  return jsonOutput({
    success: true,
    message: "Update driver queue success",
    data: rowsToObjects(headers, [currentRow])[0] || {},
  });
}

function confirmDriverQueueAssignment(data) {
  const bookingId = String(data && data.booking_id || "").trim();
  const bookingNo = String(data && data.booking_no || "").trim();
  const recommendedDriverUserId = String(data && data.recommended_driver_user_id || "").trim();
  const recommendedDriverName = String(data && data.recommended_driver_name || "").trim();
  const assignedDriverUserId = String(data && data.assigned_driver_user_id || "").trim();
  const assignedDriverName = String(data && data.assigned_driver_name || "").trim();
  const assignMode = String(data && data.assign_mode || "").trim().toUpperCase() || "AUTO_RECOMMENDED";
  const reason = String(data && data.reason || "").trim();
  const actor = String(
    data && (data.assigned_by_name || data.created_by || data.updated_by || data.staff_name) || ""
  ).trim();

  if (!bookingId || !assignedDriverUserId || !assignedDriverName) {
    return jsonOutput({
      success: false,
      message: "booking_id and assigned driver are required",
    });
  }

  const queueTable = readSheetTable(ensureDriverQueueSheet());
  const queueRowNumber = findDriverQueueRowByUserId_(queueTable, assignedDriverUserId);
  const stateBefore = getDriverQueueStateValue_();
  const queueBefore = String(stateBefore.state_value || "0").trim() || "0";
  let queueAfter = queueBefore;

  if (queueRowNumber > 1) {
    const row = queueTable.rows[queueRowNumber - 2].slice();
    const queueOrder = Number(row[queueTable.columnMap.queue_order] || 0) || 0;
    const now = new Date().toISOString();
    row[queueTable.columnMap.last_assigned_at] = now;
    row[queueTable.columnMap.last_booking_id] = bookingId;
    row[queueTable.columnMap.updated_at] = now;
    row[queueTable.columnMap.updated_by] = actor;
    setRowValues(ensureDriverQueueSheet(), queueRowNumber, row);
    queueAfter = String(queueOrder);
    setDriverQueueStateValue_(queueOrder, actor);
  }

  const logSheet = ensureDriverQueueLogsSheet();
  const logHeaders = readSheetTable(logSheet).headers;
  const logRow = Array(logHeaders.length).fill("");
  const now = new Date().toISOString();

  logRow[logHeaders.indexOf("log_id")] = "DQL-" + Date.now();
  logRow[logHeaders.indexOf("booking_id")] = bookingId;
  logRow[logHeaders.indexOf("booking_no")] = bookingNo;
  logRow[logHeaders.indexOf("recommended_driver_user_id")] = recommendedDriverUserId;
  logRow[logHeaders.indexOf("recommended_driver_name")] = recommendedDriverName;
  logRow[logHeaders.indexOf("assigned_driver_user_id")] = assignedDriverUserId;
  logRow[logHeaders.indexOf("assigned_driver_name")] = assignedDriverName;
  logRow[logHeaders.indexOf("assign_mode")] = assignMode;
  logRow[logHeaders.indexOf("reason")] = reason;
  logRow[logHeaders.indexOf("queue_before")] = queueBefore;
  logRow[logHeaders.indexOf("queue_after")] = queueAfter;
  logRow[logHeaders.indexOf("created_at")] = now;
  logRow[logHeaders.indexOf("created_by")] = actor;
  appendSheetRow(logSheet, logRow);

  return jsonOutput({
    success: true,
    message: "Confirm driver queue assignment success",
    data: {
      booking_id: bookingId,
      booking_no: bookingNo,
      assign_mode: assignMode,
      queue_before: queueBefore,
      queue_after: queueAfter,
    },
  });
}

function getDrivers() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Drivers");

  const { headers, rows } = readSheetTable(sheet);

  if (rows.length === 0) {
    return jsonOutput({
      success: true,
      total: 0,
      data: []
    });
  }

  const data = rowsToObjects(headers, rows);

  return jsonOutput({
    success: true,
    total: data.length,
    data: data
  });
}
function createDriver(data) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Drivers");

  const now = new Date();
  const rowNo = sheet.getLastRow();

  const driverId = "DR" + Utilities.formatString("%03d", rowNo);

  appendSheetRow(sheet, [
    driverId,
    data.name || "",
    data.phone || "",
    data.status || "ACTIVE",
    data.remark || "",
    now,
    now
  ]);

  return jsonOutput({
    success: true,
    message: "Create driver success",
    data: {
      driver_id: driverId,
      name: data.name || "",
      phone: data.phone || "",
      status: data.status || "ACTIVE",
      remark: data.remark || ""
    }
  });
}
function updateDriverStatus(data) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Drivers");

  const table = readSheetTable(sheet);
  const columnMap = table.columnMap;

  const driverIdCol = columnMap.driver_id;
  const statusCol = columnMap.status;
  const remarkCol = columnMap.remark;
  const updatedAtCol = columnMap.updated_at;

  for (let i = 0; i < table.rows.length; i++) {
    if (table.rows[i][driverIdCol] === data.driver_id) {
      const row = i + 2;
      const rowValues = table.rows[i].slice();
      rowValues[statusCol] = data.status;
      rowValues[remarkCol] = data.remark || "";
      rowValues[updatedAtCol] = new Date();

      setRowValues(sheet, row, rowValues);

      return jsonOutput({
        success: true,
        message: "Update driver success"
      });
    }
  }

  return jsonOutput({
    success: false,
    message: "Driver not found"
  });
}
function getUsers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  const { headers, rows } = readSheetTable(sheet);

  if (rows.length === 0) {
    return jsonOutput({ success: true, total: 0, data: [] });
  }

  const data = rowsToObjects(headers, rows).map((obj) => {
    const next = { ...obj };
    delete next.driver_id;
    delete next.driver_name;
    next.password = "********";
    return next;
  });

  return jsonOutput({ success: true, total: data.length, data });
}

function createUser(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  const { headers } = readSheetTable(sheet);
  const passwordHashCol = ensureColumn(sheet, headers, "password_hash");
  const now = new Date();
  const userId = "U" + Utilities.formatString("%03d", sheet.getLastRow());
  const hashedPassword = hashPassword_(data.password || "1234");

  const row = headers.map((header) => {
    if (header === "user_id") return userId;
    if (header === "name") return data.name || "";
    if (header === "email") return data.email || "";
    if (header === "password") return "HASHED";
    if (header === "password_hash") return hashedPassword;
    if (header === "department") return data.department || "";
    if (header === "phone") return data.phone || "";
    if (header === "role") return data.role || "USER";
    if (header === "status") return data.status || "ACTIVE";
    if (header === "created_at") return now;
    if (header === "updated_at") return now;
    return "";
  });

  if (passwordHashCol >= row.length) {
    row[passwordHashCol] = hashedPassword;
  }

  appendSheetRow(sheet, row);

  return jsonOutput({
    success: true,
    message: "Create user success",
    data: { user_id: userId }
  });
}

function updateUser(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  const { headers, rows } = readSheetTable(sheet);

  const userIdCol = headers.indexOf("user_id");
  const nameCol = headers.indexOf("name");
  const emailCol = headers.indexOf("email");
  const departmentCol = headers.indexOf("department");
  const phoneCol = headers.indexOf("phone");
  const roleCol = headers.indexOf("role");
  const statusCol = headers.indexOf("status");
  const updatedAtCol = headers.indexOf("updated_at");

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][userIdCol] === data.user_id) {
      const row = i + 2;

      sheet.getRange(row, nameCol + 1).setValue(data.name || "");
      sheet.getRange(row, emailCol + 1).setValue(data.email || "");
      sheet.getRange(row, departmentCol + 1).setValue(data.department || "");
      sheet.getRange(row, phoneCol + 1).setValue(data.phone || "");
      sheet.getRange(row, roleCol + 1).setValue(data.role || "USER");
      sheet.getRange(row, statusCol + 1).setValue(data.status || "ACTIVE");
      sheet.getRange(row, updatedAtCol + 1).setValue(new Date());

      return jsonOutput({ success: true, message: "Update user success" });
    }
  }

  return jsonOutput({ success: false, message: "User not found" });
}

function resetUserPassword(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  const { headers, rows } = readSheetTable(sheet);

  const userIdCol = headers.indexOf("user_id");
  const passwordCol = ensureColumn(sheet, headers, "password");
  const passwordHashCol = ensureColumn(sheet, headers, "password_hash");
  const updatedAtCol = headers.indexOf("updated_at");
  const hashedPassword = hashPassword_(data.password || "1234");

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][userIdCol] === data.user_id) {
      const row = i + 2;

      sheet.getRange(row, passwordCol + 1).setValue("HASHED");
      sheet.getRange(row, passwordHashCol + 1).setValue(hashedPassword);
      sheet.getRange(row, updatedAtCol + 1).setValue(new Date());

      return jsonOutput({ success: true, message: "Reset password success" });
    }
  }

  return jsonOutput({ success: false, message: "User not found" });
}
function updateVehicle(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Vehicles");
  const { headers, rows } = readSheetTable(sheet);

  const vehicleIdCol = headers.indexOf("vehicle_id");

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][vehicleIdCol] === data.vehicle_id) {
      const row = i + 2;

      headers.forEach((header, index) => {
        if (data[header] !== undefined && header !== "vehicle_id") {
          sheet.getRange(row, index + 1).setValue(header === "status" ? normalizeVehicleStatus(data[header]) : data[header]);
        }
      });

      return jsonOutput({
        success: true,
        message: "Update vehicle success"
      });
    }
  }

  return jsonOutput({
    success: false,
    message: "Vehicle not found"
  });
}

function deleteVehicle(data) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Vehicles");

  const { headers, rows } = readSheetTable(sheet);

  const vehicleIdCol = headers.indexOf("vehicle_id");

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][vehicleIdCol] === data.vehicle_id) {

      sheet.deleteRow(i + 2);

      return jsonOutput({
        success: true,
        message: "Delete vehicle success"
      });
    }
  }

  return jsonOutput({
    success: false,
    message: "Vehicle not found"
  });
}
function disableUser(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");

  const { headers, rows } = readSheetTable(sheet);

  const userIdCol = headers.indexOf("user_id");
  const statusCol = headers.indexOf("status");

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][userIdCol] === data.user_id) {
      sheet.getRange(i + 2, statusCol + 1).setValue("INACTIVE");

      return jsonOutput({
        success: true,
      });
    }
  }

  return jsonOutput({
    success: false,
    message: "User not found",
  });
}

function deleteUser(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");

  const { headers, rows } = readSheetTable(sheet);

  const userIdCol = headers.indexOf("user_id");

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][userIdCol] === data.user_id) {
      sheet.deleteRow(i + 2);

      return jsonOutput({
        success: true,
      });
    }
  }

  return jsonOutput({
    success: false,
    message: "User not found",
  });
}
function updateDriver(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Drivers");
  const { headers, rows } = readSheetTable(sheet);

  const driverIdCol = headers.indexOf("driver_id");

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][driverIdCol] === data.driver_id) {
      const row = i + 2;

      headers.forEach((header, index) => {
        if (data[header] !== undefined && header !== "driver_id") {
          sheet.getRange(row, index + 1).setValue(data[header]);
        }
      });

      return jsonOutput({
        success: true,
        message: "Update driver success",
      });
    }
  }

  return jsonOutput({
    success: false,
    message: "Driver not found",
  });
}

function deleteDriver(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Drivers");
  const { headers, rows } = readSheetTable(sheet);

  const driverIdCol = headers.indexOf("driver_id");

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][driverIdCol] === data.driver_id) {
      sheet.deleteRow(i + 2);

      return jsonOutput({
        success: true,
        message: "Delete driver success",
      });
    }
  }

  return jsonOutput({
    success: false,
    message: "Driver not found",
  });
}

const DRIVER_QUEUE_MASTER_HEADERS_ = [
  "queue_id",
  "driver_user_id",
  "driver_name",
  "queue_order",
  "status",
  "is_active",
  "last_assigned_at",
  "last_booking_id",
  "note",
  "updated_at",
  "updated_by",
];

const DRIVER_QUEUE_STATE_HEADERS_ = [
  "state_key",
  "state_value",
  "current_index",
  "current_driver_user_id",
  "current_driver_name",
  "last_assigned_driver_user_id",
  "last_assigned_driver_name",
  "last_assigned_booking_id",
  "updated_at",
  "updated_by",
];

const DRIVER_QUEUE_LOG_HEADERS_ = [
  "log_id",
  "action",
  "booking_id",
  "booking_no",
  "recommended_driver_user_id",
  "recommended_driver_name",
  "assigned_driver_user_id",
  "assigned_driver_name",
  "old_driver_user_id",
  "old_driver_name",
  "assign_mode",
  "queue_before_index",
  "queue_before_driver_user_id",
  "queue_after_index",
  "queue_after_driver_user_id",
  "skipped_drivers_json",
  "reason",
  "queue_before",
  "queue_after",
  "created_at",
  "created_by",
];

function getDriverQueueMasterSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName("DriverQueueMaster") || ss.getSheetByName("DriverQueue");
}

function ensureDriverQueueMasterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("DriverQueueMaster");
  const legacySheet = ss.getSheetByName("DriverQueue");

  if (!sheet) {
    sheet = ss.insertSheet("DriverQueueMaster");
  }

  if (sheet.getLastRow() === 0) {
    appendSheetRow(sheet, DRIVER_QUEUE_MASTER_HEADERS_);
  }

  const table = readSheetTable(sheet);
  DRIVER_QUEUE_MASTER_HEADERS_.forEach((header) => ensureColumn(sheet, table.headers, header));

  if (sheet.getLastRow() <= 1 && legacySheet && legacySheet.getLastRow() > 1) {
    const legacyTable = readSheetTable(legacySheet);
    const legacyRows = rowsToObjects(legacyTable.headers, legacyTable.rows);
    legacyRows
      .sort((a, b) => Number(a.queue_order || 0) - Number(b.queue_order || 0))
      .forEach((row, index) => {
        appendSheetRow(sheet, [
          row.queue_id || `DQ-${index + 1}`,
          row.driver_user_id || "",
          row.driver_name || "",
          Number(row.queue_order || index + 1) || index + 1,
          row.status || (String(row.is_active || "").trim().toUpperCase() === "TRUE" ? "ACTIVE" : "INACTIVE"),
          String(row.is_active || "").trim() || (normalizeQueueStatus_(row.status) === "ACTIVE" ? "TRUE" : "FALSE"),
          row.last_assigned_at || "",
          row.last_booking_id || "",
          row.note || "",
          row.updated_at || new Date().toISOString(),
          row.updated_by || "",
        ]);
      });
  }

  return sheet;
}

function ensureDriverQueueStateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("DriverQueueState");

  if (!sheet) {
    sheet = ss.insertSheet("DriverQueueState");
  }

  if (sheet.getLastRow() === 0) {
    appendSheetRow(sheet, DRIVER_QUEUE_STATE_HEADERS_);
  }

  const table = readSheetTable(sheet);
  DRIVER_QUEUE_STATE_HEADERS_.forEach((header) => ensureColumn(sheet, table.headers, header));

  let stateRow = findDriverQueueStateRow_(readSheetTable(sheet));
  if (stateRow <= 1) {
    const refreshed = readSheetTable(sheet);
    const row = Array(refreshed.headers.length).fill("");
    row[refreshed.columnMap.state_key] = "last_assigned_queue_order";
    row[refreshed.columnMap.state_value] = "0";
    row[refreshed.columnMap.current_index] = "0";
    row[refreshed.columnMap.current_driver_user_id] = "";
    row[refreshed.columnMap.current_driver_name] = "";
    row[refreshed.columnMap.last_assigned_driver_user_id] = "";
    row[refreshed.columnMap.last_assigned_driver_name] = "";
    row[refreshed.columnMap.last_assigned_booking_id] = "";
    row[refreshed.columnMap.updated_at] = new Date().toISOString();
    row[refreshed.columnMap.updated_by] = "system";
    appendSheetRow(sheet, row);
    stateRow = sheet.getLastRow();
  }

  return sheet;
}

function ensureDriverQueueLogsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("DriverQueueLogs");

  if (!sheet) {
    sheet = ss.insertSheet("DriverQueueLogs");
  }

  if (sheet.getLastRow() === 0) {
    appendSheetRow(sheet, DRIVER_QUEUE_LOG_HEADERS_);
  }

  const table = readSheetTable(sheet);
  DRIVER_QUEUE_LOG_HEADERS_.forEach((header) => ensureColumn(sheet, table.headers, header));
  return sheet;
}

function findDriverQueueStateRow_(table) {
  const keyCol = table.columnMap.state_key;
  if (keyCol === undefined) return -1;

  for (let i = 0; i < table.rows.length; i++) {
    const key = String(table.rows[i][keyCol] || "").trim();
    if (key === "last_assigned_queue_order" || key === "master_queue_state" || key === "current_queue_state") {
      return i + 2;
    }
  }

  return -1;
}

// ACTIVE QUEUE ENGINE
// Final runtime queue engine. Functions below are the effective implementations used at runtime.
function readDriverQueueStateRow_() {
  const sheet = ensureDriverQueueStateSheet();
  const table = readSheetTable(sheet);
  const rowNumber = findDriverQueueStateRow_(table);
  if (rowNumber <= 1) {
    return {
      row_number: -1,
      state_key: "last_assigned_queue_order",
      state_value: "0",
      current_index: 0,
      current_driver_user_id: "",
      current_driver_name: "",
      last_assigned_driver_user_id: "",
      last_assigned_driver_name: "",
      last_assigned_booking_id: "",
      updated_at: "",
      updated_by: "",
    };
  }

  const row = table.rows[rowNumber - 2];
  return {
    row_number: rowNumber,
    state_key: String(row[table.columnMap.state_key] || "last_assigned_queue_order"),
    state_value: String(row[table.columnMap.state_value] || "0"),
    current_index: Number(row[table.columnMap.current_index] || 0) || 0,
    current_driver_user_id: String(row[table.columnMap.current_driver_user_id] || "").trim(),
    current_driver_name: String(row[table.columnMap.current_driver_name] || "").trim(),
    last_assigned_driver_user_id: String(row[table.columnMap.last_assigned_driver_user_id] || "").trim(),
    last_assigned_driver_name: String(row[table.columnMap.last_assigned_driver_name] || "").trim(),
    last_assigned_booking_id: String(row[table.columnMap.last_assigned_booking_id] || "").trim(),
    updated_at: row[table.columnMap.updated_at] || "",
    updated_by: row[table.columnMap.updated_by] || "",
  };
}

function writeDriverQueueStateRow_(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DriverQueueState") || ensureDriverQueueStateSheet();
  const table = readSheetTable(sheet);
  const rowNumber = findDriverQueueStateRow_(table);
  const row = Array(table.headers.length).fill("");
  row[table.columnMap.state_key] = payload.state_key || "last_assigned_queue_order";
  row[table.columnMap.state_value] = payload.state_value !== undefined ? String(payload.state_value) : "0";
  row[table.columnMap.current_index] = payload.current_index !== undefined ? String(payload.current_index) : "0";
  row[table.columnMap.current_driver_user_id] = payload.current_driver_user_id || "";
  row[table.columnMap.current_driver_name] = payload.current_driver_name || "";
  row[table.columnMap.last_assigned_driver_user_id] = payload.last_assigned_driver_user_id || "";
  row[table.columnMap.last_assigned_driver_name] = payload.last_assigned_driver_name || "";
  row[table.columnMap.last_assigned_booking_id] = payload.last_assigned_booking_id || "";
  row[table.columnMap.updated_at] = payload.updated_at || new Date().toISOString();
  row[table.columnMap.updated_by] = payload.updated_by || "";

  if (rowNumber > 1) {
    setRowValues(sheet, rowNumber, row);
    return rowNumber;
  }

  return appendSheetRow(sheet, row);
}

function normalizeQueueActiveFlag_(row) {
  const isActive = String(row.is_active || "").trim().toUpperCase();
  const status = String(row.status || "").trim().toUpperCase();
  if (isActive === "TRUE" || isActive === "1" || isActive === "YES") return true;
  if (status === "ACTIVE") return true;
  return false;
}

function buildDriverQueueRows_() {
  const sheet = ensureDriverQueueMasterSheet();
  const table = readSheetTable(sheet);
  const userLookup = getDriverQueueUserStatusLookup_();

  return rowsToObjects(table.headers, table.rows)
    .map((row, index) => {
      const queueOrder = Number(row.queue_order || index + 1) || index + 1;
      const isActive = normalizeQueueActiveFlag_(row);
      const driverUserId = String(row.driver_user_id || "").trim();
      const storedDriverName = String(row.driver_name || "").trim();
      const driverUser = driverUserId ? userLookup.byId.get(driverUserId) || null : null;
      const driverStatus = driverUser ||
        userLookup.byName.get(storedDriverName.toLowerCase()) ||
        null;
      const resolvedDriverName =
        driverStatus && String(driverStatus.role || "").trim().toUpperCase() === "DRIVER"
          ? String(driverStatus.name || "").trim() || storedDriverName
          : storedDriverName;
      return {
        row_number: index + 2,
        queue_id: row.queue_id || `DQ-${queueOrder}`,
        driver_user_id: driverUserId,
        driver_name: resolvedDriverName || storedDriverName,
        stored_driver_name: storedDriverName,
        queue_order: queueOrder,
        status: isActive ? "ACTIVE" : "INACTIVE",
        is_active: isActive ? "TRUE" : "FALSE",
        last_assigned_at: row.last_assigned_at || "",
        last_booking_id: row.last_booking_id || "",
        note: row.note || "",
        updated_at: row.updated_at || "",
        updated_by: row.updated_by || "",
        driver_status: driverStatus ? driverStatus.status : "",
        driver_user_status: driverStatus ? driverStatus.status : "",
        driver_active:
          Boolean(driverStatus) &&
          String(driverStatus.role || "").trim().toUpperCase() === "DRIVER" &&
          String(driverStatus.status || "").trim().toUpperCase() === "ACTIVE",
      };
    })
    .sort((a, b) => {
      const diff = Number(a.queue_order || 0) - Number(b.queue_order || 0);
      if (diff !== 0) return diff;
      return String(a.driver_name || "").localeCompare(String(b.driver_name || ""), "th");
    });
}

function getActiveMasterQueue() {
  return buildDriverQueueRows_().filter((row) => normalizeQueueActiveFlag_(row));
}

function getNextCircularIndex(index, queueLength) {
  const length = Number(queueLength || 0) || 0;
  if (length <= 0) return 0;
  const pointer = Number(index || 0) || 0;
  return (pointer + 1) % length;
}

function getNextQueuePreview_(queueRows, recommendedDriverUserId, currentDriver) {
  const queue = Array.isArray(queueRows) ? [...queueRows] : [];
  const normalizedRecommendedDriverUserId = String(recommendedDriverUserId || "").trim();
  const currentQueueDriverUserId = String(currentDriver?.driver_user_id || "").trim();
  const currentQueueDriverName = String(currentDriver?.driver_name || "").trim();

  if (queue.length === 0) {
    return {
      current_queue_driver_user_id: currentQueueDriverUserId,
      current_queue_driver_name: currentQueueDriverName,
      next_queue_driver_user_id: "",
      next_queue_driver_name: "",
    };
  }

  const recommendedIndex = normalizedRecommendedDriverUserId
    ? queue.findIndex((row) => String(row.driver_user_id || "").trim() === normalizedRecommendedDriverUserId)
    : -1;
  const nextDriver = recommendedIndex >= 0 ? queue[(recommendedIndex + 1) % queue.length] || null : null;

  return {
    current_queue_driver_user_id: currentQueueDriverUserId,
    current_queue_driver_name: currentQueueDriverName,
    next_queue_driver_user_id: nextDriver ? nextDriver.driver_user_id || "" : "",
    next_queue_driver_name: nextDriver ? nextDriver.driver_name || "" : "",
  };
}

function getCurrentQueueState() {
  const queue = getActiveMasterQueue();
  const stateRow = readDriverQueueStateRow_();
  const fallbackIndex = queue.length > 0 ? 0 : 0;
  let currentIndex = Number(stateRow.current_index || 0) || 0;
  let currentDriver = queue[currentIndex] || null;

  if ((!currentDriver || String(currentDriver.driver_user_id || "") !== String(stateRow.current_driver_user_id || "")) && queue.length > 0) {
    const byIdIndex = stateRow.current_driver_user_id
      ? queue.findIndex((row) => String(row.driver_user_id || "").trim() === String(stateRow.current_driver_user_id || "").trim())
      : -1;
    if (byIdIndex >= 0) {
      currentIndex = byIdIndex;
      currentDriver = queue[currentIndex];
    } else if (stateRow.state_value) {
      const byOrderIndex = queue.findIndex((row) => String(row.queue_order || "") === String(stateRow.state_value || ""));
      if (byOrderIndex >= 0) {
        currentIndex = byOrderIndex;
        currentDriver = queue[currentIndex];
      }
    }
  }

  if (!currentDriver && queue.length > 0) {
    currentIndex = fallbackIndex;
    currentDriver = queue[currentIndex];
  }

  const currentQueueOrder = currentDriver ? Number(currentDriver.queue_order || 0) || 0 : 0;

  return {
    ...stateRow,
    current_index: queue.length > 0 ? currentIndex : 0,
    current_driver_user_id: currentDriver ? currentDriver.driver_user_id || "" : "",
    current_driver_name: currentDriver ? currentDriver.driver_name || "" : "",
    state_value: String(currentQueueOrder || 0),
  };
}

function setCurrentQueueState_(payload, updatedBy) {
  const queue = getActiveMasterQueue();
  const now = new Date().toISOString();
  let currentIndex = Number(payload && payload.current_index !== undefined ? payload.current_index : 0) || 0;
  let currentDriver = null;

  if (payload && payload.current_driver_user_id) {
    const byIdIndex = queue.findIndex((row) => String(row.driver_user_id || "").trim() === String(payload.current_driver_user_id || "").trim());
    if (byIdIndex >= 0) {
      currentIndex = byIdIndex;
      currentDriver = queue[currentIndex];
    }
  }

  if (!currentDriver && payload && payload.current_driver_name) {
    const byNameIndex = queue.findIndex((row) => String(row.driver_name || "").trim() === String(payload.current_driver_name || "").trim());
    if (byNameIndex >= 0) {
      currentIndex = byNameIndex;
      currentDriver = queue[currentIndex];
    }
  }

  if (!currentDriver && queue.length > 0) {
    currentIndex = Math.max(0, Math.min(currentIndex, queue.length - 1));
    currentDriver = queue[currentIndex];
  }

  const stateValue = currentDriver ? String(currentDriver.queue_order || 0) : "0";
  writeDriverQueueStateRow_({
    state_key: "last_assigned_queue_order",
    state_value: stateValue,
    current_index: currentIndex,
    current_driver_user_id: currentDriver ? currentDriver.driver_user_id || "" : "",
    current_driver_name: currentDriver ? currentDriver.driver_name || "" : "",
    last_assigned_driver_user_id: payload && payload.last_assigned_driver_user_id ? payload.last_assigned_driver_user_id : "",
    last_assigned_driver_name: payload && payload.last_assigned_driver_name ? payload.last_assigned_driver_name : "",
    last_assigned_booking_id: payload && payload.last_assigned_booking_id ? payload.last_assigned_booking_id : "",
    updated_at: now,
    updated_by: updatedBy || "",
  });

  return getCurrentQueueState();
}

function buildQueueScanRows_(queueRows, currentIndex) {
  if (!queueRows.length) return [];
  const normalizedIndex = Number(currentIndex || 0) || 0;
  const bounded = ((normalizedIndex % queueRows.length) + queueRows.length) % queueRows.length;
  return [...queueRows.slice(bounded), ...queueRows.slice(0, bounded)];
}

function getDriverQueueAvailableRows_(startDatetime, endDatetime) {
  const queueRows = getActiveMasterQueue();
  const state = getCurrentQueueState();
  const orderedRows = buildQueueScanRows_(queueRows, state.current_index);
  const skipped = [];
  const available = [];

  orderedRows.forEach((row) => {
    if (row.status !== "ACTIVE") {
      skipped.push({
        driver_user_id: row.driver_user_id || "",
        driver_name: row.driver_name || "",
        reason: "คิวไม่ ACTIVE",
      });
      return;
    }

    if (row.driver_status !== "ACTIVE") {
      skipped.push({
        driver_user_id: row.driver_user_id || "",
        driver_name: row.driver_name || "",
        reason: "ผู้ใช้ไม่ ACTIVE",
      });
      return;
    }

    const bookingConflict = getDriverUnavailableBookingsConflict(row.driver_user_id, startDatetime, endDatetime, "");
    if (bookingConflict) {
      skipped.push({
        driver_user_id: row.driver_user_id || "",
        driver_name: row.driver_name || "",
        reason: "มีงานทับช่วงเวลา",
      });
      return;
    }

    const unavailableConflict = getDriverUnavailableConflict(row.driver_user_id, startDatetime, endDatetime, "");
    if (unavailableConflict) {
      skipped.push({
        driver_user_id: row.driver_user_id || "",
        driver_name: row.driver_name || "",
        reason: "ข้ามเพราะไม่ว่าง/ติดภารกิจ",
      });
      return;
    }

    available.push(row);
  });

  return {
    available,
    skipped,
  };
}

function getDriverQueue() {
  return jsonOutput({
    success: true,
    total: getActiveMasterQueue().length,
    data: getActiveMasterQueue(),
    state: getCurrentQueueState(),
  });
}

function getDriverQueueState() {
  return jsonOutput({
    success: true,
    data: getCurrentQueueState(),
  });
}

function resetDriverQueueState(data) {
  const updatedBy = String(data && (data.updated_by || data.created_by || data.reset_by || "")).trim();
  const queue = getActiveMasterQueue();
  if (queue.length === 0) {
    const state = setCurrentQueueState_({
      current_index: 0,
      current_driver_user_id: "",
      current_driver_name: "",
      last_assigned_driver_user_id: "",
      last_assigned_driver_name: "",
      last_assigned_booking_id: "",
    }, updatedBy);
    return jsonOutput({
      success: true,
      message: "Reset driver queue state success",
      data: state,
    });
  }

  const state = setCurrentQueueState_({
    current_index: 0,
    current_driver_user_id: queue[0].driver_user_id || "",
    current_driver_name: queue[0].driver_name || "",
    last_assigned_driver_user_id: "",
    last_assigned_driver_name: "",
    last_assigned_booking_id: "",
  }, updatedBy);

  return jsonOutput({
    success: true,
    message: "Reset driver queue state success",
    data: state,
  });
}

function setCurrentDriverQueuePointer(data) {
  const updatedBy = String(data && (data.updated_by || data.created_by || data.reset_by || "")).trim();
  const queue = getActiveMasterQueue();
  if (queue.length === 0) {
    return jsonOutput({
      success: false,
      message: "Driver queue is empty",
    });
  }

  let targetIndex = -1;
  const targetDriverUserId = String(data && data.driver_user_id || "").trim();
  const targetQueueOrder = Number(data && data.queue_order !== undefined ? data.queue_order : NaN);
  const targetCurrentIndex = Number(data && data.current_index !== undefined ? data.current_index : NaN);

  if (targetDriverUserId) {
    targetIndex = queue.findIndex((row) => String(row.driver_user_id || "").trim() === targetDriverUserId);
  } else if (!Number.isNaN(targetQueueOrder)) {
    targetIndex = queue.findIndex((row) => Number(row.queue_order || 0) === targetQueueOrder);
  } else if (!Number.isNaN(targetCurrentIndex)) {
    targetIndex = Math.max(0, Math.min(targetCurrentIndex, queue.length - 1));
  } else {
    targetIndex = 0;
  }

  if (targetIndex < 0) {
    return jsonOutput({
      success: false,
      message: "Driver not found in queue",
    });
  }

  const state = setCurrentQueueState_({
    current_index: targetIndex,
    current_driver_user_id: queue[targetIndex].driver_user_id || "",
    current_driver_name: queue[targetIndex].driver_name || "",
    last_assigned_driver_user_id: "",
    last_assigned_driver_name: "",
    last_assigned_booking_id: "",
  }, updatedBy);

  return jsonOutput({
    success: true,
    message: "Set current driver queue pointer success",
    data: state,
  });
}

function updateDriverQueueMaster(data) {
  const sheet = ensureDriverQueueMasterSheet();
  const table = readSheetTable(sheet);
  const updatedBy = String(data && (data.updated_by || data.created_by || data.updatedBy || "")).trim();
  const queueRows = getActiveMasterQueue();
  const stateBefore = getCurrentQueueState();

  const items = Array.isArray(data && (data.items || data.queue_rows || data.rows)) ? (data.items || data.queue_rows || data.rows) : [];
  if (items.length > 0) {
    const byDriverId = new Map();
    const byQueueId = new Map();
    queueRows.forEach((row) => {
      if (row.driver_user_id) byDriverId.set(String(row.driver_user_id), row);
      if (row.queue_id) byQueueId.set(String(row.queue_id), row);
    });

    items.forEach((item, index) => {
      const target = item.driver_user_id && byDriverId.get(String(item.driver_user_id))
        ? byDriverId.get(String(item.driver_user_id))
        : item.queue_id && byQueueId.get(String(item.queue_id))
          ? byQueueId.get(String(item.queue_id))
          : null;
      if (!target) return;
      const targetRowNumber = target.row_number;
      const row = table.rows[targetRowNumber - 2].slice();
      row[table.columnMap.queue_order] = Number(item.queue_order !== undefined ? item.queue_order : index + 1) || index + 1;
      row[table.columnMap.status] = normalizeQueueStatus_(item.status || row[table.columnMap.status] || "ACTIVE");
      row[table.columnMap.is_active] = String(item.is_active !== undefined ? item.is_active : normalizeQueueStatus_(item.status || row[table.columnMap.status]) === "ACTIVE").toUpperCase();
      row[table.columnMap.note] = String(item.note !== undefined ? item.note : row[table.columnMap.note] || "");
      row[table.columnMap.updated_at] = new Date().toISOString();
      row[table.columnMap.updated_by] = updatedBy;
      setRowValues(sheet, targetRowNumber, row);
    });
  } else if (data.queue_id || data.driver_user_id) {
    const targetRowNumber = findDriverQueueRowByQueueId_(table, data.queue_id) > 1
      ? findDriverQueueRowByQueueId_(table, data.queue_id)
      : findDriverQueueRowByUserId_(table, data.driver_user_id);
    if (targetRowNumber <= 1) {
      return jsonOutput({
        success: false,
        message: "Driver queue not found",
      });
    }

    const currentRow = table.rows[targetRowNumber - 2].slice();
    if (data.queue_order !== undefined) {
      currentRow[table.columnMap.queue_order] = Number(data.queue_order) || 0;
    }
    if (data.status !== undefined) {
      currentRow[table.columnMap.status] = normalizeQueueStatus_(data.status);
      currentRow[table.columnMap.is_active] = normalizeQueueStatus_(data.status) === "ACTIVE" ? "TRUE" : "FALSE";
    }
    if (data.is_active !== undefined) {
      currentRow[table.columnMap.is_active] = String(data.is_active).trim().toUpperCase() === "TRUE" ? "TRUE" : "FALSE";
      currentRow[table.columnMap.status] = currentRow[table.columnMap.is_active] === "TRUE" ? "ACTIVE" : "INACTIVE";
    }
    if (data.note !== undefined) {
      currentRow[table.columnMap.note] = String(data.note || "");
    }
    currentRow[table.columnMap.updated_at] = new Date().toISOString();
    currentRow[table.columnMap.updated_by] = updatedBy;
    setRowValues(sheet, targetRowNumber, currentRow);
  }

  const refreshedQueue = getActiveMasterQueue();
  let currentIndex = 0;
  if (stateBefore.current_driver_user_id) {
    const matchIndex = refreshedQueue.findIndex((row) => String(row.driver_user_id || "").trim() === String(stateBefore.current_driver_user_id || "").trim());
    if (matchIndex >= 0) {
      currentIndex = matchIndex;
    }
  }

  const currentDriver = refreshedQueue[currentIndex] || null;
  const state = setCurrentQueueState_({
    current_index: currentIndex,
    current_driver_user_id: currentDriver ? currentDriver.driver_user_id || "" : "",
    current_driver_name: currentDriver ? currentDriver.driver_name || "" : "",
    last_assigned_driver_user_id: stateBefore.last_assigned_driver_user_id || "",
    last_assigned_driver_name: stateBefore.last_assigned_driver_name || "",
    last_assigned_booking_id: stateBefore.last_assigned_booking_id || "",
  }, updatedBy);

  return jsonOutput({
    success: true,
    message: "Update driver queue master success",
    data: {
      queue: getActiveMasterQueue(),
      state,
    },
  });
}

function recommendDriverForBooking(data) {
  const startDatetime = String(data && data.start_datetime || "").trim();
  const endDatetime = String(data && data.end_datetime || "").trim();
  const bookingId = String(data && data.booking_id || "").trim();

  if (!startDatetime || !endDatetime) {
    return jsonOutput({
      success: false,
      message: "วันเวลาไม่ถูกต้อง",
      data: { skipped: [] },
    });
  }

  if (new Date(endDatetime).getTime() <= new Date(startDatetime).getTime()) {
    return jsonOutput({
      success: false,
      message: "เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด",
      data: { skipped: [] },
    });
  }

  const queueRows = getActiveMasterQueue();
  const state = getCurrentQueueState();
  if (queueRows.length === 0) {
    return jsonOutput({
      success: false,
      message: "ไม่พบคนขับในคิว",
      data: { skipped: [] },
    });
  }

  const startIndex = queueRows.length > 0 ? ((Number(state.current_index || 0) % queueRows.length) + queueRows.length) % queueRows.length : 0;
  const orderedRows = buildQueueScanRows_(queueRows, startIndex);
  const skipped = [];
  const currentDriver = state.current_driver_user_id
    ? {
        driver_user_id: state.current_driver_user_id || "",
        driver_name: state.current_driver_name || "",
      }
    : (queueRows[0] || null);

  for (let i = 0; i < orderedRows.length; i++) {
    const row = orderedRows[i];
    if (!row.driver_active) {
      skipped.push({ driver_user_id: row.driver_user_id || "", driver_name: row.driver_name || "", reason: "ผู้ใช้ไม่ ACTIVE" });
      continue;
    }

    const bookingConflict = getDriverUnavailableBookingsConflict(row.driver_user_id, startDatetime, endDatetime, bookingId);
    if (bookingConflict) {
      skipped.push({ driver_user_id: row.driver_user_id || "", driver_name: row.driver_name || "", reason: "มีงานทับช่วงเวลา" });
      continue;
    }

    const unavailableConflict = getDriverUnavailableConflict(row.driver_user_id, startDatetime, endDatetime, "");
    if (unavailableConflict) {
      skipped.push({ driver_user_id: row.driver_user_id || "", driver_name: row.driver_name || "", reason: "ข้ามเพราะไม่ว่าง/ติดภารกิจ" });
      continue;
    }

    return jsonOutput({
      success: true,
      data: {
        ...getNextQueuePreview_(
          queueRows,
          row.driver_user_id,
          state.current_driver_user_id
            ? {
                driver_user_id: state.current_driver_user_id || "",
                driver_name: state.current_driver_name || "",
              }
            : (queueRows[0] || null)
        ),
        current_index: state.current_index || 0,
        current_queue_driver_user_id: state.current_driver_user_id || "",
        current_queue_driver_name: state.current_driver_name || "",
        recommended_driver_user_id: row.driver_user_id || "",
        recommended_driver_name: row.driver_name || "",
        queue_order: row.queue_order || 0,
        reason: "คิวถัดไป / พร้อมรับงาน",
        skipped,
      },
    });
  }

  return jsonOutput({
    success: false,
    message: "ไม่พบคนขับที่พร้อมรับงานในช่วงเวลานี้",
    data: {
      current_index: state.current_index || 0,
      current_queue_driver_user_id: state.current_driver_user_id || "",
      current_queue_driver_name: state.current_driver_name || "",
      skipped,
    },
  });
}

function confirmDriverQueueAssignment(data) {
  const bookingId = String(data && data.booking_id || "").trim();
  const bookingNo = String(data && data.booking_no || "").trim();
  const recommendedDriverUserId = String(data && data.recommended_driver_user_id || "").trim();
  const recommendedDriverName = String(data && data.recommended_driver_name || "").trim();
  const assignedDriverUserId = String(data && data.assigned_driver_user_id || "").trim();
  const assignedDriverName = String(data && data.assigned_driver_name || "").trim();
  const assignMode = String(data && data.assign_mode || "").trim().toUpperCase() || "AUTO_RECOMMENDED";
  const reason = String(data && data.reason || "").trim();
  const createdBy = String(data && (data.created_by || data.assigned_by_name || data.updated_by || data.staff_name) || "").trim();
  const skippedDrivers = data && (data.skipped_drivers_json || data.skipped_drivers || data.skipped);

  if (!bookingId || !assignedDriverUserId || !assignedDriverName) {
    return jsonOutput({
      success: false,
      message: "booking_id and assigned driver are required",
    });
  }

  const queueRows = getActiveMasterQueue();
  const recommendedQueueDriver = recommendedDriverUserId
    ? queueRows.find((row) => String(row.driver_user_id || "").trim() === recommendedDriverUserId) || null
    : null;
  const assignedQueueDriver = queueRows.find((row) => String(row.driver_user_id || "").trim() === assignedDriverUserId) || null;
  const resolvedRecommendedDriverName = recommendedQueueDriver
    ? String(recommendedQueueDriver.driver_name || "").trim() || recommendedDriverName
    : recommendedDriverName;
  const resolvedAssignedDriverName = assignedQueueDriver
    ? String(assignedQueueDriver.driver_name || "").trim() || assignedDriverName
    : assignedDriverName;
  const stateBefore = getCurrentQueueState();
  const queueBeforeIndex = Number(stateBefore.current_index || 0) || 0;
  const queueBeforeDriver = queueRows[queueBeforeIndex] || null;
  let queueAfterIndex = queueBeforeIndex;
  let queueAfterDriver = queueBeforeDriver;
  let warning = "";

  const assignedIndex = queueRows.findIndex((row) => String(row.driver_user_id || "").trim() === assignedDriverUserId);
  if (assignedIndex >= 0) {
    queueAfterIndex = getNextCircularIndex(assignedIndex, queueRows.length);
    queueAfterDriver = queueRows[queueAfterIndex] || null;
  } else {
    warning = "Assigned driver not found in master queue";
  }

  const masterSheet = ensureDriverQueueMasterSheet();
  const masterTable = readSheetTable(masterSheet);
  if (assignedIndex >= 0) {
    const assignedRowNumber = queueRows[assignedIndex].row_number;
    const row = masterTable.rows[assignedRowNumber - 2].slice();
    row[masterTable.columnMap.last_assigned_at] = new Date().toISOString();
    row[masterTable.columnMap.last_booking_id] = bookingId;
    row[masterTable.columnMap.updated_at] = new Date().toISOString();
    row[masterTable.columnMap.updated_by] = createdBy || "";
    setRowValues(masterSheet, assignedRowNumber, row);
  }

  const state = setCurrentQueueState_({
    current_index: queueAfterDriver ? queueAfterIndex : queueBeforeIndex,
    current_driver_user_id: queueAfterDriver ? queueAfterDriver.driver_user_id || "" : queueBeforeDriver ? queueBeforeDriver.driver_user_id || "" : "",
    current_driver_name: queueAfterDriver ? queueAfterDriver.driver_name || "" : queueBeforeDriver ? queueBeforeDriver.driver_name || "" : "",
    last_assigned_driver_user_id: assignedDriverUserId,
    last_assigned_driver_name: resolvedAssignedDriverName,
    last_assigned_booking_id: bookingId,
  }, createdBy || "");

  const logSheet = ensureDriverQueueLogsSheet();
  const logTable = readSheetTable(logSheet);
  const logRow = Array(logTable.headers.length).fill("");
  const now = new Date().toISOString();

  logRow[logTable.columnMap.log_id] = "DQL-" + Date.now();
  logRow[logTable.columnMap.action] = "ASSIGNED";
  logRow[logTable.columnMap.booking_id] = bookingId;
  logRow[logTable.columnMap.booking_no] = bookingNo;
  logRow[logTable.columnMap.recommended_driver_user_id] = recommendedDriverUserId;
  logRow[logTable.columnMap.recommended_driver_name] = resolvedRecommendedDriverName;
  logRow[logTable.columnMap.assigned_driver_user_id] = assignedDriverUserId;
  logRow[logTable.columnMap.assigned_driver_name] = resolvedAssignedDriverName;
  logRow[logTable.columnMap.old_driver_user_id] = "";
  logRow[logTable.columnMap.old_driver_name] = "";
  logRow[logTable.columnMap.assign_mode] = assignMode;
  logRow[logTable.columnMap.queue_before_index] = queueBeforeIndex;
  logRow[logTable.columnMap.queue_before_driver_user_id] = queueBeforeDriver ? queueBeforeDriver.driver_user_id || "" : "";
  logRow[logTable.columnMap.queue_after_index] = queueAfterDriver ? queueAfterIndex : queueBeforeIndex;
  logRow[logTable.columnMap.queue_after_driver_user_id] = queueAfterDriver ? queueAfterDriver.driver_user_id || "" : queueBeforeDriver ? queueBeforeDriver.driver_user_id || "" : "";
  logRow[logTable.columnMap.skipped_drivers_json] = Array.isArray(skippedDrivers) ? JSON.stringify(skippedDrivers) : String(skippedDrivers || "");
  logRow[logTable.columnMap.reason] = warning ? `${reason}${reason ? " | " : ""}${warning}` : reason;
  logRow[logTable.columnMap.queue_before] = queueBeforeDriver ? `${queueBeforeDriver.driver_name || ""} (#${queueBeforeDriver.queue_order || 0})` : "";
  logRow[logTable.columnMap.queue_after] = queueAfterDriver ? `${queueAfterDriver.driver_name || ""} (#${queueAfterDriver.queue_order || 0})` : "";
  logRow[logTable.columnMap.created_at] = now;
  logRow[logTable.columnMap.created_by] = createdBy || "";
  appendSheetRow(logSheet, logRow);

  try {
    if (assignedDriverUserId) {
      const assignmentPayload = buildNotificationPayloadFromBooking_(booking, {
        driver_name: assignedDriverName || booking.assigned_user_name || "",
        status: "APPROVED",
      });
      createNotification({
        target_user_id: assignedDriverUserId,
        target_role: "",
        title: "คุณได้รับมอบหมายงาน",
        message: buildRequesterDestinationStartMessage_(booking, "มีการมอบหมายงานใหม่"),
        type: "BOOKING_ASSIGNED",
        booking_id: bookingId,
        url: "/driver-jobs",
        created_by: createdBy || "",
        payload_json: assignmentPayload,
      });
    }
  } catch (notificationErr) {
    console.warn("confirmDriverQueueAssignment notification failed", notificationErr);
  }

  return jsonOutput({
    success: true,
    message: warning ? "Confirm driver queue assignment success with warning" : "Confirm driver queue assignment success",
    data: {
      booking_id: bookingId,
      booking_no: bookingNo,
      recommended_driver_user_id: recommendedDriverUserId,
      recommended_driver_name: resolvedRecommendedDriverName,
      assigned_driver_user_id: assignedDriverUserId,
      assigned_driver_name: resolvedAssignedDriverName,
      assign_mode: assignMode,
      reason,
      queue_before_index: queueBeforeIndex,
      queue_before_driver_user_id: queueBeforeDriver ? queueBeforeDriver.driver_user_id || "" : "",
      queue_after_index: queueAfterDriver ? queueAfterIndex : queueBeforeIndex,
      queue_after_driver_user_id: queueAfterDriver ? queueAfterDriver.driver_user_id || "" : queueBeforeDriver ? queueBeforeDriver.driver_user_id || "" : "",
      warning,
      state,
    },
  });
}

function updateDriverQueue(data) {
  return updateDriverQueueMaster(data);
}

function resetDriverQueuePointer(data) {
  return resetDriverQueueState(data);
}

function ensureDriverQueueLogsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("DriverQueueLogs");

  if (!sheet) {
    sheet = ss.insertSheet("DriverQueueLogs");
  }

  if (sheet.getLastRow() === 0) {
    appendSheetRow(sheet, DRIVER_QUEUE_LOG_HEADERS_);
  }

  const table = readSheetTable(sheet);
  DRIVER_QUEUE_LOG_HEADERS_.forEach((header) => ensureColumn(sheet, table.headers, header));
  return sheet;
}

function findDriverQueueStateRow_(table) {
  const keyCol = table.columnMap.state_key;
  if (keyCol === undefined) return -1;

  for (let i = 0; i < table.rows.length; i++) {
    const key = String(table.rows[i][keyCol] || "").trim();
    if (key === "last_assigned_queue_order" || key === "master_queue_state" || key === "current_queue_state") {
      return i + 2;
    }
  }

  return -1;
}

function readDriverQueueStateRow_() {
  const sheet = ensureDriverQueueStateSheet();
  const table = readSheetTable(sheet);
  const rowNumber = findDriverQueueStateRow_(table);
  if (rowNumber <= 1) {
    return {
      row_number: -1,
      state_key: "last_assigned_queue_order",
      state_value: "0",
      current_index: 0,
      current_driver_user_id: "",
      current_driver_name: "",
      last_assigned_driver_user_id: "",
      last_assigned_driver_name: "",
      last_assigned_booking_id: "",
      updated_at: "",
      updated_by: "",
    };
  }

  const row = table.rows[rowNumber - 2];
  return {
    row_number: rowNumber,
    state_key: String(row[table.columnMap.state_key] || "last_assigned_queue_order"),
    state_value: String(row[table.columnMap.state_value] || "0"),
    current_index: Number(row[table.columnMap.current_index] || 0) || 0,
    current_driver_user_id: String(row[table.columnMap.current_driver_user_id] || "").trim(),
    current_driver_name: String(row[table.columnMap.current_driver_name] || "").trim(),
    last_assigned_driver_user_id: String(row[table.columnMap.last_assigned_driver_user_id] || "").trim(),
    last_assigned_driver_name: String(row[table.columnMap.last_assigned_driver_name] || "").trim(),
    last_assigned_booking_id: String(row[table.columnMap.last_assigned_booking_id] || "").trim(),
    updated_at: row[table.columnMap.updated_at] || "",
    updated_by: row[table.columnMap.updated_by] || "",
  };
}

function writeDriverQueueStateRow_(payload) {
  const sheet = ensureDriverQueueStateSheet();
  const table = readSheetTable(sheet);
  const rowNumber = findDriverQueueStateRow_(table);
  const row = Array(table.headers.length).fill("");
  row[table.columnMap.state_key] = payload.state_key || "last_assigned_queue_order";
  row[table.columnMap.state_value] = payload.state_value !== undefined ? String(payload.state_value) : "0";
  row[table.columnMap.current_index] = payload.current_index !== undefined ? String(payload.current_index) : "0";
  row[table.columnMap.current_driver_user_id] = payload.current_driver_user_id || "";
  row[table.columnMap.current_driver_name] = payload.current_driver_name || "";
  row[table.columnMap.last_assigned_driver_user_id] = payload.last_assigned_driver_user_id || "";
  row[table.columnMap.last_assigned_driver_name] = payload.last_assigned_driver_name || "";
  row[table.columnMap.last_assigned_booking_id] = payload.last_assigned_booking_id || "";
  row[table.columnMap.updated_at] = payload.updated_at || new Date().toISOString();
  row[table.columnMap.updated_by] = payload.updated_by || "";

  if (rowNumber > 1) {
    setRowValues(sheet, rowNumber, row);
    return rowNumber;
  }

  return appendSheetRow(sheet, row);
}

function normalizeQueueActiveFlag_(row) {
  const isActive = String(row.is_active || "").trim().toUpperCase();
  const status = String(row.status || "").trim().toUpperCase();
  if (isActive === "TRUE" || isActive === "1" || isActive === "YES") return true;
  if (status === "ACTIVE") return true;
  return false;
}

function buildDriverQueueRows_() {
  const sheet = ensureDriverQueueMasterSheet();
  const table = readSheetTable(sheet);
  const userLookup = getDriverQueueUserStatusLookup_();

  return rowsToObjects(table.headers, table.rows)
    .map((row, index) => {
      const queueOrder = Number(row.queue_order || index + 1) || index + 1;
      const isActive = normalizeQueueActiveFlag_(row);
      const driverStatus = userLookup.byId.get(String(row.driver_user_id || "").trim()) ||
        userLookup.byName.get(String(row.driver_name || "").trim().toLowerCase()) ||
        null;
      return {
        row_number: index + 2,
        queue_id: row.queue_id || `DQ-${queueOrder}`,
        driver_user_id: String(row.driver_user_id || "").trim(),
        driver_name: String(row.driver_name || "").trim(),
        queue_order: queueOrder,
        status: isActive ? "ACTIVE" : "INACTIVE",
        is_active: isActive ? "TRUE" : "FALSE",
        last_assigned_at: row.last_assigned_at || "",
        last_booking_id: row.last_booking_id || "",
        note: row.note || "",
        updated_at: row.updated_at || "",
        updated_by: row.updated_by || "",
        driver_status: driverStatus ? driverStatus.status : "",
        driver_user_status: driverStatus ? driverStatus.status : "",
        driver_active: !driverStatus || driverStatus.status === "ACTIVE",
      };
    })
    .sort((a, b) => {
      const diff = Number(a.queue_order || 0) - Number(b.queue_order || 0);
      if (diff !== 0) return diff;
      return String(a.driver_name || "").localeCompare(String(b.driver_name || ""), "th");
    });
}

function getActiveMasterQueue() {
  return buildDriverQueueRows_().filter((row) => normalizeQueueActiveFlag_(row));
}

function getNextCircularIndex(index, queueLength) {
  const length = Number(queueLength || 0) || 0;
  if (length <= 0) return 0;
  const pointer = Number(index || 0) || 0;
  return (pointer + 1) % length;
}

function getCurrentQueueState() {
  const queue = getActiveMasterQueue();
  const stateRow = readDriverQueueStateRow_();
  const fallbackIndex = queue.length > 0 ? 0 : 0;
  let currentIndex = Number(stateRow.current_index || 0) || 0;
  let currentDriver = queue[currentIndex] || null;

  if ((!currentDriver || String(currentDriver.driver_user_id || "") !== String(stateRow.current_driver_user_id || "")) && queue.length > 0) {
    const byIdIndex = stateRow.current_driver_user_id
      ? queue.findIndex((row) => String(row.driver_user_id || "").trim() === String(stateRow.current_driver_user_id || "").trim())
      : -1;
    if (byIdIndex >= 0) {
      currentIndex = byIdIndex;
      currentDriver = queue[currentIndex];
    } else if (stateRow.state_value) {
      const byOrderIndex = queue.findIndex((row) => String(row.queue_order || "") === String(stateRow.state_value || ""));
      if (byOrderIndex >= 0) {
        currentIndex = byOrderIndex;
        currentDriver = queue[currentIndex];
      }
    }
  }

  if (!currentDriver && queue.length > 0) {
    currentIndex = fallbackIndex;
    currentDriver = queue[currentIndex];
  }

  const currentQueueOrder = currentDriver ? Number(currentDriver.queue_order || 0) || 0 : 0;

  return {
    ...stateRow,
    current_index: queue.length > 0 ? currentIndex : 0,
    current_driver_user_id: currentDriver ? currentDriver.driver_user_id || "" : "",
    current_driver_name: currentDriver ? currentDriver.driver_name || "" : "",
    state_value: String(currentQueueOrder || 0),
  };
}

function setCurrentQueueState_(payload, updatedBy) {
  const queue = getActiveMasterQueue();
  const now = new Date().toISOString();
  let currentIndex = Number(payload && payload.current_index !== undefined ? payload.current_index : 0) || 0;
  let currentDriver = null;

  if (payload && payload.current_driver_user_id) {
    const byIdIndex = queue.findIndex((row) => String(row.driver_user_id || "").trim() === String(payload.current_driver_user_id || "").trim());
    if (byIdIndex >= 0) {
      currentIndex = byIdIndex;
      currentDriver = queue[currentIndex];
    }
  }

  if (!currentDriver && payload && payload.current_driver_name) {
    const byNameIndex = queue.findIndex((row) => String(row.driver_name || "").trim() === String(payload.current_driver_name || "").trim());
    if (byNameIndex >= 0) {
      currentIndex = byNameIndex;
      currentDriver = queue[currentIndex];
    }
  }

  if (!currentDriver && queue.length > 0) {
    currentIndex = Math.max(0, Math.min(currentIndex, queue.length - 1));
    currentDriver = queue[currentIndex];
  }

  const stateValue = currentDriver ? String(currentDriver.queue_order || 0) : "0";
  writeDriverQueueStateRow_({
    state_key: "last_assigned_queue_order",
    state_value: stateValue,
    current_index: currentIndex,
    current_driver_user_id: currentDriver ? currentDriver.driver_user_id || "" : "",
    current_driver_name: currentDriver ? currentDriver.driver_name || "" : "",
    last_assigned_driver_user_id: payload && payload.last_assigned_driver_user_id ? payload.last_assigned_driver_user_id : "",
    last_assigned_driver_name: payload && payload.last_assigned_driver_name ? payload.last_assigned_driver_name : "",
    last_assigned_booking_id: payload && payload.last_assigned_booking_id ? payload.last_assigned_booking_id : "",
    updated_at: now,
    updated_by: updatedBy || "",
  });

  return getCurrentQueueState();
}

function buildQueueScanRows_(queueRows, currentIndex) {
  if (!queueRows.length) return [];
  const normalizedIndex = Number(currentIndex || 0) || 0;
  const bounded = ((normalizedIndex % queueRows.length) + queueRows.length) % queueRows.length;
  return [...queueRows.slice(bounded), ...queueRows.slice(0, bounded)];
}

function createEmptyDriverRecommendationData_() {
  return {
    current_queue_driver_user_id: "",
    current_queue_driver_name: "",
    recommended_driver_user_id: "",
    recommended_driver_name: "",
    next_queue_driver_user_id: "",
    next_queue_driver_name: "",
    reason: "",
    skipped: [],
    available_drivers: [],
  };
}

function buildDriverQueueRecommendationContext_(startDatetime, endDatetime, bookingId) {
  const queueRows = getActiveMasterQueue();
  const userLookup = getDriverQueueUserStatusLookup_();
  const usersById = userLookup.byId;
  const usersByName = userLookup.byName;
  const bookingsTable = readSheetTable(ensureBookingsSheet());
  const unavailableTable = readSheetTable(ensureDriverUnavailableSheet());
  const bookings = rowsToObjects(bookingsTable.headers, bookingsTable.rows);
  const unavailableRows = getDriverUnavailableRows(unavailableTable);
  const activeAssignmentByDriverId = new Map();
  const activeAssignmentByDriverName = new Map();
  const unavailableByDriverId = new Map();
  const unavailableByDriverName = new Map();

  bookings.forEach((booking) => {
    const status = String(booking.status || "").trim().toUpperCase();
    if (status !== "APPROVED" && status !== "IN_USE") return;
    if (bookingId && String(booking.booking_id || "").trim() === bookingId) return;

    const assignedUserId = String(booking.assigned_user_id || booking.driver_id || "").trim();
    const assignedUserName = String(booking.assigned_user_name || booking.driver_name || "").trim();

    if (assignedUserId && !activeAssignmentByDriverId.has(assignedUserId)) {
      activeAssignmentByDriverId.set(assignedUserId, booking);
    } else if (assignedUserName) {
      const key = assignedUserName.toLowerCase();
      if (!activeAssignmentByDriverName.has(key)) {
        activeAssignmentByDriverName.set(key, booking);
      }
    }
  });

  unavailableRows.forEach((row) => {
    if (String(row.status || "").trim().toUpperCase() !== "ACTIVE") return;
    if (!isTimeOverlap(startDatetime, endDatetime, row.start_datetime, row.end_datetime)) return;

    const driverUserId = String(row.driver_user_id || "").trim();
    const driverName = String(row.driver_name || "").trim();

    if (driverUserId && !unavailableByDriverId.has(driverUserId)) {
      unavailableByDriverId.set(driverUserId, row);
    }
    if (driverName) {
      const key = driverName.toLowerCase();
      if (!unavailableByDriverName.has(key)) {
        unavailableByDriverName.set(key, row);
      }
    }
  });

  return {
    queueRows,
    state: getCurrentQueueState(),
    usersById,
    usersByName,
    activeAssignmentByDriverId,
    activeAssignmentByDriverName,
    unavailableByDriverId,
    unavailableByDriverName,
  };
}

function resolveQueueRecommendationDriverName_(context, driverUserId, fallbackName) {
  const normalizedDriverUserId = String(driverUserId || "").trim();
  const matchedUser = normalizedDriverUserId ? context.usersById.get(normalizedDriverUserId) || null : null;
  if (matchedUser && String(matchedUser.name || "").trim()) {
    return String(matchedUser.name || "").trim();
  }

  return String(fallbackName || "").trim();
}

function evaluateQueueRecommendationRow_(row, context) {
  const driverUserId = String(row.driver_user_id || "").trim();
  const queueDriverName = resolveQueueRecommendationDriverName_(context, driverUserId, row.driver_name || "");
  const queueDriver = driverUserId
    ? context.usersById.get(driverUserId) || context.usersByName.get(queueDriverName.toLowerCase()) || null
    : null;
  const driverPhone = queueDriver ? String(queueDriver.phone || "").trim() : "";
  const driverIsActive =
    Boolean(queueDriver) &&
    String(queueDriver.role || "").trim().toUpperCase() === "DRIVER" &&
    String(queueDriver.status || "").trim().toUpperCase() === "ACTIVE";

  let available = false;
  let reason = "";

  if (!driverIsActive) {
    reason = "ผู้ใช้ไม่ ACTIVE";
  } else if (
    context.activeAssignmentByDriverId.has(driverUserId) ||
    (queueDriverName && context.activeAssignmentByDriverName.has(queueDriverName.toLowerCase()))
  ) {
    reason = "มีงานที่มอบหมายแล้ว";
  } else if (
    context.unavailableByDriverId.has(driverUserId) ||
    (queueDriverName && context.unavailableByDriverName.has(queueDriverName.toLowerCase()))
  ) {
    reason = "ไม่พร้อม / ติดภารกิจ";
  } else {
    available = true;
  }

  return {
    user_id: driverUserId,
    name: queueDriverName || row.driver_name || "-",
    phone: driverPhone,
    available,
    reason,
  };
}

function getDriverQueueAvailableRows_(startDatetime, endDatetime) {
  const context = buildDriverQueueRecommendationContext_(startDatetime, endDatetime, "");
  const orderedRows = buildQueueScanRows_(context.queueRows, context.state.current_index);
  const skipped = [];
  const available = [];

  orderedRows.forEach((row) => {
    const evaluation = evaluateQueueRecommendationRow_(row, context);
    if (evaluation.available) {
      available.push(row);
      return;
    }

    skipped.push({
      driver_user_id: evaluation.user_id || "",
      driver_name: evaluation.name || "",
      reason: evaluation.reason || "",
    });
  });

  return {
    available,
    skipped,
  };
}

function getDriverQueue() {
  return jsonOutput({
    success: true,
    total: getActiveMasterQueue().length,
    data: getActiveMasterQueue(),
    state: getCurrentQueueState(),
  });
}

function getDriverQueueState() {
  return jsonOutput({
    success: true,
    data: getCurrentQueueState(),
  });
}

function resetDriverQueueState(data) {
  const updatedBy = String(data && (data.updated_by || data.created_by || data.reset_by || "")).trim();
  const queue = getActiveMasterQueue();
  if (queue.length === 0) {
    const state = setCurrentQueueState_({
      current_index: 0,
      current_driver_user_id: "",
      current_driver_name: "",
      last_assigned_driver_user_id: "",
      last_assigned_driver_name: "",
      last_assigned_booking_id: "",
    }, updatedBy);
    return jsonOutput({
      success: true,
      message: "Reset driver queue state success",
      data: state,
    });
  }

  const state = setCurrentQueueState_({
    current_index: 0,
    current_driver_user_id: queue[0].driver_user_id || "",
    current_driver_name: queue[0].driver_name || "",
    last_assigned_driver_user_id: "",
    last_assigned_driver_name: "",
    last_assigned_booking_id: "",
  }, updatedBy);

  return jsonOutput({
    success: true,
    message: "Reset driver queue state success",
    data: state,
  });
}

function setCurrentDriverQueuePointer(data) {
  const updatedBy = String(data && (data.updated_by || data.created_by || data.reset_by || "")).trim();
  const queue = getActiveMasterQueue();
  if (queue.length === 0) {
    return jsonOutput({
      success: false,
      message: "Driver queue is empty",
    });
  }

  let targetIndex = -1;
  const targetDriverUserId = String(data && data.driver_user_id || "").trim();
  const targetQueueOrder = Number(data && data.queue_order !== undefined ? data.queue_order : NaN);
  const targetCurrentIndex = Number(data && data.current_index !== undefined ? data.current_index : NaN);

  if (targetDriverUserId) {
    targetIndex = queue.findIndex((row) => String(row.driver_user_id || "").trim() === targetDriverUserId);
  } else if (!Number.isNaN(targetQueueOrder)) {
    targetIndex = queue.findIndex((row) => Number(row.queue_order || 0) === targetQueueOrder);
  } else if (!Number.isNaN(targetCurrentIndex)) {
    targetIndex = Math.max(0, Math.min(targetCurrentIndex, queue.length - 1));
  } else {
    targetIndex = 0;
  }

  if (targetIndex < 0) {
    return jsonOutput({
      success: false,
      message: "Driver not found in queue",
    });
  }

  const state = setCurrentQueueState_({
    current_index: targetIndex,
    current_driver_user_id: queue[targetIndex].driver_user_id || "",
    current_driver_name: queue[targetIndex].driver_name || "",
    last_assigned_driver_user_id: "",
    last_assigned_driver_name: "",
    last_assigned_booking_id: "",
  }, updatedBy);

  return jsonOutput({
    success: true,
    message: "Set current driver queue pointer success",
    data: state,
  });
}

function updateDriverQueueMaster(data) {
  const sheet = ensureDriverQueueMasterSheet();
  const table = readSheetTable(sheet);
  const updatedBy = String(data && (data.updated_by || data.created_by || data.updatedBy || "")).trim();
  const queueRows = getActiveMasterQueue();
  const stateBefore = getCurrentQueueState();

  const items = Array.isArray(data && (data.items || data.queue_rows || data.rows)) ? (data.items || data.queue_rows || data.rows) : [];
  if (items.length > 0) {
    const byDriverId = new Map();
    const byQueueId = new Map();
    queueRows.forEach((row) => {
      if (row.driver_user_id) byDriverId.set(String(row.driver_user_id), row);
      if (row.queue_id) byQueueId.set(String(row.queue_id), row);
    });

    items.forEach((item, index) => {
      const target = item.driver_user_id && byDriverId.get(String(item.driver_user_id))
        ? byDriverId.get(String(item.driver_user_id))
        : item.queue_id && byQueueId.get(String(item.queue_id))
          ? byQueueId.get(String(item.queue_id))
          : null;
      if (!target) return;
      const targetRowNumber = target.row_number;
      const row = table.rows[targetRowNumber - 2].slice();
      row[table.columnMap.queue_order] = Number(item.queue_order !== undefined ? item.queue_order : index + 1) || index + 1;
      row[table.columnMap.status] = normalizeQueueStatus_(item.status || row[table.columnMap.status] || "ACTIVE");
      row[table.columnMap.is_active] = String(item.is_active !== undefined ? item.is_active : normalizeQueueStatus_(item.status || row[table.columnMap.status]) === "ACTIVE").toUpperCase();
      row[table.columnMap.note] = String(item.note !== undefined ? item.note : row[table.columnMap.note] || "");
      row[table.columnMap.updated_at] = new Date().toISOString();
      row[table.columnMap.updated_by] = updatedBy;
      setRowValues(sheet, targetRowNumber, row);
    });
  } else if (data.queue_id || data.driver_user_id) {
    const targetRowNumber = findDriverQueueRowByQueueId_(table, data.queue_id) > 1
      ? findDriverQueueRowByQueueId_(table, data.queue_id)
      : findDriverQueueRowByUserId_(table, data.driver_user_id);
    if (targetRowNumber <= 1) {
      return jsonOutput({
        success: false,
        message: "Driver queue not found",
      });
    }

    const currentRow = table.rows[targetRowNumber - 2].slice();
    if (data.queue_order !== undefined) {
      currentRow[table.columnMap.queue_order] = Number(data.queue_order) || 0;
    }
    if (data.status !== undefined) {
      currentRow[table.columnMap.status] = normalizeQueueStatus_(data.status);
      currentRow[table.columnMap.is_active] = normalizeQueueStatus_(data.status) === "ACTIVE" ? "TRUE" : "FALSE";
    }
    if (data.is_active !== undefined) {
      currentRow[table.columnMap.is_active] = String(data.is_active).trim().toUpperCase() === "TRUE" ? "TRUE" : "FALSE";
      currentRow[table.columnMap.status] = currentRow[table.columnMap.is_active] === "TRUE" ? "ACTIVE" : "INACTIVE";
    }
    if (data.note !== undefined) {
      currentRow[table.columnMap.note] = String(data.note || "");
    }
    currentRow[table.columnMap.updated_at] = new Date().toISOString();
    currentRow[table.columnMap.updated_by] = updatedBy;
    setRowValues(sheet, targetRowNumber, currentRow);
  }

  const refreshedQueue = getActiveMasterQueue();
  let currentIndex = 0;
  if (stateBefore.current_driver_user_id) {
    const matchIndex = refreshedQueue.findIndex((row) => String(row.driver_user_id || "").trim() === String(stateBefore.current_driver_user_id || "").trim());
    if (matchIndex >= 0) {
      currentIndex = matchIndex;
    }
  }

  const currentDriver = refreshedQueue[currentIndex] || null;
  const state = setCurrentQueueState_({
    current_index: currentIndex,
    current_driver_user_id: currentDriver ? currentDriver.driver_user_id || "" : "",
    current_driver_name: currentDriver ? currentDriver.driver_name || "" : "",
    last_assigned_driver_user_id: stateBefore.last_assigned_driver_user_id || "",
    last_assigned_driver_name: stateBefore.last_assigned_driver_name || "",
    last_assigned_booking_id: stateBefore.last_assigned_booking_id || "",
  }, updatedBy);

  return jsonOutput({
    success: true,
    message: "Update driver queue master success",
    data: {
      queue: getActiveMasterQueue(),
      state,
    },
  });
}

function recommendDriverForBooking(data) {
  const startDatetime = String(data && data.start_datetime || "").trim();
  const endDatetime = String(data && data.end_datetime || "").trim();
  const bookingId = String(data && data.booking_id || "").trim();
  const emptyData = createEmptyDriverRecommendationData_();

  if (!startDatetime || !endDatetime) {
    return jsonOutput({
      success: false,
      message: "เธงเธฑเธเน€เธงเธฅเธฒเนเธกเนเธ–เธนเธเธ•เนเธญเธ",
      data: emptyData,
    });
  }

  if (new Date(endDatetime).getTime() <= new Date(startDatetime).getTime()) {
    return jsonOutput({
      success: false,
      message: "เน€เธงเธฅเธฒเน€เธฃเธดเนเธกเธ•เนเธญเธเธเนเธญเธขเธเธงเนเธฒเน€เธงเธฅเธฒเธชเธดเนเธเธชเธธเธ”",
      data: emptyData,
    });
  }

  const context = buildDriverQueueRecommendationContext_(startDatetime, endDatetime, bookingId);
  const queueRows = context.queueRows;
  const orderedRows = buildQueueScanRows_(queueRows, context.state.current_index);
  const skipped = [];
  const availableDrivers = [];
  let recommendedRow = null;
  let recommendedReason = "";

  const currentQueueDriver = queueRows.find(
    (row) => String(row.driver_user_id || "").trim() === String(context.state.current_driver_user_id || "").trim()
  ) || queueRows[context.state.current_index] || null;
  const currentQueueDriverUserId = currentQueueDriver
    ? currentQueueDriver.driver_user_id || String(context.state.current_driver_user_id || "").trim()
    : String(context.state.current_driver_user_id || "").trim();
  const currentQueueDriverName = resolveQueueRecommendationDriverName_(
    context,
    currentQueueDriverUserId,
    context.state.current_driver_name || (currentQueueDriver ? currentQueueDriver.driver_name || "" : "")
  );

  for (let i = 0; i < orderedRows.length; i++) {
    const row = orderedRows[i];
    const evaluation = evaluateQueueRecommendationRow_(row, context);
    availableDrivers.push(evaluation);

    if (evaluation.available) {
      if (!recommendedRow) {
        recommendedRow = row;
        recommendedReason = "คิวถัดไป / พร้อมรับงาน";
      }
      continue;
    }

    skipped.push({
      driver_user_id: evaluation.user_id,
      driver_name: evaluation.name,
      reason: evaluation.reason,
    });
  }

  if (!recommendedRow) {
    return jsonOutput({
      success: false,
      message: "ไม่พบคนขับที่พร้อมรับงาน",
      data: {
        current_queue_driver_user_id: currentQueueDriverUserId,
        current_queue_driver_name: currentQueueDriverName,
        recommended_driver_user_id: "",
        recommended_driver_name: "",
        next_queue_driver_user_id: "",
        next_queue_driver_name: "",
        reason: "",
        skipped,
        available_drivers: availableDrivers,
      },
    });
  }

  const recommendedIndex = queueRows.findIndex((row) => String(row.driver_user_id || "").trim() === String(recommendedRow.driver_user_id || "").trim());
  const nextDriver = recommendedIndex >= 0 ? queueRows[(recommendedIndex + 1) % queueRows.length] || null : null;
  const nextQueueDriverUserId = nextDriver ? String(nextDriver.driver_user_id || "").trim() : "";
  const nextQueueDriverName = nextDriver
    ? resolveQueueRecommendationDriverName_(context, nextQueueDriverUserId, nextDriver.driver_name || "")
    : "";

  return jsonOutput({
    success: true,
    data: {
      current_queue_driver_user_id: currentQueueDriverUserId,
      current_queue_driver_name: currentQueueDriverName,
      recommended_driver_user_id: String(recommendedRow.driver_user_id || "").trim(),
      recommended_driver_name: resolveQueueRecommendationDriverName_(
        context,
        recommendedRow.driver_user_id,
        recommendedRow.driver_name || ""
      ),
      next_queue_driver_user_id: nextQueueDriverUserId,
      next_queue_driver_name: nextQueueDriverName,
      reason: recommendedReason,
      skipped,
      available_drivers: availableDrivers,
    },
  });
}
function confirmDriverQueueAssignment(data) {
  const bookingId = String(data && data.booking_id || "").trim();
  const bookingNo = String(data && data.booking_no || "").trim();
  const recommendedDriverUserId = String(data && data.recommended_driver_user_id || "").trim();
  const recommendedDriverName = String(data && data.recommended_driver_name || "").trim();
  const assignedDriverUserId = String(data && data.assigned_driver_user_id || "").trim();
  const assignedDriverName = String(data && data.assigned_driver_name || "").trim();
  const assignMode = String(data && data.assign_mode || "").trim().toUpperCase() || "AUTO_RECOMMENDED";
  const reason = String(data && data.reason || "").trim();
  const createdBy = String(data && (data.created_by || data.assigned_by_name || data.updated_by || data.staff_name) || "").trim();
  const skippedDrivers = data && (data.skipped_drivers_json || data.skipped_drivers || data.skipped);

  if (!bookingId || !assignedDriverUserId || !assignedDriverName) {
    return jsonOutput({
      success: false,
      message: "booking_id and assigned driver are required",
    });
  }

  const bookingSheet = ensureBookingsSheet();
  const bookingTable = readSheetTable(bookingSheet);
  const bookingRowNumber = findRowByBookingId(bookingTable, bookingId);
  const booking = bookingRowNumber > 1
    ? rowsToObjects(bookingTable.headers, [bookingTable.rows[bookingRowNumber - 2]])[0] || {}
    : {};
  const queueRows = getActiveMasterQueue();
  const activeDriverLookup = getActiveDriverLookup_();
  const stateBefore = getCurrentQueueState();
  const queueBeforeIndex = Number(stateBefore.current_index || 0) || 0;
  const queueBeforeDriver = queueRows.find((row) => String(row.driver_user_id || "").trim() === String(stateBefore.current_driver_user_id || "").trim())
    || queueRows[queueBeforeIndex]
    || null;
  const resolvedRecommendedDriverName = recommendedDriverUserId
    ? resolveActiveDriverName_(activeDriverLookup, recommendedDriverUserId, recommendedDriverName)
    : recommendedDriverName;
  const resolvedAssignedDriverName = resolveActiveDriverName_(activeDriverLookup, assignedDriverUserId, assignedDriverName);
  let queueAfterIndex = queueBeforeIndex;
  let queueAfterDriver = queueBeforeDriver;
  let warning = "";
  let state = stateBefore;

  const assignedIndex = queueRows.findIndex((row) => String(row.driver_user_id || "").trim() === assignedDriverUserId);
  if (assignedIndex >= 0) {
    queueAfterIndex = getNextCircularIndex(assignedIndex, queueRows.length);
    queueAfterDriver = queueRows[queueAfterIndex] || null;
    const resolvedNextDriverName = queueAfterDriver
      ? resolveActiveDriverName_(activeDriverLookup, queueAfterDriver.driver_user_id, queueAfterDriver.driver_name || "")
      : "";

    state = setCurrentQueueState_({
      current_index: queueAfterIndex,
      current_driver_user_id: queueAfterDriver ? queueAfterDriver.driver_user_id || "" : "",
      current_driver_name: resolvedNextDriverName,
      last_assigned_driver_user_id: assignedDriverUserId,
      last_assigned_driver_name: resolvedAssignedDriverName,
      last_assigned_booking_id: bookingId,
    }, createdBy || "");
  } else {
    warning = "Assigned driver not found in master queue";
  }

  const logSheet = ensureDriverQueueLogsSheet();
  const logTable = readSheetTable(logSheet);
  const logRow = Array(logTable.headers.length).fill("");
  const now = new Date().toISOString();

  logRow[logTable.columnMap.log_id] = "DQL-" + Date.now();
  logRow[logTable.columnMap.booking_id] = bookingId;
  logRow[logTable.columnMap.booking_no] = bookingNo;
  logRow[logTable.columnMap.recommended_driver_user_id] = recommendedDriverUserId;
  logRow[logTable.columnMap.recommended_driver_name] = resolvedRecommendedDriverName;
  logRow[logTable.columnMap.assigned_driver_user_id] = assignedDriverUserId;
  logRow[logTable.columnMap.assigned_driver_name] = resolvedAssignedDriverName;
  logRow[logTable.columnMap.assign_mode] = assignMode;
  logRow[logTable.columnMap.queue_before_index] = queueBeforeIndex;
  logRow[logTable.columnMap.queue_before_driver_user_id] = queueBeforeDriver ? queueBeforeDriver.driver_user_id || "" : "";
  logRow[logTable.columnMap.queue_after_index] = assignedIndex >= 0 ? queueAfterIndex : queueBeforeIndex;
  logRow[logTable.columnMap.queue_after_driver_user_id] = assignedIndex >= 0
    ? (queueAfterDriver ? queueAfterDriver.driver_user_id || "" : "")
    : (queueBeforeDriver ? queueBeforeDriver.driver_user_id || "" : "");
  logRow[logTable.columnMap.skipped_drivers_json] = Array.isArray(skippedDrivers) ? JSON.stringify(skippedDrivers) : String(skippedDrivers || "");
  logRow[logTable.columnMap.reason] = warning ? `${reason}${reason ? " | " : ""}${warning}` : reason;
  logRow[logTable.columnMap.queue_before] = queueBeforeDriver ? `${resolveActiveDriverName_(activeDriverLookup, queueBeforeDriver.driver_user_id, queueBeforeDriver.driver_name || "")} (#${queueBeforeDriver.queue_order || 0})` : "";
  logRow[logTable.columnMap.queue_after] = assignedIndex >= 0 && queueAfterDriver
    ? `${resolveActiveDriverName_(activeDriverLookup, queueAfterDriver.driver_user_id, queueAfterDriver.driver_name || "")} (#${queueAfterDriver.queue_order || 0})`
    : queueBeforeDriver
      ? `${resolveActiveDriverName_(activeDriverLookup, queueBeforeDriver.driver_user_id, queueBeforeDriver.driver_name || "")} (#${queueBeforeDriver.queue_order || 0})`
      : "";
  logRow[logTable.columnMap.created_at] = now;
  logRow[logTable.columnMap.created_by] = createdBy || "";
  appendSheetRow(logSheet, logRow);

  try {
    createBookingAssignmentNotifications_(booking, {
      assigned_user_id: assignedDriverUserId,
      assigned_user_name: resolvedAssignedDriverName || assignedDriverName,
      previous_assigned_user_id: String(booking.assigned_user_id || "").trim(),
      previous_status: String(booking.status || "").trim(),
      created_by: createdBy || "",
    });
  } catch (notificationErr) {
    console.warn("confirmDriverQueueAssignment notification failed", notificationErr);
  }

  return jsonOutput({
    success: true,
    message: warning ? "Confirm driver queue assignment success with warning" : "Confirm driver queue assignment success",
    data: {
      booking_id: bookingId,
      booking_no: bookingNo,
      recommended_driver_user_id: recommendedDriverUserId,
      recommended_driver_name: resolvedRecommendedDriverName,
      assigned_driver_user_id: assignedDriverUserId,
      assigned_driver_name: resolvedAssignedDriverName,
      assign_mode: assignMode,
      reason,
      queue_before_index: queueBeforeIndex,
      queue_before_driver_user_id: queueBeforeDriver ? queueBeforeDriver.driver_user_id || "" : "",
      queue_after_index: assignedIndex >= 0 ? queueAfterIndex : queueBeforeIndex,
      queue_after_driver_user_id: assignedIndex >= 0
        ? (queueAfterDriver ? queueAfterDriver.driver_user_id || "" : "")
        : (queueBeforeDriver ? queueBeforeDriver.driver_user_id || "" : ""),
      warning,
      state,
    },
    created_notifications: getCreatedNotifications_(),
  });
}

function unassignBookingDriver(data) {
  const bookingId = String(data && data.booking_id || "").trim();
  const reason = String(data && data.reason || "").trim();
  const updatedBy = String(
    data && (data.updated_by || data.created_by || data.staff_name || "")
  ).trim();

  if (!bookingId) {
    return jsonOutput({
      success: false,
      message: "booking_id is required",
    });
  }

  if (!reason) {
    return jsonOutput({
      success: false,
      message: "reason is required",
    });
  }

  if (!updatedBy) {
    return jsonOutput({
      success: false,
      message: "updated_by is required",
    });
  }

  const sheet = ensureBookingsSheet();
  const table = readSheetTable(sheet);
  const headers = table.headers;
  const columnMap = table.columnMap;
  const rowNumber = findRowByBookingId(table, bookingId);

  logBookingAction("unassignBookingDriver", bookingId, rowNumber);

  if (rowNumber <= 1) {
    return jsonOutput({
      success: false,
      message: "Booking not found",
    });
  }

  const rowValues = table.rows[rowNumber - 2].slice();
  const statusCol = columnMap.status;
  const assignedUserIdCol = ensureColumn(sheet, headers, "assigned_user_id");
  const assignedUserNameCol = ensureColumn(sheet, headers, "assigned_user_name");
  const driverUserIdCol = ensureColumn(sheet, headers, "driver_user_id");
  const driverNameCol = ensureColumn(sheet, headers, "driver_name");
  const staffNoteCol = ensureColumn(sheet, headers, "staff_note");
  const updatedAtCol = ensureColumn(sheet, headers, "updated_at");
  const updatedByCol = ensureColumn(sheet, headers, "updated_by");
  const driverCancelRequestStatusCol = columnMap.driver_cancel_request_status !== undefined ? columnMap.driver_cancel_request_status : -1;
  const driverCancelRequestReasonCol = columnMap.driver_cancel_request_reason !== undefined ? columnMap.driver_cancel_request_reason : -1;
  const driverCancelRequestedByCol = columnMap.driver_cancel_requested_by !== undefined ? columnMap.driver_cancel_requested_by : -1;
  const driverCancelReviewStatusCol = columnMap.driver_cancel_review_status !== undefined ? columnMap.driver_cancel_review_status : -1;
  const driverCancelReviewReasonCol = columnMap.driver_cancel_review_reason !== undefined ? columnMap.driver_cancel_review_reason : -1;
  const driverCancelReviewedByCol = columnMap.driver_cancel_reviewed_by !== undefined ? columnMap.driver_cancel_reviewed_by : -1;
  const bookingNoCol = columnMap.booking_no;
  const requesterNameCol = columnMap.requester_name;
  const startDatetimeCol = columnMap.start_datetime;
  const endDatetimeCol = columnMap.end_datetime;
  const destinationCol = columnMap.destination;
  const purposeCol = columnMap.purpose;

  const currentStatus = String(statusCol !== undefined ? rowValues[statusCol] : "").trim().toUpperCase();
  if (currentStatus !== "APPROVED") {
    return jsonOutput({
      success: false,
      message: "อนุญาตให้ดึงงานกลับเฉพาะรายการที่อนุมัติแล้วเท่านั้น",
    });
  }

  const oldDriverUserId = String(
    rowValues[assignedUserIdCol] ||
    rowValues[driverUserIdCol] ||
    ""
  ).trim();
  const oldDriverName = String(
    rowValues[assignedUserNameCol] ||
    rowValues[driverNameCol] ||
    ""
  ).trim();

  rowValues[assignedUserIdCol] = "";
  rowValues[assignedUserNameCol] = "";
  rowValues[driverUserIdCol] = "";
  rowValues[driverNameCol] = "";
  if (driverCancelRequestStatusCol !== -1) rowValues[driverCancelRequestStatusCol] = "";
  if (driverCancelRequestReasonCol !== -1) rowValues[driverCancelRequestReasonCol] = "";
  if (driverCancelRequestedByCol !== -1) rowValues[driverCancelRequestedByCol] = "";
  if (driverCancelReviewStatusCol !== -1) rowValues[driverCancelReviewStatusCol] = "";
  if (driverCancelReviewReasonCol !== -1) rowValues[driverCancelReviewReasonCol] = "";
  if (driverCancelReviewedByCol !== -1) rowValues[driverCancelReviewedByCol] = "";
  if (statusCol !== undefined) {
    rowValues[statusCol] = "PENDING";
  }

  rowValues[staffNoteCol] = appendUniqueNote(rowValues[staffNoteCol], `[ดึงงานกลับ] ${reason}`);
  rowValues[updatedAtCol] = new Date();
  rowValues[updatedByCol] = updatedBy;

  setRowValues(sheet, rowNumber, rowValues);

  const updatedBooking = rowsToObjects(headers, [rowValues])[0] || {};
  appendBookingActivityLog(bookingId, "ดึงงานกลับ", {
    actor_name: updatedBy,
    detail: reason,
    old_driver_user_id: oldDriverUserId,
    old_driver_name: oldDriverName,
    created_at: rowValues[updatedAtCol],
  });

  const logSheet = ensureDriverQueueLogsSheet();
  const logTable = readSheetTable(logSheet);
  const logRow = Array(logTable.headers.length).fill("");
  const now = new Date().toISOString();
  const bookingNo = bookingNoCol !== undefined && bookingNoCol !== -1 ? String(rowValues[bookingNoCol] || "") : "";

  if (logTable.columnMap.log_id !== undefined) logRow[logTable.columnMap.log_id] = "DQL-" + Date.now();
  if (logTable.columnMap.action !== undefined) logRow[logTable.columnMap.action] = "UNASSIGNED";
  if (logTable.columnMap.booking_id !== undefined) logRow[logTable.columnMap.booking_id] = bookingId;
  if (logTable.columnMap.booking_no !== undefined) logRow[logTable.columnMap.booking_no] = bookingNo;
  if (logTable.columnMap.recommended_driver_user_id !== undefined) logRow[logTable.columnMap.recommended_driver_user_id] = "";
  if (logTable.columnMap.recommended_driver_name !== undefined) logRow[logTable.columnMap.recommended_driver_name] = "";
  if (logTable.columnMap.assigned_driver_user_id !== undefined) logRow[logTable.columnMap.assigned_driver_user_id] = "";
  if (logTable.columnMap.assigned_driver_name !== undefined) logRow[logTable.columnMap.assigned_driver_name] = "";
  if (logTable.columnMap.old_driver_user_id !== undefined) logRow[logTable.columnMap.old_driver_user_id] = oldDriverUserId;
  if (logTable.columnMap.old_driver_name !== undefined) logRow[logTable.columnMap.old_driver_name] = oldDriverName;
  if (logTable.columnMap.assign_mode !== undefined) logRow[logTable.columnMap.assign_mode] = "";
  if (logTable.columnMap.reason !== undefined) logRow[logTable.columnMap.reason] = reason;
  if (logTable.columnMap.queue_before_index !== undefined) logRow[logTable.columnMap.queue_before_index] = "";
  if (logTable.columnMap.queue_before_driver_user_id !== undefined) logRow[logTable.columnMap.queue_before_driver_user_id] = "";
  if (logTable.columnMap.queue_after_index !== undefined) logRow[logTable.columnMap.queue_after_index] = "";
  if (logTable.columnMap.queue_after_driver_user_id !== undefined) logRow[logTable.columnMap.queue_after_driver_user_id] = "";
  if (logTable.columnMap.skipped_drivers_json !== undefined) logRow[logTable.columnMap.skipped_drivers_json] = "";
  if (logTable.columnMap.queue_before !== undefined) logRow[logTable.columnMap.queue_before] = "";
  if (logTable.columnMap.queue_after !== undefined) logRow[logTable.columnMap.queue_after] = "";
  if (logTable.columnMap.created_at !== undefined) logRow[logTable.columnMap.created_at] = now;
  if (logTable.columnMap.created_by !== undefined) logRow[logTable.columnMap.created_by] = updatedBy;
  appendSheetRow(logSheet, logRow);

  appendDriverJobLog_(
    createDriverJobLogPayload_({
      booking_id: bookingId,
      booking_no: bookingNo,
      driver_user_id: oldDriverUserId,
      driver_name: oldDriverName,
      action: "UNASSIGNED",
      reason: reason,
      requester_name: requesterNameCol !== undefined && requesterNameCol !== -1 ? rowValues[requesterNameCol] || "" : "",
      start_datetime: startDatetimeCol !== undefined && startDatetimeCol !== -1 ? rowValues[startDatetimeCol] || "" : "",
      end_datetime: endDatetimeCol !== undefined && endDatetimeCol !== -1 ? rowValues[endDatetimeCol] || "" : "",
      destination: destinationCol !== undefined && destinationCol !== -1 ? rowValues[destinationCol] || "" : "",
      purpose: purposeCol !== undefined && purposeCol !== -1 ? rowValues[purposeCol] || "" : "",
      staff_name: updatedBy,
      created_by: updatedBy,
      assigned_by_name: updatedBy,
    })
  );

  try {
    if (oldDriverUserId) {
      createNotification({
        target_user_id: oldDriverUserId,
        target_role: "",
        category: "Approval",
        title: "มีการดึงงานกลับ",
        message: buildNotificationMessageForBooking_(updatedBooking, reason),
        type: "BOOKING_UNASSIGNED",
        booking_id: bookingId,
        url: "/driver-jobs",
        created_by: updatedBy,
      });
    }

    const requesterUserId = resolveRequesterNotificationUserId_(updatedBooking);
    if (requesterUserId) {
      createNotification({
        target_user_id: requesterUserId,
        target_role: "",
        category: "Approval",
        title: "ดึงรายการจองกลับ รออนุมัติใหม่",
        message: `ปลายทาง: ${String(updatedBooking.destination || "").trim() || "-"}`,
        type: "BOOKING_UNASSIGNED_TO_REQUESTER",
        booking_id: bookingId,
        url: "/booking",
        created_by: updatedBy,
        payload_json: buildNotificationPayloadFromBooking_(updatedBooking, {
          reason,
          status: "PENDING",
        }),
      });
    }
  } catch (notificationErr) {
    console.warn("unassignBookingDriver notification failed", notificationErr);
  }

  return jsonOutput({
    success: true,
    message: "Unassign booking driver success",
    data: buildBookingResponseWithActivityData_(updatedBooking),
    created_notifications: getCreatedNotifications_(),
  });
}
function updateDriverQueue(data) {
  return updateDriverQueueMaster(data);
}

function resetDriverQueuePointer(data) {
  return resetDriverQueueState(data);
}
