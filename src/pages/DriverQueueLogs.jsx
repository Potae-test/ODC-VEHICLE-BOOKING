import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import Swal from "sweetalert2";
import { deleteDriverQueueLog, getBookings, getDriverQueueLogs } from "../api";
import MobilePageHeader from "../layouts/MobilePageHeader";
import MobilePageSection from "../layouts/MobilePageSection";
import useIsMobile from "../hooks/useIsMobile";
import { formatThaiDateTime } from "../utils/date";
import { showConfirm, showError, showSuccess } from "../utils/alert";

const ROWS_PER_PAGE = 5;
const DESKTOP_COLUMN_COUNT = 10;

function sortLatestFirst(items) {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return dateB - dateA;
  });
}

function getAssignModeLabel(mode) {
  const normalized = String(mode || "").trim().toUpperCase();
  if (normalized === "AUTO_RECOMMENDED") return "ระบบจัดการให้";
  if (normalized === "MANUAL_OVERRIDE") return "เลือกเอง";
  if (normalized === "SKIPPED_UNAVAILABLE") return "ข้ามเพราะไม่ว่าง";
  if (normalized === "SKIPPED_BUSY") return "ข้ามเพราะติดภารกิจ";
  return mode || "-";
}

function getAssignModeBadge(mode) {
  const normalized = String(mode || "").trim().toUpperCase();
  if (normalized === "AUTO_RECOMMENDED") {
    return {
      label: "ระบบจัดการให้",
      className: "bg-blue-100 text-blue-700 border-blue-200",
    };
  }

  if (normalized === "MANUAL_OVERRIDE") {
    return {
      label: "เลือกเอง",
      className: "bg-amber-100 text-amber-700 border-amber-200",
    };
  }

  return {
    label: "ข้าม",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  };
}

function parseSkippedDrivers(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item, index) => ({
      id: String(item.driver_user_id || item.user_id || item.driver_id || item.name || item.driver_name || index),
      name: String(item.driver_name || item.name || "-").trim() || "-",
      reason: String(item.reason || "-").trim() || "-",
    }));
  } catch {
    return [
      {
        id: raw,
        name: raw,
        reason: "-",
      },
    ];
  }
}

function getSkippedDriversSummary(value) {
  const items = parseSkippedDrivers(value);
  if (items.length === 0) return "-";
  return items.map((item) => `${item.name} (${item.reason})`).join(" | ");
}

function getPageWindow(page, totalPages) {
  const visibleCount = Math.min(5, totalPages);
  if (totalPages <= visibleCount) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  let start = Math.max(1, page - 2);
  let end = start + visibleCount - 1;

  if (end > totalPages) {
    end = totalPages;
    start = end - visibleCount + 1;
  }

  return Array.from({ length: visibleCount }, (_, index) => start + index);
}

function formatMobileShortDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")} ${String(
    date.getHours()
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatBookingDetailValue(value) {
  return value ? formatThaiDateTime(value) : "-";
}

function getBookingDetailGroups(booking) {
  return [
    {
      title: "ข้อมูลผู้จอง",
      rows: [
        { label: "เลขที่จอง", value: booking.booking_no || booking.booking_id || "-" },
        { label: "ผู้จอง", value: booking.requester_name || "-" },
        { label: "หน่วยงาน", value: booking.department || "-" },
        { label: "เบอร์โทร", value: booking.phone || "-" },
      ],
    },
    {
      title: "ข้อมูลการเดินทาง",
      rows: [
        { label: "เวลาไป", value: formatBookingDetailValue(booking.start_datetime) },
        { label: "เวลากลับ", value: formatBookingDetailValue(booking.end_datetime) },
        { label: "ปลายทาง", value: booking.destination || "-" },
        { label: "รายละเอียด", value: booking.purpose || "-" },
      ],
    },
    {
      title: "การมอบหมายงาน",
      rows: [
        { label: "คนขับ", value: booking.assigned_user_name || booking.driver_name || "-" },
        { label: "สถานะ", value: booking.status || "-" },
        { label: "หมายเหตุ", value: booking.staff_note || "-" },
      ],
    },
    {
      title: "ข้อมูลระบบ",
      rows: [
        { label: "booking_id", value: booking.booking_id || "-" },
        { label: "สร้างเมื่อ", value: formatBookingDetailValue(booking.created_at) },
        { label: "อัปเดตเมื่อ", value: formatBookingDetailValue(booking.updated_at) },
      ],
    },
  ];
}

const ASSIGN_MODE_OPTIONS = [
  { value: "", label: "ทั้งหมด" },
  { value: "AUTO_RECOMMENDED", label: "ระบบจัดการให้" },
  { value: "MANUAL_OVERRIDE", label: "เลือกเอง" },
  { value: "SKIPPED_UNAVAILABLE", label: "ข้ามเพราะไม่ว่าง" },
  { value: "SKIPPED_BUSY", label: "ข้ามเพราะติดภารกิจ" },
];

function EyeIcon({ className = "" }) {
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
      <path d="M2.25 12s3.75-7.5 9.75-7.5S21.75 12 21.75 12 18 19.5 12 19.5 2.25 12 2.25 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ChevronDownIcon({ className = "" }) {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function FilterField({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  as = "input",
  options = [],
  labelClassName = "text-[20px] font-semibold text-slate-600",
  inputClassName = "h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-[20px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100",
}) {
  return (
    <label className="grid gap-1.5">
      <span className={labelClassName}>{label}</span>
      {as === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClassName}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClassName}
        />
      )}
    </label>
  );
}

function Pagination({ page, totalPages, totalItems, onChangePage }) {
  const pageNumbers = getPageWindow(page, totalPages);
  const startItem = totalItems === 0 ? 0 : (page - 1) * ROWS_PER_PAGE + 1;
  const endItem = Math.min(page * ROWS_PER_PAGE, totalItems);

  return (
    <div className="booking-pagination-wrapper mt-4">
      <div className="booking-pagination-info">
        แสดง {startItem} - {endItem} จาก {totalItems} รายการ
      </div>
      <div className="pagination booking-pagination">
        <button type="button" onClick={() => onChangePage(1)} disabled={page <= 1} style={{ fontSize: 16 }}>
          แรก
        </button>
        <button
          type="button"
          onClick={() => onChangePage(Math.max(1, page - 1))}
          disabled={page <= 1}
          style={{ fontSize: 16 }}
        >
          ก่อนหน้า
        </button>
        {pageNumbers.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onChangePage(pageNumber)}
            className={pageNumber === page ? "active-page" : ""}
            style={{ fontSize: 16 }}
          >
            {pageNumber}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChangePage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          style={{ fontSize: 16 }}
        >
          ถัดไป
        </button>
        <button
          type="button"
          onClick={() => onChangePage(totalPages)}
          disabled={page >= totalPages}
          style={{ fontSize: 16 }}
        >
          ท้าย
        </button>
      </div>
    </div>
  );
}

function QueueExplanationCard() {
  return (
    <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
      <p className="mt-1 leading-8 text-slate-700" style={{ fontSize: 20 }}>
        แสดงประวัติการเลือกคนขับของแต่ละรายการจอง ว่าระบบจัดการให้ใคร เลือกจริงเป็นใคร และมีการข้ามคิวเพราะเหตุผลใด
      </p>
      <div className="mt-4 rounded-2xl border border-white/80 bg-white/90 p-4">
        <div className="font-bold  text-slate-900" style={{ fontSize: 23 }}>
          คำอธิบาย:
        </div>
        <ul className="mt-2 grid gap-2 leading-8 text-slate-600" style={{ fontSize: 22 }}>
          <li>- “คนขับที่ระบบจัดการให้” คือคนขับที่ระบบเลือกตามคิว</li>
          <li>- “คนขับที่เลือกจริง” คือคนขับที่ถูกมอบหมายจริง</li>
          <li>- “คิวก่อนหน้า/คิวถัดไป” ใช้สำหรับตรวจสอบลำดับคิวในขณะนั้น</li>
          <li>- “รายการที่ข้าม” คือคนขับที่ถูกข้ามพร้อมเหตุผล</li>
        </ul>
      </div>
    </div>
  );
}

function BookingDetailModalContent({ booking }) {
  const groups = getBookingDetailGroups(booking);

  return (
    <div className="booking-detail-modal">
      <div className="booking-detail-group-list">
        {groups.map((group) => (
          <section key={group.title} className="booking-detail-group">
            <h3 className="booking-detail-group-title">{group.title}</h3>
            {group.rows.map((row) => (
              <div key={`${group.title}-${row.label}`} className="booking-detail-row">
                <span className="booking-detail-label">{row.label}</span>
                <span className="booking-detail-value">{row.value || "-"}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function MobileInfoRow({ label, value }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "92px minmax(0, 1fr)",
        gap: "6px 12px",
        alignItems: "start",
        minWidth: 0,
      }}
    >
      <span className="text-slate-600" style={{ fontSize: 20, lineHeight: 1.35, fontWeight: 700 }}>
        {label}
      </span>
      <div className="min-w-0 text-slate-900" style={{ fontSize: 20, lineHeight: 1.45, wordBreak: "break-word" }}>
        {value}
      </div>
    </div>
  );
}

export default function DriverQueueLogs() {
  const isMobile = useIsMobile();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [expandedRowId, setExpandedRowId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [detailLoadingKey, setDetailLoadingKey] = useState("");
  const [cachedBookings, setCachedBookings] = useState([]);
  const [filters, setFilters] = useState({
    keyword: "",
    assignMode: "",
    createdBy: "",
  });

  async function loadData(options = {}) {
    try {
      if (options.refreshOnly) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const data = await getDriverQueueLogs(options.refreshOnly ? { fresh: true } : {});
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err.message || "โหลดข้อมูลไม่สำเร็จ";
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const sortedLogs = useMemo(() => sortLatestFirst(Array.isArray(logs) ? logs : []), [logs]);

  const filteredLogs = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    const assignMode = String(filters.assignMode || "").trim().toUpperCase();
    const createdBy = filters.createdBy.trim().toLowerCase();

    return sortedLogs.filter((log) => {
      if (assignMode && String(log.assign_mode || "").trim().toUpperCase() !== assignMode) {
        return false;
      }

      if (createdBy && !String(log.created_by || "").toLowerCase().includes(createdBy)) {
        return false;
      }

      if (keyword) {
        const haystack = [
          log.booking_no,
          log.booking_id,
          log.recommended_driver_name,
          log.assigned_driver_name,
          log.reason,
          log.created_by,
          getSkippedDriversSummary(log.skipped_drivers_json),
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");

        if (!haystack.includes(keyword)) {
          return false;
        }
      }

      return true;
    });
  }, [filters, sortedLogs]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredLogs.length / ROWS_PER_PAGE)), [filteredLogs.length]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return filteredLogs.slice(start, start + ROWS_PER_PAGE);
  }, [filteredLogs, page]);

  useEffect(() => {
    setPage(1);
    setExpandedRowId("");
  }, [filters, sortedLogs]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setExpandedRowId("");
  }, [page]);

  function setFilter(field, value) {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function clearFilters() {
    setFilters({
      keyword: "",
      assignMode: "",
      createdBy: "",
    });
  }

  async function handleDeleteLog(log) {
    const logId = String(log.log_id || log.id || log.queue_log_id || log.row_number || "").trim();

    if (!logId) {
      showError("ไม่พบรหัสรายการที่ต้องการลบ");
      return;
    }

    const confirmed = await showConfirm("ต้องการลบประวัติคิวคนขับรายการนี้ใช่หรือไม่?");
    if (!confirmed) return;

    try {
      setDeletingId(logId);

      await deleteDriverQueueLog({
        log_id: logId,
        id: log.id || "",
        queue_log_id: log.queue_log_id || "",
        row_number: log.row_number || "",
      });

      setLogs((current) =>
        current.filter((item) => {
          const itemId = String(item.log_id || item.id || item.queue_log_id || item.row_number || "").trim();
          return itemId !== logId;
        })
      );

      showSuccess("ลบรายการสำเร็จ");
    } catch (err) {
      showError(err.message || "ลบรายการไม่สำเร็จ");
    } finally {
      setDeletingId("");
    }
  }

  async function findBookingForLog(log) {
    const bookingId = String(log.booking_id || "").trim();
    const bookingNo = String(log.booking_no || "").trim();

    const matchBooking = (items) =>
      (Array.isArray(items) ? items : []).find((item) => {
        const itemBookingId = String(item.booking_id || "").trim();
        const itemBookingNo = String(item.booking_no || "").trim();
        return (bookingId && itemBookingId === bookingId) || (bookingNo && itemBookingNo === bookingNo);
      }) || null;

    const cachedMatch = matchBooking(cachedBookings);
    if (cachedMatch) {
      return cachedMatch;
    }

    const latestBookings = await getBookings({ fresh: true });
    const normalizedBookings = Array.isArray(latestBookings) ? latestBookings : [];
    setCachedBookings(normalizedBookings);
    return matchBooking(normalizedBookings);
  }

  async function handleViewBookingDetail(log) {
    const detailKey = String(log.booking_id || log.booking_no || log.log_id || "").trim();
    if (!detailKey || detailLoadingKey) return;

    try {
      setDetailLoadingKey(detailKey);
      const booking = await findBookingForLog(log);

      if (!booking) {
        showError("ไม่พบรายละเอียดรายการจอง");
        return;
      }

      const container = document.createElement("div");
      const root = createRoot(container);
      root.render(<BookingDetailModalContent booking={booking} />);

      await Swal.fire({
        title: booking.booking_no || "รายละเอียดรายการจอง",
        html: container,
        width: 760,
        confirmButtonText: "ปิด",
        confirmButtonColor: "#1455c8",
        customClass: {
          popup: "booking-detail-popup",
        },
        willClose: () => {
          root.unmount();
        },
      });
    } catch (err) {
      showError(err.message || "เปิดรายละเอียดรายการจองไม่สำเร็จ");
    } finally {
      setDetailLoadingKey("");
    }
  }

  const activeFilterCount = [filters.keyword, filters.assignMode, filters.createdBy].filter(Boolean).length;

  if (isMobile) {
    const pageStart = filteredLogs.length === 0 ? 0 : (page - 1) * ROWS_PER_PAGE + 1;
    const pageEnd = Math.min(page * ROWS_PER_PAGE, filteredLogs.length);

    return (
      <div className="driver-queue-logs-mobile mt-[57px] flex w-full flex-col gap-3 pb-6">
        <MobilePageHeader
          title="ประวัติคิวคนขับ"
          subtitle="แสดงประวัติการเลือกคนขับของแต่ละรายการจอง ว่าระบบจัดการให้ใคร เลือกจริงเป็นใคร และมีการข้ามคิวเพราะเหตุผลใด"
          actions={
            <button
              type="button"
              className="mobile-filter-button inline-flex items-center gap-1.5 border border-blue-600 bg-blue-600 shadow-sm transition hover:bg-blue-700"
              style={{ fontSize: 16 }}
              disabled={refreshing || loading}
              onClick={() => loadData({ refreshOnly: true })}
            >
              <span>{refreshing ? "กำลังรีเฟรช..." : "รีเฟรช"}</span>
            </button>
          }
        />

        {loading ? (
          <div className="driver-queue-logs-mobile-state-card" style={{ fontSize: 20 }}>
            กำลังโหลดข้อมูล...
          </div>
        ) : error ? (
          <div className="driver-queue-logs-mobile-state-card text-red-700" style={{ fontSize: 20 }}>
            {error}
          </div>
        ) : (
          <>
            <MobilePageSection title="คำอธิบาย" subtitle="ช่วยให้เข้าใจความหมายของแต่ละข้อมูลในตาราง">
              <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 leading-8 text-slate-600" style={{ fontSize: 20 }}>
                <div>- “คนขับที่ระบบจัดการให้” คือคนขับที่ระบบเลือกตามคิว</div>
                <div>- “คนขับที่เลือกจริง” คือคนขับที่ถูกมอบหมายจริง</div>
                <div>- “คิวก่อน / คิวหลัง” ใช้สำหรับตรวจสอบลำดับคิวในขณะนั้น</div>
                <div>- “รายการที่ข้าม” คือคนขับที่ถูกข้ามพร้อมเหตุผล</div>
              </div>
            </MobilePageSection>

            <MobilePageSection
              title="ตัวกรองข้อมูล"
              subtitle="ค้นหาประวัติคิวคนขับ"
              actions={
                <button
                  type="button"
                  onClick={() => setIsMobileFilterOpen((current) => !current)}
                  aria-expanded={isMobileFilterOpen}
                  className="mobile-filter-button inline-flex items-center gap-1.5 border border-blue-600 bg-blue-600 shadow-sm transition hover:bg-blue-700"
                  style={{ fontSize: 16 }}
                >
                  <span>{isMobileFilterOpen ? "ซ่อนตัวกรอง" : "ตัวกรอง"}</span>
                </button>
              }
            >
              {isMobileFilterOpen ? (
                <div className="booking-mobile-filter-panel">
                  <div className="booking-mobile-filter-panel-actions grid gap-3">
                    <FilterField
                      label="ค้นหา"
                      value={filters.keyword}
                      onChange={(value) => setFilter("keyword", value)}
                      placeholder="เลขที่จอง คนขับ เหตุผล ผู้บันทึก"
                      labelClassName="text-[20px] font-semibold text-slate-600"
                      inputClassName="mobile-filter-input h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[20px] text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <FilterField
                      label="วิธีเลือก"
                      value={filters.assignMode}
                      onChange={(value) => setFilter("assignMode", value)}
                      as="select"
                      options={ASSIGN_MODE_OPTIONS}
                      labelClassName="text-[20px] font-semibold text-slate-600"
                      inputClassName="mobile-filter-input h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[20px] text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <FilterField
                      label="ผู้บันทึก"
                      value={filters.createdBy}
                      onChange={(value) => setFilter("createdBy", value)}
                      placeholder="ค้นหาผู้บันทึก"
                      labelClassName="text-[20px] font-semibold text-slate-600"
                      inputClassName="mobile-filter-input h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[20px] text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />

                    <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-semibold text-slate-500" style={{ fontSize: 20 }}>
                        ใช้งาน {activeFilterCount || 0} ตัวกรอง
                      </span>
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mobile-action-button border border-blue-600 bg-blue-600 shadow-sm transition hover:bg-blue-700"
                        style={{ fontSize: 16 }}
                      >
                        ล้างตัวกรอง
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </MobilePageSection>

            <MobilePageSection title="รายการบันทึกคิว" subtitle={`แสดง ${pageStart} - ${pageEnd} จาก ${filteredLogs.length} รายการ`}>
              {filteredLogs.length === 0 ? (
                <div className="mobile-empty-state" style={{ fontSize: 20 }}>
                  ไม่พบประวัติ
                </div>
              ) : (
                <div className="grid gap-[10px]">
                  {pageItems.map((log, index) => {
                    const rowKey = String(log.log_id || `${page}-${index}`);
                    const deleteKey = String(log.log_id || log.id || log.queue_log_id || log.row_number || "").trim();
                    const isDeleting = deletingId === deleteKey;
                    const isDetailLoading = detailLoadingKey === String(
                      log.booking_id || log.booking_no || log.log_id || ""
                    ).trim();
                    const badge = getAssignModeBadge(log.assign_mode);
                    const skippedDrivers = parseSkippedDrivers(log.skipped_drivers_json);
                    const isExpanded = expandedRowId === rowKey;

                    return (
                      <article
                        key={rowKey}
                        className="mobile-data-card booking-mobile-card driver-queue-logs-mobile-card"
                        style={{ padding: 14, gap: 12, overflow: "hidden" }}
                      >
                        <div className="grid gap-2.5">
                          <MobileInfoRow label="วันที่บันทึก" value={formatMobileShortDateTime(log.created_at)} />

                          <div className="grid gap-1.5 min-w-0">
                            <span className="text-slate-600" style={{ fontSize: 20, lineHeight: 1.35, fontWeight: 700 }}>
                              เลขที่จอง
                            </span>
                            <button
                              type="button"
                              onClick={() => handleViewBookingDetail(log)}
                              disabled={isDetailLoading}
                              className="inline-flex w-fit max-w-full items-center gap-2 self-start rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-default disabled:opacity-70"
                              style={{ fontSize: 18, minHeight: 0 }}
                            >
                              <EyeIcon className="h-4 w-4" />
                              <span className="break-all">{isDetailLoading ? "กำลังเปิด..." : log.booking_no || log.booking_id || "-"}</span>
                            </button>
                          </div>

                          <MobileInfoRow label="คนขับที่เลือกจริง" value={<b>{log.assigned_driver_name || "-"}</b>} />
                          <MobileInfoRow
                            label="วิธีเลือก"
                            value={
                              <span
                                className={`inline-flex w-fit max-w-full rounded-full border px-2.5 py-1 font-semibold ${badge.className}`}
                                style={{ fontSize: 16 }}
                              >
                                {badge.label}
                              </span>
                            }
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedRowId((current) => (current === rowKey ? "" : rowKey))}
                          className="inline-flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm transition hover:bg-slate-50"
                          aria-expanded={isExpanded}
                          style={{ fontSize: 20, minHeight: 0 }}
                        >
                          <span>{isExpanded ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}</span>
                          <ChevronDownIcon
                            className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </button>

                        {isExpanded ? (
                          <div className="grid gap-2.5 border-t border-slate-200 pt-3">
                            <MobileInfoRow label="ระบบจัดการให้" value={log.recommended_driver_name || "-"} />
                            <MobileInfoRow label="เหตุผล" value={log.reason || "-"} />
                            <MobileInfoRow label="คิวก่อน" value={log.queue_before || log.queue_before_index || "-"} />
                            <MobileInfoRow label="คิวหลัง" value={log.queue_after || log.queue_after_index || "-"} />

                            <div className="grid gap-1.5 min-w-0">
                              <span className="text-slate-600" style={{ fontSize: 20, lineHeight: 1.35, fontWeight: 700 }}>
                                รายการที่ข้าม
                              </span>
                              <div className="flex min-w-0 flex-wrap gap-2">
                                {skippedDrivers.length === 0 ? (
                                  <span className="text-slate-900" style={{ fontSize: 20, lineHeight: 1.45 }}>
                                    -
                                  </span>
                                ) : (
                                  skippedDrivers.map((item) => (
                                    <span
                                      key={`${rowKey}-${item.id}`}
                                      className="inline-flex max-w-full rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-semibold leading-6 text-slate-700"
                                      style={{ fontSize: 16 }}
                                      title={`${item.name}: ${item.reason}`}
                                    >
                                      {item.name}: {item.reason}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>

                            <MobileInfoRow label="ผู้บันทึก" value={log.created_by || "-"} />

                            <div className="grid gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleViewBookingDetail(log)}
                                disabled={isDetailLoading}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-default disabled:opacity-70"
                                style={{ fontSize: 20, minHeight: 0 }}
                              >
                                {isDetailLoading ? "กำลังเปิดรายละเอียด..." : "ดูรายละเอียดรายการจอง"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteLog(log)}
                                disabled={isDeleting}
                                className="driver-queue-log-delete-button"
                                style={{ fontSize: 16 }}
                              >
                                {isDeleting ? "กำลังลบ..." : "ลบรายการ"}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}

              <Pagination page={page} totalPages={totalPages} totalItems={filteredLogs.length} onChangePage={setPage} />
            </MobilePageSection>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ fontSize: 20 }}>
      <div className="page-header">
        <div>
          <h2>ประวัติคิวคนขับ</h2>
          <p>แสดงประวัติการเลือกคนขับของแต่ละรายการจอง ว่าระบบจัดการให้ใคร เลือกจริงเป็นใคร และมีการข้ามคิวเพราะเหตุผลใด</p>
        </div>

        <button
          type="button"
          disabled={refreshing || loading}
          onClick={() => loadData({ refreshOnly: true })}
          style={{ fontSize: 25}}
        >
          {refreshing ? "กำลังรีเฟรช..." : "รีเฟรชข้อมูล"}
        </button>
      </div>

      {loading && <div className="form-card">กำลังโหลดข้อมูล...</div>}
      {error && !loading && <div className="form-card">{error}</div>}

      {!loading && !error && (
        <div className="form-card">
          <QueueExplanationCard />

          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <span className="font-bold text-[20px] text-slate-900">
                  ตัวกรองข้อมูล
                </span>
                <p className="mt-1 leading-8 text-slate-500" style={{ fontSize: 20 }}>
                  ค้นหาตามเลขที่จอง คนขับ เหตุผล หรือผู้บันทึก
                </p>
              </div>
              <div
                className="inline-flex items-center rounded-full bg-white px-3 py-1 font-semibold text-slate-600 shadow-sm"
                style={{ fontSize: 20 }}
              >
                ใช้งาน {activeFilterCount || 0} ตัวกรอง
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <FilterField
                label="ค้นหา"
                value={filters.keyword}
                onChange={(value) => setFilter("keyword", value)}
                placeholder="เลขที่จอง คนขับ เหตุผล ผู้บันทึก"
              />
              <FilterField
                label="วิธีเลือก"
                value={filters.assignMode}
                onChange={(value) => setFilter("assignMode", value)}
                as="select"
                options={ASSIGN_MODE_OPTIONS}
              />
              <FilterField
                label="ผู้บันทึก"
                value={filters.createdBy}
                onChange={(value) => setFilter("createdBy", value)}
                placeholder="ค้นหาผู้บันทึก"
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                style={{ fontSize: 25 }}
              >
                ล้างตัวกรอง
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <span className="font-bold text-[20px] text-slate-900">
                  รายการบันทึกคิว
                </span>
                <p className="mt-1 leading-8 text-slate-500" style={{ fontSize: 20 }}>
                  ดูว่าแต่ละรายการจอง ระบบจัดการให้ใคร เลือกจริงเป็นใคร และมีการข้ามคิวคนใดบ้าง
                </p>
              </div>
            </div>

            <div className="table-wrap overflow-x-auto">
              <table className="min-w-[1250px]">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap" style={{ fontSize: 20 }}>วันที่บันทึก</th>
                    <th className="whitespace-nowrap" style={{ fontSize: 20 }}>เลขที่จอง</th>
                    <th className="whitespace-nowrap" style={{ fontSize: 20 }}>คนขับที่ระบบจัดการให้</th>
                    <th className="whitespace-nowrap" style={{ fontSize: 20 }}>คนขับที่เลือกจริง</th>
                    <th className="whitespace-nowrap" style={{ fontSize: 20 }}>วิธีเลือก</th>
                    <th className="whitespace-nowrap" style={{ fontSize: 20 }}>เหตุผล</th>
                    <th className="whitespace-nowrap" style={{ fontSize: 20 }}>คิวก่อน</th>
                    <th className="whitespace-nowrap" style={{ fontSize: 20 }}>คิวหลัง</th>
                    <th className="whitespace-nowrap" style={{ fontSize: 20 }}>รายการที่ข้าม</th>
                    <th className="whitespace-nowrap" style={{ fontSize: 20 }}>ผู้บันทึก</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={DESKTOP_COLUMN_COUNT} style={{ fontSize: 20 }}>ไม่พบประวัติ</td>
                    </tr>
                  ) : (
                    pageItems.map((log, index) => {
                      const badge = getAssignModeBadge(log.assign_mode);
                      const skippedDrivers = parseSkippedDrivers(log.skipped_drivers_json);
                      const rowKey = String(log.log_id || `${page}-${index}`);
                      const isDetailLoading = detailLoadingKey === String(
                        log.booking_id || log.booking_no || log.log_id || ""
                      ).trim();

                      return (
                        <tr key={rowKey}>
                          <td className="whitespace-nowrap align-top" style={{ fontSize: 20 }}>
                            {formatThaiDateTime(log.created_at)}
                          </td>
                          <td className="whitespace-nowrap align-top" style={{ fontSize: 20 }}>
                            <button
                              type="button"
                              onClick={() => handleViewBookingDetail(log)}
                              disabled={isDetailLoading}
                              className="inline-flex min-h-0 w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-default disabled:opacity-70"
                              style={{ fontSize: 18 }}
                            >
                              <EyeIcon className="h-4 w-4" />
                              <span>{isDetailLoading ? "กำลังเปิด..." : log.booking_no || log.booking_id || "-"}</span>
                            </button>
                          </td>
                          <td className="align-top">
                            <div className="min-w-[160px] font-semibold text-slate-900" style={{ fontSize: 20 }}>
                              {log.recommended_driver_name || "-"}
                            </div>
                          </td>
                          <td className="align-top">
                            <div className="min-w-[160px] font-semibold text-slate-900" style={{ fontSize: 20 }}>
                              {log.assigned_driver_name || "-"}
                            </div>
                          </td>
                          <td className="align-top">
                            <div className="flex min-w-[135px] flex-col gap-2">
                              <span
                                className={`inline-flex w-fit rounded-full border px-2.5 py-1 font-semibold ${badge.className}`}
                                style={{ fontSize: 16 }}
                              >
                                {badge.label}
                              </span>
                              <span className="leading-7 text-slate-600" style={{ fontSize: 20 }}>
                                {getAssignModeLabel(log.assign_mode)}
                              </span>
                            </div>
                          </td>
                          <td className="align-top">
                            <div className="min-w-[180px] whitespace-normal break-words leading-8 text-slate-700" style={{ fontSize: 20 }}>
                              {log.reason || "-"}
                            </div>
                          </td>
                          <td className="whitespace-nowrap align-top text-center" style={{ fontSize: 20 }}>
                            {log.queue_before || log.queue_before_index || "-"}
                          </td>
                          <td className="whitespace-nowrap align-top text-center" style={{ fontSize: 20 }}>
                            {log.queue_after || log.queue_after_index || "-"}
                          </td>
                          <td className="align-top">
                            <div className="flex min-w-[260px] flex-wrap gap-2">
                              {skippedDrivers.length === 0 ? (
                                <span className="text-slate-500" style={{ fontSize: 20 }}>-</span>
                              ) : (
                                skippedDrivers.map((item) => (
                                  <span
                                    key={`${rowKey}-${item.id}`}
                                    className="inline-flex max-w-full rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-semibold leading-6 text-slate-700"
                                    style={{ fontSize: 16 }}
                                    title={`${item.name}: ${item.reason}`}
                                  >
                                    {item.name}: {item.reason}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                          <td className="align-top">
                            <div className="min-w-[120px] whitespace-normal break-words leading-8 text-slate-700" style={{ fontSize: 20 }}>
                              {log.created_by || "-"}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Pagination page={page} totalPages={totalPages} totalItems={filteredLogs.length} onChangePage={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}
