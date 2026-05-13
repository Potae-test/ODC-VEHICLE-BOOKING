import { useEffect, useState } from "react";
import {
  createVehicle,
  deleteVehicle,
  getVehicles,
  updateVehicle,
} from "../api";
import Swal from "sweetalert2";
import { showConfirm, showError, showSuccess } from "../utils/alert";
import { hasPermission } from "../permissions";

function getStatusText(status) {
  if (status === "AVAILABLE") return "พร้อมใช้งาน";
  if (status === "IN_USE") return "กำลังใช้งาน";
  if (status === "MAINTENANCE") return "ซ่อมบำรุง";
  if (status === "INACTIVE") return "ปิดใช้งาน";
  return status || "-";
}

function getStatusClass(status) {
  if (status === "AVAILABLE") return "status green";
  if (status === "IN_USE") return "status blue";
  if (status === "MAINTENANCE") return "status amber";
  if (status === "INACTIVE") return "status red";
  return "status";
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);

  const canCreateVehicles = hasPermission(null, "vehicles_create");
  const canEditVehicles = hasPermission(null, "vehicles_edit");
  const canDeleteVehicles = hasPermission(null, "vehicles_delete");

  async function loadVehicles() {
    try {
      setLoading(true);
      const data = await getVehicles();
      setVehicles(data);
    } catch (err) {
      showError(err.message || "โหลดข้อมูลรถไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.vehicle_code.trim()) {
      showError("กรุณากรอกรหัสรถ เช่น ODC-04");
      return;
    }

    if (!form.vehicle_type.trim()) {
      showError("กรุณากรอกประเภทรถ");
      return;
    }

    if (!form.plate_no.trim()) {
      showError("กรุณากรอกทะเบียนรถ");
      return;
    }

    try {
      setSaving(true);
      await createVehicle(form);
      await showSuccess("เพิ่มรถสำเร็จ");
      setForm(initialForm);
      await loadVehicles();
    } catch (err) {
      showError(err.message || "เพิ่มรถไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(car) {
    const result = await Swal.fire({
      title: "แก้ไขข้อมูลรถ",
      html: `
        <div class="swal-form">
          <label>รหัสรถ</label>
          <input id="vehicle_code" class="swal2-input" value="${car.vehicle_code || ""}">

          <label>ประเภทรถ</label>
          <input id="vehicle_type" class="swal2-input" value="${car.vehicle_type || ""}" placeholder="เช่น รถตู้">

          <label>ทะเบียนรถ</label>
          <input id="plate_no" class="swal2-input" value="${car.plate_no || ""}">

          <label>สถานะ</label>
          <select id="status" class="swal2-select">
            <option value="AVAILABLE" ${car.status === "AVAILABLE" ? "selected" : ""}>พร้อมใช้งาน</option>
            <option value="IN_USE" ${car.status === "IN_USE" ? "selected" : ""}>กำลังใช้งาน</option>
            <option value="MAINTENANCE" ${car.status === "MAINTENANCE" ? "selected" : ""}>ซ่อมบำรุง</option>
            <option value="INACTIVE" ${car.status === "INACTIVE" ? "selected" : ""}>ปิดใช้งาน</option>
          </select>

          <label>คนขับประจำ</label>
          <input id="driver_name" class="swal2-input" value="${car.driver_name || ""}" placeholder="-">
        </div>
      `,
      width: 750,
      showCancelButton: true,
      confirmButtonText: "บันทึกการแก้ไข",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#1455c8",
      cancelButtonColor: "#64748b",
      preConfirm: () => {
        const vehicle_code = document.getElementById("vehicle_code").value.trim();
        const vehicle_type = document.getElementById("vehicle_type").value.trim();
        const plate_no = document.getElementById("plate_no").value.trim();
        const status = document.getElementById("status").value;
        const driver_name = document.getElementById("driver_name").value.trim();

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

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>จัดการรถ</h2>
          <p>ข้อมูลจาก Google Sheet ผ่าน Cloudflare Worker API</p>
        </div>

        <button type="button" onClick={loadVehicles}>
          รีเฟรชข้อมูล
        </button>
      </div>

      {canCreateVehicles && (
        <form className="form-card" onSubmit={handleSubmit}>
          <h3>เพิ่มรถใหม่</h3>

          <div className="form-grid">
            <div>
              <label>รหัสรถ</label>
              <input
                value={form.vehicle_code}
                onChange={(e) =>
                  setForm({ ...form, vehicle_code: e.target.value })
                }
                placeholder="เช่น ODC-04"
              />
            </div>

            <div>
              <label>ประเภทรถ</label>
              <input
                value={form.vehicle_type}
                onChange={(e) =>
                  setForm({ ...form, vehicle_type: e.target.value })
                }
                placeholder="เช่น รถตู้ / รถพยาบาล"
              />
            </div>

            <div>
              <label>ทะเบียนรถ</label>
              <input
                value={form.plate_no}
                onChange={(e) =>
                  setForm({ ...form, plate_no: e.target.value })
                }
                placeholder="เช่น 1กข 1234"
              />
            </div>

            <div>
              <label>สถานะ</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value })
                }
              >
                <option value="AVAILABLE">พร้อมใช้งาน</option>
                <option value="IN_USE">กำลังใช้งาน</option>
                <option value="MAINTENANCE">ซ่อมบำรุง</option>
                <option value="INACTIVE">ปิดใช้งาน</option>
              </select>
            </div>

            <div>
              <label>คนขับประจำ</label>
              <input
                value={form.driver_name}
                onChange={(e) =>
                  setForm({ ...form, driver_name: e.target.value })
                }
                placeholder="เช่น คุณสมชาย"
              />
            </div>
          </div>

          <button disabled={saving}>
            {saving ? "กำลังบันทึก..." : "เพิ่มรถ"}
          </button>
        </form>
      )}

      {loading ? (
        <p>กำลังโหลดข้อมูลรถ...</p>
      ) : (
        <div className="form-card">
          <h3>รายการรถทั้งหมด</h3>

          <div className="table-wrap">
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
                {vehicles.map((car) => (
                  <tr
                    key={car.vehicle_id}
                    className={car.status === "INACTIVE" ? "inactive-row" : ""}
                  >
                    <td>
                      <b>{car.vehicle_code}</b>
                    </td>
                    <td>{car.vehicle_type}</td>
                    <td>{car.plate_no}</td>
                    <td>
                      <span className={getStatusClass(car.status)}>
                        {getStatusText(car.status)}
                      </span>
                    </td>
                    <td>{car.driver_name || "-"}</td>
                    <td className="action-buttons">
                      {canEditVehicles && (
                        <button type="button" onClick={() => handleEdit(car)}>
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
                    </td>
                  </tr>
                ))}

                {vehicles.length === 0 && (
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