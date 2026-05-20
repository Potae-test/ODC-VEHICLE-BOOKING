import { useEffect, useMemo, useState } from "react";
import { getDriverQueueLogs } from "../api";
import { formatThaiDateTime } from "../utils/date";
import { showError } from "../utils/alert";

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

export default function DriverQueueLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

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
