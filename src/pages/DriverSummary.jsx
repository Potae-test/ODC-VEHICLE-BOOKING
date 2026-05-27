import { Fragment, memo, useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { getBookings, getDriverJobLogs, getUsers } from "../api";
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
  const latestStatus = row.latest ? getStatusCategory(row.latest.status) || getDriverJobActionCategoryV2(row.latest) || "approved" : "";

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 text-left"
        aria-expanded={isExpanded}
        onClick={() => onToggleExpand(row.key)}
      >
        <div className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[12px] font-semibold text-slate-700">
          {index}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-slate-900">{row.name}</div>
          <div className="truncate text-[12px] text-slate-500">
            งานเดือนนี้ {row.monthCount} / ช่วงที่เลือก {row.selectedCount}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-right">
          <div className="grid gap-0.5">
            <span className="text-[11px] font-semibold text-slate-500">วันนี้</span>
            <span className="text-[13px] font-semibold text-slate-900">{row.todayCount}</span>
          </div>
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
            {row.cardTotal}
          </span>
          <ChevronDownIcon
            className={[
              "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform",
              isExpanded ? "rotate-180" : "",
            ].join(" ")}
          />
        </div>
      </button>

      {isExpanded ? (
        <div className="border-t border-slate-100 px-3 py-2.5">
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 p-2">
                <div className="text-[12px] font-semibold text-slate-500">วันนี้</div>
                <div className="text-[15px] font-semibold text-slate-900">{row.todayCount}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2">
                <div className="text-[12px] font-semibold text-slate-500">สัปดาห์นี้</div>
                <div className="text-[15px] font-semibold text-slate-900">{row.weekCount}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2">
                <div className="text-[12px] font-semibold text-slate-500">เดือนนี้</div>
                <div className="text-[15px] font-semibold text-slate-900">{row.monthCount}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2">
                <div className="text-[12px] font-semibold text-slate-500">ช่วงที่เลือก</div>
                <div className="text-[15px] font-semibold text-slate-900">{row.selectedCount}</div>
              </div>
            </div>

            <div className="grid gap-0.5 rounded-xl bg-slate-50 p-2">
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
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
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

  const totalTablePages = useMemo(() => Math.max(1, Math.ceil(visibleDriverRows.length / TABLE_PAGE_SIZE)), [visibleDriverRows.length]);
  const paginatedDriverRows = useMemo(
    () => visibleDriverRows.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE),
    [visibleDriverRows, tablePage]
  );

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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 pb-6 mt-15">
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
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
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="min-w-0 truncate text-[22px] font-bold leading-tight text-blue-950">สรุปงานคนขับ</h2>
              <p className="mt-0.5 text-[12px] leading-4 text-slate-500">
                นับจำนวนงานจากรายการจองที่อนุมัติแล้ว กำลังใช้งาน และเสร็จสิ้น
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                disabled={refreshing || loading}
                onClick={() => loadData({ refreshOnly: true })}
              >
                <RefreshIcon className="h-4 w-4" />
                <span>รีเฟรช</span>
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={visibleDriverRows.length === 0}
                onClick={handleExportExcel}
              >
                <ExportIcon className="h-4 w-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <button
            type="button"
            onClick={() => setIsMobileFilterOpen((current) => !current)}
            className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            aria-expanded={isMobileFilterOpen}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <FilterIcon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-slate-900">ตัวกรองข้อมูล</div>
                <div className="text-[11px] leading-4 text-slate-500">คัดช่วงเวลาและเลือกคนขับที่ต้องการดู</div>
              </div>
            </div>
            <ChevronRightIcon
              className={[
                "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform",
                isMobileFilterOpen ? "rotate-90" : "",
              ].join(" ")}
            />
          </button>

          {isMobileFilterOpen ? (
            <div className="mt-2 grid gap-2 rounded-xl bg-slate-50/80 p-3">
              <div className="grid gap-2">
                <label className="grid gap-1">
                  <span className="text-[12px] font-semibold text-slate-600">ช่วงเวลา</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["today", "วันนี้"],
                      ["week", "สัปดาห์นี้"],
                      ["month", "เดือนนี้"],
                      ["custom", "เลือกเอง"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={`h-10 rounded-xl border px-3 text-sm font-semibold shadow-sm ${
                          rangeMode === value
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-300 bg-white text-slate-700"
                        }`}
                        onClick={() => setRangeMode(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </label>

                <div className="grid gap-2">
                  <label className="grid gap-1">
                    <span className="text-[12px] font-semibold text-slate-600">วันที่เริ่ม</span>
                    <input
                      type="date"
                      value={customStart}
                      disabled={rangeMode !== "custom"}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[12px] font-semibold text-slate-600">วันที่สิ้นสุด</span>
                    <input
                      type="date"
                      value={customEnd}
                      disabled={rangeMode !== "custom"}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[12px] font-semibold text-slate-600">คนขับ</span>
                    <select
                      value={selectedDriver}
                      onChange={(e) => setSelectedDriver(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
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
              </div>

              <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[12px] font-semibold text-slate-500">
                  ช่วงที่เลือก {selectedRange.label}
                </span>
                <button
                  type="button"
                  className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 sm:w-auto"
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
        </div>

        <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-slate-900">สรุปงานคนขับ</div>
              <div className="text-[12px] leading-4 text-slate-500">
                {selectedRange.label}: {formatThaiDateTime(selectedRange.start)} - {formatThaiDateTime(selectedRange.end)}
              </div>
            </div>
            <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
              หน้า {tablePage}/{totalTablePages}
            </span>
          </div>

          <div className="grid gap-1.5">
            {visibleLoading ? (
              <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center">
                <span className="text-sm font-medium text-slate-600">กำลังโหลดสรุปงานคนขับ...</span>
              </div>
            ) : error ? (
              <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-red-200 px-4 py-5 text-center">
                <span className="text-sm font-medium text-red-700">{error}</span>
              </div>
            ) : paginatedDriverRows.length === 0 ? (
              <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center">
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
          <div className="driver-summary-modal" onClick={(e) => e.stopPropagation()}>
            <div className="driver-summary-modal-header">
              <div>
                <h3>รายละเอียดงาน: {detailRow.name}</h3>
                <p>รวมทั้งหมด {detailRow.allDetailBookings.length} งาน</p>
              </div>
              <button
                type="button"
                className="small-button"
                onClick={() => {
                  setExpandedDetailKey("");
                  setDetailDriver(null);
                }}
              >
                ปิด
              </button>
            </div>

            <div className="table-wrap rounded-2xl border border-slate-200 bg-white shadow-sm">
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

                  {detailRow.allDetailBookings.length === 0 && (
                    <tr>
                      <td colSpan="5">ไม่พบงานของคนขับคนนี้</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
