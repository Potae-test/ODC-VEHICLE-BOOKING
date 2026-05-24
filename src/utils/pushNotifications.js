import { getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "../firebase";

const FCM_SERVICE_WORKER_PATH = "/firebase-messaging-sw.js";
const FCM_VAPID_KEY = String(
  import.meta.env.VITE_FIREBASE_VAPID_KEY ||
    "BPpPeIzc5st3eP-_CHOKS9wenNrMuvwe1wuXGppeECxdxo4lruVNDq_r4U5KmUaVzTNwqfZDj76KY9P1ZnLMKSo"
).trim();

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return "denied";
  }

  return Notification.requestPermission();
}

async function registerFirebaseMessagingServiceWorker() {
  if (!isPushSupported()) {
    throw new Error("Push notifications are not supported");
  }

  return navigator.serviceWorker.register(FCM_SERVICE_WORKER_PATH);
}

export async function requestFcmToken() {
  if (!FCM_VAPID_KEY) {
    throw new Error("Firebase VAPID key is required");
  }

  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    throw new Error("Firebase messaging is not supported");
  }

  const serviceWorkerRegistration = await registerFirebaseMessagingServiceWorker();
  const token = await getToken(messaging, {
    vapidKey: FCM_VAPID_KEY,
    serviceWorkerRegistration,
  });

  return String(token || "").trim();
}

export async function listenForegroundMessages(onPayload) {
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    return () => {};
  }

  return onMessage(messaging, (payload) => {
    const title = payload?.notification?.title || "แจ้งเตือน";
    const body = payload?.notification?.body || "";
    const url = payload?.fcmOptions?.link || payload?.data?.url || "/";

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const browserNotification = new Notification(title, {
        body,
        icon: "/icon-192.png",
        data: { url, payload },
      });

      browserNotification.onclick = () => {
        window.focus();
        if (url) {
          window.location.assign(url);
        }
      };
    }

    if (typeof onPayload === "function") {
      onPayload(payload);
    }
  });
}
