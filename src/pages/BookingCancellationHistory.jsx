import { useEffect, useMemo, useState } from "react";
import { deleteBookingCancellationHistory, getBookingCancellationHistory } from "../api";
import { formatThaiDateTime } from "../utils/date";
import { hasPermission, normalizeRole } from "../permissions";
import { showConfirm, showError, showSuccess } from "../utils/alert";

const ROWS_PER_PAGE = 5;

function sortLatestFirst(items) {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.cancelled_at || a.updated_at || a.created_at).getTime();
    const dateB = new Date(b.cancelled_at || b.updated_at || b.created_at).getTime();
    return dateB - dateA;
  });
}

function paginate(items, page) {
  const start = (page - 1) * ROWS_PER_PAGE;
  return items.slice(start, start + ROWS_PER_PAGE);
}

function totalPages(items) {
  return Math.max(1, Math.ceil(items.length / ROWS_PER_PAGE));
}

function Pagination({ page, total, onChange }) {
  return (
    <div className="pagination">
      {Array.from({ length: total }).map((_, index) => (
        <button
          key={index}
          type="button"
          className={page === index + 1 ? "active-page" : ""}
          onClick={() => onChange(index + 1)}
        >
          {index + 1}
        </button>
      ))}
    </div>
  );
}

function getStatusMeta() {
  return {
    label: "ยกเลิกแล้ว",
    className: "red",
    help: "รายการนี้ถูกยกเลิกและบันทึกลงในประวัติการยกเลิก",
  };
}

export default function BookingCancellationHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState("");
  const [filters, setFilters] = useState({
    requester: "",
    destination: "",
    reason: "",
    cancelled_by: "",
  });

  const canViewHistory = hasPermission(null, "bookings_view");
  const currentRole = useMemo(() => {
    try {
      const savedUser = JSON.parse(localStorage.getItem("odc_user") || "null");
      return normalizeRole(savedUser?.role);
    } catch {
      return "";
    }
  }, []);
  const canManageHistory = currentRole === "ADMIN" || currentRole === "STAFF";

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const data = await getBookingCancellationHistory();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err.message || "โหลดประวัติการยกเลิกไม่สำเร็จ";
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const filteredHistory = useMemo(() => {
    const requester = filters.requester.trim().toLowerCase();
    const destination = filters.destination.trim().toLowerCase();
    const reason = filters.reason.trim().toLowerCase();
    const cancelledBy = filters.cancelled_by.trim().toLowerCase();

    return sortLatestFirst(history).filter((item) => {
      if (requester && !String(item.requester_name || "").toLowerCase().includes(requester)) {
        return false;
      }

      if (destination && !String(item.destination || "").toLowerCase().includes(destination)) {
        return false;
      }

      if (reason && !String(item.reason || "").toLowerCase().includes(reason)) {
        return false;
      }

      if (cancelledBy && !String(item.cancelled_by || "").toLowerCase().includes(cancelledBy)) {
        return false;
      }

      return true;
    });
  }, [history, filters]);

  const historyPages = totalPages(filteredHistory);
  const pageItems = paginate(filteredHistory, page);

  useEffect(() => {
    if (page > historyPages) {
      setPage(historyPages);
    }
  }, [page, historyPages]);

  function setFilter(field, value) {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function clearFilters() {
    setFilters({
      requester: "",
      destination: "",
      reason: "",
      cancelled_by: "",
    });
  }

  async function handleDelete(item) {
    if (!canManageHistory) {
      return;
    }

    const cancellationId = item.cancellation_id;
    if (!cancellationId) {
      showError("ไม่พบรหัสรายการที่ต้องการลบ");
      return;
    }

    const confirmed = await showConfirm(
      `ต้องการลบประวัติการยกเลิกรายการ ${item.booking_no || cancellationId} ใช่หรือไม่`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(cancellationId);
      await deleteBookingCancellationHistory(cancellationId);
      await loadData();
      showSuccess("ลบประวัติการยกเลิกสำเร็จ");
    } catch (err) {
      const message = err.message || "ลบประวัติการยกเลิกไม่สำเร็จ";
      showError(message);
    } finally {
      setDeletingId("");
    }
  }

  const statusMeta = getStatusMeta();

  if (!canViewHistory) {
    return <div className="form-card">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>ประวัติรายการจองที่ถูกยกเลิก</h2>
          <p>ประวัติรายการจองที่ถูกยกเลิก พร้อมเหตุผลและผู้ยกเลิก</p>
        </div>

        <button type="button" onClick={loadData}>
          รีเฟรชข้อมูล
        </button>
      </div>

      {loading && <div className="form-card">กำลังโหลดประวัติการยกเลิก...</div>}

      {error && !loading && <div className="form-card">{error}</div>}

      {!loading && (
        <div className="form-card">
          <div className="section-header">
            <h3>รายการยกเลิกล่าสุด</h3>

            <button
              type="button"
              className="warning-button booking-filter-clear-button"
              onClick={clearFilters}
            >
              ล้างตัวกรอง
            </button>
          </div>

          <div className="form-grid booking-filter-grid" style={{ marginTop: 16 }}>
            <div>
              <label>ผู้จอง</label>
              <input
                value={filters.requester}
                onChange={(e) => setFilter("requester", e.target.value)}
                placeholder="ค้นหาชื่อผู้จอง"
              />
            </div>

            <div>
              <label>ปลายทาง</label>
              <input
                value={filters.destination}
                onChange={(e) => setFilter("destination", e.target.value)}
                placeholder="ค้นหาปลายทาง"
              />
            </div>

            <div>
              <label>เหตุผล</label>
              <input
                value={filters.reason}
                onChange={(e) => setFilter("reason", e.target.value)}
                placeholder="ค้นหาเหตุผล"
              />
            </div>

            <div>
              <label>ผู้ยกเลิก</label>
              <input
                value={filters.cancelled_by}
                onChange={(e) => setFilter("cancelled_by", e.target.value)}
                placeholder="ค้นหาผู้ยกเลิก"
              />
            </div>
          </div>

          <div className="table-wrap" style={{ marginTop: 24 }}>
            <table>
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>ผู้จอง</th>
                  <th>ปลายทาง</th>
                  <th>เหตุผล</th>
                  <th>ผู้ยกเลิก</th>
                  <th>ยกเลิกเมื่อ</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>

              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan="8">ไม่พบประวัติการยกเลิก</td>
                  </tr>
                ) : (
                  pageItems.map((item) => (
                    <tr key={item.cancellation_id || item.booking_id}>
                      <td>{item.booking_no || item.cancellation_id || "-"}</td>
                      <td>{item.requester_name || "-"}</td>
                      <td>{item.destination || "-"}</td>
                      <td>{item.reason || "-"}</td>
                      <td>{item.cancelled_by || "-"}</td>
                      <td>{formatThaiDateTime(item.cancelled_at || item.updated_at)}</td>
                      <td>
                        <span className={`status ${statusMeta.className}`} title={statusMeta.help}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td>
                        {canManageHistory ? (
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => handleDelete(item)}
                            disabled={deletingId === item.cancellation_id}
                          >
                            {deletingId === item.cancellation_id ? "กำลังลบ..." : "ลบ"}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination page={page} total={historyPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
