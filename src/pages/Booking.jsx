import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import {
  approveBooking,
  cancelBooking,
  backdateCompleteBooking,
  confirmDriverQueueAssignment,
  checkDriverUnavailable,
  getDriverUnavailable,
  getBookings,
  recommendDriverForBooking,
  getVehicles,
  getUsers,
  reviewDriverCancelRequest,
} from "../api";
import { formatThaiDateTime } from "../utils/date";
import { showError, showSuccess } from "../utils/alert";
import { hasPermission } from "../permissions";
import BookingFormModal from "../components/booking/BookingFormModal";
import ThaiDateTimeField from "../components/common/ThaiDateTimeField";
import PageSkeleton from "../components/skeletons/PageSkeleton";
import TableSkeleton from "../components/skeletons/TableSkeleton";
import useMinimumLoading from "../hooks/useMinimumLoading";
import { FEATURES } from "../config/features";

const ROWS_PER_PAGE = 5;

const STATUS_META = {
  PENDING: {
    label: "รออนุมัติ",
    className: "amber",
    help: "รายการที่ผู้จองส่งเข้ามาและรอเจ้าหน้าที่พิจารณา",
  },
  APPROVED: {
    label: "อนุมัติแล้ว",
    className: "blue",
    help: "รายการที่ได้รับอนุมัติและรอเริ่มใช้งาน",
  },
  IN_USE: {
    label: "กำลังใช้งาน",
    className: "green",
    help: "รถและคนขับกำลังปฏิบัติงานตามรายการนี้",
  },
  COMPLETED: {
    label: "เสร็จสิ้น",
    className: "gray",
    help: "รายการที่ปิดงานเรียบร้อยแล้ว",
  },
    DRIVER_CANCEL_PENDING: {
    label: "รอการอนุมัติการยกเลิก",
    className: "red",
    help: "รายการที่มีการขอยกเลิกและรอเจ้าหน้าที่พิจารณา",
  },
  // CANCELLED: {
  //   label: "ยกเลิกแล้ว",
  //   className: "red",
  //   help: "รายการที่ถูกยกเลิกและบันทึกลงประวัติการยกเลิก",
  // },
};

const BOOKING_STATUS_COUNT_ITEMS = [
  { status: "PENDING", label: "รอการอนุมัติ", className: "amber" },
  { status: "APPROVED", label: "อนุมัติแล้ว", className: "blue" },
  { status: "IN_USE", label: "กำลังใช้งาน", className: "green" },
  { status: "COMPLETED", label: "เสร็จสิ้น", className: "gray" },
  { status: "DRIVER_CANCEL_PENDING", label: "รอการอนุมัติการยกเลิก", className: "red" },
];

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function normalizeVehicleStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "MAINTENANCE" || normalized === "INACTIVE") return "UNAVAILABLE";
  if (normalized === "IN_USE") return "IN_USE";
  if (normalized === "UNAVAILABLE") return "UNAVAILABLE";
  return "AVAILABLE";
}

function getStatusMeta(status) {
  return STATUS_META[normalizeStatus(status)] || {
    label: status || "-",
    className: "gray",
    help: "สถานะรายการจอง",
  };
}

function sortLatestFirst(items) {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.created_at || a.updated_at || a.start_datetime).getTime();
    const dateB = new Date(b.created_at || b.updated_at || b.start_datetime).getTime();
    return dateB - dateA;
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

const THAI_SHORT_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

const ALL_DETAIL_ROLES = ["USER", "DRIVER", "STAFF", "ADMIN"];
const STAFF_DETAIL_ROLES = ["STAFF", "ADMIN"];
const ADMIN_DETAIL_ROLES = ["ADMIN"];

function getBookingDetailFields({ booking, vehicleMap }) {
  return [
    {
      key: "requester_name",
      label: "ผู้จอง",
      roles: ALL_DETAIL_ROLES,
      value: booking.requester_name || "-",
    },
    {
      key: "department",
      label: "หน่วยงาน / ฝ่าย",
      roles: ALL_DETAIL_ROLES,
      value: booking.department || "-",
    },
    {
      key: "phone",
      label: "เบอร์โทร",
      roles: ALL_DETAIL_ROLES,
      value: booking.phone || "-",
    },
    {
      key: "start_datetime",
      label: "เวลาไป",
      roles: ALL_DETAIL_ROLES,
      value: formatBookingDateTimeDisplay(booking.start_datetime),
    },
    {
      key: "end_datetime",
      label: "เวลากลับ",
      roles: ALL_DETAIL_ROLES,
      value: formatBookingDateTimeDisplay(booking.end_datetime),
    },
    {
      key: "actual_start_datetime",
      label: "เวลาออกรถจริง",
      roles: ALL_DETAIL_ROLES,
      value: booking.actual_start_datetime
        ? formatBookingDateTimeDisplay(booking.actual_start_datetime)
        : "-",
    },
    {
      key: "actual_return_datetime",
      label: "เวลากลับจริง",
      roles: ALL_DETAIL_ROLES,
      value: booking.actual_return_datetime
        ? formatBookingDateTimeDisplay(booking.actual_return_datetime)
        : "-",
    },
    {
      key: "destination",
      label: "ปลายทาง",
      roles: ALL_DETAIL_ROLES,
      value: booking.destination || "-",
    },
    {
      key: "purpose",
      label: "รายละเอียดการใช้รถ",
      roles: ALL_DETAIL_ROLES,
      value: booking.purpose || "-",
    },
    {
      key: "assigned_user_name",
      label: "คนขับ",
      roles: ALL_DETAIL_ROLES,
      value: getBookingDriverLabel(booking),
    },
    {
      key: "status",
      label: "สถานะ",
      roles: ALL_DETAIL_ROLES,
      value: getStatusMeta(booking.status).label,
    },
    {
      key: "staff_note",
      label: "หมายเหตุ",
      roles: ALL_DETAIL_ROLES,
      value: booking.staff_note || "-",
    },
    {
      key: "is_backdated",
      label: "รายการย้อนหลัง",
      roles: STAFF_DETAIL_ROLES,
      value: isBackdatedFlagEnabled(booking) ? "บันทึกเป็นรายการย้อนหลัง" : "ไม่ได้บันทึกเป็นรายการย้อนหลัง",
    },
    {
      key: "booking_id",
      label: "booking_id",
      roles: ADMIN_DETAIL_ROLES,
      value: booking.booking_id || "-",
    },
    {
      key: "booking_no",
      label: "booking_no",
      roles: ADMIN_DETAIL_ROLES,
      value: booking.booking_no || "-",
    },
    ...(FEATURES.vehicleModule
      ? [{
          key: "vehicle_id",
          label: "vehicle_id",
          roles: ADMIN_DETAIL_ROLES,
          value: booking.vehicle_id || "-",
        }]
      : []),
    {
      key: "assigned_user_id",
      label: "assigned_user_id",
      roles: ADMIN_DETAIL_ROLES,
      value: booking.assigned_user_id || "-",
    },
    ...(FEATURES.vehicleModule
      ? [{
          key: "vehicle_type_request",
          label: "vehicle_type_request",
          roles: ADMIN_DETAIL_ROLES,
          value: getVehicleTypeText(booking.vehicle_type_request || booking.vehicle_type || ""),
        }]
      : []),
    {
      key: "actual_start_by",
      label: "actual_start_by",
      roles: ADMIN_DETAIL_ROLES,
      value: booking.actual_start_by || "-",
    },
    {
      key: "actual_return_by",
      label: "actual_return_by",
      roles: ADMIN_DETAIL_ROLES,
      value: booking.actual_return_by || "-",
    },
    {
      key: "backdated_completed_at",
      label: "backdated_completed_at",
      roles: ADMIN_DETAIL_ROLES,
      value: booking.backdated_completed_at
        ? formatBookingDateTimeDisplay(booking.backdated_completed_at)
        : "-",
    },
    {
      key: "backdated_completed_by",
      label: "backdated_completed_by",
      roles: ADMIN_DETAIL_ROLES,
      value: booking.backdated_completed_by || "-",
    },
    {
      key: "created_at",
      label: "created_at",
      roles: ADMIN_DETAIL_ROLES,
      value: booking.created_at ? formatThaiDateTime(booking.created_at) : "-",
    },
    {
      key: "updated_at",
      label: "updated_at",
      roles: ADMIN_DETAIL_ROLES,
      value: booking.updated_at ? formatThaiDateTime(booking.updated_at) : "-",
    },
    {
      key: "updated_by",
      label: "updated_by",
      roles: ADMIN_DETAIL_ROLES,
      value: booking.updated_by || "-",
    },
    ...(FEATURES.vehicleModule
      ? [{
          key: "vehicle_label",
          label: "รถที่ได้รับ",
          roles: ADMIN_DETAIL_ROLES,
          value: getBookingVehicleLabel(booking, vehicleMap),
        }]
      : []),
    {
      key: "manual_override_reason",
      label: "manual_override_reason",
      roles: ADMIN_DETAIL_ROLES,
      value: booking.manual_override_reason || "-",
    },
    {
      key: "assign_mode",
      label: "assign_mode",
      roles: ADMIN_DETAIL_ROLES,
      value: booking.assign_mode || "-",
    },
    {
      key: "recommended_driver_user_id",
      label: "recommended_driver_user_id",
      roles: ADMIN_DETAIL_ROLES,
      value: booking.recommended_driver_user_id || "-",
    },
    {
      key: "recommended_driver_name",
      label: "recommended_driver_name",
      roles: ADMIN_DETAIL_ROLES,
      value: booking.recommended_driver_name || "-",
    },
  ];
}

function formatBookingDateTimeDisplay(value) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return `${date.getDate()} ${THAI_SHORT_MONTHS[date.getMonth()]} ${date.getFullYear() + 543} เวลา ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())} น.`;
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

function isBackdatedFlagEnabled(booking) {
  return String(booking.is_backdated || "").trim().toUpperCase() === "TRUE";
}

function isStaffOrAdmin(user) {
  const role = String(user?.role || "").trim().toUpperCase();
  return role === "STAFF" || role === "ADMIN";
}

function isTimeOverlap(startA, endA, startB, endB) {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();

  return aStart < bEnd && bStart < aEnd;
}

function groupActiveBookings(bookings) {
  const byVehicleId = new Map();
  const byAssignedUserId = new Map();
  const byAssignedUserName = new Map();
  const inUseVehicleIds = new Set();
  const overlapCandidates = [];

  bookings.forEach((booking) => {
    const status = normalizeStatus(booking.status);

    if (status === "COMPLETED" || status === "CANCELLED") {
      return;
    }

    if (status !== "IN_USE") {
      overlapCandidates.push(booking);
    }

    if (status !== "APPROVED" && status !== "IN_USE") {
      return;
    }

    const vehicleId = String(booking.vehicle_id || "").trim();
    if (vehicleId) {
      if (!byVehicleId.has(vehicleId)) byVehicleId.set(vehicleId, []);
      byVehicleId.get(vehicleId).push(booking);
      if (status === "IN_USE") inUseVehicleIds.add(vehicleId);
    }

    const assignedUserId = String(booking.assigned_user_id || "").trim();
    const assignedUserName = String(booking.assigned_user_name || booking.driver_name || "").trim();

    if (assignedUserId) {
      if (!byAssignedUserId.has(assignedUserId)) byAssignedUserId.set(assignedUserId, []);
      byAssignedUserId.get(assignedUserId).push(booking);
    } else if (assignedUserName) {
      if (!byAssignedUserName.has(assignedUserName)) byAssignedUserName.set(assignedUserName, []);
      byAssignedUserName.get(assignedUserName).push(booking);
    }
  });

  return {
    byVehicleId,
    byAssignedUserId,
    byAssignedUserName,
    inUseVehicleIds,
    overlapCandidates,
  };
}

function isVehicleAvailable(vehicle, currentBooking, bookingGroups) {
  if (normalizeVehicleStatus(vehicle.status) !== "AVAILABLE") {
    return false;
  }

  const vehicleId = String(vehicle.vehicle_id || "").trim();
  const relevantBookings = bookingGroups.byVehicleId.get(vehicleId) || [];
  const vehicleInUse = bookingGroups.inUseVehicleIds.has(vehicleId);

  if (
    vehicleInUse &&
    relevantBookings.some((booking) => String(booking.booking_id) !== String(currentBooking.booking_id))
  ) {
    return false;
  }

  return !relevantBookings.some((booking) => {
    const isSameBooking = booking.booking_id === currentBooking.booking_id;

    if (isSameBooking) {
      return false;
    }

    return isTimeOverlap(
      currentBooking.start_datetime,
      currentBooking.end_datetime,
      booking.start_datetime,
      booking.end_datetime
    );
  });
}

function isDriverAvailable(driver, currentBooking, bookingGroups) {
  const driverId = String(driver.user_id || "").trim();
  const driverName = String(driver.name || "").trim();
  const relevantBookings = [
    ...(driverId ? bookingGroups.byAssignedUserId.get(driverId) || [] : []),
    ...(driverName ? bookingGroups.byAssignedUserName.get(driverName) || [] : []),
  ];

  return !relevantBookings.some((booking) => {
    const isSameBooking = booking.booking_id === currentBooking.booking_id;

    if (isSameBooking) {
      return false;
    }

    return isTimeOverlap(
      currentBooking.start_datetime,
      currentBooking.end_datetime,
      booking.start_datetime,
      booking.end_datetime
    );
  });
}

function normalizeUnavailableType(type) {
  const raw = String(type || "").trim();
  if (!raw) return "ลา";
  if (raw.toUpperCase() === "OTHER") return "OTHER";
  return raw;
}

function getUnavailableTypeLabel(type) {
  const normalized = normalizeUnavailableType(type);
  if (normalized === "ลา") return "ลา / หยุด";
  if (normalized === "หยุด") return "ติดภารกิจ (ชั่วคราว)";
  if (normalized === "OTHER") return "อื่นๆ";
  return normalized;
}

function getUnavailableTypeClassName(type) {
  const normalized = normalizeUnavailableType(type);
  if (normalized === "ลา") return "red";
  if (normalized === "หยุด") return "amber";
  return "purple";
}

function formatUnavailableRange(startDatetime, endDatetime) {
  return `${formatThaiDateTime(startDatetime)} - ${formatThaiDateTime(endDatetime)}`;
}

function groupActiveUnavailable(unavailableRecords) {
  const byDriverId = new Map();
  const byDriverName = new Map();

  unavailableRecords.forEach((record) => {
    const status = normalizeStatus(record.status);
    const startTime = new Date(record.start_datetime).getTime();
    const endTime = new Date(record.end_datetime).getTime();

    if (status !== "ACTIVE" || Number.isNaN(startTime) || Number.isNaN(endTime)) {
      return;
    }

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

  return records.find((record) => {
    const sameBooking = String(record.booking_id || "") === String(currentBooking.booking_id || "");
    if (sameBooking) {
      return false;
    }

    return isTimeOverlap(
      currentBooking.start_datetime,
      currentBooking.end_datetime,
      record.start_datetime,
      record.end_datetime
    );
  }) || null;
}

function getQueueAssignModeLabel(mode) {
  const normalized = String(mode || "").trim().toUpperCase();
  if (normalized === "MANUAL_OVERRIDE") return "เลือกคนขับเอง";
  return "ระบบแนะนำ";
}

function isEditableBookingStatus(status) {
  return !["IN_USE", "COMPLETED", "CANCELLED"].includes(normalizeStatus(status));
}

function getOverlapBookings(bookings, currentBookingId, startDatetime, endDatetime) {
  if (!startDatetime || !endDatetime) {
    return [];
  }

  return bookings.filter((booking) => {
    if (currentBookingId && String(booking.booking_id) === String(currentBookingId)) {
      return false;
    }

    if (!booking.start_datetime || !booking.end_datetime) {
      return false;
    }

    return isTimeOverlap(startDatetime, endDatetime, booking.start_datetime, booking.end_datetime);
  });
}

function getBookingVehicleLabel(booking, vehicleMap) {
  const vehicleId = String(booking.vehicle_id || "").trim();
  if (!vehicleId) return "-";

  const vehicle = vehicleMap.get(vehicleId);

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

function getBookingDriverLabel(booking) {
  return booking.assigned_user_name || booking.driver_name || "-";
}

function getDriverCancelRequestStatus(booking) {
  return normalizeStatus(booking.driver_cancel_request_status);
}

function getBookingId(booking) {
  return String(
    booking?.booking_id ||
      booking?.id ||
      booking?.bookingId ||
      ""
  ).trim();
}

function paginate(items, page) {
  const start = (page - 1) * ROWS_PER_PAGE;
  return items.slice(start, start + ROWS_PER_PAGE);
}

function totalPages(items) {
  return Math.max(1, Math.ceil(items.length / ROWS_PER_PAGE));
}

function useDebouncedValue(value, delay = 250) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function Pagination({ page, total, onChange }) {
  return (
    <div className="pagination">
      {Array.from({ length: total }).map((_, index) => (
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

const BookingTableRow = memo(function BookingTableRow({
  booking,
  rowNumber,
  vehicleMap,
  showVehicleColumn,
  canViewBookingDetail,
  canProcessBookings,
  canBackdateComplete,
  canCancelBookings,
  canEditBookings,
  canReviewDriverCancelRequests,
  processing,
  onViewDetail,
  onProcess,
  onBackdateComplete,
  onEdit,
  onCancel,
  onApproveDriverCancel,
  onRejectDriverCancel,
}) {
  const status = normalizeStatus(booking.status);
  const statusMeta = getStatusMeta(status);
  const driverCancelRequestStatus = getDriverCancelRequestStatus(booking);
  const hasPendingDriverCancelRequest = driverCancelRequestStatus === "PENDING";
  const hasRejectedDriverCancelRequest = driverCancelRequestStatus === "REJECTED";
  const rowBookingId = getBookingId(booking);
  const disabled = Boolean(processing);
  const canShowDetail = canViewBookingDetail;
  const canShowBackdateComplete =
    canBackdateComplete &&
    isBackdatedFlagEnabled(booking) &&
    !["COMPLETED", "CANCELLED"].includes(status);
  const canShowProcess = canProcessBookings && ["PENDING", "APPROVED"].includes(status) && !hasPendingDriverCancelRequest;
  const canShowEdit = canEditBookings && isEditableBookingStatus(status) && !hasPendingDriverCancelRequest;
  const canShowCancel =
    canCancelBookings && !["COMPLETED", "CANCELLED", "IN_USE"].includes(status) && !hasPendingDriverCancelRequest;

  return (
    <tr>
      <td>{rowNumber}</td>
      <td>{booking.requester_name || "-"}</td>
      <td>{formatBookingDateTimeDisplay(booking.start_datetime)}</td>
      <td>{formatBookingDateTimeDisplay(booking.end_datetime)}</td>
      <td>{booking.destination || "-"}</td>
      {showVehicleColumn && <td>{getBookingVehicleLabel(booking, vehicleMap)}</td>}
      <td>{getBookingDriverLabel(booking)}</td>
      <td>
        <span className={`status ${statusMeta.className}`} title={statusMeta.help}>
          {statusMeta.label}
        </span>
        {hasPendingDriverCancelRequest && (
          <div style={{ marginTop: 6 }}>
            <span className="status amber">รออนุมัติยกเลิก</span>
          </div>
        )}
        {hasRejectedDriverCancelRequest && (
          <div style={{ marginTop: 6 }}>
            <span className="status red">ไม่อนุมัติการยกเลิก</span>
          </div>
        )}
      </td>
      <td style={{ maxWidth: 240, whiteSpace: "normal", wordBreak: "break-word", fontSize: 25}}>
        {booking.staff_note || "-"}
        {hasPendingDriverCancelRequest && booking.driver_cancel_request_reason && (
          <div className="booking-driver-cancel-note">
            เหตุผลที่ขอยกเลิก: {booking.driver_cancel_request_reason}
          </div>
        )}
        {hasRejectedDriverCancelRequest && booking.driver_cancel_review_reason && (
          <div className="booking-driver-cancel-note">
            เหตุผลจาก STAFF: {booking.driver_cancel_review_reason}
          </div>
        )}
      </td>
      <td className="action-buttons">
        {canShowDetail && (
          <button type="button" className="booking-action-button" disabled={disabled} onClick={() => onViewDetail(booking)}>
            ดูรายละเอียด
          </button>
        )}
        {canShowBackdateComplete ? (
          <button
            type="button"
            className="warning-button booking-action-button"
            disabled={disabled}
            onClick={() => onBackdateComplete(booking)}
          >
            {processing === "backdate" ? "กำลังบันทึก..." : "บันทึกงานย้อนหลัง"}
          </button>
        ) : (
          <>
            {canShowProcess && (
              <button type="button" disabled={disabled} onClick={() => onProcess(booking)}>
                {processing === "process"
                  ? "Processing..."
                  : status === "APPROVED"
                    ? FEATURES.vehicleModule
                      ? "เปลี่ยนคนขับ/รถ"
                      : "เปลี่ยนคนขับ"
                    : "อนุมัติ"}
              </button>
            )}
            {canShowEdit && (
              <button
                type="button"
                className="warning-button booking-action-button"
                disabled={disabled}
                onClick={() => onEdit(booking)}
              >
                {processing === "edit" ? "Saving..." : "แก้ไข"}
              </button>
            )}
            {canShowCancel && (
              <button
                type="button"
                className="danger-button"
                disabled={disabled}
                onClick={() => onCancel(booking)}
              >
                {processing === "cancel" ? "Cancelling..." : status === "PENDING" ? "ยกเลิก" : "ลบ"}
              </button>
            )}
            {canReviewDriverCancelRequests && hasPendingDriverCancelRequest && (
              <>
                <button
                  type="button"
                  className="booking-action-button"
                  disabled={disabled}
                  onClick={() => onApproveDriverCancel(booking)}
                >
                  อนุมัติยกเลิกงานคนขับ
                </button>
                <button
                  type="button"
                  className="danger-button"
                  disabled={disabled}
                  onClick={() => onRejectDriverCancel(booking)}
                >
                  ไม่อนุมัติ
                </button>
              </>
            )}
          </>
        )}
      </td>
    </tr>
  );
});

export default function Booking() {
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [driverUnavailableRecords, setDriverUnavailableRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [processingAction, setProcessingAction] = useState(null);
  const [filters, setFilters] = useState({
    requester: "",
    start_datetime: "",
    end_datetime: "",
    destination: "",
    status: "",
    driver: "",
    vehicle_id: "",
  });
  const debouncedFilters = useDebouncedValue(filters);
  const visibleLoading = useMinimumLoading(loading, 350);

  const canCreateBookings = hasPermission(null, "bookings_create");
  const canViewBookings = hasPermission(null, "bookings_view");
  const canViewBookingDetail = hasPermission(null, "bookings_detail");
  const canProcessBookings = hasPermission(null, "bookings_approve");
  const canCancelBookings = hasPermission(null, "bookings_cancel");
  const canEditBookings = hasPermission(null, "bookings_edit");
  const currentUser = getCurrentUser();
  const canReviewDriverCancelRequests = isStaffOrAdmin(currentUser);
  const canBackdateComplete = isStaffOrAdmin(currentUser) && canProcessBookings;

  const mergeBooking = useCallback((nextBooking) => {
    if (!nextBooking?.booking_id) return;

    setBookings((current) => {
      const index = current.findIndex(
        (booking) => String(booking.booking_id) === String(nextBooking.booking_id)
      );

      if (index === -1) {
        return [nextBooking, ...current];
      }

      const next = [...current];
      next[index] = {
        ...next[index],
        ...nextBooking,
      };
      return next;
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [bookingData, vehicleData, driverData, unavailableData] = await Promise.all([
        getBookings(),
        FEATURES.vehicleModule ? getVehicles() : Promise.resolve([]),
        getUsers(),
        getDriverUnavailable(),
      ]);

      setBookings(Array.isArray(bookingData) ? bookingData : []);
      setVehicles(Array.isArray(vehicleData) ? vehicleData : []);
      setDrivers(
        Array.isArray(driverData)
          ? driverData.filter((user) => normalizeStatus(user.role) === "DRIVER")
          : []
      );
      setDriverUnavailableRecords(
        Array.isArray(unavailableData)
          ? unavailableData.filter((record) => normalizeStatus(record.status) === "ACTIVE")
          : []
      );
    } catch (err) {
      const message = err.message || "โหลดข้อมูลไม่สำเร็จ";
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshBookings = useCallback(async () => {
    try {
      setRefreshing(true);
      const [bookingData, unavailableData] = await Promise.all([
        getBookings({ fresh: true }),
        getDriverUnavailable({ fresh: true }),
      ]);
      setBookings(Array.isArray(bookingData) ? bookingData : []);
      setDriverUnavailableRecords(
        Array.isArray(unavailableData)
          ? unavailableData.filter((record) => normalizeStatus(record.status) === "ACTIVE")
          : []
      );
    } catch (err) {
      const message = err.message || "โหลดข้อมูลไม่สำเร็จ";
      setError(message);
      showError(message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [debouncedFilters]);

  const vehicleTypes = useMemo(
    () => [...new Set(vehicles.map((vehicle) => vehicle.vehicle_type).filter(Boolean))],
    [vehicles]
  );

  const vehicleMap = useMemo(() => {
    const map = new Map();
    vehicles.forEach((vehicle) => {
      map.set(String(vehicle.vehicle_id || "").trim(), vehicle);
    });
    return map;
  }, [vehicles]);

  const bookingGroups = useMemo(() => groupActiveBookings(bookings), [bookings]);

  const activeDrivers = useMemo(
    () => drivers.filter((driver) => normalizeStatus(driver.status) === "ACTIVE"),
    [drivers]
  );

  const driverById = useMemo(() => {
    const map = new Map();

    activeDrivers.forEach((driver) => {
      const id = String(driver.user_id || "").trim();
      if (!id) return;

      map.set(id, driver);
    });

    return map;
  }, [activeDrivers]);

  const resolveDriverName = useCallback(
    (driverUserId, fallbackName = "") => {
      const id = String(driverUserId || "").trim();
      const matched = id ? driverById.get(id) : null;

      return (
        matched?.name ||
        matched?.full_name ||
        matched?.display_name ||
        fallbackName ||
        "-"
      );
    },
    [driverById]
  );

  const driverUnavailableGroups = useMemo(
    () => groupActiveUnavailable(driverUnavailableRecords),
    [driverUnavailableRecords]
  );

  const sortedBookings = useMemo(() => sortLatestFirst(bookings), [bookings]);

  const filteredBookings = useMemo(() => {
    const requester = debouncedFilters.requester.trim().toLowerCase();
    const destination = debouncedFilters.destination.trim().toLowerCase();
    const status = normalizeStatus(debouncedFilters.status);
    const driverFilter = String(debouncedFilters.driver || "").trim();
    const vehicleIdFilter = FEATURES.vehicleModule
      ? String(debouncedFilters.vehicle_id || "").trim()
      : "";
    const startFilter = debouncedFilters.start_datetime ? new Date(debouncedFilters.start_datetime).getTime() : null;
    const endFilter = debouncedFilters.end_datetime ? new Date(debouncedFilters.end_datetime).getTime() : null;
    const selectedDriverName = driverFilter
      ? activeDrivers.find((driver) => String(driver.user_id || "").trim() === driverFilter)?.name || ""
      : "";

    return sortedBookings.filter((booking) => {
      const bookingStatus = normalizeStatus(booking.status);

        if (bookingStatus === "CANCELLED") {
          return false;
        }
      const bookingRequester = String(booking.requester_name || "").toLowerCase();
      const bookingDestination = String(booking.destination || "").toLowerCase();
      const bookingStart = new Date(booking.start_datetime).getTime();
      const bookingEnd = new Date(booking.end_datetime).getTime();
      const bookingVehicleId = String(booking.vehicle_id || "").trim();
      const bookingAssignedUserId = String(booking.assigned_user_id || "").trim();
      const bookingAssignedUserName = String(booking.assigned_user_name || booking.driver_name || "").trim();

      if (requester && !bookingRequester.includes(requester)) return false;
      if (destination && !bookingDestination.includes(destination)) return false;
      if (status) {
        if (status === "DRIVER_CANCEL_PENDING") {
          if (getDriverCancelRequestStatus(booking) !== "PENDING") {
            return false;
          }
        } else if (bookingStatus !== status) {
          return false;
        }
      }
      if (startFilter && bookingStart < startFilter) return false;
      if (endFilter && bookingEnd > endFilter) return false;
      if (vehicleIdFilter && bookingVehicleId !== vehicleIdFilter) return false;
      if (driverFilter) {
        if (bookingAssignedUserId) {
          if (bookingAssignedUserId !== driverFilter) return false;
        } else if (!selectedDriverName || bookingAssignedUserName !== selectedDriverName) {
          return false;
        }
      }

  
      return true;
    });
  }, [activeDrivers, debouncedFilters, sortedBookings]);

  const bookingStatusCounts = useMemo(() => {
    const counts = {
      PENDING: 0,
      APPROVED: 0,
      IN_USE: 0,
      COMPLETED: 0,
      DRIVER_CANCEL_PENDING: 0,
    };

    filteredBookings.forEach((booking) => {
      const status = normalizeStatus(booking.status);
      if (Object.prototype.hasOwnProperty.call(counts, status)) {
        counts[status] += 1;
      }

      if (getDriverCancelRequestStatus(booking) === "PENDING") {
        counts.DRIVER_CANCEL_PENDING += 1;
      }
    });

    return counts;
  }, [filteredBookings]);

  const bookingPages = useMemo(() => totalPages(filteredBookings), [filteredBookings]);
  const pageItems = useMemo(() => paginate(filteredBookings, page), [filteredBookings, page]);

  useEffect(() => {
    if (page > bookingPages) {
      setPage(bookingPages);
    }
  }, [page, bookingPages]);

  const bookingFormModalRef = useRef(null);

  const handleCreateBooking = useCallback(async () => {
    if (processingAction) return;
    setProcessingAction({ bookingId: "new", type: "create" });
    await bookingFormModalRef.current?.openCreate();
    setProcessingAction(null);
  }, [processingAction]);

  const handleExportBookingExcel = useCallback(() => {
    const rows = filteredBookings.map((booking, index) => {
      const statusMeta = getStatusMeta(booking.status);
      const baseRow = {
        ลำดับ: index + 1,
        ผู้จอง: booking.requester_name || "-",
        "หน่วยงาน / ฝ่าย": booking.department || "-",
        เบอร์โทร: booking.phone || "-",
        เวลาไป: formatBookingDateTimeDisplay(booking.start_datetime),
        เวลากลับ: formatBookingDateTimeDisplay(booking.end_datetime),
        "เวลาออกรถจริง": booking.actual_start_datetime
          ? formatBookingDateTimeDisplay(booking.actual_start_datetime)
          : "-",
        "เวลากลับจริง": booking.actual_return_datetime
          ? formatBookingDateTimeDisplay(booking.actual_return_datetime)
          : "-",
        ปลายทาง: booking.destination || "-",
        "รายละเอียดการใช้รถ": booking.purpose || "-",
        คนขับ: getBookingDriverLabel(booking),
        สถานะ: statusMeta.label,
        หมายเหตุ: booking.staff_note || "-",
      };

      if (FEATURES.vehicleModule) {
        return {
          ...baseRow,
          "รถที่ขอ": getVehicleTypeText(booking.vehicle_type_request || booking.vehicle_type || ""),
          "รถที่ได้รับ": getBookingVehicleLabel(booking, vehicleMap),
        };
      }

      return baseRow;
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    XLSX.utils.book_append_sheet(workbook, worksheet, "รายการจอง");

    XLSX.writeFile(workbook, `booking-list-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [filteredBookings, vehicleMap]);

  const handleProcessBooking = useCallback(async (booking) => {
    if (processingAction) return;

    let driverQueueRecommendation = null;
    let driverQueueRecommendationError = "";

    try {
      const recommendation = await recommendDriverForBooking({
        booking_id: booking.booking_id,
        start_datetime: booking.start_datetime,
        end_datetime: booking.end_datetime,
      });
      driverQueueRecommendation = recommendation?.data || null;
      if (!recommendation?.success) {
        driverQueueRecommendationError = recommendation?.message || "ไม่พบคำแนะนำจากคิวคนขับ";
      }
    } catch (err) {
      driverQueueRecommendationError = err.message || "ไม่พบคำแนะนำจากคิวคนขับ";
    }

    const recommendedDriverId = driverQueueRecommendation?.recommended_driver_user_id || "";
    const currentQueueDriverId = driverQueueRecommendation?.current_queue_driver_user_id || "";
    const recommendedDriverName = resolveDriverName(
      recommendedDriverId,
      driverQueueRecommendation?.recommended_driver_name || ""
    );
    const currentQueueDriverName = resolveDriverName(
      currentQueueDriverId,
      driverQueueRecommendation?.current_queue_driver_name || ""
    );
    const recommendedReason = driverQueueRecommendation?.reason || "คิวถัดไป / พร้อมรับงาน";
    const skippedDrivers = Array.isArray(driverQueueRecommendation?.skipped)
      ? driverQueueRecommendation.skipped
      : [];
    const queueRecommendedDisplayName =
      resolveDriverName(recommendedDriverId, driverQueueRecommendation?.recommended_driver_name || "") ||
      currentQueueDriverName ||
      "ยังไม่มีคำแนะนำ";
    const queueNoteLines = [
      recommendedReason,
      driverQueueRecommendationError,
      skippedDrivers.length > 0 ? `ข้ามไป ${skippedDrivers.length} รายการ` : "",
    ].filter(Boolean);
    const nextQueueDriverId =
      driverQueueRecommendation?.next_queue_driver_user_id ||
      driverQueueRecommendation?.queue_after_driver_user_id ||
      driverQueueRecommendation?.next_driver_user_id ||
      "";
    const nextQueueDriverName = resolveDriverName(
      nextQueueDriverId,
      driverQueueRecommendation?.next_queue_driver_name ||
        driverQueueRecommendation?.queue_after_driver_name ||
        driverQueueRecommendation?.next_driver_name ||
        ""
    );

    const result = await Swal.fire({
      title: "ดำเนินการจอง",
      html: `
        <div class="swal-form">
          <div class="booking-queue-recommendation-card">
            <div class="booking-queue-row">
              <span>คนขับที่ระบบแนะนำ:</span>
              <b>${escapeHtml(queueRecommendedDisplayName)}</b>
            </div>

            <div class="booking-queue-row">
              <span>หมายเหตุ:</span>
              <b>${escapeHtml(queueNoteLines.join(" / ") || "-")}</b>
            </div>

            <div class="booking-queue-row">
              <span>คิวถัดไปหลังมอบหมาย:</span>
              <b>${escapeHtml(nextQueueDriverName || "ระบบจะคำนวณหลังบันทึก")}</b>
            </div>
          </div>

          ${
            FEATURES.vehicleModule
              ? `
          <label>เลือกรถ</label>
          <select id="vehicle_id" class="swal2-select">
            <option value="">-- เลือกรถ --</option>
            ${vehicles
              .map((vehicle) => {
                const available = isVehicleAvailable(vehicle, booking, bookingGroups);
                const vehicleStatus = normalizeVehicleStatus(vehicle.status);
                const unavailableByStatus = vehicleStatus === "UNAVAILABLE";
                const label = `${vehicle.vehicle_name || vehicle.vehicle_code || vehicle.vehicle_id} - ${
                  vehicle.license_plate || vehicle.plate_no || "-"
                }`;
                const availabilityLabel = unavailableByStatus
                      ? " ⚠️ ไม่พร้อมใช้งาน"
                      : available
                        ? " ✅ ว่าง"
                        : " ❌ ไม่ว่าง";
                return `<option value="${escapeHtml(vehicle.vehicle_id)}" ${
                  available ? "" : "disabled"
                }>${escapeHtml(label)}${availabilityLabel}</option>`;
              })
              .join("")}
          </select>
          `
              : ""
          }

          <label>เลือกผู้ใช้</label>
          <select id="assigned_user_id" class="swal2-select">
            <option value="">-- เลือกผู้ใช้ --</option>
            ${activeDrivers
              .map((driver) => {
                const scheduleAvailable = isDriverAvailable(driver, booking, bookingGroups);
                const unavailableConflict = getDriverUnavailableConflict(
                  driver,
                  booking,
                  driverUnavailableGroups
                );
                const available = scheduleAvailable && !unavailableConflict;
                const conflictLabel = unavailableConflict
                  ? `${getUnavailableTypeLabel(unavailableConflict.type)} ${formatUnavailableRange(
                      unavailableConflict.start_datetime,
                      unavailableConflict.end_datetime
                    )}`
                  : "";
                const selected = String(driver.user_id || "") === String(recommendedDriverId || "");
                return `<option value="${escapeHtml(driver.user_id)}" ${
                  available ? "" : "disabled"
                } ${selected ? "selected" : ""}>${escapeHtml(driver.name)}${driver.phone ? ` (${escapeHtml(driver.phone)})` : ""}${
                  available
                    ? " ✅ ว่าง"
                    : unavailableConflict
                      ? ` ❌ ${escapeHtml(conflictLabel)}`
                      : " ❌ ไม่ว่าง"
                }</option>`;
              })
              .join("")}
          </select>

          <label>เหตุผลที่เลือกคนขับเอง</label>
          <textarea
            id="manual_override_reason"
            class="swal2-textarea"
            rows="3"
            placeholder="ระบุเมื่อเลือกคนขับไม่ตรงกับที่ระบบแนะนำ"
          ></textarea>

          ${
            skippedDrivers.length > 0
              ? `
          <div style="margin-top:12px;padding:12px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;">
            <div style="font-weight:800;margin-bottom:8px;">ข้ามเพราะไม่ว่าง/ติดภารกิจ</div>
            <div style="display:grid;gap:6px;text-align:left;">
              ${skippedDrivers
                .map(
                  (item) =>
                    `<div style="color:#475569;">${escapeHtml(
                      resolveDriverName(item.driver_user_id || item.user_id || item.driver_id, item.driver_name || "")
                    )} - ${escapeHtml(item.reason || "-")}</div>`
                )
                .join("")}
            </div>
          </div>
          `
              : ""
          }

          <label>หมายเหตุ</label>
          <input id="staff_note" class="swal2-input" placeholder="-">
        </div>
      `,
      width: 760,
      showCancelButton: true,
      confirmButtonText: "อนุมัติรายการ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#1455c8",
      cancelButtonColor: "#64748b",
      preConfirm: () => {
        const vehicle_id = FEATURES.vehicleModule
          ? document.getElementById("vehicle_id")?.value || ""
          : "";
        const assigned_user_id = document.getElementById("assigned_user_id").value;
        const manual_override_reason = document.getElementById("manual_override_reason").value.trim();
        const staff_note = document.getElementById("staff_note").value.trim();

        if (!assigned_user_id) {
          Swal.showValidationMessage(
            FEATURES.vehicleModule ? "กรุณาเลือกรถและผู้ใช้" : "กรุณาเลือกผู้ใช้"
          );
          return false;
        }

        const vehicle = FEATURES.vehicleModule
          ? vehicles.find((item) => item.vehicle_id === vehicle_id)
          : null;
        const driver = activeDrivers.find(
          (item) => String(item.user_id || "").trim() === String(assigned_user_id || "").trim()
        );

        if (FEATURES.vehicleModule && (!vehicle || !isVehicleAvailable(vehicle, booking, bookingGroups))) {
          Swal.showValidationMessage("รถคันนี้ไม่ว่างหรือไม่พร้อมใช้งาน");
          return false;
        }

        const unavailableConflict = getDriverUnavailableConflict(
          driver || {},
          booking,
          driverUnavailableGroups
        );

        if (!driver || !isDriverAvailable(driver, booking, bookingGroups)) {
          Swal.showValidationMessage("คนขับท่านนี้ไม่ว่าง");
          return false;
        }

        if (unavailableConflict) {
          Swal.showValidationMessage(
            `คนขับมีช่วงวันไม่รับงาน: ${getUnavailableTypeLabel(unavailableConflict.type)} ${formatUnavailableRange(
              unavailableConflict.start_datetime,
              unavailableConflict.end_datetime
            )}`
          );
          return false;
        }

        const hasRecommendation = Boolean(recommendedDriverId);
        const isManualOverride =
          hasRecommendation && String(assigned_user_id || "") !== String(recommendedDriverId || "");
        if (isManualOverride && !manual_override_reason) {
          Swal.showValidationMessage("กรุณาระบุเหตุผลที่เลือกคนขับเอง");
          return false;
        }

        return {
          booking_id: booking.booking_id,
          booking_no: booking.booking_no || "",
          vehicle_id: FEATURES.vehicleModule ? vehicle_id : "",
          assigned_user_id,
          assigned_user_name: resolveDriverName(assigned_user_id, driver?.name || ""),
          staff_note,
          current_user_name: currentUser?.name || currentUser?.email || "",
          recommended_driver_user_id: recommendedDriverId,
          recommended_driver_name: resolveDriverName(
            result.value.recommended_driver_user_id,
            result.value.recommended_driver_name || ""
          ),
          skipped_drivers_json: JSON.stringify(skippedDrivers),
          assign_mode: hasRecommendation
            ? isManualOverride
              ? "MANUAL_OVERRIDE"
              : "AUTO_RECOMMENDED"
            : "MANUAL_OVERRIDE",
          manual_override_reason,
        };
      },
    });

    if (!result.isConfirmed) return;

    try {
      setProcessingAction({ bookingId: booking.booking_id, type: "process" });
      const driverUnavailableCheck = await checkDriverUnavailable({
        driver_user_id: result.value.assigned_user_id,
        start_datetime: booking.start_datetime,
        end_datetime: booking.end_datetime,
      });

      if (driverUnavailableCheck && driverUnavailableCheck.available === false) {
        throw new Error(
          `คนขับมีช่วงวันไม่รับงาน: ${getUnavailableTypeLabel(driverUnavailableCheck.unavailable?.type)} ${formatUnavailableRange(
            driverUnavailableCheck.unavailable?.start_datetime,
            driverUnavailableCheck.unavailable?.end_datetime
          )}`
        );
      }

      const approved = await approveBooking(result.value);
      mergeBooking({ ...result.value, ...(approved || {}), status: "APPROVED" });

      try {
        await confirmDriverQueueAssignment({
          booking_id: booking.booking_id,
          booking_no: booking.booking_no || "",
          recommended_driver_user_id: result.value.recommended_driver_user_id || "",
          recommended_driver_name: resolveDriverName(
            result.value.recommended_driver_user_id,
            result.value.recommended_driver_name || ""
          ),
          assigned_driver_user_id: result.value.assigned_user_id || "",
          assigned_driver_name: resolveDriverName(
            result.value.assigned_user_id,
            result.value.assigned_user_name || ""
          ),
          assign_mode: result.value.assign_mode || "AUTO_RECOMMENDED",
          reason:
            result.value.assign_mode === "MANUAL_OVERRIDE"
              ? result.value.manual_override_reason || result.value.staff_note || ""
              : recommendedReason,
          created_by: currentUser?.name || currentUser?.email || "",
          assigned_by_name: currentUser?.name || currentUser?.email || "",
        });
      } catch (queueErr) {
        console.warn("confirmDriverQueueAssignment failed", queueErr);
      }

      await showSuccess("อนุมัติรายการสำเร็จ");
    } catch (err) {
      showError(err.message || "อนุมัติรายการไม่สำเร็จ");
    } finally {
      setProcessingAction(null);
    }
  }, [activeDrivers, bookingGroups, currentUser?.email, currentUser?.name, driverUnavailableGroups, drivers, mergeBooking, processingAction, vehicles]);

  const handleEditBooking = useCallback(async (booking) => {
    if (processingAction) return;
    setProcessingAction({ bookingId: booking.booking_id, type: "edit" });
    await bookingFormModalRef.current?.openEdit(booking);
    setProcessingAction(null);
  }, [processingAction]);

  const handleBackdateComplete = useCallback(
    async (booking) => {
      if (processingAction) return;
      let backdateActualStart = "";
      let backdateActualReturn = "";
      let actualStartRoot = null;
      let actualReturnRoot = null;

      const result = await Swal.fire({
        title: "บันทึกงานย้อนหลัง",
        html: `
          <div class="swal-form">
            <label>คนขับ</label>
            <select id="backdate_assigned_user_id" class="swal2-select">
              <option value="">-- เลือกคนขับ --</option>
              ${activeDrivers
                .map((driver) => `<option value="${escapeHtml(driver.user_id)}">${escapeHtml(driver.name || "-")}</option>`)
                .join("")}
            </select>

            ${
              FEATURES.vehicleModule
                ? `
            <label>รถ</label>
            <select id="backdate_vehicle_id" class="swal2-select">
              <option value="">-- เลือกรถ --</option>
              ${vehicles
                .map((vehicle) => {
                  const label = `${vehicle.vehicle_name || vehicle.vehicle_code || vehicle.vehicle_id} - ${
                    vehicle.license_plate || vehicle.plate_no || "-"
                  }`;
                  return `<option value="${escapeHtml(vehicle.vehicle_id)}">${escapeHtml(label)}</option>`;
                })
                .join("")}
              </select>
              `
                : ""
            }

            <div id="backdate_actual_start_container"></div>
            <div id="backdate_actual_return_container"></div>

            <label>หมายเหตุ</label>
            <textarea id="backdate_note" class="swal2-textarea" rows="4">บันทึกรายการย้อนหลัง</textarea>
          </div>
        `,
        width: 760,
        showCancelButton: true,
        confirmButtonText: "บันทึก",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#f59e0b",
        cancelButtonColor: "#64748b",
        didOpen: () => {
          const startEl = document.getElementById("backdate_actual_start_container");
          const returnEl = document.getElementById("backdate_actual_return_container");

          if (startEl) {
            actualStartRoot = createRoot(startEl);
            actualStartRoot.render(
              <ThaiDateTimeField
                label="เวลาออกรถจริง"
                value={backdateActualStart}
                onChange={(value) => {
                  backdateActualStart = value || "";
                }}
              />
            );
          }

          if (returnEl) {
            actualReturnRoot = createRoot(returnEl);
            actualReturnRoot.render(
              <ThaiDateTimeField
                label="เวลากลับจริง"
                value={backdateActualReturn}
                onChange={(value) => {
                  backdateActualReturn = value || "";
                }}
              />
            );
          }
        },
        willClose: () => {
          actualStartRoot?.unmount?.();
          actualReturnRoot?.unmount?.();
          actualStartRoot = null;
          actualReturnRoot = null;
        },
        preConfirm: () => {
          const assigned_user_id = document.getElementById("backdate_assigned_user_id").value.trim();
          const vehicle_id = FEATURES.vehicleModule
            ? document.getElementById("backdate_vehicle_id")?.value.trim() || ""
            : "";
          const note = document.getElementById("backdate_note").value.trim();
          const actual_start_datetime = backdateActualStart || "";
          const actual_return_datetime = backdateActualReturn || "";

          if (!assigned_user_id) {
            Swal.showValidationMessage("กรุณาเลือกคนขับ");
            return false;
          }

          const driver = activeDrivers.find((item) => String(item.user_id || "").trim() === assigned_user_id);
          const vehicle = FEATURES.vehicleModule
            ? vehicles.find((item) => String(item.vehicle_id || "").trim() === vehicle_id)
            : null;

          if (!driver) {
            Swal.showValidationMessage("ไม่พบข้อมูลคนขับ");
            return false;
          }

          if (FEATURES.vehicleModule && !vehicle) {
            Swal.showValidationMessage("ไม่พบข้อมูลรถ");
            return false;
          }

          if (actual_start_datetime && actual_return_datetime) {
            const startTime = new Date(actual_start_datetime).getTime();
            const returnTime = new Date(actual_return_datetime).getTime();

            if (!Number.isNaN(startTime) && !Number.isNaN(returnTime) && returnTime < startTime) {
              Swal.showValidationMessage("เวลากลับจริงต้องไม่น้อยกว่าเวลาออกรถจริง");
              return false;
            }
          }

          return {
            assigned_user_id,
            assigned_user_name: driver.name || "",
            vehicle_id: FEATURES.vehicleModule ? vehicle_id : "",
            note,
            actual_start_datetime,
            actual_return_datetime,
          };
        },
      });

      if (!result.isConfirmed) return;

      try {
        const bookingId = getBookingId(booking);

        if (!bookingId) {
          showError("ไม่พบรหัสรายการจอง กรุณารีเฟรชข้อมูลแล้วลองใหม่");
          return;
        }

        setProcessingAction({ bookingId, type: "backdate" });
        const nowIso = new Date().toISOString();
        const actor = currentUser?.name || currentUser?.email || "";
        const payload = {
          booking_id: bookingId,
          booking_no: booking.booking_no || "",
          assigned_user_id: result.value.assigned_user_id,
          assigned_user_name: result.value.assigned_user_name,
          vehicle_id: result.value.vehicle_id,
          actual_start_datetime: result.value.actual_start_datetime || "",
          actual_return_datetime: result.value.actual_return_datetime || "",
          actual_start_by: actor,
          actual_return_by: actor,
          status: "COMPLETED",
          staff_note: result.value.note ? `บันทึกรายการย้อนหลัง: ${result.value.note}` : "โปรดระบุหมายเหตุเพิ่มเติม",
          is_backdated: "TRUE",
          backdated_completed_at: nowIso,
          backdated_completed_by: actor,
          updated_by: actor,
        };

        console.log("backdate payload", payload);
        const response = await backdateCompleteBooking(payload);
        if (response?.success === false) {
          showError(response?.message || "บันทึกงานย้อนหลังไม่สำเร็จ");
          return;
        }

        mergeBooking({
          ...(response || {}),
          ...payload,
          booking_id: bookingId,
          status: "COMPLETED",
          updated_at: nowIso,
        });

        await showSuccess("บันทึกงานย้อนหลังสำเร็จ");
      } catch (err) {
        showError(err.message || "บันทึกงานย้อนหลังไม่สำเร็จ");
      } finally {
        setProcessingAction(null);
      }
    },
    [activeDrivers, backdateCompleteBooking, currentUser?.email, currentUser?.name, mergeBooking, processingAction, vehicles]
  );

  const handleViewBookingDetail = useCallback(
    async (booking) => {
      if (processingAction) return;
      const currentRole = String(currentUser?.role || "").trim().toUpperCase() || "USER";
      const detailFields = getBookingDetailFields({ booking, vehicleMap }).filter((field) =>
        field.roles.includes(currentRole)
      );
      const detailRows = detailFields
        .map(
          (field) => `
    <div>
      <span class="booking-detail-label">${escapeHtml(field.label)}</span>
      <span class="booking-detail-value">${escapeHtml(field.value)}</span>
    </div>
  `
        )
        .join("");

      const detailHtml = `
        <div class="swal-form booking-detail-modal">
          <div class="booking-detail-grid">
            ${detailRows}
          </div>
        </div>
      `;
        // <div><span class="booking-detail-label">เลขที่รายการ</span><span class="booking-detail-value">${escapeHtml(booking.booking_no || booking.booking_id || "-")}</span></div>
        // <div><span class="booking-detail-label">created_at</span><span class="booking-detail-value">${escapeHtml(formatThaiDateTime(booking.created_at) || "-")}</span></div>
        // <div><span class="booking-detail-label">updated_at</span><span class="booking-detail-value">${escapeHtml(formatThaiDateTime(booking.updated_at) || "-")}</span></div>
      await Swal.fire({
        title: "รายละเอียดรายการจอง",
        html: detailHtml,
        width: 820,
        confirmButtonText: "ปิด",
        confirmButtonColor: "#1455c8",
      });
    },
    [currentUser?.role, vehicleMap]
  );

  const handleCancelBooking = useCallback(async (booking) => {
    if (processingAction) return;
    const result = await Swal.fire({
      title: normalizeStatus(booking.status) === "PENDING" ? "Cancel Booking" : "Delete Booking",
      html: `
        <div class="swal-form">
          <label>เหตุผลการยกเลิก</label>
          <textarea id="cancel_reason" class="swal2-textarea" rows="5" placeholder="ระบุเหตุผลให้ชัดเจน"></textarea>
        </div>
      `,
      width: 720,
      showCancelButton: true,
      confirmButtonText: "ยืนยัน",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      preConfirm: () => {
        const reason = document.getElementById("cancel_reason").value.trim();

        if (!reason) {
          Swal.showValidationMessage("กรุณาระบุเหตุผลการยกเลิก");
          return false;
        }

        return reason;
      },
    });

    if (!result.isConfirmed) return;

    try {
      setProcessingAction({ bookingId: booking.booking_id, type: "cancel" });
      const cancelled = await cancelBooking({
        booking_id: booking.booking_id,
        reason: result.value,
        cancelled_by: currentUser?.name || currentUser?.email || "",
      });
      mergeBooking({
        ...(cancelled || {}),
        booking_id: booking.booking_id,
        status: "CANCELLED",
        staff_note: result.value,
      });

      await showSuccess("ยกเลิกรายการสำเร็จ");
    } catch (err) {
      showError(err.message || "ยกเลิกรายการไม่สำเร็จ");
    } finally {
      setProcessingAction(null);
    }
  }, [currentUser?.email, currentUser?.name, mergeBooking, processingAction]);

  const handleReviewDriverCancelRequest = useCallback(async (booking, decision) => {
    if (processingAction) return;

    const requestReason = String(booking.driver_cancel_request_reason || "").trim();
    const requestLabel = String(booking.booking_no || booking.booking_id || "-").trim();

    const result = await Swal.fire({
      title: decision === "APPROVE" ? "อนุมัติยกเลิกงานคนขับ" : "ไม่อนุมัติการยกเลิก",
      html: `
        <div class="swal-form">
          <div style="text-align:left; line-height:1.7">
            <div><b>รายการ:</b> ${escapeHtml(requestLabel)}</div>
            <div><b>เหตุผลจากคนขับ:</b> ${escapeHtml(requestReason || "-")}</div>
          </div>
          ${
            decision === "REJECT"
              ? `
            <label>เหตุผลที่ไม่อนุมัติ</label>
            <textarea id="driver_cancel_review_reason" class="swal2-textarea" rows="5" placeholder="ระบุเหตุผลให้ชัดเจน"></textarea>
          `
              : ""
          }
        </div>
      `,
      width: 760,
      showCancelButton: true,
      confirmButtonText: decision === "APPROVE" ? "อนุมัติ" : "ไม่อนุมัติ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: decision === "APPROVE" ? "#1455c8" : "#dc2626",
      cancelButtonColor: "#64748b",
      preConfirm: () => {
        if (decision !== "REJECT") return true;
        const reviewReason = document.getElementById("driver_cancel_review_reason").value.trim();

        if (!reviewReason) {
          Swal.showValidationMessage("กรุณาระบุเหตุผลที่ไม่อนุมัติ");
          return false;
        }

        return reviewReason;
      },
    });

    if (!result.isConfirmed) return;

    try {
      setProcessingAction({ bookingId: booking.booking_id, type: decision === "APPROVE" ? "driver-cancel-approve" : "driver-cancel-reject" });
      const payload = {
        booking_id: booking.booking_id,
        decision,
        reviewed_by: currentUser?.name || currentUser?.email || "",
      };

      if (decision === "REJECT") {
        payload.review_reason = result.value;
      }

      const response = await reviewDriverCancelRequest(payload);

      if (response?.success === false) {
        showError(response?.message || "ดำเนินการไม่สำเร็จ");
        return;
      }

      mergeBooking(response || {});
      await showSuccess(decision === "APPROVE" ? "อนุมัติยกเลิกงานคนขับสำเร็จ" : "ไม่อนุมัติการยกเลิกสำเร็จ");
    } catch (err) {
      showError(err.message || "ดำเนินการไม่สำเร็จ");
    } finally {
      setProcessingAction(null);
    }
  }, [currentUser?.email, currentUser?.name, mergeBooking, processingAction]);

  const handleApproveDriverCancel = useCallback(
    (booking) => handleReviewDriverCancelRequest(booking, "APPROVE"),
    [handleReviewDriverCancelRequest]
  );

  const handleRejectDriverCancel = useCallback(
    (booking) => handleReviewDriverCancelRequest(booking, "REJECT"),
    [handleReviewDriverCancelRequest]
  );

  const setFilter = useCallback((field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      requester: "",
      start_datetime: "",
      end_datetime: "",
      destination: "",
      status: "",
      driver: "",
      vehicle_id: "",
    });
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>รายการจองรถ</h2>
          <p>จองรถและติดตามรายการจอง</p>
        </div>
        {canViewBookings && (
          <button type="button" disabled={refreshing || loading} onClick={refreshBookings}>
            {refreshing ? "กำลังรีเฟรชข้อมูล..." : "รีเฟรชข้อมูล"}
          </button>
        )}
      </div>

      <BookingFormModal
        ref={bookingFormModalRef}
        overlapCandidates={bookingGroups.overlapCandidates}
        vehicleTypes={vehicleTypes}
        onSuccess={(savedBooking) => mergeBooking(savedBooking)}
        currentUser={currentUser}
      />

      {visibleLoading && <PageSkeleton />}

      {error && !visibleLoading && <div className="form-card">{error}</div>}

      {canViewBookings && (
        <div className="form-card">
            <div className="section-header">
              <h3>ค้นหารายการจองรถ</h3>

              <button
                type="button"
                className="warning-button booking-filter-clear-button"
                disabled={refreshing}
                onClick={clearFilters}
              >
                ล้างตัวกรอง
              </button>
            </div>
          <div className="booking-filter-row-3" style={{ marginTop: 16 }}>
            <div>
              <label>ผู้จอง</label>
              <input
                value={filters.requester}
                onChange={(e) => setFilter("requester", e.target.value)}
                placeholder="ค้นหาจากชื่อผู้จอง"
              />
            </div>

            <div>
              <label>คนขับ</label>
              <select value={filters.driver} onChange={(e) => setFilter("driver", e.target.value)}>
                <option value="">ทั้งหมด</option>
                {activeDrivers.map((driver) => (
                  <option key={driver.user_id} value={driver.user_id}>
                    {driver.name || "-"}
                  </option>
                ))}
              </select>
            </div>

            {FEATURES.vehicleModule && (
              <div>
                <label>ทะเบียนรถ</label>
                <select
                  value={filters.vehicle_id}
                  onChange={(e) => setFilter("vehicle_id", e.target.value)}
                >
                  <option value="">ทั้งหมด</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                      {vehicle.vehicle_code
                        ? `${vehicle.vehicle_code}${vehicle.plate_no || vehicle.license_plate ? ` / ${vehicle.plate_no || vehicle.license_plate}` : ""}`
                        : vehicle.vehicle_id || "-"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label>สถานะ</label>
              <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
                <option value="">ทั้งหมด</option>
                {Object.entries(STATUS_META).map(([status, meta]) => (
                  <option key={status} value={status}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="booking-filter-row-3" style={{ marginTop: 16 }}>
            <div>
              <ThaiDateTimeField
                id="filter_start_datetime"
                label="เวลาไป"
                value={filters.start_datetime}
                placeholder="เลือกเวลาไป"
                onChange={(value) => setFilter("start_datetime", value || "")}
              />
            </div>

            <div>
              <ThaiDateTimeField
                id="filter_end_datetime"
                label="เวลากลับ"
                value={filters.end_datetime}
                placeholder="เลือกเวลากลับ"
                onChange={(value) => setFilter("end_datetime", value || "")}
              />
            </div>

            <div>
              <label>ปลายทาง</label>
              <input
                value={filters.destination}
                onChange={(e) => setFilter("destination", e.target.value)}
                placeholder="ค้นหาปลายทาง"
              />
            </div>
          </div>

          <div className="booking-table-toolbar">
            <div className="booking-status-counts">
              {BOOKING_STATUS_COUNT_ITEMS.map((item) => (
                <span
                  key={item.status}
                  className={`booking-status-count ${item.className}`}
                >
                  +{bookingStatusCounts[item.status] || 0} {item.label}
                </span>
              ))}

            </div>

            <div className="booking-create-wrapper">
              <button
                type="button"
                className="success-button"
                disabled={filteredBookings.length === 0}
                onClick={handleExportBookingExcel}
              >
                Export Excel
              </button>
              {canCreateBookings && (
                <button
                  type="button"
                  disabled={Boolean(processingAction)}
                  onClick={handleCreateBooking}
                >
                  ➕ เพิ่มรายการจองใหม่
                </button>
              )}
            </div>
          </div>
          {visibleLoading ? (
            <TableSkeleton rows={5} columns={10} />
          ) : (
            <>

              <div className="table-wrap" style={{ marginTop: 24 }}>
                <table>
                  
                  <thead>
                    <tr>
                      <th>ลำดับ</th>
                      <th>ผู้จอง</th>
                      <th>เวลาไป</th>
                      <th>เวลากลับ</th>
                      <th>ปลายทาง</th>
                      {FEATURES.vehicleModule && <th>รถ</th>}
                      <th>คนขับ</th>
                      <th>สถานะ</th>
                      <th>หมายเหตุ</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.length === 0 ? (
                      <tr>
                        <td colSpan={FEATURES.vehicleModule ? "10" : "9"}>ไม่พบรายการจอง</td>
                      </tr>
                    ) : (
                      pageItems.map((booking, rowIndex) => (
                        <BookingTableRow
                          key={getBookingId(booking) || booking.booking_no}
                          booking={booking}
                          rowNumber={(page - 1) * ROWS_PER_PAGE + rowIndex + 1}
                          vehicleMap={vehicleMap}
                          showVehicleColumn={FEATURES.vehicleModule}
                          canViewBookingDetail={canViewBookingDetail}
                          canProcessBookings={canProcessBookings}
                          canBackdateComplete={canBackdateComplete}
                          canCancelBookings={canCancelBookings}
                          canEditBookings={canEditBookings}
                          canReviewDriverCancelRequests={canReviewDriverCancelRequests}
                          processing={
                            processingAction?.bookingId === getBookingId(booking)
                              ? processingAction.type
                              : ""
                          }
                          onViewDetail={handleViewBookingDetail}
                          onProcess={handleProcessBooking}
                          onBackdateComplete={handleBackdateComplete}
                          onEdit={handleEditBooking}
                          onCancel={handleCancelBooking}
                          onApproveDriverCancel={handleApproveDriverCancel}
                          onRejectDriverCancel={handleRejectDriverCancel}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination page={page} total={bookingPages} onChange={setPage} />
            </>
          )}
        </div>
      )}
    </div>
  );
}


