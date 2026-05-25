import { Suspense, lazy, useEffect, useState } from "react";
import Login from "./pages/Login";
import {
  canAccessPage,
  getFirstAllowedPage,
  loadPermissionConfig,
  normalizeRole,
} from "./permissions";
import NotificationBell from "./components/notifications/NotificationBell";
import PageSkeleton from "./components/skeletons/PageSkeleton";
import { FEATURES } from "./config/features";
import "./App.css";

const Cars = lazy(() => import("./pages/Cars"));
const Booking = lazy(() => import("./pages/Booking"));
const BookingCancellationHistory = lazy(() => import("./pages/BookingCancellationHistory"));
const Staff = lazy(() => import("./pages/Staff"));
const CalendarPage = lazy(() => import("./pages/Calendar"));
const DriverSummary = lazy(() => import("./pages/DriverSummary"));
const DriverJobs = lazy(() => import("./pages/DriverJobs"));
const DriverUnavailable = lazy(() => import("./pages/DriverUnavailable"));
const DriverUnavailableLogs = lazy(() => import("./pages/DriverUnavailableLogs"));
const DriverQueue = lazy(() => import("./pages/DriverQueue"));
const DriverQueueLogs = lazy(() => import("./pages/DriverQueueLogs"));
const Admin = lazy(() => import("./pages/Admin"));

function getDefaultPageByRole(role) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "ADMIN") return "admin";
  if (normalizedRole === "STAFF") return "booking";
  if (normalizedRole === "DRIVER") return "driver-jobs";
  if (normalizedRole === "USER") return "calendar";

  return "booking";
}

function isPageFeatureEnabled(page) {
  if (page === "cars") return FEATURES.vehicleModule;
  return true;
}

function getPathByPage(page) {
  if (page === "admin") return "/admin";
  if (page === "staff") return "/staff";
  if (page === "driver-jobs") return "/driver-jobs";
  if (page === "driver-unavailable") return "/driver-unavailable";
  if (page === "driver-unavailable-logs") return "/driver-unavailable-logs";
  if (page === "driver-queue") return "/driver-queue";
  if (page === "driver-queue-logs") return "/driver-queue-logs";
  if (page === "calendar") return "/calendar";
  if (page === "booking") return "/booking";
  if (page === "booking-cancellation-history") return "/booking-cancellation-history";
  if (page === "cars") return "/cars";
  return "/booking";
}

function getPageFromPath(pathname) {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  if (path === "/admin" || path === "/dashboard") return "admin";
  if (path === "/staff") return "staff";
  if (path === "/driver-jobs") return "driver-jobs";
  if (path === "/driver-unavailable") return "driver-unavailable";
  if (path === "/driver-unavailable-logs") return "driver-unavailable-logs";
  if (path === "/driver-queue") return "driver-queue";
  if (path === "/driver-queue-logs") return "driver-queue-logs";
  if (path === "/calendar") return "calendar";
  if (path === "/cars") return "cars";
  if (path === "/booking-cancellation-history") return "booking-cancellation-history";
  if (path === "/booking") return "booking";
  return "";
}

export default function App() {
  const [page, setPage] = useState(FEATURES.vehicleModule ? "cars" : "booking");
  const [user, setUser] = useState(null);
  const [permissionConfig, setPermissionConfig] = useState(loadPermissionConfig);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [canInstallApp, setCanInstallApp] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("odc_user");

    if (saved) {
      const savedUser = JSON.parse(saved);
      setUser(savedUser);
      const pathPage = getPageFromPath(window.location.pathname);
      const defaultPage = getDefaultPageByRole(savedUser.role);
      const nextPage = pathPage || defaultPage;
      const nextPageAllowed =
        isPageFeatureEnabled(nextPage) && canAccessPage(savedUser.role, nextPage, permissionConfig);
      const firstAllowedPage = getFirstAllowedPage(savedUser.role, permissionConfig);
      const finalPage =
        nextPageAllowed
          ? nextPage
          : [firstAllowedPage, defaultPage, "booking"].find(
              (candidate) => candidate && isPageFeatureEnabled(candidate)
            ) || "booking";

      setPage(finalPage);
      window.history.replaceState({}, "", getPathByPage(finalPage));
    }
  }, [permissionConfig]);

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
    if (isPageFeatureEnabled(page) && canAccessPage(user.role, page, permissionConfig)) return;

    const firstAllowedPage = getFirstAllowedPage(user.role, permissionConfig);
    const fallbackPage = [firstAllowedPage, getDefaultPageByRole(user.role), "booking"].find(
      (candidate) => candidate && isPageFeatureEnabled(candidate)
    );
    if (fallbackPage) setPage(fallbackPage);
  }, [page, permissionConfig, user]);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [page, user]);

  useEffect(() => {
    document.body.classList.toggle("mobile-nav-open", isMobileNavOpen);

    return () => {
      document.body.classList.remove("mobile-nav-open");
    };
  }, [isMobileNavOpen]);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      setCanInstallApp(false);
      return undefined;
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
      setCanInstallApp(true);
    };

    const handleAppInstalled = () => {
      setCanInstallApp(false);
      setInstallPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  function goPage(nextPage) {
    if (!isPageFeatureEnabled(nextPage)) return;
    if (!canAccessPage(user.role, nextPage, permissionConfig)) {
      alert("คุณไม่มีสิทธิ์เข้าถึงเมนูนี้");
      return;
    }
    setPage(nextPage);
  }

  function navigateToPath(targetUrl) {
    const resolvedUrl = new URL(String(targetUrl || "/"), window.location.origin);
    const nextPage = getPageFromPath(resolvedUrl.pathname);

    if (!nextPage) return;
    if (!isPageFeatureEnabled(nextPage)) return;
    if (!canAccessPage(user.role, nextPage, permissionConfig)) return;

    setPage(nextPage);
    window.history.replaceState({}, "", resolvedUrl.pathname);
  }

  function logout() {
    localStorage.removeItem("odc_user");
    setUser(null);
    setPage(FEATURES.vehicleModule ? "cars" : "booking");
    setIsMobileNavOpen(false);
  }

  async function handleInstallApp() {
    if (!installPromptEvent) return;

    await installPromptEvent.prompt();
    const result = await installPromptEvent.userChoice;

    if (result?.outcome !== "accepted") {
      setCanInstallApp(false);
      setInstallPromptEvent(null);
      return;
    }

    setCanInstallApp(false);
    setInstallPromptEvent(null);
  }

  if (!user) {
    return (
      <Login
        onLogin={(loggedInUser) => {
          setUser(loggedInUser);
          const defaultPage = getDefaultPageByRole(loggedInUser.role);
          const defaultPageAllowed =
            isPageFeatureEnabled(defaultPage) && canAccessPage(loggedInUser.role, defaultPage, permissionConfig);
          const firstAllowedPage = getFirstAllowedPage(loggedInUser.role, permissionConfig);
          const nextPage =
            defaultPageAllowed
              ? defaultPage
              : [firstAllowedPage, defaultPage, "booking"].find(
                  (candidate) => candidate && isPageFeatureEnabled(candidate)
                ) || "booking";

          setPage(nextPage);
          window.history.replaceState({}, "", getPathByPage(nextPage));
        }}
      />
    );
  }

  const hasPageAccess = isPageFeatureEnabled(page) && canAccessPage(user.role, page, permissionConfig);

  return (
    <div className="app-shell">
      <header className="gov-header">
        <button
          type="button"
          className="mobile-nav-toggle"
          aria-label="เปิดเมนู"
          aria-expanded={isMobileNavOpen}
          onClick={() => setIsMobileNavOpen((current) => !current)}
        >
          ☰
        </button>
        <div className="brand">
          <div className="brand-logo">🚐</div>
          <div>
            <h1>ระบบงานจองรถ</h1>
            <p>ศูนย์รับบริจาคอวัยวะ สภากาชาดไทย</p>
          </div>
        </div>

        <div className="header-actions">
          {canInstallApp && (
            <button type="button" className="install-app-button" onClick={handleInstallApp}>
              ติดตั้งแอป
            </button>
          )}
          <NotificationBell currentUser={user} onNavigate={navigateToPath} />
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
        </div>
      </header>

      <div
        className={`mobile-nav-backdrop${isMobileNavOpen ? " is-open" : ""}`}
        onClick={() => setIsMobileNavOpen(false)}
        aria-hidden="true"
      />

      <div className="layout">
        <aside className={`sidebar${isMobileNavOpen ? " is-open" : ""}`}>
          {FEATURES.vehicleModule && canAccessPage(user.role, "cars", permissionConfig) && (
            <button className={page === "cars" ? "active" : ""} onClick={() => goPage("cars")}>
              🚐 จัดการรถ
            </button>
          )}

          {canAccessPage(user.role, "booking", permissionConfig) && (
            <button className={page === "booking" ? "active" : ""} onClick={() => goPage("booking")}>
              📝 รายการจองรถ
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

          {canAccessPage(user.role, "driver-unavailable", permissionConfig) && (
            <button
              className={page === "driver-unavailable" ? "active" : ""}
              onClick={() => goPage("driver-unavailable")}
            >
              📅 ปฏิบัติงาน
            </button>
          )}

          {canAccessPage(user.role, "driver-unavailable-logs", permissionConfig) && (
            <button
              className={page === "driver-unavailable-logs" ? "active" : ""}
              onClick={() => goPage("driver-unavailable-logs")}
            >
              🕒 ประวัติปฏิบัติงาน
            </button>
          )}

          {canAccessPage(user.role, "driver-queue", permissionConfig) && (
            <button className={page === "driver-queue" ? "active" : ""} onClick={() => goPage("driver-queue")}>
              🧭 คิวคนขับ
            </button>
          )}

          {canAccessPage(user.role, "driver-queue-logs", permissionConfig) && (
            <button
              className={page === "driver-queue-logs" ? "active" : ""}
              onClick={() => goPage("driver-queue-logs")}
            >
              📜 ประวัติคิวคนขับ
            </button>
          )}

          {canAccessPage(user.role, "admin", permissionConfig) && (
            <button className={page === "admin" ? "active" : ""} onClick={() => goPage("admin")}>
              🛠 Admin
            </button>
          )}
        </aside>

        <main className="main-content">
          <Suspense fallback={<PageSkeleton />}>
            {!hasPageAccess && <div className="form-card">คุณไม่มีสิทธิ์เข้าถึง</div>}
            {FEATURES.vehicleModule && hasPageAccess && page === "cars" && <Cars />}
            {hasPageAccess && page === "booking" && <Booking />}
            {hasPageAccess && page === "booking-cancellation-history" && <BookingCancellationHistory />}
            {hasPageAccess && page === "staff" && <Staff />}
            {hasPageAccess && page === "calendar" && <CalendarPage />}
            {hasPageAccess && page === "driver-summary" && <DriverSummary />}
            {hasPageAccess && page === "driver-jobs" && <DriverJobs />}
            {hasPageAccess && page === "driver-unavailable" && <DriverUnavailable />}
            {hasPageAccess && page === "driver-unavailable-logs" && <DriverUnavailableLogs />}
            {hasPageAccess && page === "driver-queue" && <DriverQueue />}
            {hasPageAccess && page === "driver-queue-logs" && <DriverQueueLogs />}
            {hasPageAccess && page === "admin" && <Admin />}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
