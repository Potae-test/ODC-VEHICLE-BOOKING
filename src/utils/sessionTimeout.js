const SESSION_TIMEOUT = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

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
    localStorage.removeItem("odc_user");
    alert("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
    window.location.reload();
  };

  const resetTimer = () => {
    if (!isActive) return;

    clearExistingTimer();
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
