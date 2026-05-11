export const PERMISSION_STORAGE_KEY = "odc_menu_permissions";
export const ACTION_PERMISSION_STORAGE_KEY = "odc_action_permissions";

export const PERMISSION_ITEMS = [
  { id: "dashboard", label: "Dashboard", pages: ["admin"] },
  { id: "booking-list", label: "รายการจองทั้งหมด", pages: ["booking"] },
  { id: "calendar", label: "ปฏิทิน", pages: ["calendar"] },
  { id: "booking-approval", label: "อนุมัติรายการจอง", pages: ["staff"] },
  { id: "driver-summary", label: "สรุปงานคนขับ", pages: ["driver-summary"] },
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
    "vehicle-management",
    "booking-cancellation-history",
  ],
  USER: ["booking-list", "calendar", "vehicle-management"],
  DRIVER: ["driver-summary"],
};

export const ACTION_PERMISSION_GROUPS = [
  {
    id: "bookings",
    label: "รายการจอง",
    permissions: [
      { id: "bookings_view", label: "ดูรายการ" },
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
    permissions: [{ id: "driver_summary_view", label: "ดูสรุปงานคนขับ" }],
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
    "bookings_edit",
    "bookings_approve",
    "bookings_cancel",
    "drivers_view",
    "vehicles_view",
    "driver_summary_view",
  ],
  USER: ["bookings_view", "bookings_create", "vehicles_view"],
  DRIVER: ["bookings_view", "bookings_edit", "driver_summary_view"],
};

const PAGE_ACTION_REQUIREMENTS = {
  cars: ["vehicles_view"],
  booking: ["bookings_view", "bookings_create"],
  "booking-cancellation-history": ["bookings_view"],
  staff: ["bookings_view", "bookings_approve"],
  calendar: ["bookings_view"],
  "driver-summary": ["driver_summary_view"],
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

export function loadPermissionConfig() {
  const defaults = getDefaultPermissionConfig();

  try {
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
  window.dispatchEvent(new Event("odc-permissions-updated"));
  return nextConfig;
}

export function loadActionPermissionConfig() {
  const defaults = getDefaultActionPermissionConfig();

  try {
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
  window.dispatchEvent(new Event("odc-action-permissions-updated"));
  return nextConfig;
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
  return new Set(
    PERMISSION_ITEMS
      .filter((item) => permissionIds.has(item.id))
      .flatMap((item) => item.pages)
  );
}

export function canAccessPage(role, page, config = loadPermissionConfig()) {
  const normalizedRole = normalizeRole(role);
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
    "booking-cancellation-history",
    "staff",
    "calendar",
    "driver-summary",
    "admin",
  ];
  const allowedPages = getAllowedPages(role, config);
  return preferredOrder.find((page) => allowedPages.has(page)) || "";
}
