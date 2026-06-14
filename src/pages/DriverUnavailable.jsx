import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import {
  cancelDriverUnavailable,
  createDriverUnavailable,
  getDriverUnavailable,
  getUsers,
  updateDriverUnavailable,
} from "../api";
import { formatThaiDateTime } from "../utils/date";
import { hasPermission, normalizeRole } from "../permissions";
import { showConfirm, showError, showSuccess } from "../utils/alert";
import ThaiDateTimeField from "../components/common/ThaiDateTimeField";
import { parseAppDateTime, toLocalDateTimeString } from "../utils/datetime";
import MobileGrid from "../layouts/MobileGrid";
import MobilePageHeader from "../layouts/MobilePageHeader";
import MobilePageSection from "../layouts/MobilePageSection";

const ROWS_PER_PAGE = 5;

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("odc_user") || "null");
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function normalizeType(type) {
  const raw = String(type || "").trim();
  if (!raw) return "ลา";
  if (raw.toLowerCase() === "holiday") return "ลา";
  if (raw.toLowerCase() === "unable to complete a task.") return "หยุด";
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

function getTypeClassName(type) {
  const normalized = normalizeType(type);
  if (normalized === "ลา") return "amber";
  if (normalized === "หยุด") return "green";
  if (normalized === "OUT_PROVINCE") return "blue";
  return "gray";
}

function getStatusClassName(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "ACTIVE") return "green";
  if (normalized === "CANCELLED") return "red";
  return "gray";
}

function formatRange(startDatetime, endDatetime) {
  return `${formatThaiDateTime(startDatetime)} - ${formatThaiDateTime(endDatetime)}`;
}

function sortLatestFirst(items) {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.created_at || a.updated_at || a.start_datetime || 0).getTime();
    const dateB = new Date(b.created_at || b.updated_at || b.start_datetime || 0).getTime();
    return dateB - dateA;
  });
}

function getUnavailableReasonLabel(record) {
  const parts = [getTypeLabel(record.type)];
  if (record.reason) parts.push(record.reason);
  return parts.join(" - ");
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

function DriverUnavailableCompactCard({
  record,
  canEdit,
  canCancel,
  expanded,
  onToggleExpand,
  onEdit,
  onCancel,
}) {
  const status = normalizeStatus(record.status);
  const typeClassName = getTypeClassName(record.type);
  const statusClassName = getStatusClassName(record.status);
  const typeLabel = getTypeLabel(record.type);
  const rangeLabel = formatRange(record.start_datetime, record.end_datetime);
  const isActive = status === "ACTIVE";
  const isCancelled = status === "CANCELLED";

  return (
    <article
      className={[
        "driver-unavailable-compact-card",
        isActive ? "driver-unavailable-compact-card--active" : "",
        isCancelled ? "driver-unavailable-compact-card--cancelled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="driver-unavailable-compact-main"
        aria-expanded={expanded}
        onClick={() => onToggleExpand(record.unavailable_id)}
      >
        <div className="driver-unavailable-compact-copy">
          <div className="driver-unavailable-compact-title-row">
            <h3 className="driver-unavailable-compact-title">{record.driver_name || "-"}</h3>
            <span className={`status ${typeClassName}`}>{typeLabel}</span>
          </div>
          <div className="driver-unavailable-compact-meta">
            <span className={`status ${statusClassName}`}>{status}</span>
            <span title={rangeLabel}>{rangeLabel}</span>
          </div>
        </div>
        <span className={`driver-unavailable-compact-chevron ${expanded ? "is-open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {expanded ? (
        <div className="driver-unavailable-compact-expanded">
          <div className="driver-unavailable-compact-grid">
            <div>
              <span>ประเภท</span>
              <b>{typeLabel}</b>
            </div>
            <div>
              <span>สถานะ</span>
              <b>{status}</b>
            </div>
            <div>
              <span>เหตุผล</span>
              <b>{record.reason || "-"}</b>
            </div>
            <div>
              <span>เวลาเริ่ม</span>
              <b>{formatThaiDateTime(record.start_datetime)}</b>
            </div>
            <div>
              <span>เวลาสิ้นสุด</span>
              <b>{formatThaiDateTime(record.end_datetime)}</b>
            </div>
          </div>

          <div className="driver-unavailable-compact-actions">
            {canEdit && status === "ACTIVE" && (
              <button type="button" onClick={() => onEdit(record)}>
                แก้ไข
              </button>
            )}
            {canCancel && status === "ACTIVE" && (
              <button type="button" className="danger-button" onClick={() => onCancel(record)}>
                ยกเลิก
              </button>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function UnavailableDateTimeFields({ initialStart, initialEnd, onChange }) {
  const [startValue, setStartValue] = useState(initialStart);
  const [endValue, setEndValue] = useState(initialEnd);

  useEffect(() => {
    onChange?.({
      start_datetime: startValue,
      end_datetime: endValue,
    });
  }, [endValue, onChange, startValue]);

  return (
    <div className="booking-datetime-stack">
      <ThaiDateTimeField
        id="start_datetime"
        label="เวลาเริ่ม"
        value={startValue}
        onChange={setStartValue}
        placeholder="เลือกเวลาเริ่ม"
        required
      />
      <ThaiDateTimeField
        id="end_datetime"
        label="เวลาสิ้นสุด"
        value={endValue}
        onChange={setEndValue}
        placeholder="เลือกเวลาสิ้นสุด"
        required
      />
    </div>
  );
}

function buildFormHtml(record, options = {}) {
  const { canSelectDriver = false, drivers = [], currentUser = null } = options;
  const type = normalizeType(record?.type || "ลา");
  const selectedDriverId = record?.driver_user_id || currentUser?.user_id || "";
  const driverDropdown = canSelectDriver
    ? `
      <label>คนขับ</label>
      <select id="driver_user_id" class="swal2-select driver-unavailable-select">
        <option value="">-- เลือกคนขับ --</option>
        ${drivers
          .map(
            (driver) => `
          <option value="${escapeHtml(driver.user_id)}" ${String(driver.user_id) === String(selectedDriverId) ? "selected" : ""} data-driver-name="${escapeHtml(driver.name || "")}">
            ${escapeHtml(driver.name || "-")}
          </option>
        `
          )
          .join("")}
      </select>
    `
    : "";

  return `
    <div class="swal-form driver-unavailable-form">
      ${driverDropdown}
      <label>ประเภท</label>
      <select id="unavailable_type" class="swal2-select driver-unavailable-select">
        <option value="ลา" ${type === "ลา" ? "selected" : ""}>ลา / หยุด</option>
        <option value="หยุด" ${type === "หยุด" ? "selected" : ""}>ติดภารกิจ (ชั่วคราว)</option>
        <option value="OUT_PROVINCE" ${type === "OUT_PROVINCE" ? "selected" : ""}>ปฏิบัติงานต่างจังหวัด</option>
      </select>

      <label>เหตุผล</label>
      <textarea
        id="unavailable_reason"
        class="swal2-textarea driver-unavailable-textarea"
        rows="5"
        placeholder="ระบุเหตุผลการไม่รับงาน"
      >${escapeHtml(record?.reason || "")}</textarea>

      <div id="driver_unavailable_datetime_mount"></div>
    </div>
  `;
}

export default function DriverUnavailable() {
  const [items, setItems] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [filters, setFilters] = useState({
    keyword: "",
    driver: "",
    type: "",
    status: "",
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [expandedUnavailableId, setExpandedUnavailableId] = useState("");
  const currentUser = getCurrentUser();
  const currentRole = normalizeRole(currentUser?.role);
  const canCreate = hasPermission(null, "driver_unavailable_create");
  const canEdit = hasPermission(null, "driver_unavailable_edit");
  const canCancel = hasPermission(null, "driver_unavailable_cancel");
  const canManageAllDrivers = currentRole === "ADMIN" || currentRole === "STAFF";

  function setFilter(field, value) {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const visibleItems = useMemo(() => {
    const rows = Array.isArray(items) ? items : [];

    if (currentRole === "ADMIN" || currentRole === "STAFF") {
      return sortLatestFirst(rows);
    }

    const currentUserId = String(currentUser?.user_id || "").trim();
    const currentUserName = String(currentUser?.name || "").trim();

    return sortLatestFirst(
      rows.filter((row) => {
        const rowUserId = String(row.driver_user_id || "").trim();
        const rowUserName = String(row.driver_name || "").trim();
        return (
          (currentUserId && rowUserId === currentUserId) ||
          (!currentUserId && currentUserName && rowUserName === currentUserName)
        );
      })
    );
  }, [currentRole, currentUser?.name, currentUser?.user_id, items]);

  const filteredItems = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    const driver = filters.driver.trim();
    const type = filters.type.trim();
    const status = normalizeStatus(filters.status);

    return visibleItems.filter((record) => {
      const text = [
        record.driver_name,
        record.reason,
        getTypeLabel(record.type),
        normalizeStatus(record.status),
        formatThaiDateTime(record.start_datetime),
        formatThaiDateTime(record.end_datetime),
      ]
        .join(" ")
        .toLowerCase();

      if (keyword && !text.includes(keyword)) return false;
      if (driver && String(record.driver_user_id || "") !== driver) return false;
      if (type && normalizeType(record.type) !== type) return false;
      if (status && normalizeStatus(record.status) !== status) return false;

      return true;
    });
  }, [filters, visibleItems]);

  const exportRows = useMemo(
    () =>
      filteredItems.map((record, index) => ({
      ลำดับ: index + 1,
      คนขับ: record.driver_name || "-",
      ประเภท: getTypeLabel(record.type),
      เหตุผล: record.reason || "-",
      เวลาเริ่ม: record.start_datetime ? formatThaiDateTime(record.start_datetime) : "-",
      เวลาสิ้นสุด: record.end_datetime ? formatThaiDateTime(record.end_datetime) : "-",
      สถานะ: normalizeStatus(record.status) || "-",
      ผู้สร้าง: record.created_by || "-",
      สร้างเมื่อ: record.created_at ? formatThaiDateTime(record.created_at) : "-",
      ผู้แก้ไข: record.updated_by || "-",
      แก้ไขเมื่อ: record.updated_at ? formatThaiDateTime(record.updated_at) : "-",
      })),
    [filteredItems]
  );

  const pages = useMemo(() => totalPages(filteredItems), [filteredItems]);
  const pageItems = useMemo(() => paginate(filteredItems, page), [filteredItems, page]);
  const uniqueDriverCount = useMemo(() => {
    const seen = new Set();
    filteredItems.forEach((record) => {
      const key = String(record.driver_user_id || record.driver_name || "").trim();
      if (key) seen.add(key);
    });
    return seen.size;
  }, [filteredItems]);
  const activeCount = useMemo(
    () => filteredItems.filter((record) => normalizeStatus(record.status) === "ACTIVE").length,
    [filteredItems]
  );
  const cancelledCount = useMemo(
    () => filteredItems.filter((record) => normalizeStatus(record.status) === "CANCELLED").length,
    [filteredItems]
  );

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    if (page > pages) {
      setPage(pages);
    }
  }, [page, pages]);

  function handleExportExcel() {
    const rows = exportRows;

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    XLSX.utils.book_append_sheet(workbook, worksheet, "วันไม่รับงาน");

    XLSX.writeFile(workbook, `driver-unavailable-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function loadData(options = {}) {
    try {
      if (options.refreshOnly) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const [unavailableData, userData] = await Promise.all([
        getDriverUnavailable(options.refreshOnly ? { fresh: true } : {}),
        getUsers(options.refreshOnly ? { fresh: true } : {}),
      ]);

      setItems(Array.isArray(unavailableData) ? unavailableData : []);
      setDrivers(
        Array.isArray(userData)
          ? userData.filter(
              (user) =>
                normalizeRole(user.role) === "DRIVER" &&
                normalizeStatus(user.status) === "ACTIVE"
            )
          : []
      );
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

  async function openForm(record = null) {
    const now = new Date();
    const initialStart = record?.start_datetime || toLocalDateTimeString(now);
    const initialEnd = record?.end_datetime || toLocalDateTimeString(new Date(now.getTime() + 60 * 60 * 1000));
    const datetimeState = {
      start_datetime: initialStart,
      end_datetime: initialEnd,
    };
    let datetimeRoot = null;

    const result = await Swal.fire({
      title: record ? "แก้ไขวันไม่รับงาน" : "เพิ่มวันไม่รับงาน",
      html: buildFormHtml(record, {
        canSelectDriver: canManageAllDrivers,
        drivers,
        currentUser,
      }),
      width: 760,
      showCancelButton: true,
      reverseButtons: false,
      confirmButtonText: record ? "บันทึกการแก้ไข" : "บันทึก",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#1455c8",
      cancelButtonColor: "#64748b",
      customClass: {
        popup: "driver-unavailable-modal",
        htmlContainer: "driver-unavailable-html",
        actions: "driver-unavailable-actions",
        confirmButton: "driver-unavailable-confirm",
        cancelButton: "driver-unavailable-cancel",
      },
      didOpen: () => {
        const modal = Swal.getPopup();
        const datetimeMount = modal?.querySelector("#driver_unavailable_datetime_mount");
        if (!datetimeMount) return;

        datetimeRoot = createRoot(datetimeMount);
        datetimeRoot.render(
          <UnavailableDateTimeFields
            initialStart={datetimeState.start_datetime}
            initialEnd={datetimeState.end_datetime}
            onChange={(nextValues) => {
              datetimeState.start_datetime = nextValues.start_datetime;
              datetimeState.end_datetime = nextValues.end_datetime;
            }}
          />
        );
      },
      willClose: () => {
        datetimeRoot?.unmount?.();
        datetimeRoot = null;
      },
      preConfirm: () => {
        const type = normalizeType(document.getElementById("unavailable_type")?.value);
        const reason = document.getElementById("unavailable_reason")?.value.trim();
        let driver_user_id = record?.driver_user_id || currentUser?.user_id || "";
        let driver_name = record?.driver_name || currentUser?.name || "";

        if (canManageAllDrivers) {
          const driverSelect = document.getElementById("driver_user_id");
          driver_user_id = driverSelect?.value || "";
          const selectedOption = driverSelect?.selectedOptions?.[0];
          driver_name =
            selectedOption?.dataset?.driverName || selectedOption?.textContent?.trim() || "";

          if (!driver_user_id) {
            Swal.showValidationMessage("กรุณาเลือกคนขับ");
            return false;
          }
        }

        if (!type || !datetimeState.start_datetime || !datetimeState.end_datetime) {
          Swal.showValidationMessage("กรุณากรอกข้อมูลให้ครบ");
          return false;
        }

        if (
          (parseAppDateTime(datetimeState.end_datetime)?.getTime() || 0) <=
          (parseAppDateTime(datetimeState.start_datetime)?.getTime() || 0)
        ) {
          Swal.showValidationMessage("เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม");
          return false;
        }

        return {
          unavailable_id: record?.unavailable_id || "",
          driver_user_id,
          driver_name,
          type,
          reason,
          start_datetime: datetimeState.start_datetime,
          end_datetime: datetimeState.end_datetime,
          created_by: currentUser?.name || currentUser?.email || "",
          updated_by: currentUser?.name || currentUser?.email || "",
        };
      },
    });

    if (!result.isConfirmed) return;

    try {
      if (record) {
        const updated = await updateDriverUnavailable(result.value);
        setItems((current) =>
          current.map((row) =>
            String(row.unavailable_id || "") === String(record.unavailable_id || "")
              ? { ...row, ...(updated || result.value) }
              : row
          )
        );
        await showSuccess("แก้ไขวันไม่รับงานสำเร็จ");
      } else {
        const created = await createDriverUnavailable(result.value);
        setItems((current) => [created || result.value, ...current]);
        await showSuccess("เพิ่มวันไม่รับงานสำเร็จ");
      }
    } catch (err) {
      showError(err.message || (record ? "แก้ไขวันไม่รับงานไม่สำเร็จ" : "เพิ่มวันไม่รับงานไม่สำเร็จ"));
    }
  }

  async function handleEdit(record) {
    if (!canEdit || normalizeStatus(record.status) !== "ACTIVE") return;
    await openForm(record);
  }

  async function handleCancel(record) {
    if (!canCancel || normalizeStatus(record.status) !== "ACTIVE") return;

    const confirmed = await showConfirm(`ยืนยันการยกเลิกวันไม่รับงานของ ${record.driver_name} ใช่หรือไม่?`);
    if (!confirmed) return;

    try {
      const cancelled = await cancelDriverUnavailable({
        unavailable_id: record.unavailable_id,
        cancelled_by: currentUser?.name || currentUser?.email || "",
      });

      setItems((current) =>
        current.map((row) =>
          String(row.unavailable_id || "") === String(record.unavailable_id || "")
            ? { ...row, ...(cancelled || {}), status: "CANCELLED" }
            : row
        )
      );
      await showSuccess("ยกเลิกวันไม่รับงานสำเร็จ");
    } catch (err) {
      showError(err.message || "ยกเลิกวันไม่รับงานไม่สำเร็จ");
    }
  }

  return (
    <div className="driver-unavailable-page">
      <div className="hidden md:block">
        <div className="page-header rounded-3xl border border-sky-100 bg-white px-4 py-4 shadow-sm sm:px-5 lg:px-7">
          <div>
            <h2>แจ้งข้อมูลการปฏิบัติงานของคนขับ</h2>
            <p>กำหนดช่วงเวลาที่คนขับไม่สามารถรับงานได้</p>
          </div>

          <div className="section-toolbar gap-3">
            <button type="button" disabled={refreshing || loading} onClick={() => loadData({ refreshOnly: true })}>
              {refreshing ? "กำลังรีเฟรช..." : "รีเฟรชข้อมูล"}
            </button>
            {canCreate && (
              <button type="button" className="success-button" onClick={() => openForm()}>
                เพิ่มวันไม่รับงาน
              </button>
            )}
          </div>
        </div>

        {loading && <div className="form-card text-slate-700">กำลังโหลดข้อมูล...</div>}
        {error && !loading && <div className="form-card text-slate-700">{error}</div>}

        {!loading && !error && (
          <div className="form-card">
            <div className="driver-unavailable-toolbar">
              <div className="driver-unavailable-filters">
                <input
                  value={filters.keyword}
                  onChange={(e) => setFilter("keyword", e.target.value)}
                  placeholder="ค้นหา คนขับ / เหตุผล / สถานะ"
                />

                <select value={filters.driver} onChange={(e) => setFilter("driver", e.target.value)}>
                  <option value="">คนขับทั้งหมด</option>
                  {drivers.map((driver) => (
                    <option key={driver.user_id} value={driver.user_id}>
                      {driver.name || "-"}
                    </option>
                  ))}
                </select>

                <select value={filters.type} onChange={(e) => setFilter("type", e.target.value)}>
                  <option value="">ทุกประเภท</option>
                  <option value="ลา">ลา / หยุด</option>
                  <option value="หยุด">ติดภารกิจ (ชั่วคราว)</option>
                  <option value="OUT_PROVINCE">ปฏิบัติงานต่างจังหวัด</option>
                </select>

                <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
                  <option value="">ทุกสถานะ</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div className="driver-unavailable-actions">
                <button
                  type="button"
                  className="small-button"
                  onClick={() =>
                    setFilters({
                      keyword: "",
                      driver: "",
                      type: "",
                      status: "",
                    })
                  }
                >
                  ล้างตัวกรอง
                </button>
                <button
                  type="button"
                  className="warning-button"
                  disabled={filteredItems.length === 0}
                  onClick={handleExportExcel}
                >
                  Export Excel
                </button>
              </div>
            </div>

            <div className="table-wrap mobile-hide-table rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table>
                <thead>
                  <tr>
                    <th>คนขับ</th>
                    <th>ประเภท</th>
                    <th>เหตุผล</th>
                    <th>เวลาเริ่ม</th>
                    <th>เวลาสิ้นสุด</th>
                    <th>สถานะ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan="7">ไม่พบรายการตามเงื่อนไขที่ค้นหา</td>
                    </tr>
                  ) : (
                    pageItems.map((record) => (
                      <tr key={record.unavailable_id}>
                        <td>{record.driver_name || "-"}</td>
                        <td>
                          <span className={`status ${getTypeClassName(record.type)}`}>
                            {getTypeLabel(record.type)}
                          </span>
                        </td>
                        <td>{getUnavailableReasonLabel(record) || "-"}</td>
                        <td>{formatThaiDateTime(record.start_datetime)}</td>
                        <td>{formatThaiDateTime(record.end_datetime)}</td>
                        <td>
                          <span className={`status ${getStatusClassName(record.status)}`}>
                            {normalizeStatus(record.status)}
                          </span>
                        </td>
                        <td className="action-buttons">
                          {canEdit && normalizeStatus(record.status) === "ACTIVE" && (
                            <button type="button" onClick={() => handleEdit(record)}>
                              แก้ไข
                            </button>
                          )}
                          {canCancel && normalizeStatus(record.status) === "ACTIVE" && (
                            <button type="button" className="danger-button" onClick={() => handleCancel(record)}>
                              ยกเลิก
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredItems.length > 0 && (
              <Pagination page={page} total={pages} onChange={setPage} />
            )}
          </div>
        )}
      </div>

      <div className="block md:hidden">
        <div className="driver-unavailable-mobile-page mt-[57px] md:mt-0">
          <MobilePageHeader
            title="แจ้งข้อมูลการปฏิบัติงานของคนขับ"
            subtitle="กำหนดช่วงเวลาที่คนขับไม่สามารถรับงานได้"
            actions={
              <>
                <button
                  type="button"
                  className="mobile-filter-button inline-flex items-center gap-1.5 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                  disabled={refreshing || loading}
                  onClick={() => loadData({ refreshOnly: true })}
                >
                  <span>รีเฟรช</span>
                </button>
                {canCreate && (
                  <button
                    type="button"
                    className="mobile-action-button inline-flex items-center gap-1.5 border border-emerald-200 bg-emerald-600 shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => openForm()}
                  >
                    <span>+ เพิ่มวันไม่รับงาน</span>
                  </button>
                )}
              </>
            }
          />

          {loading ? (
            <MobilePageSection title="สถานะการโหลด" subtitle="กำลังดึงข้อมูลรายการแจ้งไม่รับงาน">
              <div className="mobile-empty-state">กำลังโหลดข้อมูล...</div>
            </MobilePageSection>
          ) : error ? (
            <MobilePageSection title="ข้อผิดพลาด" subtitle="เกิดปัญหาในการโหลดข้อมูล">
              <div className="mobile-empty-state text-red-700">{error}</div>
            </MobilePageSection>
          ) : (
            <>

              <MobilePageSection
                title="ตัวกรองข้อมูล"
                subtitle="ค้นหา / คนขับ / ประเภท / สถานะ"
                actions={
                  <button
                    type="button"
                    className="driver-unavailable-filter-toggle mobile-filter-button inline-flex items-center gap-1.5 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                    aria-expanded={isMobileFilterOpen}
                    onClick={() => setIsMobileFilterOpen((current) => !current)}
                  >
                    <span>{isMobileFilterOpen ? "⌃" : "⌄"}</span>
                  </button>
                }
              >
                {isMobileFilterOpen ? (
                  <div className="grid gap-3">
                    <input
                      value={filters.keyword}
                      onChange={(e) => setFilter("keyword", e.target.value)}
                      placeholder="ค้นหา คนขับ / เหตุผล / สถานะ"
                    />

                    <select value={filters.driver} onChange={(e) => setFilter("driver", e.target.value)}>
                      <option value="">คนขับทั้งหมด</option>
                      {drivers.map((driver) => (
                        <option key={driver.user_id} value={driver.user_id}>
                          {driver.name || "-"}
                        </option>
                      ))}
                    </select>

                    <select value={filters.type} onChange={(e) => setFilter("type", e.target.value)}>
                      <option value="">ทุกประเภท</option>
                      <option value="ลา">ลา / หยุด</option>
                      <option value="หยุด">ติดภารกิจ (ชั่วคราว)</option>
                      <option value="OUT_PROVINCE">ปฏิบัติงานต่างจังหวัด</option>
                    </select>

                    <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
                      <option value="">ทุกสถานะ</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>

                    <div className="driver-unavailable-compact-actions">
                      <button
                        type="button"
                        className="mobile-filter-button"
                        onClick={() =>
                          setFilters({
                            keyword: "",
                            driver: "",
                            type: "",
                            status: "",
                          })
                        }
                      >
                        ล้างตัวกรอง
                      </button>
                      <button
                        type="button"
                        className="mobile-action-button"
                        disabled={filteredItems.length === 0}
                        onClick={handleExportExcel}
                      >
                        Export Excel
                      </button>
                    </div>
                  </div>
                ) : null}
              </MobilePageSection>

              <MobilePageSection
                title="รายการแจ้งไม่รับงาน"
                subtitle="แสดงรายการตามเงื่อนไขที่เลือก"
                actions={
                  <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                    หน้า {page}/{pages}
                  </span>
                }
              >
                {pageItems.length === 0 ? (
                  <div className="mobile-empty-state">ไม่พบรายการตามเงื่อนไขที่ค้นหา</div>
                ) : (
                  <div className="grid gap-1.5">
                    {pageItems.map((record) => (
                      <DriverUnavailableCompactCard
                        key={record.unavailable_id}
                        record={record}
                        canEdit={canEdit}
                        canCancel={canCancel}
                        expanded={expandedUnavailableId === record.unavailable_id}
                        onToggleExpand={(unavailableId) =>
                          setExpandedUnavailableId((current) => (current === unavailableId ? "" : unavailableId))
                        }
                        onEdit={handleEdit}
                        onCancel={handleCancel}
                      />
                    ))}
                  </div>
                )}

                {filteredItems.length > 0 && (
                  <Pagination page={page} total={pages} onChange={setPage} />
                )}
              </MobilePageSection>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
