import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
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
  if (raw.toUpperCase() === "OTHER") return "OTHER";
  return raw;
}

function getTypeLabel(type) {
  const normalized = normalizeType(type);
  if (normalized === "OTHER") return "อื่นๆ";
  return normalized || "-";
}

function getTypeClassName(type) {
  const normalized = normalizeType(type);
  if (normalized === "ลา") return "amber";
  if (normalized === "หยุด") return "green";
  return "purple";
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
    <div className="booking-datetime-grid">
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
      <select id="driver_user_id" class="swal2-select">
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
    <div class="swal-form">
      ${driverDropdown}
      <label>ประเภท</label>
      <select id="unavailable_type" class="swal2-select">
        <option value="ลา" ${type === "ลา" ? "selected" : ""}>ลา</option>
        <option value="หยุด" ${type === "หยุด" ? "selected" : ""}>หยุด</option>
        <option value="OTHER" ${type === "OTHER" ? "selected" : ""}>อื่นๆ</option>
      </select>

      <label>เหตุผล</label>
      <textarea
        id="unavailable_reason"
        class="swal2-textarea"
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const currentUser = getCurrentUser();
  const currentRole = normalizeRole(currentUser?.role);
  const canCreate = hasPermission(null, "driver_unavailable_create");
  const canEdit = hasPermission(null, "driver_unavailable_edit");
  const canCancel = hasPermission(null, "driver_unavailable_cancel");
  const canManageAllDrivers = currentRole === "ADMIN" || currentRole === "STAFF";

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
      confirmButtonText: record ? "บันทึกการแก้ไข" : "บันทึก",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#1455c8",
      cancelButtonColor: "#64748b",
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
    <div>
      <div className="page-header">
        <div>
          <h2>วันไม่รับงาน</h2>
          <p>กำหนดช่วงเวลาที่คนขับไม่สามารถรับงานได้</p>
        </div>

        <div className="section-toolbar">
          <button type="button" disabled={refreshing || loading} onClick={() => loadData({ refreshOnly: true })}>
            {refreshing ? "กำลังรีเฟรช..." : "รีเฟรชข้อมูล"}
          </button>
          {canCreate && (
            <button type="button" onClick={() => openForm()}>
              เพิ่มวันไม่รับงาน
            </button>
          )}
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
                {visibleItems.length === 0 ? (
                  <tr>
                    <td colSpan="7">ไม่พบรายการวันไม่รับงาน</td>
                  </tr>
                ) : (
                  visibleItems.map((record) => (
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
        </div>
      )}
    </div>
  );
}
