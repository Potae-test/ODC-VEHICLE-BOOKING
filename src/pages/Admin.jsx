import { formatThaiDateTime } from "../utils/date";
import { useEffect, useState } from "react";
import {
  createDriver,
  createUser,
  getBookings,
  getDrivers,
  getUsers,
  getVehicles,
  resetUserPassword,
  updateDriverStatus,
  updateUser,
  disableUser,
  deleteUser,
  updateDriver,
  deleteDriver,
} from "../api";
import {
  showConfirm,
  showError,
  showInput,
  showSuccess,
} from "../utils/alert";
import Swal from "sweetalert2";

function countByStatus(items, status) {
  return items.filter((x) => x.status === status).length;
}

export default function Admin() {
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [users, setUsers] = useState([]);

  const [driverInactiveReasons, setDriverInactiveReasons] = useState([
    "ลาป่วย",
    "ลาหยุด",
  ]);

  const [driverForm, setDriverForm] = useState({
    name: "",
    phone: "",
    status: "ACTIVE",
    remark: "",
  });

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
      await showSuccess("เพิ่มคนขับสำเร็จ");
    } catch (err) {
      showError(err.message || "เพิ่มคนขับไม่สำเร็จ");
    }
  }

  async function handleDriverStatus(driver, nextStatus) {
    let remark = "";

    if (nextStatus === "INACTIVE") {
      const reasonText = driverInactiveReasons
        .map((r, index) => `${index + 1}. ${r}`)
        .join("\n");

      const answer = await showInput(
        "ปิดใช้งานคนขับ",
        `เลือกเหตุผลการปิดใช้งาน\n\n${reasonText}\n\nพิมพ์เลขข้อ หรือพิมพ์เหตุผลใหม่`,
        "เช่น 1 หรือ ลาป่วย"
      );

      if (!answer) return;

      const selectedIndex = Number(answer) - 1;

      if (!Number.isNaN(selectedIndex) && driverInactiveReasons[selectedIndex]) {
        remark = driverInactiveReasons[selectedIndex];
      } else {
        remark = answer.trim();

        if (remark && !driverInactiveReasons.includes(remark)) {
          setDriverInactiveReasons([...driverInactiveReasons, remark]);
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
      showError("กรุณากรอกชื่อและ Email");
      return;
    }

    try {
      if (userForm.user_id) {
        await updateUser(userForm);
        await showSuccess("แก้ไขผู้ใช้งานสำเร็จ");
      } else {
        await createUser(userForm);
        await showSuccess("เพิ่มผู้ใช้งานสำเร็จ");
      }

      clearUserForm();
      await loadData();
    } catch (err) {
      showError(err.message || "บันทึกไม่สำเร็จ");
    }
  }

  async function handleResetPassword(u) {
    const password = await showInput(
      "เปลี่ยนรหัสผ่าน",
      `กรอกรหัสผ่านใหม่ของ ${u.name}`,
      "เช่น 1234"
    );

    if (!password) return;

    try {
      await resetUserPassword({
        user_id: u.user_id,
        password,
      });

      await showSuccess("เปลี่ยนรหัสผ่านสำเร็จ");
      await loadData();
    } catch (err) {
      showError(err.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    }
  }
    async function handleDisableUser(u) {
    const confirmed = await showConfirm(
      `ยืนยันปิดใช้งาน ${u.name} ใช่หรือไม่?`
    );

    if (!confirmed) return;

    try {
      await disableUser(u.user_id);

      await showSuccess("ปิดใช้งานผู้ใช้สำเร็จ");

      await loadData();
    } catch (err) {
      showError(err.message || "ปิดใช้งานไม่สำเร็จ");
    }
  }
async function handleDeleteUser(u) {
  const confirmed = await showConfirm(
    `ยืนยันลบผู้ใช้ ${u.name} ใช่หรือไม่?\n\nข้อมูลจะหายถาวร`
  );

  if (!confirmed) return;

  try {
    await deleteUser(u.user_id);

    await showSuccess("ลบผู้ใช้สำเร็จ");

    await loadData();
  } catch (err) {
    showError(err.message || "ลบไม่สำเร็จ");
  }
  }
  async function handleDeleteUser(u) {
    const confirmed = await showConfirm(
      `ยืนยันลบผู้ใช้ ${u.name} ใช่หรือไม่?\n\nข้อมูลจะหายถาวร`
    );

    if (!confirmed) return;

    try {
      await deleteUser(u.user_id);

      await showSuccess("ลบผู้ใช้สำเร็จ");

      await loadData();
    } catch (err) {
      showError(err.message || "ลบไม่สำเร็จ");
    }
  }
  async function handleEnableUser(u) {
  const confirmed = await showConfirm(
    `ยืนยันเปิดใช้งาน ${u.name} ใช่หรือไม่?`
  );

  if (!confirmed) return;

  try {
    await updateUser({
      ...u,
      status: "ACTIVE",
    });

    await showSuccess("เปิดใช้งานผู้ใช้สำเร็จ");
    await loadData();
  } catch (err) {
    showError(err.message || "เปิดใช้งานไม่สำเร็จ");
  }
}
  function clearUserForm() {
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
  }
async function handleEditDriver(d) {
  const result = await Swal.fire({
    title: "แก้ไขข้อมูลคนขับ",
    html: `
      <div class="swal-form">
        <label>ชื่อคนขับ</label>
        <input id="driver_name" class="swal2-input" value="${d.name || ""}">

        <label>เบอร์โทร</label>
        <input id="driver_phone" class="swal2-input" value="${d.phone || ""}">

        <label>สถานะ</label>
        <select id="driver_status" class="swal2-select">
          <option value="ACTIVE" ${d.status === "ACTIVE" ? "selected" : ""}>ใช้งาน</option>
          <option value="INACTIVE" ${d.status === "INACTIVE" ? "selected" : ""}>ปิดใช้งาน</option>
        </select>

        <label>หมายเหตุ</label>
        <input id="driver_remark" class="swal2-input" value="${d.remark || ""}">
      </div>
    `,
    width: 700,
    showCancelButton: true,
    confirmButtonText: "บันทึกการแก้ไข",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#1455c8",
    cancelButtonColor: "#64748b",
    preConfirm: () => {
      const name = document.getElementById("driver_name").value.trim();
      const phone = document.getElementById("driver_phone").value.trim();
      const status = document.getElementById("driver_status").value;
      const remark = document.getElementById("driver_remark").value.trim();

      if (!name || !phone) {
        Swal.showValidationMessage("กรุณากรอกชื่อและเบอร์โทร");
        return false;
      }

      return {
        driver_id: d.driver_id,
        name,
        phone,
        status,
        remark,
      };
    },
  });

  if (!result.isConfirmed) return;

  try {
    await updateDriver(result.value);
    await showSuccess("แก้ไขข้อมูลคนขับสำเร็จ");
    await loadData();
  } catch (err) {
    showError(err.message || "แก้ไขคนขับไม่สำเร็จ");
  }
}

async function handleDeleteDriver(d) {
  const confirmed = await showConfirm(
    `ยืนยันลบคนขับ ${d.name} ใช่หรือไม่?\n\nข้อมูลจะหายถาวร`
  );

  if (!confirmed) return;

  try {
    await deleteDriver(d.driver_id);
    await showSuccess("ลบคนขับสำเร็จ");
    await loadData();
  } catch (err) {
    showError(err.message || "ลบคนขับไม่สำเร็จ");
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
                <tr 
                key={d.driver_id}
                className={d.status === "INACTIVE" ? "inactive-row" : ""}
              >
                  <td>{d.driver_id}</td>
                  <td>{d.name}</td>
                  <td>{d.phone}</td>
                  <td>{d.status}</td>
                  <td>{d.remark || "-"}</td>
                  <td className="action-buttons">
                  <button type="button" onClick={() => handleEditDriver(d)}>
                    แก้ไข
                  </button>

                  {d.status === "INACTIVE" ? (
                    <button type="button" onClick={() => handleDriverStatus(d, "ACTIVE")}>
                      เปิดใช้งาน
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="warning-button"
                      onClick={() => handleDriverStatus(d, "INACTIVE")}
                    >
                      ปิดใช้งาน
                    </button>
                  )}

                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => handleDeleteDriver(d)}
                  >
                    ลบ
                  </button>
                </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="form-card">
        <h3>จัดการผู้ใช้งาน</h3>

        <form onSubmit={handleSaveUser}>
          <div className="form-grid">
            <div>
              <label>ชื่อผู้ใช้งาน</label>
              <input
                value={userForm.name}
                onChange={(e) =>
                  setUserForm({ ...userForm, name: e.target.value })
                }
                placeholder="เช่น ผู้ดูแลระบบ"
              />
            </div>

            <div>
              <label>Email</label>
              <input
                value={userForm.email}
                onChange={(e) =>
                  setUserForm({ ...userForm, email: e.target.value })
                }
                placeholder="email@domain.com"
              />
            </div>

            {!userForm.user_id && (
              <div>
                <label>Password เริ่มต้น</label>
                <input
                  value={userForm.password}
                  onChange={(e) =>
                    setUserForm({ ...userForm, password: e.target.value })
                  }
                  placeholder="1234"
                />
              </div>
            )}

            <div>
              <label>หน่วยงาน</label>
              <input
                value={userForm.department}
                onChange={(e) =>
                  setUserForm({ ...userForm, department: e.target.value })
                }
              />
            </div>

            <div>
              <label>เบอร์โทร</label>
              <input
                value={userForm.phone}
                onChange={(e) =>
                  setUserForm({ ...userForm, phone: e.target.value })
                }
              />
            </div>

            <div>
              <label>Role</label>
              <select
                value={userForm.role}
                onChange={(e) =>
                  setUserForm({ ...userForm, role: e.target.value })
                }
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
                onChange={(e) =>
                  setUserForm({ ...userForm, status: e.target.value })
                }
              >
                <option value="ACTIVE">ใช้งาน</option>
                <option value="INACTIVE">ปิดใช้งาน</option>
              </select>
            </div>
          </div>

          <button>{userForm.user_id ? "บันทึกการแก้ไข" : "เพิ่มผู้ใช้งาน"}</button>

          {userForm.user_id && (
            <button
              type="button"
              onClick={clearUserForm}
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
              <tr
                key={u.user_id}
                className={u.status === "INACTIVE" ? "inactive-row" : ""}
              >
                <td>{u.user_id}</td>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.status}</td>
                <td className="action-buttons">
                  <button type="button" onClick={() => editUser(u)}>
                    แก้ไข
                  </button>

                  <button type="button" onClick={() => handleResetPassword(u)}>
                    เปลี่ยนรหัส
                  </button>

                  {u.status === "INACTIVE" ? (
                    <button type="button" onClick={() => handleEnableUser(u)}>
                      เปิดใช้งาน
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="warning-button"
                      onClick={() => handleDisableUser(u)}
                    >
                      ปิดใช้งาน
                    </button>
                  )}

                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => handleDeleteUser(u)}
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
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