import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import {
  getBookings,
  getDriverQueue,
  getDriverUnavailable,
  getThaiHolidays,
  getUsers,
  getVehicles,
} from "../api";
import { hasPermission } from "../permissions";
import BookingFormModal from "../components/booking/BookingFormModal";
import CalendarSkeleton from "../components/skeletons/CalendarSkeleton";
import useMinimumLoading from "../hooks/useMinimumLoading";
import { formatThaiDateTime } from "../utils/date";
import { FEATURES } from "../config/features";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import thLocale from "@fullcalendar/core/locales/th";

const CALENDAR_MESSAGES = {
 th: {
    today: "วันนี้",
    previous: "ก่อนหน้า",
    next: "ถัดไป",
  },
  en: {
    today: "Today",
    previous: "Previous",
    next: "Next",
  },
  month: "เดือน",
  week: "สัปดาห์",
  day: "วัน",
  agenda: "กำหนดการ",
  date: "วันที่",
  time: "เวลา",
  event: "รายการจอง",
  allDay: "ทั้งวัน",
  showMore: (total) => `+${total} รายการ`,
  noEventsInRange: "ไม่มีรายการในช่วงนี้",
};

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function normalizeUnavailableType(type) {
  const raw = String(type || "").trim();
  if (!raw) return "ลา / หยุด";
  if (raw.toUpperCase() === "OTHER") return "OTHER";
  return raw;
}

function getBookingCalendarStatusMeta(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "PENDING") {
    return {
      label: "รออนุมัติ",
      className: "amber",
      color: "#b45309",
      backgroundColor: "#fef3c7",
      borderColor: "#fcd34d",
    };
  }

  if (normalized === "IN_USE") {
    return {
      label: "กำลังใช้งาน",
      className: "green",
      color: "#166534",
      backgroundColor: "#dcfce7",
      borderColor: "#86efac",
    };
  }

  if (normalized === "COMPLETED") {
    return {
      label: "เสร็จสิ้น",
      className: "gray",
      color: "#475569",
      backgroundColor: "#e2e8f0",
      borderColor: "#cbd5e1",
    };
  }

  return {
    label: "อนุมัติแล้ว",
    className: "blue",
    color: "#1d4ed8",
    backgroundColor: "#dbeafe",
    borderColor: "#93c5fd",
  };
}

function getUnavailableCalendarStatusMeta(type) {
  const normalized = normalizeUnavailableType(type);

  if (normalized === "ลา / หยุด") {
    return {
      label: "ลา / หยุด",
      className: "red",
      backgroundColor: "#fee2e2",
      borderColor: "#fca5a5",
      color: "#991b1b",
    };
  }

  if (normalized === "ติดภารกิจ (ชั่วคราว)") {
    return {
      label: "ติดภารกิจ (ชั่วคราว)",
      className: "amber",
      backgroundColor: "#fef3c7",
      borderColor: "#fcd34d",
      color: "#92400e",
    };
  }

  return {
    label: "อื่นๆ",
    className: "purple",
    backgroundColor: "#ede9fe",
    borderColor: "#c4b5fd",
    color: "#6d28d9",
  };
}

function getStatusBadgeHtml(meta) {
  return `
    <span class="calendar-modal-status-badge ${meta.className || "gray"}">
      ${meta.label || "-"}
    </span>
  `;
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

function getVehicleLabel(booking, vehicleMap) {
  const vehicleId = String(booking.vehicle_id || "").trim();
  if (!vehicleId) return "-";

  const vehicle = vehicleMap.get(vehicleId);
  if (!vehicle) return vehicleId;

  const vehicleType = getVehicleTypeText(
    vehicle.vehicle_type || booking.vehicle_type || booking.vehicle_type_request || ""
  );

  const plate = vehicle.license_plate || vehicle.plate_no || "-";
  return `${vehicleType} / ${plate}`;
}

function getDriverLabel(booking) {
  return booking.assigned_user_name || booking.driver_name || "-";
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isTimeOverlap(startA, endA, startB, endB) {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();
  return aStart < bEnd && bStart < aEnd;
}

function formatBuddhistMonthLabel(date) {
  const safeDate = date instanceof Date ? date : new Date(date);
  return `${THAI_MONTH_LABELS[safeDate.getMonth()]} ${safeDate.getFullYear() + 543}`;
}

function formatGregorianMonthLabel(date) {
  const safeDate = date instanceof Date ? date : new Date(date);
  return `${EN_MONTH_LABELS[safeDate.getMonth()]} ${safeDate.getFullYear()}`;
}

function formatCalendarToolbarLabel(date, calendarLang) {
  return calendarLang === "en" ? formatGregorianMonthLabel(date) : formatBuddhistMonthLabel(date);
}

const THAI_WEEKDAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const EN_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const THAI_MONTH_LABELS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const EN_MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getThaiHolidayKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function normalizeHolidayDateKey(value) {
  if (!value) return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return getThaiHolidayKey(value);
  }

  const raw = String(value).trim();

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${Number(month)}-${Number(day)}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return getThaiHolidayKey(parsed);
  }

  return raw;
}

function getThaiHoliday(date, holidayMap) {
  return holidayMap.get(getThaiHolidayKey(date)) || null;
}

function toCalendarDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDaysToDateKey(value, days) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  date.setDate(date.getDate() + days);
  return toCalendarDateKey(date);
}

function isMultiDayEvent(start, end) {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false;

  return (
    startDate.getFullYear() !== endDate.getFullYear() ||
    startDate.getMonth() !== endDate.getMonth() ||
    startDate.getDate() !== endDate.getDate()
  );
}

function isWeekend(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isToday(date) {
  return isSameCalendarDate(date, new Date());
}

function eventOverlapsDay(event, day) {
  if (!event?.start || !event?.end) return false;

  const eventStart = event.start instanceof Date ? event.start : new Date(event.start);
  const eventEnd = event.end instanceof Date ? event.end : new Date(event.end);
  if (Number.isNaN(eventStart.getTime()) || Number.isNaN(eventEnd.getTime())) return false;

  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  return eventStart <= dayEnd && eventEnd >= dayStart;
}

function isSameCalendarDate(a, b) {
  return (
    a instanceof Date &&
    b instanceof Date &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getHolidayTooltipText(holiday, calendarLang) {
  if (!holiday) return "";

  if (calendarLang === "en") {
    const name = holiday.name_en || holiday.name_th || "";
    const type = holiday.type_en || holiday.type_th || "";
    return type ? `${name} (${type})` : name;
  }

  const name = holiday.name_th || holiday.name_en || "";
  const type = holiday.type_th || holiday.type_en || "";
  return type ? `${name} (${type})` : name;
}

const CalendarToolbar = memo(function CalendarToolbar({
  date,
  onNavigate,
  calendarLang,
  onChangeCalendarLang,
}) {
  const toolbarDate = date instanceof Date ? date : new Date(date || Date.now());
  const label = formatCalendarToolbarLabel(toolbarDate, calendarLang);

  const buttonStyle = {
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 20,
    fontWeight: "bold",
    cursor: "pointer",
  };

  const activeButtonStyle = {
    background: "#16a34a",
    borderColor: "#16a34a",
    color: "#fff",
  };

  return (
    <div
      className="calendar-toolbar"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button type="button" style={buttonStyle} onClick={() => onNavigate("TODAY")}>
          {CALENDAR_MESSAGES[calendarLang].today}
        </button>
        <button type="button" style={buttonStyle} onClick={() => onNavigate("PREV")}>
          {CALENDAR_MESSAGES[calendarLang].previous}
        </button>
        <button type="button" style={buttonStyle} onClick={() => onNavigate("NEXT")}>
          {CALENDAR_MESSAGES[calendarLang].next}
        </button>
      </div>

      <div
        className="calendar-toolbar-label"
        style={{
          flex: "1 1 240px",
          textAlign: "center",
          color: "#0f172a",
          fontSize: 30,
          fontWeight: 700,
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>

        <button
          type="button"
          style={{
            ...buttonStyle,
            ...(calendarLang === "th" ? activeButtonStyle : null),
            minWidth: 52,
          }}
          onClick={() => onChangeCalendarLang("th")}
        >
          TH
        </button>
        <button
          type="button"
          style={{
            ...buttonStyle,
            ...(calendarLang === "en" ? activeButtonStyle : null),
            minWidth: 52,
          }}
          onClick={() => onChangeCalendarLang("en")}
        >
          EN
        </button>
    </div>
  );
});

export default function CalendarPage() {
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [users, setUsers] = useState([]);
  const [thaiHolidays, setThaiHolidays] = useState([]);
  const [driverUnavailableRecords, setDriverUnavailableRecords] = useState([]);
  const [driverQueueRows, setDriverQueueRows] = useState([]);
  const [driverQueueState, setDriverQueueState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarLang, setCalendarLang] = useState("th");
  const visibleLoading = useMinimumLoading(loading, 350);
  const bookingFormModalRef = useRef(null);
  const fullCalendarRef = useRef(null);

  const mergeBooking = useCallback((nextBooking) => {
    if (!nextBooking?.booking_id) return;

    setBookings((current) => {
      const bookingId = String(nextBooking.booking_id || "").trim();
      const index = current.findIndex((booking) => String(booking.booking_id || "").trim() === bookingId);

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

  const handleNavigate = useCallback((nextDate) => {
    if (nextDate === "TODAY") {
      setCalendarDate(new Date());
      return;
    }

    if (nextDate === "PREV") {
      setCalendarDate((currentDate) => new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
      return;
    }

    if (nextDate === "NEXT") {
      setCalendarDate((currentDate) => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
      return;
    }

    if (nextDate instanceof Date) {
      setCalendarDate(nextDate);
    }
  }, []);

  useEffect(() => {
    const calendarApi = fullCalendarRef.current?.getApi?.();
    if (calendarApi && calendarDate instanceof Date) {
      calendarApi.gotoDate(calendarDate);
    }
  }, [calendarDate]);

  const vehicleMap = useMemo(() => {
    const map = new Map();
    vehicles.forEach((vehicle) => {
      map.set(String(vehicle.vehicle_id || "").trim(), vehicle);
    });
    return map;
  }, [vehicles]);

  const driverNameByUserId = useMemo(() => {
    const map = new Map();
    users.forEach((user) => {
      if (normalizeStatus(user.role) !== "DRIVER") return;

      const id = String(user.user_id || "").trim();
      const name = String(user.name || user.full_name || user.display_name || "").trim();
      if (id && name) {
        map.set(id, name);
      }
    });
    return map;
  }, [users]);

  const thaiHolidayMap = useMemo(() => {
    const map = new Map();
    thaiHolidays.forEach((holiday) => {
      const key = normalizeHolidayDateKey(holiday.date);
      if (key) {
        map.set(key, holiday);
      }
    });
    return map;
  }, [thaiHolidays]);

  const canViewActiveDriversSummary = hasPermission(null, "calendar_active_drivers_view");
  const canViewNextQueueDriver = hasPermission(null, "calendar_next_queue_driver_view");
  const canCreateBookings = hasPermission(null, "bookings_create");

  const openBookingForm = useCallback(
    async (options = {}) => {
      if (!canCreateBookings) {
        await Swal.fire({
          icon: "warning",
          title: "คุณไม่มีสิทธิ์เพิ่มรายการจอง",
          confirmButtonText: "ปิด",
          confirmButtonColor: "#334155",
        });
        return;
      }

      await bookingFormModalRef.current?.openCreate(options);
    },
    [canCreateBookings]
  );

  const loadData = useCallback(async (options = {}) => {
    try {
      if (options.refreshOnly) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const [bookingData, vehicleData, userData, holidayData, unavailableData, queueData] = await Promise.all([
        getBookings(options.refreshOnly ? { fresh: true } : {}),
        FEATURES.vehicleModule ? getVehicles() : Promise.resolve([]),
        getUsers(),
        getThaiHolidays(options.refreshOnly ? { fresh: true } : {}),
        getDriverUnavailable(options.refreshOnly ? { fresh: true } : {}),
        getDriverQueue(options.refreshOnly ? { fresh: true } : {}),
      ]);

      setBookings(Array.isArray(bookingData) ? bookingData : []);
      setVehicles(Array.isArray(vehicleData) ? vehicleData : []);
      setUsers(Array.isArray(userData) ? userData : []);
      setThaiHolidays(
        Array.isArray(holidayData)
          ? holidayData.filter((holiday) => normalizeStatus(holiday.status) !== "INACTIVE")
          : []
      );
      setDriverUnavailableRecords(
        Array.isArray(unavailableData)
          ? unavailableData.filter((record) => normalizeStatus(record.status) === "ACTIVE")
          : []
      );
      setDriverQueueRows(Array.isArray(queueData?.data) ? queueData.data : []);
      setDriverQueueState(queueData?.state || null);
    } catch (err) {
      const message = err.message || "โหลดข้อมูลไม่สำเร็จ";
      setError(message);
      setBookings([]);
      setVehicles([]);
      setUsers([]);
      setThaiHolidays([]);
      setDriverUnavailableRecords([]);
      setDriverQueueRows([]);
      setDriverQueueState(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeBookings = useMemo(
    () =>
      bookings
        .filter((booking) => {
          const status = normalizeStatus(booking.status);
          return status === "PENDING" || status === "APPROVED" || status === "IN_USE";
        })
        .sort((a, b) => {
          const dateA = new Date(a.start_datetime || a.created_at || 0).getTime();
          const dateB = new Date(b.start_datetime || b.created_at || 0).getTime();
          return dateA - dateB;
        }),
    [bookings]
  );

  const unavailableEvents = useMemo(
    () =>
      driverUnavailableRecords.map((record) => ({
        id: record.unavailable_id,
        title: `${record.type || "ลา / หยุด"}: ${record.driver_name || "-"}`,
        start: parseDate(record.start_datetime),
        end: parseDate(record.end_datetime),
        allDay: true,
        resource: {
          ...record,
          kind: "unavailable",
          original_start_datetime: record.start_datetime,
          original_end_datetime: record.end_datetime,
        },
      })),
    [driverUnavailableRecords]
  );

  const bookingEvents = useMemo(
    () =>
      activeBookings.map((booking) => ({
        id: booking.booking_id,
        title: `${booking.requester_name || "-"} - ${
          String(booking.destination || "-").length > 20
            ? `${String(booking.destination).substring(0, 50)}...`
            : booking.destination || "-"
        }`,
        start: parseDate(booking.start_datetime),
        end: parseDate(booking.end_datetime),
        allDay: true,
        resource: {
          ...booking,
          kind: "booking",
          original_start_datetime: booking.start_datetime,
          original_end_datetime: booking.end_datetime,
        },
      })),
    [activeBookings]
  );

  const calendarEvents = useMemo(
    () => [...bookingEvents, ...unavailableEvents].filter((event) => event.start && event.end),
    [bookingEvents, unavailableEvents]
  );

  const visibleCalendarEvents = useMemo(() => {
    return calendarEvents.filter((event) => {
      const status = String(event.resource?.status || "").toUpperCase();
      const kind = String(event.resource?.kind || "").toLowerCase();

      if (kind === "unavailable") return true;

      return ["APPROVED", "IN_USE"].includes(status);
    });
  }, [calendarEvents]);

  const pendingCountByDate = useMemo(() => {
    const map = new Map();

    calendarEvents.forEach((event) => {
      const status = String(event.resource?.status || "").toUpperCase();

      if (status !== "PENDING") return;

      const key = toCalendarDateKey(event.start);

      map.set(key, (map.get(key) || 0) + 1);
    });

    return map;
  }, [calendarEvents]);

  const fullCalendarEvents = useMemo(() => {
    return visibleCalendarEvents.map((event) => {
      const resource = event.resource || {};
      const startDateKey = toCalendarDateKey(event.start);

      const rawEnd = event.end instanceof Date
        ? new Date(event.end)
        : new Date(event.end);

      rawEnd.setHours(0, 0, 0, 0);

      const exclusiveEnd = new Date(rawEnd);
      exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);

      const endDateKey = toCalendarDateKey(exclusiveEnd);

      return {
        id: `${resource.kind || "event"}-${event.id || event.title}-${toCalendarDateKey(event.start)}-${toCalendarDateKey(event.end)}`,
        title: event.title,
        start: startDateKey,
        end: endDateKey,
        allDay: true,
        extendedProps: {
          originalEvent: event,
          kind: resource.kind || "booking",
          status: resource.status || "",
        },
        classNames: [
          resource.kind === "unavailable"
            ? "fc-unavailable-event"
            : `fc-booking-${String(resource.status || "").toLowerCase()}`,
        ],
      };
    });
  }, [visibleCalendarEvents]);

  const activeDriversNow = useMemo(() => {
    const now = new Date();
    const activeDrivers = users.filter((user) => normalizeStatus(user.role) === "DRIVER" && normalizeStatus(user.status) === "ACTIVE");

    const unavailableNow = driverUnavailableRecords.filter((record) => {
      return (
        normalizeStatus(record.status) === "ACTIVE" &&
        isTimeOverlap(now, now, record.start_datetime, record.end_datetime)
      );
    });

    const unavailableDriverIds = new Set(
      unavailableNow.map((record) => String(record.driver_user_id || "").trim()).filter(Boolean)
    );
    const unavailableDriverNames = new Set(
      unavailableNow.map((record) => String(record.driver_name || "").trim()).filter(Boolean)
    );

    const availableDrivers = activeDrivers.filter((driver) => {
      const driverId = String(driver.user_id || "").trim();
      const driverName = String(driver.name || "").trim();
      return !unavailableDriverIds.has(driverId) && !unavailableDriverNames.has(driverName);
    });

    return availableDrivers;
  }, [driverUnavailableRecords, users]);

  const activeQueueRows = useMemo(() => {
    return [...driverQueueRows]
      .filter(
        (row) =>
          String(row.status || "").trim().toUpperCase() === "ACTIVE" &&
          String(row.driver_status || "").trim().toUpperCase() === "ACTIVE"
      )
      .map((row) => ({
        ...row,
        driver_name:
          driverNameByUserId.get(String(row.driver_user_id || "").trim()) ||
          String(row.driver_name || "").trim() ||
          "-",
      }))
      .sort((a, b) => {
        const orderA = Number(a.queue_order || 0);
        const orderB = Number(b.queue_order || 0);
        if (orderA !== orderB) return orderA - orderB;
        return String(a.driver_name || "").localeCompare(String(b.driver_name || ""), "th");
      });
  }, [driverNameByUserId, driverQueueRows]);

  const currentQueueIndex = useMemo(() => {
    if (activeQueueRows.length === 0) return -1;

    const currentIndex = activeQueueRows.findIndex(
      (row) => String(row.driver_user_id || "") === String(driverQueueState?.current_driver_user_id || "")
    );
    return currentIndex >= 0 ? currentIndex : 0;
  }, [activeQueueRows, driverQueueState?.current_driver_user_id]);

  const currentQueueDriver = useMemo(() => {
    if (currentQueueIndex < 0) return null;
    return activeQueueRows[currentQueueIndex] || null;
  }, [activeQueueRows, currentQueueIndex]);

  const nextQueueDriver = useMemo(() => {
    if (activeQueueRows.length === 0) return null;
    return activeQueueRows[(currentQueueIndex + 1) % activeQueueRows.length] || activeQueueRows[0] || null;
  }, [activeQueueRows, currentQueueIndex]);

  const handleShowMoreEvents = useCallback(async (events, date) => {
    const titleDate = formatThaiDateTime(date).split(" ")[0];

    const rows = [...events]
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .map((event, index) => {
        const resource = event.resource || {};
        const isUnavailable = resource.kind === "unavailable";
        const displayStart = resource.original_start_datetime || event.start;
        const displayEnd = resource.original_end_datetime || event.end;
        const meta = isUnavailable
          ? getUnavailableCalendarStatusMeta(resource.type)
          : getBookingCalendarStatusMeta(resource.status);

        return `
        <div style="padding:12px;border-bottom:1px solid #e2e8f0;text-align:left;">
          <div style="font-weight:700;color:#0f172a;">
            ${index + 1}. ${event.title || "-"}
          </div>
          <div style="margin-top:6px;color:#475569;">
            สถานะ: ${getStatusBadgeHtml(meta)}
          </div>
          <div style="margin-top:4px;color:#475569;">
            เวลา: ${formatThaiDateTime(displayStart)} - ${formatThaiDateTime(displayEnd)}
          </div>
          ${
            isUnavailable
              ? `<div style="margin-top:4px;color:#475569;">คนขับ: ${resource.driver_name || "-"}</div>`
              : `
                <div style="margin-top:4px;color:#475569;">ปลายทาง: ${resource.destination || "-"}</div>
                <div style="margin-top:4px;color:#475569;">คนขับ: ${getDriverLabel(resource)}</div>
              `
          }
        </div>
      `;
      })
      .join("");

    await Swal.fire({
      title: `รายการวันที่ ${titleDate}`,
      html: `<div style="max-height:520px;overflow:auto;">${rows}</div>`,
      width: 760,
      confirmButtonText: "ปิด",
      confirmButtonColor: "#1455c8",
    });
  }, []);

  const handleSelectEvent = useCallback(async (event) => {
    const resource = event.resource;

    if (resource.kind === "unavailable") {
      const meta = getUnavailableCalendarStatusMeta(resource.type);
      const displayStart = resource.original_start_datetime || resource.start_datetime;
      const displayEnd = resource.original_end_datetime || resource.end_datetime;
      await Swal.fire({
        title: "รายละเอียดวันไม่รับงาน",
        html: `
          <div style="text-align:left;font-size:25px;line-height:1.7;color:#1f2937">
            <div><b>คนขับ:</b> ${resource.driver_name || "-"}</div>
            <div><b>ประเภท:</b> ${getStatusBadgeHtml(meta)}</div>
            <div><b>เหตุผล:</b> ${resource.reason || "-"}</div>
            <div><b>เวลาเริ่ม:</b> ${formatThaiDateTime(displayStart)}</div>
            <div><b>เวลาสิ้นสุด:</b> ${formatThaiDateTime(displayEnd)}</div>
            <div><b>สถานะ:</b> ${normalizeStatus(resource.status)}</div>
          </div>
        `,
        confirmButtonText: "ปิด",
        confirmButtonColor: "#334155",
        width: 560,
        buttonsStyling: true,
      });
      return;
    }

    const booking = resource;
    const meta = getBookingCalendarStatusMeta(booking.status);
    const displayStart = booking.original_start_datetime || booking.start_datetime;
    const displayEnd = booking.original_end_datetime || booking.end_datetime;

    await Swal.fire({
      title: "รายละเอียดการจอง",
      html: `
        <div style="text-align:left;font-size:25px;line-height:1.7;color:#1f2937">
          <div><b>ผู้จอง:</b> ${booking.requester_name || "-"}</div>
          <div><b>วันเวลาเริ่ม:</b> ${formatThaiDateTime(displayStart)}</div>
          <div><b>วันเวลาสิ้นสุด:</b> ${formatThaiDateTime(displayEnd)}</div>
          <div><b>ปลายทาง:</b> ${booking.destination || "-"}</div>
          ${FEATURES.vehicleModule ? `<div><b>รถ:</b> ${getVehicleLabel(booking, vehicleMap)}</div>` : ""}
          <div><b>คนขับ:</b> ${getDriverLabel(booking)}</div>
          <div><b>สถานะ:</b> ${getStatusBadgeHtml(meta)}</div>
          ${booking.staff_note ? `<div><b>หมายเหตุเจ้าหน้าที่:</b> ${booking.staff_note}</div>` : ""}
        </div>
      `,
      confirmButtonText: "ปิด",
      confirmButtonColor: "#334155",
      width: 560,
      buttonsStyling: true,
    });
  }, [vehicleMap]);

  const handleFullCalendarEventClick = useCallback(
    (info) => {
      const originalEvent = info.event.extendedProps?.originalEvent;
      if (!originalEvent) return;
      handleSelectEvent(originalEvent);
    },
    [handleSelectEvent]
  );

  const handleMoreLinkClick = useCallback(
    (args) => {
      const dayEvents = calendarEvents
        .filter((event) => eventOverlapsDay(event, args.date))
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      handleShowMoreEvents(dayEvents, args.date);
      return "none";
    },
    [calendarEvents, handleShowMoreEvents]
  );

  const handlePendingBadgeClick = useCallback(
    (date) => {
      const dateKey = toCalendarDateKey(date);
      const pendingEvents = calendarEvents
        .filter((event) => {
          const status = String(event.resource?.status || "").toUpperCase();
          return status === "PENDING" && toCalendarDateKey(event.start) === dateKey;
        })
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      handleShowMoreEvents(pendingEvents, date);
    },
    [calendarEvents, handleShowMoreEvents]
  );

  const dayCellClassNames = useCallback(
    (arg) => {
      const classes = [];
      const holiday = getThaiHoliday(arg.date, thaiHolidayMap);

      if (isToday(arg.date)) {
        classes.push("fc-day-today-custom");
      }

      if (holiday) {
        classes.push("fc-thai-holiday");
      }

      if (isWeekend(arg.date)) {
        classes.push("fc-weekend");
      }

      return classes;
    },
    [thaiHolidayMap]
  );

  const dayCellContent = useCallback(
    (arg) => {
      const dateKey = toCalendarDateKey(arg.date);
      const pendingCount = pendingCountByDate.get(dateKey);

      return (
        <div style={{ display: "grid", gap: 4 }}>
          <div className="fc-daygrid-day-number">{arg.dayNumberText}</div>
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handlePendingBadgeClick(arg.date);
              }}
              style={{
                border: "none",
                borderRadius: 6,
                background: "#fef3c7",
                color: "#000000",
                padding: "2px 6px",
                minHeight: 0,
                fontSize: 12,
                fontWeight: 700,
                lineHeight: 1.3,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              +{pendingCount} รออนุมัติ
            </button>
          )}
        </div>
      );
    },
    [handlePendingBadgeClick, pendingCountByDate]
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>ปฏิทินการจอง</h2>
          <p>แสดงทั้งรายการจองทั้งหมดและจำนวน พขร. ปฏิบัติงาน</p>
        </div>

        <button type="button" disabled={refreshing || loading} onClick={() => loadData({ refreshOnly: true })}>
          รีเฟรชข้อมูล
        </button>
      </div>

      <BookingFormModal
        ref={bookingFormModalRef}
        overlapCandidates={activeBookings}
        onSuccess={mergeBooking}
      />



      <div
        className="form-card"
        style={{
          fontSize: "18px",
          lineHeight: 1.7,
        }}
      >
        {visibleLoading ? (
          <CalendarSkeleton />
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <div className="calendar-status-legend" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
                <span className="status amber" style={{ fontSize: 16, padding: "6px 12px" }}>
                  รออนุมัติ
                </span>
                <span className="status blue" style={{ fontSize: 16, padding: "6px 12px" }}>
                  อนุมัติแล้ว
                </span>
                <span className="status green" style={{ fontSize: 16, padding: "6px 12px" }}>
                  กำลังใช้งาน
                </span>
                <span className="status red" style={{ fontSize: 16, padding: "6px 12px" }}>
                  พขร. ติดภารกิจอื่นๆ
                </span>
              </div>
              <div style={{ color: "#475569" }}>
                แสดงรายการจองตามสถานะทั้งหมด
              </div>
            </div>

        {error && !visibleLoading && <div style={{ padding: "24px 0", color: "#b91c1c" }}>{error}</div>}

        {!visibleLoading && !error && (
          <div
            className="calendar-shell"
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              padding: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <button
                type="button"
                style={{
                  backgroundColor: "#1455c8",
                  color: "#fff",
                  border: "none",
                }}
                className="calendar-create-button"
                disabled={!canCreateBookings}
                onClick={() =>
                  openBookingForm({
                    defaultStart: new Date(),
                    defaultEnd: new Date(Date.now() + 60 * 60 * 1000),
                  })
                }
              >
                ➕ เพิ่มรายการจองใหม่
              </button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <CalendarToolbar
                date={calendarDate}
                onNavigate={handleNavigate}
                calendarLang={calendarLang}
                onChangeCalendarLang={setCalendarLang}
              />
            </div>

            <FullCalendar
              ref={fullCalendarRef}
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              height="auto"
              locale={calendarLang === "th" ? "th" : "en"}
              locales={[thLocale]}
              firstDay={0}
              events={fullCalendarEvents}
              eventClick={handleFullCalendarEventClick}
              moreLinkClick={handleMoreLinkClick}
              dayMaxEvents={3}
              eventDisplay="block"
              expandRows={true}
              stickyHeaderDates={true}
              moreLinkContent={(args) => ({
                html: `<div class="calendar-more-pill">+${args.num}</div>`,
              })}
              moreLinkDidMount={(arg) => {
                arg.el.title = "ดูรายการทั้งหมดของวันนี้";
              }}
              fixedWeekCount={false}
              showNonCurrentDates={true}
              headerToolbar={false}
              dayCellContent={dayCellContent}
              dayCellClassNames={dayCellClassNames}
            />

            {calendarEvents.length === 0 && (
              <div style={{ marginTop: 12, color: "#475569" }}>ไม่มีรายการที่ต้องแสดงในช่วงนี้</div>
            )}
          </div>
        )}
          </>
        )}
      </div>
      {(canViewActiveDriversSummary || canViewNextQueueDriver) && (
        <div className="form-card" style={{ marginBottom: 24 }}>
          <div
            className="calendar-info-grid"
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns:
                canViewActiveDriversSummary && canViewNextQueueDriver ? "repeat(2, minmax(0, 1fr))" : "1fr",
            }}
          >
            {canViewActiveDriversSummary && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 16,
                  padding: 18,
                  minWidth: 0,
                }}
              >
                <h4 style={{ marginTop: 0, marginBottom: 0 }}>พขร. ปฏิบัติงาน</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                  <span className="status green" style={{ fontSize: 23, padding: "6px 12px" }}>
                    จำนวน {activeDriversNow.length} คน
                  </span>
                  {activeDriversNow.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {activeDriversNow.map((driver) => (
                        <span key={driver.user_id} className="status blue" style={{ fontSize: 23, padding: "6px 12px" }}>
                          {driver.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: "#64748b" }}>ไม่มีคนขับที่พร้อมรับงานในตอนนี้</span>
                  )}
                </div>
                <div style={{ fontSize: 20, color: "#475569" }}>
                  นับจาก พขร. ที่มีสถานะ พร้อม และไม่มีช่วงวันไม่รับงานที่ทับกับเวลาปัจจุบัน
                </div>
              </div>
            )}

            {canViewNextQueueDriver && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 16,
                  padding: 18,
                  minWidth: 0,
                }}
              >
                {/* <h4 style={{ marginTop: 0, marginBottom: 0 }}>คนขับคิวถัดไป</h4> */}
                {/* <strong style={{ fontSize: 25, lineHeight: 1.2 }}>
                  {nextQueueDriver ? nextQueueDriver.driver_name : "-"}
                </strong> */}

              <div style={{ display: "grid", gap: 10, marginTop: 6 }}>
                  <div style={{ color: "#334155", fontWeight: 700 }}>ลำดับคิวทั้งหมด</div>
                <div style={{ fontSize: 20, color: "#475569" }}>
                  คิวปัจจุบัน: {currentQueueDriver ? currentQueueDriver.driver_name : "-"}
                </div>
                <div style={{ fontSize: 20, color: "#475569" }}>
                  คิวถัดไป: {nextQueueDriver ? nextQueueDriver.driver_name : "-"}
                </div>
                  {activeQueueRows.length > 0 ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {activeQueueRows.map((row) => {
                        const isCurrent =
                          currentQueueDriver &&
                          String(row.driver_user_id || "") === String(currentQueueDriver.driver_user_id || "");
                        const isNext =
                          nextQueueDriver &&
                          String(row.driver_user_id || "") === String(nextQueueDriver.driver_user_id || "");

                        return (
                          <div
                            key={row.queue_id || `${row.driver_user_id || ""}-${row.queue_order || ""}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: 10,
                              padding: "10px 12px",
                              background: "#fff",
                              border: `1px solid ${isCurrent ? "#16a34a" : isNext ? "#60a5fa" : "#e2e8f0"}`,
                              borderRadius: 12,
                            }}
                          >
                            <span
                              className="status blue"
                              style={{
                                minWidth: 56,
                                justifyContent: "center",
                                fontSize: 15,
                                padding: "4px 10px",
                              }}
                            >
                              {row.queue_order}
                            </span>
                            <span style={{ color: "#0f172a", fontWeight: 700, flex: "1 1 auto" }}>
                              {row.driver_name}
                            </span>
                            {isCurrent && (
                              <span
                                className="status green"
                                style={{
                                  fontSize: 15,
                                  padding: "4px 10px",
                                }}
                              >
                                คิวปัจจุบัน
                              </span>
                            )}
                            {isNext && (
                              <span
                                className="status green"
                                style={{
                                  fontSize: 15,
                                  padding: "4px 10px",
                                }}
                              >
                                คิวถัดไป
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ color: "#64748b" }}>ยังไม่มีข้อมูลคิวคนขับ</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
