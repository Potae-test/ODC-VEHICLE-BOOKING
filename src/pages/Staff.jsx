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

export default function Staff() {
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selected, setSelected] = useState({});
  const [drivers, setDrivers] = useState([]);

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

function isVehicleAvailable(vehicle, currentBooking, bookings) {
    if (vehicle.status !== "AVAILABLE") {
      return false;
    }

    return !bookings.some((b) => {
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
function isDriverAvailable(driverName, currentBooking, bookings) {
  return !bookings.some((b) => {
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
      alert("กรุณากรอกชื่อคนขับ");
      return;
    }
    if (!isDriverAvailable(data.driver_name, booking, bookings)) {
      alert("คนขับท่านนี้ไม่ว่าง กรุณาเลือกคนขับท่านอื่น");
      return;
    }
      const vehicle = vehicles.find((v) => v.vehicle_id === data.vehicle_id);

      if (!vehicle || !isVehicleAvailable(vehicle, booking, bookings)) {
        alert("รถคันนี้ไม่ว่าง หรือไม่พร้อมใช้งาน กรุณาเลือกรถคันอื่น");
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

  useEffect(() => {
    loadData();
  }, []);

  const pendingBookings = bookings.filter((b) => b.status === "PENDING");

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>หน้าจอเจ้าหน้าที่</h2>
          <p>อนุมัติรายการจองรถ ระบุรถ และคนขับ</p>
        </div>

        <button onClick={loadData}>รีเฟรชข้อมูล</button>
      </div>

      <div className="form-card">
        <h3>รายการรออนุมัติ</h3>
        <div className="form-card">
  <h3>รายการที่อนุมัติแล้ว / กำลังใช้งาน</h3>

  {bookings
    .filter((b) => b.status === "APPROVED" || b.status === "IN_USE")
    .map((b) => (
      <div className="approval-card" key={b.booking_id}>
        <div>
          <h3>{b.booking_no}</h3>
          <p><b>ผู้จอง:</b> {b.requester_name}</p>
          <p><b>รถ:</b> {b.vehicle_id}</p>
          <p><b>คนขับ:</b> {b.driver_name}</p>
          <p><b>เวลา:</b> {b.start_datetime} ถึง {b.end_datetime}</p>
          <p><b>ปลายทาง:</b> {b.destination}</p>
          <p><b>สถานะ:</b> {b.status}</p>
        </div>

        <div className="approval-form">
          {b.status === "APPROVED" && (
            <button onClick={() => handleStartTrip(b)}>
              บันทึกรถออก
            </button>
          )}

          {b.status === "IN_USE" && (
            <button onClick={() => handleCompleteTrip(b)}>
              บันทึกรถเข้า
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

        {pendingBookings.length === 0 && (
          <p>ไม่มีรายการรออนุมัติ</p>
        )}

        {pendingBookings.map((b) => (
          <div className="approval-card" key={b.booking_id}>
            <div>
              <h3>{b.booking_no}</h3>
              <p><b>ผู้จอง:</b> {b.requester_name}</p>
              <p><b>หน่วยงาน:</b> {b.department}</p>
              <p><b>เวลา:</b> {b.start_datetime} ถึง {b.end_datetime}</p>
              <p><b>ปลายทาง:</b> {b.destination}</p>
              <p><b>เหตุผล:</b> {b.purpose}</p>
              <p>
                <b>รถว่าง:</b>{" "}
                {
                  vehicles.filter((v) =>
                    isVehicleAvailable(v, b, bookings)
                  ).length
                } / {vehicles.length} คัน
              </p>
            </div>

            <div className="approval-form">
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
                        {v.vehicle_code} - {v.vehicle_type} - {v.plate_no}
                        {available ? " ✅ ว่าง" : " ❌ ไม่ว่าง"}
                      </option>
                    );
                  })}
              </select>

                <label>คนขับ</label>
                <select
                  value={selected[b.booking_id]?.driver_name || ""}
                  onChange={(e) =>
                    updateSelected(b.booking_id, "driver_name", e.target.value)
                  }
                >
                  <option value="">-- เลือกคนขับ --</option>

                  {drivers
                    .filter((d) => d.status === "ACTIVE")
                    .map((d) => {
                      const available = isDriverAvailable(d.name, b, bookings);

                      return (
                        <option key={d.driver_id} value={d.name} disabled={!available}>
                          {d.name} - {d.phone}
                          {available ? " ✅ ว่าง" : " ❌ ไม่ว่าง"}
                        </option>
                      );
                    })}
                </select>

              <label>หมายเหตุเจ้าหน้าที่</label>
              <input
                value={selected[b.booking_id]?.staff_note || ""}
                onChange={(e) =>
                  updateSelected(b.booking_id, "staff_note", e.target.value)
                }
                placeholder="-"
              />

                <button onClick={() => handleApprove(b)}>
                    อนุมัติรายการ
                </button>

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
    </div>
  );
}