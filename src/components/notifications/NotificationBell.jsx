import { useCallback, useEffect, useRef, useState } from "react";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../../api";

const NOTIFICATION_POLL_INTERVAL_MS = 60000;

const thaiDateTimeFormatter = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatNotificationDateTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${thaiDateTimeFormatter.format(date)} น.`;
}

function getUnreadBadgeLabel(count) {
  if (count > 99) return "99+";
  return String(count);
}

export default function NotificationBell({ currentUser, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeNotificationId, setActiveNotificationId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const rootRef = useRef(null);

  const userId = String(currentUser?.user_id || "").trim();
  const role = String(currentUser?.role || "").trim().toUpperCase();

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

  return (
    <div className="notification-bell" ref={rootRef}>
      <button
        type="button"
        className="notification-bell-trigger"
        onClick={handleOpen}
        aria-label="ศูนย์แจ้งเตือน"
        aria-expanded={isOpen}
      >
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
              <strong>แจ้งเตือน</strong>
              <span>{unreadCount > 0 ? `ยังไม่ได้อ่าน ${unreadCount} รายการ` : "ไม่มีรายการที่ยังไม่ได้อ่าน"}</span>
            </div>
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

            {!loading && items.length > 0 && (
              <div className="notification-list">
                {items.map((notification) => {
                  const notificationId = String(notification.notification_id || "").trim();
                  const isUnread = !notification.is_read;

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
                      <div className="notification-item-message">{notification.message || "-"}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="notification-panel-footer">
            <button type="button" className="notification-text-button" onClick={handleMarkAll} disabled={!unreadCount || markingAll}>
              อ่านทั้งหมด
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
