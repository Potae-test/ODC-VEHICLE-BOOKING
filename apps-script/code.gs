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
    if (action === "approveBooking") return approveBooking(body.data);
    if (action === "startTrip") return startTrip(body.data);
    if (action === "completeTrip") return completeTrip(body.data);
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

  const data = rowsToObjects(headers, rows);

  return jsonOutput({
    success: true,
    total: data.length,
    data: data
  });
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

  sheet.appendRow([
    vehicleId,
    data.vehicle_code || "",
    data.vehicle_type || "",
    data.plate_no || "",
    data.status || "AVAILABLE",
    data.driver_name || "-",
    data.next_booking || "-",
  ]);

  return jsonOutput({
    success: true,
    message: "Create vehicle success",
    data: {
      vehicle_id: vehicleId,
      ...data
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

function readSheetTable(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn === 0) {
    return {
      headers: [],
      rows: [],
    };
  }

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();

  return {
    headers: values[0] || [],
    rows: values.slice(1),
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

function getBookings() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Bookings");

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

function createBooking(data) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Bookings");

  const now = new Date();
  const rowNo = sheet.getLastRow();

  const bookingId = "BK" + Utilities.formatString("%04d", rowNo);
  const bookingNo = "ODC-CAR-" + Utilities.formatString("%04d", rowNo);

  sheet.appendRow([
    bookingId,
    bookingNo,
    data.requester_name || "",
    data.department || "",
    data.phone || "",
    data.start_datetime || "",
    data.end_datetime || "",
    data.destination || "",
    data.purpose || "",
    data.vehicle_type_request || "",
    data.vehicle_id || "",
    data.driver_name || "",
    "PENDING",
    "",
    now,
    now
  ]);

  return jsonOutput({
    success: true,
    message: "Create booking success",
    data: {
      booking_id: bookingId,
      booking_no: bookingNo,
      status: "PENDING",
      ...data
    }
  });
}
function approveBooking(data) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Bookings");

  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  const bookingIdCol = headers.indexOf("booking_id");
  const vehicleIdCol = headers.indexOf("vehicle_id");
  const driverIdCol = ensureColumn(sheet, headers, "driver_id");
  const driverNameCol = headers.indexOf("driver_name");
  const statusCol = headers.indexOf("status");
  const staffNoteCol = headers.indexOf("staff_note");
  const updatedAtCol = headers.indexOf("updated_at");
  const startCol = headers.indexOf("start_datetime");
  const endCol = headers.indexOf("end_datetime");

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

  for (let i = 1; i < values.length; i++) {
    if (values[i][bookingIdCol] === data.booking_id) {
      const row = i + 1;

      const currentBooking = {
        booking_id: data.booking_id,
        vehicle_id: data.vehicle_id,
        start_datetime: values[i][startCol],
        end_datetime: values[i][endCol]
      };

      const availability = checkVehicleAvailability(currentBooking);

      if (!availability.available) {
        return jsonOutput({
          success: false,
          message: availability.message,
          conflict_booking_no: availability.conflict_booking_no
        });
      }

      sheet.getRange(row, vehicleIdCol + 1).setValue(data.vehicle_id || "");
      sheet.getRange(row, driverIdCol + 1).setValue(data.driver_id || "");
      sheet.getRange(row, driverNameCol + 1).setValue(data.driver_name || "");
      sheet.getRange(row, statusCol + 1).setValue("APPROVED");
      sheet.getRange(row, staffNoteCol + 1).setValue(data.staff_note || "");
      sheet.getRange(row, updatedAtCol + 1).setValue(new Date());

      return jsonOutput({
        success: true,
        message: "Approve booking success",
        data: {
          booking_id: data.booking_id,
          vehicle_id: data.vehicle_id || "",
          driver_id: data.driver_id || "",
          driver_name: data.driver_name || "",
          status: "APPROVED"
        }
      });
    }
  }

  return jsonOutput({
    success: false,
    message: "Booking not found"
  });
}
function startTrip(data) {
  const bookingSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Bookings");
  const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("VehicleLogs");

  const values = bookingSheet.getDataRange().getValues();
  const headers = values[0];

  const bookingIdCol = headers.indexOf("booking_id");
  const statusCol = headers.indexOf("status");
  const vehicleIdCol = headers.indexOf("vehicle_id");
  const driverNameCol = headers.indexOf("driver_name");
  const updatedAtCol = headers.indexOf("updated_at");

  if (!data.booking_id) {
    return jsonOutput({ success: false, message: "booking_id is required" });
  }

  for (let i = 1; i < values.length; i++) {
    if (values[i][bookingIdCol] === data.booking_id) {
      const row = i + 1;
      const now = new Date();

      bookingSheet.getRange(row, statusCol + 1).setValue("IN_USE");
      bookingSheet.getRange(row, updatedAtCol + 1).setValue(now);

      const logId = "LOG" + Utilities.formatString("%04d", logSheet.getLastRow());

      logSheet.appendRow([
        logId,
        data.booking_id,
        values[i][vehicleIdCol],
        values[i][driverNameCol],
        data.out_time || now,
        data.out_mileage || "",
        "",
        "",
        data.remark || "",
        now,
        now
      ]);

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
  }

  return jsonOutput({ success: false, message: "Booking not found" });
}

function completeTrip(data) {
  const bookingSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Bookings");
  const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("VehicleLogs");

  const bookingValues = bookingSheet.getDataRange().getValues();
  const bookingHeaders = bookingValues[0];

  const bookingIdCol = bookingHeaders.indexOf("booking_id");
  const statusCol = bookingHeaders.indexOf("status");
  const updatedAtCol = bookingHeaders.indexOf("updated_at");

  const logValues = logSheet.getDataRange().getValues();
  const logHeaders = logValues[0];

  const logBookingIdCol = logHeaders.indexOf("booking_id");
  const inTimeCol = logHeaders.indexOf("in_time");
  const inMileageCol = logHeaders.indexOf("in_mileage");
  const remarkCol = logHeaders.indexOf("remark");
  const logUpdatedAtCol = logHeaders.indexOf("updated_at");

  if (!data.booking_id) {
    return jsonOutput({ success: false, message: "booking_id is required" });
  }

  for (let i = 1; i < bookingValues.length; i++) {
    if (bookingValues[i][bookingIdCol] === data.booking_id) {
      const row = i + 1;
      bookingSheet.getRange(row, statusCol + 1).setValue("COMPLETED");
      bookingSheet.getRange(row, updatedAtCol + 1).setValue(new Date());
      break;
    }
  }

  for (let i = logValues.length - 1; i >= 1; i--) {
    if (logValues[i][logBookingIdCol] === data.booking_id) {
      const row = i + 1;
      const now = new Date();

      logSheet.getRange(row, inTimeCol + 1).setValue(data.in_time || now);
      logSheet.getRange(row, inMileageCol + 1).setValue(data.in_mileage || "");
      logSheet.getRange(row, remarkCol + 1).setValue(data.remark || logValues[i][remarkCol] || "");
      logSheet.getRange(row, logUpdatedAtCol + 1).setValue(now);

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
function cancelBooking(data) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Bookings");

  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  const bookingIdCol = headers.indexOf("booking_id");
  const bookingNoCol = headers.indexOf("booking_no");
  const requesterNameCol = headers.indexOf("requester_name");
  const departmentCol = headers.indexOf("department");
  const phoneCol = headers.indexOf("phone");
  const startCol = headers.indexOf("start_datetime");
  const endCol = headers.indexOf("end_datetime");
  const destinationCol = headers.indexOf("destination");
  const purposeCol = headers.indexOf("purpose");
  const vehicleTypeRequestCol = headers.indexOf("vehicle_type_request");
  const vehicleIdCol = headers.indexOf("vehicle_id");
  const driverIdCol = ensureColumn(sheet, headers, "driver_id");
  const driverNameCol = headers.indexOf("driver_name");
  const statusCol = headers.indexOf("status");
  const staffNoteCol = headers.indexOf("staff_note");
  const updatedAtCol = headers.indexOf("updated_at");

  if (!data.booking_id) {
    return jsonOutput({
      success: false,
      message: "booking_id is required"
    });
  }

  for (let i = 1; i < values.length; i++) {
    if (values[i][bookingIdCol] === data.booking_id) {
      const row = i + 1;
      const now = new Date();
      const reason = String(data.reason || "").trim();
      const cancelledBy = String(data.cancelled_by || data.cancelled_by_name || "").trim();
      const booking = values[i];

      sheet.getRange(row, statusCol + 1).setValue("CANCELLED");
      sheet.getRange(row, staffNoteCol + 1).setValue(reason);
      sheet.getRange(row, updatedAtCol + 1).setValue(now);

      const historySheet = ensureCancellationHistorySheet();
      const historyHeaders = historySheet.getDataRange().getValues()[0] || [];
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
      setHistoryValue(historyHeaders, historyRow, "driver_id", booking[driverIdCol]);
      setHistoryValue(historyHeaders, historyRow, "driver_name", booking[driverNameCol]);
      setHistoryValue(historyHeaders, historyRow, "reason", reason);
      setHistoryValue(historyHeaders, historyRow, "cancelled_by", cancelledBy);
      setHistoryValue(historyHeaders, historyRow, "cancelled_at", now);
      setHistoryValue(historyHeaders, historyRow, "status", "CANCELLED");
      setHistoryValue(historyHeaders, historyRow, "updated_at", now);

      historySheet.appendRow(historyRow);

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
  }

  return jsonOutput({
    success: false,
    message: "Booking not found"
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
    "driver_id",
    "driver_name",
    "reason",
    "cancelled_by",
    "cancelled_at",
    "status",
    "updated_at",
  ];

  if (!sheet) {
    sheet = ss.insertSheet("BookingCancellations");
    sheet.appendRow(headers);
    return sheet;
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
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

  const data = rowsToObjects(headers, rows);

  return jsonOutput({
    success: true,
    total: data.length,
    data: data
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

function checkVehicleAvailability(data) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Bookings");

  const { headers, rows } = readSheetTable(sheet);

  const bookingIdCol = headers.indexOf("booking_id");
  const vehicleIdCol = headers.indexOf("vehicle_id");
  const startCol = headers.indexOf("start_datetime");
  const endCol = headers.indexOf("end_datetime");
  const statusCol = headers.indexOf("status");
  const bookingNoCol = headers.indexOf("booking_no");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    const isSameBooking = row[bookingIdCol] === data.booking_id;
    const isSameVehicle = row[vehicleIdCol] === data.vehicle_id;
    const activeStatus = ["APPROVED", "IN_USE"].includes(row[statusCol]);

    if (!isSameBooking && isSameVehicle && activeStatus) {
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

  sheet.appendRow([
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

  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  const driverIdCol = headers.indexOf("driver_id");
  const statusCol = headers.indexOf("status");
  const remarkCol = headers.indexOf("remark");
  const updatedAtCol = headers.indexOf("updated_at");

  for (let i = 1; i < values.length; i++) {
    if (values[i][driverIdCol] === data.driver_id) {
      const row = i + 1;

      sheet.getRange(row, statusCol + 1).setValue(data.status);
      sheet.getRange(row, remarkCol + 1).setValue(data.remark || "");
      sheet.getRange(row, updatedAtCol + 1).setValue(new Date());

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

  const data = rowsToObjects(headers, rows).map((obj) => ({
    ...obj,
    password: "********",
  }));

  return jsonOutput({ success: true, total: data.length, data });
}

function createUser(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  const now = new Date();
  const userId = "U" + Utilities.formatString("%03d", sheet.getLastRow());

  sheet.appendRow([
    userId,
    data.name || "",
    data.email || "",
    data.password || "1234",
    data.department || "",
    data.phone || "",
    data.role || "USER",
    data.status || "ACTIVE",
    now,
    now
  ]);

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
      const row = i + 1;

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
      const row = i + 1;

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
      const row = i + 1;

      headers.forEach((header, index) => {
        if (data[header] !== undefined && header !== "vehicle_id") {
          sheet.getRange(row, index + 1).setValue(data[header]);
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

      sheet.deleteRow(i + 1);

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
      sheet.getRange(i + 1, statusCol + 1).setValue("INACTIVE");

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
      sheet.deleteRow(i + 1);

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
      const row = i + 1;

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
      sheet.deleteRow(i + 1);

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
