import { useEffect, useMemo, useState } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import Swal from "sweetalert2";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "moment/locale/th";
import { getBookings } from "../api";
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
  noEventsInRange: "ไม่มีรายการจองในช่วงนี้",
};

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function getCalendarStatusMeta(status) {
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
    label: "ติดจอง",
    className: "blue",
    color: "#1d4ed8",
    backgroundColor: "#dbeafe",
    borderColor: "#93c5fd",
  };
}

function getVehicleLabel(booking) {
  return booking.vehicle_name || booking.vehicle_code || booking.vehicle_id || "-";
}

function getDriverLabel(booking) {
  return booking.assigned_user_name || "-";
}

function CalendarEvent({ event }) {
  const meta = getCalendarStatusMeta(event.resource.status);

  return (
    <div className="calendar-event">
      <div className="calendar-event-title">{event.title}</div>
      <div className={`calendar-event-status ${meta.className}`}>{meta.label}</div>
    </div>
  );
}

export default function CalendarPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadBookings() {
    try {
      setLoading(true);
      setError("");

      const data = await getBookings();
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err.message || "โหลดข้อมูลไม่สำเร็จ";
      setError(message);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
  }, []);

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

  const filteredEvents = useMemo(
    () =>
      activeBookings.map((booking) => ({
        id: booking.booking_id,
        title: `${booking.booking_no || "-"} - ${booking.requester_name || "-"}`,
        start: new Date(booking.start_datetime),
        end: new Date(booking.end_datetime),
        resource: booking,
      })),
    [activeBookings]
  );

  const eventStyleGetter = (event) => {
    const meta = getCalendarStatusMeta(event.resource.status);

    return {
      style: {
        backgroundColor: meta.backgroundColor,
        border: `1px solid ${meta.borderColor}`,
        color: meta.color,
        borderRadius: "8px",
        padding: "3px 6px",
        fontSize: "14px",
        lineHeight: "1.25",
      },
    };
  };

  async function handleSelectEvent(event) {
    const booking = event.resource;
    const meta = getCalendarStatusMeta(booking.status);

    await Swal.fire({
      title: "รายละเอียดการจอง",
      html: `
        <div style="text-align:left;font-size:18px;line-height:1.7;color:#1f2937">
          <div><b>เลขที่จอง:</b> ${booking.booking_no || "-"}</div>
          <div><b>ผู้จอง:</b> ${booking.requester_name || "-"}</div>
          <div><b>วันเวลาเริ่ม:</b> ${formatThaiDateTime(booking.start_datetime)}</div>
          <div><b>วันเวลาสิ้นสุด:</b> ${formatThaiDateTime(booking.end_datetime)}</div>
          <div><b>ปลายทาง:</b> ${booking.destination || "-"}</div>
          <div><b>รถ:</b> ${getVehicleLabel(booking)}</div>
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
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>ปฏิทินการจอง</h2>
          <p>แสดงเฉพาะรายการจองที่กำลังใช้งานและรายการที่ติดจองอยู่</p>
        </div>

        <button type="button" onClick={loadBookings}>
          รีเฟรชข้อมูล
        </button>
      </div>

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
              ติดจอง
            </span>
          </div>
          <div style={{ color: "#475569" }}>
            แสดงเฉพาะรายการ <b>APPROVED</b> และ <b>IN_USE</b> เท่านั้น
          </div>
        </div>

        {loading && <div style={{ padding: "24px 0" }}>กำลังโหลดปฏิทิน...</div>}

        {!loading && error && <div style={{ padding: "24px 0", color: "#b91c1c" }}>{error}</div>}

        {!loading && !error && filteredEvents.length === 0 && (
          <div style={{ marginBottom: 12, color: "#475569" }}>ไม่มีรายการจองที่ต้องแสดงในช่วงนี้</div>
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
              events={filteredEvents}
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
