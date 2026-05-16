import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import Swal from "sweetalert2";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "moment/locale/th";
import { getBookings, getDriverQueue, getDriverUnavailable, getUsers, getVehicles } from "../api";
import { hasPermission } from "../permissions";
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

export default function CalendarPage() {
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [users, setUsers] = useState([]);
  const [driverUnavailableRecords, setDriverUnavailableRecords] = useState([]);
  const [driverQueueRows, setDriverQueueRows] = useState([]);
  const [driverQueueState, setDriverQueueState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const vehicleMap = useMemo(() => {
    const map = new Map();
    vehicles.forEach((vehicle) => {
      map.set(String(vehicle.vehicle_id || "").trim(), vehicle);
    });
    return map;
  }, [vehicles]);

  const canViewActiveDriversSummary = hasPermission(null, "calendar_active_drivers_view");
  const canViewNextQueueDriver = hasPermission(null, "calendar_next_queue_driver_view");

  console.log("Calendar permissions", {
    canViewActiveDriversSummary,
    canViewNextQueueDriver,
  });

  const loadData = useCallback(async (options = {}) => {
    try {
      if (options.refreshOnly) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const [bookingData, vehicleData, userData, unavailableData, queueData] = await Promise.all([
        getBookings(options.refreshOnly ? { fresh: true } : {}),
        getVehicles(),
        getUsers(),
        getDriverUnavailable(options.refreshOnly ? { fresh: true } : {}),
        getDriverQueue(options.refreshOnly ? { fresh: true } : {}),
      ]);

      setBookings(Array.isArray(bookingData) ? bookingData : []);
      setVehicles(Array.isArray(vehicleData) ? vehicleData : []);
      setUsers(Array.isArray(userData) ? userData : []);
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
          return status === "APPROVED" || status === "IN_USE";
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

      {canViewActiveDriversSummary && (
        <div className="form-card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>คนขับพร้อมรับงาน</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <span className="status green" style={{ fontSize: 16, padding: "6px 12px" }}>
                พร้อมรับงาน {activeDriversNow.length} คน
              </span>
              {activeDriversNow.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {activeDriversNow.map((driver) => (
                    <span key={driver.user_id} className="status blue" style={{ fontSize: 16, padding: "6px 12px" }}>
                      {driver.name}
                    </span>
                  ))}
                </div>
              ) : (
                <span style={{ color: "#64748b" }}>ไม่มีคนขับที่พร้อมรับงานในตอนนี้</span>
              )}
            </div>
            <div style={{ color: "#475569" }}>
              นับจากผู้ใช้งานที่มีสถานะ ACTIVE และไม่มีช่วงวันไม่รับงานที่ทับกับเวลาปัจจุบัน
            </div>
          </div>
        </div>
      )}

      {canViewNextQueueDriver && (
        <div className="form-card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>คนขับคิวถัดไป</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <strong style={{ fontSize: 32 }}>{nextQueueDriver ? nextQueueDriver.driver_name : "-"}</strong>
            <div style={{ color: "#475569" }}>
              ตัวชี้คิว: {driverQueueState?.state_value || "0"}
            </div>
          </div>
        </div>
      )}

      <div
        className="form-card"
        style={{
          fontSize: "18px",
          lineHeight: 1.7,
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            <span className="status green" style={{ fontSize: 16, padding: "6px 12px" }}>
              กำลังใช้งาน
            </span>
            <span className="status blue" style={{ fontSize: 16, padding: "6px 12px" }}>
              อนุมัติแล้ว
            </span>
            <span className="status red" style={{ fontSize: 16, padding: "6px 12px" }}>
              วันไม่รับงาน
            </span>
          </div>
          <div style={{ color: "#475569" }}>
            แสดงเฉพาะรายการจอง <b>APPROVED</b> และ <b>IN_USE</b> พร้อมวันไม่รับงานของคนขับ
          </div>
        </div>

        {loading && <div style={{ padding: "24px 0" }}>กำลังโหลดปฏิทิน...</div>}

        {!loading && error && <div style={{ padding: "24px 0", color: "#b91c1c" }}>{error}</div>}

        {!loading && !error && calendarEvents.length === 0 && (
          <div style={{ marginBottom: 12, color: "#475569" }}>ไม่มีรายการที่ต้องแสดงในช่วงนี้</div>
        )}

        {!loading && !error && (
          <div
            className="calendar-shell"
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              padding: 12,
            }}
          >
            <Calendar
              localizer={localizer}
              culture="th"
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 760, fontSize: 16 }}
              eventPropGetter={eventStyleGetter}
              components={{
                event: CalendarEvent,
              }}
              messages={CALENDAR_MESSAGES}
              popup
              onSelectEvent={handleSelectEvent}
            />
          </div>
        )}
      </div>
    </div>
  );
}
