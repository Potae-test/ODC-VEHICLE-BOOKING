import { useEffect, useState } from "react";
import { createBooking, getBookings } from "../api";
import { formatThaiDateTime } from "../utils/date";

export default function Booking() {
  const [bookings, setBookings] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    requester_name: "",
    department: "",
    phone: "",
    start_datetime: "",
    end_datetime: "",
    destination: "",
    purpose: "",
    vehicle_type_request: "รถตู้",
    vehicle_id: "",
    driver_name: "",
  });

  async function loadBookings() {
    const data = await getBookings();
    setBookings(data);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.requester_name || !form.phone || !form.start_datetime || !form.end_datetime || !form.destination) {
      alert("กรุณากรอกข้อมูลที่จำเป็นให้ครบ");
      return;
    }
    if (new Date(form.end_datetime) <= new Date(form.start_datetime)) {
        alert("วันเวลาสิ้นสุดต้องมากกว่าวันเวลาเริ่ม");
        return;
    }

    try {
      setSaving(true);
      await createBooking(form);

      setForm({
        requester_name: "",
        department: "",
        phone: "",
        start_datetime: "",
        end_datetime: "",
        destination: "",
        purpose: "",
        vehicle_type_request: "รถตู้",
        vehicle_id: "",
        driver_name: "",
      });

      await loadBookings();
      alert("ส่งคำขอจองรถสำเร็จ");
    } catch (err) {
      alert(err.message || "จองรถไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadBookings();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>จองรถ</h2>
          <p>บันทึกคำขอจองรถลง Google Sheet จริง</p>
        </div>
      </div>

      <form className="form-card" onSubmit={handleSubmit}>
        <h3>แบบฟอร์มจองรถ</h3>

        <div className="form-grid">
          <div>
            <label>ชื่อผู้จอง *</label>
            <input
              value={form.requester_name}
              onChange={(e) => setForm({ ...form, requester_name: e.target.value })}
              placeholder="ชื่อ-นามสกุล"
            />
          </div>

          <div>
            <label>หน่วยงาน</label>
            <input
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              placeholder="เช่น ฝ่ายประสานงาน"
            />
          </div>

          <div>
            <label>เบอร์โทร *</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="08x-xxx-xxxx"
            />
          </div>

          <div>
            <label>วันเวลาเริ่ม *</label>
            <input
              type="datetime-local"
              value={form.start_datetime}
              onChange={(e) => setForm({ ...form, start_datetime: e.target.value })}
            />
          </div>

          <div>
            <label>วันเวลาสิ้นสุด *</label>
            <input
              type="datetime-local"
              value={form.end_datetime}
              onChange={(e) => setForm({ ...form, end_datetime: e.target.value })}
            />
          </div>

          <div>
            <label>ประเภทรถ</label>
            <select
              value={form.vehicle_type_request}
              onChange={(e) => setForm({ ...form, vehicle_type_request: e.target.value })}
            >
              <option value="รถตู้">รถตู้</option>
              <option value="รถพยาบาล">รถพยาบาล</option>
              <option value="รถกระบะ">รถกระบะ</option>
              <option value="รถเก๋ง">รถเก๋ง</option>
            </select>
          </div>

          <div>
            <label>ปลายทาง *</label>
            <input
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              placeholder="เช่น รพ.จุฬาลงกรณ์"
            />
          </div>

          <div>
            <label>เหตุผลการใช้รถ</label>
            <input
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              placeholder="เช่น ประสานงานรับบริจาคอวัยวะ"
            />
          </div>
        </div>

        <button disabled={saving}>
          {saving ? "กำลังบันทึก..." : "ส่งคำขอจองรถ"}
        </button>
      </form>

      <div className="form-card">
        <h3>รายการจองล่าสุด</h3>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>เลขที่</th>
                <th>ผู้จอง</th>
                <th>วันเวลาเริ่ม</th>
                <th>วันเวลาสิ้นสุด</th>
                <th>ปลายทาง</th>
                <th>สถานะ</th>
              </tr>
            </thead>

            <tbody>
                  {bookings.map((b) => (
                    <tr key={b.booking_id}>
                      <td>{b.booking_no}</td>
                      <td>{b.requester_name}</td>
                      <td>{formatThaiDateTime(b.start_datetime)}</td>
                      <td>{formatThaiDateTime(b.end_datetime)}</td>
                      <td>{b.destination}</td>
                      <td>{b.status}</td>
                    </tr>
                  ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan="6">ยังไม่มีรายการจอง</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}