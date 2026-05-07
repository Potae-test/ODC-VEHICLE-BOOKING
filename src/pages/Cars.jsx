import { useEffect, useState } from "react";
import { createVehicle, getVehicles } from "../api";

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

export default function Cars() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
          {saving ? "กำลังบันทึก..." : "เพิ่มรถ"}
        </button>
      </form>

      {loading ? (
        <p>กำลังโหลดข้อมูลรถ...</p>
      ) : (
        <div className="car-grid">
          {vehicles.map((car) => (
            <div className="car-card" key={car.vehicle_id}>
              <div className="car-top">
                <div className="car-icon">🚐</div>

                <span className={getStatusClass(car.status)}>
                  {getStatusText(car.status)}
                </span>
              </div>

              <h3>{car.vehicle_code}</h3>

              <p>
                {car.vehicle_type} · {car.plate_no}
              </p>

              <div className="car-detail">
                <div>
                  คนขับ: <b>{car.driver_name}</b>
                </div>

                <div>
                  รายการถัดไป: <b>{car.next_booking}</b>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}