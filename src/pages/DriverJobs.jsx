import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { completeTrip, getBookings, getDrivers, getVehicles, startTrip } from "../api";
import { formatThaiDateTime } from "../utils/date";
import { hasPermission, normalizeRole } from "../permissions";
import { showError, showInput, showSuccess } from "../utils/alert";

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("odc_user") || "null");
  } catch {
    return null;
  }
}

function getDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function isToday(value) {
  const today = new Date().toISOString().slice(0, 10);
  return getDateKey(value) === today;
}

function isFuture(value) {
  const key = getDateKey(value);
  if (!key) return false;
  const today = new Date().toISOString().slice(0, 10);
  return key > today;
}

function sortByStart(items) {
  return [...items].sort((a, b) => {
    const timeA = new Date(a.start_datetime || a.created_at || 0).getTime();
    const timeB = new Date(b.start_datetime || b.created_at || 0).getTime();
    return timeA - timeB;
  });
}

function compactText(value) {
  return String(value || "-").trim();
}

function formatVehicleLabel(booking, vehicleMap) {
  const vehicle = vehicleMap.get(String(booking.vehicle_id || "").trim());
  const plate = vehicle?.license_plate || vehicle?.plate_no || "-";
  if (!booking.vehicle_id && plate === "-") return "-";
  return `${booking.vehicle_id || "-"} / ${plate}`;
}

function getBookingIdentity(booking) {
  return {
    driver_id: String(booking.driver_id || "").trim(),
    driver_name: String(booking.driver_name || "").trim(),
  };
}

function matchesCurrentDriver(booking, currentIdentity) {
  const bookingIdentity = getBookingIdentity(booking);

  if (currentIdentity.driver_id && bookingIdentity.driver_id) {
    return bookingIdentity.driver_id === currentIdentity.driver_id;
  }

  if (currentIdentity.driver_name && bookingIdentity.driver_name) {
    return bookingIdentity.driver_name === currentIdentity.driver_name;
  }

  return false;
}

function getStatusMeta(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "IN_USE") return { label: "กำลังใช้งาน", className: "green" };
  if (normalized === "APPROVED") return { label: "รับงานได้", className: "blue" };
  if (normalized === "COMPLETED") return { label: "เสร็จสิ้น", className: "gray" };
  return { label: normalized || "-", className: "gray" };
}

function JobCard({
  booking,
  vehicleMap,
  onStart,
  onComplete,
  onShowDetails,
  canStart,
  canComplete,
  current,
}) {
  const statusMeta = getStatusMeta(booking.status);

  return (
    <div className={`driver-job-card ${current ? "current" : ""}`}>
      <div className="driver-job-card-head">
        <div className="driver-job-head-copy">
          <h3 title={booking.booking_no || "-"}>{booking.booking_no || "-"}</h3>
          <p title={booking.destination || "-"}>{compactText(booking.destination)}</p>
        </div>
        <span className={`status ${statusMeta.className}`}>{statusMeta.label}</span>
      </div>

      <div className="driver-job-grid">
        <div>
          <label>เวลาเริ่ม</label>
          <b title={formatThaiDateTime(booking.start_datetime)}>{formatThaiDateTime(booking.start_datetime)}</b>
        </div>
        <div>
          <label>เวลาสิ้นสุด</label>
          <b title={formatThaiDateTime(booking.end_datetime)}>{formatThaiDateTime(booking.end_datetime)}</b>
        </div>
        <div>
          <label>รถ / ป้ายทะเบียน</label>
          <b title={formatVehicleLabel(booking, vehicleMap)}>{formatVehicleLabel(booking, vehicleMap)}</b>
        </div>
        <div>
          <label>สถานะ</label>
          <b title={compactText(booking.status)}>{compactText(booking.status)}</b>
        </div>
      </div>

      <div className="driver-job-actions">
        <button type="button" className="driver-job-detail-button" onClick={() => onShowDetails(booking)}>
          ดูรายละเอียด
        </button>

        {canStart && normalizeStatus(booking.status) === "APPROVED" && (
          <button type="button" onClick={() => onStart(booking)}>
            รับงาน / ออกรถ
          </button>
        )}

        {canComplete && normalizeStatus(booking.status) === "IN_USE" && (
          <button type="button" className="warning-button" onClick={() => onComplete(booking)}>
            จบงาน / คืนรถ
          </button>
        )}
      </div>
    </div>
  );
}

export default function DriverJobs() {
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentUser = useMemo(() => getCurrentUser(), []);
  const currentRole = normalizeRole(currentUser?.role);
  const canViewPage = hasPermission(null, "driver_jobs_view");
  const canStartTrip = hasPermission(null, "driver_jobs_start");
  const canCompleteTrip = hasPermission(null, "driver_jobs_complete");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [bookingData, vehicleData, driverData] = await Promise.all([
        getBookings(),
        getVehicles(),
        getDrivers(),
      ]);

      setBookings(Array.isArray(bookingData) ? bookingData : []);
      setVehicles(Array.isArray(vehicleData) ? vehicleData : []);
      setDrivers(Array.isArray(driverData) ? driverData : []);
    } catch (err) {
      const message = err.message || "โหลดงานคนขับไม่สำเร็จ";
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const vehicleMap = useMemo(() => {
    const map = new Map();
    vehicles.forEach((vehicle) => {
      map.set(String(vehicle.vehicle_id || "").trim(), vehicle);
    });
    return map;
  }, [vehicles]);

  const currentIdentity = useMemo(() => {
    const currentName = String(currentUser?.name || "").trim();
    const currentDriverId = String(currentUser?.driver_id || "").trim();
    const matchedDriver =
      drivers.find((driver) => currentDriverId && String(driver.driver_id || "").trim() === currentDriverId) ||
      drivers.find((driver) => String(driver.name || "").trim() === currentName);

    return {
      driver_id: currentDriverId || String(matchedDriver?.driver_id || "").trim(),
      driver_name: currentName || String(matchedDriver?.name || "").trim(),
    };
  }, [currentUser, drivers]);

  const assignedBookings = useMemo(() => {
    const active = bookings.filter((booking) => normalizeStatus(booking.status) !== "CANCELLED");

    if (currentRole === "DRIVER") {
      return active.filter((booking) => matchesCurrentDriver(booking, currentIdentity));
    }

    return active.filter((booking) => {
      const identity = getBookingIdentity(booking);
      return Boolean(identity.driver_id || identity.driver_name);
    });
  }, [bookings, currentIdentity, currentRole]);

  const currentJobs = useMemo(
    () => sortByStart(assignedBookings.filter((booking) => normalizeStatus(booking.status) === "IN_USE")),
    [assignedBookings]
  );

  const todayJobs = useMemo(
    () =>
      sortByStart(
        assignedBookings.filter((booking) => {
          const status = normalizeStatus(booking.status);
          return isToday(booking.start_datetime) && status === "APPROVED";
        })
      ),
    [assignedBookings]
  );

  const upcomingJobs = useMemo(
    () =>
      sortByStart(
        assignedBookings.filter((booking) => {
          const status = normalizeStatus(booking.status);
          return isFuture(booking.start_datetime) && status === "APPROVED";
        })
      ),
    [assignedBookings]
  );

  async function handleStart(booking) {
    const outMileage = await showInput("ออกรถ", "เลขไมล์ตอนออกรถ", "เช่น 125000");
    if (!outMileage) return;

    try {
      await startTrip({
        booking_id: booking.booking_id,
        out_time: new Date().toISOString(),
        out_mileage: String(outMileage).trim(),
        driver_id: currentIdentity.driver_id,
        driver_name: currentIdentity.driver_name,
      });

      await showSuccess("เริ่มงานและบันทึกการออกรถสำเร็จ");
      await loadData();
    } catch (err) {
      showError(err.message || "เริ่มงานไม่สำเร็จ");
    }
  }

  async function handleComplete(booking) {
    const result = await Swal.fire({
      title: "จบงาน / คืนรถ",
      html: `
        <div class="swal-form">
          <label>เลขไมล์ตอนเข้ารถ</label>
          <input id="in_mileage" class="swal2-input" placeholder="เช่น 125500">
          <label>หมายเหตุ</label>
          <textarea id="remark" class="swal2-textarea" rows="4" placeholder="ระบุหมายเหตุ"></textarea>
        </div>
      `,
      width: 700,
      showCancelButton: true,
      confirmButtonText: "ยืนยัน",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#1455c8",
      cancelButtonColor: "#64748b",
      preConfirm: () => {
        const inMileage = document.getElementById("in_mileage").value.trim();
        const remark = document.getElementById("remark").value.trim();

        if (!inMileage) {
          Swal.showValidationMessage("กรุณากรอกเลขไมล์ตอนเข้ารถ");
          return false;
        }

        return { in_mileage: inMileage, remark };
      },
    });

    if (!result.isConfirmed) return;

    try {
      await completeTrip({
        booking_id: booking.booking_id,
        in_time: new Date().toISOString(),
        in_mileage: result.value.in_mileage,
        remark: result.value.remark,
        driver_id: currentIdentity.driver_id,
        driver_name: currentIdentity.driver_name,
      });

      await showSuccess("จบงานและบันทึกการคืนรถสำเร็จ");
      await loadData();
    } catch (err) {
      showError(err.message || "จบงานไม่สำเร็จ");
    }
  }

  function showDetails(booking) {
    const vehicleLabel = formatVehicleLabel(booking, vehicleMap);

    Swal.fire({
      title: booking.booking_no || "รายละเอียดงาน",
      width: 720,
      confirmButtonText: "ปิด",
      confirmButtonColor: "#1455c8",
      html: `
        <div class="driver-detail-modal">
          <div><span>ผู้จอง</span><b>${compactText(booking.requester_name)}</b></div>
          <div><span>หน่วยงาน</span><b>${compactText(booking.department)}</b></div>
          <div><span>โทรศัพท์</span><b>${compactText(booking.phone)}</b></div>
          <div><span>เวลาเริ่ม</span><b>${compactText(formatThaiDateTime(booking.start_datetime))}</b></div>
          <div><span>เวลาสิ้นสุด</span><b>${compactText(formatThaiDateTime(booking.end_datetime))}</b></div>
          <div><span>ปลายทาง</span><b>${compactText(booking.destination)}</b></div>
          <div><span>เหตุผล</span><b>${compactText(booking.purpose)}</b></div>
          <div><span>รถ / ป้ายทะเบียน</span><b>${compactText(vehicleLabel)}</b></div>
          <div><span>สถานะ</span><b>${compactText(booking.status)}</b></div>
          <div><span>หมายเหตุเจ้าหน้าที่</span><b>${compactText(booking.staff_note)}</b></div>
        </div>
      `,
    });
  }

  if (!canViewPage) {
    return <div className="form-card">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  return (
    <div className="driver-jobs-page">
      <div className="page-header">
        <div>
          <h2>งานคนขับ</h2>
          <p>ดูและจัดการงานที่ถูกมอบหมายให้คนขับ</p>
        </div>

        <button type="button" onClick={loadData}>
          รีเฟรชข้อมูล
        </button>
      </div>

      {loading && <div className="form-card">กำลังโหลดงานคนขับ...</div>}
      {error && !loading && <div className="form-card">{error}</div>}

      {!loading && !error && (
        <>
          <div className="form-card">
            <div className="section-header">
              <h3>งานที่กำลังใช้งาน</h3>
              <span className="section-counter">{currentJobs.length} งาน</span>
            </div>

            {currentJobs.length === 0 ? (
              <div className="driver-empty">ไม่มีงานที่กำลังใช้งาน</div>
            ) : (
              <div className="driver-job-list">
                {currentJobs.map((booking) => (
                  <JobCard
                    key={booking.booking_id}
                    booking={booking}
                    vehicleMap={vehicleMap}
                    onStart={handleStart}
                    onComplete={handleComplete}
                    onShowDetails={showDetails}
                    canStart={canStartTrip}
                    canComplete={canCompleteTrip}
                    current
                  />
                ))}
              </div>
            )}
          </div>

          <div className="form-card">
            <div className="section-header">
              <h3>งานวันนี้</h3>
              <span className="section-counter">{todayJobs.length} งาน</span>
            </div>

            {todayJobs.length === 0 ? (
              <div className="driver-empty">ไม่มีงานที่มีกำหนดวันนี้</div>
            ) : (
              <div className="driver-job-list">
                {todayJobs.map((booking) => (
                  <JobCard
                    key={booking.booking_id}
                    booking={booking}
                    vehicleMap={vehicleMap}
                    onStart={handleStart}
                    onComplete={handleComplete}
                    onShowDetails={showDetails}
                    canStart={canStartTrip}
                    canComplete={canCompleteTrip}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="form-card">
            <div className="section-header">
              <h3>งานถัดไป</h3>
              <span className="section-counter">{upcomingJobs.length} งาน</span>
            </div>

            {upcomingJobs.length === 0 ? (
              <div className="driver-empty">ไม่มีงานถัดไป</div>
            ) : (
              <div className="driver-job-list">
                {upcomingJobs.map((booking) => (
                  <JobCard
                    key={booking.booking_id}
                    booking={booking}
                    vehicleMap={vehicleMap}
                    onStart={handleStart}
                    onComplete={handleComplete}
                    onShowDetails={showDetails}
                    canStart={canStartTrip}
                    canComplete={canCompleteTrip}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
