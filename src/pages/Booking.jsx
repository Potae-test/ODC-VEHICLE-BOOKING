import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import {
  approveBooking,
  assignCentralVehicle,
  cancelBooking,
  backdateCompleteBooking,
  confirmDriverQueueAssignment,
  getDriverUnavailable,
  getBookings,
  recommendDriverForBooking,
  unassignBookingDriver,
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
const CENTRAL_OFFICE_DRIVER_ID = "U007";
const CENTRAL_OFFICE_DRIVER_NAME = "พขร.สนง.กลาง";

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
  { status: "ALL", label: "ทั้งหมด", className: "slate" },
  { status: "PENDING", label: "รออนุมัติ", className: "amber" },
  { status: "APPROVED", label: "อนุมัติแล้ว", className: "blue" },
  { status: "IN_USE", label: "กำลังใช้งาน", className: "green" },
  { status: "COMPLETED", label: "เสร็จสิ้น", className: "gray" },
  { status: "DRIVER_CANCEL_PENDING", label: "รอการอนุมัติการยกเลิกงาน", className: "red" },
];

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function isClosedBookingStatus(status) {
  const normalized = normalizeStatus(status);
  return normalized === "COMPLETED" || normalized === "CANCELLED";
}

function normalizeVehicleStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "MAINTENANCE" || normalized === "INACTIVE") return "UNAVAILABLE";
  if (normalized === "IN_USE") return "IN_USE";
  if (normalized === "UNAVAILABLE") return "UNAVAILABLE";
  return "AVAILABLE";
}

function isCompletedBooking(booking) {
  return normalizeStatus(booking?.status) === "COMPLETED";
}

function getStatusMeta(status) {
  return STATUS_META[normalizeStatus(status)] || {
    label: status || "-",
    className: "gray",
    help: "สถานะรายการจอง",
  };
}

function isPendingDriverCancel(booking) {
  return normalizeStatus(booking?.driver_cancel_request_status) === "PENDING";
}

function getBookingDisplayStatusMeta(booking) {
  if (isPendingDriverCancel(booking)) {
    return {
      label: "รออนุมัติยกเลิก",
      className: "amber",
      help: "คนขับส่งคำขอยกเลิกงานและรอเจ้าหน้าที่พิจารณา",
    };
  }

  return getStatusMeta(booking?.status);
}

function sortLatestFirst(items) {
  return [...items].sort((a, b) => {
    const dateA = new Date(
      a.created_at ||
        a.booking_created_at ||
        a.updated_at ||
        a.start_datetime ||
        0
    ).getTime();

    const dateB = new Date(
      b.created_at ||
        b.booking_created_at ||
        b.updated_at ||
        b.start_datetime ||
        0
    ).getTime();

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

function normalizeBookingNote(note) {
  return String(note || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => String(line || "").trim().replace(/[ \t]+/g, " "))
    .map((line) =>
      line
        .replace(/\[ใช้รถ สนง\.กลาง\]\s*\[ใช้รถ สนง\.กลาง\]/g, "[ใช้รถ สนง.กลาง]")
        .replace(/\[ใช้รถ สนง\.กลาง\]\s*ใช้รถ สนง\.กลาง/g, "[ใช้รถ สนง.กลาง]")
        .replace(/(?:ใช้รถ สนง\.กลาง)(?:\s+ใช้รถ สนง\.กลาง)+/g, "ใช้รถ สนง.กลาง")
        .replace(/(?:บันทึกรายการย้อนหลัง)(?:\s*[:：-]?\s*บันทึกรายการย้อนหลัง)+/g, "บันทึกรายการย้อนหลัง")
        .replace(/(?:ไม่อนุมัติการยกเลิก)(?:\s*[:：-]?\s*ไม่อนุมัติการยกเลิก)+/g, "ไม่อนุมัติการยกเลิก")
        .replace(/(?:อนุมัติการยกเลิกงานคนขับ)(?:\s*[:：-]?\s*อนุมัติการยกเลิกงานคนขับ)+/g, "อนุมัติการยกเลิกงานคนขับ")
        .replace(/(?:รอการอนุมัติการยกเลิก)(?:\s*[:：-]?\s*รอการอนุมัติการยกเลิก)+/g, "รอการอนุมัติการยกเลิก")
    )
    .filter(Boolean)
    .filter((line, index, lines) => {
      const canonical = line.replace(/\[ใช้รถ สนง\.กลาง\]/g, "ใช้รถ สนง.กลาง").replace(/\s+/g, " ").trim();
      return lines.findIndex(
        (item) =>
          item.replace(/\[ใช้รถ สนง\.กลาง\]/g, "ใช้รถ สนง.กลาง").replace(/\s+/g, " ").trim() === canonical
      ) === index;
    })
    .join("\n")
    .trim();
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

const BOOKING_ACTION_BUTTON_BASE_CLASSNAME = "booking-action-button";

const BOOKING_ACTION_BUTTON_VARIANTS = {
  detail: "info-button",
  process: "success-button",
  central: "success-button-2",
  backdate: "warning-button",
  edit: "edit-button",
  unassign: "cyan-button",
  cancel: "danger-button",
  approveCancel: "success-button",
  rejectCancel: "danger-dark-button",
};

function getBookingActionButtonClassName(variant) {
  return `${BOOKING_ACTION_BUTTON_BASE_CLASSNAME} ${
    BOOKING_ACTION_BUTTON_VARIANTS[variant] || BOOKING_ACTION_BUTTON_VARIANTS.process
  }`;
}

function BookingSvgIcon({ children, className = "" }) {
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
      className={className || "booking-action-icon"}
    >
      {children}
    </svg>
  );
}

function EyeIcon({ className }) {
  return (
    <BookingSvgIcon className={className}>
      <path d="M2.25 12s3.75-7.5 9.75-7.5S21.75 12 21.75 12 18 19.5 12 19.5 2.25 12 2.25 12Z" />
      <circle cx="12" cy="12" r="3" />
    </BookingSvgIcon>
  );
}

function ChevronDownIcon({ className }) {
  return (
    <BookingSvgIcon className={className}>
      <path d="m6 9 6 6 6-6" />
    </BookingSvgIcon>
  );
}

function CalendarIcon({ className }) {
  return (
    <BookingSvgIcon className={className}>
      <rect x="3" y="4.5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 9h18" />
    </BookingSvgIcon>
  );
}

function CheckCircleIcon({ className }) {
  return (
    <BookingSvgIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.25 2.4 2.4L15.8 9.75" />
    </BookingSvgIcon>
  );
}

function PencilIcon({ className }) {
  return (
    <BookingSvgIcon className={className}>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0 0-3L16.5 4.5a2.1 2.1 0 0 0-3 0L3 15v5Z" />
      <path d="m13.5 6.5 4 4" />
    </BookingSvgIcon>
  );
}

function UsersIcon({ className }) {
  return (
    <BookingSvgIcon className={className}>
      <path d="M17 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-1A4.5 4.5 0 0 0 7 18.5V20" />
      <circle cx="12" cy="8" r="3" />
      <path d="M20 20v-1.2A3.8 3.8 0 0 0 16.2 15" />
      <path d="M17.5 6.6a2.6 2.6 0 1 1 0 5.2" />
    </BookingSvgIcon>
  );
}

function HomeIcon({ className }) {
  return (
    <BookingSvgIcon className={className}>
      <path d="M3.5 11.5 12 4l8.5 7.5" />
      <path d="M6.5 10.75V20h11V10.75" />
      <path d="M10 20v-6h4v6" />
    </BookingSvgIcon>
  );
}

function XCircleIcon({ className }) {
  return (
    <BookingSvgIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </BookingSvgIcon>
  );
}

function FileExportIcon({ className }) {
  return (
    <BookingSvgIcon className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M12 11v6" />
      <path d="m9.5 14.5 2.5 2.5 2.5-2.5" />
    </BookingSvgIcon>
  );
}

function PlusIcon({ className }) {
  return (
    <BookingSvgIcon className={className}>
      <path d="M12 5v14M5 12h14" />
    </BookingSvgIcon>
  );
}

function FilterIcon({ className }) {
  return (
    <BookingSvgIcon className={className}>
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </BookingSvgIcon>
  );
}

function MapPinIcon({ className }) {
  return (
    <BookingSvgIcon className={className}>
      <path d="M12 21s6-5.6 6-11a6 6 0 1 0-12 0c0 5.4 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2.25" />
    </BookingSvgIcon>
  );
}

function UserRoundIcon({ className }) {
  return (
    <BookingSvgIcon className={className}>
      <circle cx="12" cy="8.5" r="3.25" />
      <path d="M6.5 19c1.6-3.1 4-4.5 5.5-4.5s3.9 1.4 5.5 4.5" />
    </BookingSvgIcon>
  );
}

function ClockIcon({ className }) {
  return (
    <BookingSvgIcon className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.8v4.6l3.1 1.9" />
    </BookingSvgIcon>
  );
}

function NoteIcon({ className }) {
  return (
    <BookingSvgIcon className={className}>
      <path d="M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v12L15 21H6A1.5 1.5 0 0 1 4.5 19.5V6A1.5 1.5 0 0 1 6 4.5Z" />
      <path d="M14.5 21v-4h4" />
      <path d="M8 9.5h8M8 13h5" />
    </BookingSvgIcon>
  );
}

function UndoIcon({ className }) {
  return (
    <BookingSvgIcon className={className}>
      <path d="M7 7H3v4" />
      <path d="M3 11c2-3.5 5.5-5.5 9.2-5.5C17.2 5.5 21 9.2 21 14s-3.8 8.5-8.8 8.5c-2.8 0-5.3-1-7.2-2.9" />
    </BookingSvgIcon>
  );
}

function getBookingDetailFields({ booking, vehicleMap }) {
  const statusLabel = isCompletedBooking(booking)
    ? STATUS_META.COMPLETED.label
    : getBookingDisplayStatusMeta(booking).label;

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
      value: statusLabel,
    },
    {
      key: "staff_note",
      label: "หมายเหตุ",
      roles: ALL_DETAIL_ROLES,
      value: normalizeBookingNote(booking.staff_note) || "-",
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

function getBookingDetailGroupName(field) {
  const key = String(field?.key || "").trim();
  if (["requester_name", "department", "phone"].includes(key)) return "ข้อมูลผู้จอง";
  if (["start_datetime", "end_datetime", "actual_start_datetime", "actual_return_datetime"].includes(key)) {
    return "ข้อมูลการเดินทาง";
  }
  if (["destination", "purpose"].includes(key)) return "ข้อมูลการใช้งานรถ";
  if (["assigned_user_name", "status", "staff_note"].includes(key)) return "การมอบหมายงาน";
  if (["is_backdated", "booking_id", "booking_no", "created_at", "updated_at"].includes(key)) {
    return "ข้อมูลระบบ / ผู้ดูแลระบบ";
  }
  return "ข้อมูลเพิ่มเติม";
}

function normalizeDriverChangeValue(value) {
  return String(value || "").trim();
}

function parseStructuredDriverChangeEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;

  const oldDriver = normalizeDriverChangeValue(
    entry.previous_driver_name ||
      entry.previous_assigned_user_name ||
      entry.old_driver_name ||
      entry.old_assigned_user_name ||
      entry.driver_change_from ||
      entry.from_driver_name ||
      entry.old_driver ||
      entry.previous_driver
  );

  const newDriver = normalizeDriverChangeValue(
    entry.driver_change_to ||
      entry.new_driver_name ||
      entry.new_assigned_user_name ||
      entry.to_driver_name ||
      entry.assigned_user_name ||
      entry.driver_name ||
      entry.new_driver
  );

  if (!oldDriver || !newDriver || oldDriver === newDriver) return null;

  return [
    { label: "คนขับเดิม:", value: oldDriver },
    { label: "เปลี่ยนเป็น:", value: newDriver },
  ];
}

function parsePossibleDriverChangeCollection(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "object") {
    return [value];
  }

  const text = String(value || "").trim();
  if (!text) return [];

  if ((text.startsWith("[") && text.endsWith("]")) || (text.startsWith("{") && text.endsWith("}"))) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") return [parsed];
    } catch {
      return [];
    }
  }

  return [];
}

function parseDriverChangeRowsFromStaffNote(note) {
  const noteText = normalizeBookingNote(note);
  if (!noteText) return [];

  const oldMatch = noteText.match(/คนขับเดิม\s*[:：]\s*(.+)/);
  const newMatch = noteText.match(/เปลี่ยนเป็น\s*[:：]\s*(.+)/);

  if (!oldMatch || !newMatch) return [];

  const oldDriver = normalizeDriverChangeValue(oldMatch[1]);
  const newDriver = normalizeDriverChangeValue(newMatch[1]);

  if (!oldDriver || !newDriver || oldDriver === newDriver) return [];

  return [
    { label: "คนขับเดิม:", value: oldDriver },
    { label: "เปลี่ยนเป็น:", value: newDriver },
  ];
}

function getDriverChangeHistoryRows(booking) {
  const directRows = parseStructuredDriverChangeEntry({
    previous_driver_name: booking?.previous_driver_name,
    previous_assigned_user_name: booking?.previous_assigned_user_name,
    old_driver_name: booking?.old_driver_name,
    old_assigned_user_name: booking?.old_assigned_user_name,
    driver_change_from: booking?.driver_change_from,
    driver_change_to: booking?.driver_change_to,
    assigned_user_name: booking?.assigned_user_name,
    driver_name: booking?.driver_name,
  });

  if (directRows) {
    return directRows;
  }

  const structuredHistorySources = [
    booking?.timeline,
    booking?.activity_logs,
    booking?.booking_logs,
    booking?.audit_logs,
    booking?.history,
    booking?.assignment_history,
    booking?.driver_change_history,
    booking?.driver_change_logs,
  ];

  for (const source of structuredHistorySources) {
    const entries = parsePossibleDriverChangeCollection(source);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const rows = parseStructuredDriverChangeEntry(entries[index]);
      if (rows) {
        return rows;
      }
    }
  }

  return parseDriverChangeRowsFromStaffNote(booking?.staff_note);
}

const BOOKING_TIMELINE_META = {
  "สร้างรายการ": { dot: "#1455c8", surface: "#eff6ff" },
  "อนุมัติรายการ": { dot: "#15803d", surface: "#ecfdf5" },
  "เปลี่ยนคนขับ": { dot: "#7c3aed", surface: "#f5f3ff" },
  "เปลี่ยนรถ": { dot: "#0f766e", surface: "#ecfeff" },
  "ดึงงานกลับ": { dot: "#b45309", surface: "#fffbeb" },
  "ใช้รถ สนง.กลาง": { dot: "#1d4ed8", surface: "#dbeafe" },
  "คนขับขอยกเลิกงาน": { dot: "#dc2626", surface: "#fef2f2" },
  "อนุมัติยกเลิกงาน": { dot: "#b91c1c", surface: "#fef2f2" },
  "ไม่อนุมัติยกเลิกงาน": { dot: "#c2410c", surface: "#fff7ed" },
  "บันทึกงานย้อนหลัง": { dot: "#475569", surface: "#f8fafc" },
  "แก้ไขรายการ": { dot: "#0369a1", surface: "#f0f9ff" },
  "ยกเลิกรายการ": { dot: "#991b1b", surface: "#fef2f2" },
};

function getBookingTimelineMeta(eventType) {
  return BOOKING_TIMELINE_META[String(eventType || "").trim()] || {
    dot: "#475569",
    surface: "#f8fafc",
  };
}

function buildBookingTimelineFallbackDetail(entry) {
  const eventType = String(entry?.event_type || entry?.event_title || "").trim();
  const oldDriver = normalizeDriverChangeValue(
    entry?.old_driver_name || entry?.previous_driver_name || entry?.previous_assigned_user_name
  );
  const newDriver = normalizeDriverChangeValue(
    entry?.new_driver_name || entry?.assigned_user_name || entry?.driver_name
  );
  const oldVehicle = normalizeDriverChangeValue(entry?.old_vehicle_id);
  const newVehicle = normalizeDriverChangeValue(entry?.new_vehicle_id);

  if (eventType === "เปลี่ยนคนขับ" && oldDriver && newDriver) {
    return `${oldDriver} → ${newDriver}`;
  }

  if (eventType === "เปลี่ยนรถ" && oldVehicle && newVehicle) {
    return `${oldVehicle} → ${newVehicle}`;
  }

  return "";
}

function normalizeBookingTimelineEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;

  const eventTitle = String(entry.event_title || entry.title || entry.event_type || entry.type || "").trim();
  if (!eventTitle) return null;

  const detail = String(entry.detail || entry.description || buildBookingTimelineFallbackDetail(entry) || "").trim();
  const actorName = String(
    entry.actor_name || entry.actor || entry.created_by || entry.updated_by || entry.cancelled_by || ""
  ).trim();
  const createdAt = entry.created_at || entry.timestamp || entry.createdAt || "";

  return {
    log_id: String(entry.log_id || entry.id || "").trim(),
    event_type: String(entry.event_type || entry.type || eventTitle).trim(),
    event_title: eventTitle,
    detail,
    actor_name: actorName,
    created_at: createdAt,
    old_driver_name: normalizeDriverChangeValue(entry.old_driver_name),
    new_driver_name: normalizeDriverChangeValue(entry.new_driver_name),
    old_vehicle_id: normalizeDriverChangeValue(entry.old_vehicle_id),
    new_vehicle_id: normalizeDriverChangeValue(entry.new_vehicle_id),
  };
}

function getBookingTimelineEntries(booking) {
  const timelineSource =
    booking?.timeline ||
    booking?.activity_logs ||
    booking?.booking_logs ||
    booking?.audit_logs ||
    booking?.history ||
    [];

  const entries = parsePossibleDriverChangeCollection(timelineSource);
  const normalizedEntries = entries
    .map((entry) => normalizeBookingTimelineEntry(entry))
    .filter(Boolean);
  const dedupedEntries = [];
  const seenKeys = new Set();

  normalizedEntries.forEach((entry) => {
    const dedupeKey = entry.log_id || `${entry.event_type}__${entry.created_at}`;
    if (!dedupeKey || seenKeys.has(dedupeKey)) return;
    seenKeys.add(dedupeKey);
    dedupedEntries.push(entry);
  });

  return dedupedEntries.sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return dateB - dateA;
  });
}

const ALWAYS_EXPANDED_BOOKING_DETAIL_GROUPS = new Set([
  "ข้อมูลผู้จอง",
  "ข้อมูลการเดินทาง",
  "ข้อมูลการใช้งานรถ",
  "การมอบหมายงาน",
]);

function getBookingDetailDefaultExpanded(groupName, isMobile) {
  if (ALWAYS_EXPANDED_BOOKING_DETAIL_GROUPS.has(groupName)) {
    return true;
  }

  if (groupName === "ประวัติการเปลี่ยนคนขับ" || groupName === "ประวัติการดำเนินงาน") {
    return !isMobile;
  }

  if (groupName === "ข้อมูลระบบ / ผู้ดูแลระบบ" || groupName === "ข้อมูลเพิ่มเติม") {
    return false;
  }

  return true;
}

function BookingDetailSectionHeader({ title, collapsible, expanded, onToggle }) {
  if (!collapsible) {
    return (
      <h3 className="booking-detail-group-title text-[20px] md:text-base font-semibold leading-tight">
        {title}
      </h3>
    );
  }

  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className="booking-detail-group-title flex w-full items-center justify-between gap-3 rounded-xl !bg-transparent !px-0 !py-0 text-left !text-slate-900 shadow-none transition-colors hover:!bg-slate-50 focus-visible:!bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 !min-h-0"
    >
      <span className="text-[20px] md:text-base font-semibold leading-tight text-[#073b8e]">
        {title}
      </span>
      <ChevronDownIcon
        className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${
          expanded ? "rotate-180" : "rotate-0"
        }`}
      />
    </button>
  );
}

function BookingDetailFieldRows({ rows }) {
  return rows.map((field) => (
    <div key={`${field.label}-${field.value}`} className="booking-detail-row">
      <span className="booking-detail-label">{field.label}</span>
      <span className="booking-detail-value">{field.value}</span>
    </div>
  ));
}

function BookingDetailDriverChangeRows({ rows }) {
  if (rows.length === 0) {
    return (
      <div className="booking-detail-row" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <span className="booking-detail-value">ไม่มีประวัติการเปลี่ยนคนขับ</span>
      </div>
    );
  }

  return <BookingDetailFieldRows rows={rows} />;
}

function BookingDetailTimelineRows({ entries }) {
  if (entries.length === 0) {
    return (
      <div className="booking-detail-row" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <span className="booking-detail-value">ยังไม่มีประวัติการดำเนินงาน</span>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {entries.map((entry) => {
        const meta = getBookingTimelineMeta(entry.event_type || entry.event_title);
        const dateText = formatBookingDateTimeDisplay(entry.created_at);
        const actorText = entry.actor_name ? `ดำเนินการโดย: ${entry.actor_name}` : "";

        return (
          <div
            key={entry.log_id || `${entry.event_title}-${entry.created_at}-${entry.detail}`}
            style={{
              display: "grid",
              gridTemplateColumns: "16px minmax(0, 1fr)",
              gap: 10,
              alignItems: "start",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center" }}>
              <span
                style={{
                  display: "block",
                  width: 12,
                  height: 12,
                  marginTop: 6,
                  borderRadius: 999,
                  background: meta.dot,
                  boxShadow: `0 0 0 4px ${meta.surface}`,
                }}
              />
            </div>
            <div
              style={{
                display: "grid",
                gap: 4,
                border: "1px solid #dbe6f3",
                borderRadius: 12,
                background: meta.surface,
                padding: "10px 12px",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", lineHeight: 1.25 }}>
                {entry.event_title}
              </div>
              {entry.detail ? (
                <div style={{ fontSize: 15, fontWeight: 700, color: "#334155", lineHeight: 1.45 }}>
                  {entry.detail}
                </div>
              ) : null}
              {actorText ? (
                <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.35 }}>{actorText}</div>
              ) : null}
              <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.35 }}>{dateText}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BookingDetailCollapsibleSection({ title, defaultExpanded, children }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className="booking-detail-group">
      <BookingDetailSectionHeader
        title={title}
        collapsible
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
      />
      {expanded ? children : null}
    </section>
  );
}

function BookingDetailModalContent({ sections, isMobile }) {
  return (
    <div className="swal-form booking-detail-modal">
      <div className="booking-detail-group-list">
        {sections.map((section) => {
          const body = (() => {
            if (section.type === "driver-change") {
              return <BookingDetailDriverChangeRows rows={section.items} />;
            }

            if (section.type === "timeline") {
              return <BookingDetailTimelineRows entries={section.items} />;
            }

            return <BookingDetailFieldRows rows={section.items} />;
          })();

          const collapsible = !ALWAYS_EXPANDED_BOOKING_DETAIL_GROUPS.has(section.name);
          if (collapsible) {
            return (
              <BookingDetailCollapsibleSection
                key={section.name}
                title={section.name}
                defaultExpanded={getBookingDetailDefaultExpanded(section.name, isMobile)}
              >
                {body}
              </BookingDetailCollapsibleSection>
            );
          }

          return (
            <section key={section.name} className="booking-detail-group">
              <BookingDetailSectionHeader title={section.name} collapsible={false} expanded />
              {body}
            </section>
          );
        })}
      </div>
    </div>
  );
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

function isOwnBooking(booking, currentUser) {
  const currentUserId = String(currentUser?.user_id || "").trim();
  const currentUserEmail = String(currentUser?.email || "").trim().toLowerCase();
  const currentUserName = String(currentUser?.name || "").trim().toLowerCase();
  const bookingRequesterUserId = String(booking?.requester_user_id || "").trim();
  const bookingRequesterEmail = String(booking?.requester_email || "").trim().toLowerCase();
  const bookingRequesterName = String(booking?.requester_name || "").trim().toLowerCase();

  if (currentUserId && bookingRequesterUserId) {
    return currentUserId === bookingRequesterUserId;
  }

  if (currentUserEmail && bookingRequesterEmail) {
    return currentUserEmail === bookingRequesterEmail;
  }

  if (currentUserEmail && bookingRequesterName) {
    return currentUserEmail === bookingRequesterName;
  }

  if (currentUserName && bookingRequesterName) {
    return currentUserName === bookingRequesterName;
  }

  return false;
}

function canUserManageOwnBookingAction(basePermission, booking, currentUser) {
  if (!basePermission) return false;
  if (isStaffOrAdmin(currentUser)) return true;
  return isOwnBooking(booking, currentUser);
}

function getBookingManagePermissionState(booking, currentUser, permissionFlags) {
  return {
    canManageProcessBooking: canUserManageOwnBookingAction(
      permissionFlags.canProcessBookings,
      booking,
      currentUser
    ),
    canManageBackdateComplete: canUserManageOwnBookingAction(
      permissionFlags.canBackdateComplete,
      booking,
      currentUser
    ),
    canManageEditBooking: canUserManageOwnBookingAction(
      permissionFlags.canEditBookings,
      booking,
      currentUser
    ),
    canManageCancelBooking: canUserManageOwnBookingAction(
      permissionFlags.canCancelBookings,
      booking,
      currentUser
    ),
    canManageAssignCentralVehicle: canUserManageOwnBookingAction(
      permissionFlags.canAssignCentralVehicle,
      booking,
      currentUser
    ),
    canUnassignBookings: permissionFlags.canUnassignBookings,
    canReviewDriverCancelRequests: permissionFlags.canReviewDriverCancelRequests,
  };
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

function getDriverUnavailableReasonLabel(record) {
  if (!record || typeof record !== "object") {
    return "ไม่พร้อมรับงาน";
  }

  const rawType = String(
    record.type ||
    record.unavailable_type ||
    ""
  ).trim();
  const normalizedType = rawType.toUpperCase();
  const reason = String(
    record.reason ||
    record.destination ||
    record.note ||
    ""
  ).trim();

  if (
    normalizedType === "OUT_PROVINCE" ||
    rawType === "ปฏิบัติงานต่างจังหวัด"
  ) {
    return reason ? `ปฏิบัติงานต่างจังหวัด - ${reason}` : "ปฏิบัติงานต่างจังหวัด";
  }

  if (
    normalizedType === "LEAVE" ||
    rawType === "ลา"
  ) {
    return reason ? `ลา / หยุด - ${reason}` : "ลา / หยุด";
  }

  if (
    normalizedType === "BUSY" ||
    normalizedType === "TEMPORARY_BUSY" ||
    rawType === "หยุด"
  ) {
    return reason ? `ติดภารกิจ (ชั่วคราว) - ${reason}` : "ติดภารกิจ (ชั่วคราว)";
  }

  const typeLabel = getUnavailableTypeLabel(rawType);
  if (typeLabel && typeLabel !== "อื่นๆ") {
    return reason ? `${typeLabel} - ${reason}` : typeLabel;
  }

  return reason || "ไม่พร้อมรับงาน";
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

function buildVehicleOptionsHtml(vehicles, currentBooking, bookingGroups) {
  return vehicles
    .map((vehicle) => {
      const available = isVehicleAvailable(vehicle, currentBooking, bookingGroups);
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
    .join("");
}

function buildDriverOptionsHtml(availableDrivers, recommendedDriverId) {
  return availableDrivers
    .map((driver) => {
      const available = driver.available !== false;
      const selected = available && String(driver.user_id || "") === String(recommendedDriverId || "");
      const reasonLabel = driver.reason ? ` ❌ ${driver.reason}` : " ❌ ไม่ว่าง";

      return `<option value="${escapeHtml(driver.user_id)}" ${
        available ? "" : "disabled"
      } ${selected ? "selected" : ""}>${escapeHtml(driver.name)}${
        driver.phone ? ` (${escapeHtml(driver.phone)})` : ""
      }${available ? " ✅ ว่าง" : reasonLabel}</option>`;
    })
    .join("");
}

function buildSkippedDriversHtml(skippedDrivers, resolveDriverName, resolveSkippedDriverReason) {
  if (skippedDrivers.length === 0) return "";

  const skippedCards = skippedDrivers
    .map((item) => {
      const name = resolveDriverName(
        item.driver_user_id || item.user_id || item.driver_id,
        item.driver_name || ""
      );
      const reason = resolveSkippedDriverReason(item);

      return `
        <div class="booking-skipped-card">
          <div class="booking-skipped-name">${escapeHtml(name || "-")}</div>
          <div class="booking-skipped-reason">เหตุผล: ${escapeHtml(reason || "-")}</div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="booking-skipped-list">
      <div class="booking-skipped-title">รายการที่ข้าม</div>
      ${skippedCards}
    </div>
  `;
}

function getQueueAssignModeLabel(mode) {
  const normalized = String(mode || "").trim().toUpperCase();
  if (normalized === "MANUAL_OVERRIDE") return "เลือกคนขับเอง";
  return "ระบบจัดการให้";
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
  if (isCompletedBooking(booking)) {
    return "";
  }

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

function clampPage(page, total) {
  const nextPage = Number(page) || 1;
  return Math.min(Math.max(nextPage, 1), Math.max(total, 1));
}

function buildPageWindow(page, total, maxVisiblePages = 3) {
  const safeTotal = Math.max(1, total);
  const safePage = clampPage(page, safeTotal);
  const windowSize = Math.max(1, maxVisiblePages);

  const start = Math.min(safePage, Math.max(1, safeTotal - windowSize + 1));
  const end = Math.min(safeTotal, start + windowSize - 1);

  const pages = [];
  for (let current = start; current <= end; current += 1) {
    pages.push(current);
  }

  return pages;
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
  const safeTotal = Math.max(1, total);
  const safePage = clampPage(page, safeTotal);
  const pageNumbers = useMemo(() => buildPageWindow(safePage, safeTotal, 3), [safePage, safeTotal]);

  const handleChange = (nextPage) => {
    onChange(clampPage(nextPage, safeTotal));
  };

  return (
    <div className="booking-pagination-wrapper">
      <div className="booking-pagination-info">
        {/* หน้า {safePage} / {safeTotal} */}
      </div>
      <div className="pagination booking-pagination">
        <button type="button" onClick={() => handleChange(1)} disabled={safePage <= 1}>
          แรก
        </button>
        <button type="button" onClick={() => handleChange(safePage - 1)} disabled={safePage <= 1}>
          ก่อนหน้า
        </button>
        {pageNumbers.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            className={safePage === pageNumber ? "active-page" : ""}
            onClick={() => handleChange(pageNumber)}
          >
            {pageNumber}
          </button>
        ))}
        <button type="button" onClick={() => handleChange(safePage + 1)} disabled={safePage >= safeTotal}>
          ถัดไป
        </button>
        <button type="button" onClick={() => handleChange(safeTotal)} disabled={safePage >= safeTotal}>
          ท้าย
        </button>
      </div>
    </div>
  );
}

function getBookingActionState({
  booking,
  canViewBookingDetail,
  canManageProcessBooking,
  canManageBackdateComplete,
  canManageCancelBooking,
  canManageEditBooking,
  canUnassignBookings,
  canManageAssignCentralVehicle,
  canReviewDriverCancelRequests,
  processing,
  onProcess,
  onBackdateComplete,
  onEdit,
  onCancel,
  onUnassign,
  onAssignCentralVehicle,
  onApproveDriverCancel,
  onRejectDriverCancel,
}) {
  const status = normalizeStatus(booking.status);
  const statusMeta = getBookingDisplayStatusMeta(booking);
  const driverCancelRequestStatus = getDriverCancelRequestStatus(booking);
  const hasPendingDriverCancelRequest = driverCancelRequestStatus === "PENDING";
  const hasRejectedDriverCancelRequest = driverCancelRequestStatus === "REJECTED";
  const rowBookingId = getBookingId(booking);
  const canShowDetail = canViewBookingDetail;
  const canShowBackdateComplete =
    canManageBackdateComplete &&
    rowBookingId &&
    !isClosedBookingStatus(status);
  const canShowProcess =
    canManageProcessBooking && ["PENDING", "APPROVED"].includes(status) && !hasPendingDriverCancelRequest;
  const canShowEdit =
    canManageEditBooking && isEditableBookingStatus(status) && !hasPendingDriverCancelRequest;
  const canShowCancel =
    canManageCancelBooking &&
    !isClosedBookingStatus(status) &&
    status !== "IN_USE" &&
    !hasPendingDriverCancelRequest;
  const canShowUnassign = canUnassignBookings && status === "APPROVED" && !hasPendingDriverCancelRequest;
  const canShowAssignCentralVehicle =
    canManageAssignCentralVehicle && status === "PENDING" && !hasPendingDriverCancelRequest;

  const actionMenuItems = [];

  if (canShowBackdateComplete) {
    actionMenuItems.push({
      key: "backdate",
      label: processing === "backdate" ? "กำลังบันทึก..." : "บันทึกงานย้อนหลัง",
      color: "blue",
      icon: CalendarIcon,
      onClick: () => onBackdateComplete(booking),
    });
  }

  if (canShowProcess) {
    const isApproveAction = status !== "APPROVED";
    actionMenuItems.push({
      key: "process",
      label:
        processing === "process"
          ? "กำลังดำเนินการ..."
          : isApproveAction
            ? "อนุมัติรายการ"
            : FEATURES.vehicleModule
              ? "เปลี่ยนคนขับ/รถ"
              : "เปลี่ยนคนขับ",
      color: isApproveAction ? "green" : "purple",
      icon: isApproveAction ? CheckCircleIcon : UsersIcon,
      onClick: () => onProcess(booking),
    });
  }

  if (canShowEdit) {
    actionMenuItems.push({
      key: "edit",
      label: processing === "edit" ? "กำลังแก้ไข..." : "แก้ไข",
      color: "orange",
      icon: PencilIcon,
      onClick: () => onEdit(booking),
    });
  }

  if (canShowUnassign) {
    actionMenuItems.push({
      key: "unassign",
      label: processing === "unassign" ? "กำลังดึงงานกลับ..." : "ดึงงานกลับ",
      color: "slate",
      icon: UndoIcon,
      onClick: () => onUnassign(booking),
    });
  }

  if (canShowAssignCentralVehicle) {
    actionMenuItems.push({
      key: "assign-central-vehicle",
      label: processing === "assign-central-vehicle" ? "กำลังบันทึก..." : "ใช้รถ สนง.กลาง",
      color: "purple-dark",
      icon: HomeIcon,
      onClick: () => onAssignCentralVehicle(booking),
    });
  }

  if (canShowCancel) {
    actionMenuItems.push({
      key: "cancel",
      label: processing === "cancel" ? "กำลังยกเลิก..." : "ยกเลิก",
      color: "red",
      icon: XCircleIcon,
      onClick: () => onCancel(booking),
    });
  }

  if (canReviewDriverCancelRequests && hasPendingDriverCancelRequest) {
    actionMenuItems.push(
      {
        key: "driver-cancel-approve",
        label: "อนุมัติยกเลิกงานคนขับ",
        color: "green",
        icon: CheckCircleIcon,
        onClick: () => onApproveDriverCancel(booking),
      },
      {
        key: "driver-cancel-reject",
        label: "ไม่อนุมัติ",
        color: "red",
        icon: XCircleIcon,
        onClick: () => onRejectDriverCancel(booking),
      }
    );
  }

  return {
    status,
    statusMeta,
    hasPendingDriverCancelRequest,
    hasRejectedDriverCancelRequest,
    canShowDetail,
    actionMenuItems,
    hasActionMenuItems: actionMenuItems.length > 0,
  };
}

const BookingActionControls = memo(function BookingActionControls({
  booking,
  disabled,
  canShowDetail,
  actionMenuItems,
  onViewDetail,
  menuTriggerLabel = "ดำเนินการ",
  compactMenuTrigger = false,
}) {
  const actionMenuTriggerRef = useRef(null);
  const actionMenuPanelRef = useRef(null);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [actionMenuPosition, setActionMenuPosition] = useState({ top: 0, left: 0 });
  const [actionMenuPlacement, setActionMenuPlacement] = useState("bottom");
  const hasActionMenuItems = actionMenuItems.length > 0;

  useLayoutEffect(() => {
    if (!isActionMenuOpen) return;

    const triggerRect = actionMenuTriggerRef.current?.getBoundingClientRect();
    if (triggerRect) {
      const menuWidth = 320;
      const menuRect = actionMenuPanelRef.current?.getBoundingClientRect();
      const menuHeight = menuRect?.height || 0;
      const viewportPadding = 12;
      const left = Math.max(
        viewportPadding,
        Math.min(triggerRect.right - menuWidth, window.innerWidth - menuWidth - viewportPadding)
      );
      const spaceBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
      const spaceAbove = triggerRect.top - viewportPadding;
      const shouldOpenUpward = menuHeight > 0
        ? menuHeight > spaceBelow && spaceAbove > spaceBelow
        : spaceBelow < 180 && spaceAbove > spaceBelow;
      const top = shouldOpenUpward
        ? Math.max(viewportPadding, triggerRect.top - (menuHeight || 220) - 8)
        : Math.min(window.innerHeight - (menuHeight || 220) - viewportPadding, triggerRect.bottom + 8);

      setActionMenuPlacement(shouldOpenUpward ? "top" : "bottom");
      setActionMenuPosition({ top, left });
    }

    const handleDocumentPointerDown = (event) => {
      const target = event.target;
      const insideTrigger = actionMenuTriggerRef.current?.contains(target);
      const insideMenu = actionMenuPanelRef.current?.contains(target);

      if (!insideTrigger && !insideMenu) {
        setIsActionMenuOpen(false);
      }
    };

    const handleResize = () => {
      setIsActionMenuOpen(false);
    };

    const handleScroll = () => {
      setIsActionMenuOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsActionMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentPointerDown);
    document.addEventListener("touchstart", handleDocumentPointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handleDocumentPointerDown);
      document.removeEventListener("touchstart", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isActionMenuOpen]);

  const actionMenu = isActionMenuOpen && hasActionMenuItems && !disabled
    ? createPortal(
        <div
          ref={actionMenuPanelRef}
          className={`booking-action-menu booking-action-menu--${actionMenuPlacement}`}
          style={{
            top: `${actionMenuPosition.top}px`,
            left: `${actionMenuPosition.left}px`,
          }}
        >
          {actionMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`booking-action-menu-item booking-action-menu-item--${item.color}`}
                disabled={disabled}
                onClick={() => {
                  setIsActionMenuOpen(false);
                  item.onClick();
                }}
              >
                <Icon className="booking-action-icon" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {canShowDetail && (
        <button
          type="button"
          className={`${getBookingActionButtonClassName("detail")} inline-flex items-center justify-center gap-1.5`}
          disabled={disabled}
          onClick={() => onViewDetail(booking)}
        >
          <EyeIcon className="h-4 w-4 shrink-0" />
          <span className="leading-none">ดูรายละเอียด</span>
        </button>
      )}
      {hasActionMenuItems && (
        <div className="booking-action-dropdown">
          <button
            ref={actionMenuTriggerRef}
            type="button"
            className={`booking-action-button booking-action-menu-trigger${
              compactMenuTrigger ? " booking-action-menu-trigger--compact" : ""
            }`}
            disabled={disabled}
            aria-haspopup="menu"
            aria-expanded={isActionMenuOpen}
            aria-label="จัดการรายการจอง"
            onClick={() => setIsActionMenuOpen((current) => !current)}
          >
            <span>{menuTriggerLabel}</span>
            {!compactMenuTrigger && (
              <ChevronDownIcon className="booking-action-icon booking-action-icon--chevron" />
            )}
          </button>
          {actionMenu}
        </div>
      )}
    </>
  );
});

const BookingTableRow = memo(function BookingTableRow({
  booking,
  rowNumber,
  vehicleMap,
  showVehicleColumn,
  canViewBookingDetail,
  canManageProcessBooking,
  canManageBackdateComplete,
  canManageCancelBooking,
  canManageEditBooking,
  canUnassignBookings,
  canManageAssignCentralVehicle,
  canReviewDriverCancelRequests,
  processing,
  onViewDetail,
  onProcess,
  onBackdateComplete,
  onEdit,
  onCancel,
  onUnassign,
  onAssignCentralVehicle,
  onApproveDriverCancel,
  onRejectDriverCancel,
}) {
  const disabled = Boolean(processing);
  const {
    status,
    statusMeta,
    hasPendingDriverCancelRequest,
    hasRejectedDriverCancelRequest,
    canShowDetail,
    actionMenuItems,
  } = getBookingActionState({
    booking,
    canViewBookingDetail,
    canManageProcessBooking,
    canManageBackdateComplete,
    canManageCancelBooking,
    canManageEditBooking,
    canUnassignBookings,
    canManageAssignCentralVehicle,
    canReviewDriverCancelRequests,
    processing,
    onProcess,
    onBackdateComplete,
    onEdit,
    onCancel,
    onUnassign,
    onAssignCentralVehicle,
    onApproveDriverCancel,
    onRejectDriverCancel,
  });

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
        {hasRejectedDriverCancelRequest && (
          <div style={{ marginTop: 6 }}>
            <span className="status red">ไม่อนุมัติการยกเลิก</span>
          </div>
        )}
      </td>
                      <td style={{ maxWidth: 240, whiteSpace: "normal", wordBreak: "break-word", fontSize: 25}}>
        {normalizeBookingNote(booking.staff_note) || "-"}
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
      <td className="action-buttons booking-row-actions">
        <BookingActionControls
          booking={booking}
          disabled={disabled}
          canShowDetail={canShowDetail}
          actionMenuItems={actionMenuItems}
          onViewDetail={onViewDetail}
        />
      </td>
    </tr>
  );
});

const BookingMobileCard = memo(function BookingMobileCard(props) {
  const {
    booking,
    rowNumber,
    vehicleMap,
    showVehicleColumn,
    canViewBookingDetail,
    canManageProcessBooking,
    canManageBackdateComplete,
    canManageCancelBooking,
    canManageEditBooking,
    canUnassignBookings,
    canManageAssignCentralVehicle,
    canReviewDriverCancelRequests,
    processing,
    onViewDetail,
    onProcess,
    onBackdateComplete,
    onEdit,
    onCancel,
    onUnassign,
    onAssignCentralVehicle,
    onApproveDriverCancel,
    onRejectDriverCancel,
    isExpanded,
    onToggleExpand,
  } = props;
  const disabled = Boolean(processing);
  const bookingId = getBookingId(booking) || `booking-${rowNumber}`;
  const noteText = normalizeBookingNote(booking.staff_note);
  const {
    statusMeta,
    hasPendingDriverCancelRequest,
    hasRejectedDriverCancelRequest,
    canShowDetail,
    actionMenuItems,
  } = getBookingActionState({
    booking,
    canViewBookingDetail,
    canManageProcessBooking,
    canManageBackdateComplete,
    canManageCancelBooking,
    canManageEditBooking,
    canUnassignBookings,
    canManageAssignCentralVehicle,
    canReviewDriverCancelRequests,
    processing,
    onProcess,
    onBackdateComplete,
    onEdit,
    onCancel,
    onUnassign,
    onAssignCentralVehicle,
    onApproveDriverCancel,
    onRejectDriverCancel,
  });

  return (
    <article className={`mobile-data-card booking-mobile-card ${isExpanded ? "is-expanded" : ""}`}>
      <button
        type="button"
        className="booking-mobile-card-summary"
        aria-expanded={isExpanded}
        aria-controls={`booking-mobile-card-panel-${bookingId}`}
        onClick={() => onToggleExpand(bookingId)}
      >
        <div className="booking-mobile-card-summary-index">#{rowNumber}</div>
        <div className="booking-mobile-card-summary-requester" title={booking.requester_name || "-"}>
          {booking.requester_name || "-"}
        </div>
        <div className="booking-mobile-card-summary-destination" title={booking.destination || "-"}>
          {booking.destination || "-"}
        </div>
        <div className="booking-mobile-card-summary-side">
          <span className={`status ${statusMeta.className}`}>{statusMeta.label}</span>
          <ChevronDownIcon className={`booking-mobile-card-expand-icon${isExpanded ? " is-expanded" : ""}`} />
        </div>
      </button>

      {isExpanded && (
        <div
          id={`booking-mobile-card-panel-${bookingId}`}
          className="booking-mobile-card-expanded"
        >
          <div className="booking-mobile-card-body">
            <div className="booking-mobile-card-info-row">
              <span className="booking-mobile-card-info-icon">
                <CalendarIcon className="booking-mobile-info-svg" />
              </span>
              <div className="booking-mobile-card-info-copy">
                <span className="booking-mobile-card-info-label">เวลาไป</span>
                <b>{formatBookingDateTimeDisplay(booking.start_datetime)}</b>
              </div>
            </div>

            <div className="booking-mobile-card-info-row">
              <span className="booking-mobile-card-info-icon">
                <ClockIcon className="booking-mobile-info-svg" />
              </span>
              <div className="booking-mobile-card-info-copy">
                <span className="booking-mobile-card-info-label">เวลากลับ</span>
                <b>{formatBookingDateTimeDisplay(booking.end_datetime)}</b>
              </div>
            </div>

            <div className="booking-mobile-card-info-row">
              <span className="booking-mobile-card-info-icon">
                <UserRoundIcon className="booking-mobile-info-svg" />
              </span>
              <div className="booking-mobile-card-info-copy">
                <span className="booking-mobile-card-info-label">คนขับ</span>
                <b>{getBookingDriverLabel(booking)}</b>
                {showVehicleColumn && <small>{getBookingVehicleLabel(booking, vehicleMap)}</small>}
              </div>
            </div>

            <div className="booking-mobile-card-info-row">
              <span className="booking-mobile-card-info-icon">
                <NoteIcon className="booking-mobile-info-svg" />
              </span>
              <div className="booking-mobile-card-info-copy">
                <span className="booking-mobile-card-info-label">หมายเหตุ</span>
                <b>{noteText || "-"}</b>
              </div>
            </div>
          </div>

          {(hasPendingDriverCancelRequest || hasRejectedDriverCancelRequest) && (
            <div className="booking-mobile-card-meta">
              {hasRejectedDriverCancelRequest && <span className="status red">ไม่อนุมัติการยกเลิก</span>}
            </div>
          )}

          <div
            className="mobile-data-card-actions booking-mobile-actions"
            onClick={(event) => event.stopPropagation()}
          >
            <BookingActionControls
              booking={booking}
              disabled={disabled}
              canShowDetail={canShowDetail}
              actionMenuItems={actionMenuItems}
              onViewDetail={onViewDetail}
              menuTriggerLabel="ดำเนินการ"
              compactMenuTrigger
            />
          </div>
        </div>
      )}
    </article>
  );
});

function BookingMobileSkeleton({ cards = 5 }) {
  return (
    <div className="booking-mobile-skeleton-list booking-mobile-only" aria-hidden="true">
      {Array.from({ length: cards }).map((_, index) => (
        <div key={index} className="booking-mobile-skeleton-card">
          <div className="booking-mobile-skeleton-summary">
            <span
              className="booking-mobile-skeleton-line skeleton skeleton-pulse"
              style={{ width: 28, height: 14, borderRadius: 999 }}
            />
            <span
              className="booking-mobile-skeleton-line skeleton skeleton-pulse"
              style={{ width: "38%", height: 16, borderRadius: 999 }}
            />
            <span
              className="booking-mobile-skeleton-line skeleton skeleton-pulse"
              style={{ width: "32%", height: 16, borderRadius: 999 }}
            />
            <span className="booking-mobile-skeleton-pill skeleton skeleton-pulse" />
          </div>

          <div className="booking-mobile-card-expanded">
            <div className="booking-mobile-card-body">
              <div className="booking-mobile-card-info-row">
                <span className="booking-mobile-card-info-icon skeleton skeleton-pulse" />
                <div className="booking-mobile-card-info-copy">
                  <span
                    className="booking-mobile-skeleton-line skeleton skeleton-pulse"
                    style={{ width: 72, height: 12, borderRadius: 999, marginBottom: 6 }}
                  />
                  <span
                    className="booking-mobile-skeleton-line skeleton skeleton-pulse"
                    style={{ width: "78%", height: 15, borderRadius: 999 }}
                  />
                </div>
              </div>

              <div className="booking-mobile-card-info-row">
                <span className="booking-mobile-card-info-icon skeleton skeleton-pulse" />
                <div className="booking-mobile-card-info-copy">
                  <span
                    className="booking-mobile-skeleton-line skeleton skeleton-pulse"
                    style={{ width: 76, height: 12, borderRadius: 999, marginBottom: 6 }}
                  />
                  <span
                    className="booking-mobile-skeleton-line skeleton skeleton-pulse"
                    style={{ width: "72%", height: 15, borderRadius: 999 }}
                  />
                </div>
              </div>

              <div className="booking-mobile-card-info-row">
                <span className="booking-mobile-card-info-icon skeleton skeleton-pulse" />
                <div className="booking-mobile-card-info-copy">
                  <span
                    className="booking-mobile-skeleton-line skeleton skeleton-pulse"
                    style={{ width: 58, height: 12, borderRadius: 999, marginBottom: 6 }}
                  />
                  <span
                    className="booking-mobile-skeleton-line skeleton skeleton-pulse"
                    style={{ width: "62%", height: 15, borderRadius: 999 }}
                  />
                  <span
                    className="booking-mobile-skeleton-line skeleton skeleton-pulse"
                    style={{ width: "48%", height: 13, borderRadius: 999, marginTop: 4 }}
                  />
                </div>
              </div>
            </div>

            <div className="booking-mobile-skeleton-button skeleton skeleton-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Booking() {
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [driverUnavailableRecords, setDriverUnavailableRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [expandedBookingId, setExpandedBookingId] = useState("");
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
  const canAssignCentralVehicle = hasPermission(null, "bookings_assign_central_vehicle");
  const currentUser = getCurrentUser();
  const canReviewDriverCancelRequests = isStaffOrAdmin(currentUser);
  const canBackdateComplete = hasPermission(null, "bookings_backdate_complete");
  const canUnassignBookings = isStaffOrAdmin(currentUser);

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

  const bookingById = useMemo(() => {
    const map = new Map();
    bookings.forEach((booking) => {
      const id = String(booking.booking_id || "").trim();
      if (id) {
        map.set(id, booking);
      }
    });
    return map;
  }, [bookings]);

  const getLatestBookingForAction = useCallback((booking) => {
    const bookingId = getBookingId(booking);
    if (!bookingId) {
      return null;
    }

    return bookingById.get(String(bookingId).trim()) || booking;
  }, [bookingById]);

  const refreshAfterRejectedClosedAction = useCallback(async (message) => {
    showError(message || "รายการนี้ถูกปิดงานแล้ว กรุณารีเฟรชข้อมูล");
    await refreshBookings();
  }, [refreshBookings]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [debouncedFilters]);

  useEffect(() => {
    setExpandedBookingId("");
  }, [page]);

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

  const activeAssignmentsByDriverId = useMemo(() => {
    const map = new Map();
    bookingGroups.byAssignedUserId.forEach((driverBookings, driverId) => {
      if (driverBookings.length > 0) {
        map.set(driverId, driverBookings[0]);
      }
    });
    return map;
  }, [bookingGroups]);

  const unavailableByDriverId = useMemo(() => {
    const map = new Map();
    driverUnavailableGroups.byDriverId.forEach((records, driverId) => {
      if (records.length > 0) {
        map.set(driverId, records[0]);
      }
    });
    return map;
  }, [driverUnavailableGroups]);

  const resolveSkippedDriverReason = useCallback((driverLike) => {
    const driverId = String(
      driverLike?.driver_user_id ||
      driverLike?.user_id ||
      driverLike?.driver_id ||
      ""
    ).trim();
    const driverName = String(
      driverLike?.driver_name ||
      driverLike?.name ||
      ""
    ).trim();

    const matchedUnavailableRecord =
      (driverId ? unavailableByDriverId.get(driverId) : null) ||
      (driverName ? (driverUnavailableGroups.byDriverName.get(driverName) || [])[0] : null);

    if (matchedUnavailableRecord) {
      return getDriverUnavailableReasonLabel(matchedUnavailableRecord);
    }

    return String(driverLike?.reason || "").trim() || "ไม่พร้อมรับงาน";
  }, [driverUnavailableGroups, unavailableByDriverId]);

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
    const selectedDriverName = driverFilter ? driverById.get(driverFilter)?.name || "" : "";

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
  }, [debouncedFilters, driverById, sortedBookings]);

  const bookingStatusCounts = useMemo(() => {
    const counts = {
      ALL: filteredBookings.length,
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
      const statusMeta = getBookingDisplayStatusMeta(booking);
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
        หมายเหตุ: normalizeBookingNote(booking.staff_note) || "-",
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
    const currentBooking = bookingById.get(String(booking.booking_id || "").trim()) || booking;

    let driverQueueRecommendation = null;
    let driverQueueRecommendationError = "";

    try {
      const recommendation = await recommendDriverForBooking({
        booking_id: currentBooking.booking_id,
        start_datetime: currentBooking.start_datetime,
        end_datetime: currentBooking.end_datetime,
      });
      driverQueueRecommendation = recommendation?.data || recommendation || null;
      if (!driverQueueRecommendation) {
        driverQueueRecommendationError = "ไม่พบคำแนะนำจากคิวคนขับ";
      }
      if (recommendation?.success === false) {
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
    const recommendedReason =
      driverQueueRecommendation?.reason || driverQueueRecommendationError || "คิวถัดไป / พร้อมรับงาน";
    const skippedDrivers = Array.isArray(driverQueueRecommendation?.skipped)
      ? driverQueueRecommendation.skipped
      : [];
    const queueRecommendedDisplayName =
      (recommendedDriverId
        ? resolveDriverName(recommendedDriverId, driverQueueRecommendation?.recommended_driver_name || "")
        : "") ||
      currentQueueDriverName ||
      driverQueueRecommendationError ||
      "ยังไม่มีคำแนะนำ";
    const availableDrivers = Array.isArray(driverQueueRecommendation?.available_drivers)
      ? driverQueueRecommendation.available_drivers
      : [];
    const driverOptions = availableDrivers.length > 0
      ? availableDrivers
      : activeDrivers.map((driver) => {
          const driverId = String(driver.user_id || "").trim();
          const assignmentConflict = activeAssignmentsByDriverId.get(driverId);
          const unavailableConflict = unavailableByDriverId.get(driverId);
          const reason = assignmentConflict
            ? "มีงานที่มอบหมายแล้ว"
            : unavailableConflict
              ? getDriverUnavailableReasonLabel(unavailableConflict)
              : "";

          return {
            user_id: driverId,
            name: resolveDriverName(driverId, driver.name || ""),
            phone: driver.phone || "",
            available: !reason,
            reason,
          };
        });
    const skippedDriverSummary = skippedDrivers.length > 0
      ? `ข้าม: ${skippedDrivers
          .map((item) => {
            const name = resolveDriverName(
              item.driver_user_id || item.user_id || item.driver_id,
              item.driver_name || "-"
            );
            return `${name || "-"} (${resolveSkippedDriverReason(item) || "-"})`;
          })
          .join(", ")}`
      : "";
    const queueNoteLines = [
      recommendedReason,
      skippedDriverSummary,
    ].filter(Boolean);
    const nextQueueDriverId =
      driverQueueRecommendation?.next_queue_driver_user_id ||
      driverQueueRecommendation?.queue_after_driver_user_id ||
      driverQueueRecommendation?.next_driver_user_id ||
      "";
    const nextQueueDriverBackendName =
      driverQueueRecommendation?.next_queue_driver_name ||
      driverQueueRecommendation?.queue_after_driver_name ||
      driverQueueRecommendation?.next_driver_name ||
      "";
    const nextQueueDriverResolvedName = resolveDriverName(
      nextQueueDriverId,
      nextQueueDriverBackendName
    );
    const nextQueueDriverName =
      nextQueueDriverResolvedName && nextQueueDriverResolvedName !== "-"
        ? nextQueueDriverResolvedName
        : nextQueueDriverBackendName || "ระบบจะคำนวณหลังบันทึก";
    const vehicleOptionsHtml = FEATURES.vehicleModule
      ? buildVehicleOptionsHtml(vehicles, currentBooking, bookingGroups)
      : "";
    const driverOptionsHtml = buildDriverOptionsHtml(driverOptions, recommendedDriverId);
    const skippedDriversHtml = buildSkippedDriversHtml(
      skippedDrivers,
      resolveDriverName,
      resolveSkippedDriverReason
    );

      const result = await Swal.fire({
      title: "ดำเนินการมอบหมายงาน",
      html: `
        <div class="swal-form booking-approve-form">
          <div class="booking-queue-recommendation-card">
            <div class="booking-queue-row">
              <span>คนขับที่ระบบจัดการให้:</span>
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
          <select id="vehicle_id" class="swal2-select booking-approve-input">
            <option value="">-- เลือกรถ --</option>
            ${vehicleOptionsHtml}
          </select>
          `
              : ""
          }

          <label>เลือกผู้ใช้</label>
          <select id="assigned_user_id" class="swal2-select booking-approve-input">
            <option value="">-- เลือกผู้ใช้ --</option>
            ${driverOptionsHtml}
          </select>

          <label>เหตุผลที่เลือกคนขับเอง</label>
          <textarea
            id="manual_override_reason"
            class="swal2-textarea booking-approve-textarea"
            rows="3"
            placeholder="ระบุเมื่อเลือกคนขับไม่ตรงกับที่ระบบจัดการให้"
          ></textarea>

          ${skippedDriversHtml}

          <label>หมายเหตุ</label>
          <input id="staff_note" class="swal2-input booking-approve-input" placeholder="-">
        </div>
      `,
      width: 760,
      showCancelButton: true,
      confirmButtonText: "อนุมัติรายการ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#1455c8",
      cancelButtonColor: "#64748b",
      customClass: {
        popup: "booking-approve-modal",
        htmlContainer: "booking-approve-html",
        actions: "booking-approve-actions",
        confirmButton: "booking-approve-confirm",
        cancelButton: "booking-approve-cancel",
      },
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
          ? vehicleMap.get(vehicle_id) || null
          : null;
        const driver = driverById.get(String(assigned_user_id || "").trim()) || null;

        if (FEATURES.vehicleModule && (!vehicle || !isVehicleAvailable(vehicle, currentBooking, bookingGroups))) {
          Swal.showValidationMessage("รถคันนี้ไม่ว่างหรือไม่พร้อมใช้งาน");
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
          booking_id: currentBooking.booking_id,
          booking_no: currentBooking.booking_no || "",
          vehicle_id: FEATURES.vehicleModule ? vehicle_id : "",
          assigned_user_id,
          assigned_user_name: resolveDriverName(assigned_user_id, driver?.name || ""),
          staff_note,
          current_user_name: currentUser?.name || currentUser?.email || "",
          recommended_driver_user_id: recommendedDriverId,
          recommended_driver_name: recommendedDriverName,
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
      setProcessingAction({ bookingId: currentBooking.booking_id, type: "process" });
      const approved = await approveBooking(result.value);
      mergeBooking({ ...result.value, ...(approved || {}), status: "APPROVED" });

      try {
        await confirmDriverQueueAssignment({
          booking_id: currentBooking.booking_id,
          booking_no: currentBooking.booking_no || "",
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
  }, [activeAssignmentsByDriverId, activeDrivers, bookingById, bookingGroups, confirmDriverQueueAssignment, currentUser?.email, currentUser?.name, driverById, driverUnavailableGroups, mergeBooking, processingAction, recommendDriverForBooking, resolveDriverName, resolveSkippedDriverReason, unavailableByDriverId, vehicleMap, vehicles]);

  const handleEditBooking = useCallback(async (booking) => {
    if (processingAction) return;
    setProcessingAction({ bookingId: booking.booking_id, type: "edit" });
    await bookingFormModalRef.current?.openEdit(booking);
    setProcessingAction(null);
  }, [processingAction]);

  const handleBackdateComplete = useCallback(
    async (booking) => {
      if (processingAction) return;
      const latestBooking = getLatestBookingForAction(booking);
      const latestStatus = normalizeStatus(latestBooking?.status);
      if (!latestBooking?.booking_id) {
        showError("ไม่พบรหัสรายการจอง กรุณารีเฟรชข้อมูลแล้วลองใหม่");
        return;
      }
      if (isClosedBookingStatus(latestStatus)) {
        await refreshAfterRejectedClosedAction("รายการนี้ถูกปิดงานแล้ว กรุณารีเฟรชข้อมูล");
        return;
      }

      let backdateActualStart = "";
      let backdateActualReturn = "";
      let actualStartRoot = null;
      let actualReturnRoot = null;

      const result = await Swal.fire({
        title: "บันทึกงานย้อนหลัง",
        html: `
          <div class="swal-form booking-backdate-form">
            <label>คนขับ</label>
            <select id="backdate_assigned_user_id" class="swal2-select booking-backdate-input">
              <option value="">-- เลือกคนขับ --</option>
              ${activeDrivers
                .map((driver) => `<option value="${escapeHtml(driver.user_id)}">${escapeHtml(driver.name || "-")}</option>`)
                .join("")}
            </select>

            <div id="backdate_actual_start_container"></div>
            <div id="backdate_actual_return_container"></div>
          </div>
        `,
        width: 760,
        showCancelButton: true,
        reverseButtons: false,
        confirmButtonText: "บันทึกงานย้อนหลัง",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#1455c8",
        cancelButtonColor: "#64748b",
        customClass: {
          popup: "booking-backdate-popup",
          htmlContainer: "booking-backdate-html",
          actions: "booking-backdate-actions",
          confirmButton: "booking-backdate-confirm",
          cancelButton: "booking-backdate-cancel",
        },
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
          const actual_start_datetime = backdateActualStart || "";
          const actual_return_datetime = backdateActualReturn || "";

          if (!assigned_user_id) {
            Swal.showValidationMessage("กรุณาเลือกคนขับ");
            return false;
          }

          const driver = activeDrivers.find((item) => String(item.user_id || "").trim() === assigned_user_id);

          if (!driver) {
            Swal.showValidationMessage("ไม่พบข้อมูลคนขับ");
            return false;
          }

          if (!actual_start_datetime) {
            Swal.showValidationMessage("กรุณาระบุเวลาออกรถจริง");
            return false;
          }

          if (!actual_return_datetime) {
            Swal.showValidationMessage("กรุณาระบุเวลากลับจริง");
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
            actual_start_datetime,
            actual_return_datetime,
          };
        },
      });

      if (!result.isConfirmed) return;

      try {
        const currentBooking = getLatestBookingForAction(booking) || latestBooking;
        const currentStatus = normalizeStatus(currentBooking?.status);
        const bookingId = getBookingId(currentBooking);

        if (!bookingId) {
          showError("ไม่พบรหัสรายการจอง กรุณารีเฟรชข้อมูลแล้วลองใหม่");
          return;
        }

        if (isClosedBookingStatus(currentStatus)) {
          await refreshAfterRejectedClosedAction("รายการนี้ถูกปิดงานแล้ว กรุณารีเฟรชข้อมูล");
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
          actual_start_datetime: result.value.actual_start_datetime || "",
          actual_return_datetime: result.value.actual_return_datetime || "",
          actual_start_by: actor,
          actual_return_by: actor,
          status: "COMPLETED",
          is_backdated: "TRUE",
          backdated_completed_at: nowIso,
          backdated_completed_by: actor,
          updated_by: actor,
        };

        const response = await backdateCompleteBooking(payload);
        if (response?.success === false) {
          await refreshAfterRejectedClosedAction(response?.message || "บันทึกงานย้อนหลังไม่สำเร็จ");
          return;
        }

        await refreshBookings();
        await showSuccess("บันทึกงานย้อนหลังสำเร็จ");
      } catch (err) {
        if ((err.message || "").trim() === "รายการนี้ถูกปิดงานแล้ว กรุณารีเฟรชข้อมูล") {
          await refreshAfterRejectedClosedAction(err.message);
        } else {
          showError(err.message || "บันทึกงานย้อนหลังไม่สำเร็จ");
          await refreshBookings();
        }
      } finally {
        setProcessingAction(null);
      }
    },
    [activeDrivers, backdateCompleteBooking, currentUser?.email, currentUser?.name, getLatestBookingForAction, processingAction, refreshAfterRejectedClosedAction, refreshBookings]
  );

  const handleViewBookingDetail = useCallback(
    async (booking) => {
      if (processingAction) return;
      const currentRole = String(currentUser?.role || "").trim().toUpperCase() || "USER";
      const detailFields = getBookingDetailFields({ booking, vehicleMap }).filter((field) =>
        field.roles.includes(currentRole)
      );
      const detailGroups = detailFields.reduce((groups, field) => {
        const groupName = getBookingDetailGroupName(field);
        if (!groups.has(groupName)) {
          groups.set(groupName, []);
        }
        groups.get(groupName).push(field);
        return groups;
      }, new Map());
      const driverChangeRows = getDriverChangeHistoryRows(booking);
      const timelineEntries = getBookingTimelineEntries(booking);

      const groupOrder = [
        "ข้อมูลผู้จอง",
        "ข้อมูลการเดินทาง",
        "ข้อมูลการใช้งานรถ",
        "การมอบหมายงาน",
        "ประวัติการเปลี่ยนคนขับ",
        "ประวัติการดำเนินงาน",
        "ข้อมูลระบบ / ผู้ดูแลระบบ",
        "ข้อมูลเพิ่มเติม",
      ];
      const detailSections = groupOrder.reduce((sections, groupName) => {
        if (groupName === "ประวัติการเปลี่ยนคนขับ") {
          sections.push({
            name: groupName,
            type: "driver-change",
            items: driverChangeRows,
          });
          return sections;
        }

        if (groupName === "ประวัติการดำเนินงาน") {
          sections.push({
            name: groupName,
            type: "timeline",
            items: timelineEntries,
          });
          return sections;
        }

        const groupFields = detailGroups.get(groupName) || [];
        if (groupFields.length > 0) {
          sections.push({
            name: groupName,
            type: "fields",
            items: groupFields.map((field) => ({
              label: field.label,
              value: field.value,
            })),
          });
        }

        return sections;
      }, []);
      const isMobileDetailModal = typeof window !== "undefined" ? window.innerWidth < 768 : false;
      let detailModalRoot = null;

      await Swal.fire({
        title: "รายละเอียดรายการจอง",
        html: '<div id="booking-detail-modal-root"></div>',
        width: 820,
        confirmButtonText: "ปิด",
        confirmButtonColor: "#1455c8",
        didOpen: () => {
          const detailModalElement = document.getElementById("booking-detail-modal-root");
          if (!detailModalElement) return;
          detailModalRoot = createRoot(detailModalElement);
          detailModalRoot.render(
            <BookingDetailModalContent sections={detailSections} isMobile={isMobileDetailModal} />
          );
        },
        willClose: () => {
          if (detailModalRoot) {
            detailModalRoot.unmount();
            detailModalRoot = null;
          }
        },
      });
    },
    [currentUser?.role, vehicleMap]
  );

  const handleCancelBooking = useCallback(async (booking) => {
    if (processingAction) return;
    const latestBooking = getLatestBookingForAction(booking);
    const latestStatus = normalizeStatus(latestBooking?.status);
    if (!latestBooking?.booking_id) {
      showError("ไม่พบรหัสรายการจอง กรุณารีเฟรชข้อมูลแล้วลองใหม่");
      return;
    }
    if (isClosedBookingStatus(latestStatus)) {
      await refreshAfterRejectedClosedAction("รายการนี้ถูกปิดงานแล้ว กรุณารีเฟรชข้อมูล");
      return;
    }
    if (latestStatus === "IN_USE") {
      showError("รายการนี้ไม่สามารถยกเลิกได้ กรุณารีเฟรชข้อมูล");
      await refreshBookings();
      return;
    }

    const result = await Swal.fire({
      title: normalizeStatus(booking.status) === "PENDING" ? "ยกเลิกรายการจอง" : "ยกเลิกรายการจอง",
      html: `
        <div class="swal-form booking-cancel-form">
          <label>เหตุผลการยกเลิก</label>
          <textarea id="cancel_reason" class="swal2-textarea booking-cancel-textarea" rows="5" placeholder="ระบุเหตุผลให้ชัดเจน"></textarea>
        </div>
      `,
      width: 720,
      showCancelButton: true,
      confirmButtonText: "ยืนยัน",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      customClass: {
        popup: "booking-cancel-modal",
        htmlContainer: "booking-cancel-html",
        actions: "booking-cancel-actions",
        confirmButton: "booking-cancel-confirm",
        cancelButton: "booking-cancel-cancel",
      },
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
      const currentBooking = getLatestBookingForAction(booking) || latestBooking;
      const currentStatus = normalizeStatus(currentBooking?.status);
      if (isClosedBookingStatus(currentStatus)) {
        await refreshAfterRejectedClosedAction("รายการนี้ถูกปิดงานแล้ว กรุณารีเฟรชข้อมูล");
        return;
      }
      if (currentStatus === "IN_USE") {
        showError("รายการนี้ไม่สามารถยกเลิกได้ กรุณารีเฟรชข้อมูล");
        await refreshBookings();
        return;
      }

      setProcessingAction({ bookingId: currentBooking.booking_id, type: "cancel" });
      const cancelled = await cancelBooking({
        booking_id: currentBooking.booking_id,
        reason: result.value,
        cancelled_by: currentUser?.name || currentUser?.email || "",
      });

      if (cancelled?.success === false) {
        await refreshAfterRejectedClosedAction(cancelled?.message || "ยกเลิกรายการไม่สำเร็จ");
        return;
      }

      await refreshBookings();
      await showSuccess("ยกเลิกรายการสำเร็จ");
    } catch (err) {
      if ((err.message || "").trim() === "รายการนี้ถูกปิดงานแล้ว กรุณารีเฟรชข้อมูล") {
        await refreshAfterRejectedClosedAction(err.message);
      } else {
        showError(err.message || "ยกเลิกรายการไม่สำเร็จ");
        await refreshBookings();
      }
    } finally {
      setProcessingAction(null);
    }
  }, [cancelBooking, currentUser?.email, currentUser?.name, getLatestBookingForAction, processingAction, refreshAfterRejectedClosedAction, refreshBookings]);

  const handleUnassignBooking = useCallback(async (booking) => {
    if (processingAction) return;
    if (normalizeStatus(booking.status) !== "APPROVED") return;

    const result = await Swal.fire({
      title: "ดึงงานกลับ",
      html: `
        <div class="swal-form booking-recall-form">
          <div class="booking-recall-description">รายการนี้จะถูกดึงกลับมาให้ดำเนินการต่อ</div>
          <label>เหตุผลการดึงงานกลับ</label>
          <textarea id="unassign_reason" class="swal2-textarea booking-recall-textarea" rows="5" placeholder="ระบุเหตุผลการดึงงานกลับ"></textarea>
        </div>
      `,
      width: 560,
      customClass: {
        popup: "booking-recall-modal",
        htmlContainer: "booking-recall-html",
        actions: "booking-recall-actions",
        confirmButton: "booking-recall-confirm",
        cancelButton: "booking-recall-cancel",
      },
      showCancelButton: true,
      confirmButtonText: "ยืนยันดึงงานกลับ",
      cancelButtonText: "ยกเลิก",
      preConfirm: () => {
        const reason = document.getElementById("unassign_reason").value.trim();

        if (!reason) {
          Swal.showValidationMessage("กรุณาระบุเหตุผลการดึงงานกลับ");
          return false;
        }

        return reason;
      },
    });

    if (!result.isConfirmed) return;

    try {
      setProcessingAction({ bookingId: booking.booking_id, type: "unassign" });
      const response = await unassignBookingDriver({
        booking_id: booking.booking_id,
        reason: result.value,
        updated_by: currentUser?.name || currentUser?.email || "",
      });

      if (response?.success === false) {
        showError(response?.message || "ดึงงานกลับไม่สำเร็จ");
        return;
      }

      mergeBooking({
        ...(response || {}),
        booking_id: booking.booking_id,
        status: "PENDING",
        assigned_user_id: "",
        assigned_user_name: "",
        driver_user_id: "",
        driver_name: "",
        driver_cancel_request_status: "",
        driver_cancel_request_reason: "",
        driver_cancel_requested_by: "",
        driver_cancel_review_status: "",
        driver_cancel_review_reason: "",
        driver_cancel_reviewed_by: "",
      });

      await showSuccess("ดึงงานกลับสำเร็จ");
    } catch (err) {
      showError(err.message || "ดึงงานกลับไม่สำเร็จ");
    } finally {
      setProcessingAction(null);
    }
  }, [currentUser?.email, currentUser?.name, mergeBooking, processingAction]);

  const handleAssignCentralVehicle = useCallback(async (booking) => {
    if (processingAction) return;
    const latestBooking = getLatestBookingForAction(booking);
    const latestStatus = normalizeStatus(latestBooking?.status);
    if (!latestBooking?.booking_id) {
      showError("ไม่พบรหัสรายการจอง กรุณารีเฟรชข้อมูลแล้วลองใหม่");
      return;
    }
    if (isClosedBookingStatus(latestStatus)) {
      await refreshAfterRejectedClosedAction("รายการนี้ถูกปิดงานแล้ว กรุณารีเฟรชข้อมูล");
      return;
    }

    const reasonDefault = "ใช้รถ สนง.กลาง (รถไม่ว่าง)";
    const result = await Swal.fire({
      title: "ใช้รถ สนง.กลาง",
      html: `
        <div class="swal-form vehicle-office-form">
          <div style="text-align:left; line-height:1.7; margin-bottom: 8px;">
            <div>รายการนี้จะถูกปิดงานทันทีโดยมอบหมายให้ <b>${escapeHtml(CENTRAL_OFFICE_DRIVER_NAME)}</b></div>
          </div>
          <label>เหตุผล</label>
          <textarea id="central_vehicle_reason" class="swal2-textarea vehicle-office-textarea" rows="4">${escapeHtml(reasonDefault)}</textarea>
        </div>
      `,
      width: 720,
      showCancelButton: true,
      confirmButtonText: "ยืนยันใช้รถ สนง.กลาง",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#f59e0b",
      cancelButtonColor: "#64748b",
      customClass: {
        popup: "vehicle-office-modal",
        htmlContainer: "vehicle-office-html",
        actions: "vehicle-office-actions",
        confirmButton: "vehicle-office-confirm",
        cancelButton: "vehicle-office-cancel",
      },
      preConfirm: () => {
        const reason = document.getElementById("central_vehicle_reason")?.value.trim() || "";
        if (!reason) {
          Swal.showValidationMessage("กรุณาระบุเหตุผล");
          return false;
        }
        return reason;
      },
    });

    if (!result.isConfirmed) return;

    try {
      const currentBooking = getLatestBookingForAction(booking) || latestBooking;
      const currentStatus = normalizeStatus(currentBooking?.status);
      const bookingId = getBookingId(currentBooking);
      if (!bookingId) {
        showError("ไม่พบรหัสรายการจอง กรุณารีเฟรชข้อมูลแล้วลองใหม่");
        return;
      }

      if (isClosedBookingStatus(currentStatus)) {
        await refreshAfterRejectedClosedAction("รายการนี้ถูกปิดงานแล้ว กรุณารีเฟรชข้อมูล");
        return;
      }

      const actor = currentUser?.name || currentUser?.email || "";
      setProcessingAction({ bookingId, type: "assign-central-vehicle" });

      const response = await assignCentralVehicle({
        booking_id: bookingId,
        reason: result.value,
        completed_by: actor,
        completed_by_user_id: currentUser?.user_id || "",
      });

      if (response?.success === false) {
        await refreshAfterRejectedClosedAction(response?.message || "ใช้รถ สนง.กลาง ไม่สำเร็จ");
        return;
      }

      await refreshBookings();
      await showSuccess("บันทึกใช้รถ สนง.กลาง สำเร็จ");
    } catch (err) {
      if ((err.message || "").trim() === "รายการนี้ถูกปิดงานแล้ว กรุณารีเฟรชข้อมูล") {
        await refreshAfterRejectedClosedAction(err.message);
      } else {
        showError(err.message || "ใช้รถ สนง.กลาง ไม่สำเร็จ");
        await refreshBookings();
      }
    } finally {
      setProcessingAction(null);
    }
  }, [assignCentralVehicle, currentUser?.email, currentUser?.name, currentUser?.user_id, getLatestBookingForAction, processingAction, refreshAfterRejectedClosedAction, refreshBookings]);

  const handleReviewDriverCancelRequest = useCallback(async (booking, decision) => {
    if (processingAction) return;

    const requestReason = String(booking.driver_cancel_request_reason || "").trim();
    const requestLabel = String(booking.booking_no || booking.booking_id || "-").trim();
    const driverLabel = getBookingDriverLabel(booking);
    const rejectModalHtml = `
      <div class="swal-form" style="text-align:left;">
        <div style="margin-bottom:12px;">
          <div style="font-size:19px; font-weight:700; color:#0f172a;">ตรวจสอบเหตุผลก่อนยืนยัน</div>
        </div>
        <div style="display:grid; gap:8px; margin-bottom:14px; padding:12px; border:1px solid #e2e8f0; border-radius:14px; background:#f8fafc; line-height:1.6;">
          <div><b>ผู้จอง:</b> ${escapeHtml(booking.requester_name || "-")}</div>
          <div><b>คนขับ:</b> ${escapeHtml(driverLabel || "-")}</div>
          <div><b>ปลายทาง:</b> ${escapeHtml(booking.destination || "-")}</div>
          <div><b>วันเวลาไป:</b> ${escapeHtml(formatBookingDateTimeDisplay(booking.start_datetime))}</div>
          <div><b>เหตุผลจากคนขับ:</b> "${escapeHtml(requestReason || "-")}"</div>
        </div>
        <label>เหตุผลที่ไม่อนุมัติ</label>
        <textarea id="driver_cancel_review_reason" class="swal2-textarea" rows="4" placeholder="ระบุเหตุผลให้ชัดเจน" style="min-height:104px; margin-top:8px;"></textarea>
      </div>
    `;

    const result = await Swal.fire({
      title: decision === "APPROVE" ? "อนุมัติยกเลิกงานคนขับ" : "ไม่อนุมัติการยกเลิกงาน",
      html: decision === "REJECT"
        ? rejectModalHtml
        : `
            <div class="swal-form">
              <div style="text-align:left; line-height:1.7">
                <div><b>รายการ:</b> ${escapeHtml(requestLabel)}</div>
                <div><b>เหตุผลจากคนขับ:</b> ${escapeHtml(requestReason || "-")}</div>
              </div>
            </div>
          `,
      width: decision === "REJECT" ? "min(96vw, 640px)" : 760,
      showCancelButton: true,
      confirmButtonText: decision === "APPROVE" ? "อนุมัติ" : "ยืนยันไม่อนุมัติ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: decision === "APPROVE" ? "#1455c8" : "#dc2626",
      cancelButtonColor: "#ffffff",
      customClass: decision === "REJECT" ? {
        popup: "booking-driver-cancel-reject-modal",
        htmlContainer: "booking-driver-cancel-reject-html",
        actions: "booking-driver-cancel-reject-actions",
        confirmButton: "booking-driver-cancel-reject-confirm",
        cancelButton: "booking-driver-cancel-reject-cancel",
      } : undefined,
      didOpen: () => {
        if (decision !== "REJECT") return;

        const popup = Swal.getPopup();
        const confirmButton = Swal.getConfirmButton();
        const cancelButton = Swal.getCancelButton();
        const actions = Swal.getActions();
        const textarea = document.getElementById("driver_cancel_review_reason");

        if (popup) {
          popup.style.padding = "1rem";
        }
        if (actions) {
          actions.style.marginTop = "0.5rem";
          actions.style.gap = "0.5rem";
          actions.style.flexWrap = "nowrap";
        }
        if (textarea) {
          textarea.style.margin = "8px 0 0";
        }
        if (confirmButton) {
          confirmButton.style.minHeight = "44px";
          confirmButton.style.padding = "0.7rem 1rem";
          confirmButton.style.fontWeight = "700";
          confirmButton.style.whiteSpace = "nowrap";
        }
        if (cancelButton) {
          cancelButton.style.minHeight = "44px";
          cancelButton.style.padding = "0.7rem 1rem";
          cancelButton.style.fontWeight = "700";
          cancelButton.style.whiteSpace = "nowrap";
          cancelButton.style.color = "#475569";
          cancelButton.style.border = "1px solid #cbd5e1";
          cancelButton.style.background = "#ffffff";
          cancelButton.style.boxShadow = "none";
        }
      },
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

  const handleStatusChipClick = useCallback((status) => {
    setFilters((current) => ({
      ...current,
      status: status === "ALL" ? "" : status,
    }));
    setPage(1);
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

  const activeStatus = filters.status || "ALL";

  const toggleExpandedBooking = useCallback((bookingId) => {
    setExpandedBookingId((current) => (current === bookingId ? "" : bookingId));
  }, []);

  useEffect(() => {
    setExpandedBookingId("");
  }, [page, debouncedFilters]);

  const renderFilterFields = (isMobile = false) => (
    <>
      <div className={`booking-filter-row-3${isMobile ? " booking-filter-row-mobile" : ""}`} style={{ marginTop: 16 }}>
        <div>
          <label>ผู้จอง</label>
          <input
            value={filters.requester}
            onChange={(e) => setFilter("requester", e.target.value)}
            placeholder ="ค้นหาจากชื่อผู้จอง"
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

      <div className={`booking-filter-row-3${isMobile ? " booking-filter-row-mobile" : ""}`} style={{ marginTop: 16 }}>
        <div>
          <ThaiDateTimeField
            id={isMobile ? "filter_start_datetime_mobile" : "filter_start_datetime"}
            label="เวลาไป"
            value={filters.start_datetime}
            placeholder="เลือกเวลาไป"
            onChange={(value) => setFilter("start_datetime", value || "")}
          />
        </div>

        <div>
          <ThaiDateTimeField
            id={isMobile ? "filter_end_datetime_mobile" : "filter_end_datetime"}
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
    </>
  );

  return (
    <div>
      <div className="booking-mobile-page-header booking-mobile-only block md:hidden">
        <div className="booking-mobile-page-header-row">
          <div className="booking-mobile-page-title-wrap">
            <h2>รายการจองรถ</h2>
            <p>จองรถและติดตามรายการจอง</p>
          </div>
          <div className="booking-mobile-page-header-actions">
            {canViewBookings && (
              <button
                type="button"
                className="booking-mobile-icon-button"
                title="รีเฟรชข้อมูล"
                aria-label="รีเฟรชข้อมูล"
                disabled={refreshing || loading}
                onClick={refreshBookings}
              >
                <UndoIcon className="booking-mobile-toolbar-icon" />
              </button>
            )}
            {canViewBookings && (
              <button
                type="button"
                className="booking-mobile-icon-button"
                title={isMobileFilterOpen ? "ซ่อนตัวกรอง" : "แสดงตัวกรอง"}
                aria-label={isMobileFilterOpen ? "ซ่อนตัวกรอง" : "แสดงตัวกรอง"}
                onClick={() => setIsMobileFilterOpen((current) => !current)}
              >
                <FilterIcon className="booking-mobile-toolbar-icon" />
              </button>
            )}
            {canViewBookings && (
             <button
                    type="button"
                    className="booking-mobile-icon-button"
                    title="Export Excel"
                    aria-label="Export Excel"
                    disabled={filteredBookings.length === 0}
                    onClick={handleExportBookingExcel}
                  >
                    <FileExportIcon className="booking-mobile-toolbar-icon" />
              
                  </button>
                    )}
          </div>
        </div>
        <div className="booking-mobile-top-actions">
          {/* <button
            type="button"
            className="booking-mobile-toolbar-button booking-mobile-filter-button"
            onClick={() => setIsMobileFilterOpen((current) => !current)}
          >
            <FilterIcon className="booking-mobile-toolbar-icon" />
            <span>ตัวกรอง</span>
          </button> */}
          {canCreateBookings && (
            <button
              type="button"
              className="booking-mobile-toolbar-button booking-mobile-create-button"
              disabled={Boolean(processingAction)}
              onClick={handleCreateBooking}
            >
              <PlusIcon className="booking-mobile-toolbar-icon" />
              <span>เพิ่มรายการจองใหม่</span>
            </button>
          )}
        </div>
      </div>

      <div className="page-header booking-desktop-only hidden rounded-3xl border border-sky-100 bg-white px-4 py-4 shadow-sm sm:px-5 md:flex lg:px-7">
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

      {error && !visibleLoading && <div className="form-card text-slate-700">{error}</div>}

      {canViewBookings && (
        <div className="form-card booking-page-card">
            <div className="section-header booking-desktop-only hidden gap-3 border-b border-sky-100 pb-4 md:flex">
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
          <div className="booking-desktop-only hidden md:block">
            {renderFilterFields()}
          </div>

          <div className="booking-mobile-shell booking-mobile-only block md:hidden">
            <div className="booking-mobile-status-scroller">
              {BOOKING_STATUS_COUNT_ITEMS.map((item) => (
                <button
                  key={item.status}
                  type="button"
                  className={`booking-status-count ${item.className} booking-mobile-status-count ${
                    activeStatus === item.status ? "is-active" : ""
                  }`}
                  aria-pressed={activeStatus === item.status}
                  onClick={() => handleStatusChipClick(item.status)}
                >
                  <span className="booking-status-count-label">{item.label}</span>
                  <span className="booking-status-count-value">{bookingStatusCounts[item.status] || 0}</span>
                </button>
              ))}
            </div>

            {isMobileFilterOpen && (
              <div className="booking-mobile-filter-panel">
                <div className="booking-mobile-filter-panel-header">
                  <h3>ตัวกรองรายการจองรถ</h3>
                  <button
                    type="button"
                    className="booking-mobile-filter-clear"
                    disabled={refreshing}
                    onClick={clearFilters}
                  >
                    ล้างตัวกรอง
                  </button>
                </div>
                {renderFilterFields(true)}
              </div>
            )}
          </div>

          <div className="booking-table-toolbar booking-desktop-only hidden md:flex">
            <div className="booking-status-counts">
              {BOOKING_STATUS_COUNT_ITEMS.map((item) => (
                <button
                  key={item.status}
                  type="button"
                  className={`booking-status-count ${item.className} ${
                    activeStatus === item.status ? "is-active" : ""
                  }`}
                  aria-pressed={activeStatus === item.status}
                  onClick={() => handleStatusChipClick(item.status)}
                >
                  <span className="booking-status-count-label">{item.label}</span>
                  <span className="booking-status-count-value">{bookingStatusCounts[item.status] || 0}</span>
                </button>
              ))}
            </div>

            <div className="booking-create-wrapper">
              <button
                type="button"
                className="booking-toolbar-button success-button"
                disabled={filteredBookings.length === 0}
                onClick={handleExportBookingExcel}
              >
                <FileExportIcon className="booking-toolbar-button-icon" />
                <span>Export Excel</span>
              </button>
              {canCreateBookings && (
                <button
                  type="button"
                  className="booking-toolbar-button"
                  disabled={Boolean(processingAction)}
                  onClick={handleCreateBooking}
                >
                  <PlusIcon className="booking-toolbar-button-icon" />
                  <span>เพิ่มรายการจองใหม่</span>
                </button>
              )}
            </div>
          </div>
          {visibleLoading ? (
            <>
              <div className="booking-desktop-only hidden md:block">
                <TableSkeleton rows={5} columns={10} />
              </div>
              <BookingMobileSkeleton cards={5} />
            </>
          ) : (
            <>

              <div className="table-wrap mobile-hide-table booking-desktop-only hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block" style={{ marginTop: 24 }}>
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
                        (() => {
                          const actionPermissions = getBookingManagePermissionState(booking, currentUser, {
                            canProcessBookings,
                            canBackdateComplete,
                            canEditBookings,
                            canCancelBookings,
                            canAssignCentralVehicle,
                            canUnassignBookings,
                            canReviewDriverCancelRequests,
                          });

                          return (
                        <BookingTableRow
                          key={getBookingId(booking) || booking.booking_no}
                          booking={booking}
                          rowNumber={(page - 1) * ROWS_PER_PAGE + rowIndex + 1}
                          vehicleMap={vehicleMap}
                          showVehicleColumn={FEATURES.vehicleModule}
                          canViewBookingDetail={canViewBookingDetail}
                          {...actionPermissions}
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
                          onUnassign={handleUnassignBooking}
                          onAssignCentralVehicle={handleAssignCentralVehicle}
                          onApproveDriverCancel={handleApproveDriverCancel}
                          onRejectDriverCancel={handleRejectDriverCancel}
                        />
                          );
                        })()
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mobile-card-list booking-mobile-list booking-mobile-only block mt-6 md:hidden" style={{ marginTop: 24 }}>
                {pageItems.length === 0 ? (
                  <div className="mobile-empty-card">ไม่พบรายการจอง</div>
                ) : (
                  pageItems.map((booking, rowIndex) => (
                    (() => {
                      const bookingId = getBookingId(booking) || `booking-${(page - 1) * ROWS_PER_PAGE + rowIndex + 1}`;
                      const actionPermissions = getBookingManagePermissionState(booking, currentUser, {
                        canProcessBookings,
                        canBackdateComplete,
                        canEditBookings,
                        canCancelBookings,
                        canAssignCentralVehicle,
                        canUnassignBookings,
                        canReviewDriverCancelRequests,
                      });

                      return (
                    <BookingMobileCard
                      key={`mobile-${getBookingId(booking) || booking.booking_no}`}
                      booking={booking}
                      rowNumber={(page - 1) * ROWS_PER_PAGE + rowIndex + 1}
                      vehicleMap={vehicleMap}
                      showVehicleColumn={FEATURES.vehicleModule}
                      canViewBookingDetail={canViewBookingDetail}
                      {...actionPermissions}
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
                      onUnassign={handleUnassignBooking}
                      onAssignCentralVehicle={handleAssignCentralVehicle}
                      onApproveDriverCancel={handleApproveDriverCancel}
                      onRejectDriverCancel={handleRejectDriverCancel}
                      isExpanded={expandedBookingId === bookingId}
                      onToggleExpand={toggleExpandedBooking}
                    />
                      );
                    })()
                  ))
                )}
              </div>

              <Pagination page={page} total={bookingPages} onChange={setPage} />
            </>
          )}
        </div>
      )}
    </div>
  );
}


