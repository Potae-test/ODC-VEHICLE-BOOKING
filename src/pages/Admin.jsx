import { formatThaiDateTime } from "../utils/date";
import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  backdateCompleteBooking,
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
  DEFAULT_DRIVER_SUMMARY_CARD_SCOPE,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_ITEMS,
  hasPermission,
  loadDriverSummaryCardScopeConfig,
  loadActionPermissionConfig,
  loadPermissionConfig,
  normalizeRole,
  saveDriverSummaryCardScopeConfig,
  saveActionPermissionConfig,
  savePermissionConfig,
} from "../permissions";
import BookingFormModal from "../components/booking/BookingFormModal";
import ThaiDateTimeField from "../components/common/ThaiDateTimeField";
import TableSkeleton from "../components/skeletons/TableSkeleton";
import { FEATURES } from "../config/features";
import useMinimumLoading from "../hooks/useMinimumLoading";
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

function getVehicleStatusClass(status) {
  if (status === "AVAILABLE") return "status green";
  if (status === "IN_USE") return "status blue";
  if (status === "MAINTENANCE") return "status amber";
  if (status === "INACTIVE") return "status gray";
  return "status";
}

function SummaryCard({ title, value, className = "" }) {
  return (
    <div className={`summary-card rounded-3xl border border-sky-100 bg-white shadow-sm ${className}`.trim()}>
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

function getActionPermissionGroups() {
  const groups = ACTION_PERMISSION_GROUPS.map((group) => ({
    ...group,
    permissions: [...group.permissions],
  }));

  const calendarGroup = groups.find((group) => group.id === "calendar");
  if (calendarGroup) {
    return groups;
  }

  return [
    ...groups.slice(0, 5),
    {
      id: "calendar",
      label: "ปฏิทิน",
      permissions: [
        { id: "calendar_active_drivers_view", label: "ดูกล่องคนขับพร้อมรับงาน" },
        { id: "calendar_next_queue_driver_view", label: "ดูกล่องคนขับคิวถัดไป" },
      ],
    },
    ...groups.slice(5),
  ];
}

const BOOKING_PER_PAGE = 5;

const BOOKING_STATUS_META = {
  PENDING: { label: "รออนุมัติ", className: "amber" },
  APPROVED: { label: "อนุมัติแล้ว", className: "blue" },
  IN_USE: { label: "กำลังใช้งาน", className: "green" },
  COMPLETED: { label: "เสร็จสิ้น", className: "gray" },
  CANCELLED: { label: "ยกเลิก", className: "red" },
  DRIVER_CANCEL_PENDING: { label: "รออนุมัติการยกเลิก", className: "red" },
};

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("odc_user") || "null");
  } catch {
    return null;
  }
}

function getBookingId(booking) {
  return String(booking?.booking_id || booking?.id || booking?.bookingId || "").trim();
}

function isBackdatedFlagEnabled(booking) {
  return normalizeStatus(booking?.is_backdated) === "TRUE";
}

function isEditableBookingStatus(status) {
  return !["IN_USE", "COMPLETED", "CANCELLED"].includes(normalizeStatus(status));
}

function getDriverCancelRequestStatus(booking) {
  if (normalizeStatus(booking?.status) === "COMPLETED") {
    return "";
  }

  return normalizeStatus(booking?.driver_cancel_request_status);
}

function getBookingStatusMeta(status) {
  return BOOKING_STATUS_META[normalizeStatus(status)] || {
    label: status || "-",
    className: "gray",
  };
}

function sortLatestBookings(items) {
  return [...items].sort((a, b) => {
    const timeA = new Date(a.updated_at || a.created_at || a.start_datetime || 0).getTime();
    const timeB = new Date(b.updated_at || b.created_at || b.start_datetime || 0).getTime();
    return timeB - timeA;
  });
}

function getBookingVehicleLabel(booking, vehicleMap) {
  const vehicleId = String(booking?.vehicle_id || "").trim();
  if (!vehicleId) return "-";

  const vehicle = vehicleMap.get(vehicleId);
  if (!vehicle) return vehicleId;

  const vehicleName = vehicle.vehicle_name || vehicle.vehicle_code || vehicle.vehicle_id || "-";
  const plate = vehicle.license_plate || vehicle.plate_no || "-";
  return `${vehicleName} / ${plate}`;
}

export default function Admin() {
  const currentUser = useMemo(() => getCurrentUser(), []);
  const bookingFormModalRef = useRef(null);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingAction, setBookingAction] = useState(null);
  const [permissionConfig, setPermissionConfig] = useState(loadPermissionConfig);
  const [actionPermissionConfig, setActionPermissionConfig] = useState(loadActionPermissionConfig);
  const actionPermissionGroups = useMemo(() => getActionPermissionGroups(), []);
  const [driverSummaryCardScopeConfig, setDriverSummaryCardScopeConfig] = useState(
    loadDriverSummaryCardScopeConfig
  );
  const [selectedPermissionRole, setSelectedPermissionRole] = useState("STAFF");
  const [bookingPage, setBookingPage] = useState(1);
  const visibleLoading = useMinimumLoading(loading, 350);
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

  const sortedBookings = useMemo(() => sortLatestBookings(bookings), [bookings]);

  const bookingPageCount = useMemo(
    () => Math.max(1, Math.ceil(sortedBookings.length / BOOKING_PER_PAGE)),
    [sortedBookings.length]
  );

  const bookingPageItems = useMemo(
    () => sortedBookings.slice((bookingPage - 1) * BOOKING_PER_PAGE, bookingPage * BOOKING_PER_PAGE),
    [sortedBookings, bookingPage]
  );

  const normalizedVehicles = useMemo(() => vehicles.map(normalizeVehicle), [vehicles]);
  const vehicleMap = useMemo(() => {
    const map = new Map();

    normalizedVehicles.forEach((vehicle) => {
      map.set(String(vehicle.vehicle_id || "").trim(), vehicle);
    });

    return map;
  }, [normalizedVehicles]);
  const vehicleTypes = useMemo(
    () =>
      Array.from(
        new Set(
          normalizedVehicles
            .map((vehicle) => String(vehicle.vehicle_type || "").trim())
            .filter(Boolean)
        )
      ),
    [normalizedVehicles]
  );
  const activeDriverUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          normalizeStatus(user.role) === "DRIVER" &&
          normalizeStatus(user.status || "ACTIVE") === "ACTIVE"
      ),
    [users]
  );

  const summaryCards = useMemo(
    () => [
      ...(FEATURES.vehicleModule ? [{ title: "รถทั้งหมด", value: vehicles.length }] : []),
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
  const canViewBookings = hasPermission(null, "bookings_view");
  const canCreateBookings = hasPermission(null, "bookings_create");
  const canEditBookings = hasPermission(null, "bookings_edit");
  const canBackdateBookings = hasPermission(null, "bookings_approve");
  const canViewVehicles = FEATURES.vehicleModule && hasPermission(null, "vehicles_view");
  const canCreateVehicles = FEATURES.vehicleModule && hasPermission(null, "vehicles_create");
  const canEditVehicles = FEATURES.vehicleModule && hasPermission(null, "vehicles_edit");
  const canDeleteVehicles = FEATURES.vehicleModule && hasPermission(null, "vehicles_delete");
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

  function handleChangeDriverSummaryCardScope(role, scope) {
    if (role === "ADMIN") return;

    setDriverSummaryCardScopeConfig((current) => ({
      ...current,
      [role]: scope,
    }));
  }

  async function handleSaveDriverSummaryCardScope() {
    const savedConfig = saveDriverSummaryCardScopeConfig(driverSummaryCardScopeConfig);
    setDriverSummaryCardScopeConfig(savedConfig);
    await showSuccess("บันทึกสิทธิ์กล่องสรุปคนขับสำเร็จ");
  }

  async function handleResetDriverSummaryCardScope() {
    const confirmed = await showConfirm("ยืนยันคืนค่ากล่องสรุปคนขับเริ่มต้นใช่หรือไม่?");
    if (!confirmed) return;

    const savedConfig = saveDriverSummaryCardScopeConfig(DEFAULT_DRIVER_SUMMARY_CARD_SCOPE);
    setDriverSummaryCardScopeConfig(savedConfig);
    await showSuccess("คืนค่ากล่องสรุปคนขับเริ่มต้นสำเร็จ");
  }

  function mergeBooking(nextBooking) {
    if (!nextBooking) return;

    const nextBookingId = getBookingId(nextBooking);
    if (!nextBookingId) return;

    setBookings((current) => {
      const existingIndex = current.findIndex((booking) => getBookingId(booking) === nextBookingId);

      if (existingIndex === -1) {
        return [nextBooking, ...current];
      }

      return current.map((booking) =>
        getBookingId(booking) === nextBookingId ? { ...booking, ...nextBooking } : booking
      );
    });
  }

  async function handleCreateBooking() {
    if (bookingAction) return;

    setBookingAction({ bookingId: "", type: "create" });
    await bookingFormModalRef.current?.openCreate();
    setBookingAction(null);
  }

  async function handleEditBooking(booking) {
    if (bookingAction) return;

    const bookingId = getBookingId(booking);
    if (!bookingId) {
      showError("ไม่พบรหัสรายการจอง");
      return;
    }

    setBookingAction({ bookingId, type: "edit" });
    await bookingFormModalRef.current?.openEdit(booking);
    setBookingAction(null);
  }

  async function handleBackdateBooking(booking) {
    if (bookingAction) return;

    let backdateActualStart = "";
    let backdateActualReturn = "";
    let actualStartRoot = null;
    let actualReturnRoot = null;

    const result = await Swal.fire({
      title: "บันทึกงานย้อนหลัง",
      html: `
        <div class="swal-form">
          <label>คนขับ</label>
          <select id="backdate_assigned_user_id" class="swal2-select">
            <option value="">-- เลือกคนขับ --</option>
            ${activeDriverUsers
              .map(
                (driver) =>
                  `<option value="${escapeHtml(driver.user_id)}">${escapeHtml(driver.name || "-")}</option>`
              )
              .join("")}
          </select>

          ${
            FEATURES.vehicleModule
              ? `
          <label>รถ</label>
          <select id="backdate_vehicle_id" class="swal2-select">
            <option value="">-- เลือกรถ --</option>
            ${normalizedVehicles
              .map((vehicle) => {
                const label = `${vehicle.vehicle_name || vehicle.vehicle_code || vehicle.vehicle_id} - ${
                  vehicle.license_plate || vehicle.plate_no || "-"
                }`;
                return `<option value="${escapeHtml(vehicle.vehicle_id)}">${escapeHtml(label)}</option>`;
              })
              .join("")}
          </select>
          `
              : ""
          }

          <div id="backdate_actual_start_container"></div>
          <div id="backdate_actual_return_container"></div>

          <label>หมายเหตุ</label>
          <textarea id="backdate_note" class="swal2-textarea" rows="4">บันทึกรายการย้อนหลัง</textarea>
        </div>
      `,
      width: 760,
      showCancelButton: true,
      confirmButtonText: "บันทึก",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#f59e0b",
      cancelButtonColor: "#64748b",
      didOpen: () => {
        const startEl = document.getElementById("backdate_actual_start_container");
        const returnEl = document.getElementById("backdate_actual_return_container");

        if (startEl) {
          actualStartRoot = createRoot(startEl);
          actualStartRoot.render(
            <ThaiDateTimeField
              label="เวลาออกรถจริง"
              value={backdateActualStart}
              onChange={(value) => {
                backdateActualStart = value || "";
              }}
            />
          );
        }

        if (returnEl) {
          actualReturnRoot = createRoot(returnEl);
          actualReturnRoot.render(
            <ThaiDateTimeField
              label="เวลากลับจริง"
              value={backdateActualReturn}
              onChange={(value) => {
                backdateActualReturn = value || "";
              }}
            />
          );
        }
      },
      willClose: () => {
        actualStartRoot?.unmount?.();
        actualReturnRoot?.unmount?.();
      },
      preConfirm: () => {
        const assigned_user_id = document.getElementById("backdate_assigned_user_id").value.trim();
        const vehicle_id = FEATURES.vehicleModule
          ? document.getElementById("backdate_vehicle_id")?.value.trim() || ""
          : "";
        const note = document.getElementById("backdate_note").value.trim();
        const actual_start_datetime = backdateActualStart || "";
        const actual_return_datetime = backdateActualReturn || "";

        if (!assigned_user_id) {
          Swal.showValidationMessage("กรุณาเลือกคนขับ");
          return false;
        }

        const driver = activeDriverUsers.find(
          (item) => String(item.user_id || "").trim() === assigned_user_id
        );
        const vehicle = FEATURES.vehicleModule
          ? normalizedVehicles.find((item) => String(item.vehicle_id || "").trim() === vehicle_id)
          : null;

        if (!driver) {
          Swal.showValidationMessage("ไม่พบข้อมูลคนขับ");
          return false;
        }

        if (FEATURES.vehicleModule && !vehicle) {
          Swal.showValidationMessage("ไม่พบข้อมูลรถ");
          return false;
        }

        if (actual_start_datetime && actual_return_datetime) {
          const startTime = new Date(actual_start_datetime).getTime();
          const returnTime = new Date(actual_return_datetime).getTime();

          if (!Number.isNaN(startTime) && !Number.isNaN(returnTime) && returnTime < startTime) {
            Swal.showValidationMessage("เวลากลับจริงต้องไม่น้อยกว่าเวลาออกรถจริง");
            return false;
          }
        }

        return {
          assigned_user_id,
          assigned_user_name: driver.name || "",
          vehicle_id: FEATURES.vehicleModule ? vehicle_id : "",
          note,
          actual_start_datetime,
          actual_return_datetime,
        };
      },
    });

    if (!result.isConfirmed) return;

    const bookingId = getBookingId(booking);
    if (!bookingId) {
      showError("ไม่พบรหัสรายการจอง");
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const actor = currentUser?.name || currentUser?.email || "";
      const payload = {
        booking_id: bookingId,
        booking_no: booking.booking_no || "",
        assigned_user_id: result.value.assigned_user_id,
        assigned_user_name: result.value.assigned_user_name,
        vehicle_id: result.value.vehicle_id,
        actual_start_datetime: result.value.actual_start_datetime || "",
        actual_return_datetime: result.value.actual_return_datetime || "",
        actual_start_by: actor,
        actual_return_by: actor,
        status: "COMPLETED",
        staff_note: result.value.note
          ? `บันทึกรายการย้อนหลัง: ${result.value.note}`
          : "โปรดระบุหมายเหตุเพิ่มเติม",
        is_backdated: "TRUE",
        backdated_completed_at: nowIso,
        backdated_completed_by: actor,
        updated_by: actor,
      };

      setBookingAction({ bookingId, type: "backdate" });
      const response = await backdateCompleteBooking(payload);

      if (response?.success === false) {
        showError(response?.message || "บันทึกงานย้อนหลังไม่สำเร็จ");
        return;
      }

      mergeBooking({
        ...(response || {}),
        ...payload,
        booking_id: bookingId,
        status: "COMPLETED",
        updated_at: nowIso,
      });
      await showSuccess("บันทึกงานย้อนหลังสำเร็จ");
    } catch (err) {
      showError(err.message || "บันทึกงานย้อนหลังไม่สำเร็จ");
    } finally {
      setBookingAction(null);
    }
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
        <select id="vehicle_status" class="swal2-select">
          <option value="AVAILABLE">พร้อมใช้งาน</option>
          <option value="INACTIVE">ไม่พร้อมใช้งาน</option>
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

    didOpen: () => {
      const vehicleType = document.getElementById("vehicle_type");
      const otherDiv = document.getElementById("otherVehicleDiv");

      vehicleType.addEventListener("change", () => {
        otherDiv.style.display =
          vehicleType.value === "OTHER"
            ? "block"
            : "none";
      });
    },

    preConfirm: () => {
      const vehicle_name = document.getElementById("vehicle_name").value.trim();
      const license_plate = document.getElementById("license_plate").value.trim();

      let vehicle_type = document.getElementById("vehicle_type").value;

      if (vehicle_type === "OTHER") {
        vehicle_type = document
          .getElementById("vehicle_type_other")
          .value.trim();
      }

      const status = document.getElementById("vehicle_status").value;
      const note = document.getElementById("vehicle_note").value.trim();

      if (!vehicle_name || !license_plate || !vehicle_type) {
        Swal.showValidationMessage(
          "กรุณากรอกชื่อรถ ทะเบียนรถ และประเภทรถ"
        );
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
    await showSuccess("เพิ่มข้อมูลรถสำเร็จ");
    await refreshVehicles();
  } catch (err) {
    showError(err.message || "เพิ่มข้อมูลรถไม่สำเร็จ");
  }
}

async function handleEditVehicle(vehicle) {
  const allowedVehicleTypes = ["VAN", "SEDAN", "MOTORCYCLE"];
  const currentVehicleType = String(vehicle.vehicle_type || "").trim();
  const selectedVehicleType = allowedVehicleTypes.includes(currentVehicleType)
    ? currentVehicleType
    : "OTHER";
  const otherVehicleType = selectedVehicleType === "OTHER" ? currentVehicleType : "";

  const result = await Swal.fire({
    title: "แก้ไขข้อมูลรถ",
    html: `
      <div class="swal-form">
        <label>ชื่อรถ</label>
        <input id="vehicle_name" class="swal2-input" value="${vehicle.vehicle_name || ""}">

        <label>ทะเบียนรถ</label>
        <input id="license_plate" class="swal2-input" value="${vehicle.license_plate || ""}">

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
            value="${otherVehicleType}"
            placeholder="เช่น รถบัส, รถกระบะ"
          >
        </div>

        <label>สถานะ</label>
        <select id="vehicle_status" class="swal2-select">
          <option value="AVAILABLE" ${vehicle.status === "AVAILABLE" ? "selected" : ""}>พร้อมใช้งาน</option>
          <option value="INACTIVE" ${vehicle.status === "INACTIVE" ? "selected" : ""}>ไม่พร้อมใช้งาน</option>
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
      const vehicle_name = document.getElementById("vehicle_name").value.trim();
      const license_plate = document.getElementById("license_plate").value.trim();
      const vehicle_type_select = document.getElementById("vehicle_type").value;
      let vehicle_type = vehicle_type_select;

      if (vehicle_type_select === "OTHER") {
        vehicle_type = document.getElementById("vehicle_type_other").value.trim();
      }
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

  useEffect(() => {
    if (bookingPage > bookingPageCount) {
      setBookingPage(bookingPageCount);
    }
  }, [bookingPage, bookingPageCount]);

  return (
    <div>
      <div className="page-header rounded-3xl border border-sky-100 bg-white px-4 py-4 shadow-sm sm:px-5 lg:px-7">
        <div>
          <h2>Admin / Dashboard</h2>
          <p>สรุปภาพรวมระบบจองรถทั้งหมด</p>
        </div>

        <button onClick={loadData}>รีเฟรชข้อมูล</button>
      </div>

      <BookingFormModal
        ref={bookingFormModalRef}
        overlapCandidates={bookings}
        vehicleTypes={vehicleTypes}
        currentUser={currentUser}
        onSuccess={(savedBooking) => mergeBooking(savedBooking)}
        showBackdatedCheckbox={hasPermission(null, "bookings_create_backdated")}
      />

      <div className="summary-grid">
        {summaryCards.map((card) => (
          <SummaryCard key={card.title} title={card.title} value={card.value} className={card.className} />
        ))}
      </div>
 <br></br>
      <div className="form-card permission-card">
        <h3>จัดการสิทธิ์</h3>
        <div className="section-toolbar permission-toolbar gap-3">
          <button type="button" onClick={handleSavePermissions}>
            บันทึกสิทธิ์
          </button>
          <button type="button" className="warning-button" onClick={handleResetPermissions}>
            คืนค่าเริ่มต้น
          </button>
        </div>

        <div className="table-wrap rounded-2xl border border-slate-200 bg-white shadow-sm">
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
          <div className="section-toolbar permission-toolbar gap-3">
            <button type="button" onClick={handleSaveActionPermissions}>
              บันทึกสิทธิ์ Action
            </button>
            <button type="button" className="warning-button" onClick={handleResetActionPermissions}>
              คืนค่าเริ่มต้น
            </button>
          </div>
        </div>

        <div className="permission-action-grid">
          {actionPermissionGroups.map((group) => (
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

      {canManageSettings && (
        <div className="form-card permission-card">
          <h3>สิทธิ์การเห็นกล่องสรุปคนขับ</h3>
          <div className="section-toolbar permission-toolbar gap-3">
            <button type="button" onClick={handleSaveDriverSummaryCardScope}>
              บันทึกสิทธิ์กล่องสรุปคนขับ
            </button>
            <button
              type="button"
              className="warning-button"
              onClick={handleResetDriverSummaryCardScope}
            >
              คืนค่าเริ่มต้น
            </button>
          </div>

          <div className="table-wrap rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="permission-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>การเห็นกล่องสรุปคนขับ</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(DEFAULT_DRIVER_SUMMARY_CARD_SCOPE).map((role) => (
                  <tr key={role}>
                    <td>{role}</td>
                    <td>
                      <select
                        value={driverSummaryCardScopeConfig[role] || "NONE"}
                        disabled={role === "ADMIN"}
                        onChange={(e) => handleChangeDriverSummaryCardScope(role, e.target.value)}
                      >
                        <option value="SELF">เห็นเฉพาะคนขับคนนั้นๆ</option>
                        <option value="ALL">เห็นทุกคน</option>
                        <option value="NONE">ไม่เห็นเลย</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canViewVehicles && (
      <div className="form-card">
        <h3>จัดการรถ</h3>
        <div className="section-toolbar gap-3">
          {canCreateVehicles && (
          <button type="button" onClick={handleOpenCreateVehicle}>
            เพิ่มรถ
          </button>
          )}
        </div>

        {visibleLoading ? (
          <TableSkeleton rows={6} columns={8} />
        ) : (
        <div className="table-wrap rounded-2xl border border-slate-200 bg-white shadow-sm" style={{ marginTop: 24 }}>
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
                    <td>{getVehicleTypeText(vehicle.vehicle_type)}</td>
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
        <div className="section-toolbar gap-3">
        {canCreateDrivers && (
        <button type="button" onClick={handleOpenCreateDriver}>
          เพิ่มข้อมูลคนขับ
        </button>
        )}
      </div>
        <div className="table-wrap rounded-2xl border border-slate-200 bg-white shadow-sm" style={{ marginTop: 24 }}>
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
      <div className="section-toolbar gap-3">
        {canCreateUsers && (
        <button type="button" onClick={handleOpenCreateUser}>
          เพิ่มผู้ใช้งาน
        </button>
        )}
      </div>
        <div className="table-wrap rounded-2xl border border-slate-200 bg-white shadow-sm" style={{ marginTop: 24 }}>
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

      {canViewBookings && (
        <div className="form-card">
          <div className="section-header gap-3 border-b border-sky-100 pb-4">
            <div>
              <h3>จัดการรายการจอง</h3>
              <p>เพิ่ม แก้ไข และบันทึกรายการย้อนหลังจากหน้า Admin ได้โดยตรง</p>
            </div>
            <div className="section-toolbar admin-booking-toolbar gap-3">
              {canCreateBookings && (
                <button
                  type="button"
                  disabled={bookingAction?.type === "create"}
                  onClick={handleCreateBooking}
                >
                  {bookingAction?.type === "create" ? "กำลังเปิดฟอร์ม..." : "เพิ่มรายการจอง"}
                </button>
              )}
            </div>
          </div>

          <div className="table-wrap rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table>
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>ผู้จอง</th>
                  <th>เวลาไป</th>
                  <th>เวลากลับ</th>
                  <th>ปลายทาง</th>
                  {FEATURES.vehicleModule && <th>รถ</th>}
                  <th>คนขับ</th>
                  <th>สถานะ</th>
                  <th>หมายเหตุ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>

              <tbody>
                {bookingPageItems.length === 0 ? (
                  <tr>
                    <td colSpan={FEATURES.vehicleModule ? "10" : "9"}>ไม่มีรายการจอง</td>
                  </tr>
                ) : (
                  bookingPageItems.map((booking) => {
                    const bookingId = getBookingId(booking);
                    const status = normalizeStatus(booking.status);
                    const statusMeta = getBookingStatusMeta(status);
                    const driverCancelRequestStatus = getDriverCancelRequestStatus(booking);
                    const disabled = bookingAction?.bookingId === bookingId;
                    const canShowEdit =
                      canEditBookings &&
                      isEditableBookingStatus(status) &&
                      driverCancelRequestStatus !== "PENDING";
                    const canShowBackdate =
                      canBackdateBookings &&
                      isBackdatedFlagEnabled(booking) &&
                      !["COMPLETED", "CANCELLED"].includes(status);

                    return (
                      <tr key={bookingId || booking.booking_no}>
                        <td>{booking.booking_no || "-"}</td>
                        <td>{booking.requester_name || "-"}</td>
                        <td>{booking.start_datetime ? formatThaiDateTime(booking.start_datetime) : "-"}</td>
                        <td>{booking.end_datetime ? formatThaiDateTime(booking.end_datetime) : "-"}</td>
                        <td>{booking.destination || "-"}</td>
                        {FEATURES.vehicleModule && (
                          <td>{getBookingVehicleLabel(booking, vehicleMap)}</td>
                        )}
                        <td>{booking.assigned_user_name || booking.driver_name || "-"}</td>
                        <td>
                          <span className={`status ${statusMeta.className}`}>{statusMeta.label}</span>
                        </td>
                        <td>{booking.staff_note || "-"}</td>
                        <td className="action-buttons">
                          {canShowEdit && (
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => handleEditBooking(booking)}
                            >
                              {bookingAction?.bookingId === bookingId && bookingAction?.type === "edit"
                                ? "กำลังเปิด..."
                                : "แก้ไข"}
                            </button>
                          )}
                          {canShowBackdate && (
                            <button
                              type="button"
                              className="warning-button"
                              disabled={disabled}
                              onClick={() => handleBackdateBooking(booking)}
                            >
                              {bookingAction?.bookingId === bookingId && bookingAction?.type === "backdate"
                                ? "กำลังบันทึก..."
                                : "บันทึกย้อนหลัง"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
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
      )}
    </div>
  );
}

