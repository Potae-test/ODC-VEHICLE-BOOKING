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

function CalendarIcon({ children, className = "h-5 w-5" }) {
  return (
    <span className={`inline-flex items-center justify-center ${className}`} aria-hidden="true">
      {children}
    </span>
  );
}

function RefreshIcon(props) {
  return (
    <CalendarIcon {...props}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-full w-full">
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </CalendarIcon>
  );
}

function PlusIcon(props) {
  return (
    <CalendarIcon {...props}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-full w-full">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    </CalendarIcon>
  );
}

function CalendarMonthIcon(props) {
  return (
    <CalendarIcon {...props}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-full w-full">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4" />
        <path d="M8 2v4" />
        <path d="M3 10h18" />
      </svg>
    </CalendarIcon>
  );
}

function UsersIcon(props) {
  return (
    <CalendarIcon {...props}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-full w-full">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    </CalendarIcon>
  );
}

function ListOrderedIcon(props) {
  return (
    <CalendarIcon {...props}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-full w-full">
        <path d="M10 6h11" />
        <path d="M10 12h11" />
        <path d="M10 18h11" />
        <path d="M4 6h1v4" />
        <path d="M4 10h2" />
        <path d="M6 18H4c0-1 2-2 2-3a1 1 0 0 0-2 0" />
      </svg>
    </CalendarIcon>
  );
}

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

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("odc_user") || "null");
  } catch {
    return null;
  }
}

function isCentralOfficeDriver(user) {
  const userId = String(user?.user_id || "").trim();
  const name = String(user?.name || user?.full_name || user?.display_name || "").trim();

  if (userId === "U007") return true;
  if (!name) return false;

  return name.includes("พขร.สนง.กลาง") || name.includes("สนง.กลาง");
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
  const navButtonClassName =
    "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[22px] font-bold text-slate-800 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800";
  const langButtonClassName =
    "inline-flex min-h-11 min-w-[56px] items-center justify-center rounded-xl border px-4 py-2.5 text-[20px] font-bold shadow-sm transition";
  const getLangButtonClassName = (lang) =>
    calendarLang === lang
      ? `${langButtonClassName} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`
      : `${langButtonClassName} border-slate-200 bg-white text-slate-800 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800`;

  return (
    <div className="calendar-toolbar flex flex-col gap-3 rounded-2xl border border-sky-100 bg-slate-50/80 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={navButtonClassName} onClick={() => onNavigate("TODAY")}>
          {CALENDAR_MESSAGES[calendarLang].today}
        </button>
        <button type="button" className={navButtonClassName} onClick={() => onNavigate("PREV")}>
          {CALENDAR_MESSAGES[calendarLang].previous}
        </button>
        <button type="button" className={navButtonClassName} onClick={() => onNavigate("NEXT")}>
          {CALENDAR_MESSAGES[calendarLang].next}
        </button>
      </div>

      <div className="calendar-toolbar-label flex min-w-0 flex-1 items-center justify-center gap-2 text-center text-[28px] font-bold leading-tight text-blue-900 sm:text-[32px]">
        <CalendarMonthIcon className="h-6 w-6 text-sky-700 sm:h-7 sm:w-7" />
        {label}
      </div>

      <div className="flex flex-wrap items-center gap-2 self-end lg:self-auto">
        <button
          type="button"
          className={getLangButtonClassName("th")}
          onClick={() => onChangeCalendarLang("th")}
        >
          TH
        </button>
        <button
          type="button"
          className={getLangButtonClassName("en")}
          onClick={() => onChangeCalendarLang("en")}
        >
          EN
        </button>
      </div>
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
  const currentUser = useMemo(() => getCurrentUser(), []);

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
    const activeDrivers = users.filter(
      (user) =>
        normalizeStatus(user.role) === "DRIVER" &&
        normalizeStatus(user.status) === "ACTIVE" &&
        !isCentralOfficeDriver(user)
    );

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
        <div className="grid gap-1">
          <div className="fc-daygrid-day-number">{arg.dayNumberText}</div>
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handlePendingBadgeClick(arg.date);
              }}
              className="calendar-pending-pill inline-flex min-h-0 items-center rounded-md border border-amber-200 bg-amber-100 px-2 py-1 text-left text-[12px] font-bold leading-tight text-amber-950 transition hover:bg-amber-200"
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
    <div className="space-y-4 overflow-x-hidden sm:space-y-6">
      <div className="page-header flex flex-col gap-4 rounded-3xl border border-sky-100 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-800 shadow-sm">
              <CalendarMonthIcon className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[34px] font-bold leading-tight text-blue-900">ปฏิทินการจอง</h2>
              <p className="mt-1 text-[23px] leading-snug text-slate-500">
                แสดงทั้งรายการจองทั้งหมดและจำนวน พขร. พร้อมปฏิบัติงาน
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 py-2.5 text-[24px] font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
          disabled={refreshing || loading}
          onClick={() => loadData({ refreshOnly: true })}
        >
          <RefreshIcon className="h-5 w-5" />
          รีเฟรชข้อมูล
        </button>
      </div>

      <BookingFormModal
        ref={bookingFormModalRef}
        overlapCandidates={activeBookings}
        currentUser={currentUser}
        onSuccess={mergeBooking}
        showBackdatedCheckbox={hasPermission(null, "bookings_create_backdated")}
      />

      <div className="form-card overflow-hidden rounded-3xl border border-sky-100 bg-white px-4 py-4 text-[18px] leading-[1.7] shadow-sm sm:px-5 sm:py-5 lg:px-6 lg:py-6">
        {visibleLoading ? (
          <CalendarSkeleton />
        ) : (
          <>
            <div className="mb-4 rounded-2xl border border-sky-100 bg-slate-50/80 p-4 sm:p-5">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-800">
                    <CalendarMonthIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="m-0 text-[27px] font-bold leading-tight text-blue-900">สถานะที่แสดงในปฏิทิน</h3>
                    <p className="mt-1 text-[22px] leading-snug text-slate-500">แสดงรายการจองตามสถานะทั้งหมด</p>
                  </div>
                </div>
              </div>
              <div className="calendar-status-legend flex flex-wrap gap-3">
                <span className="status amber border border-amber-200 text-[20px] font-bold">
                  รออนุมัติ
                </span>
                <span className="status blue border border-blue-200 text-[20px] font-bold">
                  อนุมัติแล้ว
                </span>
                <span className="status green border border-emerald-200 text-[20px] font-bold">
                  กำลังใช้งาน
                </span>
                <span className="status red border border-red-200 text-[20px] font-bold">
                  พขร. ติดภารกิจอื่นๆ
                </span>
              </div>
            </div>

            {error && !visibleLoading && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-[23px] font-bold text-red-700">
                {error}
              </div>
            )}

            {!visibleLoading && !error && (
              <div className="calendar-shell overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    className="calendar-create-button inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 py-2.5 text-[24px] font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
                    disabled={!canCreateBookings}
                    onClick={() =>
                      openBookingForm({
                        defaultStart: new Date(),
                        defaultEnd: new Date(Date.now() + 60 * 60 * 1000),
                      })
                    }
                  >
                    <PlusIcon className="h-5 w-5" />
                    เพิ่มรายการจองใหม่
                  </button>
                </div>
                <div className="mb-3">
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
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-[22px] text-slate-500">
                    ไม่มีรายการที่ต้องแสดงในช่วงนี้
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {(canViewActiveDriversSummary || canViewNextQueueDriver) && (
        <div className="form-card rounded-3xl border border-sky-100 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5 lg:px-6 lg:py-6">
          <div
            className={`calendar-info-grid grid gap-4 ${
              canViewActiveDriversSummary && canViewNextQueueDriver ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"
            }`}
          >
            {canViewActiveDriversSummary && (
              <div className="flex min-w-0 flex-col gap-4 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <UsersIcon className="h-6 w-6" />
                    </span>
                    <h4 className="m-0 text-[28px] font-bold leading-tight text-blue-900">พขร. พร้อมปฏิบัติงาน</h4>
                  </div>
                  <span className="status green border border-emerald-200 text-[22px] font-bold">
                    จำนวน {activeDriversNow.length} คน
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {activeDriversNow.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {activeDriversNow.map((driver) => (
                        <span key={driver.user_id} className="status blue border border-blue-200 text-[21px] font-bold">
                          {driver.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[22px] text-slate-500">ไม่มีคนขับที่พร้อมรับงานในตอนนี้</span>
                  )}
                </div>
              </div>
            )}

            {canViewNextQueueDriver && (
              <div className="flex min-w-0 flex-col gap-4 rounded-3xl border border-sky-100 bg-sky-50/70 p-4 shadow-sm sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-800">
                    <ListOrderedIcon className="h-6 w-6" />
                  </span>
                  <div>
                    <h4 className="m-0 text-[28px] font-bold leading-tight text-blue-900">ลำดับคิวทั้งหมด</h4>
                    <p className="mt-1 text-[22px] leading-snug text-slate-500">แสดงคิวปัจจุบันและคิวถัดไปของ พขร.</p>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[21px] text-slate-600 shadow-sm">
                    คิวปัจจุบัน: <span className="font-bold text-slate-900">{currentQueueDriver ? currentQueueDriver.driver_name : "-"}</span>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[21px] text-slate-600 shadow-sm">
                    คิวถัดไป: <span className="font-bold text-slate-900">{nextQueueDriver ? nextQueueDriver.driver_name : "-"}</span>
                  </div>
                  {activeQueueRows.length > 0 ? (
                    <div className="grid gap-2.5">
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
                            className={`flex flex-wrap items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm ${
                              isCurrent
                                ? "border-emerald-300"
                                : isNext
                                  ? "border-sky-300"
                                  : "border-slate-200"
                            }`}
                          >
                            <span className="status blue border border-blue-200 text-[20px] font-bold">
                              {row.queue_order}
                            </span>
                            <span className="flex-1 text-[22px] font-bold text-slate-900">
                              {row.driver_name}
                            </span>
                            {isCurrent && (
                              <span className="status green border border-emerald-200 text-[18px] font-bold">
                                คิวปัจจุบัน
                              </span>
                            )}
                            {isNext && (
                              <span className="status blue border border-blue-200 text-[18px] font-bold">
                                คิวถัดไป
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[22px] text-slate-500">ยังไม่มีข้อมูลคิวคนขับ</div>
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
