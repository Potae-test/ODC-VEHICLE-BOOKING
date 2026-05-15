import { memo, useCallback, useEffect, useMemo, useState } from "react";
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

function isToday(value, todayKey) {
  return getDateKey(value) === todayKey;
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

function groupBookingsByAssignee(bookings) {
  const byAssignedUserId = new Map();
  const byAssignedUserName = new Map();
  const all = [];

  bookings.forEach((booking) => {
    if (normalizeStatus(booking.status) === "CANCELLED") return;

    all.push(booking);

    const identity = getBookingIdentity(booking);
    if (identity.assigned_user_id) {
      if (!byAssignedUserId.has(identity.assigned_user_id)) {
        byAssignedUserId.set(identity.assigned_user_id, []);
      }
      byAssignedUserId.get(identity.assigned_user_id).push(booking);
      return;
    }

    const name = identity.assigned_user_name || identity.driver_name;
    if (name) {
      if (!byAssignedUserName.has(name)) byAssignedUserName.set(name, []);
      byAssignedUserName.get(name).push(booking);
    }
  });

  return { all, byAssignedUserId, byAssignedUserName };
}

function getCurrentUserBookings(groupedBookings, currentUser, currentRole) {
  if (currentRole === "ADMIN" || currentRole === "STAFF") {
    return groupedBookings.all;
  }

  const currentUserId = String(currentUser?.user_id || "").trim();
  const currentUserName = String(currentUser?.name || "").trim();
  const byId = currentUserId ? groupedBookings.byAssignedUserId.get(currentUserId) || [] : [];
  const byName = currentUserName ? groupedBookings.byAssignedUserName.get(currentUserName) || [] : [];

  return [...byId, ...byName];
}

function useDebouncedValue(value, delay = 250) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
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

const JobCard = memo(function JobCard({
  booking,
  vehicleMap,
  onStart,
  onComplete,
  onCancelJob,
  onShowDetails,
  canStart,
  canComplete,
  current,
  processing,
}) {
  const status = normalizeStatus(booking.status);
  const statusMeta = getStatusMeta(status);
  const vehicleLabel = formatVehicleLabel(booking, vehicleMap);
  const startLabel = formatThaiDateTime(booking.start_datetime);
  const endLabel = formatThaiDateTime(booking.end_datetime);
  const disabled = Boolean(processing);

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
          <b title={startLabel}>{startLabel}</b>
        </div>
        <div>
          <label>เวลาสิ้นสุด</label>
          <b title={endLabel}>{endLabel}</b>
        </div>
        <div>
          <label>รถ / ป้ายทะเบียน</label>
          <b title={vehicleLabel}>{vehicleLabel}</b>
        </div>
        <div>
          <label>สถานะ</label>
          <b title={getStatusLabel(status)}>{getStatusLabel(status)}</b>
        </div>
      </div>

      <div className="driver-job-actions">
        <button type="button" className="driver-job-detail-button" disabled={disabled} onClick={() => onShowDetails(booking)}>
          ดูรายละเอียด
        </button>

        {status === "APPROVED" && onCancelJob && (
          <button type="button" className="warning-button" disabled={disabled} onClick={() => onCancelJob(booking)}>
            ยกเลิกงาน
          </button>
        )}

        {canStart && status === "APPROVED" && (
          <button type="button" disabled={disabled} onClick={() => onStart(booking)}>
            รับงาน / ออกรถ
          </button>
        )}

        {canComplete && status === "IN_USE" && (
          <button type="button" className="warning-button" disabled={disabled} onClick={() => onComplete(booking)}>
            จบงาน / คืนรถ
          </button>
        )}
      </div>
    </div>
  );
});

export default function DriverJobs() {
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [waitingSearch, setWaitingSearch] = useState("");
  const [processingAction, setProcessingAction] = useState(null);
  const debouncedWaitingSearch = useDebouncedValue(waitingSearch);

  const currentUser = useMemo(() => getCurrentUser(), []);
  const currentRole = normalizeRole(currentUser?.role);
  const canViewPage =
    currentRole === "ADMIN" ||
    currentRole === "STAFF" ||
    currentRole === "DRIVER" ||
    hasPermission(currentRole, "driver_jobs_view");
  const canStartTrip = hasPermission(null, "driver_jobs_start");
  const canCompleteTrip = hasPermission(null, "driver_jobs_complete");

  const mergeBooking = useCallback((bookingId, nextValues) => {
    setBookings((current) =>
      current.map((booking) =>
        String(booking.booking_id) === String(bookingId)
          ? { ...booking, ...nextValues }
          : booking
      )
    );
  }, []);

  const loadData = useCallback(async (options = {}) => {
    try {
      if (options.refreshOnly) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const bookingFetcher = options.freshBookings || options.refreshOnly ? getBookingsFresh : getBookings;
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
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const vehicleMap = useMemo(() => {
    const map = new Map();
    vehicles.forEach((vehicle) => {
      map.set(String(vehicle.vehicle_id || "").trim(), vehicle);
    });
    return map;
  }, [vehicles]);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const groupedBookings = useMemo(() => groupBookingsByAssignee(bookings), [bookings]);

  const assignedBookings = useMemo(() => {
    const grouped = getCurrentUserBookings(groupedBookings, currentUser, currentRole);
    return grouped.filter((booking) => matchesCurrentUser(booking, currentUser));
  }, [currentRole, currentUser, groupedBookings]);

  const currentJobs = useMemo(
    () => sortByStart(assignedBookings.filter((booking) => normalizeStatus(booking.status) === "IN_USE")),
    [assignedBookings]
  );

  const todayJobs = useMemo(
    () =>
      sortByTodayPriority(
        assignedBookings.filter((booking) => {
          const status = normalizeStatus(booking.status);
          return isToday(booking.start_datetime, todayKey) && status === "APPROVED";
        })
      ),
    [assignedBookings, todayKey]
  );

  const waitingJobs = useMemo(
    () => sortByTodayPriority(assignedBookings.filter((booking) => normalizeStatus(booking.status) === "APPROVED")),
    [assignedBookings]
  );

  const filteredWaitingJobs = useMemo(
    () => waitingJobs.filter((booking) => matchesWaitingSearch(booking, debouncedWaitingSearch)),
    [debouncedWaitingSearch, waitingJobs]
  );

  const handleStart = useCallback(async (booking) => {
    if (processingAction) return;
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
      setProcessingAction({ bookingId: booking.booking_id, type: "start" });
      const response = await startTrip({
        booking_id: booking.booking_id,
        out_time: new Date().toISOString(),
        out_mileage: "",
        assigned_user_id: currentUser?.user_id || "",
        assigned_user_name: currentUser?.name || "",
      });

      console.log("DriverJobs startTrip response", response);

      if (response?.success === false) {
        showError(response?.message || "เริ่มงานไม่สำเร็จ");
        return;
      }

      await showSuccess("เริ่มงานและบันทึกการออกรถสำเร็จ");
      mergeBooking(booking.booking_id, { status: "IN_USE", updated_at: new Date().toISOString() });
    } catch (err) {
      showError(err.message || "เริ่มงานไม่สำเร็จ");
    } finally {
      setProcessingAction(null);
    }
  }, [currentUser?.name, currentUser?.user_id, mergeBooking, processingAction]);

  const handleComplete = useCallback(async (booking) => {
    if (processingAction) return;
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
      setProcessingAction({ bookingId: booking.booking_id, type: "complete" });
      await completeTrip({
        booking_id: booking.booking_id,
        in_time: new Date().toISOString(),
        in_mileage: "",
        remark: "",
        assigned_user_id: currentUser?.user_id || "",
        assigned_user_name: currentUser?.name || "",
      });

      await showSuccess("จบงานและบันทึกการคืนรถสำเร็จ");
      mergeBooking(booking.booking_id, { status: "COMPLETED", updated_at: new Date().toISOString() });
    } catch (err) {
      showError(err.message || "จบงานไม่สำเร็จ");
    } finally {
      setProcessingAction(null);
    }
  }, [currentUser?.name, currentUser?.user_id, mergeBooking, processingAction]);

  const handleCancelJob = useCallback(async (booking) => {
    if (processingAction) return;
    const result = await Swal.fire({
      title: "ยกเลิกงาน",
      text: "ยืนยันการยกเลิกงานนี้ใช่หรือไม่",
      showCancelButton: true,
      confirmButtonText: "ตกลง",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      title: "ยกเลิกงาน",
      html: `
        <div class="swal-form">
          <label>เหตุผลการยกเลิกงาน</label>
          <textarea
            id="driver_cancel_reason"
            class="swal2-textarea"
            rows="5"
            placeholder="ระบุเหตุผล เช่น ติดภารกิจด่วน / รถมีปัญหา / ไม่สามารถรับงานได้"
          ></textarea>
        </div>
      `,
      width: 720,
      confirmButtonText: "ยืนยันยกเลิกงาน",
      cancelButtonText: "ยกเลิก",
      preConfirm: () => {
        const reason = document.getElementById("driver_cancel_reason").value.trim();

        if (!reason) {
          Swal.showValidationMessage("กรุณาระบุเหตุผลการยกเลิกงาน");
          return false;
        }

        return reason;
      },
    });

    if (!result.isConfirmed) return;

    try {
      setProcessingAction({ bookingId: booking.booking_id, type: "cancel" });
      const response = await driverCancelJob({
        booking_id: booking.booking_id,
        reason: result.value,
        cancelled_by: currentUser?.name || currentUser?.email || "",
      });

      if (response?.success === false) {
        showError(response?.message || "ยกเลิกงานไม่สำเร็จ");
        return;
      }

      await showSuccess("ยกเลิกงานสำเร็จ");
      const staffNote =
        response?.staff_note ||
        `คนขับยกเลิกงาน: ${result.value}`;
      mergeBooking(booking.booking_id, {
        assigned_user_id: "",
        assigned_user_name: "",
        status: "APPROVED",
        staff_note: staffNote,
      });
    } catch (err) {
      showError(err.message || "ยกเลิกงานไม่สำเร็จ");
    } finally {
      setProcessingAction(null);
    }
  }, [currentUser?.email, currentUser?.name, mergeBooking, processingAction]);

  const showDetails = useCallback((booking) => {
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
  }, [vehicleMap]);

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

        <button type="button" disabled={refreshing || loading} onClick={() => loadData({ refreshOnly: true })}>
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
                    processing={
                      processingAction?.bookingId === booking.booking_id
                        ? processingAction.type
                        : ""
                    }
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
                    processing={
                      processingAction?.bookingId === booking.booking_id
                        ? processingAction.type
                        : ""
                    }
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
                    processing={
                      processingAction?.bookingId === booking.booking_id
                        ? processingAction.type
                        : ""
                    }
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
