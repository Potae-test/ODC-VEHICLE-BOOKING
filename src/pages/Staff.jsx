import { formatThaiDateTime } from "../utils/date";
import { useEffect, useMemo, useState } from "react";
import {
  approveBooking,
  cancelBooking,
  completeTrip,
  confirmDriverQueueAssignment,
  getBookings,
  getDriverUnavailable,
  recommendDriverForBooking,
  getVehicles,
  getUsers,
  startTrip,
} from "../api";
import {
  showConfirm,
  showError,
  showInput,
  showSuccess,
} from "../utils/alert";
import { hasPermission } from "../permissions";
import { FEATURES } from "../config/features";

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
  const [driverUnavailableRecords, setDriverUnavailableRecords] = useState([]);
  const [selected, setSelected] = useState({});

  const [pendingPage, setPendingPage] = useState(1);
  const [activePage, setActivePage] = useState(1);

  async function loadData() {
    const [bookingData, vehicleData, driverData, unavailableData] = await Promise.all([
      getBookings(),
      FEATURES.vehicleModule ? getVehicles() : Promise.resolve([]),
      getUsers(),
      getDriverUnavailable(),
    ]);

    setBookings(bookingData);
    setVehicles(vehicleData);
    setDrivers(
      Array.isArray(driverData)
        ? driverData.filter((user) => String(user.role || "").trim().toUpperCase() === "DRIVER")
        : []
    );
    setDriverUnavailableRecords(
      Array.isArray(unavailableData)
        ? unavailableData.filter((record) => String(record.status || "").trim().toUpperCase() === "ACTIVE")
        : []
    );
  }

  async function refreshBookings() {
    const [bookingData, unavailableData] = await Promise.all([
      getBookings(),
      getDriverUnavailable(),
    ]);
    setBookings(bookingData);
    setDriverUnavailableRecords(
      Array.isArray(unavailableData)
        ? unavailableData.filter((record) => String(record.status || "").trim().toUpperCase() === "ACTIVE")
      : []
    );
  }

  const driverUnavailableGroups = useMemo(
    () => groupActiveUnavailable(driverUnavailableRecords),
    [driverUnavailableRecords]
  );

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

    function isDriverAvailable(driver, currentBooking, allBookings) {
    return !allBookings.some((b) => {
      const isSameBooking = b.booking_id === currentBooking.booking_id;
      const isSameDriver = b.assigned_user_id
        ? b.assigned_user_id === driver.user_id
        : b.assigned_user_name === driver.name;
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

  function groupActiveUnavailable(unavailableRecords) {
    const byDriverId = new Map();
    const byDriverName = new Map();

    unavailableRecords.forEach((record) => {
      const status = String(record.status || "").trim().toUpperCase();
      if (status !== "ACTIVE") return;

      const startTime = new Date(record.start_datetime).getTime();
      const endTime = new Date(record.end_datetime).getTime();
      if (Number.isNaN(startTime) || Number.isNaN(endTime)) return;

      const driverId = String(record.driver_user_id || "").trim();
      const driverName = String(record.driver_name || "").trim();

      if (driverId) {
        if (!byDriverId.has(driverId)) byDriverId.set(driverId, []);
        byDriverId.get(driverId).push(record);
      }

      if (driverName) {
        if (!byDriverName.has(driverName)) byDriverName.set(driverName, []);
        byDriverName.get(driverName).push(record);
      }
    });

    return { byDriverId, byDriverName };
  }

  function getDriverUnavailableConflict(driver, currentBooking, unavailableGroups) {
    const driverId = String(driver.user_id || "").trim();
    const driverName = String(driver.name || "").trim();
    const records = [
      ...(driverId ? unavailableGroups.byDriverId.get(driverId) || [] : []),
      ...(driverName ? unavailableGroups.byDriverName.get(driverName) || [] : []),
    ];

    return records.find((record) =>
      isTimeOverlap(
        currentBooking.start_datetime,
        currentBooking.end_datetime,
        record.start_datetime,
        record.end_datetime
      )
    ) || null;
  }
  async function handleApprove(booking) {
    const data = selected[booking.booking_id] || {};

    if (FEATURES.vehicleModule && !data.vehicle_id) {
      showError("กรุณาเลือกรถ");
      return;
    }

    if (!data.assigned_user_name) {
      showError("กรุณาเลือกผู้ใช้");
      return;
    }

    const vehicle = FEATURES.vehicleModule
      ? vehicles.find((v) => v.vehicle_id === data.vehicle_id)
      : null;

    if (FEATURES.vehicleModule && (!vehicle || !isVehicleAvailable(vehicle, booking, bookings))) {
      showError("รถคันนี้ไม่ว่าง หรือไม่พร้อมใช้งาน กรุณาเลือกรถคันอื่น");
      return;
    }

    if (!isDriverAvailable({ user_id: data.assigned_user_id, name: data.assigned_user_name }, booking, bookings)) {
      showError("ผู้ใช้ท่านนี้ไม่ว่าง กรุณาเลือกผู้ใช้อื่น");
      return;
    }

    const unavailableConflict = getDriverUnavailableConflict(
      { user_id: data.assigned_user_id, name: data.assigned_user_name },
      booking,
      driverUnavailableGroups
    );

    if (unavailableConflict) {
      showError("คนขับมีช่วงวันไม่รับงานทับกับรายการนี้");
      return;
    }

    let driverQueueRecommendation = null;
    try {
      const recommendation = await recommendDriverForBooking({
        booking_id: booking.booking_id,
        start_datetime: booking.start_datetime,
        end_datetime: booking.end_datetime,
      });
      driverQueueRecommendation = recommendation?.data || null;
    } catch (err) {
      console.warn("recommendDriverForBooking failed", err);
    }

    const recommendedDriverId = driverQueueRecommendation?.recommended_driver_user_id || "";
    const recommendedDriverName = driverQueueRecommendation?.recommended_driver_name || "";
    const assignMode =
      recommendedDriverId &&
      String(recommendedDriverId) === String(data.assigned_user_id || "")
        ? "AUTO_RECOMMENDED"
        : "MANUAL_OVERRIDE";
    const queueReason = driverQueueRecommendation?.reason || "คิวถัดไป / พร้อมรับงาน";

    try {
      await approveBooking({
        booking_id: booking.booking_id,
        booking_no: booking.booking_no || "",
        vehicle_id: FEATURES.vehicleModule ? data.vehicle_id || "" : "",
        assigned_user_id: data.assigned_user_id || "",
        assigned_user_name: data.assigned_user_name,
        staff_note: data.staff_note || "",
      });

      try {
        await confirmDriverQueueAssignment({
          booking_id: booking.booking_id,
          booking_no: booking.booking_no || "",
          recommended_driver_user_id: recommendedDriverId,
          recommended_driver_name: recommendedDriverName,
          assigned_driver_user_id: data.assigned_user_id || "",
          assigned_driver_name: data.assigned_user_name || "",
          assign_mode: assignMode,
          reason: assignMode === "MANUAL_OVERRIDE" ? data.staff_note || queueReason : queueReason,
          skipped_drivers_json: JSON.stringify(driverQueueRecommendation?.skipped || []),
          created_by: "STAFF",
        });
      } catch (queueErr) {
        console.warn("confirmDriverQueueAssignment failed", queueErr);
      }

      await showSuccess("อนุมัติรายการสำเร็จ");
      await refreshBookings();
    } catch (err) {
      showError(err.message || "อนุมัติไม่สำเร็จ");
    }
  }

  async function handleStartTrip(booking) {
    const outMileage = await showInput(
      "บันทึกรถออก",
      "กรอกเลขไมล์ตอนรถออก",
      "เช่น 125000"
    );

    if (!outMileage) return;

    try {
      await startTrip({
        booking_id: booking.booking_id,
        out_mileage: outMileage,
        out_time: new Date().toISOString(),
        remark: "",
      });

      await showSuccess("บันทึกรถออกสำเร็จ");
      await refreshBookings();
    } catch (err) {
      showError(err.message || "บันทึกรถออกไม่สำเร็จ");
    }
  }

  async function handleCompleteTrip(booking) {
    const inMileage = await showInput(
      "บันทึกรถเข้า",
      "กรอกเลขไมล์ตอนรถเข้า",
      "เช่น 125500"
    );

    if (!inMileage) return;

    try {
      await completeTrip({
        booking_id: booking.booking_id,
        in_mileage: inMileage,
        in_time: new Date().toISOString(),
        remark: "",
      });

      await showSuccess("บันทึกรถเข้าสำเร็จ");
      await refreshBookings();
    } catch (err) {
      showError(err.message || "บันทึกรถเข้าไม่สำเร็จ");
    }
  }

  async function handleCancelBooking(booking) {
    const reason = await showInput(
      "ยกเลิกรายการ",
      "กรอกเหตุผลการยกเลิก",
      "เช่น เปลี่ยนวันจอง / ยกเลิกภารกิจ"
    );

    if (!reason) return;

    const confirmed = await showConfirm(
      `ยืนยันยกเลิกรายการ ${booking.booking_no} ใช่หรือไม่?`
    );

    if (!confirmed) return;

    try {
      await cancelBooking({
        booking_id: booking.booking_id,
        reason,
      });

      await showSuccess("ยกเลิกรายการสำเร็จ");
      await refreshBookings();
    } catch (err) {
      showError(err.message || "ยกเลิกไม่สำเร็จ");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const pendingBookings = useMemo(
    () => sortLatestFirst(bookings.filter((b) => b.status === "PENDING")),
    [bookings]
  );

  const activeBookings = useMemo(
    () => sortLatestFirst(bookings.filter((b) => b.status === "APPROVED" || b.status === "IN_USE")),
    [bookings]
  );

  const pendingPageItems = paginate(pendingBookings, pendingPage);
  const activePageItems = paginate(activeBookings, activePage);
  const canApproveBookings = hasPermission(null, "bookings_approve");
  const canEditBookings = hasPermission(null, "bookings_edit");
  const canCancelBookings = hasPermission(null, "bookings_cancel");

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

                {FEATURES.vehicleModule && <div className="staff-info-item">
                  <b>รถว่าง</b>
                  {
                    vehicles.filter((v) =>
                      isVehicleAvailable(v, b, bookings)
                    ).length
                  }{" "}
                  / {vehicles.length} คัน
                </div>}
              </div>

              {canApproveBookings && (
              <div className="staff-action-grid">
                {FEATURES.vehicleModule && (
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
                )}

                <div>
                  <label>เลือกผู้ใช้</label>
                  <select
                    value={selected[b.booking_id]?.assigned_user_id || ""}
                    onChange={(e) => {
                      const driver = drivers.find((d) => d.user_id === e.target.value);
                      setSelected({
                        ...selected,
                        [b.booking_id]: {
                          ...selected[b.booking_id],
                          assigned_user_id: driver?.user_id || "",
                          assigned_user_name: driver?.name || "",
                        },
                      });
                    }}
                  >
                    <option value="">-- เลือกผู้ใช้ --</option>

                    {drivers
                      .filter((d) => d.status === "ACTIVE")
                      .map((d) => {
                        const available = isDriverAvailable(d, b, bookings);
                        const unavailableConflict = getDriverUnavailableConflict(
                          d,
                          b,
                          driverUnavailableGroups
                        );
                        const disabled = !available || Boolean(unavailableConflict);

                        return (
                          <option
                            key={d.user_id}
                            value={d.user_id}
                            disabled={disabled}
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

              )}

              <div className="staff-buttons">
                {canApproveBookings && (
                  <button onClick={() => handleApprove(b)}>อนุมัติรายการ</button>
                )}

                {canCancelBookings && (
                <button
                  className="danger-button"
                  onClick={() => handleCancelBooking(b)}
                >
                  ยกเลิกรายการ
                </button>
                )}
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
                  {FEATURES.vehicleModule ? (b.vehicle_id || "-") : null}
                </div>

                <div className="staff-info-item">
                  <b>ผู้ใช้ที่มอบหมาย</b>
                  {b.assigned_user_name || "-"}
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
                {canEditBookings && b.status === "APPROVED" && (
                  <button onClick={() => handleStartTrip(b)}>
                    🚗 บันทึกรถออก
                  </button>
                )}

                {canEditBookings && b.status === "IN_USE" && (
                  <button onClick={() => handleCompleteTrip(b)}>
                    ✅ บันทึกรถเข้า
                  </button>
                )}

                {canCancelBookings && (
                <button
                  className="danger-button"
                  onClick={() => handleCancelBooking(b)}
                >
                  ยกเลิกรายการ
                </button>
                )}
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


