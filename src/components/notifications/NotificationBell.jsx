import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteAllNotifications,
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  savePushSubscription,
} from "../../api";
import { showConfirm, showError, showSuccess } from "../../utils/alert";
import {
  formatTokenPreview,
  getPushDebugInfo,
  getPreferredPushProvider,
  getPushDeviceLabel,
  getPushVapidPreview,
  getPushVapidSourceLabel,
  isPushSupported,
  listenForegroundMessages,
  registerWebPushSubscription,
  recoverFirebaseMessagingRegistration,
  requestFcmToken,
  requestNotificationPermission,
} from "../../utils/pushNotifications";
import { formatThaiNotificationDateTime } from "../../utils/date";

const NOTIFICATION_POLL_INTERVAL_MS = 60000;
const NOTIFICATIONS_PER_PAGE = 3;
const PUSH_TOKEN_STORAGE_KEY = "odc_fcm_token_current";
const PUSH_TOKEN_USER_ID_STORAGE_KEY = "odc_fcm_token_user_id";
const PUSH_PROVIDER_STORAGE_KEY = "odc_push_provider";
const PUSH_LAST_SYNC_STORAGE_KEY = "odc_fcm_token_last_sync_at";
const PUSH_SYNC_THROTTLE_MS = 5 * 60 * 1000;
const SWIPE_DELETE_THRESHOLD_PX = 92;
const SWIPE_ACTIVATION_PX = 14;
const NOTIFICATION_CATEGORY_META = {
  Booking: {
    label: "Booking",
    className: "booking",
  },
  Driver: {
    label: "Driver",
    className: "driver",
  },
  Approval: {
    label: "Approval",
    className: "approval",
  },
  Cancellation: {
    label: "Cancellation",
    className: "cancellation",
  },
};

function formatNotificationDateTime(value) {
  return formatThaiNotificationDateTime(value);
}

function getUnreadBadgeLabel(count) {
  if (count > 99) return "99+";
  return String(count);
}

function getNotificationCategory(notification) {
  const explicitCategory = String(notification?.category || "").trim();
  if (NOTIFICATION_CATEGORY_META[explicitCategory]) {
    return explicitCategory;
  }

  const type = String(notification?.type || "").trim().toUpperCase();
  const title = String(notification?.title || "").trim();

  if (type.includes("CANCEL") || title.includes("ยกเลิก")) {
    return "Cancellation";
  }

  if (
    type.includes("UNASSIGN") ||
    type.includes("APPROVAL") ||
    title.includes("อนุมัติ") ||
    title.includes("ดึงรายการจองกลับ")
  ) {
    return "Approval";
  }

  if (type.includes("UNAVAILABLE") || type.startsWith("DRIVER_")) {
    return "Driver";
  }

  return "Booking";
}

function getPushStatusLabel(status) {
  if (status === "unsupported") return "ไม่รองรับ";
  if (status === "blocked") return "ถูกบล็อก";
  if (status === "enabled") return "เปิดแล้ว";
  return "ยังไม่ได้เปิด";
}

function parseDriverUnavailableMessage(notification) {
  const category = getNotificationCategory(notification);
  const message = String(notification?.message || "").trim();
  if (category !== "Driver" || !message.includes("|")) {
    return null;
  }

  const parts = message.split("|").map((part) => part.trim());
  if (parts.length !== 4 || parts.some((part) => !part)) {
    return null;
  }

  return {
    driverName: parts[0],
    startDateTime: parts[1],
    endDateTime: parts[2],
    unavailableType: parts[3],
  };
}

function readLocalStorageValue(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorageValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage write failures so push registration still works.
  }
}

function removeLocalStorageValue(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage remove failures during push recovery.
  }
}

function getDeviceType() {
  if (typeof window === "undefined") {
    return "unknown";
  }

  const userAgent = String(navigator.userAgent || "").toLowerCase();
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;

  if (isStandalone) return "pwa";
  if (/ipad|tablet/.test(userAgent)) return "tablet";
  if (/mobi|android|iphone/.test(userAgent)) return "mobile";
  return "desktop";
}

export default function NotificationBell({ currentUser, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeNotificationId, setActiveNotificationId] = useState("");
  const [deletingNotificationId, setDeletingNotificationId] = useState("");
  const [deletingAll, setDeletingAll] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [pushStatus, setPushStatus] = useState("loading");
  const [page, setPage] = useState(1);
  const [swipingNotificationId, setSwipingNotificationId] = useState("");
  const [swipeOffsetById, setSwipeOffsetById] = useState({});
  const [debugPushOpen, setDebugPushOpen] = useState(false);
  const [debugPushLoading, setDebugPushLoading] = useState(false);
  const [debugPushInfo, setDebugPushInfo] = useState({
    permission: typeof Notification === "undefined" ? "unsupported" : Notification.permission,
    serviceWorkerScriptUrl: "",
    provider: getPreferredPushProvider(),
    device: getPushDeviceLabel(),
    tokenPreview: "",
    vapidSource: getPushVapidSourceLabel(getPreferredPushProvider()),
    vapidKeyPreview: getPushVapidPreview(getPreferredPushProvider()),
    error: null,
  });
  const rootRef = useRef(null);
  const swipeSessionRef = useRef({
    notificationId: "",
    pointerId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    isActive: false,
    isHorizontalSwipe: false,
  });
  const suppressClickNotificationIdRef = useRef("");

  const userId = String(currentUser?.user_id || "").trim();
  const role = String(currentUser?.role || "").trim().toUpperCase();
  const notifications = items;
  const hasUnreadNotifications = unreadCount > 0;
  const totalPages = Math.max(1, Math.ceil(notifications.length / NOTIFICATIONS_PER_PAGE));
  const pagedNotifications = notifications.slice(
    (page - 1) * NOTIFICATIONS_PER_PAGE,
    page * NOTIFICATIONS_PER_PAGE
  );
  const visiblePageNumbers = useMemo(() => {
    const pages = [];
    const maxVisible = 3;

    let start = Math.max(1, page - 1);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }

    return pages;
  }, [page, totalPages]);

  const loadNotifications = useCallback(
    async ({ silent = false } = {}) => {
      if (!userId && !role) {
        setItems([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      if (!silent) {
        setLoading(true);
      }

      try {
        const response = await getNotifications({
          user_id: userId,
          role,
        });

        setItems(response.items || []);
        setUnreadCount(Number(response.unreadCount || 0));
      } catch (err) {
        console.warn("getNotifications failed", err);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [role, userId]
  );

  const syncCurrentDevicePushToken = useCallback(
    async ({ force = false } = {}) => {
      if (!userId) {
        return { synced: false, reason: "missing_user" };
      }

      if (!isPushSupported()) {
        setPushStatus("unsupported");
        return { synced: false, reason: "unsupported" };
      }

      if (Notification.permission !== "granted") {
        setPushStatus(Notification.permission === "denied" ? "blocked" : "not_enabled");
        return { synced: false, reason: "permission_not_granted" };
      }

      const storedToken = String(readLocalStorageValue(PUSH_TOKEN_STORAGE_KEY) || "").trim();
      const storedUserId = String(readLocalStorageValue(PUSH_TOKEN_USER_ID_STORAGE_KEY) || "").trim();
      const storedProvider = String(readLocalStorageValue(PUSH_PROVIDER_STORAGE_KEY) || "").trim().toUpperCase();
      const lastSyncAt = Number(readLocalStorageValue(PUSH_LAST_SYNC_STORAGE_KEY) || 0);
      const provider = getPreferredPushProvider();
      const canUseThrottle = Boolean(storedToken) && storedUserId === userId;
      if (!force && canUseThrottle && storedProvider === provider && lastSyncAt > 0 && Date.now() - lastSyncAt < PUSH_SYNC_THROTTLE_MS) {
        setPushStatus("enabled");
        return { synced: false, reason: "throttled", provider };
      }

      if (provider === "WEB_PUSH") {
        const webPushSubscription = await registerWebPushSubscription();
        const endpoint = String(webPushSubscription.endpoint || "").trim();
        if (!endpoint) {
          setPushStatus("not_enabled");
          return { synced: false, reason: "missing_endpoint", provider };
        }

        const subscriptionChanged = storedToken !== endpoint || storedUserId !== userId || storedProvider !== provider;

        if (force || subscriptionChanged) {
          await savePushSubscription({
            user_id: userId,
            user_name: String(currentUser?.name || "").trim(),
            role,
            endpoint,
            p256dh: webPushSubscription.p256dh,
            auth: webPushSubscription.auth,
            subscription: webPushSubscription.subscription.toJSON(),
            provider: "WEB_PUSH",
            user_agent: navigator.userAgent || "",
            platform: navigator.platform || "",
            device_type: getDeviceType(),
            status: "ACTIVE",
          });
        }

        writeLocalStorageValue(PUSH_TOKEN_STORAGE_KEY, endpoint);
        writeLocalStorageValue(PUSH_TOKEN_USER_ID_STORAGE_KEY, userId);
        writeLocalStorageValue(PUSH_PROVIDER_STORAGE_KEY, provider);
        writeLocalStorageValue(PUSH_LAST_SYNC_STORAGE_KEY, String(Date.now()));
        setPushStatus("enabled");

        return {
          synced: force || subscriptionChanged,
          reason: force || subscriptionChanged ? "saved" : "unchanged",
          provider,
          endpoint,
        };
      }

      const fcmToken = String(await requestFcmToken()).trim();
      if (!fcmToken) {
        setPushStatus("not_enabled");
        return { synced: false, reason: "missing_token", provider };
      }

      const tokenChanged =
        storedToken !== fcmToken ||
        storedUserId !== userId ||
        storedProvider !== provider;

      if (force || tokenChanged) {
        await savePushSubscription({
          user_id: userId,
          user_name: String(currentUser?.name || "").trim(),
          role,
          fcm_token: fcmToken,
          previous_fcm_token: storedProvider === "FCM" ? storedToken : "",
          provider: "FCM",
          user_agent: navigator.userAgent || "",
          platform: navigator.platform || "",
          device_type: getDeviceType(),
          status: "ACTIVE",
        });
      }

      writeLocalStorageValue(PUSH_TOKEN_STORAGE_KEY, fcmToken);
      writeLocalStorageValue(PUSH_TOKEN_USER_ID_STORAGE_KEY, userId);
      writeLocalStorageValue(PUSH_PROVIDER_STORAGE_KEY, provider);
      writeLocalStorageValue(PUSH_LAST_SYNC_STORAGE_KEY, String(Date.now()));
      setPushStatus("enabled");

      return {
        synced: force || tokenChanged,
        reason: force || tokenChanged ? "saved" : "unchanged",
        provider,
        token: fcmToken,
      };
    },
    [currentUser?.name, role, userId]
  );

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!userId && !role) return undefined;

    const intervalId = window.setInterval(() => {
      loadNotifications({ silent: true });
    }, NOTIFICATION_POLL_INTERVAL_MS);

    const refreshHandler = () => {
      loadNotifications({ silent: true });
    };

    window.addEventListener("odc-notifications-refresh", refreshHandler);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("odc-notifications-refresh", refreshHandler);
    };
  }, [loadNotifications, role, userId]);

  useEffect(() => {
    if (!isOpen) {
      setIsExpanded(false);
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    setPage(1);
  }, [notifications.length]);

  useEffect(() => {
    setSwipeOffsetById({});
    setSwipingNotificationId("");
  }, [notifications.length]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    let unsubscribe = () => {};

    listenForegroundMessages((payload) => {
      const notificationUrl = String(payload?.fcmOptions?.link || payload?.data?.url || "").trim();
      if (notificationUrl) {
        window.dispatchEvent(new Event("odc-notifications-refresh"));
      }
    })
      .then((nextUnsubscribe) => {
        unsubscribe = typeof nextUnsubscribe === "function" ? nextUnsubscribe : () => {};
      })
      .catch((err) => {
        console.warn("listenForegroundMessages failed", err);
      });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    syncCurrentDevicePushToken().catch((err) => {
      console.warn("push sync failed", err);
      if (!cancelled) {
        setPushStatus(Notification.permission === "denied" ? "blocked" : "not_enabled");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [syncCurrentDevicePushToken]);

  useEffect(() => {
    if (!userId) return undefined;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncCurrentDevicePushToken().catch((err) => {
          console.warn("push sync on visibility change failed", err);
        });
      }
    };

    const handleWindowFocus = () => {
      syncCurrentDevicePushToken().catch((err) => {
        console.warn("push sync on focus failed", err);
      });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [syncCurrentDevicePushToken, userId]);

  const handleOpen = async () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen) {
      try {
        await Promise.all([
          loadNotifications({ silent: true }),
          syncCurrentDevicePushToken(),
        ]);
      } catch (err) {
        console.warn("push sync on panel open failed", err);
      }
    }
  };

  const handleItemClick = async (notification) => {
    if (deletingAll) return;
    if (!notification) return;

    const notificationId = String(notification.notification_id || "").trim();
    if (suppressClickNotificationIdRef.current === notificationId) {
      suppressClickNotificationIdRef.current = "";
      return;
    }
    const notificationUrl = String(notification.url || "").trim();

    if (notificationId && !notification.is_read) {
      setActiveNotificationId(notificationId);

      try {
        await markNotificationRead({ notification_id: notificationId });
        setItems((currentItems) =>
          currentItems.map((item) =>
            item.notification_id === notificationId
              ? {
                  ...item,
                  is_read: true,
                  read_at: new Date().toISOString(),
                }
              : item
          )
        );
        setUnreadCount((currentCount) => Math.max(0, currentCount - 1));
      } catch (err) {
        console.warn("markNotificationRead failed", err);
      } finally {
        setActiveNotificationId("");
      }
    }

    if (notificationUrl) {
      onNavigate?.(notificationUrl);
      setIsOpen(false);
    }
  };

  const handleMarkAll = async () => {
    if (!unreadCount || markingAll || deletingAll) return;

    setMarkingAll(true);

    try {
      await markAllNotificationsRead({
        user_id: userId,
        role,
      });

      setItems((currentItems) =>
        currentItems.map((item) => ({
          ...item,
          is_read: true,
          read_at: item.read_at || new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.warn("markAllNotificationsRead failed", err);
    } finally {
      setMarkingAll(false);
    }
  };

  const isMobileViewport = () => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  };

  const resetSwipeState = useCallback((notificationId = "") => {
    if (notificationId) {
      setSwipeOffsetById((current) => {
        if (!(notificationId in current)) {
          return current;
        }

        const next = { ...current };
        delete next[notificationId];
        return next;
      });
    } else {
      setSwipeOffsetById({});
    }

    setSwipingNotificationId((currentId) => (notificationId && currentId !== notificationId ? currentId : ""));
    swipeSessionRef.current = {
      notificationId: "",
      pointerId: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      isActive: false,
      isHorizontalSwipe: false,
    };
  }, []);

  const performDeleteNotification = useCallback(async (notification) => {
    if (!notification) return;

    const notificationId = String(notification.notification_id || "").trim();
    if (!notificationId || deletingNotificationId === notificationId || deletingAll) {
      return;
    }

    setDeletingNotificationId(notificationId);

    try {
      await deleteNotification(notificationId);
      setItems((currentItems) =>
        currentItems.filter((item) => String(item.notification_id || "").trim() !== notificationId)
      );
      if (!notification.is_read) {
        setUnreadCount((currentCount) => Math.max(0, currentCount - 1));
      }
    } catch (err) {
      console.warn("deleteNotification failed", err);
      await showError(err?.message || "ไม่สามารถลบการแจ้งเตือนได้");
      resetSwipeState(notificationId);
    } finally {
      setDeletingNotificationId("");
    }
  }, [deletingAll, deletingNotificationId, resetSwipeState]);

  const handleDeleteNotification = async (event, notification) => {
    event?.stopPropagation?.();
    event?.preventDefault?.();

    if (!notification) return;

    const notificationId = String(notification.notification_id || "").trim();
    if (!notificationId || deletingNotificationId === notificationId || deletingAll) {
      return;
    }

    const confirmed = await showConfirm("ลบการแจ้งเตือนนี้หรือไม่?");
    if (!confirmed) {
      return;
    }

    setDeletingNotificationId(notificationId);

    try {
      await deleteNotification(notificationId);
      setItems((currentItems) =>
        currentItems.filter((item) => String(item.notification_id || "").trim() !== notificationId)
      );
      if (!notification.is_read) {
        setUnreadCount((currentCount) => Math.max(0, currentCount - 1));
      }
    } catch (err) {
      console.warn("deleteNotification failed", err);
      await showError(err?.message || "ไม่สามารถลบการแจ้งเตือนได้");
    } finally {
      setDeletingNotificationId("");
    }
  };

  const handleNotificationKeyDown = (event, notification) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleItemClick(notification);
  };

  const handleDeleteNotificationImmediate = async (event, notification) => {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    await performDeleteNotification(notification);
  };

  const handleDeleteAllNotifications = useCallback(async () => {
    if (deletingAll || deletingNotificationId || notifications.length === 0) {
      return;
    }

    const notificationIds = notifications
      .map((notification) => String(notification?.notification_id || "").trim())
      .filter(Boolean);

    if (notificationIds.length === 0) {
      setItems([]);
      setUnreadCount(0);
      setPage(1);
      resetSwipeState();
      return;
    }

    setDeletingAll(true);

    try {
      await deleteAllNotifications(notificationIds);
      setItems([]);
      setUnreadCount(0);
      setPage(1);
      setDebugPushOpen(false);
      resetSwipeState();
    } catch (err) {
      console.warn("deleteAllNotifications failed", err);
      await showError(err?.message || "ไม่สามารถลบการแจ้งเตือนทั้งหมดได้");
    } finally {
      setDeletingAll(false);
    }
  }, [deletingAll, deletingNotificationId, notifications, resetSwipeState]);

  const handleNotificationPointerDown = (event, notification) => {
    if (!notification || deletingNotificationId || deletingAll) return;
    if (!isMobileViewport()) return;
    if (event.pointerType === "mouse") return;

    const notificationId = String(notification.notification_id || "").trim();
    if (!notificationId) return;

    swipeSessionRef.current = {
      notificationId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: 0,
      isActive: true,
      isHorizontalSwipe: false,
    };
  };

  const handleNotificationPointerMove = (event, notification) => {
    const swipe = swipeSessionRef.current;
    const notificationId = String(notification?.notification_id || "").trim();
    if (!swipe.isActive || swipe.pointerId !== event.pointerId || swipe.notificationId !== notificationId) {
      return;
    }

    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;

    if (!swipe.isHorizontalSwipe) {
      if (Math.abs(deltaX) < SWIPE_ACTIVATION_PX) {
        return;
      }

      if (Math.abs(deltaX) <= Math.abs(deltaY) || deltaX >= 0) {
        swipe.isActive = false;
        return;
      }

      swipe.isHorizontalSwipe = true;
    }

    event.preventDefault();
    const nextOffset = Math.max(deltaX, -140);
    swipe.offsetX = nextOffset;
    suppressClickNotificationIdRef.current = notificationId;
    setSwipingNotificationId(notificationId);
    setSwipeOffsetById((current) => ({
      ...current,
      [notificationId]: nextOffset,
    }));
  };

  const handleNotificationPointerEnd = async (event, notification) => {
    const swipe = swipeSessionRef.current;
    const notificationId = String(notification?.notification_id || "").trim();
    if (swipe.pointerId !== event.pointerId || swipe.notificationId !== notificationId) {
      return;
    }

    const shouldDelete = swipe.isHorizontalSwipe && Math.abs(swipe.offsetX) >= SWIPE_DELETE_THRESHOLD_PX;
    resetSwipeState(notificationId);

    if (shouldDelete) {
      suppressClickNotificationIdRef.current = notificationId;
      await performDeleteNotification(notification);
      return;
    }

    if (swipe.isHorizontalSwipe) {
      suppressClickNotificationIdRef.current = notificationId;
      window.setTimeout(() => {
        if (suppressClickNotificationIdRef.current === notificationId) {
          suppressClickNotificationIdRef.current = "";
        }
      }, 180);
    }
  };

  const handleEnablePush = async () => {
    if (!userId) return;
    if (!isPushSupported()) {
      setPushStatus("unsupported");
      return;
    }

    setPushStatus("loading");

    try {
      const permission = await requestNotificationPermission();
      if (permission !== "granted") {
        const nextStatus = permission === "denied" ? "blocked" : "not_enabled";
        setPushStatus(nextStatus);
        await showError(
          permission === "denied"
            ? "เบราว์เซอร์บล็อกการแจ้งเตือน กรุณาเปิดสิทธิ์การแจ้งเตือนในการตั้งค่าอุปกรณ์"
            : "ยังไม่ได้อนุญาตการแจ้งเตือนสำหรับอุปกรณ์นี้"
        );
        return;
      }

      const result = await syncCurrentDevicePushToken({ force: true });
      if (result.synced) {
        await showSuccess("เปิดการแจ้งเตือนบนอุปกรณ์นี้เรียบร้อยแล้ว");
      }
    } catch (err) {
      console.warn("enable push failed", err);
      setPushStatus(Notification.permission === "denied" ? "blocked" : "not_enabled");
      await showError(err?.message || "ไม่สามารถเปิดการแจ้งเตือนบนอุปกรณ์นี้ได้");
    }
  };

  const handleDebugPush = async () => {
    setDebugPushOpen(true);
    setDebugPushLoading(true);

    try {
      const debugInfo = await getPushDebugInfo({ requestToken: true });
      setDebugPushInfo({
        permission: debugInfo.permission,
        serviceWorkerScriptUrl: debugInfo.serviceWorkerScriptUrl,
        provider: getPreferredPushProvider(),
        device: getPushDeviceLabel(),
        tokenPreview: debugInfo.tokenPreview || formatTokenPreview(debugInfo.token),
        vapidSource: debugInfo.vapidSource || getPushVapidSourceLabel(getPreferredPushProvider()),
        vapidKeyPreview: debugInfo.vapidKeyPreview || getPushVapidPreview(getPreferredPushProvider()),
        error: debugInfo.error,
      });
    } catch (err) {
      setDebugPushInfo({
        permission: typeof Notification === "undefined" ? "unsupported" : Notification.permission,
        serviceWorkerScriptUrl: "",
        provider: getPreferredPushProvider(),
        device: getPushDeviceLabel(),
        tokenPreview: "",
        vapidSource: getPushVapidSourceLabel(getPreferredPushProvider()),
        vapidKeyPreview: getPushVapidPreview(getPreferredPushProvider()),
        error: {
          code: String(err?.code || "").trim(),
          message: String(err?.message || err).trim(),
          stack: String(err?.stack || "").trim(),
        },
      });
    } finally {
      setDebugPushLoading(false);
    }
  };

  const handleRecoverPush = async () => {
    const confirmed = await showConfirm("ลบโทเคน Firebase บนอุปกรณ์นี้ รีเซ็ต service worker แล้วโหลดหน้าใหม่ใช่หรือไม่");
    if (!confirmed) return;

    removeLocalStorageValue(PUSH_TOKEN_STORAGE_KEY);
    removeLocalStorageValue(PUSH_TOKEN_USER_ID_STORAGE_KEY);
    removeLocalStorageValue(PUSH_PROVIDER_STORAGE_KEY);
    removeLocalStorageValue(PUSH_LAST_SYNC_STORAGE_KEY);

    try {
      await recoverFirebaseMessagingRegistration();
    } catch (err) {
      console.warn("push recovery failed", err);
      await showError(err?.message || "ไม่สามารถรีเซ็ตการแจ้งเตือนบนอุปกรณ์นี้ได้");
    }
  };

  return (
    <div className="notification-bell" ref={rootRef}>
      <button
        type="button"
        className={`notification-bell-button ${hasUnreadNotifications ? "has-unread" : ""}`}
        onClick={handleOpen}
        aria-label="ศูนย์แจ้งเตือน"
        aria-expanded={isOpen}
      >
        <span className="notification-bell-pulse" aria-hidden="true" />
        <span className="notification-bell-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              d="M12 3a4 4 0 0 0-4 4v1.21c0 .8-.24 1.59-.68 2.26L6.1 12.3A4 4 0 0 0 5.5 14.5V16h13v-1.5a4 4 0 0 0-.6-2.2l-1.22-1.83A4.12 4.12 0 0 1 16 8.21V7a4 4 0 0 0-4-4Zm0 18a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 21Z"
              fill="currentColor"
            />
          </svg>
        </span>
        {unreadCount > 0 && <span className="notification-bell-badge">{getUnreadBadgeLabel(unreadCount)}</span>}
      </button>

      {isOpen && (
        <div className={`notification-panel${isExpanded ? " is-expanded" : ""}`} role="dialog" aria-label="รายการแจ้งเตือน">
          <div className="notification-panel-header">
            <div>
              <h3>แจ้งเตือน</h3>
              <p>{unreadCount > 0 ? `ยังไม่ได้อ่าน ${unreadCount} รายการ` : "ไม่มีรายการที่ยังไม่ได้อ่าน"}</p>
            </div>
            <button
              type="button"
              className="notification-panel-close"
              aria-label="ปิดแจ้งเตือน"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="notification-panel-body">
            {debugPushOpen && (
              <div className="notification-debug-card">
                <div className="notification-debug-row">
                  <span>Provider</span>
                  <strong>{debugPushInfo.provider || "-"}</strong>
                </div>
                <div className="notification-debug-row">
                  <span>Device</span>
                  <strong>{debugPushInfo.device || "-"}</strong>
                </div>
                <div className="notification-debug-row">
                  <span>Permission</span>
                  <strong>{debugPushInfo.permission || "-"}</strong>
                </div>
                <div className="notification-debug-row">
                  <span>Service Worker</span>
                  <code>{debugPushInfo.serviceWorkerScriptUrl || "-"}</code>
                </div>
                <div className="notification-debug-row">
                  <span>VAPID Source</span>
                  <code>{debugPushInfo.vapidSource || "-"}</code>
                </div>
                <div className="notification-debug-row">
                  <span>VAPID Key</span>
                  <code>{debugPushInfo.vapidKeyPreview || "-"}</code>
                </div>
                <div className="notification-debug-row">
                  <span>{debugPushInfo.provider === "WEB_PUSH" ? "WEB_PUSH Endpoint" : "FCM Token"}</span>
                  <code>
                    {debugPushLoading
                      ? "Checking..."
                      : debugPushInfo.tokenPreview || (debugPushInfo.error ? "-" : debugPushInfo.provider === "WEB_PUSH" ? "No subscription" : "No token")}
                  </code>
                </div>
                {debugPushInfo.error && (
                  <div className="notification-debug-error">
                    <div className="notification-debug-error-title">getToken error</div>
                    <pre>{JSON.stringify(debugPushInfo.error, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}

            {loading && (
              <div className="notification-list">
                {[0, 1, 2].map((item) => (
                  <div className="notification-item-skeleton" key={item}>
                    <div className="notification-skeleton-line notification-skeleton-title" />
                    <div className="notification-skeleton-line notification-skeleton-meta" />
                    <div className="notification-skeleton-line notification-skeleton-message" />
                  </div>
                ))}
              </div>
            )}

            {!loading && items.length === 0 && (
              <div className="notification-empty-state">ยังไม่มีรายการแจ้งเตือน</div>
            )}

            {!loading && notifications.length > 0 && (
              <>
                <div className="notification-list">
                  {pagedNotifications.map((notification) => {
                  const notificationId = String(notification.notification_id || "").trim();
                  const isUnread = !notification.is_read;
                  const isBusy =
                    activeNotificationId === notificationId || deletingNotificationId === notificationId;
                  const swipeOffset = Number(swipeOffsetById[notificationId] || 0);
                  const swipeProgress = Math.min(1, Math.abs(swipeOffset) / SWIPE_DELETE_THRESHOLD_PX);
                  const category = getNotificationCategory(notification);
                  const categoryMeta = NOTIFICATION_CATEGORY_META[category] || NOTIFICATION_CATEGORY_META.Booking;
                  const driverStartedPayload = null;
                  const requesterAssignedPayload = null;
                  const driverUnavailableMessage = parseDriverUnavailableMessage(notification);

                  return (
                    <div
                      key={notificationId || `${notification.title}-${notification.created_at}`}
                      className={`notification-item notification-mobile-card${isUnread ? " is-unread" : ""}${swipeOffset < 0 ? " is-swipe-active" : ""}`}
                      role="button"
                      tabIndex={isBusy || deletingAll ? -1 : 0}
                      aria-disabled={isBusy || deletingAll}
                      onClick={isBusy || deletingAll ? undefined : () => handleItemClick(notification)}
                      onKeyDown={(event) => handleNotificationKeyDown(event, notification)}
                      onPointerDown={(event) => handleNotificationPointerDown(event, notification)}
                      onPointerMove={(event) => handleNotificationPointerMove(event, notification)}
                      onPointerUp={(event) => {
                        handleNotificationPointerEnd(event, notification).catch((err) => {
                          console.warn("notification swipe delete failed", err);
                        });
                      }}
                      onPointerCancel={(event) => {
                        handleNotificationPointerEnd(event, notification).catch((err) => {
                          console.warn("notification swipe cancel failed", err);
                        });
                      }}
                    >
                      <div
                        className="notification-item-swipe-delete"
                        aria-hidden="true"
                        style={{
                          opacity: swipeOffset < 0 ? Math.min(1, Math.max(0.18, swipeProgress)) : 0,
                        }}
                      >
                        <svg viewBox="0 0 24 24" focusable="false">
                          <path
                            d="M9 3.75h6a1.5 1.5 0 0 1 1.5 1.5V6H21v1.5h-1.23l-.73 10.22A2.25 2.25 0 0 1 16.8 19.8H7.2a2.25 2.25 0 0 1-2.24-2.08L4.23 7.5H3V6h4.5v-.75A1.5 1.5 0 0 1 9 3.75Zm0 2.25V6h6v-.75a.75.75 0 0 0-.75-.75h-4.5A.75.75 0 0 0 9 5.25ZM7.46 7.5l.71 9.96a.75.75 0 0 0 .75.69h6.16a.75.75 0 0 0 .75-.69l.71-9.96H7.46Zm2.29 2.1h1.5v6h-1.5v-6Zm3 0h1.5v6h-1.5v-6Z"
                            fill="currentColor"
                          />
                        </svg>
                        <span>ลบ</span>
                      </div>
                      <div
                        className="notification-item-content"
                        style={{
                          transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined,
                          transition: swipingNotificationId === notificationId ? "none" : "transform 0.18s ease",
                        }}
                      >
                      <button
                        type="button"
                        className="notification-item-delete"
                        aria-label="ลบการแจ้งเตือน"
                        onClick={(event) => handleDeleteNotificationImmediate(event, notification)}
                        onKeyDown={(event) => event.stopPropagation()}
                        disabled={deletingAll || deletingNotificationId === notificationId}
                      >
                        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                          <path
                            d="M9 3.75h6a1.5 1.5 0 0 1 1.5 1.5V6H21v1.5h-1.23l-.73 10.22A2.25 2.25 0 0 1 16.8 19.8H7.2a2.25 2.25 0 0 1-2.24-2.08L4.23 7.5H3V6h4.5v-.75A1.5 1.5 0 0 1 9 3.75Zm0 2.25V6h6v-.75a.75.75 0 0 0-.75-.75h-4.5A.75.75 0 0 0 9 5.25ZM7.46 7.5l.71 9.96a.75.75 0 0 0 .75.69h6.16a.75.75 0 0 0 .75-.69l.71-9.96H7.46Zm2.29 2.1h1.5v6h-1.5v-6Zm3 0h1.5v6h-1.5v-6Z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                      <div className="notification-item-head">
                        <div className="notification-item-title-group">
                          <span className={`notification-category-badge notification-category-${categoryMeta.className}`}>
                            [{categoryMeta.label}]
                          </span>
                          <strong className="notification-item-title">{notification.title || "-"}</strong>
                          {isUnread && <span className="notification-item-dot" aria-hidden="true" />}
                        </div>
                      </div>
                      <div className="notification-item-time">{formatNotificationDateTime(notification.created_at)}</div>
                      {!driverStartedPayload && !requesterAssignedPayload && !driverUnavailableMessage && (
                        <div className="notification-item-message">{notification.message || "-"}</div>
                      )}
                      {driverUnavailableMessage && (
                        <div className="notification-item-message notification-item-message-stacked">
                          <span>{driverUnavailableMessage.driverName}</span>
                          <span>
                            {driverUnavailableMessage.startDateTime}{" -> "}{driverUnavailableMessage.endDateTime}
                          </span>
                          <span>{driverUnavailableMessage.unavailableType}</span>
                        </div>
                      )}
                      {driverStartedPayload && (
                        <div className="notification-detail-list">
                          <div>
                            <b>คนขับ:</b> {driverStartedPayload.driver_name}
                          </div>
                          <div>
                            <b>ปลายทาง:</b> {driverStartedPayload.destination}
                          </div>
                          <div>
                            <b>เวลาไป:</b> {driverStartedPayload.start_datetime}
                          </div>
                        </div>
                      )}
                      {requesterAssignedPayload && (
                        <div className="notification-detail-list">
                          <div>
                            <b>คนขับ:</b> {requesterAssignedPayload.driver_name}
                          </div>
                          <div>
                            <b>ปลายทาง:</b> {requesterAssignedPayload.destination}
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                  );
                  })}
                </div>
                {totalPages > 1 && (
                  <div className="notification-pagination compact">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      aria-label="Previous notifications page"
                    >
                      &lsaquo;
                    </button>

                    {visiblePageNumbers.map((pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        className={page === pageNumber ? "active-page" : ""}
                        onClick={() => setPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    ))}

                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      aria-label="Next notifications page"
                    >
                      &rsaquo;
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="notification-panel-footer">
            <button type="button" className="notification-text-button notification-text-button-full" onClick={handleMarkAll} disabled={!unreadCount || markingAll || deletingAll}>
              อ่านทั้งหมด
            </button>
            <button
              type="button"
              className="notification-text-button notification-text-button-danger notification-text-button-full"
              onClick={handleDeleteAllNotifications}
              disabled={deletingAll || Boolean(deletingNotificationId) || items.length === 0}
            >
              {deletingAll ? "กำลังลบทั้งหมด..." : "ลบทั้งหมด"}
            </button>
            <button
              type="button"
              className="notification-text-button notification-text-button-full"
              onClick={handleEnablePush}
              disabled={!userId || deletingAll || pushStatus === "enabled" || pushStatus === "unsupported" || pushStatus === "blocked"}
            >
              {pushStatus === "loading" ? "เปิดแจ้งเตือนบนเครื่องนี้" : getPushStatusLabel(pushStatus)}
            </button>
            <div className="notification-panel-footer-inline-actions">
              <button
                type="button"
                className="notification-text-button notification-text-button-half"
                onClick={handleDebugPush}
                disabled={deletingAll || debugPushLoading}
              >
                {debugPushLoading ? "Checking..." : "Debug Push"}
              </button>
              <button
                type="button"
                className="notification-text-button notification-text-button-danger notification-text-button-half"
                onClick={handleRecoverPush}
                disabled={!userId || deletingAll}
              >
                Recover Push
              </button>
            </div>
            <button
              type="button"
              className="notification-text-button notification-text-button-full"
              onClick={() => setIsExpanded((currentValue) => !currentValue)}
              disabled={deletingAll || items.length === 0}
            >
              {isExpanded ? "ย่อรายการ" : "ดูทั้งหมด"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
