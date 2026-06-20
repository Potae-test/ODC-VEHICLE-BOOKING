import { Fragment, memo, useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { getBookings, getDriverJobLogs, getUsers } from "../api";
import AppLayout from "../layouts/AppLayout";
import MobileGrid from "../layouts/MobileGrid";
import MobilePageHeader from "../layouts/MobilePageHeader";
import MobilePageSection from "../layouts/MobilePageSection";
import { formatThaiDateTime } from "../utils/date";
import { getDriverSummaryCardScope, hasPermission, normalizeRole } from "../permissions";
import PageSkeleton from "../components/skeletons/PageSkeleton";
import useMinimumLoading from "../hooks/useMinimumLoading";

const TABLE_PAGE_SIZE = 5;

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseBookingDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfWeek(date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = startOfDay(date);
  start.setDate(start.getDate() + diff);
  return start;
}

function endOfWeek(date) {
  const end = startOfWeek(date);
  end.setDate(end.getDate() + 6);
  return endOfDay(end);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getRange(mode, customStart, customEnd) {
  const today = new Date();

  if (mode === "today") {
    return { start: startOfDay(today), end: endOfDay(today), label: "วันนี้" };
  }
  if (mode === "week") {
    return { start: startOfWeek(today), end: endOfWeek(today), label: "สัปดาห์นี้" };
  }
  if (mode === "month") {
    return { start: startOfMonth(today), end: endOfMonth(today), label: "เดือนนี้" };
  }

  const start = customStart ? startOfDay(new Date(customStart)) : startOfMonth(today);
  const end = customEnd ? endOfDay(new Date(customEnd)) : endOfMonth(today);
  return { start, end, label: "ช่วงวันที่เลือก" };
}

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function normalizeAction(action) {
  return String(action || "").trim().toUpperCase();
}

function hasCompletedStatus(booking) {
  return normalizeStatus(booking?.status) === "COMPLETED";
}

function isPendingDriverCancel(booking) {
  return normalizeStatus(booking?.driver_cancel_request_status) === "PENDING";
}

function isDriverWorkloadBooking(booking) {
  const status = normalizeStatus(booking?.status);
  const assignedUserId = String(booking?.assigned_user_id || booking?.driver_user_id || "").trim();
  const assignedUserName = String(booking?.assigned_user_name || "").trim();
  const driverName = String(booking?.driver_name || "").trim();

  if (!(assignedUserId || assignedUserName || driverName)) return false;
  if (status === "CANCELLED" || status === "PENDING") return false;

  return ["APPROVED", "IN_USE", "COMPLETED"].includes(status);
}

function getDriverWorkloadCategory(booking) {
  if (!isDriverWorkloadBooking(booking)) return "";
  if (isPendingDriverCancel(booking)) return "";

  const status = normalizeStatus(booking.status);
  if (status === "COMPLETED") return "completed";
  if (status === "IN_USE") return "in_use";
  if (status === "APPROVED") return "approved";
  return "";
}

function getDriverJobActionCategoryV2(booking) {
  if (hasCompletedStatus(booking)) return "completed";

  const action = normalizeAction(booking.action);
  if (action === "ASSIGNED") return "approved";
  if (action === "STARTED") return "in_use";
  if (action === "COMPLETED") return "completed";
  if (action === "DRIVER_CANCEL_REQUESTED") return "requested";
  if (action === "DRIVER_CANCEL_APPROVED") return "approved";
  if (action === "DRIVER_CANCEL_REJECTED") return "rejected";
  if (action === "DRIVER_CANCELLED") return "rejected";
  return null;
}

function getDriverJobActionLabelV2(booking) {
  if (hasCompletedStatus(booking)) return "เสร็จสิ้น";

  const action = normalizeAction(booking.action);
  if (action === "ASSIGNED") return "ได้รับมอบหมาย";
  if (action === "STARTED") return "เริ่มใช้งาน";
  if (action === "COMPLETED") return "เสร็จสิ้น";
  if (action === "UNASSIGNED") return "STAFF ดึงงานกลับ";
  if (action === "DRIVER_CANCEL_REQUESTED") return "ขอยกเลิกงาน";
  if (action === "DRIVER_CANCEL_APPROVED") return "STAFF อนุมัติยกเลิก";
  if (action === "DRIVER_CANCEL_REJECTED") return "STAFF ไม่อนุมัติยกเลิก";
  if (action === "DRIVER_CANCELLED") return "คนขับยกเลิก";
  return action || "-";
}

function getDriverJobActionDescriptionV2(booking) {
  if (hasCompletedStatus(booking)) return "จบงาน / คืนรถ";

  const action = normalizeAction(booking.action);
  const reason = String(booking.reason || "").trim();

  if (action === "ASSIGNED") return "ได้รับมอบหมายงาน";
  if (action === "STARTED") return "เริ่มใช้งานรถ";
  if (action === "COMPLETED") return "จบงาน / คืนรถ";
  if (action === "UNASSIGNED") return reason ? `STAFF ดึงงานกลับ: ${reason}` : "STAFF ดึงงานกลับ";
  if (action === "DRIVER_CANCEL_REQUESTED") return reason ? `ขอยกเลิกงาน: ${reason}` : "ขอยกเลิกงาน";
  if (action === "DRIVER_CANCEL_APPROVED") return reason ? `STAFF อนุมัติยกเลิก: ${reason}` : "STAFF อนุมัติยกเลิก";
  if (action === "DRIVER_CANCEL_REJECTED") return reason ? `STAFF ไม่อนุมัติยกเลิก: ${reason}` : "STAFF ไม่อนุมัติยกเลิก";
  if (action === "DRIVER_CANCELLED") return reason ? `คนขับยกเลิกงาน: ${reason}` : "คนขับยกเลิกงาน";
  return reason || booking.action || "-";
}

function getDriverJobActionClassV2(booking) {
  if (hasCompletedStatus(booking)) return "status gray";

  const action = normalizeAction(booking.action);
  if (action === "COMPLETED") return "status gray";
  if (action === "STARTED") return "status green";
  if (action === "ASSIGNED") return "status blue";
  if (action === "UNASSIGNED") return "status amber";
  if (action === "DRIVER_CANCEL_REQUESTED") return "status amber";
  if (action === "DRIVER_CANCEL_APPROVED") return "status blue";
  if (action === "DRIVER_CANCEL_REJECTED") return "status red";
  if (action === "DRIVER_CANCELLED") return "status red";
  return "status";
}

function getDriverSummaryCreatedBy(log) {
  return log.assigned_by_name || log.created_by || log.updated_by || log.staff_name || "-";
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

function getStatusCategory(status) {
  const raw = String(status || "").trim();
  const normalized = raw.toUpperCase();
  const lower = raw.toLowerCase();

  if (normalized === "COMPLETED" || raw === "เสร็จสิ้น") return "completed";
  if (normalized === "APPROVED" || lower === "assigned" || raw === "อนุมัติแล้ว") return "approved";
  if (normalized === "IN_USE" || lower === "in_use" || raw === "กำลังใช้งาน") return "in_use";
  if (normalized === "CANCELLED" || lower === "cancelled" || lower === "canceled" || raw === "ยกเลิก") {
    return "cancelled";
  }
  return null;
}

function getStatusBadgeClass(status) {
  const category = getStatusCategory(status);
  if (category === "completed") return "status gray";
  if (category === "approved") return "status blue";
  if (category === "in_use") return "status green";
  if (category === "cancelled") return "status red";
  return "status";
}

function normalizeDriverName(name) {
  return String(name || "").trim();
}

function normalizeDriverId(id) {
  return String(id || "").trim();
}

function driverKeyFromId(id) {
  return `id:${id}`;
}

function driverKeyFromName(name) {
  return `name:${name}`;
}

function compareDriverUserIds(a, b) {
  const aId = normalizeDriverId(a.user_id);
  const bId = normalizeDriverId(b.user_id);

  if (aId && bId) {
    const byId = aId.localeCompare(bId, "en", { numeric: true, sensitivity: "base" });
    if (byId !== 0) return byId;
  } else if (aId) {
    return -1;
  } else if (bId) {
    return 1;
  }

  return a.name.localeCompare(b.name, "th");
}

function sortLatestFirst(items) {
  return [...items].sort((a, b) => {
    const dateA = parseBookingDate(a.created_at || a.updated_at || a.start_datetime)?.getTime() || 0;
    const dateB = parseBookingDate(b.created_at || b.updated_at || b.start_datetime)?.getTime() || 0;
    return dateB - dateA;
  });
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("odc_user") || "null");
  } catch {
    return null;
  }
}

function getDetailKey(booking, index) {
  return booking.log_id || `${booking.booking_id || "log"}-${index}`;
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

function ExportIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 15v3a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-3" />
    </Icon>
  );
}

function FilterIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
    </Icon>
  );
}

function ChevronDownIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

function ChevronRightIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}

function DetailIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="M2.25 12s3.75-7.5 9.75-7.5S21.75 12 21.75 12 18 19.5 12 19.5 2.25 12 2.25 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

function formatThaiDateTimeFull(value) {
  return formatThaiDateTime(value);
}

function SummaryPagination({ page, total, onChange, compact = false }) {
  if (total <= 1) return null;

  const baseClass = compact
    ? "inline-flex h-9 min-w-9 items-center justify-center rounded-xl border px-3 text-[13px] font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
    : "inline-flex h-9 min-w-12 items-center justify-center rounded-xl border px-3 text-[14px] font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50";
  const idleClass = "border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50";
  const activeClass = "border-blue-600 bg-blue-600 text-white";

  return (
    <div className={compact ? "mt-4 flex flex-wrap items-center justify-center gap-1.5" : "pagination"}>
      <button type="button" onClick={() => onChange(1)} disabled={page <= 1} className={`${baseClass} ${idleClass}`}>
        แรก
      </button>
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={`${baseClass} ${idleClass}`}
      >
        ก่อนหน้า
      </button>
      {Array.from({ length: total }).map((_, index) => {
        const current = index + 1;
        return (
          <button
            key={current}
            type="button"
            onClick={() => onChange(current)}
            className={`${baseClass} ${page === current ? activeClass : idleClass}`}
          >
            {current}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= total}
        className={`${baseClass} ${idleClass}`}
      >
        ถัดไป
      </button>
      <button
        type="button"
        onClick={() => onChange(total)}
        disabled={page >= total}
        className={`${baseClass} ${idleClass}`}
      >
        ท้าย
      </button>
    </div>
  );
}

const DriverSummaryTableRow = memo(function DriverSummaryTableRow({ row, onDetail }) {
  return (
    <tr>
      <td>
        <b>{row.name}</b>
      </td>
      <td>{row.todayCount}</td>
      <td>{row.weekCount}</td>
      <td>{row.monthCount}</td>
      <td>
        <b>{row.selectedCount}</b>
      </td>
      <td>
        {row.latest
          ? `${row.latest.booking_no || "-"} / ${formatThaiDateTime(
              row.latest.created_at || row.latest.updated_at || row.latest.start_datetime
            )}`
          : "-"}
      </td>
      <td>
        <button type="button" className="small-button" onClick={() => onDetail(row.key)}>
          รายละเอียด
        </button>
      </td>
    </tr>
  );
});

function DriverSummaryMobileCard({ row, index, isExpanded, onToggleExpand, onDetail }) {
  const latestLabel = row.latest
    ? `${row.latest.booking_no || "-"} / ${getDriverJobActionLabelV2(row.latest)}`
    : "-";

  return (
    <article className="driver-summary-mobile-card overflow-hidden rounded-[18px] border border-blue-600 bg-blue-600 shadow-sm">
      <button
        type="button"
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-3 text-left"
        aria-expanded={isExpanded}
        onClick={() => onToggleExpand(row.key)}
      >
        <div className="driver-summary-mobile-badge flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-1.5 text-[12px] font-semibold text-slate-700">
          {index}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold leading-5 text-white">{row.name}</div>
          <div className="truncate text-[12px] leading-4 text-blue-100">
            ช่วงที่เลือก {row.selectedCount} / วันนี้ {row.todayCount}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-right">
          <span className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
            {row.cardTotal}
          </span>
          <ChevronDownIcon
            className={[
              "h-4 w-4 shrink-0 text-white/80 transition-transform",
              isExpanded ? "rotate-180" : "",
            ].join(" ")}
          />
        </div>
      </button>

      {isExpanded ? (
        <div className="border-t border-blue-500/40 bg-white px-3 py-3">
          <div className="grid gap-2">
            <div className="driver-summary-mobile-compact-grid">
              <div className="driver-summary-mobile-mini-card driver-summary-mobile-mini-card--blue">
                <div className="driver-summary-mobile-mini-card-title text-blue-700">วันนี้</div>
                <div className="driver-summary-mobile-mini-card-value text-blue-700">{row.todayCount}</div>
              </div>
              <div className="driver-summary-mobile-mini-card driver-summary-mobile-mini-card--slate">
                <div className="driver-summary-mobile-mini-card-title text-slate-700">สัปดาห์นี้</div>
                <div className="driver-summary-mobile-mini-card-value text-slate-700">{row.weekCount}</div>
              </div>
              <div className="driver-summary-mobile-mini-card driver-summary-mobile-mini-card--indigo">
                <div className="driver-summary-mobile-mini-card-title text-indigo-700">เดือนนี้</div>
                <div className="driver-summary-mobile-mini-card-value text-indigo-700">{row.monthCount}</div>
              </div>
              <div className="driver-summary-mobile-mini-card driver-summary-mobile-mini-card--emerald">
                <div className="driver-summary-mobile-mini-card-title text-emerald-700">ช่วงที่เลือก</div>
                <div className="driver-summary-mobile-mini-card-value text-emerald-700">{row.selectedCount}</div>
              </div>
            </div>

            <div className="driver-summary-mobile-compact-grid">
              <div className="driver-summary-mobile-mini-card driver-summary-mobile-mini-card--green">
                <div className="driver-summary-mobile-mini-card-title text-green-700">เสร็จสิ้น</div>
                <div className="driver-summary-mobile-mini-card-value text-green-700">{row.completedCount}</div>
              </div>
              <div className="driver-summary-mobile-mini-card driver-summary-mobile-mini-card--amber">
                <div className="driver-summary-mobile-mini-card-title text-amber-700">รอออกเดินทาง</div>
                <div className="driver-summary-mobile-mini-card-value text-amber-700">{row.approvedCount}</div>
              </div>
              <div className="driver-summary-mobile-mini-card driver-summary-mobile-mini-card--sky">
                <div className="driver-summary-mobile-mini-card-title text-sky-700">กำลังใช้งาน</div>
                <div className="driver-summary-mobile-mini-card-value text-sky-700">{row.inUseCount}</div>
              </div>
              <div className="driver-summary-mobile-mini-card driver-summary-mobile-mini-card--red">
                <div className="driver-summary-mobile-mini-card-title text-red-700">ยกเลิก</div>
                <div className="driver-summary-mobile-mini-card-value text-red-700">{row.cancelledCount}</div>
              </div>
            </div>

            <div className="driver-summary-mobile-latest grid gap-0.5 rounded-xl bg-slate-50 p-2.5">
              <span className="text-[12px] font-semibold text-slate-500">งานล่าสุด</span>
              <span className="text-[14px] text-slate-800">{latestLabel}</span>
              {row.latest ? (
                <span className="text-[12px] text-slate-500">
                  {formatThaiDateTime(row.latest.created_at || row.latest.updated_at || row.latest.start_datetime)}
                </span>
              ) : null}
            </div>

            <button
              type="button"
              className="driver-summary-mobile-detail-button mobile-filter-button inline-flex items-center justify-center gap-1.5 border border-blue-200 bg-white shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
              onClick={() => onDetail(row.key)}
            >
              <DetailIcon className="h-4 w-4" />
              <span>รายละเอียด</span>
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function DriverSummary() {
  const [bookings, setBookings] = useState([]);
  const [jobLogs, setJobLogs] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [rangeMode, setRangeMode] = useState("today");
  const [customStart, setCustomStart] = useState(toDateInputValue(startOfMonth(new Date())));
  const [customEnd, setCustomEnd] = useState(toDateInputValue(new Date()));
  const [selectedDriver, setSelectedDriver] = useState("ALL");
  const [detailDriver, setDetailDriver] = useState(null);
  const [expandedDetailKey, setExpandedDetailKey] = useState("");
  const [detailModalPage, setDetailModalPage] = useState(1);
  const [expandedSummaryKey, setExpandedSummaryKey] = useState("");
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const canViewDriverSummary = hasPermission(null, "driver_summary_view");
  const visibleLoading = useMinimumLoading(loading, 350);

  const loadData = useCallback(async (options = {}) => {
    try {
      if (options.refreshOnly) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const [jobLogData, bookingData, userData] = await Promise.all([
        getDriverJobLogs(options.refreshOnly ? { fresh: true } : {}),
        getBookings(options.refreshOnly ? { fresh: true } : {}),
        getUsers().catch(() => []),
      ]);
      setJobLogs(Array.isArray(jobLogData) ? jobLogData : []);
      setBookings(Array.isArray(bookingData) ? bookingData : []);
      setDrivers(Array.isArray(userData) ? userData.filter((user) => normalizeRole(user.role) === "DRIVER") : []);
    } catch (err) {
      setError(err.message || "โหลดข้อมูลสรุปงานคนขับไม่สำเร็จ");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setTablePage(1);
    setExpandedSummaryKey("");
  }, [rangeMode, customStart, customEnd, selectedDriver]);

  useEffect(() => {
    setExpandedSummaryKey("");
    setIsMobileFilterOpen(false);
  }, [tablePage]);

  useEffect(() => {
    setDetailModalPage(1);
    setExpandedDetailKey("");
  }, [detailDriver]);

  const todayRange = useMemo(() => getRange("today"), []);
  const weekRange = useMemo(() => getRange("week"), []);
  const monthRange = useMemo(() => getRange("month"), []);
  const selectedRange = useMemo(() => getRange(rangeMode, customStart, customEnd), [rangeMode, customStart, customEnd]);

  const currentUser = useMemo(() => getCurrentUser(), []);
  const currentRole = normalizeRole(currentUser?.role);
  const cardScope = getDriverSummaryCardScope(currentRole);

  const driverOptions = useMemo(() => {
    const options = new Map();

    drivers.forEach((driver) => {
      const name = normalizeDriverName(driver.name);
      const driverId = normalizeDriverId(driver.user_id);
      if (!name) return;

      const key = driverId ? driverKeyFromId(driverId) : driverKeyFromName(name);
      options.set(key, { key, user_id: driverId, name });
    });

    return [...options.values()].sort(compareDriverUserIds);
  }, [drivers]);

  const driverRows = useMemo(() => {
    const driverByName = new Map();
    const driverById = new Map();

    driverOptions.forEach((driver) => {
      if (driver.name && !driverByName.has(driver.name)) driverByName.set(driver.name, driver.key);
      if (driver.user_id) driverById.set(driver.user_id, driver.key);
    });

    function getBookingDriverKey(booking) {
      const driverId = normalizeDriverId(booking.assigned_user_id || booking.driver_user_id);
      const assignedUserName = normalizeDriverName(booking.assigned_user_name);
      const driverName = normalizeDriverName(booking.driver_name);

      if (driverId && driverById.has(driverId)) return driverById.get(driverId);
      if (assignedUserName && driverByName.has(assignedUserName)) return driverByName.get(assignedUserName);
      if (driverName && driverByName.has(driverName)) return driverByName.get(driverName);
      return "";
    }

    const latestJobLogByBookingId = new Map();
    jobLogs.forEach((log) => {
      const bookingId = String(log.booking_id || "").trim();
      if (!bookingId) return;
      const currentTime = new Date(log.created_at || log.updated_at || 0).getTime();
      const existing = latestJobLogByBookingId.get(bookingId);
      const existingTime = existing ? new Date(existing.created_at || existing.updated_at || 0).getTime() : 0;
      if (!existing || currentTime >= existingTime) {
        latestJobLogByBookingId.set(bookingId, log);
      }
    });

    const statsByDriverKey = new Map();
    driverOptions.forEach((driver) => {
      statsByDriverKey.set(driver.key, {
        allDetailBookings: [],
        todayCount: 0,
        weekCount: 0,
        monthCount: 0,
        selectedCount: 0,
        latest: null,
        completedCount: 0,
        approvedCount: 0,
        inUseCount: 0,
        cancelledCount: 0,
      });
    });

    bookings.forEach((booking) => {
      const driverKey = getBookingDriverKey(booking);
      if (!driverKey) return;

      const stats = statsByDriverKey.get(driverKey);
      if (!stats) return;

      if (isPendingDriverCancel(booking)) {
        stats.cancelledCount += 1;
        return;
      }

      const category = getDriverWorkloadCategory(booking);
      if (!category) return;

      const bookingId = String(booking.booking_id || "").trim();
      const latestLog = bookingId ? latestJobLogByBookingId.get(bookingId) : null;
      const detailBooking = latestLog ? { ...latestLog, ...booking } : booking;

      stats.allDetailBookings.push(detailBooking);
      if (parseBookingDate(booking.created_at || booking.updated_at || booking.start_datetime) >= selectedRange.start &&
          parseBookingDate(booking.created_at || booking.updated_at || booking.start_datetime) <= selectedRange.end) {
        stats.selectedCount += 1;
      }
      if (parseBookingDate(booking.created_at || booking.updated_at || booking.start_datetime) >= todayRange.start &&
          parseBookingDate(booking.created_at || booking.updated_at || booking.start_datetime) <= todayRange.end) {
        stats.todayCount += 1;
      }
      if (parseBookingDate(booking.created_at || booking.updated_at || booking.start_datetime) >= weekRange.start &&
          parseBookingDate(booking.created_at || booking.updated_at || booking.start_datetime) <= weekRange.end) {
        stats.weekCount += 1;
      }
      if (parseBookingDate(booking.created_at || booking.updated_at || booking.start_datetime) >= monthRange.start &&
          parseBookingDate(booking.created_at || booking.updated_at || booking.start_datetime) <= monthRange.end) {
        stats.monthCount += 1;
      }

      if (category === "completed") stats.completedCount += 1;
      if (category === "approved") stats.approvedCount += 1;
      if (category === "in_use") stats.inUseCount += 1;

      const bookingTime = parseBookingDate(booking.created_at || booking.updated_at || booking.start_datetime)?.getTime() || 0;
      const latestTime = parseBookingDate(
        stats.latest?.created_at || stats.latest?.updated_at || stats.latest?.start_datetime
      )?.getTime() || 0;
      if (!stats.latest || bookingTime >= latestTime) {
        stats.latest = detailBooking;
      }
    });

    return driverOptions
      .map((driver) => {
        const stats = statsByDriverKey.get(driver.key) || {
          allDetailBookings: [],
          todayCount: 0,
          weekCount: 0,
          monthCount: 0,
          selectedCount: 0,
          latest: null,
          completedCount: 0,
          approvedCount: 0,
          inUseCount: 0,
          cancelledCount: 0,
        };
        const allDetailBookings = sortLatestFirst(stats.allDetailBookings);

        return {
          key: driver.key,
          user_id: driver.user_id,
          name: driver.name,
          todayCount: stats.todayCount,
          weekCount: stats.weekCount,
          monthCount: stats.monthCount,
          selectedCount: stats.selectedCount,
          latest: stats.latest,
          allDetailBookings,
          cardTotal: allDetailBookings.length,
          completedCount: stats.completedCount,
          approvedCount: stats.approvedCount,
          inUseCount: stats.inUseCount,
          cancelledCount: stats.cancelledCount,
        };
      })
      .filter((row) => selectedDriver === "ALL" || row.key === selectedDriver)
      .sort((a, b) => b.selectedCount - a.selectedCount || a.name.localeCompare(b.name, "th"));
  }, [bookings, driverOptions, jobLogs, monthRange, selectedDriver, selectedRange.end, selectedRange.start, todayRange.end, todayRange.start, weekRange.end, weekRange.start]);

  const visibleDriverRows = useMemo(() => {
    if (cardScope === "NONE") return [];

    const orderedRows = [...driverRows].sort(compareDriverUserIds);

    if (cardScope === "SELF") {
      const currentUserId = normalizeDriverId(currentUser?.user_id);
      return orderedRows.filter((row) => normalizeDriverId(row.user_id) === currentUserId);
    }

    return orderedRows;
  }, [cardScope, currentUser?.user_id, driverRows]);

  const driverCardRows = visibleDriverRows;

  const detailRow = useMemo(
    () => (detailDriver ? visibleDriverRows.find((row) => row.key === detailDriver) : null),
    [detailDriver, visibleDriverRows]
  );
  const detailModalTotalPages = useMemo(
    () => Math.max(1, Math.ceil((detailRow?.allDetailBookings.length || 0) / TABLE_PAGE_SIZE)),
    [detailRow]
  );
  const paginatedDetailBookings = useMemo(() => {
    if (!detailRow) return [];
    const startIndex = (detailModalPage - 1) * TABLE_PAGE_SIZE;
    return detailRow.allDetailBookings.slice(startIndex, startIndex + TABLE_PAGE_SIZE);
  }, [detailModalPage, detailRow]);
  const detailModalStart = detailRow?.allDetailBookings.length
    ? (detailModalPage - 1) * TABLE_PAGE_SIZE + 1
    : 0;
  const detailModalEnd = detailRow?.allDetailBookings.length
    ? Math.min(detailModalPage * TABLE_PAGE_SIZE, detailRow.allDetailBookings.length)
    : 0;

  const totalTablePages = useMemo(() => Math.max(1, Math.ceil(visibleDriverRows.length / TABLE_PAGE_SIZE)), [visibleDriverRows.length]);
  const paginatedDriverRows = useMemo(
    () => visibleDriverRows.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE),
    [visibleDriverRows, tablePage]
  );
  const mobileTotalDrivers = useMemo(() => visibleDriverRows.length, [visibleDriverRows.length]);
  const mobileTotalJobs = useMemo(() => visibleDriverRows.reduce((sum, row) => sum + row.cardTotal, 0), [visibleDriverRows]);
  const mobileCompletedJobs = useMemo(() => visibleDriverRows.reduce((sum, row) => sum + row.completedCount, 0), [visibleDriverRows]);
  const mobileInUseJobs = useMemo(() => visibleDriverRows.reduce((sum, row) => sum + row.inUseCount, 0), [visibleDriverRows]);

  const handleOpenDetail = useCallback((driverKey) => setDetailDriver(driverKey), []);
  const handleExportExcel = useCallback(() => {
    const summaryRows = visibleDriverRows.map((row) => ({
      คนขับ: row.name,
      วันนี้: row.todayCount,
      สัปดาห์นี้: row.weekCount,
      เดือนนี้: row.monthCount,
      รวมตามช่วงที่เลือก: row.selectedCount,
    }));

    const detailRows = visibleDriverRows.flatMap((row) =>
      (row.allDetailBookings || []).map((booking) => ({
        คนขับ: row.name,
        ผู้จอง: booking.requester_name || "-",
        เวลาไป: booking.start_datetime ? formatThaiDateTime(booking.start_datetime) : "-",
        เวลากลับ: booking.end_datetime ? formatThaiDateTime(booking.end_datetime) : "-",
        ปลายทาง: booking.destination || "-",
        สถานะ: getDriverJobActionLabelV2(booking),
        หมายเหตุ: getDriverJobActionDescriptionV2(booking),
      }))
    );

    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    const detailSheet = XLSX.utils.json_to_sheet(detailRows);

    XLSX.utils.book_append_sheet(workbook, summarySheet, "สรุปงานคนขับ");
    XLSX.utils.book_append_sheet(workbook, detailSheet, "รายละเอียดงาน");

    XLSX.writeFile(workbook, `driver-summary-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [visibleDriverRows]);

  if (!canViewDriverSummary) {
    return <div className="form-card text-slate-700">คุณไม่มีสิทธิ์เข้าถึงสรุปงานคนขับ</div>;
  }

  return (
    <AppLayout title="สรุปงานคนขับ" hideMobileHeader hideDesktopHeader hideDesktopSidebar mobileTopOffset={57}>
      <div className="driver-summary-desktop flex w-full flex-col gap-2 pb-6">
      <div className="hidden md:block">
        <div className="page-header rounded-3xl border border-sky-100 bg-white px-4 py-4 shadow-sm sm:px-5 lg:px-7">
          <div>
            <h2>สรุปงานคนขับ</h2>
            <p>นับจำนวนงานจากรายการจองที่อนุมัติแล้ว กำลังใช้งาน และเสร็จสิ้น</p>
          </div>

          <div className="section-toolbar gap-3">
            <button
              type="button"
              className="warning-button"
              disabled={visibleDriverRows.length === 0}
              onClick={handleExportExcel}
            >
              Export Excel
            </button>
            <button type="button" disabled={refreshing || loading} onClick={() => loadData({ refreshOnly: true })}>
              รีเฟรชข้อมูล
            </button>
          </div>
        </div>

        {!loading && !error && cardScope !== "NONE" && (
          <div className="driver-summary-card-grid rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
            {driverCardRows.map((row) => (
              <div className="driver-summary-card rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm" key={row.key}>
                <div className="driver-summary-card-header gap-3">
                  <h3>{row.name}</h3>
                  <strong>{row.cardTotal}</strong>
                </div>
                <div className="driver-summary-card-stats gap-3">
                  <div className="driver-summary-stat blue-box">
                    <span>งานทั้งหมด</span>
                    <b>{row.cardTotal}</b>
                  </div>
                  <div className="driver-summary-stat gray-box">
                    <span>ขับแล้ว / เสร็จแล้ว</span>
                    <b>{row.completedCount}</b>
                  </div>
                  <div className="driver-summary-stat amber-box">
                    <span>ยังไม่ขับ / รอออกเดินทาง</span>
                    <b>{row.approvedCount}</b>
                  </div>
                  <div className="driver-summary-stat green-box">
                    <span>กำลังขับ / กำลังใช้งาน</span>
                    <b>{row.inUseCount}</b>
                  </div>
                  <div className="driver-summary-stat red-box">
                    <span>ยกเลิก</span>
                    <b>{row.cancelledCount}</b>
                  </div>
                </div>
                <div className="driver-summary-cancelled">ยกเลิก {row.cancelledCount} งาน</div>
                <div className="driver-summary-latest">
                  <b>งานล่าสุด</b>
                  <span>
                    {row.latest
                      ? `${row.latest.booking_no || "-"} / ${getDriverJobActionLabelV2(row.latest)} / ${formatThaiDateTime(
                          row.latest.created_at || row.latest.updated_at || row.latest.start_datetime
                        )}`
                      : "-"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="form-card">
          <h3>ตัวกรองรายงาน</h3>
          <div className="driver-summary-filters">
            <div>
              <label>ช่วงข้อมูล</label>
              <div className="segmented-control">
                <button type="button" className={rangeMode === "today" ? "active" : ""} onClick={() => setRangeMode("today")}>
                  วันนี้
                </button>
                <button type="button" className={rangeMode === "week" ? "active" : ""} onClick={() => setRangeMode("week")}>
                  สัปดาห์นี้
                </button>
                <button type="button" className={rangeMode === "month" ? "active" : ""} onClick={() => setRangeMode("month")}>
                  เดือนนี้
                </button>
                <button type="button" className={rangeMode === "custom" ? "active" : ""} onClick={() => setRangeMode("custom")}>
                  เลือกเอง
                </button>
              </div>
            </div>
            <div>
              <label>จากวันที่</label>
              <input type="date" value={customStart} disabled={rangeMode !== "custom"} onChange={(e) => setCustomStart(e.target.value)} />
            </div>
            <div>
              <label>ถึงวันที่</label>
              <input type="date" value={customEnd} disabled={rangeMode !== "custom"} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
            <div>
              <label>คนขับ</label>
              <select value={selectedDriver} onChange={(e) => setSelectedDriver(e.target.value)}>
                <option value="ALL">คนขับทั้งหมด</option>
                {driverOptions.map((driver) => (
                  <option key={driver.key} value={driver.key}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="form-card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-2">
            <div>
              <h3>ตารางสรุปรายงานรายละเอียดงาน</h3>
              <div className="section-counter">
                {selectedRange.label}: {formatThaiDateTime(selectedRange.start)} - {formatThaiDateTime(selectedRange.end)}
              </div>
            </div>
            <button type="button" className="success-button" disabled={visibleDriverRows.length === 0} onClick={handleExportExcel}>
              Export Excel
            </button>
          </div>

          {visibleLoading && <PageSkeleton />}
          {error && !visibleLoading && <p className="driver-summary-error">{error}</p>}

          {!visibleLoading && !error && (
            <div className="table-wrap rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table>
                <thead>
                  <tr>
                    <th>คนขับ</th>
                    <th>วันนี้</th>
                    <th>สัปดาห์นี้</th>
                    <th>เดือนนี้</th>
                    <th>รวมตามช่วงที่เลือก</th>
                    <th>งานล่าสุด</th>
                    <th>รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDriverRows.map((row) => (
                    <DriverSummaryTableRow key={row.key} row={row} onDetail={handleOpenDetail} />
                  ))}
                  {visibleDriverRows.length === 0 && (
                    <tr>
                      <td colSpan="7">ไม่พบข้อมูลคนขับสำหรับรายงาน</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {visibleDriverRows.length > TABLE_PAGE_SIZE && (
                <div className="pagination">
                  <button type="button" disabled={tablePage === 1} onClick={() => setTablePage((page) => Math.max(1, page - 1))}>
                    ก่อนหน้า
                  </button>
                  {Array.from({ length: totalTablePages }).map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      className={tablePage === index + 1 ? "active-page" : ""}
                      onClick={() => setTablePage(index + 1)}
                    >
                      {index + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={tablePage === totalTablePages}
                    onClick={() => setTablePage((page) => Math.min(totalTablePages, page + 1))}
                  >
                    ถัดไป
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="block md:hidden">
        <div className="driver-summary-mobile flex w-full flex-col gap-0 pb-6">
          <MobilePageHeader
            title="สรุปงานคนขับ"
            subtitle="นับจำนวนงานจากรายการจองที่อนุมัติแล้ว กำลังใช้งาน และเสร็จสิ้น"
            actions={
              <>
                <button
                  type="button"
                  className="mobile-filter-button inline-flex items-center gap-1.5 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                  disabled={refreshing || loading}
                  onClick={() => loadData({ refreshOnly: true })}
                >
                  <RefreshIcon className="h-4 w-4" />
                  <span>รีเฟรช</span>
                </button>
                <button
                  type="button"
                  className="mobile-action-button inline-flex items-center gap-1.5 border border-emerald-200 bg-emerald-600 shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={visibleDriverRows.length === 0}
                  onClick={handleExportExcel}
                >
                  <ExportIcon className="h-4 w-4" />
                  <span>Export</span>
                </button>
              </>
            }
          />
          <MobilePageSection
            title="ตัวกรองข้อมูล"
            subtitle="เลือกช่วงเวลาและคนขับที่ต้องการดู"
            actions={
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen((current) => !current)}
                aria-expanded={isMobileFilterOpen}
                className="mobile-action-button inline-flex items-center gap-1.5 border border-blue-600 bg-blue-600 shadow-sm transition hover:bg-blue-700"
              >
                <FilterIcon className="h-4 w-4 text-white" />
                <span>{isMobileFilterOpen ? "ซ่อน" : "ตัวกรอง"}</span>
              </button>
            }
          >
            {isMobileFilterOpen ? (
              <div className="grid gap-3">
                <div className="driver-summary-mobile-range-grid">
                  {[
                    ["today", "วันนี้"],
                    ["week", "สัปดาห์นี้"],
                    ["month", "เดือนนี้"],
                    ["custom", "เลือกเอง"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={[
                        "driver-summary-mobile-range-button",
                        rangeMode === value ? "driver-summary-mobile-range-button--active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setRangeMode(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid gap-2">
                  <label className="grid gap-1.5">
                    <span className="text-[12px] font-semibold text-slate-600">วันที่เริ่ม</span>
                    <input
                      type="date"
                      value={customStart}
                      disabled={rangeMode !== "custom"}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="driver-summary-mobile-input"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[12px] font-semibold text-slate-600">วันที่สิ้นสุด</span>
                    <input
                      type="date"
                      value={customEnd}
                      disabled={rangeMode !== "custom"}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="driver-summary-mobile-input"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[12px] font-semibold text-slate-600">คนขับ</span>
                    <select
                      value={selectedDriver}
                      onChange={(e) => setSelectedDriver(e.target.value)}
                      className="driver-summary-mobile-select"
                    >
                      <option value="ALL">คนขับทั้งหมด</option>
                      {driverOptions.map((driver) => (
                        <option key={driver.key} value={driver.key}>
                          {driver.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-semibold text-slate-500">
                    ช่วงที่เลือก: {selectedRange.label}
                  </span>
                  <button
                    type="button"
                    className="mobile-filter-button ml-auto"
                    onClick={() => {
                      setRangeMode("today");
                      setCustomStart(toDateInputValue(startOfMonth(new Date())));
                      setCustomEnd(toDateInputValue(new Date()));
                      setSelectedDriver("ALL");
                    }}
                  >
                    ล้างตัวกรอง
                  </button>
                </div>
              </div>
            ) : null}
          </MobilePageSection>

          <MobilePageSection
            title="รายการสรุปคนขับ"
            subtitle={`${selectedRange.label}: ${formatThaiDateTimeFull(selectedRange.start)} - ${formatThaiDateTimeFull(selectedRange.end)}`}

            actions={
              <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 items-center
justify-center">
                หน้า {tablePage}/{totalTablePages}
              </span>
            }
          >
            <div className="grid gap-1.5">
              {visibleLoading ? (
                <div className="mobile-empty-state">
                  <span className="text-sm font-medium text-slate-600">กำลังโหลดสรุปงานคนขับ...</span>
                </div>
              ) : error ? (
                <div className="mobile-empty-state">
                  <span className="text-sm font-medium text-red-700">{error}</span>
                </div>
              ) : paginatedDriverRows.length === 0 ? (
                <div className="mobile-empty-state">
                  <span className="text-sm font-medium text-slate-600">ไม่พบข้อมูลคนขับสำหรับรายงาน</span>
                </div>
              ) : (
                paginatedDriverRows.map((row, index) => (
                  <DriverSummaryMobileCard
                    key={row.key}
                    row={row}
                    index={(tablePage - 1) * TABLE_PAGE_SIZE + index + 1}
                    isExpanded={expandedSummaryKey === row.key}
                    onToggleExpand={(driverKey) => setExpandedSummaryKey((current) => (current === driverKey ? "" : driverKey))}
                    onDetail={handleOpenDetail}
                  />
                ))
              )}
            </div>

            <SummaryPagination page={tablePage} total={totalTablePages} onChange={setTablePage} compact />
          </MobilePageSection>
        </div>
      </div>

      {detailRow && (
        <div
          className="driver-summary-modal-backdrop"
          onClick={() => {
            setExpandedDetailKey("");
            setDetailDriver(null);
          }}
        >
          <div
            className="driver-summary-modal w-[92vw] max-w-[92vw] overflow-x-hidden p-4 sm:p-5 md:w-full md:max-w-[1200px] md:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="driver-summary-modal-header mb-4 gap-3 md:mb-5 md:gap-5">
              <div className="min-w-0 flex-1">
                <h3 className="text-[22px] leading-tight break-words md:text-[38px]">รายละเอียดงาน: {detailRow.name}</h3>
                <p className="mt-1 text-[15px] leading-6 md:mt-2 md:text-base">
                  รวมทั้งหมด {detailRow.allDetailBookings.length} งาน
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-[16px] font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                onClick={() => {
                  setExpandedDetailKey("");
                  setDetailDriver(null);
                }}
              >
                ปิด
              </button>
            </div>

            {detailRow.allDetailBookings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-[15px] font-medium text-slate-600 md:px-5 md:py-6 md:text-base">
                ไม่พบงานของคนขับคนนี้
              </div>
            ) : (
              <>
                <div className="table-wrap hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
                  <table>
                    <thead>
                      <tr>
                        <th>ลำดับ</th>
                        <th>ผู้จอง</th>
                        <th>เวลาไป</th>
                        <th>เวลากลับ</th>
                        <th>ปลายทาง</th>
                        <th>รายละเอียด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailRow.allDetailBookings.map((booking, index) => {
                        const detailKey = getDetailKey(booking, index);
                        const expanded = expandedDetailKey === detailKey;

                        return (
                          <Fragment key={detailKey}>
                            <tr>
                              <td>{index + 1}</td>
                              <td>{booking.requester_name || "-"}</td>
                              <td>{booking.start_datetime ? formatThaiDateTime(booking.start_datetime) : "-"}</td>
                              <td>{booking.end_datetime ? formatThaiDateTime(booking.end_datetime) : "-"}</td>
                              <td>{booking.destination || "-"}</td>
                              <td>
                                <button
                                  type="button"
                                  className="small-button"
                                  onClick={() => setExpandedDetailKey(expanded ? "" : detailKey)}
                                >
                                  {expanded ? "ย่อรายละเอียด" : "ขยายรายละเอียด"}
                                </button>
                              </td>
                            </tr>
                            {expanded && (
                              <tr className="driver-summary-detail-row">
                                <td colSpan="5">
                                  <div className="driver-summary-log-detail-table-wrap">
                                    <table className="driver-summary-log-detail-table">
                                      <thead>
                                        <tr>
                                          <th>สถานะ</th>
                                          <th>หมายเหตุ</th>
                                          <th>ผู้บันทึก</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        <tr>
                                          <td>
                                            <span className={getDriverJobActionClassV2(booking)}>
                                              {getDriverJobActionLabelV2(booking)}
                                            </span>
                                          </td>
                                          <td style={{ whiteSpace: "pre-line" }}>{getDriverJobActionDescriptionV2(booking)}</td>
                                          <td>{getDriverSummaryCreatedBy(booking)}</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="block md:hidden">
                  <div className="mb-3 text-center text-[15px] font-medium text-slate-600">
                    แสดง {detailModalStart} - {detailModalEnd} จาก {detailRow.allDetailBookings.length} งาน
                  </div>
                  <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
                  {paginatedDetailBookings.map((booking, index) => {
                    const absoluteIndex = detailModalStart + index;
                    const detailIndex = (detailModalPage - 1) * TABLE_PAGE_SIZE + index;
                    const noteText = String(getDriverJobActionDescriptionV2(booking) || "").trim();
                    const hasNote = noteText && noteText !== "-";

                    return (
                      <div
                        key={getDetailKey(booking, detailIndex)}
                        className="rounded-2xl border border-blue-200 bg-white p-3 shadow-sm"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[15px] font-semibold text-slate-500">ลำดับ {absoluteIndex}</div>
                            <div className="mt-1 break-words text-[16px] font-semibold leading-6 text-slate-900">
                              {booking.requester_name || "-"}
                            </div>
                          </div>
                          <span className={`${getStatusBadgeClass(booking.status)} text-[15px]`}>
                            {getStatusLabel(booking.status)}
                          </span>
                        </div>

                        <div className="grid gap-2 text-[15px] leading-6 text-slate-800">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="text-[15px] font-medium text-slate-500">เวลาไป</div>
                            <div className="break-words font-semibold text-slate-900">
                              {booking.start_datetime ? formatThaiDateTime(booking.start_datetime) : "-"}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="text-[15px] font-medium text-slate-500">เวลากลับ</div>
                            <div className="break-words font-semibold text-slate-900">
                              {booking.end_datetime ? formatThaiDateTime(booking.end_datetime) : "-"}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="text-[15px] font-medium text-slate-500">ปลายทาง</div>
                            <div className="break-words font-semibold text-slate-900">{booking.destination || "-"}</div>
                          </div>
                          {hasNote ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <div className="text-[15px] font-medium text-slate-500">หมายเหตุ</div>
                              <div className="whitespace-pre-line break-words font-semibold text-slate-900">{noteText}</div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                  <SummaryPagination
                    page={detailModalPage}
                    total={detailModalTotalPages}
                    onChange={setDetailModalPage}
                    compact
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </div>
    </AppLayout>
  );
}
