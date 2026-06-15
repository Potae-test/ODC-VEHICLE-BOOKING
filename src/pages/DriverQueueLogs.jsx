import { useEffect, useMemo, useState } from "react";
import { deleteDriverQueueLog, getDriverQueueLogs } from "../api";
import MobilePageHeader from "../layouts/MobilePageHeader";
import MobilePageSection from "../layouts/MobilePageSection";
import useIsMobile from "../hooks/useIsMobile";
import { formatThaiDateTime } from "../utils/date";
import { showConfirm, showError, showSuccess } from "../utils/alert";

const ROWS_PER_PAGE = 5;

function sortLatestFirst(items) {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return dateB - dateA;
  });
}

function getAssignModeLabel(mode) {
  const normalized = String(mode || "").trim().toUpperCase();
  if (normalized === "AUTO_RECOMMENDED") return "ระบบแนะนำ";
  if (normalized === "MANUAL_OVERRIDE") return "เลือกเอง";
  if (normalized === "SKIPPED_UNAVAILABLE") return "ข้ามเพราะไม่ว่าง";
  if (normalized === "SKIPPED_BUSY") return "ข้ามเพราะติดภารกิจ";
  return mode || "-";
}

function getAssignModeBadge(mode) {
  const normalized = String(mode || "").trim().toUpperCase();
  if (normalized === "AUTO_RECOMMENDED") {
    return {
      label: "ระบบแนะนำ",
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
      id: String(
        item.driver_user_id ||
        item.user_id ||
        item.driver_id ||
        item.name ||
        item.driver_name ||
        index
      ),
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

  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

const ASSIGN_MODE_OPTIONS = [
  { value: "", label: "ทั้งหมด" },
  { value: "AUTO_RECOMMENDED", label: "ระบบแนะนำ" },
  { value: "MANUAL_OVERRIDE", label: "เลือกเอง" },
  { value: "SKIPPED_UNAVAILABLE", label: "ข้ามเพราะไม่ว่าง" },
  { value: "SKIPPED_BUSY", label: "ข้ามเพราะติดภารกิจ" },
];

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
  labelClassName = "text-[13px] font-semibold text-slate-600",
  inputClassName = "h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-[15px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100",
}) {
  return (
    <label className="grid gap-1">
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

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4">
      <div className="text-[14px] text-slate-600">
        แสดง {totalItems === 0 ? 0 : (page - 1) * ROWS_PER_PAGE + 1} - {Math.min(page * ROWS_PER_PAGE, totalItems)} จาก {totalItems} รายการ
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChangePage(1)}
          disabled={page <= 1}
          className="inline-flex h-10 min-w-[62px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-[14px] font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-default disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
        >
          แรก
        </button>
        <button
          type="button"
          onClick={() => onChangePage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex h-10 min-w-[78px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-[14px] font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-default disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
        >
          ก่อนหน้า
        </button>
        {pageNumbers.map((pageNumber) => {
          const isActive = pageNumber === page;
          return (
            <button
              key={pageNumber}
              type="button"
              onClick={() => onChangePage(pageNumber)}
              className={`inline-flex h-10 min-w-[44px] items-center justify-center rounded-xl border px-3 text-[14px] font-semibold transition ${
                isActive
                  ? "border-blue-700 bg-blue-700 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700"
              }`}
            >
              {pageNumber}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onChangePage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="inline-flex h-10 min-w-[62px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-[14px] font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-default disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
        >
          ถัดไป
        </button>
        <button
          type="button"
          onClick={() => onChangePage(totalPages)}
          disabled={page >= totalPages}
          className="inline-flex h-10 min-w-[54px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-[14px] font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-default disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
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
      <h3 className="text-[20px] font-bold text-slate-900">ประวัติคิวคนขับ</h3>
      <p className="mt-1 text-[15px] leading-6 text-slate-700">
        แสดงประวัติการเลือกคนขับของแต่ละรายการจอง ว่าระบบแนะนำใคร เลือกจริงเป็นใคร และมีการข้ามคิวเพราะเหตุผลใด
      </p>
      <div className="mt-4 rounded-2xl border border-white/80 bg-white/90 p-4">
        <div className="text-[15px] font-bold text-slate-900">คำอธิบาย:</div>
        <ul className="mt-2 grid gap-2 text-[14px] leading-6 text-slate-600">
          <li>- “คนขับที่ระบบแนะนำ” คือคนขับที่ระบบเลือกตามคิว</li>
          <li>- “คนขับที่เลือกจริง” คือคนขับที่ถูกมอบหมายจริง</li>
          <li>- “คิวก่อนหน้า/คิวถัดไป” ใช้สำหรับตรวจสอบลำดับคิวในขณะนั้น</li>
          <li>- “ข้ามเพราะไม่ว่าง/ติดภารกิจ” คือคนขับที่ถูกข้ามพร้อมเหตุผล</li>
        </ul>
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
  const [expandedRowId, setExpandedRowId] = useState("");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState("");
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
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

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredLogs.length / ROWS_PER_PAGE)),
    [filteredLogs.length]
  );

  const pageItems = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return filteredLogs.slice(start, start + ROWS_PER_PAGE);
  }, [filteredLogs, page]);

  useEffect(() => {
    setExpandedRowId("");
    setPage(1);
  }, [filters, sortedLogs]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
    const logId = String(
      log.log_id ||
      log.id ||
      log.queue_log_id ||
      log.row_number ||
      ""
    ).trim();

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
          const itemId = String(
            item.log_id ||
            item.id ||
            item.queue_log_id ||
            item.row_number ||
            ""
          ).trim();

          return itemId !== logId;
        })
      );

      setExpandedRowId("");
      showSuccess("ลบรายการสำเร็จ");
    } catch (err) {
      showError(err.message || "ลบรายการไม่สำเร็จ");
    } finally {
      setDeletingId("");
    }
  }

  const activeFilterCount = [filters.keyword, filters.assignMode, filters.createdBy].filter(Boolean).length;

  if (isMobile) {
    return (
      <div className="driver-queue-logs-mobile mt-[57px] flex w-full flex-col gap-3 pb-6">
        <MobilePageHeader
          title="ประวัติคิวคนขับ"
          subtitle="แสดงประวัติการเลือกคนขับของแต่ละรายการจอง ว่าระบบแนะนำใคร เลือกจริงเป็นใคร และมีการข้ามคิวเพราะเหตุผลใด"
          actions={
            <button
              type="button"
              className="mobile-filter-button inline-flex items-center gap-1.5 border border-blue-600 bg-blue-600 shadow-sm transition hover:bg-blue-700"
              disabled={refreshing || loading}
              onClick={() => loadData({ refreshOnly: true })}
            >
              <span>{refreshing ? "กำลังรีเฟรช..." : "รีเฟรช"}</span>
            </button>
          }
        />

        {loading ? (
          <div className="driver-queue-logs-mobile-state-card">กำลังโหลดข้อมูล...</div>
        ) : error ? (
          <div className="driver-queue-logs-mobile-state-card text-red-700">{error}</div>
        ) : (
          <>
            <MobilePageSection title="คำอธิบาย" subtitle="ช่วยให้เข้าใจความหมายของแต่ละข้อมูลในตาราง">
              <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-[14px] leading-6 text-slate-600">
                <div>- “คนขับที่ระบบแนะนำ” คือคนขับที่ระบบเลือกตามคิว</div>
                <div>- “คนขับที่เลือกจริง” คือคนขับที่ถูกมอบหมายจริง</div>
                <div>- “คิวก่อนหน้า/คิวถัดไป” ใช้สำหรับตรวจสอบลำดับคิวในขณะนั้น</div>
                <div>- “ข้ามเพราะไม่ว่าง/ติดภารกิจ” คือคนขับที่ถูกข้ามพร้อมเหตุผล</div>
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
                      labelClassName="text-[15px] font-semibold text-slate-600"
                      inputClassName="mobile-filter-input h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <FilterField
                      label="วิธีเลือก"
                      value={filters.assignMode}
                      onChange={(value) => setFilter("assignMode", value)}
                      as="select"
                      options={ASSIGN_MODE_OPTIONS}
                      labelClassName="text-[15px] font-semibold text-slate-600"
                      inputClassName="mobile-filter-input h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <FilterField
                      label="ผู้บันทึก"
                      value={filters.createdBy}
                      onChange={(value) => setFilter("createdBy", value)}
                      placeholder="ค้นหาผู้บันทึก"
                      labelClassName="text-[15px] font-semibold text-slate-600"
                      inputClassName="mobile-filter-input h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />

                    <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-[13px] font-semibold text-slate-500">
                        ใช้งาน {activeFilterCount || 0} ตัวกรอง
                      </span>
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mobile-action-button border border-blue-600 bg-blue-600 shadow-sm transition hover:bg-blue-700"
                      >
                        ล้างตัวกรอง
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </MobilePageSection>

            <MobilePageSection
              title="รายการบันทึกคิว"
              subtitle={`แสดง ${filteredLogs.length === 0 ? 0 : (page - 1) * ROWS_PER_PAGE + 1} - ${Math.min(page * ROWS_PER_PAGE, filteredLogs.length)} จาก ${filteredLogs.length} รายการ`}
              actions={
                <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                  หน้า {page} / {totalPages}
                </span>
              }
            >
              {filteredLogs.length === 0 ? (
                <div className="mobile-empty-state">ไม่พบประวัติ</div>
              ) : (
                <div className="grid gap-[10px]">
                  {pageItems.map((log, index) => {
                    const rowKey = String(log.log_id || `${page}-${index}`);
                    const isExpanded = expandedRowId === rowKey;
                    const isDeleting = deletingId === String(log.log_id || "");
                    const badge = getAssignModeBadge(log.assign_mode);
                    const skippedDrivers = parseSkippedDrivers(log.skipped_drivers_json);
                    const rowNumber = (page - 1) * ROWS_PER_PAGE + index + 1;

                    return (
                      <article
                        key={rowKey}
                        className={`mobile-data-card booking-mobile-card driver-queue-logs-mobile-card${isExpanded ? " is-expanded" : ""}`}
                      >
                        <button
                          type="button"
                          className="driver-queue-logs-mobile-card-summary"
                          aria-expanded={isExpanded}
                          onClick={() => setExpandedRowId((current) => (current === rowKey ? "" : rowKey))}
                        >
                          <div className="booking-mobile-card-summary-index">#{rowNumber}</div>
                          <div
                            className="driver-queue-logs-mobile-card-date"
                            title={formatThaiDateTime(log.created_at)}
                          >
                            {formatMobileShortDateTime(log.created_at)}
                          </div>
                          <div
                            className="driver-queue-logs-mobile-card-user"
                            title={log.booking_no || log.booking_id || "-"}
                          >
                            {log.booking_no || log.booking_id || "-"}
                          </div>
                          <div className="booking-mobile-card-summary-side">
                            <span className={`driver-queue-logs-mobile-card-summary-badge ${badge.className}`}>
                              {badge.label}
                            </span>
                            <ChevronDownIcon
                              className={`booking-mobile-card-expand-icon driver-queue-logs-mobile-card-expand-icon${isExpanded ? " is-expanded" : ""}`}
                            />
                          </div>
                        </button>

                        <div className="px-4 pb-3 text-[14px] text-slate-700">
                          <div className="font-semibold text-slate-900">{log.assigned_driver_name || "-"}</div>
                          <div className="mt-1">{getAssignModeLabel(log.assign_mode)}</div>
                        </div>

                        {isExpanded ? (
                          <div className="booking-mobile-card-expanded driver-queue-log-expanded-detail" id={rowKey}>
                            <div className="driver-queue-log-detail-item">
                              <span>วันที่บันทึก</span>
                              <b>{formatThaiDateTime(log.created_at)}</b>
                            </div>
                            <div className="driver-queue-log-detail-item">
                              <span>เลขที่จอง</span>
                              <b>{log.booking_no || log.booking_id || "-"}</b>
                            </div>
                            <div className="driver-queue-log-detail-item">
                              <span>คนขับที่ระบบแนะนำ</span>
                              <b>{log.recommended_driver_name || "-"}</b>
                            </div>
                            <div className="driver-queue-log-detail-item">
                              <span>คนขับที่เลือกจริง</span>
                              <b>{log.assigned_driver_name || "-"}</b>
                            </div>
                            <div className="driver-queue-log-detail-item">
                              <span>วิธีเลือก</span>
                              <b>{getAssignModeLabel(log.assign_mode)}</b>
                            </div>
                            <div className="driver-queue-log-detail-item">
                              <span>เหตุผลการเลือก</span>
                              <b>{log.reason || "-"}</b>
                            </div>
                            <div className="driver-queue-log-detail-item">
                              <span>คิวก่อนหน้า</span>
                              <b>{log.queue_before || log.queue_before_index || "-"}</b>
                            </div>
                            <div className="driver-queue-log-detail-item">
                              <span>คิวถัดไป</span>
                              <b>{log.queue_after || log.queue_after_index || "-"}</b>
                            </div>
                            <div className="driver-queue-log-detail-item">
                              <span>ข้ามเพราะไม่ว่าง/ติดภารกิจ</span>
                              <div className="flex flex-wrap gap-2">
                                {skippedDrivers.length === 0 ? (
                                  <b>-</b>
                                ) : (
                                  skippedDrivers.map((item) => (
                                    <span
                                      key={`${rowKey}-${item.id}`}
                                      className="inline-flex max-w-full rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[12px] font-semibold leading-5 text-slate-700"
                                      title={`${item.name}: ${item.reason}`}
                                    >
                                      {item.name}: {item.reason}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                            <div className="driver-queue-log-detail-item">
                              <span>ผู้บันทึก</span>
                              <b>{log.created_by || "-"}</b>
                            </div>

                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={() => handleDeleteLog(log)}
                                disabled={isDeleting}
                                className="driver-queue-log-delete-button"
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

              <Pagination page={page} totalPages={totalPages} totalItems={filteredLogs.length} onChangePage={(nextPage) => {
                setPage(nextPage);
                setExpandedRowId("");
              }} />
            </MobilePageSection>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>ประวัติคิวคนขับ</h2>
          <p>แสดงประวัติการเลือกคนขับของแต่ละรายการจอง ว่าระบบแนะนำใคร เลือกจริงเป็นใคร และมีการข้ามคิวเพราะเหตุผลใด</p>
        </div>

        <button type="button" disabled={refreshing || loading} onClick={() => loadData({ refreshOnly: true })}>
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
                <h3 className="text-[20px] font-bold text-slate-900">ตัวกรองข้อมูล</h3>
                <p className="mt-1 text-[15px] leading-6 text-slate-500">
                  ค้นหาตามเลขที่จอง คนขับ เหตุผล หรือผู้บันทึก
                </p>
              </div>
              <div className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-slate-600 shadow-sm">
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
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-[14px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
              >
                ล้างตัวกรอง
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-[20px] font-bold text-slate-900">รายการบันทึกคิว</h3>
                <p className="mt-1 text-[14px] leading-6 text-slate-500">
                  ดูว่าแต่ละรายการจอง ระบบแนะนำใคร เลือกจริงเป็นใคร และมีการข้ามคิวคนใดบ้าง
                </p>
              </div>
              <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[13px] font-semibold text-slate-700">
                แสดง {filteredLogs.length === 0 ? 0 : (page - 1) * ROWS_PER_PAGE + 1} - {Math.min(page * ROWS_PER_PAGE, filteredLogs.length)} จาก {filteredLogs.length} รายการ
              </div>
            </div>

            <div className="table-wrap overflow-x-auto">
              <table className="min-w-[1250px]">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap">วันที่บันทึก</th>
                    <th className="whitespace-nowrap">เลขที่จอง</th>
                    <th className="whitespace-nowrap">คนขับที่ระบบแนะนำ</th>
                    <th className="whitespace-nowrap">คนขับที่เลือกจริง</th>
                    <th className="whitespace-nowrap">วิธีเลือก</th>
                    <th className="whitespace-nowrap">เหตุผลการเลือก</th>
                    <th className="whitespace-nowrap">คิวก่อนหน้า</th>
                    <th className="whitespace-nowrap">คิวถัดไป</th>
                    <th className="whitespace-nowrap">ข้ามเพราะไม่ว่าง/ติดภารกิจ</th>
                    <th className="whitespace-nowrap">ผู้บันทึก</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan="10">ไม่พบประวัติ</td>
                    </tr>
                  ) : (
                    pageItems.map((log, index) => {
                      const badge = getAssignModeBadge(log.assign_mode);
                      const skippedDrivers = parseSkippedDrivers(log.skipped_drivers_json);
                      const rowKey = String(log.log_id || `${page}-${index}`);

                      return (
                        <tr key={rowKey}>
                          <td className="whitespace-nowrap align-top">{formatThaiDateTime(log.created_at)}</td>
                          <td className="whitespace-nowrap align-top">{log.booking_no || log.booking_id || "-"}</td>
                          <td className="align-top">
                            <div className="min-w-[160px] font-semibold text-slate-900">{log.recommended_driver_name || "-"}</div>
                          </td>
                          <td className="align-top">
                            <div className="min-w-[160px] font-semibold text-slate-900">{log.assigned_driver_name || "-"}</div>
                          </td>
                          <td className="align-top">
                            <div className="flex min-w-[135px] flex-col gap-2">
                              <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[12px] font-semibold ${badge.className}`}>
                                {badge.label}
                              </span>
                              <span className="text-[13px] leading-5 text-slate-600">{getAssignModeLabel(log.assign_mode)}</span>
                            </div>
                          </td>
                          <td className="align-top">
                            <div className="min-w-[180px] whitespace-normal break-words text-[14px] leading-6 text-slate-700">
                              {log.reason || "-"}
                            </div>
                          </td>
                          <td className="whitespace-nowrap align-top text-center">{log.queue_before || log.queue_before_index || "-"}</td>
                          <td className="whitespace-nowrap align-top text-center">{log.queue_after || log.queue_after_index || "-"}</td>
                          <td className="align-top">
                            <div className="flex min-w-[260px] flex-wrap gap-2">
                              {skippedDrivers.length === 0 ? (
                                <span className="text-[14px] text-slate-500">-</span>
                              ) : (
                                skippedDrivers.map((item) => (
                                  <span
                                    key={`${rowKey}-${item.id}`}
                                    className="inline-flex max-w-full rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[12px] font-semibold leading-5 text-slate-700"
                                    title={`${item.name}: ${item.reason}`}
                                  >
                                    {item.name}: {item.reason}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                          <td className="align-top">
                            <div className="min-w-[120px] whitespace-normal break-words text-[14px] leading-6 text-slate-700">
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
