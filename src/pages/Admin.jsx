import { formatThaiDateTime } from "../utils/date";
import { useEffect, useMemo, useState } from "react";
import {
  createVehicle,
  createDriver,
  createUser,
  deleteVehicle,
  getBookings,
  getDrivers,
  getUsers,
  getVehicles,
  resetUserPassword,
  updateVehicle,
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
import {
  ACTION_PERMISSION_GROUPS,
  DEFAULT_ROLE_ACTION_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_ITEMS,
  hasPermission,
  loadActionPermissionConfig,
  loadPermissionConfig,
  normalizeRole,
  saveActionPermissionConfig,
  savePermissionConfig,
} from "../permissions";
import Swal from "sweetalert2";

function countByStatus(items, status) {
  return items.filter((x) => x.status === status).length;
}

function normalizeVehicle(vehicle) {
  return {
    ...vehicle,
    vehicle_id: vehicle.vehicle_id || "",
    vehicle_name: vehicle.vehicle_name || vehicle.vehicle_code || "",
    license_plate: vehicle.license_plate || vehicle.plate_no || "",
    vehicle_type: vehicle.vehicle_type || "",
    status: String(vehicle.status || "").trim().toUpperCase(),
    note: vehicle.note || vehicle.driver_name || vehicle.next_booking || "",
  };
}

function getVehicleStatusText(status) {
  if (status === "AVAILABLE") return "พร้อมใช้งาน";
  if (status === "IN_USE") return "กำลังใช้งาน";
  if (status === "MAINTENANCE") return "ซ่อมบำรุง";
  if (status === "INACTIVE") return "ปิดใช้งาน";
  return status || "-";
}

function getVehicleStatusClass(status) {
  if (status === "AVAILABLE") return "status green";
  if (status === "IN_USE") return "status blue";
  if (status === "MAINTENANCE") return "status amber";
  if (status === "INACTIVE") return "status gray";
  return "status";
}

function SummaryCard({ title, value, className = "" }) {
  return (
    <div className={`summary-card ${className}`.trim()}>
      <h3>{title}</h3>
      <strong>{value}</strong>
    </div>
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderDriverOptions(drivers, selectedDriverId = "") {
  return drivers
    .map((driver) => {
      const driverId = String(driver.driver_id || "").trim();
      const name = String(driver.name || "").trim();

      if (!driverId && !name) return "";

      return `<option value="${escapeHtml(driverId)}" ${driverId === selectedDriverId ? "selected" : ""}>${escapeHtml(driverId)} - ${escapeHtml(name)}</option>`;
    })
    .join("");
}

const BOOKING_PER_PAGE = 5;

export default function Admin() {
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permissionConfig, setPermissionConfig] = useState(loadPermissionConfig);
  const [actionPermissionConfig, setActionPermissionConfig] = useState(loadActionPermissionConfig);
  const [selectedPermissionRole, setSelectedPermissionRole] = useState("STAFF");
  const [bookingPage, setBookingPage] = useState(1);
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
    try {
      setLoading(true);

      const [vehicleData, bookingData, driverData, userData] = await Promise.all([
        getVehicles(),
        getBookings(),
        getDrivers(),
        getUsers(),
      ]);

      setVehicles(Array.isArray(vehicleData) ? vehicleData : []);
      setBookings(Array.isArray(bookingData) ? bookingData : []);
      setDrivers(Array.isArray(driverData) ? driverData : []);
      setUsers(Array.isArray(userData) ? userData : []);
    } catch (err) {
      showError(err.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function refreshVehicles() {
    const vehicleData = await getVehicles();
    setVehicles(Array.isArray(vehicleData) ? vehicleData : []);
  }

  async function refreshBookings() {
    const bookingData = await getBookings();
    setBookings(Array.isArray(bookingData) ? bookingData : []);
  }

  async function refreshDrivers() {
    const driverData = await getDrivers();
    setDrivers(Array.isArray(driverData) ? driverData : []);
  }

  async function refreshUsers() {
    const userData = await getUsers();
    setUsers(Array.isArray(userData) ? userData : []);
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

      await refreshDrivers();
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

      await refreshDrivers();
      alert("อัปเดตสถานะสำเร็จ");
    } catch (err) {
      alert(err.message || "อัปเดตไม่สำเร็จ");
    }
  }
    async function handleOpenCreateDriver() {
    const result = await Swal.fire({
      title: "เพิ่มข้อมูลคนขับ",
      html: `
        <div class="swal-form">
          <label>ชื่อคนขับ</label>
          <input id="driver_name" class="swal2-input" placeholder="เช่น นายสมชาย">

          <label>เบอร์โทร</label>
          <input id="driver_phone" class="swal2-input" placeholder="08x-xxx-xxxx">

          <label>สถานะ</label>
          <select id="driver_status" class="swal2-select">
            <option value="ACTIVE">ใช้งาน</option>
            <option value="INACTIVE">ปิดใช้งาน</option>
          </select>

          <label>หมายเหตุ</label>
          <input id="driver_remark" class="swal2-input" placeholder="-">
        </div>
      `,
      width: 750,
      showCancelButton: true,
      confirmButtonText: "เพิ่มคนขับ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#1455c8",
      cancelButtonColor: "#64748b",
      preConfirm: () => {
        const name = document.getElementById("driver_name").value.trim();
        const phone = document.getElementById("driver_phone").value.trim();
        const status = document.getElementById("driver_status").value;
        const remark = document.getElementById("driver_remark").value.trim();

        if (!name || !phone) {
          Swal.showValidationMessage("กรุณากรอกชื่อคนขับและเบอร์โทร");
          return false;
        }

        return { name, phone, status, remark };
      },
    });

    if (!result.isConfirmed) return;

    try {
      await createDriver(result.value);
      await showSuccess("เพิ่มคนขับสำเร็จ");
      await refreshDrivers();
    } catch (err) {
      showError(err.message || "เพิ่มคนขับไม่สำเร็จ");
    }
  }
  async function editUser(u) {
    const result = await Swal.fire({
      title: "แก้ไขผู้ใช้งาน",
      html: `
        <div class="swal-form">
          <label>ชื่อผู้ใช้งาน</label>
          <input id="user_name" class="swal2-input" value="${escapeHtml(u.name || "")}" placeholder="ชื่อ-นามสกุล">

          <label>Email</label>
          <input id="user_email" class="swal2-input" value="${escapeHtml(u.email || "")}" placeholder="email@domain.com">

          <label>หน่วยงาน</label>
          <input id="user_department" class="swal2-input" value="${escapeHtml(u.department || "")}">

          <label>เบอร์โทร</label>
          <input id="user_phone" class="swal2-input" value="${escapeHtml(u.phone || "")}" placeholder="08x-xxx-xxxx">

          <label>Role</label>
          <select id="user_role" class="swal2-select">
            <option value="USER" ${normalizeRole(u.role) === "USER" ? "selected" : ""}>USER</option>
            <option value="STAFF" ${normalizeRole(u.role) === "STAFF" ? "selected" : ""}>STAFF</option>
            <option value="DRIVER" ${normalizeRole(u.role) === "DRIVER" ? "selected" : ""}>DRIVER</option>
            <option value="ADMIN" ${normalizeRole(u.role) === "ADMIN" ? "selected" : ""}>ADMIN</option>
          </select>

          <label>สถานะ</label>
          <select id="user_status" class="swal2-select">
            <option value="ACTIVE" ${normalizeRole(u.status) === "ACTIVE" ? "selected" : ""}>ใช้งาน</option>
            <option value="INACTIVE" ${normalizeRole(u.status) === "INACTIVE" ? "selected" : ""}>ปิดใช้งาน</option>
          </select>
        </div>
      `,
      width: 750,
      showCancelButton: true,
      confirmButtonText: "บันทึกการแก้ไข",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#1455c8",
      cancelButtonColor: "#64748b",
      preConfirm: () => {
        const name = document.getElementById("user_name").value.trim();
        const email = document.getElementById("user_email").value.trim();
        const department = document.getElementById("user_department").value.trim();
        const phone = document.getElementById("user_phone").value.trim();
        const role = document.getElementById("user_role").value;
        const status = document.getElementById("user_status").value;

        if (!name || !email) {
          Swal.showValidationMessage("กรุณากรอกชื่อผู้ใช้งานและ Email");
          return false;
        }

        return {
          user_id: u.user_id,
          name,
          email,
          department,
          phone,
          role,
          status,
        };
      },
    });

    if (!result.isConfirmed) return;

    try {
      await updateUser(result.value);
      await showSuccess("แก้ไขผู้ใช้งานสำเร็จ");
      await refreshUsers();
    } catch (err) {
      showError(err.message || "แก้ไขผู้ใช้งานไม่สำเร็จ");
    }
  }
async function handleOpenCreateUser() {
  const result = await Swal.fire({
    title: "เพิ่มผู้ใช้งาน",
    html: `
      <div class="swal-form">
        <label>ชื่อผู้ใช้งาน</label>
        <input id="user_name" class="swal2-input" placeholder="เช่น ผู้ดูแลระบบ">

        <label>Email</label>
        <input id="user_email" class="swal2-input" placeholder="email@domain.com">

        <label>Password เริ่มต้น</label>
        <input id="user_password" class="swal2-input" value="1234">

        <label>หน่วยงาน</label>
        <input id="user_department" class="swal2-input" value="ศูนย์รับบริจาคอวัยวะ">

        <label>เบอร์โทร</label>
        <input id="user_phone" class="swal2-input" placeholder="08x-xxx-xxxx">

        <label>Role</label>
        <select id="user_role" class="swal2-select">
          <option value="USER">USER</option>
          <option value="STAFF">STAFF</option>
          <option value="DRIVER">DRIVER</option>
          <option value="ADMIN">ADMIN</option>
        </select>

        <label>สถานะ</label>
        <select id="user_status" class="swal2-select">
          <option value="ACTIVE">ใช้งาน</option>
          <option value="INACTIVE">ปิดใช้งาน</option>
        </select>
      </div>
    `,
    width: 750,
    showCancelButton: true,
    confirmButtonText: "เพิ่มผู้ใช้งาน",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#1455c8",
    cancelButtonColor: "#64748b",
    preConfirm: () => {
      const name = document.getElementById("user_name").value.trim();
      const email = document.getElementById("user_email").value.trim();
      const password = document.getElementById("user_password").value.trim();
      const department = document.getElementById("user_department").value.trim();
      const phone = document.getElementById("user_phone").value.trim();
      const role = document.getElementById("user_role").value;
      const status = document.getElementById("user_status").value;

      if (!name || !email || !password) {
        Swal.showValidationMessage("กรุณากรอกชื่อ Email และ Password");
        return false;
      }

      return {
        name,
        email,
        password,
        department,
        phone,
        role,
        status,
      };
    },
  });

  if (!result.isConfirmed) return;

  try {
    await createUser(result.value);
    await showSuccess("เพิ่มผู้ใช้งานสำเร็จ");
    await refreshUsers();
  } catch (err) {
    showError(err.message || "เพิ่มผู้ใช้งานไม่สำเร็จ");
  }
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
      await refreshUsers();
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
      await refreshUsers();
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

      await refreshUsers();
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

    await refreshUsers();
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

      await refreshUsers();
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
    await refreshUsers();
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

  const bookingStatusCounts = useMemo(
    () => ({
      PENDING: countByStatus(bookings, "PENDING"),
      APPROVED: countByStatus(bookings, "APPROVED"),
      IN_USE: countByStatus(bookings, "IN_USE"),
      COMPLETED: countByStatus(bookings, "COMPLETED"),
      CANCELLED: countByStatus(bookings, "CANCELLED"),
    }),
    [bookings]
  );

  const permissionRoles = useMemo(
    () =>
      Array.from(
        new Set([
          ...Object.keys(DEFAULT_ROLE_PERMISSIONS),
          ...users.map((u) => normalizeRole(u.role)).filter(Boolean),
        ])
      ),
    [users]
  );

  const bookingPageCount = useMemo(
    () => Math.max(1, Math.ceil(bookings.length / BOOKING_PER_PAGE)),
    [bookings.length]
  );

  const bookingPageItems = useMemo(
    () => bookings.slice((bookingPage - 1) * BOOKING_PER_PAGE, bookingPage * BOOKING_PER_PAGE),
    [bookings, bookingPage]
  );

  const normalizedVehicles = useMemo(() => vehicles.map(normalizeVehicle), [vehicles]);

  const summaryCards = useMemo(
    () => [
      { title: "รถทั้งหมด", value: vehicles.length },
      { title: "รายการจองทั้งหมด", value: bookings.length },
      { title: "รออนุมัติ", value: bookingStatusCounts.PENDING, className: "amber-box" },
      { title: "อนุมัติแล้ว", value: bookingStatusCounts.APPROVED, className: "blue-box" },
      { title: "กำลังใช้งาน", value: bookingStatusCounts.IN_USE, className: "green-box" },
      { title: "เสร็จสิ้น", value: bookingStatusCounts.COMPLETED, className: "gray-box" },
      { title: "ยกเลิก", value: bookingStatusCounts.CANCELLED, className: "red-box" },
    ],
    [vehicles.length, bookings.length, bookingStatusCounts]
  );

  const canManageSettings = hasPermission(null, "settings_manage");
  const canViewDrivers = hasPermission(null, "drivers_view");
  const canCreateDrivers = hasPermission(null, "drivers_create");
  const canEditDrivers = hasPermission(null, "drivers_edit");
  const canDeleteDrivers = hasPermission(null, "drivers_delete");
  const canViewVehicles = hasPermission(null, "vehicles_view");
  const canCreateVehicles = hasPermission(null, "vehicles_create");
  const canEditVehicles = hasPermission(null, "vehicles_edit");
  const canDeleteVehicles = hasPermission(null, "vehicles_delete");
  const canViewUsers = hasPermission(null, "users_view");
  const canCreateUsers = hasPermission(null, "users_create");
  const canEditUsers = hasPermission(null, "users_edit");
  const canDeleteUsers = hasPermission(null, "users_delete");

  function roleHasPermission(role, permissionId) {
    if (role === "ADMIN") return true;
    return (permissionConfig[role] || []).includes(permissionId);
  }

  function toggleRolePermission(role, permissionId) {
    if (role === "ADMIN") return;

    const currentPermissions = new Set(permissionConfig[role] || []);

    if (currentPermissions.has(permissionId)) {
      currentPermissions.delete(permissionId);
    } else {
      currentPermissions.add(permissionId);
    }

    setPermissionConfig({
      ...permissionConfig,
      [role]: [...currentPermissions],
    });
  }

  async function handleSavePermissions() {
    const savedConfig = savePermissionConfig(permissionConfig);
    setPermissionConfig(savedConfig);
    await showSuccess("บันทึกสิทธิ์การมองเห็นเมนูสำเร็จ");
  }

  async function handleResetPermissions() {
    const confirmed = await showConfirm("ยืนยันคืนค่าสิทธิ์เริ่มต้นใช่หรือไม่?");
    if (!confirmed) return;

    const savedConfig = savePermissionConfig(DEFAULT_ROLE_PERMISSIONS);
    setPermissionConfig(savedConfig);
    await showSuccess("คืนค่าสิทธิ์เริ่มต้นสำเร็จ");
  }

  function roleHasActionPermission(role, permissionId) {
    if (role === "ADMIN") return true;
    return (actionPermissionConfig[role] || []).includes(permissionId);
  }

  function toggleRoleActionPermission(role, permissionId) {
    if (role === "ADMIN") return;

    const currentPermissions = new Set(actionPermissionConfig[role] || []);

    if (currentPermissions.has(permissionId)) {
      currentPermissions.delete(permissionId);
    } else {
      currentPermissions.add(permissionId);
    }

    setActionPermissionConfig({
      ...actionPermissionConfig,
      [role]: [...currentPermissions],
    });
  }

  async function handleSaveActionPermissions() {
    const savedConfig = saveActionPermissionConfig(actionPermissionConfig);
    setActionPermissionConfig(savedConfig);
    await showSuccess("บันทึกสิทธิ์ action สำเร็จ");
  }

  async function handleResetActionPermissions() {
    const confirmed = await showConfirm("ยืนยันคืนค่าสิทธิ์ action เริ่มต้นใช่หรือไม่?");
    if (!confirmed) return;

    const savedConfig = saveActionPermissionConfig(DEFAULT_ROLE_ACTION_PERMISSIONS);
    setActionPermissionConfig(savedConfig);
    await showSuccess("คืนค่าสิทธิ์ action เริ่มต้นสำเร็จ");
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
    await refreshDrivers();
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
    await refreshDrivers();
  } catch (err) {
    showError(err.message || "ลบคนขับไม่สำเร็จ");
  }
}

async function handleOpenCreateVehicle() {
  const result = await Swal.fire({
    title: "เพิ่มข้อมูลรถ",
    html: `
      <div class="swal-form">
        <label>ชื่อรถ</label>
        <input id="vehicle_name" class="swal2-input" placeholder="เช่น รถตู้ Toyota">

        <label>ทะเบียนรถ</label>
        <input id="license_plate" class="swal2-input" placeholder="เช่น 1ข 1234">

        <label>ประเภทรถ</label>
        <input id="vehicle_type" class="swal2-input" placeholder="เช่น รถตู้">

        <label>สถานะ</label>
        <select id="vehicle_status" class="swal2-select">
          <option value="AVAILABLE">พร้อมใช้งาน</option>
          <option value="IN_USE">กำลังใช้งาน</option>
          <option value="MAINTENANCE">ซ่อมบำรุง</option>
          <option value="INACTIVE">ปิดใช้งาน</option>
        </select>

        <label>หมายเหตุ</label>
        <input id="vehicle_note" class="swal2-input" placeholder="-">
      </div>
    `,
    width: 750,
    showCancelButton: true,
    confirmButtonText: "เพิ่มรถ",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#1455c8",
    cancelButtonColor: "#64748b",
    preConfirm: () => {
      const vehicle_name = document.getElementById("vehicle_name").value.trim();
      const license_plate = document.getElementById("license_plate").value.trim();
      const vehicle_type = document.getElementById("vehicle_type").value.trim();
      const status = document.getElementById("vehicle_status").value;
      const note = document.getElementById("vehicle_note").value.trim();

      if (!vehicle_name || !license_plate || !vehicle_type) {
        Swal.showValidationMessage("กรุณากรอกชื่อรถ ทะเบียนรถ และประเภทรถ");
        return false;
      }

      return {
        vehicle_name,
        license_plate,
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
    await refreshVehicles();
  } catch (err) {
    showError(err.message || "เพิ่มรถไม่สำเร็จ");
  }
}

async function handleEditVehicle(vehicle) {
  const result = await Swal.fire({
    title: "แก้ไขข้อมูลรถ",
    html: `
      <div class="swal-form">
        <label>ชื่อรถ</label>
        <input id="vehicle_name" class="swal2-input" value="${vehicle.vehicle_name || ""}">

        <label>ทะเบียนรถ</label>
        <input id="license_plate" class="swal2-input" value="${vehicle.license_plate || ""}">

        <label>ประเภทรถ</label>
        <input id="vehicle_type" class="swal2-input" value="${vehicle.vehicle_type || ""}">

        <label>สถานะ</label>
        <select id="vehicle_status" class="swal2-select">
          <option value="AVAILABLE" ${vehicle.status === "AVAILABLE" ? "selected" : ""}>พร้อมใช้งาน</option>
          <option value="IN_USE" ${vehicle.status === "IN_USE" ? "selected" : ""}>กำลังใช้งาน</option>
          <option value="MAINTENANCE" ${vehicle.status === "MAINTENANCE" ? "selected" : ""}>ซ่อมบำรุง</option>
          <option value="INACTIVE" ${vehicle.status === "INACTIVE" ? "selected" : ""}>ปิดใช้งาน</option>
        </select>

        <label>หมายเหตุ</label>
        <input id="vehicle_note" class="swal2-input" value="${vehicle.note || ""}">
      </div>
    `,
    width: 750,
    showCancelButton: true,
    confirmButtonText: "บันทึกการแก้ไข",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#1455c8",
    cancelButtonColor: "#64748b",
    preConfirm: () => {
      const vehicle_name = document.getElementById("vehicle_name").value.trim();
      const license_plate = document.getElementById("license_plate").value.trim();
      const vehicle_type = document.getElementById("vehicle_type").value.trim();
      const status = document.getElementById("vehicle_status").value;
      const note = document.getElementById("vehicle_note").value.trim();

      if (!vehicle_name || !license_plate || !vehicle_type) {
        Swal.showValidationMessage("กรุณากรอกชื่อรถ ทะเบียนรถ และประเภทรถ");
        return false;
      }

      return {
        vehicle_id: vehicle.vehicle_id,
        vehicle_name,
        license_plate,
        vehicle_type,
        status,
        note,
      };
    },
  });

  if (!result.isConfirmed) return;

  try {
    await updateVehicle(result.value);
    await showSuccess("แก้ไขข้อมูลรถสำเร็จ");
    await refreshVehicles();
  } catch (err) {
    showError(err.message || "แก้ไขข้อมูลรถไม่สำเร็จ");
  }
}

async function handleDeleteVehicle(vehicle) {
  const confirmed = await showConfirm(
    `ยืนยันลบรถ ${vehicle.vehicle_name} ใช่หรือไม่?\n\nข้อมูลจะหายถาวร`
  );

  if (!confirmed) return;

  try {
    await deleteVehicle(vehicle.vehicle_id);
    await showSuccess("ลบรถสำเร็จ");
    await refreshVehicles();
  } catch (err) {
    showError(err.message || "ลบรถไม่สำเร็จ");
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
        {summaryCards.map((card) => (
          <SummaryCard key={card.title} title={card.title} value={card.value} className={card.className} />
        ))}
      </div>
 <br></br>
      <div className="form-card permission-card">
        <h3>จัดการสิทธิ์</h3>
        <div className="section-toolbar permission-toolbar">
          <button type="button" onClick={handleSavePermissions}>
            บันทึกสิทธิ์
          </button>
          <button type="button" className="warning-button" onClick={handleResetPermissions}>
            คืนค่าเริ่มต้น
          </button>
        </div>

        <div className="table-wrap">
          <table className="permission-table">
            <thead>
              <tr>
                <th>Role</th>
                {PERMISSION_ITEMS.map((permission) => (
                  <th key={permission.id}>{permission.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissionRoles.map((role) => (
                <tr key={role}>
                  <td>
                    <b>{role}</b>
                    {role === "ADMIN" && <span className="permission-note">เห็นทุกเมนูเสมอ</span>}
                  </td>
                  {PERMISSION_ITEMS.map((permission) => (
                    <td key={permission.id}>
                      <label className="permission-checkbox">
                        <input
                          type="checkbox"
                          checked={roleHasPermission(role, permission.id)}
                          disabled={role === "ADMIN"}
                          onChange={() => toggleRolePermission(role, permission.id)}
                        />
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {canManageSettings && (
      <div className="form-card permission-card">
        <h3>จัดการสิทธิ์ Action</h3>
        <div className="permission-action-header">
          <div>
            <label>Role</label>
            <select
              value={selectedPermissionRole}
              onChange={(e) => setSelectedPermissionRole(e.target.value)}
            >
              {permissionRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div className="section-toolbar permission-toolbar">
            <button type="button" onClick={handleSaveActionPermissions}>
              บันทึกสิทธิ์ Action
            </button>
            <button type="button" className="warning-button" onClick={handleResetActionPermissions}>
              คืนค่าเริ่มต้น
            </button>
          </div>
        </div>

        <div className="permission-action-grid">
          {ACTION_PERMISSION_GROUPS.map((group) => (
            <div className="permission-action-group" key={group.id}>
              <h4>{group.label}</h4>
              {group.permissions.map((permission) => (
                <label className="permission-action-row" key={permission.id}>
                  <input
                    type="checkbox"
                    checked={roleHasActionPermission(selectedPermissionRole, permission.id)}
                    disabled={selectedPermissionRole === "ADMIN"}
                    onChange={() =>
                      toggleRoleActionPermission(selectedPermissionRole, permission.id)
                    }
                  />
                  <span>{permission.label}</span>
                  <code>{permission.id}</code>
                </label>
              ))}
            </div>
          ))}
        </div>

        {selectedPermissionRole === "ADMIN" && (
          <p className="permission-note">ADMIN ได้ทุกสิทธิ์เสมอและไม่สามารถปิดได้</p>
        )}
      </div>
      )}

      {canViewVehicles && (
      <div className="form-card">
        <h3>Vehicle Management</h3>
        <div className="section-toolbar">
          {canCreateVehicles && (
          <button type="button" onClick={handleOpenCreateVehicle}>
            เพิ่มรถ
          </button>
          )}
        </div>

        {loading ? (
          <p>กำลังโหลดข้อมูลรถ...</p>
        ) : (
        <div className="table-wrap" style={{ marginTop: 24 }}>
          <table>
            <thead>
              <tr>
                <th>รหัสรถ</th>
                <th>ชื่อรถ</th>
                <th>ทะเบียนรถ</th>
                <th>ประเภทรถ</th>
                <th>สถานะ</th>
                <th>หมายเหตุ</th>
                <th>จัดการ</th>
              </tr>
            </thead>

            <tbody>
              {normalizedVehicles.length === 0 ? (
                <tr>
                  <td colSpan="7">ไม่มีข้อมูลรถ</td>
                </tr>
              ) : (
                normalizedVehicles.map((vehicle) => (
                  <tr
                    key={vehicle.vehicle_id}
                    className={vehicle.status === "INACTIVE" ? "inactive-row" : ""}
                  >
                    <td>{vehicle.vehicle_id || "-"}</td>
                    <td>{vehicle.vehicle_name || "-"}</td>
                    <td>{vehicle.license_plate || "-"}</td>
                    <td>{vehicle.vehicle_type || "-"}</td>
                    <td>
                      <span className={getVehicleStatusClass(vehicle.status)}>
                        {getVehicleStatusText(vehicle.status)}
                      </span>
                    </td>
                    <td>{vehicle.note || "-"}</td>
                    <td className="action-buttons">
                      {canEditVehicles && (
                      <button type="button" onClick={() => handleEditVehicle(vehicle)}>
                        แก้ไข
                      </button>
                      )}

                      {canDeleteVehicles && (
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => handleDeleteVehicle(vehicle)}
                      >
                        ลบ
                      </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
      )}

      {canViewDrivers && (
      <div className="form-card">
        <h3>จัดการคนขับ</h3>
        <div className="section-toolbar">
        {canCreateDrivers && (
        <button type="button" onClick={handleOpenCreateDriver}>
          เพิ่มข้อมูลคนขับ
        </button>
        )}
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
                  {canEditDrivers && (
                  <button type="button" onClick={() => handleEditDriver(d)}>
                    แก้ไข
                  </button>
                  )}

                  {canEditDrivers && d.status === "INACTIVE" ? (
                    <button type="button" onClick={() => handleDriverStatus(d, "ACTIVE")}>
                      เปิดใช้งาน
                    </button>
                  ) : canEditDrivers ? (
                    <button
                      type="button"
                      className="warning-button"
                      onClick={() => handleDriverStatus(d, "INACTIVE")}
                    >
                      ปิดใช้งาน
                    </button>
                  ) : null}

                  {canDeleteDrivers && (
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => handleDeleteDriver(d)}
                  >
                    ลบ
                  </button>
                  )}
                </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {canViewUsers && (
      <div className="form-card">
        <h3>จัดการผู้ใช้งาน</h3>
      <div className="section-toolbar">
        {canCreateUsers && (
        <button type="button" onClick={handleOpenCreateUser}>
          เพิ่มผู้ใช้งาน
        </button>
        )}
      </div>
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
                  {canEditUsers && (
                  <button type="button" onClick={() => editUser(u)}>
                    แก้ไข
                  </button>
                  )}

                  {canEditUsers && (
                  <button type="button" onClick={() => handleResetPassword(u)}>
                    เปลี่ยนรหัส
                  </button>
                  )}

                  {canEditUsers && u.status === "INACTIVE" ? (
                    <button type="button" onClick={() => handleEnableUser(u)}>
                      เปิดใช้งาน
                    </button>
                  ) : canEditUsers ? (
                    <button
                      type="button"
                      className="warning-button"
                      onClick={() => handleDisableUser(u)}
                    >
                      ปิดใช้งาน
                    </button>
                  ) : null}

                  {canDeleteUsers && (
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => handleDeleteUser(u)}
                  >
                    ลบ
                  </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>
      )}

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
              {bookingPageItems.map((b) => (
                <tr key={b.booking_id}>
                  <td>{b.booking_no}</td>
                  <td>{b.requester_name}</td>
                  <td>{b.destination}</td>
                  <td>{b.vehicle_id || "-"}</td>
                  <td>{b.assigned_user_name || "-"}</td>
                  <td>{b.status}</td>
                  <td>{b.staff_note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
          {Array.from({ length: bookingPageCount }).map((_, index) => (
            <button
              key={index}
              type="button"
              className={bookingPage === index + 1 ? "active-page" : ""}
              onClick={() => setBookingPage(index + 1)}
            >
              {index + 1}
            </button>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}

