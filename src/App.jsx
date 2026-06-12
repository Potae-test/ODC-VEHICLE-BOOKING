import { Suspense, lazy, useEffect, useRef, useState } from "react";
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
import { startSessionTimeout } from "./utils/sessionTimeout";
import "./App.css";
import LOGO_ODC from "./assets/LOGO_ODC.png";


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
const Profile = lazy(() => import("./pages/Profile"));

function ShellIcon({ children, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function MenuIcon(props) {
  return (
    <ShellIcon {...props}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </ShellIcon>
  );
}

function CloseIcon(props) {
  return (
    <ShellIcon {...props}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </ShellIcon>
  );
}

function ChevronDownIcon(props) {
  return (
    <ShellIcon {...props}>
      <polyline points="6 9 12 15 18 9" />
    </ShellIcon>
  );
}

function CarIcon(props) {
  return (
    <ShellIcon {...props}>
      <path d="M5 16l1.5-5A2 2 0 0 1 8.43 9h7.14a2 2 0 0 1 1.93 2L19 16" />
      <path d="M3 16h18v3a1 1 0 0 1-1 1h-1a2 2 0 0 1-2-2v-1H7v1a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1v-3Z" />
      <circle cx="7.5" cy="13.5" r="1" />
      <circle cx="16.5" cy="13.5" r="1" />
    </ShellIcon>
  );
}

function ClipboardIcon(props) {
  return (
    <ShellIcon {...props}>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 4.5h6v3H9z" />
      <line x1="9" y1="11" x2="15" y2="11" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </ShellIcon>
  );
}

function HistoryIcon(props) {
  return (
    <ShellIcon {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4h4" />
      <path d="M12 7v5l3 2" />
    </ShellIcon>
  );
}

function CalendarIcon(props) {
  return (
    <ShellIcon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="3" y1="11" x2="21" y2="11" />
    </ShellIcon>
  );
}

function BarChartIcon(props) {
  return (
    <ShellIcon {...props}>
      <line x1="5" y1="20" x2="19" y2="20" />
      <rect x="6" y="11" width="3" height="7" rx="1" />
      <rect x="11" y="7" width="3" height="11" rx="1" />
      <rect x="16" y="4" width="3" height="14" rx="1" />
    </ShellIcon>
  );
}

function TruckIcon(props) {
  return (
    <ShellIcon {...props}>
      <path d="M3 7h11v8H3z" />
      <path d="M14 10h3l3 3v2h-6z" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="17.5" cy="17.5" r="1.5" />
    </ShellIcon>
  );
}

function BriefcaseIcon(props) {
  return (
    <ShellIcon {...props}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </ShellIcon>
  );
}

function ListIcon(props) {
  return (
    <ShellIcon {...props}>
      <line x1="8" y1="7" x2="20" y2="7" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="8" y1="17" x2="20" y2="17" />
      <circle cx="4.5" cy="7" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="17" r="1" />
    </ShellIcon>
  );
}

function FileTextIcon(props) {
  return (
    <ShellIcon {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </ShellIcon>
  );
}

function ShieldIcon(props) {
  return (
    <ShellIcon {...props}>
      <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" />
      <path d="M9.5 12l1.5 1.5 3.5-3.5" />
    </ShellIcon>
  );
}

function getUserAvatarInitial(name) {
  const trimmedName = String(name || "").trim();
  return trimmedName ? trimmedName.charAt(0).toUpperCase() : "U";
}

function getUserRoleLabel(role) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "ADMIN") return "ผู้ดูแลระบบ";
  if (normalizedRole === "STAFF") return "เจ้าหน้าที่";
  if (normalizedRole === "DRIVER") return "พนักงานขับรถ";
  if (normalizedRole === "USER") return "ผู้ใช้งานทั่วไป";

  return String(role || "-").trim() || "-";
}

function ShellNavButton({ active, icon, children, ...props }) {
  return (
    <button
      type="button"
      className={[
        "!min-h-[52px] !w-full !rounded-2xl !border !px-4 !py-3 !text-left !text-[22px] !font-bold !transition-all duration-150",
        "!flex !items-center !gap-3 !shadow-none",
        active
          ? "!border-sky-200 !bg-sky-50 !text-sky-700"
          : "!border-slate-200 !bg-white !text-slate-700 hover:!border-slate-300 hover:!bg-slate-50 hover:!text-sky-700",
      ].join(" ")}
      {...props}
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        {icon}
      </span>
      <span className="min-w-0 flex-1 break-words leading-tight">{children}</span>
    </button>
  );
}

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
  if (page === "profile") return "/profile";
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
  if (path === "/profile") return "profile";
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
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileProfileSheetOpen, setIsMobileProfileSheetOpen] = useState(false);
  const [profileInitialSection, setProfileInitialSection] = useState("profile");
  const [profileSectionRequestKey, setProfileSectionRequestKey] = useState("profile:0");
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [canInstallApp, setCanInstallApp] = useState(false);
  const profileMenuRef = useRef(null);

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
    setIsProfileMenuOpen(false);
    setIsMobileProfileSheetOpen(false);
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

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    return startSessionTimeout();
  }, [user]);

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isProfileMenuOpen]);

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

  function openProfilePage(section = "profile") {
    const nextSection = section === "password" ? "password" : "profile";

    setProfileInitialSection(nextSection);
    setProfileSectionRequestKey(`${nextSection}:${Date.now()}`);
    setIsProfileMenuOpen(false);
    setIsMobileProfileSheetOpen(false);
    setPage("profile");
    window.history.replaceState({}, "", "/profile");
  }

  function handleUserUpdate(nextUser) {
    if (!nextUser) return;
    setUser(nextUser);
  }

  function logout() {
    localStorage.removeItem("odc_user");
    setUser(null);
    setPage(FEATURES.vehicleModule ? "cars" : "booking");
    setIsMobileNavOpen(false);
    setIsProfileMenuOpen(false);
    setIsMobileProfileSheetOpen(false);
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
  const navIconClassName = "h-5 w-5";
  const userAvatarInitial = getUserAvatarInitial(user?.name);
  const userRoleLabel = getUserRoleLabel(user?.role);
  const sidebarItems = [
    {
      page: "cars",
      enabled: FEATURES.vehicleModule && canAccessPage(user.role, "cars", permissionConfig),
      icon: <CarIcon className={navIconClassName} />,
      label: "จัดการรถ",
    },
    {
      page: "booking",
      enabled: canAccessPage(user.role, "booking", permissionConfig),
      icon: <ClipboardIcon className={navIconClassName} />,
      label: "รายการจองรถ",
    },
    {
      page: "booking-cancellation-history",
      enabled: canAccessPage(user.role, "booking-cancellation-history", permissionConfig),
      icon: <HistoryIcon className={navIconClassName} />,
      label: "ประวัติการยกเลิก",
    },
    {
      page: "calendar",
      enabled: canAccessPage(user.role, "calendar", permissionConfig),
      icon: <CalendarIcon className={navIconClassName} />,
      label: "ปฏิทิน",
    },
    {
      page: "driver-summary",
      enabled: canAccessPage(user.role, "driver-summary", permissionConfig),
      icon: <BarChartIcon className={navIconClassName} />,
      label: "สรุปงานคนขับ",
    },
    {
      page: "driver-jobs",
      enabled: canAccessPage(user.role, "driver-jobs", permissionConfig),
      icon: <TruckIcon className={navIconClassName} />,
      label: "งานคนขับ",
    },
    {
      page: "driver-unavailable",
      enabled: canAccessPage(user.role, "driver-unavailable", permissionConfig),
      icon: <BriefcaseIcon className={navIconClassName} />,
      label: "แจ้งข้อมูลการปฏิบัติงาน",
    },
    {
      page: "driver-unavailable-logs",
      enabled: canAccessPage(user.role, "driver-unavailable-logs", permissionConfig),
      icon: <FileTextIcon className={navIconClassName} />,
      label: "ประวัติการปฏิบัติงาน",
    },
    {
      page: "driver-queue",
      enabled: canAccessPage(user.role, "driver-queue", permissionConfig),
      icon: <ListIcon className={navIconClassName} />,
      label: "คิวคนขับ",
    },
    {
      page: "driver-queue-logs",
      enabled: canAccessPage(user.role, "driver-queue-logs", permissionConfig),
      icon: <HistoryIcon className={navIconClassName} />,
      label: "ประวัติคิวคนขับ",
    },
    {
      page: "admin",
      enabled: canAccessPage(user.role, "admin", permissionConfig),
      icon: <ShieldIcon className={navIconClassName} />,
      label: "Admin",
    },
  ].filter((item) => item.enabled);

  return (
    <div className="shell-root flex min-h-screen flex-col overflow-x-clip bg-slate-100 text-slate-900">
      <header className="shell-header fixed inset-x-0 top-0 z-40 border-b border-sky-800/40 bg-gradient-to-r from-[#073b8e] via-[#0f4fb5] to-[#1455c8] text-white shadow-[0_10px_30px_rgba(7,59,142,0.28)] md:static">
        <div className="shell-header-grid mx-auto grid min-h-[76px] w-full max-w-none grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-3 py-3 sm:px-4 md:flex md:min-h-[120px] md:flex-nowrap md:items-center md:gap-4 md:px-8 md:py-5">
          <button
            type="button"
            className="shell-mobile-toggle !inline-flex !h-11 !w-11 !min-h-11 !shrink-0 !items-center !justify-center !rounded-2xl !border !border-white/25 !bg-white/10 !p-0 text-white shadow-none hover:!bg-white/20 md:!hidden"
            aria-label="เปิดเมนู"
            aria-expanded={isMobileNavOpen}
            onClick={() => setIsMobileNavOpen((current) => !current)}
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <div className="min-w-0 md:flex-1">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1455c8] shadow-sm md:h-[70px] md:w-[70px] md:rounded-[22px]">
                <img src={LOGO_ODC} alt="ODC Logo" className="h-6 w-auto md:h-11 md:w-16" />
              </div>
              <div className="shell-brand-copy min-w-0">
                <h1 className="shell-brand-title m-0 break-words text-[23px] font-bold leading-tight text-white sm:text-[25px] md:max-w-[16ch] md:text-[36px] lg:max-w-none">
                  ระบบงานจองรถ
                </h1>
                <p className="shell-brand-subtitle mt-1 hidden text-[18px] leading-tight text-sky-100 md:block md:max-w-[34rem] md:text-[22px]">
                  ศูนย์รับบริจาคอวัยวะ สภากาชาดไทย
                </p>
              </div>
            </div>
          </div>

          <div className="justify-self-end">
            <NotificationBell currentUser={user} onNavigate={navigateToPath} />
          </div>

          <div
            className={`shell-header-actions col-span-3 flex min-w-0 flex-wrap items-center justify-end gap-2 md:col-auto md:ml-auto md:flex-nowrap md:gap-4 ${
              canInstallApp ? "" : "is-install-hidden"
            }`}
          >
            {canInstallApp && (
              <button
                type="button"
                className="shell-install-button !min-h-11 !rounded-2xl !border !border-white/35 !bg-white !px-4 !py-2 !text-[20px] !font-extrabold !text-[#1455c8] shadow-none hover:!bg-sky-50 min-[360px]:!w-auto md:!w-auto"
                onClick={handleInstallApp}
              >
                ติดตั้งแอป
              </button>
            )}

            <div className="shell-mobile-action-row flex min-w-0 flex-1 items-center justify-end gap-2 md:flex-none md:gap-3">
              <div ref={profileMenuRef} className="shell-profile-menu hidden md:block">
                <button
                  type="button"
                  className="shell-profile-trigger"
                  aria-expanded={isProfileMenuOpen}
                  onClick={() => setIsProfileMenuOpen((current) => !current)}
                >
                  <span className="shell-profile-avatar" aria-hidden="true">
                    {userAvatarInitial}
                  </span>
                  <span className="shell-profile-copy">
                    <b>{user.name || "-"}</b>
                    <span>{userRoleLabel}</span>
                  </span>
                  <ChevronDownIcon
                    className={isProfileMenuOpen ? "shell-profile-chevron is-open" : "shell-profile-chevron"}
                  />
                </button>

                {isProfileMenuOpen && (
                  <div className="shell-profile-dropdown">
                    <div className="shell-profile-dropdown-summary">
                      <span className="shell-profile-avatar shell-profile-avatar-small" aria-hidden="true">
                        {userAvatarInitial}
                      </span>
                      <div className="shell-profile-dropdown-copy">
                        <strong>{user.name || "-"}</strong>
                        <span>{userRoleLabel}</span>
                        <span>{user.user_id || "-"}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shell-profile-dropdown-item"
                      onClick={() => openProfilePage("profile")}
                    >
                      โปรไฟล์ของฉัน
                    </button>
                    <button
                      type="button"
                      className="shell-profile-dropdown-item"
                      onClick={() => openProfilePage("password")}
                    >
                      เปลี่ยนรหัสผ่าน
                    </button>
                    <button
                      type="button"
                      className="shell-profile-dropdown-item is-danger"
                      onClick={logout}
                    >
                      ออกจากระบบ
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="shell-mobile-profile-button md:hidden"
                aria-label="เมนูโปรไฟล์"
                aria-expanded={isMobileProfileSheetOpen}
                onClick={() => setIsMobileProfileSheetOpen(true)}
              >
                <span className="shell-profile-avatar" aria-hidden="true">
                  {userAvatarInitial}
                </span>
                <span className="shell-profile-copy shell-mobile-profile-trigger-copy">
                  <b>{user.name || "-"}</b>
                  <span>{userRoleLabel}</span>
                </span>
                <ChevronDownIcon className="shell-profile-chevron" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div
        className={`shell-mobile-profile-backdrop fixed inset-0 z-[70] bg-slate-950/45 transition-opacity duration-200 md:hidden ${
          isMobileProfileSheetOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMobileProfileSheetOpen(false)}
        aria-hidden="true"
      />

      <div
        className={
          isMobileProfileSheetOpen
            ? "shell-mobile-profile-sheet is-open md:hidden"
            : "shell-mobile-profile-sheet md:hidden"
        }
      >
        <div className="shell-mobile-profile-handle" aria-hidden="true" />
        <div className="shell-mobile-profile-head">
          <span className="shell-profile-avatar" aria-hidden="true">
            {userAvatarInitial}
          </span>
          <div className="shell-mobile-profile-copy">
            <strong>{user.name || "-"}</strong>
            <span>{userRoleLabel}</span>
            <span>{user.user_id || "-"}</span>
          </div>
        </div>
        <div className="shell-mobile-profile-actions">
          <button type="button" className="shell-mobile-profile-action" onClick={() => openProfilePage("profile")}>
            โปรไฟล์ของฉัน
          </button>
          <button type="button" className="shell-mobile-profile-action" onClick={() => openProfilePage("password")}>
            เปลี่ยนรหัสผ่าน
          </button>
          <button type="button" className="shell-mobile-profile-action is-danger" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      <div className="h-[76px] shrink-0 md:hidden" />

      <div
        className={`shell-mobile-backdrop fixed inset-0 z-30 bg-slate-950/45 transition-opacity duration-200 md:hidden ${
          isMobileNavOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMobileNavOpen(false)}
        aria-hidden="true"
      />

      <div className="shell-layout flex flex-1 overflow-x-clip md:min-h-0 md:grid md:grid-cols-[19rem_minmax(0,1fr)]">
        <aside
          className={`shell-sidebar fixed left-0 top-[76px] bottom-0 z-40 flex w-[min(320px,calc(100vw-20px))] max-w-[calc(100vw-20px)] flex-col gap-3 overflow-y-auto overflow-x-hidden border-r border-slate-200 bg-white px-3 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.18)] transition-transform duration-200 md:static md:top-auto md:z-0 md:w-auto md:max-w-none md:translate-x-0 md:gap-3 md:border-r md:px-4 md:py-6 md:shadow-none ${
            isMobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-1 flex items-center justify-between px-2 md:hidden">
            <div className="text-[18px] font-bold uppercase tracking-[0.12em] text-slate-500">Menu</div>
            <button
              type="button"
              className="!inline-flex !h-11 !w-11 !min-h-11 !items-center !justify-center !rounded-2xl !border !border-slate-200 !bg-white !p-0 !text-slate-600 shadow-none hover:!bg-slate-50"
              aria-label="ปิดเมนู"
              onClick={() => setIsMobileNavOpen(false)}
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
          {/* <div className="mb-1 px-2 text-[18px] font-bold uppercase tracking-[0.12em] text-slate-500 md:text-[16px]">
            Navigation
          </div> */}
          {sidebarItems.map((item) => (
            <ShellNavButton key={item.page} active={page === item.page} icon={item.icon} onClick={() => goPage(item.page)}>
              {item.label}
            </ShellNavButton>
          ))}
        </aside>

        <main className="shell-main min-w-0 flex-1 overflow-x-clip overflow-y-auto px-3 py-3 md:min-h-0 md:px-9 md:py-9">
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
            {hasPageAccess && page === "profile" && (
              <Profile
                key={`${user?.user_id || "profile"}:${profileSectionRequestKey}`}
                currentUser={user}
                onUserUpdate={handleUserUpdate}
                initialSection={profileInitialSection}
              />
            )}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
