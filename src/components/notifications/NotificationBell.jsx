import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  savePushSubscription,
} from "../../api";
import {
  isPushSupported,
  listenForegroundMessages,
  requestFcmToken,
  requestNotificationPermission,
} from "../../utils/pushNotifications";

const NOTIFICATION_POLL_INTERVAL_MS = 60000;
const NOTIFICATIONS_PER_PAGE = 3;
function formatNotificationDateTime(value) {
  try {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

function getUnreadBadgeLabel(count) {
  if (count > 99) return "99+";
  return String(count);
}

function parseNotificationPayload(value) {
  try {
    if (!value) return null;
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

function getDriverStartedPayload(notification) {
  const payload = parseNotificationPayload(notification?.payload_json);
  if (!payload || String(notification?.type || "").trim() !== "DRIVER_STARTED_JOB") {
    return null;
  }

  return {
    driver_name: String(payload.driver_name || "").trim() || "-",
    destination: String(payload.destination || "").trim() || "-",
    start_datetime: formatNotificationDateTime(payload.start_datetime) || "-",
  };
}

function getRequesterAssignedPayload(notification) {
  const payload = parseNotificationPayload(notification?.payload_json);
  if (!payload || String(notification?.type || "").trim() !== "BOOKING_ASSIGNED_TO_REQUESTER") {
    return null;
  }

  return {
    driver_name: String(payload.driver_name || "").trim() || "-",
    destination: String(payload.destination || "").trim() || "-",
  };
}

function getPushStatusLabel(status) {
  if (status === "unsupported") return "ไม่รองรับ";
  if (status === "blocked") return "ถูกบล็อก";
  if (status === "enabled") return "เปิดแล้ว";
  return "ยังไม่ได้เปิด";
}

export default function NotificationBell({ currentUser, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeNotificationId, setActiveNotificationId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [pushStatus, setPushStatus] = useState("loading");
  const [page, setPage] = useState(1);
  const rootRef = useRef(null);

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

    async function syncPushState() {
      if (!isPushSupported()) {
        if (!cancelled) setPushStatus("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setPushStatus("blocked");
        return;
      }

      try {
        if (Notification.permission !== "granted") {
          if (!cancelled) setPushStatus("not_enabled");
          return;
        }

        const fcmToken = await requestFcmToken();
        if (!fcmToken) {
          if (!cancelled) setPushStatus("not_enabled");
          return;
        }

        if (userId) {
          await savePushSubscription({
            user_id: userId,
            fcm_token: fcmToken,
            provider: "FCM",
            user_agent: navigator.userAgent || "",
          });
        }

        if (!cancelled) setPushStatus("enabled");
      } catch (err) {
        console.warn("push sync failed", err);
        if (!cancelled) {
          setPushStatus(Notification.permission === "denied" ? "blocked" : "not_enabled");
        }
      }
    }

    syncPushState();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleOpen = async () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen) {
      await loadNotifications({ silent: true });
    }
  };

  const handleItemClick = async (notification) => {
    if (!notification) return;

    const notificationId = String(notification.notification_id || "").trim();
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
    if (!unreadCount || markingAll) return;

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
        setPushStatus(permission === "denied" ? "blocked" : "not_enabled");
        return;
      }

      const fcmToken = await requestFcmToken();
      await savePushSubscription({
        user_id: userId,
        fcm_token: fcmToken,
        provider: "FCM",
        user_agent: navigator.userAgent || "",
      });
      setPushStatus("enabled");
    } catch (err) {
      console.warn("enable push failed", err);
      setPushStatus(Notification.permission === "denied" ? "blocked" : "not_enabled");
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
                  const driverStartedPayload = getDriverStartedPayload(notification);
                  const requesterAssignedPayload = getRequesterAssignedPayload(notification);

                  return (
                    <button
                      type="button"
                      key={notificationId || `${notification.title}-${notification.created_at}`}
                      className={`notification-item${isUnread ? " is-unread" : ""}`}
                      onClick={() => handleItemClick(notification)}
                      disabled={activeNotificationId === notificationId}
                    >
                      <div className="notification-item-head">
                        <strong>{notification.title || "-"}</strong>
                        {isUnread && <span className="notification-item-dot" aria-hidden="true" />}
                      </div>
                      <div className="notification-item-time">{formatNotificationDateTime(notification.created_at)}</div>
                      {!driverStartedPayload && !requesterAssignedPayload && (
                        <div className="notification-item-message">{notification.message || "-"}</div>
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
                    </button>
                  );
                  })}
                </div>
                {totalPages > 1 && (
                  <div className="notification-pagination compact">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      &lt;&lt;
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
                    >
                      &gt;&gt;
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="notification-panel-footer">
            <button type="button" className="notification-text-button" onClick={handleMarkAll} disabled={!unreadCount || markingAll}>
              อ่านทั้งหมด
            </button>
            <button
              type="button"
              className="notification-text-button"
              onClick={handleEnablePush}
              disabled={!userId || pushStatus === "enabled" || pushStatus === "unsupported" || pushStatus === "blocked"}
            >
              {pushStatus === "loading" ? "เปิดแจ้งเตือนบนเครื่องนี้" : getPushStatusLabel(pushStatus)}
            </button>
            <button
              type="button"
              className="notification-text-button"
              onClick={() => setIsExpanded((currentValue) => !currentValue)}
              disabled={items.length === 0}
            >
              {isExpanded ? "ย่อรายการ" : "ดูทั้งหมด"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
