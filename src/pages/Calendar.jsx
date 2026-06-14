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
    today: "📅 วันนี้",
    previous: "◀ ก่อนหน้า",
    next: "ถัดไป ▶",
  },
  en: {
    today: "📅 Today",
    previous: "◀ Previous",
    next: "Next ▶",
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
  if (raw.toLowerCase() === "holiday" || raw === "ลา" || raw === "ลา / หยุด") return "ลา / หยุด";
  if (
    raw.toLowerCase() === "unable to complete a task." ||
    raw === "หยุด" ||
    raw === "ติดภารกิจ (ชั่วคราว)"
  ) {
    return "ติดภารกิจ (ชั่วคราว)";
  }
  if (
    raw.toUpperCase() === "OUT_PROVINCE" ||
    raw === "ปฏิบัติงานต่างจังหวัด" ||
    raw.toUpperCase() === "OTHER"
  ) {
    return "ปฏิบัติงานต่างจังหวัด";
  }
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
  return {
    label: normalized || "ลา / หยุด",
    className: "red",
    backgroundColor: "#fee2e2",
    borderColor: "#fca5a5",
    color: "#991b1b",
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

function formatSelectedThaiDate(date) {
  const safeDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(safeDate.getTime())) return "-";

  return `วันที่ ${safeDate.getDate()} ${THAI_MONTH_LABELS[safeDate.getMonth()]} ${safeDate.getFullYear() + 543}`;
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

function getCalendarMonthRange(date) {
  const safeDate = date instanceof Date ? date : new Date(date || Date.now());
  const monthStart = new Date(safeDate.getFullYear(), safeDate.getMonth(), 1);
  const monthEnd = new Date(safeDate.getFullYear(), safeDate.getMonth() + 1, 0);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

  const days = [];
  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor.setDate(cursor.getDate() + 1)) {
    days.push(new Date(cursor));
  }

  return days;
}

function getMobileEventShortLabel(event) {
  const resource = event?.resource || {};
  const kind = String(resource.kind || "").trim().toLowerCase();

  if (kind === "unavailable") {
    return normalizeUnavailableType(resource.type) || "ไม่รับงาน";
  }

  const destination = String(resource.destination || "").trim();
  const requester = String(resource.requester_name || "").trim();
  const fallback = destination || requester || String(event?.title || "").trim() || "รายการจอง";

  return fallback.length > 18 ? `${fallback.slice(0, 18)}...` : fallback;
}

function getMobileEventStatusClassName(event) {
  const resource = event?.resource || {};
  if (String(resource.kind || "").trim().toLowerCase() === "unavailable") {
    return "red";
  }
  return getBookingCalendarStatusMeta(resource.status).className || "blue";
}

const MobileMonthCalendar = memo(function MobileMonthCalendar({
  calendarDate,
  calendarLang,
  selectedDate,
  onSelectDate,
  visibleCalendarEvents,
  calendarEvents,
  pendingCountByDate,
  thaiHolidayMap,
  onSelectEvent,
}) {
  const weekdayLabels = calendarLang === "en" ? EN_WEEKDAY_LABELS : THAI_WEEKDAY_LABELS;
  const monthDays = useMemo(() => getCalendarMonthRange(calendarDate), [calendarDate]);

  const visibleEventsByDate = useMemo(() => {
    const map = new Map();

    visibleCalendarEvents.forEach((event) => {
      monthDays.forEach((day) => {
        if (!eventOverlapsDay(event, day)) return;

        const key = toCalendarDateKey(day);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(event);
      });
    });

    map.forEach((items, key) => {
      map.set(
        key,
        [...items].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      );
    });

    return map;
  }, [monthDays, visibleCalendarEvents]);

  const selectedDateKey = toCalendarDateKey(selectedDate);
  const selectedDateEvents = useMemo(() => {
    const visibleEvents = visibleEventsByDate.get(selectedDateKey) || [];
    const pendingEvents = calendarEvents
      .filter((event) => {
        const status = String(event.resource?.status || "").toUpperCase();
        return status === "PENDING" && toCalendarDateKey(event.start) === selectedDateKey;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return [...visibleEvents, ...pendingEvents];
  }, [calendarEvents, selectedDateKey, visibleEventsByDate]);

  const selectedDateLabel = formatSelectedThaiDate(selectedDate);

  return (
    <div className="mobile-month-calendar">
      <div className="mobile-month-calendar-grid" role="grid" aria-label="ปฏิทินรายเดือนแบบย่อ">
        {weekdayLabels.map((label) => (
          <div key={label} className="mobile-month-calendar-weekday" role="columnheader">
            {label}
          </div>
        ))}

        {monthDays.map((day) => {
          const dateKey = toCalendarDateKey(day);
          const dayEvents = visibleEventsByDate.get(dateKey) || [];
          const pendingCount = pendingCountByDate.get(dateKey) || 0;
          const overflowCount = Math.max(dayEvents.length - 3, 0);
          const holiday = getThaiHoliday(day, thaiHolidayMap);
          const isSelected = isSameCalendarDate(day, selectedDate);
          const isCurrentMonth = day.getMonth() === calendarDate.getMonth();

          return (
            <button
              key={dateKey}
              type="button"
              className={`mobile-month-calendar-cell${isSelected ? " is-selected" : ""}${isToday(day) ? " is-today" : ""}${!isCurrentMonth ? " is-outside-month" : ""}${holiday ? " is-holiday" : ""}${isWeekend(day) ? " is-weekend" : ""}`}
              onClick={() => onSelectDate(day)}
              title={holiday ? getHolidayTooltipText(holiday, calendarLang) : undefined}
            >
              <div className="mobile-month-calendar-day-row">
                <span className="mobile-month-calendar-day-number">{day.getDate()}</span>
                {pendingCount > 0 && (
                  <span className="mobile-month-calendar-pending-count">+{pendingCount}</span>
                )}
              </div>

              <div className="mobile-month-calendar-event-stack">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={`${dateKey}-${event.id}`}
                    role="button"
                    tabIndex={0}
                    className={`mobile-month-calendar-event-pill ${getMobileEventStatusClassName(event)}`}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      onSelectDate(day);
                      onSelectEvent(event);
                    }}
                    onKeyDown={(keyboardEvent) => {
                      if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                        keyboardEvent.preventDefault();
                        keyboardEvent.stopPropagation();
                        onSelectDate(day);
                        onSelectEvent(event);
                      }
                    }}
                    title={event.title || getMobileEventShortLabel(event)}
                  >
                    {getMobileEventShortLabel(event)}
                  </div>
                ))}

                {overflowCount > 0 && (
                  <span className="mobile-month-calendar-more">+{overflowCount}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mobile-month-calendar-selected">
        <div className="mobile-month-calendar-selected-head">
          <h4>รายการ</h4>
          <span>วันที่ {selectedDateLabel}</span>
        </div>

        {selectedDateEvents.length > 0 ? (
          <div className="mobile-month-calendar-selected-list">
            {selectedDateEvents.map((event, index) => {
              const resource = event.resource || {};
              const isUnavailable = String(resource.kind || "").trim().toLowerCase() === "unavailable";
              const meta = isUnavailable
                ? getUnavailableCalendarStatusMeta(resource.type)
                : getBookingCalendarStatusMeta(resource.status);

              return (
                <button
                  key={`${selectedDateKey}-${event.id || index}`}
                  type="button"
                  className="mobile-month-calendar-selected-item"
                  onClick={() => onSelectEvent(event)}
                >
                  <span className={`mobile-month-calendar-selected-dot ${meta.className || "gray"}`} />
                  <span className="mobile-month-calendar-selected-body">
                    <span className="mobile-month-calendar-selected-title">
                      {event.title || getMobileEventShortLabel(event)}
                    </span>
                    <span className="mobile-month-calendar-selected-meta">{meta.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mobile-month-calendar-empty">ไม่มีรายการที่ต้องแสดงในวันนี้</div>
        )}
      </div>
    </div>
  );
});

const CalendarToolbar = memo(function CalendarToolbar({
  date,
  onNavigate,
  calendarLang,
  onChangeCalendarLang,
}) {
  const toolbarDate = date instanceof Date ? date : new Date(date || Date.now());
  const label = formatCalendarToolbarLabel(toolbarDate, calendarLang);
  const navButtonClassName =
    "calendar-toolbar-button inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-[17px] font-bold text-slate-800 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800 sm:min-h-11 sm:px-4 sm:py-2.5 sm:text-[22px]";
  const langButtonClassName =
    "calendar-toolbar-button calendar-toolbar-lang-button inline-flex min-h-10 min-w-[48px] items-center justify-center whitespace-nowrap rounded-xl border px-3 py-2 text-[16px] font-bold shadow-sm transition sm:min-h-11 sm:min-w-[56px] sm:px-4 sm:py-2.5 sm:text-[20px]";
  const getLangButtonClassName = (lang) =>
    calendarLang === lang
      ? `${langButtonClassName} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`
      : `${langButtonClassName} border-slate-200 bg-white text-slate-800 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800`;

  return (
      <div className="calendar-toolbar flex flex-col gap-2.5 rounded-2xl border border-sky-100 bg-slate-50/80 p-3 sm:gap-3 sm:p-4 lg:gap-4">
        <div className="calendar-toolbar-nav flex flex-wrap items-center gap-2">
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

      <div className="calendar-toolbar-bottom flex min-w-0 items-center justify-between gap-2">
        <div className="calendar-toolbar-label flex min-w-0 flex-1 items-center justify-start gap-2 text-left text-[20px] font-bold leading-tight text-blue-900 sm:justify-center sm:text-center sm:text-[32px]">
          <CalendarMonthIcon className="h-5 w-5 shrink-0 text-sky-700 sm:h-7 sm:w-7" />
          <span className="calendar-toolbar-label-text block min-w-0 truncate">{label}</span>
        </div>

        <div className="calendar-toolbar-lang flex flex-wrap items-center gap-2 self-start sm:self-end lg:self-auto">
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
    </div>
  );
});

// Desktop header
const CalendarDesktopHeader = memo(function CalendarDesktopHeader({
  refreshing,
  loading,
  onRefresh,
}) {
  return (
    <div className="page-header calendar-page-header-v2 flex flex-col gap-2 rounded-2xl border border-sky-100 bg-white px-3 py-3 shadow-sm sm:gap-4 sm:rounded-3xl sm:px-5 sm:py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 sm:flex-wrap sm:items-start sm:gap-3 lg:justify-start">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-800 shadow-sm sm:h-12 sm:w-12">
              <CalendarMonthIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <div className="calendar-page-header-copy min-w-0">
              <h2 className="truncate text-[20px] font-bold leading-tight text-blue-900 sm:text-[34px]">ปฏิทินการจอง</h2>
            </div>
          </div>

          {/* <button
            type="button"
            className="calendar-page-button ml-auto inline-flex min-h-[36px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[15px] font-bold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:min-h-11 sm:w-auto sm:rounded-2xl sm:border-0 sm:bg-blue-700 sm:px-4 sm:py-2.5 sm:text-[24px] sm:text-white sm:hover:bg-blue-800 sm:disabled:bg-slate-300 sm:disabled:text-white"
            disabled={refreshing || loading}
            onClick={onRefresh}
          >
            <RefreshIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            {refreshing ? "กำลังรีเฟรช..." : "รีเฟรชข้อมูล"}
          </button> */}
        </div>
        <div className="mt-2 text-sm leading-relaxed text-slate-500 sm:mt-1 sm:text-[23px] sm:leading-snug">
          รายการจองทั้งหมด และจำนวน พขร. พร้อมปฏิบัติงาน
        </div>
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
  const [isCompactMobileCalendar, setIsCompactMobileCalendar] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(max-width: 375px)").matches;
  });
  const [isMobileCalendarView, setIsMobileCalendarView] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  });
  const [selectedMobileDate, setSelectedMobileDate] = useState(new Date());
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

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 375px)");
    const handleChange = (event) => {
      setIsCompactMobileCalendar(event.matches);
    };

    setIsCompactMobileCalendar(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleChange = (event) => {
      setIsMobileCalendarView(event.matches);
    };

    setIsMobileCalendarView(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    const sameMonth =
      calendarDate instanceof Date &&
      selectedMobileDate instanceof Date &&
      calendarDate.getFullYear() === selectedMobileDate.getFullYear() &&
      calendarDate.getMonth() === selectedMobileDate.getMonth();

    if (!sameMonth) {
      setSelectedMobileDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1));
    }
  }, [calendarDate, selectedMobileDate]);

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
        title: `${normalizeUnavailableType(record.type)}: ${record.driver_name || "-"}`,
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
        backgroundColor:
          resource.kind === "unavailable"
            ? "#fee2e2"
            : undefined,
        borderColor:
          resource.kind === "unavailable"
            ? "#fca5a5"
            : undefined,
        textColor:
          resource.kind === "unavailable"
            ? "#991b1b"
            : undefined,
        classNames: [
          ...(resource.kind === "unavailable"
            ? ["fc-unavailable-event", "red"]
            : [`fc-booking-${String(resource.status || "").toLowerCase()}`]),
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

  const renderCalendarEventContent = useCallback(
    (arg) => {
      const resource = arg.event.extendedProps?.originalEvent?.resource || {};
      const kind = String(resource.kind || "").trim().toLowerCase();
      let compactLabel = arg.event.title || "";

      if (kind === "unavailable") {
        compactLabel = normalizeUnavailableType(resource.type) || arg.event.title || "";
      } else {
        const statusMeta = getBookingCalendarStatusMeta(resource.status);
        const statusLabel = String(statusMeta.label || "").trim();

        if (statusLabel === "รออนุมัติ") compactLabel = "รอ";
        else if (statusLabel === "อนุมัติแล้ว") compactLabel = "อนุมัติ";
        else if (statusLabel === "กำลังใช้งาน") compactLabel = "ใช้งาน";
        else if (statusLabel === "เสร็จสิ้น") compactLabel = "เสร็จ";
        else compactLabel = statusLabel || arg.event.title || "";
      }

      return {
        html: `<div class="calendar-event-title">${isCompactMobileCalendar ? compactLabel : arg.event.title || compactLabel || "-"}</div>`,
      };
    },
    [isCompactMobileCalendar]
  );

  const handleSelectMobileDate = useCallback((date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return;
    setSelectedMobileDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
  }, []);

  return (
    <div className="calendar-page calendar-page-v2 space-y-3 overflow-x-hidden sm:space-y-6">
      <CalendarDesktopHeader
        refreshing={refreshing}
        loading={loading}
        onRefresh={() => loadData({ refreshOnly: true })}
      />

      <BookingFormModal
        ref={bookingFormModalRef}
        overlapCandidates={activeBookings}
        currentUser={currentUser}
        onSuccess={mergeBooking}
        showBackdatedCheckbox={hasPermission(null, "bookings_create_backdated")}
      />

      <div className="form-card overflow-hidden rounded-3xl border border-sky-100 bg-white px-3 py-3 text-[16px] leading-[1.65] shadow-sm sm:px-5 sm:py-5 sm:text-[18px] sm:leading-[1.7] lg:px-6 lg:py-6">
        {visibleLoading ? (
          <CalendarSkeleton />
        ) : (
          <>
            <div className="calendar-status-legend-card mb-3 rounded-2xl border border-sky-100 bg-slate-50/80 p-3 sm:mb-4 sm:p-5">
              <div className="mb-2.5 flex flex-col gap-2.5 sm:mb-3 sm:gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-800 sm:h-11 sm:w-11">
                    <CalendarMonthIcon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                  </span>
                  <div>
                    <h3 className="m-0 text-[22px] font-bold leading-tight text-blue-900 sm:text-[27px]">สถานะที่แสดงในปฏิทิน</h3>
                    <p className="mt-1 text-[17px] leading-snug text-slate-500 sm:text-[22px]">แสดงรายการจองตามสถานะทั้งหมด</p>
                  </div>
                </div>
              </div>
              <div className="calendar-status-legend grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                <span className="status amber border border-amber-200 text-[16px] font-bold sm:text-[20px]">
                  รออนุมัติ
                </span>
                <span className="status blue border border-blue-200 text-[16px] font-bold sm:text-[20px]">
                  อนุมัติแล้ว
                </span>
                <span className="status green border border-emerald-200 text-[16px] font-bold sm:text-[20px]">
                  กำลังใช้งาน
                </span>
                <span className="status red border border-red-200 text-[16px] font-bold sm:text-[20px]">
                  พขร. ไม่รับงาน
                </span>
              </div>
            </div>

            {error && !visibleLoading && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-[18px] font-bold text-red-700 sm:px-4 sm:py-4 sm:text-[23px]">
                {error}
              </div>
            )}

            {!visibleLoading && !error && (
              <div className="calendar-shell overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                <div className="calendar-shell-actions mb-3 flex justify-end">
                  <button
                    type="button"
                    className="calendar-page-button calendar-create-button inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-3.5 py-2 text-[18px] font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:min-h-11 sm:w-auto sm:px-4 sm:py-2.5 sm:text-[24px]"
                    disabled={!canCreateBookings}
                    onClick={() =>
                      openBookingForm({
                        defaultStart: new Date(),
                        defaultEnd: new Date(Date.now() + 60 * 60 * 1000),
                      })
                    }
                  >
                    <PlusIcon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
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

                {isMobileCalendarView ? (
                  <MobileMonthCalendar
                    calendarDate={calendarDate}
                    calendarLang={calendarLang}
                    selectedDate={selectedMobileDate}
                    onSelectDate={handleSelectMobileDate}
                    visibleCalendarEvents={visibleCalendarEvents}
                    calendarEvents={calendarEvents}
                    pendingCountByDate={pendingCountByDate}
                    thaiHolidayMap={thaiHolidayMap}
                    onSelectEvent={handleSelectEvent}
                  />
                ) : (
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
                    eventContent={renderCalendarEventContent}
                    fixedWeekCount={false}
                    showNonCurrentDates={true}
                    headerToolbar={false}
                    dayCellContent={dayCellContent}
                    dayCellClassNames={dayCellClassNames}
                  />
                )}

                {calendarEvents.length === 0 && (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-[17px] text-slate-500 sm:px-4 sm:py-4 sm:text-[22px]">
                    ไม่มีรายการที่ต้องแสดงในช่วงนี้
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {(canViewActiveDriversSummary || canViewNextQueueDriver) && (
        <div className="form-card rounded-3xl border border-sky-100 bg-white px-3 py-3 shadow-sm sm:px-5 sm:py-5 lg:px-6 lg:py-6">
          <div
            className={`calendar-info-grid grid gap-3 sm:gap-4 ${
              canViewActiveDriversSummary && canViewNextQueueDriver ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"
            }`}
          >
            {canViewActiveDriversSummary && (
              <div className="calendar-summary-card flex min-w-0 flex-col gap-3 rounded-3xl border border-emerald-100 p-3 shadow-sm sm:gap-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 sm:h-12 sm:w-12">
                      <UsersIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </span>

                    <h4 className="m-0 truncate text-[21px] font-bold leading-tight text-blue-900 sm:text-[28px]">
                      พขร. พร้อมปฏิบัติงาน
                    </h4>
                  </div>

                  <span className="status green calendar-summary-chip shrink-0 border border-emerald-200 text-[14px] font-bold sm:text-[22px]">
                    จำนวน {activeDriversNow.length} คน
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {activeDriversNow.length > 0 ? (
                    activeDriversNow.map((driver) => (
                      <span
                        key={driver.user_id}
                        className="status blue calendar-summary-chip border border-blue-200 text-[16px] font-bold sm:text-[21px]"
                      >
                        {driver.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[17px] text-slate-500 sm:text-[22px]">
                      ไม่มีคนขับที่พร้อมรับงานในตอนนี้
                    </span>
                  )}
                </div>
              </div>
            )}

            {canViewNextQueueDriver && (
              <div className="calendar-summary-card flex min-w-0 flex-col gap-3 rounded-3xl border border-sky-100 bg-sky-50/70 p-3 shadow-sm sm:gap-4 sm:p-5">
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-800 sm:h-12 sm:w-12">
                    <ListOrderedIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </span>
                  <div>
                    <h4 className="m-0 text-[21px] font-bold leading-tight text-blue-900 sm:text-[28px]">ลำดับคิวทั้งหมด</h4>
                    <p className="mt-1 text-[17px] leading-snug text-slate-500 sm:text-[22px]">แสดงคิวปัจจุบันและคิวถัดไปของ พขร.</p>
                  </div>
                </div>

                <div className="grid gap-2.5 sm:gap-3">
                  <div className="calendar-queue-card rounded-2xl border border-slate-200 bg-white px-3 py-3 text-[16px] text-slate-600 shadow-sm sm:px-4 sm:text-[21px]">
                    คิวปัจจุบัน: <span className="font-bold text-slate-900">{currentQueueDriver ? currentQueueDriver.driver_name : "-"}</span>
                  </div>
                  <div className="calendar-queue-card rounded-2xl border border-slate-200 bg-white px-3 py-3 text-[16px] text-slate-600 shadow-sm sm:px-4 sm:text-[21px]">
                    คิวถัดไป: <span className="font-bold text-slate-900">{nextQueueDriver ? nextQueueDriver.driver_name : "-"}</span>
                  </div>
                  {activeQueueRows.length > 0 ? (
                    <div className="grid gap-2 sm:gap-2.5">
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
                            className={`calendar-queue-row flex flex-col items-start gap-2 rounded-2xl border bg-white px-3 py-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-4 ${
                              isCurrent
                                ? "border-emerald-300"
                                : isNext
                                  ? "border-sky-300"
                                  : "border-slate-200"
                            }`}
                          >
                            <span className="status blue calendar-summary-chip border border-blue-200 text-[15px] font-bold sm:text-[20px]">
                              {row.queue_order}
                            </span>
                            <span className="flex-1 text-[17px] font-bold text-slate-900 sm:text-[22px]">
                              {row.driver_name}
                            </span>
                            {isCurrent && (
                              <span className="status green calendar-summary-chip border border-emerald-200 text-[14px] font-bold sm:text-[18px]">
                                คิวปัจจุบัน
                              </span>
                            )}
                            {isNext && (
                              <span className="status blue calendar-summary-chip border border-blue-200 text-[14px] font-bold sm:text-[18px]">
                                คิวถัดไป
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[17px] text-slate-500 sm:text-[22px]">ยังไม่มีข้อมูลคิวคนขับ</div>
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
