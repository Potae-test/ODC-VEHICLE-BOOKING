import { useEffect, useState } from "react";
import {
  createVehicle,
  deleteVehicle,
  getVehicles,
  updateVehicle,
} from "../api";
import { formatThaiDateTime } from "../utils/date";
function getStatusText(status) {
  if (status === "AVAILABLE") return "พร้อมใช้งาน";
  if (status === "IN_USE") return "กำลังใช้งาน";
  if (status === "MAINTENANCE") return "ซ่อมบำรุง";
  if (status === "INACTIVE") return "ปิดใช้งาน";
  return status;
}

function getStatusClass(status) {
  if (status === "AVAILABLE") return "status green";
  if (status === "IN_USE") return "status blue";
  if (status === "MAINTENANCE") return "status amber";
  return "status";
}
function handleEdit(car) {
  setEditingId(car.vehicle_id);

  setForm({
    vehicle_code: car.vehicle_code || "",
    vehicle_type: car.vehicle_type || "รถตู้",
    plate_no: car.plate_no || "",
    status: car.status || "AVAILABLE",
    driver_name: car.driver_name || "-",
    next_booking: car.next_booking || "-",
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}


export default function Cars() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({
    
    vehicle_code: "",
    vehicle_type: "รถตู้",
    plate_no: "",
    status: "AVAILABLE",
    driver_name: "-",
    next_booking: "-",
  });

  async function loadVehicles() {
    try {
      setLoading(true);
      const data = await getVehicles();
      setVehicles(data);
    } catch (err) {
      alert(err.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }
  async function handleDelete(car) {
    if (!confirm(`ยืนยันลบรถ ${car.vehicle_code} ใช่หรือไม่?`)) return;

    try {
      await deleteVehicle(car.vehicle_id);
      await loadVehicles();
      alert("ลบข้อมูลสำเร็จ");
    } catch (err) {
      alert(err.message || "ลบรถไม่สำเร็จ");
    }
  }
  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.vehicle_code.trim()) {
      alert("กรุณากรอกรหัสรถ เช่น ODC-04");
      return;
    }

    if (!form.plate_no.trim()) {
      alert("กรุณากรอกทะเบียนรถ");
      return;
    }

    try {
      setSaving(true);

      await createVehicle(form);

      setForm({
        vehicle_code: "",
        vehicle_type: "รถตู้",
        plate_no: "",
        status: "AVAILABLE",
        driver_name: "-",
        next_booking: "-",
      });

      await loadVehicles();

      alert("เพิ่มรถสำเร็จ");
    } catch (err) {
      alert(err.message || "เพิ่มรถไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
        if (editingId) {
      await updateVehicle({
        vehicle_id: editingId,
        ...form,
      });

      alert("แก้ไขข้อมูลรถสำเร็จ");
    } else {
      await createVehicle(form);
      alert("เพิ่มรถสำเร็จ");
    }

    setEditingId("");
  }

  useEffect(() => {
    loadVehicles();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>หน้าจอรถ</h2>
          <p>ข้อมูลจาก Google Sheet ผ่าน Cloudflare Worker API</p>
        </div>

        <button onClick={loadVehicles}>
          รีเฟรชข้อมูล
        </button>
      </div>

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
            <select
              value={form.vehicle_type}
              onChange={(e) =>
                setForm({ ...form, vehicle_type: e.target.value })
              }
            >
              <option value="รถตู้">รถตู้</option>
              <option value="รถพยาบาล">รถพยาบาล</option>
              <option value="รถกระบะ">รถกระบะ</option>
              <option value="รถเก๋ง">รถเก๋ง</option>
            </select>
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
              <option value="INACTIVE">ลบข้อมูลแล้ว</option>
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

          <div>
            <label>รายการถัดไป</label>
            <input
              value={form.next_booking}
              onChange={(e) =>
                setForm({ ...form, next_booking: e.target.value })
              }
              placeholder="-"
            />
          </div>
        </div>

      <button disabled={saving}>
        {saving
          ? "กำลังบันทึก..."
          : editingId
          ? "บันทึกการแก้ไข"
          : "เพิ่มรถ"}
      </button>

      {editingId && (
        <button
          type="button"
          onClick={() => {
            setEditingId("");

            setForm({
              vehicle_code: "",
              vehicle_type: "รถตู้",
              plate_no: "",
              status: "AVAILABLE",
              driver_name: "-",
              next_booking: "-",
            });
          }}
          style={{ marginLeft: 12 }}
        >
          ยกเลิกแก้ไข
        </button>
      )}
      </form>

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
                <th>รายการถัดไป</th>
                <th>จัดการ</th>
              </tr>
            </thead>

            <tbody>
              {vehicles.map((car) => (
                <tr key={car.vehicle_id}>
                  <td><b>{car.vehicle_code}</b></td>
                  <td>{car.vehicle_type}</td>
                  <td>{car.plate_no}</td>
                  <td>
                    <span className={getStatusClass(car.status)}>
                      {getStatusText(car.status)}
                    </span>
                  </td>
                  <td>{car.driver_name || "-"}</td>
                  <td>{formatThaiDateTime(car.next_booking)}</td>
                  <td>
                    <button type="button" onClick={() => handleEdit(car)}>
                      แก้ไข
                    </button>
                  <button
                    className="danger-button"
                    style={{ marginLeft: 8 }}
                    onClick={() => handleDelete(car)}
                  >
                    ลบข้อมูล
                  </button>
                </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}