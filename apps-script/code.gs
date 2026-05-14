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
    if (action === "driverCancelJob") return driverCancelJob(body.data);
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
    if (action === "deleteBookingCancellationHistory") return deleteBookingCancellationHistory(body.data);
  
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

  const headers = [
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
  const hasHeaderRow = headers.every((header, index) => String(firstRow[index] || "").trim() === header);

  if (lastRow === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  if (!hasHeaderRow) {
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
        assigned_user_name: data.assigned_user_name || ""
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
      rowValues[col] = field === "phone" ? normalizePhone_(data[field]) : data[field];
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

  if (!data.vehicle_id) {
    return jsonOutput({
      success: false,
      message: "vehicle_id is required"
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
    vehicle_id: data.vehicle_id,
    start_datetime: values[currentRow][startCol],
    end_datetime: values[currentRow][endCol]
  };

  const availability = checkVehicleAvailability(currentBooking, table);

  if (!availability.available) {
    return jsonOutput({
      success: false,
      message: availability.message,
      conflict_booking_no: availability.conflict_booking_no
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

  const bookingRowValues = table.rows[row - 2].slice();
  bookingRowValues[statusCol] = "IN_USE";
  bookingRowValues[updatedAtCol] = now;
  setRowValues(bookingSheet, row, bookingRowValues);

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
  const assignedUserId = currentBooking.assigned_user_id || data.assigned_user_id || "";
  const assignedUserName = currentBooking.assigned_user_name || data.assigned_user_name || "";

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
  bookingRowValues[updatedAtCol] = new Date();
  setRowValues(bookingSheet, bookingRow, bookingRowValues);

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
          status: "COMPLETED"
        }
      });
    }
  }

  return jsonOutput({ success: false, message: "Vehicle log not found" });
}

function driverCancelJob(data) {
  const sheet = ensureBookingsSheet();

  const table = readSheetTable(sheet);
  const headers = table.headers;
  const columnMap = table.columnMap;

  const statusCol = columnMap.status;
  const assignedUserIdCol = ensureColumn(sheet, headers, "assigned_user_id");
  const assignedUserNameCol = ensureColumn(sheet, headers, "assigned_user_name");
  const staffNoteCol = ensureColumn(sheet, headers, "staff_note");
  const updatedAtCol = columnMap.updated_at;

  if (!data.booking_id) {
    return jsonOutput({
      success: false,
      message: "booking_id is required"
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

  sheet.getRange(row, assignedUserIdCol + 1).setValue("");
  sheet.getRange(row, assignedUserNameCol + 1).setValue("");
  sheet.getRange(row, staffNoteCol + 1).setValue("คนขับยกเลิกงานนี้แล้ว");
  sheet.getRange(row, statusCol + 1).setValue("APPROVED");
  sheet.getRange(row, updatedAtCol + 1).setValue(now);

  return jsonOutput({
    success: true,
    message: "Driver cancel job success",
    data: {
      booking_id: data.booking_id,
      status: "APPROVED",
      staff_note: "คนขับยกเลิกงานนี้แล้ว"
    }
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
  let sheet = ss.getSheetByName("BookingCancellations");

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
    sheet = ss.insertSheet("BookingCancellations");
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

  const data = rowsToObjects(headers, rows).map((obj) => ({
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

  const cancellationIdCol = headers.indexOf("cancellation_id");

  if (!data.cancellation_id) {
    return jsonOutput({
      success: false,
      message: "cancellation_id is required"
    });
  }

  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][cancellationIdCol]) === String(data.cancellation_id)) {
      sheet.deleteRow(i + 2);

      return jsonOutput({
        success: true,
        message: "Delete cancellation history success"
      });
    }
  }

  return jsonOutput({
    success: false,
    message: "Cancellation history not found"
  });
}

// Attach this function to a monthly time-driven trigger in Apps Script.
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
