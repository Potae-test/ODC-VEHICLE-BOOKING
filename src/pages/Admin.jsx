import { useEffect, useState } from "react";
import {
  createDriver,
  getBookings,
  getDrivers,
  getVehicles,
  updateDriverStatus,
  getUsers,
  createUser,
  updateUser,
  resetUserPassword,
} from "../api";

function countByStatus(items, status) {
  return items.filter((x) => x.status === status).length;
}

export default function Admin() {
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [driverForm, setDriverForm] = useState({
    name: "",
    phone: "",
    status: "ACTIVE",
    remark: "",
  });
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState({
    user_id: "",
    name: "",
    email: "",
    password: "1234",
    department: "ศูนย์รับบริจาคอวัยวะ",
    phone: "",
    role: "USER",
    status: "ACTIVE",
  });

  async function loadData() {
    const [vehicleData, bookingData, driverData] = await Promise.all([
      getVehicles(),
      getBookings(),
      getDrivers(),
    ]);

    setVehicles(vehicleData);
    setBookings(bookingData);
    setDrivers(driverData);
  }
    async function loadData() {
    const [vehicleData, bookingData, driverData, userData] = await Promise.all([
      getVehicles(),
      getBookings(),
      getDrivers(),
      getUsers(),
    ]);

    setVehicles(vehicleData);
    setBookings(bookingData);
    setDrivers(driverData);
    setUsers(userData);
  }
  async function handleCreateDriver(e) {
  e.preventDefault();

  if (!driverForm.name.trim()) {
    alert("กรุณากรอกชื่อคนขับ");
    return;
  }

  if (!driverForm.phone.trim()) {
    alert("กรุณากรอกเบอร์โทร");
    return;
  }

  try {
    await createDriver(driverForm);

    setDriverForm({
      name: "",
      phone: "",
      status: "ACTIVE",
      remark: "",
    });

    await loadData();

    alert("เพิ่มคนขับสำเร็จ");
    } catch (err) {
      alert(err.message || "เพิ่มคนขับไม่สำเร็จ");
    }
  }
    async function handleDriverStatus(driver, nextStatus) {
      let remark = "";

      if (nextStatus === "INACTIVE") {
        const reasonText = driverInactiveReasons
          .map((r, index) => `${index + 1}. ${r}`)
          .join("\n");

        const answer = prompt(
          `เลือกเหตุผลการปิดใช้งาน\n\n${reasonText}\n\nพิมพ์เลขข้อ หรือพิมพ์เหตุผลใหม่`
        );

        if (!answer) return;

        const selectedIndex = Number(answer) - 1;

        if (
          !Number.isNaN(selectedIndex) &&
          driverInactiveReasons[selectedIndex]
        ) {
          remark = driverInactiveReasons[selectedIndex];
        } else {
          remark = answer.trim();

          if (!driverInactiveReasons.includes(remark)) {
            setDriverInactiveReasons([
              ...driverInactiveReasons,
              remark,
            ]);
          }
        }

        if (!remark.trim()) {
          alert("กรุณาระบุเหตุผล");
          return;
        }
      }

      try {
        await updateDriverStatus({
          driver_id: driver.driver_id,
          status: nextStatus,
          remark,
        });

        await loadData();

        alert("อัปเดตสถานะสำเร็จ");
      } catch (err) {
        alert(err.message || "อัปเดตไม่สำเร็จ");
      }
    }
    const [driverInactiveReasons, setDriverInactiveReasons] = useState([
      "ลาป่วย",
      "ลาหยุด",
    ]);
    function editUser(u) {
  setUserForm({
    user_id: u.user_id,
    name: u.name || "",
    email: u.email || "",
    password: "",
    department: u.department || "",
    phone: u.phone || "",
    role: u.role || "USER",
    status: u.status || "ACTIVE",
  });
}

async function handleSaveUser(e) {
  e.preventDefault();

  if (!userForm.name || !userForm.email) {
    alert("กรุณากรอกชื่อและ Email");
    return;
  }

  try {
    if (userForm.user_id) {
      await updateUser(userForm);
      alert("แก้ไขผู้ใช้งานสำเร็จ");
    } else {
      await createUser(userForm);
      alert("เพิ่มผู้ใช้งานสำเร็จ");
    }

    setUserForm({
      user_id: "",
      name: "",
      email: "",
      password: "1234",
      department: "ศูนย์รับบริจาคอวัยวะ",
      phone: "",
      role: "USER",
      status: "ACTIVE",
    });

    await loadData();
  } catch (err) {
    alert(err.message || "บันทึกไม่สำเร็จ");
  }
}

async function handleResetPassword(u) {
  const password = prompt(`กรอกรหัสผ่านใหม่ของ ${u.name}`);

  if (!password) return;

  try {
    await resetUserPassword({
      user_id: u.user_id,
      password,
    });

    alert("เปลี่ยนรหัสผ่านสำเร็จ");
    await loadData();
  } catch (err) {
    alert(err.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
  }
}
  useEffect(() => {
    loadData();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Admin / Dashboard</h2>
          <p>สรุปภาพรวมระบบจองรถทั้งหมด</p>
        </div>

        <button onClick={loadData}>รีเฟรชข้อมูล</button>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <h3>รถทั้งหมด</h3>
          <strong>{vehicles.length}</strong>
        </div>
<div className="form-card">
  <h3>จัดการคนขับ</h3>

  <form onSubmit={handleCreateDriver}>
    <div className="form-grid">
      <div>
        <label>ชื่อคนขับ</label>
        <input
          value={driverForm.name}
          onChange={(e) =>
            setDriverForm({ ...driverForm, name: e.target.value })
          }
          placeholder="เช่น นายสมชาย"
        />
      </div>

      <div>
        <label>เบอร์โทร</label>
        <input
          value={driverForm.phone}
          onChange={(e) =>
            setDriverForm({ ...driverForm, phone: e.target.value })
          }
          placeholder="08x-xxx-xxxx"
        />
      </div>

      <div>
        <label>สถานะ</label>
        <select
          value={driverForm.status}
          onChange={(e) =>
            setDriverForm({ ...driverForm, status: e.target.value })
          }
        >
          <option value="ACTIVE">ใช้งาน</option>
          <option value="INACTIVE">ปิดใช้งาน</option>
        </select>
      </div>

      <div>
        <label>หมายเหตุ</label>
        <input
          value={driverForm.remark}
          onChange={(e) =>
            setDriverForm({ ...driverForm, remark: e.target.value })
          }
          placeholder="-"
        />
      </div>
    </div>

    <button>เพิ่มคนขับ</button>
  </form>
<div className="form-card">
  <h3>จัดการผู้ใช้งาน</h3>

  <form onSubmit={handleSaveUser}>
    <div className="form-grid">
      <div>
        <label>ชื่อผู้ใช้งาน</label>
        <input
          value={userForm.name}
          onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
          placeholder="เช่น ผู้ดูแลระบบ"
        />
      </div>

      <div>
        <label>Email</label>
        <input
          value={userForm.email}
          onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
          placeholder="email@domain.com"
        />
      </div>

      {!userForm.user_id && (
        <div>
          <label>Password เริ่มต้น</label>
          <input
            value={userForm.password}
            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
            placeholder="1234"
          />
        </div>
      )}

      <div>
        <label>หน่วยงาน</label>
        <input
          value={userForm.department}
          onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
        />
      </div>

      <div>
        <label>เบอร์โทร</label>
        <input
          value={userForm.phone}
          onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
        />
      </div>

      <div>
        <label>Role</label>
        <select
          value={userForm.role}
          onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
        >
          <option value="ADMIN">ADMIN</option>
          <option value="STAFF">STAFF</option>
          <option value="USER">USER</option>
        </select>
      </div>

      <div>
        <label>สถานะ</label>
        <select
          value={userForm.status}
          onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}
        >
          <option value="ACTIVE">ใช้งาน</option>
          <option value="INACTIVE">ปิดใช้งาน</option>
        </select>
      </div>
    </div>

    <button>
      {userForm.user_id ? "บันทึกการแก้ไข" : "เพิ่มผู้ใช้งาน"}
    </button>

    {userForm.user_id && (
      <button
        type="button"
        onClick={() =>
          setUserForm({
            user_id: "",
            name: "",
            email: "",
            password: "1234",
            department: "ศูนย์รับบริจาคอวัยวะ",
            phone: "",
            role: "USER",
            status: "ACTIVE",
          })
        }
        style={{ marginLeft: 12 }}
      >
        ยกเลิกแก้ไข
      </button>
    )}
  </form>

  <div className="table-wrap" style={{ marginTop: 24 }}>
    <table>
      <thead>
        <tr>
          <th>รหัส</th>
          <th>ชื่อ</th>
          <th>Email</th>
          <th>Role</th>
          <th>สถานะ</th>
          <th>จัดการ</th>
        </tr>
      </thead>

      <tbody>
        {users.map((u) => (
          <tr key={u.user_id}>
            <td>{u.user_id}</td>
            <td>{u.name}</td>
            <td>{u.email}</td>
            <td>{u.role}</td>
            <td>{u.status}</td>
            <td>
              <button onClick={() => editUser(u)}>
                แก้ไข
              </button>

              <button
                type="button"
                style={{ marginLeft: 8 }}
                onClick={() => handleResetPassword(u)}
              >
                เปลี่ยนรหัส
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
  <div className="table-wrap" style={{ marginTop: 24 }}>
    <table>
      <thead>
        <tr>
          <th>รหัส</th>
          <th>ชื่อคนขับ</th>
          <th>เบอร์โทร</th>
          <th>สถานะ</th>
          <th>หมายเหตุ</th>
          <th>จัดการ</th>
        </tr>
      </thead>

        <tbody>
          {drivers.map((d) => (
            <tr key={d.driver_id}>
              <td>{d.driver_id}</td>
              <td>{d.name}</td>
              <td>{d.phone}</td>
              <td>{d.status}</td>
              <td>{d.remark || "-"}</td>
              <td>
                  {d.status === "ACTIVE" ? (
                    <button
                      className="danger-button"
                      onClick={() =>
                        handleDriverStatus(d, "INACTIVE")
                      }
                    >
                      ปิดใช้งาน
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        handleDriverStatus(d, "ACTIVE")
                      }
                    >
                      เปิดใช้งาน
                    </button>
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
          <div className="summary-card">
          <h3>รายการจองทั้งหมด</h3>
          <strong>{bookings.length}</strong>
        </div>

        <div className="summary-card amber-box">
          <h3>รออนุมัติ</h3>
          <strong>{countByStatus(bookings, "PENDING")}</strong>
        </div>

        <div className="summary-card blue-box">
          <h3>อนุมัติแล้ว</h3>
          <strong>{countByStatus(bookings, "APPROVED")}</strong>
        </div>

        <div className="summary-card green-box">
          <h3>กำลังใช้งาน</h3>
          <strong>{countByStatus(bookings, "IN_USE")}</strong>
        </div>

        <div className="summary-card gray-box">
          <h3>เสร็จสิ้น</h3>
          <strong>{countByStatus(bookings, "COMPLETED")}</strong>
        </div>

        <div className="summary-card red-box">
          <h3>ยกเลิก</h3>
          <strong>{countByStatus(bookings, "CANCELLED")}</strong>
        </div>
      </div>

      <div className="form-card">
        <h3>รายการจองทั้งหมด</h3>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>เลขที่</th>
                <th>ผู้จอง</th>
                <th>ปลายทาง</th>
                <th>รถ</th>
                <th>คนขับ</th>
                <th>สถานะ</th>
                <th>หมายเหตุ</th>
              </tr>
            </thead>

            <tbody>
              {bookings.map((b) => (
                <tr key={b.booking_id}>
                  <td>{b.booking_no}</td>
                  <td>{b.requester_name}</td>
                  <td>{b.destination}</td>
                  <td>{b.vehicle_id || "-"}</td>
                  <td>{b.driver_name || "-"}</td>
                  <td>{b.status}</td>
                  <td>{b.staff_note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}