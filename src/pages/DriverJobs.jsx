import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  completeTrip,
  getBookings,
  getVehicles,
  requestDriverCancelJob,
  startTrip,
} from "../api";
import AppLayout from "../layouts/AppLayout";
import MobileGrid from "../layouts/MobileGrid";
import MobilePageHeader from "../layouts/MobilePageHeader";
import MobilePageSection from "../layouts/MobilePageSection";
import { formatThaiDateTime } from "../utils/date";
import { hasPermission, normalizeRole } from "../permissions";
import { showError, showSuccess } from "../utils/alert";
import { FEATURES } from "../config/features";

const DRIVER_JOBS_PAGE_SIZE = 5;

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function isCompletedBooking(booking) {
  return normalizeStatus(booking?.status) === "COMPLETED";
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
  if (!FEATURES.vehicleModule) return "-";
  const vehicle = vehicleMap.get(String(booking.vehicle_id || "").trim());

  if (!vehicle) return "-";

  const vehicleType = getVehicleTypeText(
    vehicle.vehicle_type ||
    booking.vehicle_type ||
    booking.vehicle_type_request
  );

  const plate =
    vehicle.license_plate ||
    vehicle.plate_no ||
    "-";

  return `${vehicleType} / ${plate}`;
}

function getBookingIdentity(booking) {
  return {
    assigned_user_id: String(booking.assigned_user_id || "").trim(),
    assigned_user_name: String(booking.assigned_user_name || "").trim(),
    driver_name: String(booking.driver_name || "").trim(),
  };
}

function isManagingOnBehalf(booking, currentUser) {
  const assignedUserId = String(booking.assigned_user_id || "").trim();
  const currentUserId = String(currentUser?.user_id || "").trim();

  if (!assignedUserId || !currentUserId) return false;

  return assignedUserId !== currentUserId;
}

function getAssignedUserLabel(booking) {
  return compactText(booking.assigned_user_name || booking.driver_name || "-");
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

function getDriverCancelRequestStatus(booking) {
  if (isCompletedBooking(booking)) {
    return "";
  }

  return normalizeStatus(booking.driver_cancel_request_status);
}

function isPendingDriverCancel(booking) {
  return getDriverCancelRequestStatus(booking) === "PENDING";
}

function getDriverCancelRequestStateLabel(booking) {
  if (isCompletedBooking(booking)) {
    return "";
  }

  const status = getDriverCancelRequestStatus(booking);
  if (status === "PENDING") return "รอ STAFF อนุมัติยกเลิก";
  if (status === "REJECTED") return "ไม่อนุมัติการยกเลิก";
  if (status === "APPROVED") return "อนุมัติยกเลิกแล้ว";
  return "";
}

function getTotalPages(items, pageSize = DRIVER_JOBS_PAGE_SIZE) {
  return Math.max(1, Math.ceil(items.length / pageSize));
}

function paginateItems(items, page, pageSize = DRIVER_JOBS_PAGE_SIZE) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function renderStatusBadge(status) {
  const statusMeta = getStatusMeta(status);
  return <span className={`status ${statusMeta.className}`}>{statusMeta.label}</span>;
}

function PaginationControls({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      {Array.from({ length: totalPages }).map((_, index) => (
        <button
          key={index}
          type="button"
          className={page === index + 1 ? "active-page" : ""}
          onClick={() => onChange(index + 1)}
        >
          {index + 1}
        </button>
      ))}
    </div>
  );
}

function Icon({ children, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

function ChevronDownIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

function RefreshIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="M21 12a9 9 0 0 0-15.3-6.4" />
      <path d="M3 4v5h5" />
      <path d="M3 12a9 9 0 0 0 15.3 6.4" />
      <path d="M21 20v-5h-5" />
    </Icon>
  );
}

function DriverJobCompactCard({
  booking,
  vehicleMap,
  onStart,
  onComplete,
  onCancelJob,
  onShowDetails,
  canStart,
  canComplete,
  processing,
  current = false,
  expanded = false,
  onToggleExpand,
}) {
  const status = normalizeStatus(booking.status);
  const statusMeta = getStatusMeta(status);
  const vehicleLabel = formatVehicleLabel(booking, vehicleMap);
  const startLabel = formatThaiDateTime(booking.start_datetime);
  const endLabel = formatThaiDateTime(booking.end_datetime);
  const assignedUserLabel = getAssignedUserLabel(booking);
  const hasPendingDriverCancelRequest = isPendingDriverCancel(booking);
  const hasRejectedDriverCancelRequest = getDriverCancelRequestStatus(booking) === "REJECTED";
  const disabled = Boolean(processing);
  const canRequestCancel = status === "APPROVED" && onCancelJob && !hasPendingDriverCancelRequest;
  const canStartNow = canStart && status === "APPROVED" && !hasPendingDriverCancelRequest;
  const canCompleteNow = canComplete && status === "IN_USE" && !hasPendingDriverCancelRequest;
  const cardStateClass =
    current || status === "IN_USE"
      ? "driver-job-compact-card--current"
      : status === "APPROVED"
        ? "driver-job-compact-card--approved"
        : status === "PENDING"
          ? "driver-job-compact-card--pending"
          : "";
const startDate = booking.start_datetime
  ? new Date(booking.start_datetime).toLocaleDateString("th-TH")
  : "-";

const startTime = booking.start_datetime
  ? new Date(booking.start_datetime).toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    })
  : "-";
  return (
    <article
      className={`driver-job-compact-card ${cardStateClass}`.trim()}
    >
      <button
        type="button"
        className="driver-job-compact-main"
        aria-expanded={expanded}
        onClick={() => onToggleExpand(booking.booking_id)}
      >
      <div className="driver-job-compact-time">
        <span>
          วันที่: {startDate} เวลา: {startTime} น.
        </span>
      </div>
        <div className="driver-job-compact-copy">
          <div className="driver-job-compact-destination" title={booking.destination || "-"}>
             <span>รายการจอง: {compactText(booking.destination)}</span>
          </div>
          <div className="driver-job-compact-meta">
            <span>ผู้จอง: {compactText(booking.requester_name)}</span>
            <span>พขร: {vehicleLabel !== "-" ? vehicleLabel : compactText(assignedUserLabel)}</span>
          </div>
        </div>

        <div className="driver-job-compact-right">
          <span className={`status ${statusMeta.className}`}>{statusMeta.label}</span>
          <ChevronDownIcon
            className={[
              "driver-job-compact-chevron h-4 w-4 shrink-0 text-slate-400 transition-transform",
              expanded ? "rotate-180" : "",
            ].join(" ")}
          />
        </div>
      </button>

      {expanded ? (
        <div className="driver-job-compact-expanded">
          <div className="driver-job-compact-detail-grid">
            <div>
              <label>เวลาไป</label>
              <b title={startLabel}>{startLabel || "-"}</b>
            </div>
            <div>
              <label>เวลากลับ</label>
              <b title={endLabel}>{endLabel || "-"}</b>
            </div>
            {FEATURES.vehicleModule && (
              <div>
                <label>รถ / ป้ายทะเบียน</label>
                <b title={vehicleLabel}>{vehicleLabel}</b>
              </div>
            )}
            <div>
              <label>มอบหมายให้</label>
              <b title={assignedUserLabel}>{assignedUserLabel}</b>
            </div>
            {booking.staff_note && (
              <div className="driver-job-compact-note">
                <label>หมายเหตุ</label>
                <b title={booking.staff_note}>{booking.staff_note}</b>
              </div>
            )}
            {hasPendingDriverCancelRequest && booking.driver_cancel_request_reason && (
              <div className="driver-job-compact-note">
                <label>เหตุผลที่ขอยกเลิก</label>
                <b title={booking.driver_cancel_request_reason}>{booking.driver_cancel_request_reason}</b>
              </div>
            )}
            {hasRejectedDriverCancelRequest && booking.driver_cancel_review_reason && (
              <div className="driver-job-compact-note">
                <label>เหตุผลจาก STAFF</label>
                <b title={booking.driver_cancel_review_reason}>{booking.driver_cancel_review_reason}</b>
              </div>
            )}
          </div>

          <div className="driver-job-compact-actions">
            <button
              type="button"
              className="driver-job-compact-action driver-job-compact-action--detail"
              disabled={disabled}
              onClick={() => onShowDetails(booking)}
            >
              ดูรายละเอียด
            </button>

            {canRequestCancel ? (
              <button
                type="button"
                className="driver-job-compact-action driver-job-compact-action--cancel"
                disabled={disabled}
                onClick={() => onCancelJob(booking)}
              >
                {processing === "cancel-request" ? "กำลังยกเลิกงาน..." : "ยกเลิกงาน"}
              </button>
            ) : null}

            {canStartNow ? (
              <button
                type="button"
                className="driver-job-compact-action driver-job-compact-action--start"
                disabled={disabled}
                onClick={() => onStart(booking)}
              >
                {processing === "start" ? "กำลังรับงาน..." : "รับงาน / วิ่งงาน"}
              </button>
            ) : null}

            {canCompleteNow ? (
              <button
                type="button"
                className="driver-job-compact-action driver-job-compact-action--complete"
                disabled={disabled}
                onClick={() => onComplete(booking)}
              >
                {processing === "complete" ? "กำลังจบงาน..." : "จบงาน / คืนรถ"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
function DriverJobTableActions({
  booking,
  processing,
  onShowDetails,
  onCancelJob,
  onStart,
  onComplete,
  canStart,
  canComplete,
}) {
  const status = normalizeStatus(booking.status);
  const hasPendingDriverCancelRequest = isPendingDriverCancel(booking);
  const disabled = Boolean(processing);

  return (
    <div className="action-buttons">
      <button type="button" className="driver-job-detail-button" disabled={disabled} onClick={() => onShowDetails(booking)}>
        ดูรายละเอียด
      </button>

      {status === "APPROVED" && onCancelJob && !hasPendingDriverCancelRequest && (
        <button type="button" className="warning-button" disabled={disabled} onClick={() => onCancelJob(booking)}>
          {processing === "cancel-request" ? "กำลังยกเลิกงาน..." : "ยกเลิกงาน"}
        </button>
      )}

      {canStart && status === "APPROVED" && !hasPendingDriverCancelRequest && (
        <button type="button" disabled={disabled} onClick={() => onStart(booking)}>
          {processing === "start" ? "กำลังรับงาน..." : "รับงาน / วิ่งงาน"}
          </button>
      )}

      {canComplete && status === "IN_USE" && !hasPendingDriverCancelRequest && (
        <button type="button" className="warning-button" disabled={disabled} onClick={() => onComplete(booking)}>
          {processing === "complete" ? "กำลังจบงาน..." : "จบงาน / คืนรถ"}
        </button>
      )}
    </div>
  );
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
  currentUser,
  currentRole,
}) {
  const status = normalizeStatus(booking.status);
  const statusMeta = getStatusMeta(status);
  const vehicleLabel = formatVehicleLabel(booking, vehicleMap);
  const startLabel = formatThaiDateTime(booking.start_datetime);
  const endLabel = formatThaiDateTime(booking.end_datetime);
  const assignedUserLabel = getAssignedUserLabel(booking);
  const driverCancelRequestStatus = getDriverCancelRequestStatus(booking);
  const hasPendingDriverCancelRequest = isPendingDriverCancel(booking);
  const hasRejectedDriverCancelRequest = driverCancelRequestStatus === "REJECTED";
  const managingOnBehalf =
    (currentRole === "ADMIN" || currentRole === "STAFF") && isManagingOnBehalf(booking, currentUser);
  const disabled = Boolean(processing);

  return (
    <div className={`driver-job-card ${current ? "current" : ""}`}>
      <div className="driver-job-card-head">
        <div className="driver-job-head-copy">
          <span className="driver-job-requester">{compactText(booking.requester_name)}</span>
          <h3 title={booking.destination || "-"}>{compactText(booking.destination)}</h3>
        </div>
        <div className="driver-job-head-meta">
          <span className={`status ${statusMeta.className}`}>{statusMeta.label}</span>
          {managingOnBehalf && <span className="driver-job-on-behalf-badge">STAFF จัดการแทนคนขับ</span>}
          {hasPendingDriverCancelRequest && (
            <span className="driver-job-cancel-request-badge amber">
              {getDriverCancelRequestStateLabel(booking)}
            </span>
          )}
          {hasRejectedDriverCancelRequest && (
            <span className="driver-job-cancel-request-badge red">
              {getDriverCancelRequestStateLabel(booking)}
            </span>
          )}
        </div>
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
        {FEATURES.vehicleModule && (
          <div>
            <label>รถ / ป้ายทะเบียน</label>
            <b title={vehicleLabel}>{vehicleLabel}</b>
          </div>
        )}
        <div>
          <label>มอบหมายให้</label>
          <b title={assignedUserLabel}>{assignedUserLabel}</b>
        </div>
        <div>
          <label>สถานะ</label>
          <b title={getStatusLabel(status)}>{getStatusLabel(status)}</b>
        </div>
        {hasPendingDriverCancelRequest && booking.driver_cancel_request_reason && (
          <div className="driver-job-cancel-note">
            <label>เหตุผลที่ขอยกเลิก</label>
            <b title={booking.driver_cancel_request_reason}>{booking.driver_cancel_request_reason}</b>
          </div>
        )}
        {hasRejectedDriverCancelRequest && booking.driver_cancel_review_reason && (
          <div className="driver-job-cancel-note">
            <label>เหตุผลจาก STAFF</label>
            <b title={booking.driver_cancel_review_reason}>{booking.driver_cancel_review_reason}</b>
          </div>
        )}
      </div>

      <div className="driver-job-actions">
        <button type="button" className="driver-job-detail-button" disabled={disabled} onClick={() => onShowDetails(booking)}>
          ดูรายละเอียด
        </button>

        {status === "APPROVED" && onCancelJob && !hasPendingDriverCancelRequest && (
          <button type="button" className="warning-button" disabled={disabled} onClick={() => onCancelJob(booking)}>
              {processing === "cancel-request" ? "กำลังยกเลิกงาน..." : "ยกเลิกงาน"}
          </button>
        )}

        {canStart && status === "APPROVED" && !hasPendingDriverCancelRequest && (
          <button type="button" disabled={disabled} onClick={() => onStart(booking)}>
            {processing === "start" ? "กำลังรับงาน..." : "รับงาน / วิ่งงาน"}

          </button>
        )}

        {canComplete && status === "IN_USE" && !hasPendingDriverCancelRequest && (
          <button type="button" className="warning-button" disabled={disabled} onClick={() => onComplete(booking)}>
            {processing === "complete" ? "กำลังจบงาน..." : "จบงาน / คืนรถ"}
          </button>
        )}

          {hasPendingDriverCancelRequest && (
            <span className="driver-job-cancel-request-inline amber">
              {getDriverCancelRequestStateLabel(booking)}
            </span>
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
  const [pendingJobsPage, setPendingJobsPage] = useState(1);
  const [todayJobsPage, setTodayJobsPage] = useState(1);
  const [expandedJobId, setExpandedJobId] = useState("");
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

      const [bookingData, vehicleData] = await Promise.all([
        getBookings(options.freshBookings || options.refreshOnly ? { fresh: true } : {}),
        FEATURES.vehicleModule ? getVehicles() : Promise.resolve([]),
      ]);

      setBookings(Array.isArray(bookingData) ? bookingData : []);
      setVehicles(Array.isArray(vehicleData) ? vehicleData : []);
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
          return isToday(booking.start_datetime, todayKey) && status === "APPROVED" && !isPendingDriverCancel(booking);
        })
      ),
    [assignedBookings, todayKey]
  );

  const waitingJobs = useMemo(
    () =>
      sortByTodayPriority(
        assignedBookings.filter((booking) => {
          const status = normalizeStatus(booking.status);
          return status === "APPROVED" && !isPendingDriverCancel(booking);
        })
      ),
    [assignedBookings]
  );

  const filteredWaitingJobs = useMemo(
    () => waitingJobs.filter((booking) => matchesWaitingSearch(booking, debouncedWaitingSearch)),
    [debouncedWaitingSearch, waitingJobs]
  );
  const pendingJobs = filteredWaitingJobs;
  const pendingJobsTotalPages = useMemo(() => getTotalPages(pendingJobs), [pendingJobs]);
  const todayJobsTotalPages = useMemo(() => getTotalPages(todayJobs), [todayJobs]);
  const paginatedPendingJobs = useMemo(
    () => paginateItems(pendingJobs, pendingJobsPage),
    [pendingJobs, pendingJobsPage]
  );
  const paginatedTodayJobs = useMemo(
    () => paginateItems(todayJobs, todayJobsPage),
    [todayJobs, todayJobsPage]
  );
  const driverJobTableColSpan = FEATURES.vehicleModule ? 9 : 8;
  const mobileCurrentJobsTotal = currentJobs.length;
  const mobileTodayJobsTotal = todayJobs.length;
  const mobilePendingJobsTotal = pendingJobs.length;
  const mobileAllJobsTotal = currentJobs.length + pendingJobs.length;

  useEffect(() => {
    setPendingJobsPage(1);
  }, [pendingJobs]);

  useEffect(() => {
    setTodayJobsPage(1);
  }, [todayJobs]);

  useEffect(() => {
    setExpandedJobId("");
  }, [debouncedWaitingSearch, pendingJobsPage, todayJobsPage]);

  const handleStart = useCallback(async (booking) => {
    if (processingAction) return;
    const managingOnBehalf = (currentRole === "ADMIN" || currentRole === "STAFF") && isManagingOnBehalf(booking, currentUser);
    const assignedUserLabel = getAssignedUserLabel(booking);
    const result = await Swal.fire({
      title: "รับงาน / วิ่งงาน",
      html: managingOnBehalf
        ? `
          <div class="swal-confirm-copy">
            <div>คุณกำลังกดรับงานแทน:</div>
            <div class="swal-confirm-name">${assignedUserLabel}</div>
          </div>
        `
        : `
          <div class="swal-confirm-copy">
            <div>ยืนยันการรับงานและออกรถใช่หรือไม่</div>
          </div>
        `,
      showCancelButton: true,
      confirmButtonText: "ตกลง",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#1455c8",
      cancelButtonColor: "#64748b",
    });

    if (!result.isConfirmed) return;

    try {
      setProcessingAction({ bookingId: booking.booking_id, type: "start" });
      const nowIso = new Date().toISOString();
      const startBy = currentUser?.name || currentUser?.email || "";
      const assignedUserId = booking.assigned_user_id || currentUser?.user_id || "";
      const assignedUserName =
        booking.assigned_user_name || booking.driver_name || currentUser?.name || currentUser?.email || "";
      const response = await startTrip({
        booking_id: booking.booking_id,
        out_time: nowIso,
        actual_start_datetime: nowIso,
        actual_start_by: startBy,
        out_mileage: "",
        assigned_user_id: assignedUserId,
        assigned_user_name: assignedUserName,
      });

      if (response?.success === false) {
        showError(response?.message || "เริ่มงานไม่สำเร็จ");
        return;
      }

      await showSuccess("เริ่มงานและบันทึกการออกรถสำเร็จ");
      mergeBooking(booking.booking_id, {
        ...(response || {}),
        status: "IN_USE",
        assigned_user_id: assignedUserId,
        assigned_user_name: assignedUserName,
        driver_name: booking.driver_name || assignedUserName,
        actual_start_datetime: nowIso,
        actual_start_by: startBy,
        updated_at: nowIso,
      });
    } catch (err) {
      showError(err.message || "เริ่มงานไม่สำเร็จ");
    } finally {
      setProcessingAction(null);
    }
  }, [currentRole, currentUser, mergeBooking, processingAction]);

  const handleComplete = useCallback(async (booking) => {
    if (processingAction) return;
    const managingOnBehalf = (currentRole === "ADMIN" || currentRole === "STAFF") && isManagingOnBehalf(booking, currentUser);
    const assignedUserLabel = getAssignedUserLabel(booking);
    const result = await Swal.fire({
      title: "จบงาน / คืนรถ",
      html: managingOnBehalf
        ? `
          <div class="swal-confirm-copy">
            <div>คุณกำลังกดคืนรถแทน:</div>
            <div class="swal-confirm-name">${assignedUserLabel}</div>
          </div>
        `
        : `
          <div class="swal-confirm-copy">
            <div>ยืนยันการจบงานและคืนรถใช่หรือไม่</div>
          </div>
        `,
      showCancelButton: true,
      confirmButtonText: "ตกลง",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#1455c8",
      cancelButtonColor: "#64748b",
    });

    if (!result.isConfirmed) return;

    try {
      setProcessingAction({ bookingId: booking.booking_id, type: "complete" });
      const nowIso = new Date().toISOString();
      const returnBy = currentUser?.name || currentUser?.email || "";
      const assignedUserId = booking.assigned_user_id || currentUser?.user_id || "";
      const assignedUserName =
        booking.assigned_user_name || booking.driver_name || currentUser?.name || currentUser?.email || "";
      await completeTrip({
        booking_id: booking.booking_id,
        in_time: nowIso,
        actual_return_datetime: nowIso,
        actual_return_by: returnBy,
        in_mileage: "",
        remark: "",
        assigned_user_id: assignedUserId,
        assigned_user_name: assignedUserName,
      });

      await showSuccess("จบงานและบันทึกการคืนรถสำเร็จ");
      mergeBooking(booking.booking_id, {
        status: "COMPLETED",
        actual_return_datetime: nowIso,
        actual_return_by: returnBy,
        updated_at: nowIso,
      });
    } catch (err) {
      showError(err.message || "จบงานไม่สำเร็จ");
    } finally {
      setProcessingAction(null);
    }
  }, [currentRole, currentUser, mergeBooking, processingAction]);

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
      setProcessingAction({ bookingId: booking.booking_id, type: "cancel-request" });
      const response = await requestDriverCancelJob({
        booking_id: booking.booking_id,
        reason: result.value,
        requested_by: currentUser?.name || currentUser?.email || "",
      });

      if (response?.success === false) {
        showError(response?.message || "ส่งคำขอยกเลิกงานไม่สำเร็จ");
        return;
      }

      await showSuccess("ส่งคำขอยกเลิกงานแล้ว");
      mergeBooking(booking.booking_id, {
        ...(response || {}),
        booking_id: booking.booking_id,
        driver_cancel_request_status: "PENDING",
        driver_cancel_request_reason: result.value,
        driver_cancel_requested_by: currentUser?.name || currentUser?.email || "",
      });
    } catch (err) {
      showError(err.message || "ส่งคำขอยกเลิกงานไม่สำเร็จ");
    } finally {
      setProcessingAction(null);
    }
  }, [currentUser?.email, currentUser?.name, mergeBooking, processingAction]);

  const showDetails = useCallback((booking) => {
    const vehicleLabel = formatVehicleLabel(booking, vehicleMap);

    Swal.fire({
      title: "รายละเอียดงาน",
      // title: booking.booking_no || "รายละเอียดงาน",
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
          ${FEATURES.vehicleModule ? `<div><span>รถ / ป้ายทะเบียน</span><b>${compactText(vehicleLabel)}</b></div>` : ""}
          <div><span>ผู้รับผิดชอบงาน</span><b>${compactText(booking.assigned_user_name)}</b></div>
          <div><span>ผู้กดรับงานจริง</span><b>${compactText(booking.actual_start_by)}</b></div>
          <div><span>ผู้กดคืนรถจริง</span><b>${compactText(booking.actual_return_by)}</b></div>
          <div><span>สถานะ</span><b>${compactText(getStatusLabel(booking.status))}</b></div>
          <div><span>หมายเหตุเจ้าหน้าที่</span><b>${compactText(booking.staff_note)}</b></div>
        </div>
      `,
    });
  }, [vehicleMap]);

  if (!canViewPage) {
    return <div className="form-card text-slate-700">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  return (
    <AppLayout title="งานคนขับ" hideMobileHeader hideDesktopHeader hideDesktopSidebar mobileTopOffset={57}>
      {/* Desktop version */}
      <div className="driver-jobs-desktop driver-jobs-page hidden md:block">
        <div className="page-header rounded-3xl border border-sky-100 bg-white px-4 py-4 shadow-sm sm:px-5 lg:px-7">
          <div>
            <h2>งานคนขับ</h2>
            <p>ดูและจัดการงานที่ถูกมอบหมายให้คนขับ</p>
          </div>

          <button type="button" disabled={refreshing || loading} onClick={() => loadData({ refreshOnly: true })}>
            รีเฟรชข้อมูล
          </button>
        </div>

        {loading && <div className="form-card text-slate-700">กำลังโหลดงานคนขับ...</div>}
        {error && !loading && <div className="form-card text-slate-700">{error}</div>}

        {!loading && !error && (
          <>
            <div className="form-card">
              <div className="section-header gap-3 border-b border-sky-100 pb-4">
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
                      currentUser={currentUser}
                      currentRole={currentRole}
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
              <div className="driver-jobs-table-section">
                <div className="section-header gap-3 border-b border-sky-100 pb-4">
                  <h3>งานวันนี้</h3>
                  <span className="section-counter">{todayJobs.length} รายการ</span>
                </div>

                <div className="table-wrap mobile-hide-table rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table>
                    <thead>
                      <tr>
                        <th>ลำดับ</th>
                        <th>ผู้จอง</th>
                        <th>เวลาไป</th>
                        <th>เวลากลับ</th>
                        <th>ปลายทาง</th>
                        {FEATURES.vehicleModule && <th>รถ</th>}
                        <th>สถานะ</th>
                        <th>หมายเหตุ</th>
                        <th>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTodayJobs.length === 0 ? (
                        <tr>
                          <td colSpan={driverJobTableColSpan}>ไม่มีงานวันนี้</td>
                        </tr>
                      ) : (
                        paginatedTodayJobs.map((job, index) => (
                          <tr key={job.booking_id || index}>
                            <td>{(todayJobsPage - 1) * DRIVER_JOBS_PAGE_SIZE + index + 1}</td>
                            <td>{job.requester_name || "-"}</td>
                            <td>{formatThaiDateTime(job.start_datetime)}</td>
                            <td>{formatThaiDateTime(job.end_datetime)}</td>
                            <td>{job.destination || "-"}</td>
                            {FEATURES.vehicleModule && <td>{formatVehicleLabel(job, vehicleMap)}</td>}
                            <td>
                              {renderStatusBadge(job.status)}
                              {isPendingDriverCancel(job) && (
                                <div style={{ marginTop: 6 }}>
                                  <span className="status amber">รอ STAFF อนุมัติยกเลิก</span>
                                </div>
                              )}
                              {getDriverCancelRequestStatus(job) === "REJECTED" && (
                                <div style={{ marginTop: 6 }}>
                                  <span className="status red">ไม่อนุมัติการยกเลิก</span>
                                </div>
                              )}
                            </td>
                            <td>
                              {job.staff_note || job.note || "-"}
                              {isPendingDriverCancel(job) && job.driver_cancel_request_reason && (
                                <div className="driver-job-cancel-note">
                                  เหตุผลที่ขอยกเลิก: {job.driver_cancel_request_reason}
                                </div>
                              )}
                              {getDriverCancelRequestStatus(job) === "REJECTED" && job.driver_cancel_review_reason && (
                                <div className="driver-job-cancel-note">
                                  เหตุผลจาก STAFF: {job.driver_cancel_review_reason}
                                </div>
                              )}
                            </td>
                            <td className="action-buttons">
                              <DriverJobTableActions
                                booking={job}
                                processing={
                                  processingAction?.bookingId === job.booking_id
                                    ? processingAction.type
                                    : ""
                                }
                                onShowDetails={showDetails}
                                onCancelJob={handleCancelJob}
                                onStart={handleStart}
                                onComplete={handleComplete}
                                canStart={canStartTrip}
                                canComplete={canCompleteTrip}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <PaginationControls
                  page={todayJobsPage}
                  totalPages={todayJobsTotalPages}
                  onChange={setTodayJobsPage}
                />
              </div>
            </div>

            <div className="form-card">
              <div className="driver-jobs-table-section">
                <div className="section-header gap-3 border-b border-sky-100 pb-4">
                  <h3>งานที่รออยู่ทั้งหมด</h3>
                  <span className="section-counter">{pendingJobs.length} รายการ</span>
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

                <div className="table-wrap mobile-hide-table rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table>
                    <thead>
                      <tr>
                        <th>ลำดับ</th>
                        <th>ผู้จอง</th>
                        <th>เวลาไป</th>
                        <th>เวลากลับ</th>
                        <th>ปลายทาง</th>
                        {FEATURES.vehicleModule && <th>รถ</th>}
                        <th>สถานะ</th>
                        <th>หมายเหตุ</th>
                        <th>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedPendingJobs.length === 0 ? (
                        <tr>
                          <td colSpan={driverJobTableColSpan}>ไม่มีงานที่รออยู่</td>
                        </tr>
                      ) : (
                        paginatedPendingJobs.map((job, index) => (
                          <tr key={job.booking_id || index}>
                            <td>{(pendingJobsPage - 1) * DRIVER_JOBS_PAGE_SIZE + index + 1}</td>
                            <td>{job.requester_name || "-"}</td>
                            <td>{formatThaiDateTime(job.start_datetime)}</td>
                            <td>{formatThaiDateTime(job.end_datetime)}</td>
                            <td>{job.destination || "-"}</td>
                            {FEATURES.vehicleModule && <td>{formatVehicleLabel(job, vehicleMap)}</td>}
                            <td>
                              {renderStatusBadge(job.status)}
                              {isPendingDriverCancel(job) && (
                                <div style={{ marginTop: 6 }}>
                                  <span className="status amber">รอ STAFF อนุมัติยกเลิก</span>
                                </div>
                              )}
                              {getDriverCancelRequestStatus(job) === "REJECTED" && (
                                <div style={{ marginTop: 6 }}>
                                  <span className="status red">ไม่อนุมัติการยกเลิก</span>
                                </div>
                              )}
                            </td>
                            <td>
                              {job.staff_note || job.note || "-"}
                              {isPendingDriverCancel(job) && job.driver_cancel_request_reason && (
                                <div className="driver-job-cancel-note">
                                  เหตุผลที่ขอยกเลิก: {job.driver_cancel_request_reason}
                                </div>
                              )}
                              {getDriverCancelRequestStatus(job) === "REJECTED" && job.driver_cancel_review_reason && (
                                <div className="driver-job-cancel-note">
                                  เหตุผลจาก STAFF: {job.driver_cancel_review_reason}
                                </div>
                              )}
                            </td>
                            <td className="action-buttons">
                              <DriverJobTableActions
                                booking={job}
                                processing={
                                  processingAction?.bookingId === job.booking_id
                                    ? processingAction.type
                                    : ""
                                }
                                onShowDetails={showDetails}
                                onCancelJob={handleCancelJob}
                                onStart={handleStart}
                                onComplete={handleComplete}
                                canStart={canStartTrip}
                                canComplete={canCompleteTrip}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <PaginationControls
                  page={pendingJobsPage}
                  totalPages={pendingJobsTotalPages}
                  onChange={setPendingJobsPage}
                />
              </div>
            </div>

          </>
        )}
      </div>

      {/* Mobile version */}
      <div className="driver-jobs-mobile block md:hidden">
        <div className="driver-jobs-mobile-page">
          <MobilePageHeader
            title="งานคนขับ"
            subtitle="ดูและจัดการงานที่ถูกมอบหมายให้คนขับ"
            actions={
              <button
                type="button"
                className="mobile-filter-button inline-flex items-center gap-1.5 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                disabled={refreshing || loading}
                onClick={() => loadData({ refreshOnly: true })}
              >
                <RefreshIcon className="h-4 w-4" />
                <span>รีเฟรช</span>
              </button>
            }
          />

          <MobilePageSection title="ภาพรวม" subtitle="สรุปงานปัจจุบันและงานที่ต้องจัดการ">
            <MobileGrid columns={{ base: 4 }} gap="sm">
              <div className="driver-jobs-mobile-summary-card driver-jobs-mobile-summary-card--green">
                <span>กำลังใช้งาน</span>
                <b>{mobileCurrentJobsTotal}</b>
              </div>
              <div className="driver-jobs-mobile-summary-card driver-jobs-mobile-summary-card--blue">
                <span>งานวันนี้</span>
                <b>{mobileTodayJobsTotal}</b>
              </div>
              <div className="driver-jobs-mobile-summary-card driver-jobs-mobile-summary-card--amber">
                <span>รอรับงาน</span>
                <b>{mobilePendingJobsTotal}</b>
              </div>
              <div className="driver-jobs-mobile-summary-card driver-jobs-mobile-summary-card--slate">
                <span>ทั้งหมด</span>
                <b>{mobileAllJobsTotal}</b>
              </div>
            </MobileGrid>
          </MobilePageSection>

          <MobilePageSection
            title="งานกำลังใช้งาน"
            subtitle="งานที่กำลังวิ่งอยู่ตอนนี้"
            actions={
              <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                {mobileCurrentJobsTotal} งาน
              </span>
            }
          >
            {currentJobs.length === 0 ? (
              <div className="mobile-empty-state">ไม่มีงานที่กำลังใช้งาน</div>
            ) : (
              <div className="grid gap-1.5">
                {currentJobs.map((booking) => (
                  <DriverJobCompactCard
                    key={`current-mobile-${booking.booking_id}`}
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
                    expanded={expandedJobId === booking.booking_id}
                    onToggleExpand={(bookingId) =>
                      setExpandedJobId((current) => (current === bookingId ? "" : bookingId))
                    }
                  />
                ))}
              </div>
            )}
          </MobilePageSection>

          <MobilePageSection
            title="งานวันนี้"
            subtitle="รายการงานที่เริ่มในวันนี้"
            actions={
              <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                หน้า {todayJobsPage}/{todayJobsTotalPages}
              </span>
            }
          >
            {paginatedTodayJobs.length === 0 ? (
              <div className="mobile-empty-state">ไม่มีงานวันนี้</div>
            ) : (
              <div className="grid gap-1.5">
                {paginatedTodayJobs.map((booking) => (
                  <DriverJobCompactCard
                    key={`today-mobile-${booking.booking_id}`}
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
                    expanded={expandedJobId === booking.booking_id}
                    onToggleExpand={(bookingId) =>
                      setExpandedJobId((current) => (current === bookingId ? "" : bookingId))
                    }
                  />
                ))}
              </div>
            )}

            <PaginationControls
              page={todayJobsPage}
              totalPages={todayJobsTotalPages}
              onChange={setTodayJobsPage}
            />
          </MobilePageSection>

          <MobilePageSection
            title="งานที่รออยู่ทั้งหมด"
            subtitle="ค้นหาและจัดการงานที่รอรับงาน"
            actions={
              <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                หน้า {pendingJobsPage}/{pendingJobsTotalPages}
              </span>
            }
          >
            <div className="driver-job-compact-search-wrap">
              <input
                type="search"
                value={waitingSearch}
                onChange={(event) => setWaitingSearch(event.target.value)}
                placeholder="ค้นหาผู้จอง เวลา ปลายทาง หรือเหตุผล"
                aria-label="ค้นหางานที่รออยู่ทั้งหมด"
                className="driver-job-compact-search"
              />
            </div>

            {paginatedPendingJobs.length === 0 ? (
              <div className="mobile-empty-state">ไม่มีงานที่รออยู่</div>
            ) : (
              <div className="grid gap-1.5">
                {paginatedPendingJobs.map((booking) => (
                  <DriverJobCompactCard
                    key={`pending-mobile-${booking.booking_id}`}
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
                    expanded={expandedJobId === booking.booking_id}
                    onToggleExpand={(bookingId) =>
                      setExpandedJobId((current) => (current === bookingId ? "" : bookingId))
                    }
                  />
                ))}
              </div>
            )}

            <PaginationControls
              page={pendingJobsPage}
              totalPages={pendingJobsTotalPages}
              onChange={setPendingJobsPage}
            />
          </MobilePageSection>
        </div>
      </div>
    </AppLayout>
  );
}


