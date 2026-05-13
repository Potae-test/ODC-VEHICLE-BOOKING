import { Suspense, lazy, useEffect, useState } from "react";
import Login from "./pages/Login";
import {
  canAccessPage,
  getFirstAllowedPage,
  loadPermissionConfig,
  normalizeRole,
} from "./permissions";
import "./App.css";

const Cars = lazy(() => import("./pages/Cars"));
const Booking = lazy(() => import("./pages/Booking"));
const BookingCancellationHistory = lazy(() => import("./pages/BookingCancellationHistory"));
const Staff = lazy(() => import("./pages/Staff"));
const CalendarPage = lazy(() => import("./pages/Calendar"));
const DriverSummary = lazy(() => import("./pages/DriverSummary"));
const DriverJobs = lazy(() => import("./pages/DriverJobs"));
const Admin = lazy(() => import("./pages/Admin"));

function getDefaultPageByRole(role) {
  if (role === "ADMIN") return "admin";
  if (role === "STAFF") return "staff";
  if (role === "DRIVER") return "driver-jobs";
  return "booking";
}

function getPageFromPath(pathname) {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  if (path === "/admin" || path === "/dashboard") return "admin";
  if (path === "/staff") return "staff";
  if (path === "/driver-jobs") return "driver-jobs";
  if (path === "/booking") return "booking";
  return "";
}

export default function App() {
  const [page, setPage] = useState("cars");
  const [user, setUser] = useState(null);
  const [permissionConfig, setPermissionConfig] = useState(loadPermissionConfig);

  useEffect(() => {
    const saved = localStorage.getItem("odc_user");

    if (saved) {
      const savedUser = JSON.parse(saved);
      setUser(savedUser);
      const pathPage = getPageFromPath(window.location.pathname);
      setPage(pathPage || getDefaultPageByRole(savedUser.role));
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const currentRole = normalizeRole(user.role);
    const pathPage = getPageFromPath(window.location.pathname);

    if (pathPage === "admin" && currentRole !== "ADMIN") {
      window.history.replaceState({}, "", "/staff");
      setPage("staff");
      return;
    }

    if (pathPage === "admin" && currentRole === "ADMIN") {
      setPage("admin");
    }
  }, [user]);

  useEffect(() => {
    function refreshPermissions() {
      setPermissionConfig(loadPermissionConfig());
    }

    window.addEventListener("storage", refreshPermissions);
    window.addEventListener("odc-permissions-updated", refreshPermissions);
    window.addEventListener("odc-action-permissions-updated", refreshPermissions);

    return () => {
      window.removeEventListener("storage", refreshPermissions);
      window.removeEventListener("odc-permissions-updated", refreshPermissions);
      window.removeEventListener("odc-action-permissions-updated", refreshPermissions);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    if (canAccessPage(user.role, page, permissionConfig)) return;

    const firstAllowedPage = getFirstAllowedPage(user.role, permissionConfig);
    if (firstAllowedPage) setPage(firstAllowedPage);
  }, [page, permissionConfig, user]);

  function goPage(nextPage) {
    if (!canAccessPage(user.role, nextPage, permissionConfig)) {
      alert("คุณไม่มีสิทธิ์เข้าเมนูนี้");
      return;
    }
    setPage(nextPage);
  }

  function logout() {
    localStorage.removeItem("odc_user");
    setUser(null);
    setPage("cars");
  }

  if (!user) {
    return (
      <Login
        onLogin={(loggedInUser) => {
          setUser(loggedInUser);
          setPage(getDefaultPageByRole(loggedInUser.role));
        }}
      />
    );
  }

  const hasPageAccess = canAccessPage(user.role, page, permissionConfig);

  return (
    <div className="app-shell">
      <header className="gov-header">
        <div className="brand">
          <div className="brand-logo">🚐</div>
          <div>
            <h1>ระบบงานจองรถ</h1>
            <p>ศูนย์รับบริการจองรถและติดตามงานขับรถ</p>
          </div>
        </div>

        <div className="profile-box">
          <div className="profile-icon">👤</div>
          <div>
            <b>{user.name}</b>
            <span>{user.role}</span>
          </div>
          <button className="logout-btn" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          {canAccessPage(user.role, "cars", permissionConfig) && (
            <button className={page === "cars" ? "active" : ""} onClick={() => goPage("cars")}>
              🚐 เพิ่มรถใหม่
            </button>
          )}

          {canAccessPage(user.role, "booking", permissionConfig) && (
            <button className={page === "booking" ? "active" : ""} onClick={() => goPage("booking")}>
              📝 จองรถ
            </button>
          )}

          {canAccessPage(user.role, "booking-cancellation-history", permissionConfig) && (
            <button
              className={page === "booking-cancellation-history" ? "active" : ""} 
              onClick={() => goPage("booking-cancellation-history")}
            >
              📚 ประวัติการยกเลิก
            </button>
          )}

          {canAccessPage(user.role, "staff", permissionConfig) && (
            <button className={page === "staff" ? "active" : ""} onClick={() => goPage("staff")}>
              👥 เจ้าหน้าที่
            </button>
          )}

          {canAccessPage(user.role, "calendar", permissionConfig) && (
            <button className={page === "calendar" ? "active" : ""} onClick={() => goPage("calendar")}>
              📅 ปฏิทิน
            </button>
          )}

          {canAccessPage(user.role, "driver-summary", permissionConfig) && (
            <button className={page === "driver-summary" ? "active" : ""} onClick={() => goPage("driver-summary")}>
              📊 สรุปงานคนขับ
            </button>
          )}

          {canAccessPage(user.role, "driver-jobs", permissionConfig) && (
            <button className={page === "driver-jobs" ? "active" : ""} onClick={() => goPage("driver-jobs")}>
              🚚 งานคนขับ
            </button>
          )}

          {canAccessPage(user.role, "admin", permissionConfig) && (
            <button className={page === "admin" ? "active" : ""} onClick={() => goPage("admin")}>
              🛠 Admin
            </button>
          )}

          <div className="sidebar-help">
            <b>ศูนย์ช่วยเหลือ</b>
            <p>ฝ่ายระบบงาน</p>
            <p>02-xxx-xxxx</p>
          </div>
        </aside>

        <main className="main-content">
          <Suspense fallback={<p>กำลังโหลดหน้า...</p>}>
            {!hasPageAccess && <div className="form-card">คุณไม่มีสิทธิ์เข้าถึง</div>}
            {hasPageAccess && page === "cars" && <Cars />}
            {hasPageAccess && page === "booking" && <Booking />}
            {hasPageAccess && page === "booking-cancellation-history" && <BookingCancellationHistory />}
            {hasPageAccess && page === "staff" && <Staff />}
            {hasPageAccess && page === "calendar" && <CalendarPage />}
            {hasPageAccess && page === "driver-summary" && <DriverSummary />}
            {hasPageAccess && page === "driver-jobs" && <DriverJobs />}
            {hasPageAccess && page === "admin" && <Admin />}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
