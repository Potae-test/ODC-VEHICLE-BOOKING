import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  approveBooking,
  cancelBooking,
  createBooking,
  getBookings,
  getVehicles,
  getUsers,
  updateBooking,
} from "../api";
import { formatThaiDateTime } from "../utils/date";
import { showError, showSuccess } from "../utils/alert";
import { hasPermission } from "../permissions";

const ROWS_PER_PAGE = 5;

const STATUS_META = {
  PENDING: {
    label: "รออนุมัติ",
    className: "amber",
    help: "รายการที่ผู้จองส่งเข้ามาและรอเจ้าหน้าที่พิจารณา",
  },
  APPROVED: {
    label: "อนุมัติแล้ว",
    className: "blue",
    help: "รายการที่ได้รับอนุมัติและรอเริ่มใช้งาน",
  },
  IN_USE: {
    label: "กำลังใช้งาน",
    className: "green",
    help: "รถและคนขับกำลังปฏิบัติงานตามรายการนี้",
  },
  COMPLETED: {
    label: "เสร็จสิ้น",
    className: "gray",
    help: "รายการที่ปิดงานเรียบร้อยแล้ว",
  },
  CANCELLED: {
    label: "ยกเลิกแล้ว",
    className: "red",
    help: "รายการที่ถูกยกเลิกและบันทึกลงประวัติการยกเลิก",
  },
};

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function normalizeVehicleStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "MAINTENANCE" || normalized === "INACTIVE") return "UNAVAILABLE";
  if (normalized === "IN_USE") return "IN_USE";
  if (normalized === "UNAVAILABLE") return "UNAVAILABLE";
  return "AVAILABLE";
}

function getStatusMeta(status) {
  return STATUS_META[normalizeStatus(status)] || {
    label: status || "-",
    className: "gray",
    help: "สถานะรายการจอง",
  };
}

function sortLatestFirst(items) {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.created_at || a.updated_at || a.start_datetime).getTime();
    const dateB = new Date(b.created_at || b.updated_at || b.start_datetime).getTime();
    return dateB - dateA;
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("odc_user") || "null");
  } catch {
    return null;
  }
}

function toDateTimeLocalValue(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 16);
  }

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function isTimeOverlap(startA, endA, startB, endB) {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();

  return aStart < bEnd && bStart < aEnd;
}

function groupActiveBookings(bookings) {
  const byVehicleId = new Map();
  const byAssignedUserId = new Map();
  const byAssignedUserName = new Map();
  const inUseVehicleIds = new Set();
  const overlapCandidates = [];

  bookings.forEach((booking) => {
    const status = normalizeStatus(booking.status);

    if (status === "COMPLETED" || status === "CANCELLED") {
      return;
    }

    if (status !== "IN_USE") {
      overlapCandidates.push(booking);
    }

    if (status !== "APPROVED" && status !== "IN_USE") {
      return;
    }

    const vehicleId = String(booking.vehicle_id || "").trim();
    if (vehicleId) {
      if (!byVehicleId.has(vehicleId)) byVehicleId.set(vehicleId, []);
      byVehicleId.get(vehicleId).push(booking);
      if (status === "IN_USE") inUseVehicleIds.add(vehicleId);
    }

    const assignedUserId = String(booking.assigned_user_id || "").trim();
    const assignedUserName = String(booking.assigned_user_name || booking.driver_name || "").trim();

    if (assignedUserId) {
      if (!byAssignedUserId.has(assignedUserId)) byAssignedUserId.set(assignedUserId, []);
      byAssignedUserId.get(assignedUserId).push(booking);
    } else if (assignedUserName) {
      if (!byAssignedUserName.has(assignedUserName)) byAssignedUserName.set(assignedUserName, []);
      byAssignedUserName.get(assignedUserName).push(booking);
    }
  });

  return {
    byVehicleId,
    byAssignedUserId,
    byAssignedUserName,
    inUseVehicleIds,
    overlapCandidates,
  };
}

function isVehicleAvailable(vehicle, currentBooking, bookingGroups) {
  if (normalizeVehicleStatus(vehicle.status) !== "AVAILABLE") {
    return false;
  }

  const vehicleId = String(vehicle.vehicle_id || "").trim();
  const relevantBookings = bookingGroups.byVehicleId.get(vehicleId) || [];
  const vehicleInUse = bookingGroups.inUseVehicleIds.has(vehicleId);

  if (
    vehicleInUse &&
    relevantBookings.some((booking) => String(booking.booking_id) !== String(currentBooking.booking_id))
  ) {
    return false;
  }

  return !relevantBookings.some((booking) => {
    const isSameBooking = booking.booking_id === currentBooking.booking_id;

    if (isSameBooking) {
      return false;
    }

    return isTimeOverlap(
      currentBooking.start_datetime,
      currentBooking.end_datetime,
      booking.start_datetime,
      booking.end_datetime
    );
  });
}

function isDriverAvailable(driver, currentBooking, bookingGroups) {
  const driverId = String(driver.user_id || "").trim();
  const driverName = String(driver.name || "").trim();
  const relevantBookings = [
    ...(driverId ? bookingGroups.byAssignedUserId.get(driverId) || [] : []),
    ...(driverName ? bookingGroups.byAssignedUserName.get(driverName) || [] : []),
  ];

  return !relevantBookings.some((booking) => {
    const isSameBooking = booking.booking_id === currentBooking.booking_id;

    if (isSameBooking) {
      return false;
    }

    return isTimeOverlap(
      currentBooking.start_datetime,
      currentBooking.end_datetime,
      booking.start_datetime,
      booking.end_datetime
    );
  });
}

function isEditableBookingStatus(status) {
  return !["IN_USE", "COMPLETED", "CANCELLED"].includes(normalizeStatus(status));
}

function getOverlapBookings(bookings, currentBookingId, startDatetime, endDatetime) {
  if (!startDatetime || !endDatetime) {
    return [];
  }

  return bookings.filter((booking) => {
    if (currentBookingId && String(booking.booking_id) === String(currentBookingId)) {
      return false;
    }

    if (!booking.start_datetime || !booking.end_datetime) {
      return false;
    }

    return isTimeOverlap(startDatetime, endDatetime, booking.start_datetime, booking.end_datetime);
  });
}

function getBookingVehicleLabel(booking, vehicleMap) {
  const vehicleId = String(booking.vehicle_id || "").trim();
  if (!vehicleId) return "-";

  const vehicle = vehicleMap.get(vehicleId);
  const plate = vehicle?.license_plate || vehicle?.plate_no || "";
  return plate ? `${vehicleId} / ${plate}` : vehicleId;
}

function getBookingDriverLabel(booking) {
  return booking.assigned_user_name || booking.driver_name || "-";
}

function paginate(items, page) {
  const start = (page - 1) * ROWS_PER_PAGE;
  return items.slice(start, start + ROWS_PER_PAGE);
}

function totalPages(items) {
  return Math.max(1, Math.ceil(items.length / ROWS_PER_PAGE));
}

function useDebouncedValue(value, delay = 250) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function Pagination({ page, total, onChange }) {
  return (
    <div className="pagination">
      {Array.from({ length: total }).map((_, index) => (
        <button
          key={index}
          type="button"
          className={page === index + 1 ? "active-page" : ""}
          onClick={() => onChange(index + 1)}
        >
          {index + 1}
        </button>
      ))}
    </div>
  );
}

const BookingTableRow = memo(function BookingTableRow({
  booking,
  vehicleMap,
  canProcessBookings,
  canCancelBookings,
  canEditBookings,
  processing,
  onProcess,
  onEdit,
  onCancel,
}) {
  const status = normalizeStatus(booking.status);
  const statusMeta = getStatusMeta(status);
  const disabled = Boolean(processing);
  const canShowProcess = canProcessBookings && ["PENDING", "APPROVED"].includes(status);
  const canShowEdit = canEditBookings && isEditableBookingStatus(status);
  const canShowCancel =
    canCancelBookings && !["COMPLETED", "CANCELLED", "APPROVED", "IN_USE"].includes(status);

  return (
    <tr>
      <td>{booking.booking_no || "-"}</td>
      <td>{booking.requester_name || "-"}</td>
      <td>{formatThaiDateTime(booking.start_datetime)}</td>
      <td>{formatThaiDateTime(booking.end_datetime)}</td>
      <td>{booking.destination || "-"}</td>
      <td>{getBookingVehicleLabel(booking, vehicleMap)}</td>
      <td>{getBookingDriverLabel(booking)}</td>
      <td>
        <span className={`status ${statusMeta.className}`} title={statusMeta.help}>
          {statusMeta.label}
        </span>
      </td>
      <td style={{ maxWidth: 240, whiteSpace: "normal", wordBreak: "break-word", fontSize: 14 }}>
        {booking.staff_note || "-"}
      </td>
      <td className="action-buttons">
        {canShowProcess && (
          <button type="button" disabled={disabled} onClick={() => onProcess(booking)}>
            {processing === "process"
              ? "Processing..."
              : status === "APPROVED"
                ? "เปลี่ยนแปลงคนขับ"
                : "ดำเนินการ"}
          </button>
        )}
        {canShowEdit && (
          <button
            type="button"
            className="warning-button booking-action-button"
            disabled={disabled}
            onClick={() => onEdit(booking)}
          >
            {processing === "edit" ? "Saving..." : "แก้ไข"}
          </button>
        )}
        {canShowCancel && (
          <button
            type="button"
            className="danger-button"
            disabled={disabled}
            onClick={() => onCancel(booking)}
          >
            {processing === "cancel" ? "Cancelling..." : status === "PENDING" ? "ยกเลิก" : "ลบ"}
          </button>
        )}
      </td>
    </tr>
  );
});

export default function Booking() {
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [processingAction, setProcessingAction] = useState(null);
  const [filters, setFilters] = useState({
    requester: "",
    start_datetime: "",
    end_datetime: "",
    destination: "",
    status: "",
  });
  const debouncedFilters = useDebouncedValue(filters);

  const canCreateBookings = hasPermission(null, "bookings_create");
  const canViewBookings = hasPermission(null, "bookings_view");
  const canProcessBookings = hasPermission(null, "bookings_approve");
  const canCancelBookings = hasPermission(null, "bookings_cancel");
  const canEditBookings = hasPermission(null, "bookings_edit");
  const currentUser = getCurrentUser();

  const mergeBooking = useCallback((nextBooking) => {
    if (!nextBooking?.booking_id) return;

    setBookings((current) => {
      const index = current.findIndex(
        (booking) => String(booking.booking_id) === String(nextBooking.booking_id)
      );

      if (index === -1) {
        return [nextBooking, ...current];
      }

      const next = [...current];
      next[index] = {
        ...next[index],
        ...nextBooking,
      };
      return next;
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [bookingData, vehicleData, driverData] = await Promise.all([
        getBookings(),
        getVehicles(),
        getUsers(),
      ]);

      setBookings(Array.isArray(bookingData) ? bookingData : []);
      setVehicles(Array.isArray(vehicleData) ? vehicleData : []);
      setDrivers(
        Array.isArray(driverData)
          ? driverData.filter((user) => normalizeStatus(user.role) === "DRIVER")
          : []
      );
    } catch (err) {
      const message = err.message || "โหลดข้อมูลไม่สำเร็จ";
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshBookings = useCallback(async () => {
    try {
      setRefreshing(true);
      const bookingData = await getBookings({ fresh: true });
      setBookings(Array.isArray(bookingData) ? bookingData : []);
    } catch (err) {
      const message = err.message || "โหลดข้อมูลไม่สำเร็จ";
      setError(message);
      showError(message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [debouncedFilters]);

  const vehicleTypes = useMemo(
    () => [...new Set(vehicles.map((vehicle) => vehicle.vehicle_type).filter(Boolean))],
    [vehicles]
  );

  const vehicleMap = useMemo(() => {
    const map = new Map();
    vehicles.forEach((vehicle) => {
      map.set(String(vehicle.vehicle_id || "").trim(), vehicle);
    });
    return map;
  }, [vehicles]);

  const bookingGroups = useMemo(() => groupActiveBookings(bookings), [bookings]);

  const activeDrivers = useMemo(
    () => drivers.filter((driver) => normalizeStatus(driver.status) === "ACTIVE"),
    [drivers]
  );

  const sortedBookings = useMemo(() => sortLatestFirst(bookings), [bookings]);

  const filteredBookings = useMemo(() => {
    const requester = debouncedFilters.requester.trim().toLowerCase();
    const destination = debouncedFilters.destination.trim().toLowerCase();
    const status = normalizeStatus(debouncedFilters.status);
    const startFilter = debouncedFilters.start_datetime ? new Date(debouncedFilters.start_datetime).getTime() : null;
    const endFilter = debouncedFilters.end_datetime ? new Date(debouncedFilters.end_datetime).getTime() : null;

    return sortedBookings.filter((booking) => {
      const bookingStatus = normalizeStatus(booking.status);

        if (bookingStatus === "CANCELLED") {
          return false;
        }
      const bookingRequester = String(booking.requester_name || "").toLowerCase();
      const bookingDestination = String(booking.destination || "").toLowerCase();
      const bookingStart = new Date(booking.start_datetime).getTime();
      const bookingEnd = new Date(booking.end_datetime).getTime();

      if (requester && !bookingRequester.includes(requester)) return false;
      if (destination && !bookingDestination.includes(destination)) return false;
      if (status && bookingStatus !== status) return false;
      if (startFilter && bookingStart < startFilter) return false;
      if (endFilter && bookingEnd > endFilter) return false;

  
      return true;
    });
  }, [debouncedFilters, sortedBookings]);

  const bookingPages = useMemo(() => totalPages(filteredBookings), [filteredBookings]);
  const pageItems = useMemo(() => paginate(filteredBookings, page), [filteredBookings, page]);

  useEffect(() => {
    if (page > bookingPages) {
      setPage(bookingPages);
    }
  }, [page, bookingPages]);

  const getBookingModalHtml = useCallback((booking) => {
    const vehicleTypeOptions = [
      '<option value="">-- เลือกประเภทรถ --</option>',
      ...vehicleTypes.map(
        (type) =>
          `<option value="${escapeHtml(type)}" ${
            type === (booking?.vehicle_type_request || "") ? "selected" : ""
          }>${escapeHtml(type)}</option>`
      ),
    ].join("");

    return `
      <div class="swal-form">
        <label>ชื่อผู้จอง</label>
        <input
          id="requester_name"
          class="swal2-input"
          placeholder="ชื่อ-นามสกุล"
          value="${escapeHtml(booking?.requester_name || "")}"
        >

        <label>หน่วยงาน</label>
        <input
          id="department"
          class="swal2-input"
          placeholder="เช่น ฝ่ายประสานงาน"
          value="${escapeHtml(booking?.department || "")}"
        >

        <label>เบอร์โทร</label>
        <input
          id="phone"
          class="swal2-input"
          placeholder="08x-xxx-xxxx"
          value="${escapeHtml(booking?.phone || "")}"
        >

        <label>วันเวลาเริ่ม</label>
        <div
          id="booking_overlap_warning"
          class="booking-overlap-warning"
  
        >
          แจ้งเตือน: คุณมีรายการจองอื่นในช่วงวันเวลาใกล้เคียงกัน !!
        </div>
        <input
          id="start_datetime"
          class="swal2-input"
          type="datetime-local"
          lang="en-GB"
          value="${toDateTimeLocalValue(booking?.start_datetime || "")}"
        >

        <label>วันเวลาสิ้นสุด</label>
        <input
          id="end_datetime"
          class="swal2-input"
          type="datetime-local"
          lang="en-GB"
          value="${toDateTimeLocalValue(booking?.end_datetime || "")}"
        >

        <label>ประเภทรถ</label>
        <select id="vehicle_type_request" class="swal2-select">
          ${vehicleTypeOptions}
        </select>

        <label>ปลายทาง</label>
        <input
          id="destination"
          class="swal2-input"
          placeholder="เช่น ศาลากลางจังหวัด"
          value="${escapeHtml(booking?.destination || "")}"
        >

        <label>เหตุผลการใช้รถ</label>
        <input
          id="purpose"
          class="swal2-input"
          placeholder="เช่น ประชุมราชการ"
          value="${escapeHtml(booking?.purpose || "")}"
        >
      </div>
    `;
  }, [vehicleTypes]);

  const openBookingModal = useCallback(async (booking = null) => {
    const result = await Swal.fire({
      title: booking ? "แก้ไขรายการจอง" : "Book Vehicle",
      html: getBookingModalHtml(booking),
      width: 780,
      showCancelButton: true,
      confirmButtonText: booking ? "บันทึก" : "ส่งคำขอจองรถ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#1455c8",
      cancelButtonColor: "#64748b",
      didOpen: () => {
        const modal = Swal.getPopup();
        const warningEl = modal?.querySelector("#booking_overlap_warning");
        const startInput = modal?.querySelector("#start_datetime");
        const endInput = modal?.querySelector("#end_datetime");

        if (!warningEl || !startInput || !endInput) {
          return;
        }

        const updateWarning = () => {
          const overlaps = getOverlapBookings(
            bookingGroups.overlapCandidates,
            booking?.booking_id || "",
            startInput.value,
            endInput.value
          );

          warningEl.style.display = overlaps.length > 0 ? "block" : "none";
        };

        startInput.addEventListener("input", updateWarning);
        startInput.addEventListener("change", updateWarning);
        endInput.addEventListener("input", updateWarning);
        endInput.addEventListener("change", updateWarning);
        updateWarning();
      },
      preConfirm: () => {
        const requester_name = document.getElementById("requester_name").value.trim();
        const department = document.getElementById("department").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const start_datetime = document.getElementById("start_datetime").value;
        const end_datetime = document.getElementById("end_datetime").value;
        const vehicle_type_request = document.getElementById("vehicle_type_request").value.trim();
        const destination = document.getElementById("destination").value.trim();
        const purpose = document.getElementById("purpose").value.trim();

        if (!requester_name || !phone || !start_datetime || !end_datetime || !destination) {
          Swal.showValidationMessage("กรุณากรอกข้อมูลที่จำเป็นให้ครบ");
          return false;
        }

        if (new Date(end_datetime) <= new Date(start_datetime)) {
          Swal.showValidationMessage("วันเวลาสิ้นสุดต้องมากกว่าวันเวลาเริ่ม");
          return false;
        }

        return {
          booking_id: booking?.booking_id || "",
          requester_name,
          department,
          phone,
          start_datetime,
          end_datetime,
          vehicle_type_request,
          destination,
          purpose,
          vehicle_id: booking?.vehicle_id || "",
        };
      },
    });

    if (!result.isConfirmed) return;

    try {
      if (booking) {
        const updated = await updateBooking(result.value);
        mergeBooking({ ...result.value, ...(updated || {}) });
        await showSuccess("แก้ไขรายการสำเร็จ");
      } else {
        const created = await createBooking(result.value);
        mergeBooking({ ...result.value, ...(created || {}) });
        await showSuccess("ส่งคำขอจองรถสำเร็จ");
      }
    } catch (err) {
      showError(err.message || (booking ? "แก้ไขรายการไม่สำเร็จ" : "จองรถไม่สำเร็จ"));
    }
  }, [bookingGroups.overlapCandidates, getBookingModalHtml, mergeBooking]);

  const handleCreateBooking = useCallback(async () => {
    if (processingAction) return;
    setProcessingAction({ bookingId: "new", type: "create" });
    await openBookingModal();
    setProcessingAction(null);
  }, [openBookingModal, processingAction]);

  const handleProcessBooking = useCallback(async (booking) => {
    if (processingAction) return;
    const result = await Swal.fire({
      title: "ดำเนินการจอง",
      html: `
        <div class="swal-form">
          <label>เลือกรถ</label>
          <select id="vehicle_id" class="swal2-select">
            <option value="">-- เลือกรถ --</option>
            ${vehicles
              .map((vehicle) => {
                const available = isVehicleAvailable(vehicle, booking, bookingGroups);
                const vehicleStatus = normalizeVehicleStatus(vehicle.status);
                const unavailableByStatus = vehicleStatus === "UNAVAILABLE";
                const label = `${vehicle.vehicle_name || vehicle.vehicle_code || vehicle.vehicle_id} - ${
                  vehicle.license_plate || vehicle.plate_no || "-"
                }`;
                const availabilityLabel = unavailableByStatus
                      ? " ⚠️ ไม่พร้อมใช้งาน"
                      : available
                        ? " ✅ ว่าง"
                        : " ❌ ไม่ว่าง";
                return `<option value="${escapeHtml(vehicle.vehicle_id)}" ${
                  available ? "" : "disabled"
                }>${escapeHtml(label)}${availabilityLabel}</option>`;
              })
              .join("")}
          </select>

          <label>เลือกผู้ใช้</label>
          <select id="assigned_user_id" class="swal2-select">
            <option value="">-- เลือกผู้ใช้ --</option>
            ${activeDrivers
              .map((driver) => {
                const available = isDriverAvailable(driver, booking, bookingGroups);
                return `<option value="${escapeHtml(driver.user_id)}" ${
                  available ? "" : "disabled"
                }>${escapeHtml(driver.name)}${driver.phone ? ` (${escapeHtml(driver.phone)})` : ""}${
                  available ? " ✅ ว่าง" : " ❌ ไม่ว่าง"
                }</option>`;
              })
              .join("")}
          </select>

          <label>หมายเหตุเจ้าหน้าที่</label>
          <input id="staff_note" class="swal2-input" placeholder="-">
        </div>
      `,
      width: 760,
      showCancelButton: true,
      confirmButtonText: "อนุมัติรายการ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#1455c8",
      cancelButtonColor: "#64748b",
      preConfirm: () => {
        const vehicle_id = document.getElementById("vehicle_id").value;
        const assigned_user_id = document.getElementById("assigned_user_id").value;
        const staff_note = document.getElementById("staff_note").value.trim();

        if (!vehicle_id || !assigned_user_id) {
          Swal.showValidationMessage("กรุณาเลือกรถและผู้ใช้");
          return false;
        }

        const vehicle = vehicles.find((item) => item.vehicle_id === vehicle_id);
        const driver = drivers.find((item) => item.user_id === assigned_user_id);

        if (!vehicle || !isVehicleAvailable(vehicle, booking, bookingGroups)) {
          Swal.showValidationMessage("รถคันนี้ไม่ว่างหรือไม่พร้อมใช้งาน");
          return false;
        }

        if (!driver || !isDriverAvailable(driver, booking, bookingGroups)) {
          Swal.showValidationMessage("คนขับท่านนี้ไม่ว่าง");
          return false;
        }

        return {
          booking_id: booking.booking_id,
          booking_no: booking.booking_no || "",
          vehicle_id,
          assigned_user_id,
          assigned_user_name: driver.name,
          staff_note,
        };
      },
    });

    if (!result.isConfirmed) return;

    try {
      setProcessingAction({ bookingId: booking.booking_id, type: "process" });
      const approved = await approveBooking(result.value);
      mergeBooking({ ...result.value, ...(approved || {}), status: "APPROVED" });
      await showSuccess("อนุมัติรายการสำเร็จ");
    } catch (err) {
      showError(err.message || "อนุมัติรายการไม่สำเร็จ");
    } finally {
      setProcessingAction(null);
    }
  }, [activeDrivers, bookingGroups, drivers, mergeBooking, processingAction, vehicles]);

  const handleEditBooking = useCallback(async (booking) => {
    if (processingAction) return;
    setProcessingAction({ bookingId: booking.booking_id, type: "edit" });
    await openBookingModal(booking);
    setProcessingAction(null);
  }, [openBookingModal, processingAction]);

  const handleCancelBooking = useCallback(async (booking) => {
    if (processingAction) return;
    const result = await Swal.fire({
      title: normalizeStatus(booking.status) === "PENDING" ? "Cancel Booking" : "Delete Booking",
      html: `
        <div class="swal-form">
          <label>เหตุผลการยกเลิก</label>
          <textarea id="cancel_reason" class="swal2-textarea" rows="5" placeholder="ระบุเหตุผลให้ชัดเจน"></textarea>
        </div>
      `,
      width: 720,
      showCancelButton: true,
      confirmButtonText: "ยืนยัน",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      preConfirm: () => {
        const reason = document.getElementById("cancel_reason").value.trim();

        if (!reason) {
          Swal.showValidationMessage("กรุณาระบุเหตุผลการยกเลิก");
          return false;
        }

        return reason;
      },
    });

    if (!result.isConfirmed) return;

    try {
      setProcessingAction({ bookingId: booking.booking_id, type: "cancel" });
      const cancelled = await cancelBooking({
        booking_id: booking.booking_id,
        reason: result.value,
        cancelled_by: currentUser?.name || currentUser?.email || "",
      });
      mergeBooking({
        ...(cancelled || {}),
        booking_id: booking.booking_id,
        status: "CANCELLED",
        staff_note: result.value,
      });

      await showSuccess("ยกเลิกรายการสำเร็จ");
    } catch (err) {
      showError(err.message || "ยกเลิกรายการไม่สำเร็จ");
    } finally {
      setProcessingAction(null);
    }
  }, [currentUser?.email, currentUser?.name, mergeBooking, processingAction]);

  const setFilter = useCallback((field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      requester: "",
      start_datetime: "",
      end_datetime: "",
      destination: "",
      status: "",
    });
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>จองรถ</h2>
          <p>จองรถผ่านแบบฟอร์มแบบโมดัล และติดตามรายการจองล่าสุดได้ในตารางด้านล่าง</p>
        </div>

        {canCreateBookings && (
          <button type="button" disabled={Boolean(processingAction)} onClick={handleCreateBooking}>
              ➕ เพิ่มรายการจองใหม่
          </button>
        )}
        {canViewBookings && (
          <button type="button" disabled={refreshing || loading} onClick={refreshBookings}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        )}
      </div>

      {loading && <div className="form-card">กำลังโหลดข้อมูล...</div>}

      {error && !loading && <div className="form-card">{error}</div>}

      {canViewBookings && (
        <div className="form-card">
            <div className="section-header">
              <h3>ค้นหารายการจอง</h3>

              <button
                type="button"
                className="warning-button booking-filter-clear-button"
                disabled={refreshing}
                onClick={clearFilters}
              >
                ล้างตัวกรอง
              </button>
            </div>
          <div className="form-grid booking-filter-grid" style={{ marginTop: 16 }}>
            <div>
              <label>ผู้จอง</label>
              <input
                value={filters.requester}
                onChange={(e) => setFilter("requester", e.target.value)}
                placeholder="ค้นหาจากชื่อผู้จอง"
              />
            </div>

            <div>
              <label>วันเวลาเริ่ม</label>
              <input
                type="datetime-local"
                lang="en-GB"
                value={filters.start_datetime}
                onChange={(e) => setFilter("start_datetime", e.target.value)}
              />
            </div>

            <div>
              <label>วันเวลาสิ้นสุด</label>
              <input
                type="datetime-local"
                lang="en-GB"
                value={filters.end_datetime}
                onChange={(e) => setFilter("end_datetime", e.target.value)}
              />
            </div>

            <div>
              <label>ปลายทาง</label>
              <input
                value={filters.destination}
                onChange={(e) => setFilter("destination", e.target.value)}
                placeholder="ค้นหาปลายทาง"
              />
            </div>

            <div>
              <label>สถานะ</label>
              <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
                <option value="">ทั้งหมด</option>
                {Object.entries(STATUS_META).map(([status, meta]) => (
                  <option key={status} value={status}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {canCreateBookings && (
          <button type="button"  disabled={Boolean(processingAction)} onClick={handleCreateBooking}>
              ➕ เพิ่มรายการจองใหม่
          </button>
        )}
          {loading ? (
            <p>กำลังโหลดข้อมูลรายการจอง...</p>
          ) : (
            <>

              <div className="table-wrap" style={{ marginTop: 24 }}>
                <table>
                  
                  <thead>
                    <tr>
                      <th>เลขที่</th>
                      <th>ผู้จอง</th>
                      <th>เริ่ม</th>
                      <th>สิ้นสุด</th>
                      <th>ปลายทาง</th>
                      <th>รถ</th>
                      <th>คนขับ</th>
                      <th>สถานะ</th>
                      <th>หมายเหตุ</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.length === 0 ? (
                      <tr>
                        <td colSpan="10">ไม่พบรายการจอง</td>
                      </tr>
                    ) : (
                      pageItems.map((booking) => (
                        <BookingTableRow
                          key={booking.booking_id}
                          booking={booking}
                          vehicleMap={vehicleMap}
                          canProcessBookings={canProcessBookings}
                          canCancelBookings={canCancelBookings}
                          canEditBookings={canEditBookings}
                          processing={
                            processingAction?.bookingId === booking.booking_id
                              ? processingAction.type
                              : ""
                          }
                          onProcess={handleProcessBooking}
                          onEdit={handleEditBooking}
                          onCancel={handleCancelBooking}
                        />
                      ))
                      /* legacy inline row kept unreachable for minimal diff */ || pageItems.map((booking) => {
                        const statusMeta = getStatusMeta(booking.status);
                        const status = normalizeStatus(booking.status);
                        const canShowProcess =
                          canProcessBookings &&
                          ["PENDING", "APPROVED"].includes(status);

                        const canShowEdit =
                          canEditBookings && isEditableBookingStatus(status);

                        const canShowCancel =
                          canCancelBookings &&
                          !["COMPLETED", "CANCELLED", "APPROVED", "IN_USE"].includes(status);

                        return (
                          <tr key={booking.booking_id}>
                            <td>{booking.booking_no || "-"}</td>
                            <td>{booking.requester_name || "-"}</td>
                            <td>{formatThaiDateTime(booking.start_datetime)}</td>
                            <td>{formatThaiDateTime(booking.end_datetime)}</td>
                            <td>{booking.destination || "-"}</td>
                            <td>{getBookingVehicleLabel(booking, vehicleMap)}</td>
                            <td>{getBookingDriverLabel(booking)}</td>
                            <td>
                              <span
                                className={`status ${statusMeta.className}`}
                                title={statusMeta.help}
                              >
                                {statusMeta.label}
                              </span>
                            </td>
                            <td style={{ maxWidth: 240, whiteSpace: "normal", wordBreak: "break-word", fontSize: 14 }}>
                              {booking.staff_note || "-"}
                            </td>
                            <td className="action-buttons">
                              {canShowProcess && (
                                <button type="button" onClick={() => handleProcessBooking(booking)}>
                                  {status === "APPROVED" ? "เปลี่ยนแปลงคนขับ" : "ดำเนินการ"}
                                </button>
                              )}
                              {canShowEdit && (
                                <button
                                  type="button"
                                  className="warning-button booking-action-button"
                                  onClick={() => handleEditBooking(booking)}
                                >
                                  แก้ไข
                                </button>
                              )}
                              {canShowCancel && (
                                <button
                                  type="button"
                                  // className="danger-button booking-action-button"
                                  className="danger-button"
                                  onClick={() => handleCancelBooking(booking)}
                                >
                                  {status === "PENDING" ? "ยกเลิก" : "ลบ"}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination page={page} total={bookingPages} onChange={setPage} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
