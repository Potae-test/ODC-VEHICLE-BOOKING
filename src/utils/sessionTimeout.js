const SESSION_STORAGE_KEY = "odc_user";
const SESSION_EXPIRES_AT_STORAGE_KEY = "odc_session_expires_at";
const DEFAULT_SESSION_TIMEOUT_MINUTES = 30;
const configuredSessionTimeoutMinutes = Number(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES);
const SESSION_TIMEOUT =
  Number.isFinite(configuredSessionTimeoutMinutes) && configuredSessionTimeoutMinutes > 0
    ? configuredSessionTimeoutMinutes * 60 * 1000
    : DEFAULT_SESSION_TIMEOUT_MINUTES * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

function getNextSessionExpiryTimestamp(now = Date.now()) {
  return new Date(now + SESSION_TIMEOUT).toISOString();
}

export function clearStoredSession() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(SESSION_EXPIRES_AT_STORAGE_KEY);
}

export function touchStoredSessionExpiry(now = Date.now()) {
  if (typeof window === "undefined") {
    return "";
  }

  const expiresAt = getNextSessionExpiryTimestamp(now);
  localStorage.setItem(SESSION_EXPIRES_AT_STORAGE_KEY, expiresAt);
  return expiresAt;
}

export function persistStoredSessionUser(user, now = Date.now()) {
  if (typeof window === "undefined") {
    return "";
  }

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
  return touchStoredSessionExpiry(now);
}

export function readStoredSessionUser(now = Date.now()) {
  if (typeof window === "undefined") {
    return null;
  }

  const savedUser = localStorage.getItem(SESSION_STORAGE_KEY);
  const savedExpiry = localStorage.getItem(SESSION_EXPIRES_AT_STORAGE_KEY);

  if (!savedUser || !savedExpiry) {
    clearStoredSession();
    return null;
  }

  const expiresAt = new Date(savedExpiry).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    clearStoredSession();
    return null;
  }

  try {
    return JSON.parse(savedUser);
  } catch {
    clearStoredSession();
    return null;
  }
}

export function startSessionTimeout() {
  if (typeof window === "undefined") {
    return () => {};
  }

  let timeoutId = null;
  let isActive = true;

  const clearExistingTimer = () => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const handleTimeout = () => {
    if (!isActive) return;

    clearExistingTimer();
    clearStoredSession();
    alert("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
    window.location.reload();
  };

  const resetTimer = () => {
    if (!isActive) return;

    clearExistingTimer();
    touchStoredSessionExpiry();
    timeoutId = window.setTimeout(handleTimeout, SESSION_TIMEOUT);
  };

  ACTIVITY_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, resetTimer, { passive: true });
  });

  resetTimer();

  return () => {
    isActive = false;
    clearExistingTimer();
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.removeEventListener(eventName, resetTimer, { passive: true });
    });
  };
}

export { SESSION_TIMEOUT };
