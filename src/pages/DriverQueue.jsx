import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  getDriverQueue,
  getDriverQueueState,
  resetDriverQueueState,
  updateDriverQueue,
} from "../api";
import { formatThaiDateTime } from "../utils/date";
import { showConfirm, showError, showSuccess } from "../utils/alert";

function sortQueue(items) {
  return [...items].sort((a, b) => {
    const orderA = Number(a.queue_order || 0);
    const orderB = Number(b.queue_order || 0);
    if (orderA !== orderB) return orderA - orderB;
    return String(a.driver_name || "").localeCompare(String(b.driver_name || ""), "th");
  });
}

function getStatusMeta(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "ACTIVE") return { label: "ACTIVE", className: "green" };
  if (normalized === "INACTIVE") return { label: "INACTIVE", className: "gray" };
  return { label: normalized || "-", className: "gray" };
}

function getQueueStateValue(state) {
  return String(state?.state_value || "0").trim() || "0";
}

export default function DriverQueue() {
  const [queue, setQueue] = useState([]);
  const [state, setState] = useState(null);
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

      const [queueData, stateData] = await Promise.all([
        getDriverQueue(options.refreshOnly ? { fresh: true } : {}),
        getDriverQueueState(options.refreshOnly ? { fresh: true } : {}),
      ]);

      setQueue(Array.isArray(queueData?.data) ? queueData.data : []);
      setState(queueData?.state || stateData || null);
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

  const sortedQueue = useMemo(() => sortQueue(queue), [queue]);

  const nextDriver = useMemo(() => {
    const pointer = Number(getQueueStateValue(state));
    const activeRows = sortedQueue.filter(
      (row) =>
        String(row.status || "").trim().toUpperCase() === "ACTIVE" &&
        String(row.driver_status || "").trim().toUpperCase() === "ACTIVE"
    );
    if (activeRows.length === 0) return null;

    const next = activeRows.find((row) => Number(row.queue_order || 0) > pointer);
    return next || activeRows[0] || null;
  }, [sortedQueue, state]);

  async function handleMove(queueRow, direction) {
    try {
      await updateDriverQueue({
        queue_id: queueRow.queue_id,
        move_direction: direction,
        updated_by: "UI",
      });
      await loadData({ refreshOnly: true });
      await showSuccess("อัปเดตลำดับคิวสำเร็จ");
    } catch (err) {
      showError(err.message || "อัปเดตลำดับคิวไม่สำเร็จ");
    }
  }

  async function handleToggleStatus(queueRow) {
    const nextStatus = String(queueRow.status || "").trim().toUpperCase() === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateDriverQueue({
        queue_id: queueRow.queue_id,
        status: nextStatus,
        updated_by: "UI",
      });
      await loadData({ refreshOnly: true });
      await showSuccess("อัปเดตสถานะคิวสำเร็จ");
    } catch (err) {
      showError(err.message || "อัปเดตสถานะคิวไม่สำเร็จ");
    }
  }

  async function handleEditNote(queueRow) {
    const result = await Swal.fire({
      title: "แก้ไขหมายเหตุ",
      input: "text",
      inputValue: queueRow.note || "",
      inputPlaceholder: "ระบุหมายเหตุ",
      showCancelButton: true,
      confirmButtonText: "บันทึก",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#1455c8",
      cancelButtonColor: "#64748b",
    });

    if (!result.isConfirmed) return;

    try {
      await updateDriverQueue({
        queue_id: queueRow.queue_id,
        note: result.value,
        updated_by: "UI",
      });
      await loadData({ refreshOnly: true });
      await showSuccess("บันทึกหมายเหตุสำเร็จ");
    } catch (err) {
      showError(err.message || "บันทึกหมายเหตุไม่สำเร็จ");
    }
  }

  async function handleResetPointer() {
    const confirmed = await showConfirm("ยืนยันรีเซ็ตตัวชี้คิวเป็น 0 ใช่หรือไม่?");
    if (!confirmed) return;

    try {
      await resetDriverQueueState({
        last_assigned_queue_order: 0,
        updated_by: "UI",
      });
      await loadData({ refreshOnly: true });
      await showSuccess("รีเซ็ตตัวชี้คิวสำเร็จ");
    } catch (err) {
      showError(err.message || "รีเซ็ตตัวชี้คิวไม่สำเร็จ");
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>คิวคนขับ</h2>
          <p>จัดลำดับคิวและตัวชี้การมอบหมายงานแบบวงกลม</p>
        </div>

        <div className="section-toolbar">
          <button type="button" disabled={refreshing || loading} onClick={() => loadData({ refreshOnly: true })}>
            {refreshing ? "กำลังรีเฟรช..." : "รีเฟรชข้อมูล"}
          </button>
          <button type="button" className="warning-button" onClick={handleResetPointer}>
            รีเซ็ตตัวชี้คิว
          </button>
        </div>
      </div>

      <div className="form-card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>คนขับคิวถัดไป</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <strong style={{ fontSize: 32 }}>{nextDriver ? nextDriver.driver_name : "-"}</strong>
          <div style={{ color: "#475569" }}>
            ตัวชี้ปัจจุบัน: {getQueueStateValue(state)} | คิวถัดไป: {nextDriver ? nextDriver.queue_order : "-"}
          </div>
        </div>
      </div>

      {loading && <div className="form-card">กำลังโหลดข้อมูล...</div>}
      {error && !loading && <div className="form-card">{error}</div>}

      {!loading && !error && (
        <div className="form-card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ลำดับ</th>
                  <th>คนขับ</th>
                  <th>สถานะคิว</th>
                  <th>มอบหมายล่าสุด</th>
                  <th>งานล่าสุด</th>
                  <th>หมายเหตุ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {sortedQueue.length === 0 ? (
                  <tr>
                    <td colSpan="7">ไม่พบข้อมูลคิวคนขับ</td>
                  </tr>
                ) : (
                  sortedQueue.map((row) => {
                    const meta = getStatusMeta(row.status);
                    const isActive = String(row.status || "").trim().toUpperCase() === "ACTIVE";

                    return (
                      <tr key={row.queue_id}>
                        <td>{row.queue_order || "-"}</td>
                        <td>
                          <div>
                            <b>{row.driver_name || "-"}</b>
                            <div style={{ color: "#64748b" }}>{row.driver_user_id || "-"}</div>
                          </div>
                        </td>
                        <td>
                          <span className={`status ${meta.className}`}>{meta.label}</span>
                        </td>
                        <td>{formatThaiDateTime(row.last_assigned_at)}</td>
                        <td>{row.last_booking_id || "-"}</td>
                        <td>{row.note || "-"}</td>
                        <td className="action-buttons">
                          <button type="button" onClick={() => handleMove(row, "UP")} disabled={!isActive}>
                            ขึ้น
                          </button>
                          <button type="button" onClick={() => handleMove(row, "DOWN")} disabled={!isActive}>
                            ลง
                          </button>
                          <button type="button" onClick={() => handleEditNote(row)}>
                            แก้ไขหมายเหตุ
                          </button>
                          <button
                            type="button"
                            className={isActive ? "warning-button" : ""}
                            onClick={() => handleToggleStatus(row)}
                          >
                            {isActive ? "ปิดคิว" : "เปิดคิว"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
