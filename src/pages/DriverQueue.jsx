import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  getDriverQueue,
  getDriverQueueState,
  getUsers,
  resetDriverQueuePointer,
  setCurrentDriverQueuePointer,
  updateDriverQueueMaster,
} from "../api";
import { formatThaiDateTime } from "../utils/date";
import { showConfirm, showError, showSuccess } from "../utils/alert";
import { hasPermission } from "../permissions";

function sortQueue(items) {
  return [...items].sort((a, b) => {
    const orderA = Number(a.queue_order || 0);
    const orderB = Number(b.queue_order || 0);
    if (orderA !== orderB) return orderA - orderB;
    return String(a.display_name || a.driver_name || "").localeCompare(String(b.display_name || b.driver_name || ""), "th");
  });
}

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function getStatusMeta(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "ACTIVE") return { label: "ACTIVE", className: "green" };
  if (normalized === "INACTIVE") return { label: "INACTIVE", className: "gray" };
  return { label: normalized || "-", className: "gray" };
}

function getQueueState(state) {
  return {
    current_index: Number(state?.current_index || 0) || 0,
    current_driver_user_id: String(state?.current_driver_user_id || "").trim(),
    current_driver_name: String(state?.current_driver_name || "").trim(),
    last_assigned_driver_user_id: String(state?.last_assigned_driver_user_id || "").trim(),
    last_assigned_driver_name: String(state?.last_assigned_driver_name || "").trim(),
    last_assigned_booking_id: String(state?.last_assigned_booking_id || "").trim(),
    state_value: String(state?.state_value || "0").trim() || "0",
  };
}

function getCurrentDriver(queue, state) {
  if (!queue.length) return null;

  const byId = queue.find(
    (row) => String(row.driver_user_id || "").trim() === String(state.current_driver_user_id || "").trim()
  );
  if (byId) return byId;

  const byIndex = queue[state.current_index];
  if (byIndex) return byIndex;
  return queue[0] || null;
}

function getNextDriver(queue, currentDriver) {
  if (!queue.length) return null;
  const currentIndex = queue.findIndex(
    (row) => String(row.driver_user_id || "").trim() === String(currentDriver?.driver_user_id || "").trim()
  );
  if (currentIndex < 0) return queue[0] || null;
  return queue[(currentIndex + 1) % queue.length] || queue[0] || null;
}

function moveQueueItem(items, fromIndex, toIndex) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next.map((row, index) => ({
    ...row,
    queue_order: index + 1,
  }));
}

export default function DriverQueue() {
  const [queue, setQueue] = useState([]);
  const [state, setState] = useState(getQueueState(null));
  const [draftQueue, setDraftQueue] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const canManageQueue = hasPermission(null, "driver_queue_manage");
  const canResetQueue = hasPermission(null, "driver_queue_reset");
  const canViewQueue = hasPermission(null, "driver_queue_view") || canManageQueue || canResetQueue;

  const loadData = useCallback(async (options = {}) => {
    try {
      if (options.refreshOnly) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const [queueData, stateData, userData] = await Promise.all([
        getDriverQueue(options.refreshOnly ? { fresh: true } : {}),
        getDriverQueueState(options.refreshOnly ? { fresh: true } : {}),
        getUsers(options.refreshOnly ? { fresh: true } : {}),
      ]);

      const userRows = Array.isArray(userData) ? userData : [];
      const activeDriverRows = userRows.filter(
        (user) =>
          String(user.role || "").trim().toUpperCase() === "DRIVER" &&
          String(user.status || "").trim().toUpperCase() === "ACTIVE"
      );
      const driverNameById = new Map(
        activeDriverRows.map((driver) => [
          String(driver.user_id || "").trim(),
          driver.name || driver.email || "-",
        ])
      );

      const queueRows = sortQueue(
        (Array.isArray(queueData?.data) ? queueData.data : []).map((row) => {
          const driverId = String(row.driver_user_id || "").trim();
          const displayName = driverNameById.get(driverId) || row.driver_name || "-";
          return {
            ...row,
            display_name: displayName,
            driver_name: displayName,
          };
        })
      );
      const nextState = getQueueState(queueData?.state || stateData || null);
      setQueue(queueRows);
      setDraftQueue(queueRows);
      setUsers(activeDriverRows);
      setState(nextState);
    } catch (err) {
      const message = err.message || "โหลดข้อมูลไม่สำเร็จ";
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentDriver = useMemo(() => getCurrentDriver(draftQueue, state), [draftQueue, state]);
  const nextDriver = useMemo(() => getNextDriver(draftQueue, currentDriver), [currentDriver, draftQueue]);
  const driverNameById = useMemo(
    () =>
      new Map(
        users.map((driver) => [String(driver.user_id || "").trim(), driver.name || driver.email || "-"])
      ),
    [users]
  );
  const resolveDriverName = useCallback(
    (queueRow) =>
      driverNameById.get(String(queueRow?.driver_user_id || "").trim()) ||
      queueRow?.display_name ||
      queueRow?.driver_name ||
      "-",
    [driverNameById]
  );
  const isDirty = useMemo(() => JSON.stringify(queue) !== JSON.stringify(draftQueue), [queue, draftQueue]);

  const handleDragStart = useCallback((index) => {
    setDragIndex(index);
    setDragOverIndex(index);
  }, []);

  const handleDragOver = useCallback((index, event) => {
    event.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((index) => {
    setDraftQueue((current) => {
      if (dragIndex === null || dragIndex === index) return current;
      return moveQueueItem(current, dragIndex, index);
    });
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const updateDraftRow = useCallback((queueId, updater) => {
    setDraftQueue((current) =>
      current.map((row) => (String(row.queue_id || "") === String(queueId || "") ? updater(row) : row))
    );
  }, []);

  const handleMove = useCallback((queueRow, direction) => {
    setDraftQueue((current) => {
      const index = current.findIndex((row) => String(row.queue_id || "") === String(queueRow.queue_id || ""));
      if (index < 0) return current;
      const target = direction === "UP" ? index - 1 : index + 1;
      if (target < 0 || target >= current.length) return current;
      return moveQueueItem(current, index, target);
    });
  }, []);

  const handleToggleStatus = useCallback((queueRow) => {
    updateDraftRow(queueRow.queue_id, (row) => {
      const nextStatus = normalizeStatus(row.status) === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      return {
        ...row,
        status: nextStatus,
        is_active: nextStatus === "ACTIVE" ? "TRUE" : "FALSE",
      };
    });
  }, [updateDraftRow]);

  const handleEditNote = useCallback(async (queueRow) => {
    const result = await Swal.fire({
      title: "แก้ไขหมายเหตุคิว",
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

    updateDraftRow(queueRow.queue_id, (row) => ({
      ...row,
      note: result.value,
    }));
  }, [updateDraftRow]);

  const handleSaveQueue = useCallback(async () => {
    if (saving || !isDirty) return;

    try {
      setSaving(true);
      const response = await updateDriverQueueMaster({
        items: draftQueue.map((row, index) => ({
          queue_id: row.queue_id,
          driver_user_id: row.driver_user_id,
          driver_name: resolveDriverName(row),
          queue_order: index + 1,
          status: normalizeStatus(row.status) === "ACTIVE" ? "ACTIVE" : "INACTIVE",
          is_active: normalizeStatus(row.status) === "ACTIVE" ? "TRUE" : "FALSE",
          note: row.note || "",
        })),
        updated_by: "UI",
      });

      const nextQueue = sortQueue(Array.isArray(response?.queue) ? response.queue : draftQueue);
      const nextState = getQueueState(response?.state || state);
      setQueue(nextQueue);
      setDraftQueue(nextQueue);
      setState(nextState);
      await showSuccess("บันทึกคิวสำเร็จ");
    } catch (err) {
      showError(err.message || "บันทึกคิวไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }, [draftQueue, isDirty, resolveDriverName, saving, state]);

  const handleSetCurrentPointer = useCallback(async (queueRow) => {
    try {
      await setCurrentDriverQueuePointer({
        driver_user_id: queueRow.driver_user_id,
        updated_by: "UI",
      });
      await loadData({ refreshOnly: true });
      await showSuccess("ตั้งคิวปัจจุบันสำเร็จ");
    } catch (err) {
      showError(err.message || "ตั้งคิวปัจจุบันไม่สำเร็จ");
    }
  }, [loadData]);

  const handleResetPointer = useCallback(async () => {
    const confirmed = await showConfirm("ยืนยันรีเซ็ตคิวให้เริ่มที่คนแรกใช่หรือไม่?");
    if (!confirmed) return;

    try {
      await resetDriverQueuePointer({ updated_by: "UI" });
      await loadData({ refreshOnly: true });
      await showSuccess("รีเซ็ตคิวเริ่มที่คนแรกสำเร็จ");
    } catch (err) {
      showError(err.message || "รีเซ็ตคิวไม่สำเร็จ");
    }
  }, [loadData]);

  if (!canViewQueue) {
    return <div className="form-card">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>คิวคนขับ</h2>
          <p>จัดลำดับคิวและตัวชี้คิวแบบวงกลม</p>
        </div>

        <div className="section-toolbar">
          <button type="button" disabled={refreshing || loading} onClick={() => loadData({ refreshOnly: true })}>
            {refreshing ? "กำลังรีเฟรช..." : "รีเฟรชข้อมูล"}
          </button>
          
          {canResetQueue && (
            <button type="button" className="warning-button" onClick={handleResetPointer}>
              รีเซ็ตคิวเริ่มที่คนแรก
            </button>
          )}
        </div>
      </div>

      <div className="form-card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>คิวปัจจุบัน</h3>
        <div style={{ display: "grid", gap: 6 }}>
          <strong style={{ fontSize: 32 }}>{resolveDriverName(currentDriver)}</strong>
          <div style={{ color: "#475569" }}>
            คิวปัจจุบัน: {resolveDriverName(currentDriver)} | ลำดับคิว: {currentDriver?.queue_order || "-"}
          </div>
          <div style={{ color: "#475569" }}>
            คิวถัดไปหลังมอบหมาย: {resolveDriverName(nextDriver)}
          </div>
        </div>
      </div>

      {loading && <div className="form-card">กำลังโหลดข้อมูล...</div>}
      {error && !loading && <div className="form-card">{error}</div>}

      {!loading && !error && (
        <div className="form-card">
          <div className="table-wrap">
                    {canManageQueue && (
            <button type="button"   style={{ marginLeft: "auto", display: "block" }} disabled={!isDirty || saving} onClick={handleSaveQueue}>
              {saving ? "กำลังบันทึก..." : "บันทึกคิว"}
            </button>
          )}
          <br />
            <table>
              <thead>
                <tr>
                  <th>ลำดับ</th>
                  <th>คนขับ</th>
                  <th>สถานะคิว</th>
                  <th>หมายเหตุ</th>
                  <th>คิวล่าสุด</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {draftQueue.length === 0 ? (
                  <tr>
                    <td colSpan="6">ไม่พบข้อมูลคิวคนขับ</td>
                  </tr>
                ) : (
                  draftQueue.map((row, index) => {
                    const meta = getStatusMeta(row.status);
                    const isCurrent = currentDriver && String(currentDriver.driver_user_id || "") === String(row.driver_user_id || "");
                    const isNext = nextDriver && String(nextDriver.driver_user_id || "") === String(row.driver_user_id || "");
                    const isDraggingOver = dragOverIndex === index;

                    return (
                      <tr
                        key={row.queue_id || `${row.driver_user_id || ""}-${row.queue_order || ""}`}
                        draggable={canManageQueue}
                        onDragStart={() => canManageQueue && handleDragStart(index)}
                        onDragOver={(event) => canManageQueue && handleDragOver(index, event)}
                        onDrop={() => canManageQueue && handleDrop(index)}
                        onDragEnd={handleDragEnd}
                        style={{
                          background: isCurrent ? "#ecfdf5" : isNext ? "#eff6ff" : "transparent",
                          outline: isDraggingOver ? "2px solid #60a5fa" : "none",
                        }}
                      >
                        <td>{row.queue_order || "-"}</td>
                        <td>
                          <div>
                            <b>{resolveDriverName(row)}</b>
                            <div style={{ color: "#64748b" }}>{row.driver_user_id || "-"}</div>
                          </div>
                        </td>
                        <td>
                          <span className={`status ${meta.className}`}>{meta.label}</span>
                          {isCurrent && (
                            <div style={{ marginTop: 6 }}>
                              <span className="status green">คิวปัจจุบัน</span>
                            </div>
                          )}
                          {isNext && !isCurrent && (
                            <div style={{ marginTop: 6 }}>
                              <span className="status blue">คิวถัดไปหลังมอบหมาย</span>
                            </div>
                          )}
                        </td>
                        <td style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{row.note || "-"}</td>
                        <td>{formatThaiDateTime(row.last_assigned_at) || "-"}</td>
                        <td className="action-buttons">
                          {canManageQueue && (
                            <>
                              <button type="button" onClick={() => handleMove(row, "UP")} disabled={index === 0}>
                                ↑
                              </button>
                              <button type="button" onClick={() => handleMove(row, "DOWN")} disabled={index === draftQueue.length - 1}>
                                ↓
                              </button>
                              <button type="button" onClick={() => handleSetCurrentPointer(row)}>
                                ตั้งเป็นคิวปัจจุบัน
                              </button>
                              <button type="button" onClick={() => handleEditNote(row)}>
                                แก้ไขหมายเหตุ
                              </button>
                              <button
                                type="button"
                                className={normalizeStatus(row.status) === "ACTIVE" ? "warning-button" : ""}
                                onClick={() => handleToggleStatus(row)}
                              >
                                {normalizeStatus(row.status) === "ACTIVE" ? "ปิดคิว" : "เปิดคิว"}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                      
                    );
                  })
                )}
              </tbody>
            </table>
            <span style={{ color: "red" }}>* ปรับคิวโดยการคลิกแล้วลากสลับตำแหน่ง จากนั้นกดบันทึกคิว</span>  
          </div>
        </div>
      )}
    </div>
  );
}
