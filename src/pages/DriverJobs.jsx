import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { completeTrip, driverCancelJob, getBookings, getBookingsFresh, getVehicles, startTrip } from "../api";
import { formatThaiDateTime } from "../utils/date";
import { hasPermission, normalizeRole } from "../permissions";
import { showError, showSuccess } from "../utils/alert";

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

function sortByStart(items) {
  return [...items].sort((a, b) => {
    const timeA = new Date(a.start_datetime || a.created_at || 0).getTime();
    const timeB = new Date(b.start_datetime || b.created_at || 0).getTime();
    return timeA - timeB;
  });
}

function sortByTodayPriority(items) {
  return [...items].sort((a, b) => {
    const createdA = new Date(a.created_at || 0).getTime();
    const createdB = new Date(b.created_at || 0).getTime();
    if (createdA !== createdB) return createdA - createdB;

    const bookingNoA = String(a.booking_no || "").trim();
    const bookingNoB = String(b.booking_no || "").trim();
    if (bookingNoA !== bookingNoB) return bookingNoA.localeCompare(bookingNoB, "th", { numeric: true });

    const startA = new Date(a.start_datetime || 0).getTime();
    const startB = new Date(b.start_datetime || 0).getTime();
    if (startA !== startB) return startA - startB;

    return 0;
  });
}

function matchesWaitingSearch(booking, searchText) {
  const query = String(searchText || "").trim().toLocaleLowerCase("th");
  if (!query) return true;

  const fields = [
    booking.requester_name,
    booking.start_datetime,
    formatThaiDateTime(booking.start_datetime),
    booking.destination,
    booking.purpose,
  ];

  return fields.some((field) => String(field || "").toLocaleLowerCase("th").includes(query));
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
    assigned_user_id: String(booking.assigned_user_id || "").trim(),
    assigned_user_name: String(booking.assigned_user_name || "").trim(),
    driver_name: String(booking.driver_name || "").trim(),
  };
}

function matchesCurrentUser(booking, currentUser) {
  const bookingIdentity = getBookingIdentity(booking);
  const currentRole = normalizeRole(currentUser?.role);
  const currentUserId = String(currentUser?.user_id || "").trim();
  const currentUserName = String(currentUser?.name || "").trim();

  if (currentRole === "ADMIN" || currentRole === "STAFF") {
    return true;
  }

  if (bookingIdentity.assigned_user_id) {
    return Boolean(currentUserId) && bookingIdentity.assigned_user_id === currentUserId;
  }

  if (bookingIdentity.assigned_user_name) {
    return Boolean(currentUserName) && bookingIdentity.assigned_user_name === currentUserName;
  }

  return Boolean(currentUserName) && bookingIdentity.driver_name === currentUserName;
}

function getStatusLabel(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "PENDING") return "รออนุมัติ";
  if (normalized === "APPROVED") return "อนุมัติแล้ว";
  if (normalized === "IN_USE") return "กำลังใช้งาน";
  if (normalized === "COMPLETED") return "เสร็จสิ้น";
  if (normalized === "CANCELLED") return "ยกเลิก";
  return normalized || "-";
}

function getStatusMeta(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "IN_USE") return { label: getStatusLabel(status), className: "green" };
  if (normalized === "APPROVED") return { label: getStatusLabel(status), className: "blue" };
  if (normalized === "COMPLETED") return { label: getStatusLabel(status), className: "gray" };
  if (normalized === "PENDING") return { label: getStatusLabel(status), className: "amber" };
  if (normalized === "CANCELLED") return { label: getStatusLabel(status), className: "red" };
  return { label: getStatusLabel(status), className: "gray" };
}

function JobCard({
  booking,
  vehicleMap,
  onStart,
  onComplete,
  onCancelJob,
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
          {/* <h3 title={booking.booking_no || "-"}>{booking.booking_no || "-"}</h3> */}
          <h3 title={booking.destination || "-"}>{compactText(booking.destination)}</h3>
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
          <b title={getStatusLabel(booking.status)}>{getStatusLabel(booking.status)}</b>
        </div>
      </div>

      <div className="driver-job-actions">
        <button type="button" className="driver-job-detail-button" onClick={() => onShowDetails(booking)}>
          ดูรายละเอียด
        </button>

        {normalizeStatus(booking.status) === "APPROVED" && onCancelJob && (
          <button type="button" className="warning-button" onClick={() => onCancelJob(booking)}>
            ยกเลิกงาน
          </button>
        )}

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [waitingSearch, setWaitingSearch] = useState("");

  const currentUser = useMemo(() => getCurrentUser(), []);
  const currentRole = normalizeRole(currentUser?.role);
  const canViewPage =
    currentRole === "ADMIN" ||
    currentRole === "STAFF" ||
    currentRole === "DRIVER" ||
    hasPermission(currentRole, "driver_jobs_view");
  const canStartTrip = hasPermission(null, "driver_jobs_start");
  const canCompleteTrip = hasPermission(null, "driver_jobs_complete");

  async function loadData(options = {}) {
    try {
      setLoading(true);
      setError("");

      const bookingFetcher = options.freshBookings ? getBookingsFresh : getBookings;
      const [bookingData, vehicleData] = await Promise.all([bookingFetcher(), getVehicles()]);

      setBookings(Array.isArray(bookingData) ? bookingData : []);
      setVehicles(Array.isArray(vehicleData) ? vehicleData : []);
      if (options.logBookingId) {
        const updatedBooking = (Array.isArray(bookingData) ? bookingData : []).find(
          (item) => String(item.booking_id || "").trim() === String(options.logBookingId || "").trim()
        );
        console.log("DriverJobs refreshed booking row", updatedBooking || null);
      }
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

  const assignedBookings = useMemo(() => {
    const active = bookings.filter((booking) => normalizeStatus(booking.status) !== "CANCELLED");

    return active.filter((booking) => matchesCurrentUser(booking, currentUser));
  }, [bookings, currentUser]);

  const currentJobs = useMemo(
    () => sortByStart(assignedBookings.filter((booking) => normalizeStatus(booking.status) === "IN_USE")),
    [assignedBookings]
  );

  const todayJobs = useMemo(
    () =>
      sortByTodayPriority(
        assignedBookings.filter((booking) => {
          const status = normalizeStatus(booking.status);
          return isToday(booking.start_datetime) && status === "APPROVED";
        })
      ),
    [assignedBookings]
  );

  const waitingJobs = useMemo(
    () => sortByTodayPriority(assignedBookings.filter((booking) => normalizeStatus(booking.status) === "APPROVED")),
    [assignedBookings]
  );

  const filteredWaitingJobs = useMemo(
    () => waitingJobs.filter((booking) => matchesWaitingSearch(booking, waitingSearch)),
    [waitingJobs, waitingSearch]
  );

  async function handleStart(booking) {
    const result = await Swal.fire({
      title: "รับงาน / ออกรถ",
      text: "ยืนยันการรับงานและออกรถใช่หรือไม่",
      showCancelButton: true,
      confirmButtonText: "ตกลง",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#1455c8",
      cancelButtonColor: "#64748b",
    });

    if (!result.isConfirmed) return;

    try {
      const response = await startTrip({
        booking_id: booking.booking_id,
        out_time: new Date().toISOString(),
        out_mileage: "",
        assigned_user_id: currentUser?.user_id || "",
        assigned_user_name: currentUser?.name || "",
      });

      console.log("DriverJobs startTrip response", response);

      if (!response?.success) {
        showError(response?.message || "เริ่มงานไม่สำเร็จ");
        return;
      }

      await showSuccess("เริ่มงานและบันทึกการออกรถสำเร็จ");
      await loadData({ freshBookings: true, logBookingId: booking.booking_id });
    } catch (err) {
      showError(err.message || "เริ่มงานไม่สำเร็จ");
    }
  }

  async function handleComplete(booking) {
    const result = await Swal.fire({
      title: "จบงาน / คืนรถ",
      showCancelButton: true,
      confirmButtonText: "ตกลง",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#1455c8",
      cancelButtonColor: "#64748b",
      text: "ยืนยันการจบงานและคืนรถใช่หรือไม่",
    });

    if (!result.isConfirmed) return;

    try {
      await completeTrip({
        booking_id: booking.booking_id,
        in_time: new Date().toISOString(),
        in_mileage: "",
        remark: "",
        assigned_user_id: currentUser?.user_id || "",
        assigned_user_name: currentUser?.name || "",
      });

      await showSuccess("จบงานและบันทึกการคืนรถสำเร็จ");
      await loadData();
    } catch (err) {
      showError(err.message || "จบงานไม่สำเร็จ");
    }
  }

  async function handleCancelJob(booking) {
    const result = await Swal.fire({
      title: "ยกเลิกงาน",
      text: "ยืนยันการยกเลิกงานนี้ใช่หรือไม่",
      showCancelButton: true,
      confirmButtonText: "ตกลง",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });

    if (!result.isConfirmed) return;

    try {
      const response = await driverCancelJob({
        booking_id: booking.booking_id,
      });

      if (!response?.success) {
        showError(response?.message || "ยกเลิกงานไม่สำเร็จ");
        return;
      }

      await showSuccess("ยกเลิกงานสำเร็จ");
      await loadData({ freshBookings: true });
    } catch (err) {
      showError(err.message || "ยกเลิกงานไม่สำเร็จ");
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
          <div><span>สถานะ</span><b>${compactText(getStatusLabel(booking.status))}</b></div>
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
                    onCancelJob={handleCancelJob}
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
                    onCancelJob={handleCancelJob}
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
              <h3>งานที่รออยู่ทั้งหมด</h3>
              <span className="section-counter">{filteredWaitingJobs.length} / {waitingJobs.length} งาน</span>
            </div>

            <div className="driver-job-search">
              <input
                type="search"
                value={waitingSearch}
                onChange={(event) => setWaitingSearch(event.target.value)}
                placeholder="ค้นหาผู้จอง เวลา ปลายทาง หรือเหตุผล"
                aria-label="ค้นหางานที่รออยู่ทั้งหมด"
              />
            </div>

            {filteredWaitingJobs.length === 0 ? (
              <div className="driver-empty">ไม่มีงานที่รออยู่ตามเงื่อนไขนี้</div>
            ) : (
              <div className="driver-job-list">
                {filteredWaitingJobs.map((booking) => (
                  <JobCard
                    key={booking.booking_id}
                    booking={booking}
                    vehicleMap={vehicleMap}
                    onStart={handleStart}
                    onComplete={handleComplete}
                    onCancelJob={handleCancelJob}
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
