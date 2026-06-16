import { useEffect, useMemo, useState } from "react";
import { getDriverUnavailableLogs } from "../api";
import MobilePageHeader from "../layouts/MobilePageHeader";
import MobilePageSection from "../layouts/MobilePageSection";
import useIsMobile from "../hooks/useIsMobile";
import { formatThaiDateTime } from "../utils/date";
import { formatThaiDate, formatThaiTime } from "../utils/datetime";
import { showError } from "../utils/alert";

const LOGS_PER_PAGE = 5;

function sortLatestFirst(items) {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return dateB - dateA;
  });
}

function parseJsonMaybe(value) {
  if (typeof value !== "string") return value || null;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeType(type) {
  const raw = String(type || "").trim();
  if (!raw) return "ลา";
  if (raw.toLowerCase() === "holiday") return "ลา";
  if (raw.toLowerCase() === "unable to complete a task.") return "หยุด";
  if (raw.toUpperCase() === "LEAVE") return "ลา";
  if (raw.toUpperCase() === "TEMP_UNAVAILABLE") return "หยุด";
  if (raw === "ลา / หยุด") return "ลา";
  if (raw === "ติดภารกิจ (ชั่วคราว)") return "หยุด";
  if (raw.toUpperCase() === "OUT_PROVINCE" || raw === "ปฏิบัติงานต่างจังหวัด" || raw.toUpperCase() === "OTHER") {
    return "OUT_PROVINCE";
  }
  return raw;
}

function getTypeLabel(type) {
  const normalized = normalizeType(type);
  if (normalized === "ลา") return "ลา / หยุด";
  if (normalized === "หยุด") return "ติดภารกิจ (ชั่วคราว)";
  if (normalized === "OUT_PROVINCE") return "ปฏิบัติงานต่างจังหวัด";
  return normalized || "-";
}

function summarizeValue(value) {
  const parsed = parseJsonMaybe(value);
  if (!parsed) return "-";

  if (typeof parsed === "string") {
    return getTypeLabel(parsed);
  }

  const type = parsed.type ? getTypeLabel(parsed.type) : parsed.action || "";
  const reason = parsed.reason || "";
  const startDatetime = parsed.start_datetime ? formatThaiDateTime(parsed.start_datetime) : "";
  const endDatetime = parsed.end_datetime ? formatThaiDateTime(parsed.end_datetime) : "";
  const pieces = [type, reason, startDatetime && endDatetime ? `${startDatetime} - ${endDatetime}` : ""].filter(Boolean);

  if (pieces.length === 0) {
    return JSON.stringify(parsed);
  }

  return pieces.join(" | ");
}

function getActionLabel(action) {
  const normalized = String(action || "").trim().toUpperCase();
  if (normalized === "CREATED") return "สร้าง";
  if (normalized === "UPDATED") return "แก้ไข";
  if (normalized === "CANCELLED") return "ยกเลิก";
  return action || "-";
}

function getActionTone(action) {
  const normalized = String(action || "").trim().toUpperCase();
  if (normalized === "CREATED") return "green";
  if (normalized === "UPDATED") return "blue";
  if (normalized === "CANCELLED") return "red";
  return "gray";
}

function getLogParsedValue(log) {
  return parseJsonMaybe(log?.new_value) || parseJsonMaybe(log?.old_value) || null;
}

function getLogRecordId(log) {
  const parsed = getLogParsedValue(log);
  return parsed?.unavailable_id || log?.unavailable_id || log?.log_id || "-";
}

function getLogTypeDisplay(log) {
  const parsed = getLogParsedValue(log);
  return getTypeLabel(parsed?.type || log?.type || "");
}

function FilterField({
  label,
  value,
  onChange,
  placeholder = "",
  labelClassName = "text-[13px] font-semibold text-slate-600",
  inputClassName = "h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-[15px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100",
}) {
  return (
    <label className="grid gap-1">
      <span className={labelClassName}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClassName}
      />
    </label>
  );
}

function getLogSummary(log) {
  const nextValue = summarizeValue(log.new_value);
  return nextValue !== "-" ? nextValue : summarizeValue(log.old_value);
}

function MobilePagination({ page, total, onChange }) {
  if (total <= 1) return null;

  return (
    <div className="mt-3 flex items-center justify-center gap-1.5">
      <button
        type="button"
        className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={page <= 1}
        onClick={() => onChange((current) => Math.max(1, current - 1))}
      >
        ก่อนหน้า
      </button>

      {Array.from({ length: total }).map((_, index) => (
        <button
          key={index}
          type="button"
          className={[
            "inline-flex h-9 min-w-9 items-center justify-center rounded-xl border px-3 text-[13px] font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50",
            page === index + 1
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50",
          ].join(" ")}
          onClick={() => onChange(index + 1)}
        >
          {index + 1}
        </button>
      ))}

      <button
        type="button"
        className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={page >= total}
        onClick={() => onChange((current) => Math.min(total, current + 1))}
      >
        ถัดไป
      </button>
    </div>
  );
}

export default function DriverUnavailableLogs() {
  const isMobile = useIsMobile();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    keyword: "",
    action: "",
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

      const data = await getDriverUnavailableLogs(options.refreshOnly ? { fresh: true } : {});
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
  const visibleLogs = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    const action = String(filters.action || "").trim().toUpperCase();
    const createdBy = filters.createdBy.trim().toLowerCase();

    return sortedLogs.filter((log) => {
      if (action && String(log.action || "").trim().toUpperCase() !== action) {
        return false;
      }

      if (createdBy && !String(log.created_by || "").toLowerCase().includes(createdBy)) {
        return false;
      }

      if (keyword) {
        const rawSummary = [log.new_value, log.old_value]
          .map((value) => String(value || ""))
          .join(" ");
        const haystack = [log.driver_name, getLogSummary(log), rawSummary, log.created_by]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");

        if (!haystack.includes(keyword)) {
          return false;
        }
      }

      return true;
    });
  }, [filters, sortedLogs]);

  const historyPages = useMemo(() => Math.max(1, Math.ceil(visibleLogs.length / LOGS_PER_PAGE)), [visibleLogs.length]);
  const pageItems = useMemo(() => visibleLogs.slice((page - 1) * LOGS_PER_PAGE, page * LOGS_PER_PAGE), [visibleLogs, page]);

  useEffect(() => {
    setPage(1);
    setExpandedLogId(null);
  }, [filters, sortedLogs]);

  function setFilter(field, value) {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function clearFilters() {
    setFilters({
      keyword: "",
      action: "",
      createdBy: "",
    });
  }

  const activeFilterCount = [filters.keyword, filters.action, filters.createdBy].filter(Boolean).length;

  if (isMobile) {
    const pageStart = visibleLogs.length === 0 ? 0 : (page - 1) * LOGS_PER_PAGE + 1;
    const pageEnd = Math.min(page * LOGS_PER_PAGE, visibleLogs.length);

    return (
      <div className="driver-unavailable-logs-mobile mt-[57px] flex w-full flex-col gap-3 pb-6">
        <MobilePageHeader
          title="ประวัติการปฏิบัติงาน"
          subtitle="บันทึกการสร้าง แก้ไข และยกเลิกวันไม่ปฏิบัติงาน"
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

        <MobilePageSection
          title="ตัวกรองข้อมูล"
          subtitle="ค้นหาประวัติการปฏิบัติงาน"
          actions={
            <button
              type="button"
              className="mobile-filter-button inline-flex items-center gap-1.5 border border-blue-600 bg-blue-600 shadow-sm transition hover:bg-blue-700"
              aria-expanded={isMobileFilterOpen}
              onClick={() => setIsMobileFilterOpen((current) => !current)}
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
                  placeholder="ค้นหาคนขับ รายละเอียด ผู้บันทึก"
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
                    ตัวกรองที่ใช้งาน {activeFilterCount}
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
          title="ประวัติรายการ"
          subtitle={
            visibleLogs.length > 0
              ? `แสดง ${pageStart}-${pageEnd} จากทั้งหมด ${visibleLogs.length} รายการ`
              : "ไม่พบประวัติการปฏิบัติงาน"
          }
          actions={
            <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
              หน้า {page}/{historyPages}
            </span>
          }
        >
          {loading ? (
            <div className="mobile-empty-state">กำลังโหลดข้อมูล...</div>
          ) : error ? (
            <div className="mobile-empty-state">
              <span className="text-sm font-medium text-red-700">{error}</span>
            </div>
          ) : visibleLogs.length === 0 ? (
            <div className="mobile-empty-state">ไม่พบประวัติการปฏิบัติงาน</div>
          ) : pageItems.length === 0 && visibleLogs.length > 0 ? (
            <div className="mobile-empty-state">ไม่พบประวัติการปฏิบัติงาน</div>
          ) : (
            <div className="grid gap-[10px]">
              {pageItems.map((log) => (
                <article key={log.log_id} className="driver-unavailable-logs-mobile-card">
                  <div className="driver-unavailable-logs-mobile-row">
                    <span className="driver-unavailable-logs-mobile-label">วันที่</span>
                    <span className="driver-unavailable-logs-mobile-value">{formatThaiDate(log.created_at) || "-"}</span>
                  </div>

                  <div className="driver-unavailable-logs-mobile-row">
                    <span className="driver-unavailable-logs-mobile-label">บันทึก</span>
                    <span className="driver-unavailable-logs-mobile-value">{formatThaiTime(log.created_at) || "-"}</span>
                  </div>

                  <div className="driver-unavailable-logs-mobile-block">
                    <span className="driver-unavailable-logs-mobile-block-label">เลขที่บันทึก</span>
                    <span className="driver-unavailable-logs-booking-link">{getLogRecordId(log)}</span>
                  </div>

                  <div className="driver-unavailable-logs-mobile-block">
                    <span className="driver-unavailable-logs-mobile-block-label">คนขับ</span>
                    <span className="driver-unavailable-logs-mobile-strong">{log.driver_name || "-"}</span>
                  </div>

                  <div className="driver-unavailable-logs-mobile-row">
                    <span className="driver-unavailable-logs-mobile-label">ประเภท</span>
                    <span className="driver-unavailable-logs-mobile-value">{getLogTypeDisplay(log)}</span>
                  </div>

                  <div className="driver-unavailable-logs-mobile-row">
                    <span className="driver-unavailable-logs-mobile-label">การทำรายการ</span>
                    <span
                      className={[
                        "driver-unavailable-logs-mobile-badge",
                        getActionTone(log.action) === "green"
                          ? "is-green"
                          : getActionTone(log.action) === "blue"
                            ? "is-blue"
                            : getActionTone(log.action) === "red"
                              ? "is-red"
                              : "is-gray",
                      ].join(" ")}
                    >
                      {getActionLabel(log.action)}
                    </span>
                  </div>

                  {expandedLogId === log.log_id ? (
                    <div className="driver-unavailable-logs-mobile-summary">
                      <div className="driver-unavailable-logs-mobile-summary-row">
                        <span className="driver-unavailable-logs-mobile-summary-label">รายละเอียด</span>
                        <span className="driver-unavailable-logs-mobile-summary-value">{getLogSummary(log)}</span>
                      </div>
                      <div className="driver-unavailable-logs-mobile-summary-row">
                        <span className="driver-unavailable-logs-mobile-summary-label">ผู้บันทึก</span>
                        <span className="driver-unavailable-logs-mobile-summary-value">{log.created_by || "-"}</span>
                      </div>
                      <div className="driver-unavailable-logs-mobile-summary-row">
                        <span className="driver-unavailable-logs-mobile-summary-label">วันเวลา</span>
                        <span className="driver-unavailable-logs-mobile-summary-value">{formatThaiDateTime(log.created_at)}</span>
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="driver-unavailable-logs-detail-button"
                    onClick={() => setExpandedLogId((current) => (current === log.log_id ? null : log.log_id))}
                  >
                    {expandedLogId === log.log_id ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
                  </button>
                </article>
              ))}
            </div>
          )}

          <MobilePagination page={page} total={historyPages} onChange={setPage} />
        </MobilePageSection>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>ประวัติการปฏิบัติงาน</h2>
          <p>บันทึกการสร้าง แก้ไข และยกเลิกวันไม่ปฏิบัติงาน</p>
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
                <span className="text-[25px] font-bold text-slate-900">ตัวกรองข้อมูล</span>
                <p className="mt-1 text-[20px] leading-6 text-slate-500">
                  ค้นหาตามคนขับ รายละเอียด หรือผู้บันทึก
                </p>
              </div>
              <div className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[20px] font-semibold text-slate-600 shadow-sm">
                ใช้งาน {activeFilterCount} ตัวกรอง
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <FilterField
                label="ค้นหา"
                value={filters.keyword}
                onChange={(value) => setFilter("keyword", value)}
                placeholder="ค้นหาคนขับ รายละเอียด ผู้บันทึก"
                labelClassName="text-[20px]"
              />
              <FilterField
                label="ผู้บันทึก"
                value={filters.createdBy}
                onChange={(value) => setFilter("createdBy", value)}
                placeholder="ค้นหาผู้บันทึก"
                labelClassName="text-[20px]"
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

          {visibleLogs.length === 0 ? (
            <div className="mobile-empty-state">ไม่พบประวัติการปฏิบัติงาน</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>คนขับ</th>
                    <th>รายละเอียด</th>
                    <th>วันที่</th>
                    <th>ผู้บันทึก</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLogs.length === 0 ? (
                    <tr>
                      <td colSpan="5">ไม่พบประวัติ</td>
                    </tr>
                  ) : (
                    visibleLogs.map((log) => (
                      <tr key={log.log_id}>
                        <td>{log.driver_name || "-"}</td>
                        <td>{getLogSummary(log)}</td>
                        <td>{formatThaiDateTime(log.created_at)}</td>
                        <td>{log.created_by || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
