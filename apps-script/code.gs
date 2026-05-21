function doGet(e) {
  const action = e && e.parameter ? e.parameter.action || "vehicles" : "vehicles";

  if (action === "vehicles") {
    return getVehicles();
  }

  if (action === "bookings") {
    return getBookings();
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
  
  return jsonOutput({
    success: false,
    message: "Invalid action"
  });
}

function doPost(e) {
  try {
    const body = JSON.parse(e && e.postData ? e.postData.contents || "{}" : "{}");
    const action = body.action;

    if (action === "createVehicle") return createVehicle(body.data);
    if (action === "createBooking") return createBooking(body.data);
    if (action === "updateBooking") return updateBooking(body.data);
    if (action === "approveBooking") return approveBooking(body.data);
    if (action === "startTrip") return startTrip(body.data);
    if (action === "completeTrip") return completeTrip(body.data);
    if (action === "backdate_complete_booking") return backdateCompleteBooking(body.data);
    if (action === "driverCancelJob") return driverCancelJob(body.data);
    if (action === "requestDriverCancelJob") return requestDriverCancelJob(body.data);
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
    if (action === "resetDriverQueueState") return resetDriverQueueState(body.data);
    if (action === "resetDriverQueuePointer") return resetDriverQueuePointer(body.data);
    if (action === "setCurrentDriverQueuePointer") return setCurrentDriverQueuePointer(body.data);
    if (action === "recommendDriverForBooking") return recommendDriverForBooking(body.data);
    if (action === "confirmDriverQueueAssignment") return confirmDriverQueueAssignment(body.data);
    if (action === "deleteBookingCancellationHistory" || action === "delete_booking_cancellation_history") return deleteBookingCancellationHistory(body.data || body);
  
    return jsonOutput({
      success: false,
      message: "Invalid action: " + action
    });

  } catch (err) {
    return jsonOutput({
      success: false,
      message: "Apps Script Error",
      error: String(err),
      stack: err && err.stack ? err.stack : ""
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
  return nextRow;
}

function setRowValues(sheet, row, values) {
  sheet.getRange(row, 1, 1, values.length).setValues([values]);
}

function readSheetTable(sheetOrName) {
  const sheet = typeof sheetOrName === "string"
    ? SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetOrName)
    : sheetOrName;

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow === 0 || lastColumn === 0) {
    return {
      sheet,
      headers: [],
      rows: [],
      columnMap: {},
    };
  }

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0] || [];

  return {
    sheet,
    headers,
    rows: lastRow > 1 ? values.slice(1) : [],
    columnMap: buildColumnMap(headers),
  };
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
    "driver_cancel_request_status",
    "driver_cancel_request_reason",
    "driver_cancel_requested_by",
    "driver_cancel_requested_at",
    "driver_cancel_review_status",
    "driver_cancel_review_reason",
    "driver_cancel_reviewed_by",
    "driver_cancel_reviewed_at",
  ];

  if (!sheet) {
    sheet = ss.insertSheet("Bookings");
  }

  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }

  const lastRow = sheet.getLastRow();
  const firstRow = lastRow >= 1
    ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0]
    : [];
  const hasRequiredHeaderRow = headers.every((header, index) => String(firstRow[index] || "").trim() === header);
  const hasLegacyHeaderRow = legacyHeaders.every((header, index) => String(firstRow[index] || "").trim() === header);
  const hasBaseHeaderRow = baseHeaders.every((header, index) => String(firstRow[index] || "").trim() === header);

  if (lastRow === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  if (hasRequiredHeaderRow) {
    return sheet;
  }

  if (hasBaseHeaderRow) {
    if (sheet.getMaxColumns() < headers.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
    }

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  if (hasLegacyHeaderRow) {
    if (sheet.getMaxColumns() < headers.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
    }

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  if (!hasRequiredHeaderRow) {
    throw new Error("Bookings sheet header row is invalid");
  }

  return sheet;
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
  Logger.log(JSON.stringify({
    action: actionName,
    booking_id: bookingId || "",
    matched_row: row || -1,
  }));
}

function normalizeDriverCancelDecision_(decision) {
  return String(decision || "").trim().toUpperCase();
}

function applyDriverCancelResolution_(sheet, table, row, data, options) {
  const headers = table.headers;
  const columnMap = table.columnMap;
  const now = options && options.now ? options.now : new Date();
  const reason = String(data.reason || options.reason || "").trim();
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
  const staffNote = "คนขับยกเลิกงานโดย " + noteActor + ": " + reason;

  const rowValues = table.rows[row - 2].slice();
  rowValues[vehicleIdCol] = "";
  rowValues[vehicleNameCol] = "";
  rowValues[vehicleCodeCol] = "";
  rowValues[vehiclePlateCol] = "";
  rowValues[assignedUserIdCol] = "";
  rowValues[assignedUserNameCol] = "";
  rowValues[staffNoteCol] = staffNote;
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
  data.forEach((obj) => {
    applyAssignedUserFallback(obj, userLookup);
  });

  return jsonOutput({
    success: true,
    total: data.length,
    data: data
  });
}

function createBooking(data) {
  try {
    data = data || {};
    Logger.log("createBooking received data: " + JSON.stringify(data || {}));

    const sheet = ensureBookingsSheet();
    Logger.log("createBooking target sheet name: " + sheet.getName());

    const now = new Date();
    const table = readSheetTable(sheet);
    const { headers } = table;

    const bookingIdCol = ensureColumn(sheet, headers, "booking_id");
    const bookingNoCol = ensureColumn(sheet, headers, "booking_no");
    const requesterNameCol = ensureColumn(sheet, headers, "requester_name");
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
    const createdAtCol = ensureColumn(sheet, headers, "created_at");
    const updatedAtCol = ensureColumn(sheet, headers, "updated_at");
    const isBackdatedCol = ensureColumn(sheet, headers, "is_backdated");
    const backdatedCompletedAtCol = ensureColumn(sheet, headers, "backdated_completed_at");
    const backdatedCompletedByCol = ensureColumn(sheet, headers, "backdated_completed_by");

    const bookingNumber = getNextBookingSequence(table, bookingIdCol);
    const bookingId = "BK" + Utilities.formatString("%04d", bookingNumber);
    const bookingNo = "ODC-CAR-" + Utilities.formatString("%04d", bookingNumber);
    Logger.log("createBooking generated booking_id: " + bookingId);
    Logger.log("createBooking generated booking_no: " + bookingNo);

    const bookingRow = Array(headers.length).fill("");
    bookingRow[bookingIdCol] = bookingId;
    bookingRow[bookingNoCol] = bookingNo;
    bookingRow[requesterNameCol] = data.requester_name || "";
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
    bookingRow[createdAtCol] = now;
    bookingRow[updatedAtCol] = now;
    bookingRow[isBackdatedCol] = String(data.is_backdated || "").trim().toUpperCase() === "TRUE" ? "TRUE" : "FALSE";
    bookingRow[backdatedCompletedAtCol] = "";
    bookingRow[backdatedCompletedByCol] = "";

    const row = appendSheetRow(sheet, bookingRow);
    Logger.log("createBooking final appended row: " + row);

    if (row <= 1) {
      logBookingAction("createBooking", bookingId, row);
      throw new Error("Bookings header missing or wrong sheet");
    }

    logBookingAction("createBooking", bookingId, row);

    return jsonOutput({
      success: true,
      message: "Create booking success",
      data: {
        ...data,
        booking_id: bookingId,
        booking_no: bookingNo,
        status: "PENDING",
        assigned_user_id: data.assigned_user_id || "",
        assigned_user_name: data.assigned_user_name || "",
        is_backdated: bookingRow[isBackdatedCol],
      }
    });
  } catch (err) {
    Logger.log("createBooking error: " + String(err && err.stack ? err.stack : err));
    return jsonOutput({ success: false, message: String(err.message || err) });
  }
}

function updateBooking(data) {
  const sheet = ensureBookingsSheet();
  const table = readSheetTable(sheet);
  const headers = table.headers;
  const columnMap = table.columnMap;
  ensureTextColumn_(sheet, headers, "phone");

  const editableFields = [
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

  if (!data.booking_id) {
    return jsonOutput({ success: false, message: "booking_id is required" });
  }

  const row = findRowByBookingId(table, data.booking_id);
  logBookingAction("updateBooking", data.booking_id, row);
  if (row <= 1) {
    return jsonOutput({ success: false, message: "Booking not found" });
  }

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

  if (updatedAtCol !== undefined) {
    rowValues[updatedAtCol] = new Date();
  }
  setRowValues(sheet, row, rowValues);

  return jsonOutput({
    success: true,
    message: "Update booking success",
    data: {
      booking_id: data.booking_id
    }
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
    end_datetime: values[currentRow][endCol]
  };

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

  const driverUnavailableConflict = getDriverUnavailableConflict(
    data.assigned_user_id || data.driver_id || "",
    currentBooking.start_datetime,
    currentBooking.end_datetime,
    ""
  );

  if (driverUnavailableConflict) {
    return jsonOutput({
      success: false,
      message: "มีช่วงวันไม่รับงานทับกับรายการนี้",
    });
  }

  const rowValues = table.rows[row - 2].slice();
  rowValues[vehicleIdCol] = data.vehicle_id || "";
  rowValues[assignedUserIdCol] = data.assigned_user_id || data.driver_id || "";
  rowValues[assignedUserNameCol] = data.assigned_user_name || data.driver_name || "";
  rowValues[statusCol] = "APPROVED";
  rowValues[staffNoteCol] = data.staff_note || "";
  rowValues[updatedAtCol] = new Date();
  setRowValues(sheet, row, rowValues);

  const currentUserName = String(
    data.current_user_name || data.created_by || data.updated_by || data.staff_name || ""
  ).trim();
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
  }

  return jsonOutput({
    success: true,
    message: "Approve booking success",
    data: {
      booking_id: values[currentRow][bookingIdCol],
      booking_no: bookingNoCol !== -1 ? values[currentRow][bookingNoCol] : "",
      vehicle_id: data.vehicle_id || "",
      assigned_user_id: data.assigned_user_id || data.driver_id || "",
      assigned_user_name: data.assigned_user_name || data.driver_name || "",
      status: "APPROVED"
    }
  });
}
function startTrip(data) {
  const bookingSheet = ensureBookingsSheet();
  const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("VehicleLogs");

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
    }
  });
}

function completeTrip(data) {
  const bookingSheet = ensureBookingsSheet();
  const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("VehicleLogs");

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

      return jsonOutput({
        success: true,
        message: "Complete trip success",
        data: {
          booking_id: data.booking_id,
          status: "COMPLETED",
          actual_return_datetime: actualReturnDatetime,
          actual_return_by: actualReturnBy,
          updated_at: new Date().toISOString()
        }
      });
    }
  }

  return jsonOutput({ success: false, message: "Vehicle log not found" });
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
  const note = String(data.staff_note || "").trim();

  const rowValues = table.rows[row - 2].slice();
  rowValues[assignedUserIdCol] = assignedUserId;
  rowValues[assignedUserNameCol] = assignedUserName;
  rowValues[vehicleIdCol] = vehicleId;
  rowValues[actualStartDatetimeCol] = data.actual_start_datetime || "-";
  rowValues[actualReturnDatetimeCol] = data.actual_return_datetime || "-";
  rowValues[actualStartByCol] = data.actual_start_by || actor;
  rowValues[actualReturnByCol] = data.actual_return_by || actor;
  rowValues[statusCol] = "COMPLETED";
  rowValues[staffNoteCol] = note;
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

  return jsonOutput({
    success: true,
    message: "Backdate complete booking success",
    data: {
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
      staff_note: note,
      is_backdated: "TRUE",
      backdated_completed_at: rowValues[backdatedCompletedAtCol] || now.toISOString(),
      backdated_completed_by: rowValues[backdatedCompletedByCol] || actor,
      updated_at: now.toISOString(),
      updated_by: rowValues[updatedByCol] || actor,
    },
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

  const reason = String(data.reason || "").trim();
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
  const requestedAtCol = ensureColumn(sheet, headers, "driver_cancel_requested_at");
  const reviewStatusCol = ensureColumn(sheet, headers, "driver_cancel_review_status");
  const reviewReasonCol = ensureColumn(sheet, headers, "driver_cancel_review_reason");
  const reviewedByCol = ensureColumn(sheet, headers, "driver_cancel_reviewed_by");
  const reviewedAtCol = ensureColumn(sheet, headers, "driver_cancel_reviewed_at");

  const rowValues = table.rows[row - 2].slice();
  rowValues[requestStatusCol] = "PENDING";
  rowValues[requestReasonCol] = reason;
  rowValues[requestedByCol] = requestedBy;
  rowValues[requestedAtCol] = now;
  rowValues[reviewStatusCol] = "";
  rowValues[reviewReasonCol] = "";
  rowValues[reviewedByCol] = "";
  rowValues[reviewedAtCol] = "";
  rowValues[columnMap.updated_at] = now;
  setRowValues(sheet, row, rowValues);

  const currentBooking = rowsToObjects(headers, [rowValues])[0] || {};

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

  return jsonOutput({
    success: true,
    message: "Driver cancel request created",
    data: {
      ...currentBooking,
      driver_cancel_request_status: "PENDING",
      driver_cancel_request_reason: reason,
      driver_cancel_requested_by: requestedBy,
      driver_cancel_requested_at: now.toISOString(),
      driver_cancel_review_status: "",
      driver_cancel_review_reason: "",
      driver_cancel_reviewed_by: "",
      driver_cancel_reviewed_at: "",
      updated_at: now.toISOString(),
    },
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
  const reviewReason = String(data.review_reason || "").trim();
  const now = new Date();

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
    return jsonOutput({
      success: true,
      message: "Driver cancel request approved",
      data: {
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
      },
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

  return jsonOutput({
    success: true,
    message: "Driver cancel request rejected",
    data: {
      ...currentBooking,
      driver_cancel_request_status: "REJECTED",
      driver_cancel_review_status: "REJECTED",
      driver_cancel_review_reason: reviewReason,
      driver_cancel_reviewed_by: reviewedBy,
      driver_cancel_reviewed_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
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
  const reason = String(data.reason || "").trim();
  const cancelledBy = String(data.cancelled_by || data.cancelled_by_name || "").trim();
  const booking = values[row - 1];

  const rowValues = table.rows[row - 2].slice();
  rowValues[statusCol] = "CANCELLED";
  rowValues[staffNoteCol] = reason;
  rowValues[updatedAtCol] = now;
  setRowValues(sheet, row, rowValues);

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

  return jsonOutput({
    success: true,
    message: "Cancel booking success",
    data: {
      booking_id: data.booking_id,
      status: "CANCELLED",
      reason,
      cancelled_by: cancelledBy,
    }
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
  const statusCol = headers.indexOf("status");

  const user = rows.find(row => {
    return (
      String(row[emailCol]).trim() === String(data.email).trim() &&
      String(row[passwordCol]).trim() === String(data.password).trim() &&
      String(row[statusCol]).trim().toUpperCase() === "ACTIVE"
    );
  });

  if (!user) {
    return jsonOutput({
      success: false,
      message: "Email หรือ Password ไม่ถูกต้อง"
    });
  }

  let obj = {};

  headers.forEach((header, index) => {
    obj[header] = user[index];
  });

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

  return jsonOutput({
    success: true,
    message: "Update driver unavailable success",
    data: newValue,
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

  return jsonOutput({
    success: true,
    message: "Cancel driver unavailable success",
    data: newValue,
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

  return jsonOutput({
    success: true,
    total: rows.length,
    data: rowsToObjects(headers, rows),
  });
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
  const now = new Date();
  const userId = "U" + Utilities.formatString("%03d", sheet.getLastRow());

  const row = headers.map((header) => {
    if (header === "user_id") return userId;
    if (header === "name") return data.name || "";
    if (header === "email") return data.email || "";
    if (header === "password") return data.password || "1234";
    if (header === "department") return data.department || "";
    if (header === "phone") return data.phone || "";
    if (header === "role") return data.role || "USER";
    if (header === "status") return data.status || "ACTIVE";
    if (header === "created_at") return now;
    if (header === "updated_at") return now;
    return "";
  });

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
  const passwordCol = headers.indexOf("password");
  const updatedAtCol = headers.indexOf("updated_at");

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][userIdCol] === data.user_id) {
      const row = i + 2;

      sheet.getRange(row, passwordCol + 1).setValue(data.password || "1234");
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
  "booking_id",
  "booking_no",
  "recommended_driver_user_id",
  "recommended_driver_name",
  "assigned_driver_user_id",
  "assigned_driver_name",
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

function appendDriverQueueStateRow_(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DriverQueueState") || ensureDriverQueueStateSheet();
  const table = readSheetTable(sheet);
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
  return appendSheetRow(sheet, row);
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
      const displayDriverName =
        driverUser && driverUser.role === "DRIVER" && driverUser.status === "ACTIVE"
          ? String(driverUser.name || "").trim() || storedDriverName
          : storedDriverName;
      const driverStatus = driverUser ||
        userLookup.byName.get(storedDriverName.toLowerCase()) ||
        null;
      return {
        row_number: index + 2,
        queue_id: row.queue_id || `DQ-${queueOrder}`,
        driver_user_id: driverUserId,
        driver_name: displayDriverName || storedDriverName,
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

function getDriverIndexInMasterQueue(driverUserId) {
  const normalized = String(driverUserId || "").trim();
  if (!normalized) return -1;
  return getActiveMasterQueue().findIndex((row) => String(row.driver_user_id || "").trim() === normalized);
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

function resolveCurrentIndexFromLegacyPointer_(queueRows, legacyValue) {
  if (!queueRows.length) return 0;
  const sorted = [...queueRows].sort((a, b) => Number(a.queue_order || 0) - Number(b.queue_order || 0));
  const pointer = Number(legacyValue || 0) || 0;
  const nextIndex = sorted.findIndex((row) => Number(row.queue_order || 0) > pointer);
  if (nextIndex === -1) return 0;
  const nextDriver = sorted[nextIndex];
  const actualIndex = queueRows.findIndex((row) => String(row.driver_user_id || "") === String(nextDriver.driver_user_id || ""));
  return actualIndex >= 0 ? actualIndex : nextIndex;
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
  logRow[logTable.columnMap.booking_id] = bookingId;
  logRow[logTable.columnMap.booking_no] = bookingNo;
  logRow[logTable.columnMap.recommended_driver_user_id] = recommendedDriverUserId;
  logRow[logTable.columnMap.recommended_driver_name] = resolvedRecommendedDriverName;
  logRow[logTable.columnMap.assigned_driver_user_id] = assignedDriverUserId;
  logRow[logTable.columnMap.assigned_driver_name] = resolvedAssignedDriverName;
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

function appendDriverQueueStateRow_(payload) {
  const sheet = ensureDriverQueueStateSheet();
  const table = readSheetTable(sheet);
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
  return appendSheetRow(sheet, row);
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

function getDriverIndexInMasterQueue(driverUserId) {
  const normalized = String(driverUserId || "").trim();
  if (!normalized) return -1;
  return getActiveMasterQueue().findIndex((row) => String(row.driver_user_id || "").trim() === normalized);
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

function resolveCurrentIndexFromLegacyPointer_(queueRows, legacyValue) {
  if (!queueRows.length) return 0;
  const sorted = [...queueRows].sort((a, b) => Number(a.queue_order || 0) - Number(b.queue_order || 0));
  const pointer = Number(legacyValue || 0) || 0;
  const nextIndex = sorted.findIndex((row) => Number(row.queue_order || 0) > pointer);
  if (nextIndex === -1) return 0;
  const nextDriver = sorted[nextIndex];
  const actualIndex = queueRows.findIndex((row) => String(row.driver_user_id || "") === String(nextDriver.driver_user_id || ""));
  return actualIndex >= 0 ? actualIndex : nextIndex;
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
        reason: "มีงานทับช่วงเวลานี้",
      });
      return;
    }

    const unavailableConflict = getDriverUnavailableConflict(row.driver_user_id, startDatetime, endDatetime, "");
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
    last_assigned_driver_name: assignedDriverName,
    last_assigned_booking_id: bookingId,
  }, createdBy || "");

  const logSheet = ensureDriverQueueLogsSheet();
  const logTable = readSheetTable(logSheet);
  const logRow = Array(logTable.headers.length).fill("");
  const now = new Date().toISOString();

  logRow[logTable.columnMap.log_id] = "DQL-" + Date.now();
  logRow[logTable.columnMap.booking_id] = bookingId;
  logRow[logTable.columnMap.booking_no] = bookingNo;
  logRow[logTable.columnMap.recommended_driver_user_id] = recommendedDriverUserId;
  logRow[logTable.columnMap.recommended_driver_name] = recommendedDriverName;
  logRow[logTable.columnMap.assigned_driver_user_id] = assignedDriverUserId;
  logRow[logTable.columnMap.assigned_driver_name] = assignedDriverName;
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

  return jsonOutput({
    success: true,
    message: warning ? "Confirm driver queue assignment success with warning" : "Confirm driver queue assignment success",
    data: {
      booking_id: bookingId,
      booking_no: bookingNo,
      recommended_driver_user_id: recommendedDriverUserId,
      recommended_driver_name: recommendedDriverName,
      assigned_driver_user_id: assignedDriverUserId,
      assigned_driver_name: assignedDriverName,
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
