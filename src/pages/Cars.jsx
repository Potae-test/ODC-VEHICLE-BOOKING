import { useEffect, useState } from "react";
import {
  createVehicle,
  deleteVehicle,
  getBookings,
  getVehicles,
  updateVehicle,
} from "../api";
import Swal from "sweetalert2";
import { showConfirm, showError, showSuccess } from "../utils/alert";
import { hasPermission } from "../permissions";

function getStatusText(status) {
  const normalized = normalizeVehicleStatus(status);
  if (normalized === "AVAILABLE") return "พร้อมใช้งาน";
  if (normalized === "UNAVAILABLE") return "ไม่พร้อมใช้งาน";
  if (normalized === "IN_USE") return "กำลังใช้งาน";
  return normalized || "-";
}

function getStatusClass(status) {
  const normalized = normalizeVehicleStatus(status);
  if (normalized === "AVAILABLE") return "status green";
  if (normalized === "UNAVAILABLE") return "status red";
  if (normalized === "IN_USE") return "status blue";
  return "status";
}

function normalizeVehicleStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "MAINTENANCE" || normalized === "INACTIVE") return "UNAVAILABLE";
  if (normalized === "IN_USE") return "IN_USE";
  if (normalized === "UNAVAILABLE") return "UNAVAILABLE";
  return "AVAILABLE";
}

function getVehicleTypeText(type) {
  const value = String(type || "").trim();
  const normalized = value.toUpperCase();

  if (!value) return "-";
  if (normalized === "VAN") return "รถตู้";
  if (normalized === "SEDAN") return "รถเก๋ง";
  if (normalized === "MOTORCYCLE") return "จักรยานยนต์";
  if (normalized === "OTHER") return "อื่นๆ";
  return value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const initialForm = {
  vehicle_code: "",
  vehicle_type: "",
  plate_no: "",
  status: "AVAILABLE",
  driver_name: "-",
};

export default function Cars() {
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);

  const canCreateVehicles = hasPermission(null, "vehicles_create");
  const canEditVehicles = hasPermission(null, "vehicles_edit");
  const canDeleteVehicles = hasPermission(null, "vehicles_delete");

  async function loadVehicles() {
    try {
      setLoading(true);
      const [vehicleData, bookingData] = await Promise.all([getVehicles(), getBookings()]);
      setVehicles(Array.isArray(vehicleData) ? vehicleData : []);
      setBookings(Array.isArray(bookingData) ? bookingData : []);
    } catch (err) {
      showError(err.message || "โหลดข้อมูลรถไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenCreateVehicle() {
    const result = await Swal.fire({
      title: "เพิ่มข้อมูลรถ",
      html: `
        <div class="swal-form">
          <label>ชื่อรถ</label>
          <input id="vehicle_code" class="swal2-input" placeholder="เช่น รถตู้โตโยต้า">

          <label>ทะเบียนรถ</label>
          <input id="plate_no" class="swal2-input" placeholder="เช่น 1กข 1234">

          <label>ประเภทรถ</label>
          <select id="vehicle_type" class="swal2-select">
            <option value="VAN">รถตู้</option>
            <option value="SEDAN">รถเก๋ง</option>
            <option value="MOTORCYCLE">จักรยานยนต์</option>
            <option value="OTHER">อื่นๆ โปรดระบุ</option>
          </select>

          <div id="otherVehicleDiv" style="display:none;">
            <label>ระบุประเภทรถ</label>
            <input
              id="vehicle_type_other"
              class="swal2-input"
              placeholder="เช่น รถบัส, รถกระบะ"
            >
          </div>

          <label>สถานะ</label>
          <select id="status" class="swal2-select">
            <option value="AVAILABLE">พร้อมใช้งาน</option>
            <option value="UNAVAILABLE">ไม่พร้อมใช้งาน</option>
          </select>

          <label>หมายเหตุ</label>
          <input id="note" class="swal2-input" placeholder="-">
        </div>
      `,
      width: 750,
      showCancelButton: true,
      confirmButtonText: "เพิ่มรถ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#1455c8",
      cancelButtonColor: "#64748b",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        const vehicleType = document.getElementById("vehicle_type");
        const otherDiv = document.getElementById("otherVehicleDiv");

        vehicleType.addEventListener("change", () => {
          otherDiv.style.display = vehicleType.value === "OTHER" ? "block" : "none";
        });
      },
      preConfirm: () => {
        const vehicle_code = document.getElementById("vehicle_code").value.trim();
        const plate_no = document.getElementById("plate_no").value.trim();
        const vehicle_type_select = document.getElementById("vehicle_type").value;
        let vehicle_type = vehicle_type_select;
        const status = document.getElementById("status").value;
        const note = document.getElementById("note").value.trim();

        if (vehicle_type_select === "OTHER") {
          vehicle_type = document.getElementById("vehicle_type_other").value.trim();
        }

        if (!vehicle_code || !plate_no || !vehicle_type) {
          Swal.showValidationMessage("กรุณากรอกรหัสรถ ทะเบียนรถ และประเภทรถ");
          return false;
        }

        return {
          vehicle_code,
          plate_no,
          vehicle_type,
          status,
          note,
        };
      },
    });

    if (!result.isConfirmed) return;

    try {
      await createVehicle(result.value);
      await showSuccess("เพิ่มรถสำเร็จ");
      await loadVehicles();
    } catch (err) {
      showError(err.message || "เพิ่มรถไม่สำเร็จ");
    }
  }

  async function handleEditVehicle(car) {
    if (normalizeVehicleStatus(car.effective_status || car.status) === "IN_USE") {
      showError("รถกำลังใช้งาน ไม่สามารถแก้ไขหรือลบได้");
      return;
    }

    const allowedVehicleTypes = ["VAN", "SEDAN", "MOTORCYCLE"];
    const currentVehicleType = String(car.vehicle_type || "").trim();
    const selectedVehicleType = allowedVehicleTypes.includes(currentVehicleType)
      ? currentVehicleType
      : "OTHER";
    const otherVehicleType = selectedVehicleType === "OTHER" ? currentVehicleType : "";

    const result = await Swal.fire({
      title: "แก้ไขข้อมูลรถ",
      html: `
        <div class="swal-form">
          <label>รหัสรถ</label>
          <input id="vehicle_code" class="swal2-input" value="${escapeHtml(car.vehicle_code || "")}">

          <label>ประเภทรถ</label>
          <select id="vehicle_type" class="swal2-select">
            <option value="VAN" ${selectedVehicleType === "VAN" ? "selected" : ""}>รถตู้</option>
            <option value="SEDAN" ${selectedVehicleType === "SEDAN" ? "selected" : ""}>รถเก๋ง</option>
            <option value="MOTORCYCLE" ${selectedVehicleType === "MOTORCYCLE" ? "selected" : ""}>จักรยานยนต์</option>
            <option value="OTHER" ${selectedVehicleType === "OTHER" ? "selected" : ""}>อื่นๆ โปรดระบุ</option>
          </select>

          <div id="otherVehicleDiv" style="display:${selectedVehicleType === "OTHER" ? "block" : "none"};">
            <label>ระบุประเภทรถ</label>
            <input
              id="vehicle_type_other"
              class="swal2-input"
              value="${escapeHtml(otherVehicleType)}"
              placeholder="เช่น รถบัส, รถกระบะ"
            >
          </div>

          <label>ทะเบียนรถ</label>
          <input id="plate_no" class="swal2-input" value="${escapeHtml(car.plate_no || "")}">

          <label>สถานะ</label>
          <select id="status" class="swal2-select">
            <option value="AVAILABLE" ${normalizeVehicleStatus(car.status) === "AVAILABLE" ? "selected" : ""}>พร้อมใช้งาน</option>
            <option value="UNAVAILABLE" ${normalizeVehicleStatus(car.status) === "UNAVAILABLE" ? "selected" : ""}>ไม่พร้อมใช้งาน</option>
          </select>

          <label>คนขับประจำ</label>
          <input id="driver_name" class="swal2-input" value="${escapeHtml(car.driver_name || "")}" placeholder="-">

          <label>หมายเหตุ</label>
          <input id="note" class="swal2-input" value="${escapeHtml(car.note || "")}" placeholder="-">
        </div>
      `,
      width: 750,
      showCancelButton: true,
      confirmButtonText: "บันทึกการแก้ไข",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#1455c8",
      cancelButtonColor: "#64748b",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        const vehicleType = document.getElementById("vehicle_type");
        const otherDiv = document.getElementById("otherVehicleDiv");
        const otherInput = document.getElementById("vehicle_type_other");

        const toggleOtherVehicleDiv = () => {
          const showOther = vehicleType.value === "OTHER";
          otherDiv.style.display = showOther ? "block" : "none";

          if (showOther && !otherInput.value.trim()) {
            otherInput.value = currentVehicleType;
          }
        };

        vehicleType.addEventListener("change", toggleOtherVehicleDiv);
        toggleOtherVehicleDiv();
      },
      preConfirm: () => {
        const vehicle_code = document.getElementById("vehicle_code").value.trim();
        const vehicle_type_select = document.getElementById("vehicle_type").value;
        let vehicle_type = vehicle_type_select;
        const plate_no = document.getElementById("plate_no").value.trim();
        const status = document.getElementById("status").value;
        const driver_name = document.getElementById("driver_name").value.trim();
        const note = document.getElementById("note").value.trim();

        if (vehicle_type_select === "OTHER") {
          vehicle_type = document.getElementById("vehicle_type_other").value.trim();
        }

        if (!vehicle_code || !vehicle_type || !plate_no) {
          Swal.showValidationMessage("กรุณากรอกรหัสรถ ประเภทรถ และทะเบียนรถ");
          return false;
        }

        return {
          vehicle_id: car.vehicle_id,
          vehicle_code,
          vehicle_type,
          plate_no,
          status,
          driver_name: driver_name || "-",
          note,
        };
      },
    });

    if (!result.isConfirmed) return;

    try {
      await updateVehicle(result.value);
      await showSuccess("แก้ไขข้อมูลรถสำเร็จ");
      await loadVehicles();
    } catch (err) {
      showError(err.message || "แก้ไขข้อมูลรถไม่สำเร็จ");
    }
  }

  async function handleDelete(car) {
    if (normalizeVehicleStatus(car.effective_status || car.status) === "IN_USE") {
      showError("รถกำลังใช้งาน ไม่สามารถแก้ไขหรือลบได้");
      return;
    }

    const confirmed = await showConfirm(
      `ยืนยันลบรถ ${car.vehicle_code} ใช่หรือไม่?\n\nข้อมูลจะหายถาวร`
    );

    if (!confirmed) return;

    try {
      await deleteVehicle(car.vehicle_id);
      await showSuccess("ลบข้อมูลรถสำเร็จ");
      await loadVehicles();
    } catch (err) {
      showError(err.message || "ลบข้อมูลรถไม่สำเร็จ");
    }
  }

  useEffect(() => {
    loadVehicles();
  }, []);

  const displayVehicles = vehicles.map((vehicle) => {
    const vehicleId = String(vehicle.vehicle_id || "").trim();
    const hasActiveInUseBooking = bookings.some(
      (booking) =>
        String(booking.vehicle_id || "").trim() === vehicleId &&
        String(booking.status || "").trim().toUpperCase() === "IN_USE"
    );

    return {
      ...vehicle,
      status: normalizeVehicleStatus(vehicle.status),
      effective_status: hasActiveInUseBooking ? "IN_USE" : normalizeVehicleStatus(vehicle.status),
    };
  });

  return (
    <div>
      <div className="page-header rounded-3xl border border-sky-100 bg-white px-4 py-4 shadow-sm sm:px-5 lg:px-7">
        <div>
          <h2>จัดการรถ</h2>
          <p>ข้อมูลจาก Google Sheet ผ่าน Cloudflare Worker API</p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {canCreateVehicles && (
            <button type="button" onClick={handleOpenCreateVehicle}>
              เพิ่มรถ
            </button>
          )}

          <button type="button" onClick={loadVehicles}>
            รีเฟรชข้อมูล
          </button>
        </div>
      </div>

      {loading ? (
        <p>กำลังโหลดข้อมูลรถ...</p>
      ) : (
        <div className="form-card">
          <h3>รายการรถทั้งหมด</h3>

          <div className="table-wrap rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table>
              <thead>
                <tr>
                  <th>รหัสรถ</th>
                  <th>ประเภทรถ</th>
                  <th>ทะเบียน</th>
                  <th>สถานะ</th>
                  <th>คนขับประจำ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>

              <tbody>
                {displayVehicles.map((car) => (
                  <tr
                    key={car.vehicle_id}
                    className={car.effective_status === "UNAVAILABLE" ? "inactive-row" : ""}
                  >
                    <td>
                      <b>{car.vehicle_code}</b>
                    </td>
                    <td>{getVehicleTypeText(car.vehicle_type)}</td>
                    <td>{car.plate_no}</td>
                    <td>
                      <span className={getStatusClass(car.effective_status)}>
                        {getStatusText(car.effective_status)}
                      </span>
                    </td>
                    <td>{car.driver_name || "-"}</td>
                    <td className="action-buttons">
                      {car.effective_status === "IN_USE" ? (
                        <span className="muted-text">รถกำลังใช้งาน ไม่สามารถแก้ไขหรือลบได้</span>
                      ) : (
                        <>
                      {canEditVehicles && (
                        <button type="button" onClick={() => handleEditVehicle(car)}>
                          แก้ไข
                        </button>
                      )}

                      {canDeleteVehicles && (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => handleDelete(car)}
                        >
                          ลบข้อมูล
                        </button>
                      )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}

                {displayVehicles.length === 0 && (
                  <tr>
                    <td colSpan="6">ยังไม่มีข้อมูลรถ</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
