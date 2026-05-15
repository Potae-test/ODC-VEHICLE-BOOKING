import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { Thai } from "flatpickr/dist/l10n/th.js";
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
  // CANCELLED: {
  //   label: "ยกเลิกแล้ว",
  //   className: "red",
  //   help: "รายการที่ถูกยกเลิกและบันทึกลงประวัติการยกเลิก",
  // },
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

function getVehicleTypeText(type) {
  const value = String(type || "").trim();
  const normalized = value.toUpperCase();

  if (!value) return "-";
  if (normalized === "VAN") return "รถตู้";
  if (normalized === "SEDAN") return "รถเก๋ง";
  if (normalized === "MOTORCYCLE") return "จักรยานยนต์";
  if (normalized === "OTHER") return "อื่นๆ";
  return value;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatThaiDateTimeValue(date) {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear() + 543} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function parseThaiDateTimeValue(dateStr, formatStr) {
  const raw = String(dateStr || "").trim();
  if (!raw) return null;

  const buddhistMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (buddhistMatch) {
    const [, day, month, year, hour, minute] = buddhistMatch;
    return new Date(
      Number(year) - 543,
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
      0
    );
  }

  const gregorianMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (gregorianMatch) {
    const [, year, month, day, hour = "0", minute = "0"] = gregorianMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
      0
    );
  }

  const parsed = flatpickr.parseDate(raw, formatStr);
  if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function syncBuddhistYearHeader(instance) {
  if (!instance?.calendarContainer) return;

  instance.calendarContainer.classList.add("booking-flatpickr-calendar");

  const yearInput = instance.currentYearElement;
  if (yearInput) {
    yearInput.value = String(instance.currentYear + 543);
    yearInput.setAttribute("inputmode", "numeric");
  }
}

function initThaiDateTimePicker(inputSelector, defaultValue, options = {}) {
  const input = document.querySelector(inputSelector);
  if (!input) return null;

  const { showTodayButton = true, onValueChange, useAltInput = true } = options;
  const normalizedDefaultDate =
    defaultValue instanceof Date
      ? defaultValue
      : defaultValue
        ? String(defaultValue).trim().replace("T", " ")
        : undefined;

  const instance = flatpickr(input, {
    enableTime: true,
    noCalendar: false,
    time_24hr: true,
    minuteIncrement: 5,
    locale: {
      ...Thai,
      today: "วันนี้",
    },
    dateFormat: "Y-m-d H:i",
    altInput: useAltInput,
    altFormat: "d/m/Y H:i",
    allowInput: false,
    disableMobile: true,
    defaultDate: normalizedDefaultDate,
    formatDate: (date, formatStr, locale) => {
      if (formatStr === "d/m/Y H:i") {
        return formatThaiDateTimeValue(date);
      }

      return flatpickr.formatDate(date, formatStr, locale);
    },
    parseDate: (dateStr, formatStr) => {
      const parsed = parseThaiDateTimeValue(dateStr, formatStr);
      if (parsed) return parsed;
      return flatpickr.parseDate(dateStr, formatStr);
    },
    onMonthChange: [(_, __, instance) => syncBuddhistYearHeader(instance)],
    onYearChange: [(_, __, instance) => syncBuddhistYearHeader(instance)],
    onReady: [
      (selectedDates, dateStr, instance) => {
        syncBuddhistYearHeader(instance);

        if (showTodayButton) {
          const footer = document.createElement("div");
          footer.className = "thai-picker-footer";
          footer.innerHTML = `
            <button
              type="button"
              class="thai-picker-today"
            >
              วันนี้
            </button>
          `;

          footer.onclick = () => {
            instance.setDate(new Date(), true);
          };

          instance.calendarContainer.appendChild(footer);
        }
      },
    ],
    onChange: onValueChange
      ? [
          (_, __, instance) => {
            onValueChange(instance.input.value, instance);
          },
        ]
      : undefined,
    onValueUpdate: onValueChange
      ? [
          (_, __, instance) => {
            onValueChange(instance.input.value, instance);
          },
        ]
      : undefined,
  });

  syncBuddhistYearHeader(instance);
  return instance;
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("odc_user") || "null");
  } catch {
    return null;
  }
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

  if (!vehicle) return "-";

  const vehicleType = getVehicleTypeText(
    vehicle.vehicle_type ||
    booking.vehicle_type ||
    booking.vehicle_type_request
  );

  const plate =
    vehicle.license_plate ||
    vehicle.plate_no ||
    "-";

  return `${vehicleType} / ${plate}`;
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
  canViewBookingDetail,
  canProcessBookings,
  canCancelBookings,
  canEditBookings,
  processing,
  onViewDetail,
  onProcess,
  onEdit,
  onCancel,
}) {
  const status = normalizeStatus(booking.status);
  const statusMeta = getStatusMeta(status);
  const disabled = Boolean(processing);
  const canShowDetail = canViewBookingDetail;
  const canShowProcess = canProcessBookings && ["PENDING", "APPROVED"].includes(status);
  const canShowEdit = canEditBookings && isEditableBookingStatus(status);
  const canShowCancel =
    canCancelBookings && !["COMPLETED", "CANCELLED", "IN_USE"].includes(status);

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
      <td style={{ maxWidth: 240, whiteSpace: "normal", wordBreak: "break-word", fontSize: 25}}>
        {booking.staff_note || "-"}
      </td>
      <td className="action-buttons">
        {canShowDetail && (
          <button type="button" className="booking-action-button" disabled={disabled} onClick={() => onViewDetail(booking)}>
            ดูรายละเอียด
          </button>
        )}
        {canShowProcess && (
          <button type="button" disabled={disabled} onClick={() => onProcess(booking)}>
            {processing === "process"
              ? "Processing..."
              : status === "APPROVED"
                ? "เปลี่ยนคนขับ/รถ"
                : "อนุมัติ"}
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
    driver: "",
    vehicle_id: "",
  });
  const filterStartPickerRef = useRef(null);
  const filterEndPickerRef = useRef(null);
  const debouncedFilters = useDebouncedValue(filters);

  const canCreateBookings = hasPermission(null, "bookings_create");
  const canViewBookings = hasPermission(null, "bookings_view");
  const canViewBookingDetail = hasPermission(null, "bookings_detail");
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
    if (!canViewBookings) {
      return undefined;
    }

    filterStartPickerRef.current = initThaiDateTimePicker("#filter_start_datetime", undefined, {
      showTodayButton: false,
      useAltInput: false,
      onValueChange: (value) => setFilter("start_datetime", value || ""),
    });
    filterEndPickerRef.current = initThaiDateTimePicker("#filter_end_datetime", undefined, {
      showTodayButton: false,
      useAltInput: false,
      onValueChange: (value) => setFilter("end_datetime", value || ""),
    });

    return () => {
      filterStartPickerRef.current?.destroy?.();
      filterEndPickerRef.current?.destroy?.();
      filterStartPickerRef.current = null;
      filterEndPickerRef.current = null;
    };
  }, [canViewBookings]);

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
    const driverFilter = String(debouncedFilters.driver || "").trim();
    const vehicleIdFilter = String(debouncedFilters.vehicle_id || "").trim();
    const startFilter = debouncedFilters.start_datetime ? new Date(debouncedFilters.start_datetime).getTime() : null;
    const endFilter = debouncedFilters.end_datetime ? new Date(debouncedFilters.end_datetime).getTime() : null;
    const selectedDriverName = driverFilter
      ? activeDrivers.find((driver) => String(driver.user_id || "").trim() === driverFilter)?.name || ""
      : "";

    return sortedBookings.filter((booking) => {
      const bookingStatus = normalizeStatus(booking.status);

        if (bookingStatus === "CANCELLED") {
          return false;
        }
      const bookingRequester = String(booking.requester_name || "").toLowerCase();
      const bookingDestination = String(booking.destination || "").toLowerCase();
      const bookingStart = new Date(booking.start_datetime).getTime();
      const bookingEnd = new Date(booking.end_datetime).getTime();
      const bookingVehicleId = String(booking.vehicle_id || "").trim();
      const bookingAssignedUserId = String(booking.assigned_user_id || "").trim();
      const bookingAssignedUserName = String(booking.assigned_user_name || booking.driver_name || "").trim();

      if (requester && !bookingRequester.includes(requester)) return false;
      if (destination && !bookingDestination.includes(destination)) return false;
      if (status && bookingStatus !== status) return false;
      if (startFilter && bookingStart < startFilter) return false;
      if (endFilter && bookingEnd > endFilter) return false;
      if (vehicleIdFilter && bookingVehicleId !== vehicleIdFilter) return false;
      if (driverFilter) {
        if (bookingAssignedUserId) {
          if (bookingAssignedUserId !== driverFilter) return false;
        } else if (!selectedDriverName || bookingAssignedUserName !== selectedDriverName) {
          return false;
        }
      }

  
      return true;
    });
  }, [activeDrivers, debouncedFilters, sortedBookings]);

  const bookingPages = useMemo(() => totalPages(filteredBookings), [filteredBookings]);
  const pageItems = useMemo(() => paginate(filteredBookings, page), [filteredBookings, page]);

  useEffect(() => {
    if (page > bookingPages) {
      setPage(bookingPages);
    }
  }, [page, bookingPages]);

  const getBookingModalHtml = useCallback((booking) => {
  const defaultVehicleType = booking?.vehicle_type_request || "VAN";
  const vehicleTypeOptions = [
    ...vehicleTypes.map(
      (type) =>
        `<option value="${escapeHtml(type)}"
          ${type === defaultVehicleType ? "selected" : ""}>
          ${escapeHtml(getVehicleTypeText(type))}
        </option>`
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

        <label>หน่วยงาน / ฝ่าย</label>
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

        <label>เวลาไป</label>
        <div
          id="booking_overlap_warning"
          class="booking-overlap-warning"
  
        >
          แจ้งเตือน: คุณมีรายการจองอื่นในช่วงวันเวลาใกล้เคียงกัน !!
        </div>
 
        <input
          id="start_datetime"
          class="swal2-input"
          type="text"
          lang="en-GB"
          value="${escapeHtml(booking?.start_datetime || "")}"
        >

        <label>เวลากลับ</label>
        <input
          id="end_datetime"
          class="swal2-input"
          type="text"
          lang="en-GB"
          value="${escapeHtml(booking?.end_datetime || "")}"
        >

        <label>ประเภทรถ</label>
        <select id="vehicle_type_request" class="swal2-select">
          ${vehicleTypeOptions}
        </select>

        <label>ปลายทาง</label>
          <textarea
            id="destination"
            class="swal2-textarea"
            rows="4"
            placeholder="เช่น ศาลากลางจังหวัด"
            style="
              width:100%;
              max-width:100%;
              min-height:110px;
              margin:0;
              resize:vertical;
              box-sizing:border-box;
            "
          >${escapeHtml(booking?.destination || "")}</textarea>

        <label>เหตุผลการใช้รถ</label>
          <textarea
            id="purpose"
            class="swal2-textarea"
            rows="4"
            placeholder="เช่น ประชุมราชการ"
            style="
              width:100%;
              max-width:100%;
              min-height:110px;
              margin:0;
              resize:vertical;
              box-sizing:border-box;
            "
          >${escapeHtml(booking?.purpose || "")}</textarea>
      </div>
    `;
  }, [vehicleTypes]);

  const openBookingModal = useCallback(async (booking = null) => {
    const result = await Swal.fire({
      title: booking ? "แก้ไขรายการจอง" : "จองรถใหม่",
      html: getBookingModalHtml(booking),
      width: 780,
      showCancelButton: true,
      confirmButtonText: booking ? "บันทึก" : "ส่งคำขอจองรถ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#1455c8",
      cancelButtonColor: "#64748b",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        const modal = Swal.getPopup();
        const warningEl = modal?.querySelector("#booking_overlap_warning");
        const startInput = modal?.querySelector("#start_datetime");
        const endInput = modal?.querySelector("#end_datetime");
        const now = new Date();
        const defaultStart = booking?.start_datetime || now;
        const defaultEnd =
          booking?.end_datetime || new Date(now.getTime() + 60 * 60 * 1000);

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

        const startPicker = initThaiDateTimePicker("#start_datetime", defaultStart);
        const endPicker = initThaiDateTimePicker("#end_datetime", defaultEnd);

        startPicker?.config.onChange.push(updateWarning);
        startPicker?.config.onValueUpdate.push(updateWarning);
        endPicker?.config.onChange.push(updateWarning);
        endPicker?.config.onValueUpdate.push(updateWarning);

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

          <label>หมายเหตุ</label>
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

  const handleViewBookingDetail = useCallback(
    async (booking) => {
      if (processingAction) return;

      const detailHtml = `
        <div class="swal-form booking-detail-modal">
          <div class="booking-detail-grid">
      
            <div><span class="booking-detail-label">ผู้จอง</span><span class="booking-detail-value">${escapeHtml(booking.requester_name || "-")}</span></div>
            <div><span class="booking-detail-label">หน่วยงาน / ฝ่าย</span><span class="booking-detail-value">${escapeHtml(booking.department || "-")}</span></div>
            <div><span class="booking-detail-label">เบอร์โทร</span><span class="booking-detail-value">${escapeHtml(booking.phone || "-")}</span></div>
            <div><span class="booking-detail-label">เวลาไป</span><span class="booking-detail-value">${escapeHtml(formatThaiDateTime(booking.start_datetime) || "-")}</span></div>
            <div><span class="booking-detail-label">เวลากลับ</span><span class="booking-detail-value">${escapeHtml(formatThaiDateTime(booking.end_datetime) || "-")}</span></div>
            <div><span class="booking-detail-label">รถที่ขอ</span><span class="booking-detail-value">${escapeHtml(getVehicleTypeText(booking.vehicle_type_request || booking.vehicle_type || ""))}</span></div>
            <div><span class="booking-detail-label">ปลายทาง</span><span class="booking-detail-value">${escapeHtml(booking.destination || "-")}</span></div>
            <div><span class="booking-detail-label">เหตุผลการใช้รถ</span><span class="booking-detail-value">${escapeHtml(booking.purpose || "-")}</span></div>
            <div><span class="booking-detail-label">รถที่ได้รับ</span><span class="booking-detail-value">${escapeHtml(getBookingVehicleLabel(booking, vehicleMap))}</span></div>
            <div><span class="booking-detail-label">คนขับ</span><span class="booking-detail-value">${escapeHtml(getBookingDriverLabel(booking))}</span></div>
            <div><span class="booking-detail-label">สถานะ</span><span class="booking-detail-value">${escapeHtml(getStatusMeta(booking.status).label)}</span></div>
            <div><span class="booking-detail-label">หมายเหตุเจ้าหน้าที่</span><span class="booking-detail-value">${escapeHtml(booking.staff_note || "-")}</span></div>

          </div>
        </div>
      `;
        // <div><span class="booking-detail-label">เลขที่รายการ</span><span class="booking-detail-value">${escapeHtml(booking.booking_no || booking.booking_id || "-")}</span></div>
        // <div><span class="booking-detail-label">created_at</span><span class="booking-detail-value">${escapeHtml(formatThaiDateTime(booking.created_at) || "-")}</span></div>
        // <div><span class="booking-detail-label">updated_at</span><span class="booking-detail-value">${escapeHtml(formatThaiDateTime(booking.updated_at) || "-")}</span></div>
      await Swal.fire({
        title: "รายละเอียดรายการจอง",
        html: detailHtml,
        width: 820,
        confirmButtonText: "ปิด",
        confirmButtonColor: "#1455c8",
      });
    },
    [vehicleMap]
  );

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
      driver: "",
      vehicle_id: "",
    });

    filterStartPickerRef.current?.clear?.();
    filterEndPickerRef.current?.clear?.();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>จองรถ</h2>
          <p>จองรถและติดตามรายการจอง</p>
        </div>
        {canViewBookings && (
          <button type="button" disabled={refreshing || loading} onClick={refreshBookings}>
            {refreshing ? "กำลังรีเฟรชข้อมูล..." : "รีเฟรชข้อมูล"}
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
          <div className="booking-filter-row-4" style={{ marginTop: 16 }}>
            <div>
              <label>ผู้จอง</label>
              <input
                value={filters.requester}
                onChange={(e) => setFilter("requester", e.target.value)}
                placeholder="ค้นหาจากชื่อผู้จอง"
              />
            </div>

            <div>
              <label>คนขับ</label>
              <select value={filters.driver} onChange={(e) => setFilter("driver", e.target.value)}>
                <option value="">ทั้งหมด</option>
                {activeDrivers.map((driver) => (
                  <option key={driver.user_id} value={driver.user_id}>
                    {driver.name || "-"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>ทะเบียนรถ</label>
              <select
                value={filters.vehicle_id}
                onChange={(e) => setFilter("vehicle_id", e.target.value)}
              >
                <option value="">ทั้งหมด</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                    {vehicle.vehicle_code
                      ? `${vehicle.vehicle_code}${vehicle.plate_no || vehicle.license_plate ? ` / ${vehicle.plate_no || vehicle.license_plate}` : ""}`
                      : vehicle.vehicle_id || "-"}
                  </option>
                ))}
              </select>
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

          <div className="booking-filter-row-3" style={{ marginTop: 16 }}>
            <div>
              <label>เวลาไป</label>
              <input
                id="filter_start_datetime"
                type="text"
                lang="en-GB"
                placeholder="เลือกเวลาไป"
              />
            </div>

            <div>
              <label>เวลากลับ</label>
              <input
                id="filter_end_datetime"
                type="text"
                lang="en-GB"
                placeholder="เลือกเวลากลับ"
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
          </div>

          <div className="booking-create-wrapper">
            {canCreateBookings && (
              <button
                type="button"
                disabled={Boolean(processingAction)}
                onClick={handleCreateBooking}
              >
                ➕ เพิ่มรายการจองใหม่
              </button>
            )}
          </div>
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
                      <th>เวลาไป</th>
                      <th>เวลากลับ</th>
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
                          canViewBookingDetail={canViewBookingDetail}
                          canProcessBookings={canProcessBookings}
                          canCancelBookings={canCancelBookings}
                          canEditBookings={canEditBookings}
                          processing={
                            processingAction?.bookingId === booking.booking_id
                              ? processingAction.type
                              : ""
                          }
                          onViewDetail={handleViewBookingDetail}
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
                            <td style={{ maxWidth: 240, whiteSpace: "normal", wordBreak: "break-word", fontSize: 20}}>
                              {booking.staff_note || "-"}
                            </td>
                            <td className="action-buttons">
                              {canShowProcess && (
                                <button type="button" onClick={() => handleProcessBooking(booking)}>
                                  {status === "APPROVED" ? "เปลี่ยนคนขับ/รถ" : "อนุมัติ"}
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



