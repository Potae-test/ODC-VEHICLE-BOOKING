import { useEffect, useMemo, useState } from "react";
import { getDriverQueueLogs } from "../api";
import MobilePageHeader from "../layouts/MobilePageHeader";
import MobilePageSection from "../layouts/MobilePageSection";
import useIsMobile from "../hooks/useIsMobile";
import { formatThaiDateTime } from "../utils/date";
import { showError } from "../utils/alert";

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
  const visibleLogs = sortedLogs;
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
  }, [visibleLogs]);

  useEffect(() => {
    if (mobilePage > mobileTotalPages) {
      setMobilePage(mobileTotalPages);
    }
  }, [mobilePage, mobileTotalPages]);

  const renderToneClass = (tone) => {
    if (tone === "blue") return "bg-blue-100 text-blue-700";
    if (tone === "amber") return "bg-amber-100 text-amber-700";
    if (tone === "green") return "bg-emerald-100 text-emerald-700";
    return "bg-slate-100 text-slate-700";
  };

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
                  const bookingNo = log.booking_no || log.booking_id || "-";
                  const assignTone = getAssignModeTone(log.assign_mode);
                  const summaryLabel = getMobileSummaryLabel(log.assign_mode);
                  const rowNumber = (mobilePage - 1) * MOBILE_ROWS_PER_PAGE + index + 1;
                  const rowKey = String(log.log_id || `${mobilePage}-${index}`);
                  const isExpanded = expandedRowId === rowKey;
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
                        <div className="booking-mobile-card-summary-requester" title={log.driver_name || "-"}>
                          {log.driver_name || "-"}
                        </div>
                        <div className="booking-mobile-card-summary-destination" title={summaryLabel}>
                          {summaryLabel}
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
