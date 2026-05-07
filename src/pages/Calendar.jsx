import { useEffect, useState } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { getBookings } from "../api";

const localizer = momentLocalizer(moment);

export default function CalendarPage() {
  const [events, setEvents] = useState([]);

  async function loadBookings() {
    try {
      const bookings = await getBookings();

      const mapped = bookings.map((b) => ({
        id: b.booking_id,
        title: `${b.booking_no} - ${b.requester_name}`,
        start: new Date(b.start_datetime),
        end: new Date(b.end_datetime),
        resource: b,
      }));

      setEvents(mapped);
    } catch (err) {
      alert(err.message || "โหลดปฏิทินไม่สำเร็จ");
    }
  }

  useEffect(() => {
    loadBookings();
  }, []);

  function eventStyleGetter(event) {
    const status = event.resource.status;

    let backgroundColor = "#2563eb";

    if (status === "PENDING") {
      backgroundColor = "#f59e0b";
    }

    if (status === "APPROVED") {
      backgroundColor = "#2563eb";
    }

    if (status === "IN_USE") {
      backgroundColor = "#16a34a";
    }

    if (status === "COMPLETED") {
      backgroundColor = "#64748b";
    }
    if (status === "CANCELLED") {
        backgroundColor = "#dc2626";
    }   

    return {
      style: {
        backgroundColor,
        borderRadius: "10px",
        border: "0",
        color: "white",
        padding: "4px",
      },
    };
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>ปฏิทินการจองรถ</h2>
          <p>แสดงรายการจองรถทั้งหมด</p>
        </div>

        <button onClick={loadBookings}>
          รีเฟรชข้อมูล
        </button>
      </div>

      <div className="calendar-card">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 700 }}
          eventPropGetter={eventStyleGetter}
          popup
          onSelectEvent={(event) => {
            const b = event.resource;

            alert(
              `
เลขที่: ${b.booking_no}

ผู้จอง: ${b.requester_name}

ปลายทาง: ${b.destination}

หมายเหตุ: ${b.staff_note || "-"}

รถ: ${b.vehicle_id || "-"}

คนขับ: ${b.driver_name || "-"}
              `
            );
          }}
        />
      </div>
    </div>
  );
}