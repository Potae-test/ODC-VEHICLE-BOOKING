export const PERMISSION_STORAGE_KEY = "odc_menu_permissions";
export const ACTION_PERMISSION_STORAGE_KEY = "odc_action_permissions";
export const PERMISSION_CONFIG_VERSION = "2026-05-14.1";
export const ACTION_PERMISSION_CONFIG_VERSION = "2026-05-14.2";

const PERMISSION_VERSION_STORAGE_KEY = `${PERMISSION_STORAGE_KEY}_version`;
const ACTION_PERMISSION_VERSION_STORAGE_KEY = `${ACTION_PERMISSION_STORAGE_KEY}_version`;

export const PERMISSION_ITEMS = [
  { id: "admin_dashboard", label: "Admin Dashboard", pages: ["admin"] },
  { id: "booking-list", label: "รายการจองทั้งหมด", pages: ["booking"] },
  { id: "calendar", label: "ปฏิทิน", pages: ["calendar"] },
  { id: "booking-approval", label: "อนุมัติรายการจอง", pages: ["staff"] },
  { id: "driver-summary", label: "สรุปงานคนขับ", pages: ["driver-summary"] },
  { id: "driver-jobs", label: "งานคนขับ", pages: ["driver-jobs"] },
  { id: "user-management", label: "จัดการผู้ใช้งาน", pages: ["admin"] },
  { id: "driver-management", label: "จัดการคนขับ", pages: ["admin"] },
  { id: "vehicle-management", label: "จัดการรถ", pages: ["cars"] },
  { id: "booking-cancellation-history", label: "ประวัติการยกเลิก", pages: ["booking-cancellation-history"] },
  { id: "system-settings", label: "ตั้งค่าระบบ", pages: ["admin"] },
];

export const DEFAULT_ROLE_PERMISSIONS = {
  ADMIN: PERMISSION_ITEMS.map((item) => item.id),
  STAFF: [
    "booking-list",
    "calendar",
    "booking-approval",
    "driver-summary",
    "driver-jobs",
    "driver-management",
    "vehicle-management",
    "booking-cancellation-history",
  ],
  USER: [
    "booking-list", 
    "calendar", 
    "driver-summary", 
  ],
  DRIVER: [
    "booking-list",
    "calendar",
    "driver-summary", 
    "vehicle-management",
    "driver-jobs"],
};

export const ACTION_PERMISSION_GROUPS = [
  {
    id: "bookings",
    label: "รายการจอง",
    permissions: [
      { id: "bookings_view", label: "ดูรายการ" },
      { id: "bookings_detail", label: "ดูรายละเอียดรายการจอง" },
      { id: "bookings_create", label: "สร้างรายการ" },
      { id: "bookings_edit", label: "แก้ไขรายการ" },
      { id: "bookings_delete", label: "ลบรายการ" },
      { id: "bookings_approve", label: "อนุมัติรายการ" },
      { id: "bookings_cancel", label: "ยกเลิกรายการ" },
    ],
  },
  {
    id: "drivers",
    label: "คนขับ",
    permissions: [
      { id: "drivers_view", label: "ดูคนขับ" },
      { id: "drivers_create", label: "เพิ่มคนขับ" },
      { id: "drivers_edit", label: "แก้ไขคนขับ" },
      { id: "drivers_delete", label: "ลบคนขับ" },
    ],
  },
  {
    id: "vehicles",
    label: "รถ",
    permissions: [
      { id: "vehicles_view", label: "ดูรถ" },
      { id: "vehicles_create", label: "เพิ่มรถ" },
      { id: "vehicles_edit", label: "แก้ไขรถ" },
      { id: "vehicles_delete", label: "ลบรถ" },
    ],
  },
  {
    id: "users",
    label: "ผู้ใช้งาน",
    permissions: [
      { id: "users_view", label: "ดูผู้ใช้งาน" },
      { id: "users_create", label: "เพิ่มผู้ใช้งาน" },
      { id: "users_edit", label: "แก้ไขผู้ใช้งาน" },
      { id: "users_delete", label: "ลบผู้ใช้งาน" },
    ],
  },
  {
    id: "reports",
    label: "รายงาน",
    permissions: [
      { id: "driver_summary_view", label: "ดูสรุปงานคนขับ" },
      { id: "driver_summary_cards_scope", label: "ขอบเขตการเห็นกล่องสรุปคนขับ" },
    ],
  },
  {
    id: "driver_jobs",
    label: "งานคนขับ",
    permissions: [
      { id: "driver_jobs_view", label: "ดูงานคนขับ" },
      { id: "driver_jobs_start", label: "รับงาน / ออกรถ" },
      { id: "driver_jobs_complete", label: "จบงาน / คืนรถ" },
    ],
  },
  {
    id: "settings",
    label: "ตั้งค่า",
    permissions: [{ id: "settings_manage", label: "จัดการตั้งค่า" }],
  },
];

export const ACTION_PERMISSION_ITEMS = ACTION_PERMISSION_GROUPS.flatMap(
  (group) => group.permissions
);

export const DEFAULT_ROLE_ACTION_PERMISSIONS = {
  ADMIN: ACTION_PERMISSION_ITEMS.map((item) => item.id),
  STAFF: [
    "bookings_view",
    "bookings_detail",
    "bookings_edit",
    "bookings_create",
    "bookings_approve",
    "bookings_cancel",
    "bookings_delete",
    "drivers_view",
    "vehicles_view",
    "vehicles_create",
    "vehicles_edit",
    "vehicles_delete",
    "driver_summary_view",
    "driver_jobs_view",
    "drivers_create",
    "drivers_edit",
    "drivers_delete",
    "driver_jobs_start",
    "driver_jobs_complete",
    "driver_summary_cards_scope",
  ],
  USER: [
    "bookings_view", 
    "bookings_detail",
    "bookings_create", 
    "driver_summary_view",
    "bookings_edit",
    "bookings_cancel",
    "driver_jobs_complete",
  ],
  DRIVER: [
    "bookings_view",
    "bookings_detail",
    "vehicles_view",
    "driver_summary_view",
    "driver_jobs_view",
    "driver_jobs_start",
    "driver_jobs_complete",
    "driver_summary_cards_scope",
    "vehicles_edit",
  ],
};

const PAGE_ACTION_REQUIREMENTS = {
  cars: ["vehicles_view"],
  booking: ["bookings_view", "bookings_create"],
  "booking-cancellation-history": ["bookings_view"],
  staff: ["bookings_view", "bookings_approve"],
  calendar: ["bookings_view"],
  "driver-summary": ["driver_summary_view"],
  "driver-jobs": ["driver_jobs_view"],
  admin: ["settings_manage", "users_view", "drivers_view", "vehicles_view"],
};

export function normalizeRole(role) {
  return String(role || "").trim().toUpperCase();
}

export function getDefaultPermissionConfig() {
  return Object.fromEntries(
    Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([role, permissions]) => [
      role,
      [...permissions],
    ])
  );
}

export function getDefaultActionPermissionConfig() {
  return Object.fromEntries(
    Object.entries(DEFAULT_ROLE_ACTION_PERMISSIONS).map(([role, permissions]) => [
      role,
      [...permissions],
    ])
  );
}

function resetStoredPermissionConfig(storageKey, versionStorageKey, version) {
  localStorage.removeItem(storageKey);
  localStorage.setItem(versionStorageKey, version);
}

export function loadPermissionConfig() {
  const defaults = getDefaultPermissionConfig();

  try {
    const savedVersion = localStorage.getItem(PERMISSION_VERSION_STORAGE_KEY);
    if (savedVersion !== PERMISSION_CONFIG_VERSION) {
      resetStoredPermissionConfig(
        PERMISSION_STORAGE_KEY,
        PERMISSION_VERSION_STORAGE_KEY,
        PERMISSION_CONFIG_VERSION
      );
      return defaults;
    }

    const saved = localStorage.getItem(PERMISSION_STORAGE_KEY);
    if (!saved) return defaults;

    const parsed = JSON.parse(saved);
    return {
      ...defaults,
      ...parsed,
      ADMIN: defaults.ADMIN,
    };
  } catch {
    return defaults;
  }
}

export function savePermissionConfig(config) {
  const nextConfig = {
    ...config,
    ADMIN: DEFAULT_ROLE_PERMISSIONS.ADMIN,
  };

  localStorage.setItem(PERMISSION_STORAGE_KEY, JSON.stringify(nextConfig));
  localStorage.setItem(PERMISSION_VERSION_STORAGE_KEY, PERMISSION_CONFIG_VERSION);
  window.dispatchEvent(new Event("odc-permissions-updated"));
  return nextConfig;
}

export function loadActionPermissionConfig() {
  const defaults = getDefaultActionPermissionConfig();

  try {
    const savedVersion = localStorage.getItem(ACTION_PERMISSION_VERSION_STORAGE_KEY);
    if (savedVersion !== ACTION_PERMISSION_CONFIG_VERSION) {
      resetStoredPermissionConfig(
        ACTION_PERMISSION_STORAGE_KEY,
        ACTION_PERMISSION_VERSION_STORAGE_KEY,
        ACTION_PERMISSION_CONFIG_VERSION
      );
      return defaults;
    }

    const saved = localStorage.getItem(ACTION_PERMISSION_STORAGE_KEY);
    if (!saved) return defaults;

    const parsed = JSON.parse(saved);
    return {
      ...defaults,
      ...parsed,
      ADMIN: defaults.ADMIN,
    };
  } catch {
    return defaults;
  }
}

export function saveActionPermissionConfig(config) {
  const nextConfig = {
    ...config,
    ADMIN: DEFAULT_ROLE_ACTION_PERMISSIONS.ADMIN,
  };

  localStorage.setItem(ACTION_PERMISSION_STORAGE_KEY, JSON.stringify(nextConfig));
  localStorage.setItem(ACTION_PERMISSION_VERSION_STORAGE_KEY, ACTION_PERMISSION_CONFIG_VERSION);
  window.dispatchEvent(new Event("odc-action-permissions-updated"));
  return nextConfig;
}

export const DRIVER_SUMMARY_CARD_SCOPE_STORAGE_KEY = "odc_driver_summary_card_scope";

export const DEFAULT_DRIVER_SUMMARY_CARD_SCOPE = {
  ADMIN: "ALL",
  STAFF: "ALL",
  USER: "NONE",
  DRIVER: "SELF",
};

function normalizeDriverSummaryCardScope(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "SELF" || normalized === "ALL" || normalized === "NONE") {
    return normalized;
  }
  return "";
}

export function loadDriverSummaryCardScopeConfig() {
  try {
    const saved = localStorage.getItem(DRIVER_SUMMARY_CARD_SCOPE_STORAGE_KEY);
    if (!saved) {
      return { ...DEFAULT_DRIVER_SUMMARY_CARD_SCOPE };
    }

    const parsed = JSON.parse(saved);
    const config = { ...DEFAULT_DRIVER_SUMMARY_CARD_SCOPE };

    Object.keys(config).forEach((role) => {
      if (role === "ADMIN") {
        config[role] = "ALL";
        return;
      }

      const normalized = normalizeDriverSummaryCardScope(parsed?.[role]);
      if (normalized) {
        config[role] = normalized;
      }
    });

    return config;
  } catch {
    return { ...DEFAULT_DRIVER_SUMMARY_CARD_SCOPE };
  }
}

export function saveDriverSummaryCardScopeConfig(config) {
  const nextConfig = { ...DEFAULT_DRIVER_SUMMARY_CARD_SCOPE };

  Object.keys(nextConfig).forEach((role) => {
    if (role === "ADMIN") {
      nextConfig[role] = "ALL";
      return;
    }

    const normalized = normalizeDriverSummaryCardScope(config?.[role]);
    if (normalized) {
      nextConfig[role] = normalized;
    }
  });

  localStorage.setItem(DRIVER_SUMMARY_CARD_SCOPE_STORAGE_KEY, JSON.stringify(nextConfig));
  window.dispatchEvent(new Event("odc-action-permissions-updated"));
  return nextConfig;
}

export function getDriverSummaryCardScope(role, config = loadDriverSummaryCardScopeConfig()) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "ADMIN" || normalizedRole === "STAFF") {
    return "ALL";
  }

  const scope = normalizeDriverSummaryCardScope(config?.[normalizedRole]);
  if (scope) return scope;

  if (normalizedRole === "DRIVER") return "SELF";
  if (normalizedRole === "USER") return "NONE";
  return "NONE";
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("odc_user") || "null");
  } catch {
    return null;
  }
}

export function hasPermission(userOrRole, permissionId, config = loadActionPermissionConfig()) {
  const role = normalizeRole(
    typeof userOrRole === "string" ? userOrRole : userOrRole?.role || getCurrentUser()?.role
  );

  if (role === "ADMIN") return true;
  return (config[role] || []).includes(permissionId);
}

export const can = hasPermission;

// TODO: These action permissions are frontend-only until the API has a trusted
// auth token/session and can validate role permissions server-side.

export function getAllowedPages(role, config = loadPermissionConfig()) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "ADMIN") {
    return new Set(PERMISSION_ITEMS.flatMap((item) => item.pages));
  }

  const permissionIds = new Set(config[normalizedRole] || []);
  const allowedPages = new Set(
    PERMISSION_ITEMS
      .filter((item) => permissionIds.has(item.id))
      .flatMap((item) => item.pages)
  );

  if (normalizedRole === "STAFF" || normalizedRole === "DRIVER") {
    allowedPages.add("driver-jobs");
  }

  return allowedPages;
}

export function canAccessPage(role, page, config = loadPermissionConfig()) {
  const normalizedRole = normalizeRole(role);
  if (page === "admin" && normalizedRole !== "ADMIN") return false;
  if (!getAllowedPages(normalizedRole, config).has(page)) return false;
  if (normalizedRole === "ADMIN") return true;

  const actionConfig = loadActionPermissionConfig();
  const actionRequirements = PAGE_ACTION_REQUIREMENTS[page] || [];
  return actionRequirements.length === 0 || actionRequirements.some((permissionId) =>
    hasPermission(normalizedRole, permissionId, actionConfig)
  );
}

export function getFirstAllowedPage(role, config = loadPermissionConfig()) {
  const preferredOrder = [
    "cars",
    "booking",
    "staff",
    "booking-cancellation-history",
    "driver-jobs",
    "calendar",
    "driver-summary",
    "admin",
  ];
  const allowedPages = getAllowedPages(role, config);
  return preferredOrder.find((page) => allowedPages.has(page)) || "";
}
