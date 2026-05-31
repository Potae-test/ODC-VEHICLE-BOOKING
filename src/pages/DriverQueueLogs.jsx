import { useEffect, useMemo, useState } from "react";
import { deleteDriverQueueLog, getDriverQueueLogs } from "../api";
import MobilePageHeader from "../layouts/MobilePageHeader";
import MobilePageSection from "../layouts/MobilePageSection";
import useIsMobile from "../hooks/useIsMobile";
import { formatThaiDateTime } from "../utils/date";
import { showConfirm, showError, showSuccess } from "../utils/alert";

const MOBILE_ROWS_PER_PAGE = 5;

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
  if (normalized === "MANUAL_OVERRIDE") return "เจ้าหน้าที่เลือกเอง";
  if (normalized === "SKIPPED_UNAVAILABLE") return "ข้ามเพราะไม่ว่าง";
  if (normalized === "SKIPPED_BUSY") return "ข้ามเพราะมีงานทับ";
  return mode || "-";
}

function safeJsonSummary(value) {
  const raw = String(value || "").trim();
  if (!raw) return "-";

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return raw;
    if (parsed.length === 0) return "ไม่มีรายการที่ข้าม";
    return parsed.map((item) => `${item.driver_name || "-"}: ${item.reason || "-"}`).join(" | ");
  } catch {
    return raw;
  }
}

function getAssignModeTone(mode) {
  const normalized = String(mode || "").trim().toUpperCase();
  if (normalized === "AUTO_RECOMMENDED") return "blue";
  if (normalized === "MANUAL_OVERRIDE") return "amber";
  if (normalized === "SKIPPED_UNAVAILABLE" || normalized === "SKIPPED_BUSY") return "gray";
  return "gray";
}

function getAssignModeMobileLabel(mode) {
  const normalized = String(mode || "").trim().toUpperCase();
  if (normalized === "AUTO_RECOMMENDED") return "ระบบแนะนำ";
  if (normalized === "MANUAL_OVERRIDE") return "เลือกเอง";
  if (normalized === "SKIPPED_UNAVAILABLE") return "ข้ามเพราะไม่ว่าง";
  if (normalized === "SKIPPED_BUSY") return "ข้ามเพราะมีงานทับ";
  return getAssignModeLabel(mode);
}

function getMobileSummaryLabel(mode) {
  const normalized = String(mode || "").trim().toUpperCase();
  if (normalized === "AUTO_RECOMMENDED") return "สร้าง";
  if (normalized === "MANUAL_OVERRIDE") return "แก้ไข";
  if (normalized === "SKIPPED_UNAVAILABLE" || normalized === "SKIPPED_BUSY") return "ยกเลิก";
  return getAssignModeMobileLabel(mode);
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
  { value: "MANUAL_OVERRIDE", label: "เลือกจริง" },
  { value: "SKIPPED_UNAVAILABLE", label: "ข้ามคิว: ไม่ว่าง" },
  { value: "SKIPPED_BUSY", label: "ข้ามคิว: มีงานทับ" },
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

function getMobilePageWindow(page, totalPages) {
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

export default function DriverQueueLogs() {
  const isMobile = useIsMobile();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expandedRowId, setExpandedRowId] = useState("");
  const [mobilePage, setMobilePage] = useState(1);
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
  const visibleLogs = filteredLogs;
  const mobileTotalPages = useMemo(
    () => Math.max(1, Math.ceil(visibleLogs.length / MOBILE_ROWS_PER_PAGE)),
    [visibleLogs.length]
  );
  const mobilePageItems = useMemo(() => {
    const start = (mobilePage - 1) * MOBILE_ROWS_PER_PAGE;
    return visibleLogs.slice(start, start + MOBILE_ROWS_PER_PAGE);
  }, [visibleLogs, mobilePage]);

  useEffect(() => {
    setExpandedRowId("");
    setMobilePage(1);
  }, [filters, sortedLogs]);

  useEffect(() => {
    if (mobilePage > mobileTotalPages) {
      setMobilePage(mobileTotalPages);
    }
  }, [mobilePage, mobileTotalPages]);

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
  console.log("DELETE LOG =", log);

  const logId = String(
    log.log_id ||
    log.id ||
    log.queue_log_id ||
    log.row_number ||
    ""
  ).trim();

  console.log("DELETE ID =", logId);

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

  const renderToneClass = (tone) => {
    if (tone === "blue") return "bg-blue-100 text-blue-700";
    if (tone === "amber") return "bg-amber-100 text-amber-700";
    if (tone === "green") return "bg-emerald-100 text-emerald-700";
    return "bg-slate-100 text-slate-700";
  };
  const activeFilterCount = [filters.keyword, filters.assignMode, filters.createdBy].filter(Boolean).length;

  if (isMobile) {
    const mobileStart = visibleLogs.length === 0 ? 0 : (mobilePage - 1) * MOBILE_ROWS_PER_PAGE + 1;
    const mobileEnd = Math.min(mobilePage * MOBILE_ROWS_PER_PAGE, visibleLogs.length);
    const mobilePageNumbers = getMobilePageWindow(mobilePage, mobileTotalPages);

    return (
      <div className="driver-queue-logs-mobile mt-[57px] flex w-full flex-col gap-3 pb-6">
        <MobilePageHeader
          title="ประวัติคิวคนขับ"
          subtitle="บันทึกการมอบหมายงานและการเลื่อนคิวแบบ circular master queue"
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
                    placeholder="ค้นหาเลขที่จอง ชื่อคนขับ เหตุผล"
                    labelClassName="text-[15px] font-semibold text-slate-600"
                    inputClassName="mobile-filter-input h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                  <FilterField
                    label="รูปแบบ"
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
                      ตัวกรองที่ใช้งาน {activeFilterCount || 0}
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
            subtitle={`แสดง ${mobileStart}-${mobileEnd} จากทั้งหมด ${visibleLogs.length} รายการ`}
            actions={
              <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                หน้า {mobilePage} / {mobileTotalPages}
              </span>
            }
          >
            {visibleLogs.length === 0 ? (
              <div className="mobile-empty-state">ไม่พบประวัติ</div>
            ) : (
              <div className="grid gap-[10px]">
                {mobilePageItems.map((log, index) => {
                  const assignTone = getAssignModeTone(log.assign_mode);
                  const rowNumber = (mobilePage - 1) * MOBILE_ROWS_PER_PAGE + index + 1;
                  const rowKey = String(log.log_id || `${mobilePage}-${index}`);
                  const isExpanded = expandedRowId === rowKey;
                  const isDeleting = deletingId === String(log.log_id || "");
                  const skippedDrivers = safeJsonSummary(log.skipped_drivers_json);
                  const queueBefore = log.queue_before_index ?? log.queue_before ?? "-";
                  const queueAfter = log.queue_after_index ?? log.queue_after ?? "-";

                  return (
                    <article
                      key={rowKey}
                      className={`mobile-data-card booking-mobile-card driver-queue-logs-mobile-card${isExpanded ? " is-expanded" : ""}`}
                    >
                      <button
                        type="button"
                        className="driver-queue-logs-mobile-card-summary"
                        aria-expanded={isExpanded}
                        onClick={() =>
                          setExpandedRowId((current) => (current === rowKey ? "" : rowKey))
                        }
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
                          title={log.created_by || "-"}
                        >
                          {log.created_by || "-"}
                        </div>
                        <div className="booking-mobile-card-summary-side">
                            <span className={`driver-queue-logs-mobile-card-summary-badge ${renderToneClass(assignTone)}`}>
                            {getAssignModeMobileLabel(log.assign_mode)}
                          </span>
                          <ChevronDownIcon
                            className={`booking-mobile-card-expand-icon driver-queue-logs-mobile-card-expand-icon${isExpanded ? " is-expanded" : ""}`}
                          />
                        </div>
                      </button>

                      {isExpanded ? (
                        <div className="booking-mobile-card-expanded driver-queue-log-expanded-detail" id={rowKey}>
                          <div className="driver-queue-log-detail-item">
                            <span>วันที่</span>
                            <b>{formatThaiDateTime(log.created_at)}</b>
                          </div>

                          <div className="driver-queue-log-detail-item">
                            <span>ประเภท</span>
                            <b>{getAssignModeLabel(log.assign_mode)}</b>
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
                            <span>สถานะคิว</span>
                            <b>{log.reason || "-"}</b>
                          </div>

                          <div className="driver-queue-log-detail-item">
                            <span>ลำดับคิว</span>
                            <b>
                              <span className="driver-queue-log-flow">
                                <span>{queueBefore}</span>
                                <span>→</span>
                                <span>{queueAfter}</span>
                              </span>
                            </b>
                          </div>

                          <div className="driver-queue-log-detail-item">
                            <span>รายการที่ข้ามคิว</span>
                            <b>{skippedDrivers}</b>
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

            <div className="driver-queue-logs-mobile-pagination">
              <button
                type="button"
                onClick={() => {
                  setMobilePage(1);
                  setExpandedRowId("");
                }}
                disabled={mobilePage <= 1}
              >
                แรก
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobilePage((current) => Math.max(1, current - 1));
                  setExpandedRowId("");
                }}
                disabled={mobilePage <= 1}
              >
                ก่อนหน้า
              </button>
              {mobilePageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={mobilePage === pageNumber ? "active-page" : ""}
                  onClick={() => {
                    setMobilePage(pageNumber);
                    setExpandedRowId("");
                  }}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMobilePage((current) => Math.min(mobileTotalPages, current + 1));
                  setExpandedRowId("");
                }}
                disabled={mobilePage >= mobileTotalPages}
              >
                ถัดไป
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobilePage(mobileTotalPages);
                  setExpandedRowId("");
                }}
                disabled={mobilePage >= mobileTotalPages}
              >
                ท้าย
              </button>
            </div>
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
          <p>บันทึกการมอบหมายงานและการเลื่อนคิวแบบ circular master queue</p>
        </div>

        <button type="button" disabled={refreshing || loading} onClick={() => loadData({ refreshOnly: true })}>
          {refreshing ? "กำลังรีเฟรช..." : "รีเฟรชข้อมูล"}
        </button>
      </div>

      {loading && <div className="form-card">กำลังโหลดข้อมูล...</div>}
      {error && !loading && <div className="form-card">{error}</div>}

      {!loading && !error && (
        <div className="form-card">
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
                placeholder="เลขที่จอง ชื่อคนขับ เหตุผล"
              />
              <FilterField
                label="รูปแบบ"
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

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>เลขที่จอง</th>
                  <th>คนขับที่ระบบแนะนำ</th>
                  <th>คนขับที่เลือกจริง</th>
                  <th>รูปแบบ</th>
                  <th>เหตุผล</th>
                  <th>คิวก่อน</th>
                  <th>คิวหลัง</th>
                  <th>ข้ามเพราะไม่ว่าง/ติดภารกิจ</th>
                  <th>ผู้บันทึก</th>
                </tr>
              </thead>
              <tbody>
                {sortedLogs.length === 0 ? (
                  <tr>
                    <td colSpan="10">ไม่พบประวัติ</td>
                  </tr>
                ) : (
                  sortedLogs.map((log) => (
                    <tr key={log.log_id}>
                      <td>{formatThaiDateTime(log.created_at)}</td>
                      <td>{log.booking_no || log.booking_id || "-"}</td>
                      <td>{log.recommended_driver_name || "-"}</td>
                      <td>{log.assigned_driver_name || "-"}</td>
                      <td>{getAssignModeLabel(log.assign_mode)}</td>
                      <td>{log.reason || "-"}</td>
                      <td>{log.queue_before_index || "-"}</td>
                      <td>{log.queue_before || "-"}</td>
                      <td>{log.queue_after_index || "-"}</td>
                      <td>{log.queue_after || "-"}</td>
                      <td style={{ whiteSpace: "pre-wrap" }}>{safeJsonSummary(log.skipped_drivers_json)}</td>
                      <td>{log.created_by || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
