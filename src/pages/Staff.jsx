import { formatThaiDateTime } from "../utils/date";
import { useEffect, useState } from "react";
import {
  approveBooking,
  cancelBooking,
  completeTrip,
  getBookings,
  getDrivers,
  getVehicles,
  startTrip,
} from "../api";

const ITEMS_PER_PAGE = 2;

function sortLatestFirst(items) {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.created_at || a.start_datetime).getTime();
    const dateB = new Date(b.created_at || b.start_datetime).getTime();
    return dateB - dateA;
  });
}

function paginate(items, page) {
  const start = (page - 1) * ITEMS_PER_PAGE;
  return items.slice(start, start + ITEMS_PER_PAGE);
}

function totalPages(items) {
  return Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
}

function Pagination({ page, total, onChange }) {
  return (
    <div className="pagination">
      {Array.from({ length: total }).map((_, index) => (
        <button
          key={index}
          className={page === index + 1 ? "active-page" : ""}
          onClick={() => onChange(index + 1)}
        >
          {index + 1}
        </button>
      ))}
    </div>
  );
}

export default function Staff() {
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selected, setSelected] = useState({});

  const [pendingPage, setPendingPage] = useState(1);
  const [activePage, setActivePage] = useState(1);

  async function loadData() {
    const [bookingData, vehicleData, driverData] = await Promise.all([
      getBookings(),
      getVehicles(),
      getDrivers(),
    ]);

    setBookings(bookingData);
    setVehicles(vehicleData);
    setDrivers(driverData);
  }

  function updateSelected(bookingId, field, value) {
    setSelected({
      ...selected,
      [bookingId]: {
        ...selected[bookingId],
        [field]: value,
      },
    });
  }

  function isTimeOverlap(startA, endA, startB, endB) {
    const aStart = new Date(startA).getTime();
    const aEnd = new Date(endA).getTime();
    const bStart = new Date(startB).getTime();
    const bEnd = new Date(endB).getTime();

    return aStart < bEnd && bStart < aEnd;
  }

  function isVehicleAvailable(vehicle, currentBooking, allBookings) {
    if (vehicle.status !== "AVAILABLE") {
      return false;
    }

    return !allBookings.some((b) => {
      const isSameBooking = b.booking_id === currentBooking.booking_id;
      const isSameVehicle = b.vehicle_id === vehicle.vehicle_id;
      const activeStatus = b.status === "APPROVED" || b.status === "IN_USE";

      if (isSameBooking || !isSameVehicle || !activeStatus) {
        return false;
      }

      return isTimeOverlap(
        currentBooking.start_datetime,
        currentBooking.end_datetime,
        b.start_datetime,
        b.end_datetime
      );
    });
  }

    function isDriverAvailable(driverName, currentBooking, allBookings) {
      return !allBookings.some((b) => {
        const isSameBooking = b.booking_id === currentBooking.booking_id;
        const isSameDriver = b.driver_name === driverName;
        const activeStatus = b.status === "APPROVED" || b.status === "IN_USE";

        if (isSameBooking || !isSameDriver || !activeStatus) {
          return false;
        }

        return isTimeOverlap(
          currentBooking.start_datetime,
          currentBooking.end_datetime,
          b.start_datetime,
          b.end_datetime
        );
      });
    }

  async function handleApprove(booking) {
    const data = selected[booking.booking_id] || {};

    if (!data.vehicle_id) {
      alert("กรุณาเลือกรถ");
      return;
    }

    if (!data.driver_name) {
      alert("กรุณาเลือกคนขับ");
      return;
    }

    const vehicle = vehicles.find((v) => v.vehicle_id === data.vehicle_id);

    if (!vehicle || !isVehicleAvailable(vehicle, booking, bookings)) {
      alert("รถคันนี้ไม่ว่าง หรือไม่พร้อมใช้งาน กรุณาเลือกรถคันอื่น");
      return;
    }

    if (!isDriverAvailable(data.driver_name, booking, bookings)) {
      alert("คนขับท่านนี้ไม่ว่าง กรุณาเลือกคนขับท่านอื่น");
      return;
    }

    try {
      await approveBooking({
        booking_id: booking.booking_id,
        vehicle_id: data.vehicle_id,
        driver_name: data.driver_name,
        staff_note: data.staff_note || "",
      });

      alert("อนุมัติรายการสำเร็จ");
      await loadData();
    } catch (err) {
      alert(err.message || "อนุมัติไม่สำเร็จ");
    }
  }

  async function handleStartTrip(booking) {
    const outMileage = prompt("กรอกเลขไมล์ตอนรถออก");
    if (!outMileage) return;

    try {
      await startTrip({
        booking_id: booking.booking_id,
        out_mileage: outMileage,
        out_time: new Date().toISOString(),
        remark: "",
      });

      alert("บันทึกรถออกสำเร็จ");
      await loadData();
    } catch (err) {
      alert(err.message || "บันทึกรถออกไม่สำเร็จ");
    }
  }

  async function handleCompleteTrip(booking) {
    const inMileage = prompt("กรอกเลขไมล์ตอนรถเข้า");
    if (!inMileage) return;

    try {
      await completeTrip({
        booking_id: booking.booking_id,
        in_mileage: inMileage,
        in_time: new Date().toISOString(),
        remark: "",
      });

      alert("บันทึกรถเข้าสำเร็จ");
      await loadData();
    } catch (err) {
      alert(err.message || "บันทึกรถเข้าไม่สำเร็จ");
    }
  }

  async function handleCancelBooking(booking) {
    const reason = prompt("กรอกเหตุผลการยกเลิก");
    if (!reason) return;

    const confirmCancel = confirm(
      `ยืนยันยกเลิกรายการ ${booking.booking_no} ใช่หรือไม่?`
    );

    if (!confirmCancel) return;

    try {
      await cancelBooking({
        booking_id: booking.booking_id,
        reason,
      });

      alert("ยกเลิกรายการสำเร็จ");
      await loadData();
    } catch (err) {
      alert(err.message || "ยกเลิกไม่สำเร็จ");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const pendingBookings = sortLatestFirst(
    bookings.filter((b) => b.status === "PENDING")
  );

  const activeBookings = sortLatestFirst(
    bookings.filter((b) => b.status === "APPROVED" || b.status === "IN_USE")
  );

  const pendingPageItems = paginate(pendingBookings, pendingPage);
  const activePageItems = paginate(activeBookings, activePage);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>หน้าจอเจ้าหน้าที่</h2>
          <p>อนุมัติรายการจองรถ และติดตามสถานะการใช้งานรถ</p>
        </div>

        <button onClick={loadData}>รีเฟรชข้อมูล</button>
      </div>

      <div className="staff-section">
        <h3>รายการรออนุมัติ</h3>

        <div className="section-counter">
          มีรายการใหม่ {pendingBookings.length} รายการ
        </div>

        {pendingBookings.length === 0 && (
          <div className="staff-empty">ไม่มีรายการรออนุมัติ</div>
        )}

        <div className="staff-card-list">
          {pendingPageItems.map((b) => (
            <div className="staff-card" key={b.booking_id}>
              <div className="staff-card-header">
                <div className="staff-card-title">{b.booking_no}</div>
                <span className="status amber">PENDING</span>
              </div>

              <div className="staff-info-grid">
                <div className="staff-info-item">
                  <b>ผู้จอง</b>
                  {b.requester_name}
                </div>

                <div className="staff-info-item">
                  <b>หน่วยงาน</b>
                  {b.department || "-"}
                </div>

                <div className="staff-info-item">
                  <b>ปลายทาง</b>
                  {b.destination}
                </div>

                <div className="staff-info-item">
                  <b>เวลาเริ่ม</b>
                  {formatThaiDateTime(b.start_datetime)}
                </div>

                <div className="staff-info-item">
                  <b>เวลาสิ้นสุด</b>
                  {formatThaiDateTime(b.end_datetime)}
                </div>

                <div className="staff-info-item">
                  <b>เหตุผล</b>
                  {b.purpose || "-"}
                </div>

                <div className="staff-info-item">
                  <b>รถว่าง</b>
                  {
                    vehicles.filter((v) =>
                      isVehicleAvailable(v, b, bookings)
                    ).length
                  }{" "}
                  / {vehicles.length} คัน
                </div>
              </div>

              <div className="staff-action-grid">
                <div>
                  <label>เลือกรถ</label>
                  <select
                    value={selected[b.booking_id]?.vehicle_id || ""}
                    onChange={(e) =>
                      updateSelected(b.booking_id, "vehicle_id", e.target.value)
                    }
                  >
                    <option value="">-- เลือกรถ --</option>

                    {vehicles.map((v) => {
                      const available = isVehicleAvailable(v, b, bookings);

                      return (
                        <option
                          key={v.vehicle_id}
                          value={v.vehicle_id}
                          disabled={!available}
                        >
                          {v.vehicle_code} - {v.plate_no}
                          {available ? " ✅ ว่าง" : " ❌ ไม่ว่าง"}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label>เลือกคนขับ</label>
                  <select
                    value={selected[b.booking_id]?.driver_name || ""}
                    onChange={(e) =>
                      updateSelected(
                        b.booking_id,
                        "driver_name",
                        e.target.value
                      )
                    }
                  >
                    <option value="">-- เลือกคนขับ --</option>

                    {drivers
                      .filter((d) => d.status === "ACTIVE")
                      .map((d) => {
                        const available = isDriverAvailable(
                          d.name,
                          b,
                          bookings
                        );

                        return (
                          <option
                            key={d.driver_id}
                            value={d.name}
                            disabled={!available}
                          >
                            {d.name} ({d.phone})
                            {available ? " ✅ ว่าง" : " ❌ ไม่ว่าง"}
                          </option>
                        );
                      })}
                  </select>
                </div>

                <div>
                  <label>หมายเหตุเจ้าหน้าที่</label>
                  <input
                    value={selected[b.booking_id]?.staff_note || ""}
                    onChange={(e) =>
                      updateSelected(
                        b.booking_id,
                        "staff_note",
                        e.target.value
                      )
                    }
                    placeholder="-"
                  />
                </div>
              </div>

              <div className="staff-buttons">
                <button onClick={() => handleApprove(b)}>อนุมัติรายการ</button>

                <button
                  className="danger-button"
                  onClick={() => handleCancelBooking(b)}
                >
                  ยกเลิกรายการ
                </button>
              </div>
            </div>
          ))}
        </div>

        <Pagination
          page={pendingPage}
          total={totalPages(pendingBookings)}
          onChange={setPendingPage}
        />
      </div>

      <div className="staff-section">
        <h3>รายการอนุมัติแล้ว / กำลังใช้งาน</h3>

        <div className="section-counter">
          มีรายการทั้งหมด {activeBookings.length} รายการ
        </div>

        {activeBookings.length === 0 && (
          <div className="staff-empty">ไม่มีรายการที่กำลังใช้งาน</div>
        )}

        <div className="staff-card-list">
          {activePageItems.map((b) => (
            <div className="staff-card" key={b.booking_id}>
              <div className="staff-card-header">
                <div className="staff-card-title">{b.booking_no}</div>

                <span
                  className={`status ${
                    b.status === "IN_USE" ? "green" : "blue"
                  }`}
                >
                  {b.status}
                </span>
              </div>

              <div className="staff-info-grid">
                <div className="staff-info-item">
                  <b>ผู้จอง</b>
                  {b.requester_name}
                </div>

                <div className="staff-info-item">
                  <b>รถ</b>
                  {b.vehicle_id || "-"}
                </div>

                <div className="staff-info-item">
                  <b>คนขับ</b>
                  {b.driver_name || "-"}
                </div>

                <div className="staff-info-item">
                  <b>เวลาเริ่ม</b>
                  {formatThaiDateTime(b.start_datetime)}
                </div>

                <div className="staff-info-item">
                  <b>เวลาสิ้นสุด</b>
                  {formatThaiDateTime(b.end_datetime)}
                </div>

                <div className="staff-info-item">
                  <b>ปลายทาง</b>
                  {b.destination}
                </div>
              </div>

              <div className="staff-buttons">
                {b.status === "APPROVED" && (
                  <button onClick={() => handleStartTrip(b)}>
                    🚗 บันทึกรถออก
                  </button>
                )}

                {b.status === "IN_USE" && (
                  <button onClick={() => handleCompleteTrip(b)}>
                    ✅ บันทึกรถเข้า
                  </button>
                )}

                <button
                  className="danger-button"
                  onClick={() => handleCancelBooking(b)}
                >
                  ยกเลิกรายการ
                </button>
              </div>
            </div>
          ))}
        </div>

        <Pagination
          page={activePage}
          total={totalPages(activeBookings)}
          onChange={setActivePage}
        />
      </div>
    </div>
  );
}