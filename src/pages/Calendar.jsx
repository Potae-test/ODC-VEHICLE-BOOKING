import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import Swal from "sweetalert2";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "moment/locale/th";
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

moment.locale("th");

const localizer = momentLocalizer(moment);

const CALENDAR_MESSAGES = {
  today: "วันนี้",
  previous: "ก่อนหน้า",
  next: "ถัดไป",
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
  if (!raw) return "ลา";
  if (raw.toUpperCase() === "OTHER") return "OTHER";
  return raw;
}

function getBookingCalendarStatusMeta(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "PENDING") {
    return {
      label: "รออนุมัติ",
      className: "amber",
      color: "#92400e",
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

  if (normalized === "ลา") {
    return {
      label: "ลา",
      className: "red",
      backgroundColor: "#fee2e2",
      borderColor: "#fca5a5",
      color: "#991b1b",
    };
  }

  if (normalized === "หยุด") {
    return {
      label: "หยุด",
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
  return `${moment(date).locale("th").format("MMMM")} ${date.getFullYear() + 543}`;
}

function formatGregorianMonthLabel(date) {
  return `${moment(date).locale("en").format("MMMM")} ${date.getFullYear()}`;
}

function formatCalendarToolbarLabel(date, calendarLang) {
  return calendarLang === "en" ? formatGregorianMonthLabel(date) : formatBuddhistMonthLabel(date);
}

const THAI_WEEKDAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const EN_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getThaiHolidayKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function getThaiHoliday(date, holidayMap) {
  return holidayMap.get(getThaiHolidayKey(date)) || null;
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

const CalendarDateCellWrapper = memo(function CalendarDateCellWrapper({
  value,
  children,
  holidayMap,
  calendarLang,
}) {
  const date = value instanceof Date ? value : new Date(value);
  const holiday = getThaiHoliday(date, holidayMap);
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;
  const isHoliday = Boolean(holiday);

  const background = isHoliday ? "#fff7ed" : isWeekend ? "#f8fafc" : "transparent";
  const borderColor = isHoliday ? "#fcd34d" : isWeekend ? "#e2e8f0" : "transparent";

  return (
    <div
      title={getHolidayTooltipText(holiday, calendarLang)}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "100%",
        background,
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        padding: 2,
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
});

const CalendarEvent = memo(function CalendarEvent({ event }) {
  const meta = event.resource.kind === "unavailable"
    ? getUnavailableCalendarStatusMeta(event.resource.type)
    : getBookingCalendarStatusMeta(event.resource.status);

  return (
    <div className="calendar-event">
      <div className="calendar-event-title">{event.title}</div>
      <div className={`calendar-event-status ${meta.className}`}>{meta.label}</div>
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

  const buttonStyle = {
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  };

  const activeButtonStyle = {
    background: "#16a34a",
    borderColor: "#16a34a",
    color: "#fff",
  };

  return (
    <div
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
          {CALENDAR_MESSAGES.today}
        </button>
        <button type="button" style={buttonStyle} onClick={() => onNavigate("PREV")}>
          {CALENDAR_MESSAGES.previous}
        </button>
        <button type="button" style={buttonStyle} onClick={() => onNavigate("NEXT")}>
          {CALENDAR_MESSAGES.next}
        </button>
      </div>

      <div
        style={{
          flex: "1 1 240px",
          textAlign: "center",
          color: "#0f172a",
          fontSize: 24,
          fontWeight: 700,
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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

  const handleNavigate = useCallback((nextDate) => {
    setCalendarDate(nextDate);
  }, []);

  const vehicleMap = useMemo(() => {
    const map = new Map();
    vehicles.forEach((vehicle) => {
      map.set(String(vehicle.vehicle_id || "").trim(), vehicle);
    });
    return map;
  }, [vehicles]);

  const thaiHolidayMap = useMemo(() => {
    const map = new Map();
    thaiHolidays.forEach((holiday) => {
      const key = String(holiday.date || "").trim();
      if (key) {
        map.set(key, holiday);
      }
    });
    return map;
  }, [thaiHolidays]);

  const calendarFormats = useMemo(
    () => ({
      monthHeaderFormat: (date) => formatCalendarToolbarLabel(date, calendarLang),
      weekdayFormat: (date) => {
        const day = date instanceof Date ? date.getDay() : new Date(date).getDay();
        return calendarLang === "en" ? EN_WEEKDAY_LABELS[day] : THAI_WEEKDAY_LABELS[day];
      },
    }),
    [calendarLang]
  );

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
        getVehicles(),
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
        title: `${record.type || "ลา"}: ${record.driver_name || "-"}`,
        start: parseDate(record.start_datetime),
        end: parseDate(record.end_datetime),
        resource: {
          ...record,
          kind: "unavailable",
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
        resource: {
          ...booking,
          kind: "booking",
        },
      })),
    [activeBookings]
  );

  const calendarEvents = useMemo(
    () => [...bookingEvents, ...unavailableEvents].filter((event) => event.start && event.end),
    [bookingEvents, unavailableEvents]
  );

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

  const nextQueueDriver = useMemo(() => {
    const pointer = Number(driverQueueState?.state_value || 0);
    const activeRows = [...driverQueueRows]
      .filter(
        (row) =>
          String(row.status || "").trim().toUpperCase() === "ACTIVE" &&
          String(row.driver_status || "").trim().toUpperCase() === "ACTIVE"
      )
      .sort((a, b) => {
        const orderA = Number(a.queue_order || 0);
        const orderB = Number(b.queue_order || 0);
        if (orderA !== orderB) return orderA - orderB;
        return String(a.driver_name || "").localeCompare(String(b.driver_name || ""), "th");
      });

    if (activeRows.length === 0) return null;
    return activeRows.find((row) => Number(row.queue_order || 0) > pointer) || activeRows[0] || null;
  }, [driverQueueRows, driverQueueState]);

  const activeQueueRows = useMemo(() => {
    return [...driverQueueRows]
      .filter(
        (row) =>
          String(row.status || "").trim().toUpperCase() === "ACTIVE" &&
          String(row.driver_status || "").trim().toUpperCase() === "ACTIVE"
      )
      .sort((a, b) => {
        const orderA = Number(a.queue_order || 0);
        const orderB = Number(b.queue_order || 0);
        if (orderA !== orderB) return orderA - orderB;
        return String(a.driver_name || "").localeCompare(String(b.driver_name || ""), "th");
      });
  }, [driverQueueRows]);

  const eventStyleGetter = useCallback((event) => {
    const meta =
      event.resource.kind === "unavailable"
        ? getUnavailableCalendarStatusMeta(event.resource.type)
        : getBookingCalendarStatusMeta(event.resource.status);

    return {
      style: {
        backgroundColor: meta.backgroundColor,
        border: `1px solid ${meta.borderColor}`,
        color: meta.color,
        borderRadius: "8px",
        padding: "3px 6px",
        fontSize: "17px",
        lineHeight: "1.25",
      },
    };
  }, []);

  const handleSelectEvent = useCallback(async (event) => {
    const resource = event.resource;

    if (resource.kind === "unavailable") {
      const meta = getUnavailableCalendarStatusMeta(resource.type);
      await Swal.fire({
        title: "รายละเอียดวันไม่รับงาน",
        html: `
          <div style="text-align:left;font-size:25px;line-height:1.7;color:#1f2937">
            <div><b>คนขับ:</b> ${resource.driver_name || "-"}</div>
            <div><b>ประเภท:</b> ${meta.label}</div>
            <div><b>เหตุผล:</b> ${resource.reason || "-"}</div>
            <div><b>เวลาเริ่ม:</b> ${formatThaiDateTime(resource.start_datetime)}</div>
            <div><b>เวลาสิ้นสุด:</b> ${formatThaiDateTime(resource.end_datetime)}</div>
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

    await Swal.fire({
      title: "รายละเอียดการจอง",
      html: `
        <div style="text-align:left;font-size:25px;line-height:1.7;color:#1f2937">
          <div><b>ผู้จอง:</b> ${booking.requester_name || "-"}</div>
          <div><b>วันเวลาเริ่ม:</b> ${formatThaiDateTime(booking.start_datetime)}</div>
          <div><b>วันเวลาสิ้นสุด:</b> ${formatThaiDateTime(booking.end_datetime)}</div>
          <div><b>ปลายทาง:</b> ${booking.destination || "-"}</div>
          <div><b>รถ:</b> ${getVehicleLabel(booking, vehicleMap)}</div>
          <div><b>คนขับ:</b> ${getDriverLabel(booking)}</div>
          <div><b>สถานะ:</b> ${meta.label}</div>
          ${booking.staff_note ? `<div><b>หมายเหตุเจ้าหน้าที่:</b> ${booking.staff_note}</div>` : ""}
        </div>
      `,
      confirmButtonText: "ปิด",
      confirmButtonColor: "#334155",
      width: 560,
      buttonsStyling: true,
    });
  }, [vehicleMap]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>ปฏิทินการจอง</h2>
          <p>แสดงทั้งรายการจองที่อนุมัติแล้วและช่วงวันไม่รับงานของคนขับ</p>
        </div>

        <button type="button" disabled={refreshing || loading} onClick={() => loadData({ refreshOnly: true })}>
          รีเฟรชข้อมูล
        </button>
      </div>

      <BookingFormModal
        ref={bookingFormModalRef}
        overlapCandidates={activeBookings}
        onSuccess={() => loadData({ refreshOnly: true })}
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
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
                  วันไม่รับงาน
                </span>
              </div>
              <div style={{ color: "#475569" }}>
                แสดงรายการจอง <b>PENDING</b>, <b>APPROVED</b> และ <b>IN_USE</b> พร้อมวันไม่รับงานของคนขับ
              </div>
            </div>

        {error && !visibleLoading && <div style={{ padding: "24px 0", color: "#b91c1c" }}>{error}</div>}

        {!visibleLoading && !error && calendarEvents.length === 0 && (
          <div style={{ marginBottom: 12, color: "#475569" }}>ไม่มีรายการที่ต้องแสดงในช่วงนี้</div>
        )}

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
                className="calendar-create-button"
                disabled={!canCreateBookings}
                onClick={() =>
                  openBookingForm({
                    defaultStart: new Date(),
                    defaultEnd: new Date(Date.now() + 60 * 60 * 1000),
                  })
                }
              >
                + เพิ่มรายการจอง
              </button>
            </div>
              <Calendar
                localizer={localizer}
              culture={calendarLang}
              date={calendarDate}
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
              style={{ height: 760, fontSize: 16 }}
              selectable={canCreateBookings}
              onNavigate={handleNavigate}
              eventPropGetter={eventStyleGetter}
              formats={calendarFormats}
              components={{
                toolbar: (toolbarProps) => (
                  <CalendarToolbar
                    {...toolbarProps}
                    calendarLang={calendarLang}
                    onChangeCalendarLang={setCalendarLang}
                  />
                ),
                event: CalendarEvent,
                dateCellWrapper: (cellProps) => (
                  <CalendarDateCellWrapper
                    {...cellProps}
                    holidayMap={thaiHolidayMap}
                    calendarLang={calendarLang}
                  />
                ),
              }}
              messages={CALENDAR_MESSAGES}
              popup
              onSelectEvent={handleSelectEvent}
            />
          </div>
        )}
          </>
        )}
      </div>
      {(canViewActiveDriversSummary || canViewNextQueueDriver) && (
        <div className="form-card" style={{ marginBottom: 24 }}>
          <div
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
                <h4 style={{ marginTop: 0, marginBottom: 0 }}>คนขับพร้อมรับงาน</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                  <span className="status green" style={{ fontSize: 23, padding: "6px 12px" }}>
                    พร้อมรับงาน {activeDriversNow.length} คน
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
                  นับจากผู้ใช้งานที่มีสถานะ ACTIVE และไม่มีช่วงวันไม่รับงานที่ทับกับเวลาปัจจุบัน
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
                  ตัวชี้คิว: {driverQueueState?.state_value || "0"}
                </div>
                  {activeQueueRows.length > 0 ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {activeQueueRows.map((row) => {
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
                              border: `1px solid ${isNext ? "#60a5fa" : "#e2e8f0"}`,
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
