import { useEffect, useMemo, useState } from "react";
import { getDriverUnavailableLogs } from "../api";
import { formatThaiDateTime } from "../utils/date";
import { showError } from "../utils/alert";

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

function summarizeValue(value) {
  const parsed = parseJsonMaybe(value);
  if (!parsed) return "-";

  if (typeof parsed === "string") {
    return parsed;
  }

  const type = parsed.type || parsed.action || "";
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

export default function DriverUnavailableLogs() {
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

  const visibleLogs = useMemo(() => sortLatestFirst(Array.isArray(logs) ? logs : []), [logs]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>ประวัติวันไม่รับงาน</h2>
          <p>บันทึกการสร้าง แก้ไข และยกเลิกวันไม่รับงาน</p>
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
                  <th>คนขับ</th>
                  <th>action</th>
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
                      <td>{getActionLabel(log.action)}</td>
                      <td>
                        {summarizeValue(log.new_value) !== "-"
                          ? summarizeValue(log.new_value)
                          : summarizeValue(log.old_value)}
                      </td>
                      <td>{formatThaiDateTime(log.created_at)}</td>
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
