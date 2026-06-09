import { deleteToken, getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "../firebase";

const FCM_SERVICE_WORKER_PATH = "/firebase-messaging-sw.js";
const VAPID_PUBLIC_KEY = String(
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

export function getPushDeviceLabel() {
  if (typeof window === "undefined") {
    return "unknown";
  }

  const userAgent = String(navigator.userAgent || "");
  const platform = String(navigator.platform || "");
  const maxTouchPoints = Number(navigator.maxTouchPoints || 0);
  const isIpadOsDesktop = /Mac/.test(platform) && maxTouchPoints > 1;

  if (/iPhone|iPad|iPod/.test(userAgent) || isIpadOsDesktop) return "iOS";
  if (/Android/i.test(userAgent)) return "Android";
  return "Desktop";
}

function isStandaloneDisplayMode() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

function isSafariWebKitBrowser() {
  const userAgent = String(navigator.userAgent || "");
  const vendor = String(navigator.vendor || "");
  const hasWebKit = /AppleWebKit/i.test(userAgent);
  const isAppleVendor = /Apple/i.test(vendor);
  const isOtherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|YaBrowser/i.test(userAgent);
  return hasWebKit && isAppleVendor && !isOtherIosBrowser;
}

export function shouldUseStandardWebPush() {
  return (
    isPushSupported() &&
    "PushManager" in window &&
    getPushDeviceLabel() === "iOS" &&
    isStandaloneDisplayMode() &&
    isSafariWebKitBrowser()
  );
}

export function getPreferredPushProvider() {
  return shouldUseStandardWebPush() ? "WEB_PUSH" : "FCM";
}

function base64UrlToUint8Array(value) {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=").replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function getServiceWorkerScriptUrl(worker) {
  return String(worker?.scriptURL || "").trim();
}

function isFirebaseMessagingServiceWorkerScriptUrl(scriptUrl) {
  if (!scriptUrl) return false;

  try {
    return new URL(scriptUrl, window.location.origin).pathname.endsWith(FCM_SERVICE_WORKER_PATH);
  } catch {
    return String(scriptUrl).trim().endsWith(FCM_SERVICE_WORKER_PATH);
  }
}

function getRegistrationScriptUrl(registration) {
  return (
    getServiceWorkerScriptUrl(registration?.active) ||
    getServiceWorkerScriptUrl(registration?.waiting) ||
    getServiceWorkerScriptUrl(registration?.installing)
  );
}

function isFirebaseMessagingRegistration(registration) {
  return isFirebaseMessagingServiceWorkerScriptUrl(getRegistrationScriptUrl(registration));
}

function waitForServiceWorkerActivation(registration) {
  const activeWorker = registration?.active;
  if (activeWorker && isFirebaseMessagingServiceWorkerScriptUrl(activeWorker.scriptURL)) {
    return Promise.resolve(registration);
  }

  const pendingWorker = registration?.installing || registration?.waiting;
  if (!pendingWorker) {
    throw new Error("Firebase messaging service worker did not become active");
  }

  return new Promise((resolve, reject) => {
    const handleStateChange = () => {
      if (pendingWorker.state === "activated" && isFirebaseMessagingRegistration(registration)) {
        resolve(registration);
        return;
      }

      if (pendingWorker.state === "redundant") {
        reject(new Error("Firebase messaging service worker became redundant"));
      }
    };

    pendingWorker.addEventListener("statechange", handleStateChange);
    handleStateChange();
  });
}

async function getExistingFirebaseMessagingServiceWorkerRegistration() {
  const scopedRegistration = await navigator.serviceWorker.getRegistration(FCM_SERVICE_WORKER_PATH);
  if (isFirebaseMessagingRegistration(scopedRegistration)) {
    return scopedRegistration;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  return registrations.find((registration) => isFirebaseMessagingRegistration(registration)) || null;
}

export async function ensureFirebaseMessagingServiceWorkerRegistration() {
  if (!isPushSupported()) {
    throw new Error("Push notifications are not supported");
  }

  const existingRegistration = await getExistingFirebaseMessagingServiceWorkerRegistration();
  if (existingRegistration) {
    await navigator.serviceWorker.ready;
    if (isFirebaseMessagingRegistration(existingRegistration)) {
      return existingRegistration;
    }
  }

  const registration = await navigator.serviceWorker.register(FCM_SERVICE_WORKER_PATH);
  await waitForServiceWorkerActivation(registration);
  await navigator.serviceWorker.ready;

  if (!isFirebaseMessagingRegistration(registration)) {
    throw new Error("Active service worker is not firebase-messaging-sw.js");
  }

  return registration;
}

export async function registerWebPushSubscription() {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error("Web Push VAPID public key is required");
  }

  const registration = await ensureFirebaseMessagingServiceWorkerRegistration();
  await navigator.serviceWorker.ready;

  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription =
    existingSubscription ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
    }));

  const json = subscription.toJSON();
  const keys = json?.keys || {};

  return {
    endpoint: String(subscription.endpoint || "").trim(),
    p256dh: String(keys.p256dh || "").trim(),
    auth: String(keys.auth || "").trim(),
    subscription,
    provider: "WEB_PUSH",
  };
}

function buildDebugErrorInfo(error) {
  if (!error) return null;

  return {
    code: String(error?.code || "").trim(),
    message: String(error?.message || error).trim(),
    stack: String(error?.stack || "").trim(),
  };
}

export function formatTokenPreview(token) {
  const value = String(token || "").trim();
  if (!value) return "";
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export async function getPushDebugInfo(options = {}) {
  const provider = getPreferredPushProvider();
  const debugInfo = {
    permission: typeof Notification === "undefined" ? "unsupported" : Notification.permission,
    serviceWorkerScriptUrl: "",
    provider,
    device: getPushDeviceLabel(),
    token: "",
    tokenPreview: "",
    error: null,
  };

  if (!isPushSupported()) {
    return debugInfo;
  }

  try {
    const registration =
      (await getExistingFirebaseMessagingServiceWorkerRegistration()) || (await navigator.serviceWorker.ready);
    debugInfo.serviceWorkerScriptUrl = getRegistrationScriptUrl(registration);
  } catch (error) {
    debugInfo.error = buildDebugErrorInfo(error);
    return debugInfo;
  }

  if (!options.requestToken) {
    return debugInfo;
  }

  try {
    if (provider === "WEB_PUSH") {
      const subscription = await registerWebPushSubscription();
      debugInfo.token = subscription.endpoint;
      debugInfo.tokenPreview = formatTokenPreview(subscription.endpoint);
    } else {
      const token = await requestFcmToken();
      debugInfo.token = token;
      debugInfo.tokenPreview = formatTokenPreview(token);
    }
  } catch (error) {
    debugInfo.error = buildDebugErrorInfo(error);
  }

  return debugInfo;
}

export async function recoverFirebaseMessagingRegistration() {
  const result = {
    deletedToken: false,
    unregistered: false,
    reloadRequested: false,
    error: null,
  };

  try {
    const messaging = await getFirebaseMessaging();
    if (messaging) {
      result.deletedToken = await deleteToken(messaging);
    }
  } catch (error) {
    result.error = buildDebugErrorInfo(error);
  }

  try {
    const registration = await getExistingFirebaseMessagingServiceWorkerRegistration();
    if (registration) {
      result.unregistered = await registration.unregister();
    }
  } catch (error) {
    result.error = result.error || buildDebugErrorInfo(error);
  }

  result.reloadRequested = true;
  window.location.reload();
  return result;
}

export async function requestFcmToken() {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error("Firebase VAPID key is required");
  }

  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    throw new Error("Firebase messaging is not supported");
  }

  const serviceWorkerRegistration = await ensureFirebaseMessagingServiceWorkerRegistration();
  await navigator.serviceWorker.ready;

  const activeScriptUrl = getRegistrationScriptUrl(serviceWorkerRegistration);
  if (!isFirebaseMessagingServiceWorkerScriptUrl(activeScriptUrl)) {
    throw new Error("Active service worker is not firebase-messaging-sw.js");
  }

  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration,
    });
    return String(token || "").trim();
  } catch (error) {
    console.error("[push] getToken failed", {
      code: String(error?.code || "").trim(),
      message: String(error?.message || error).trim(),
      stack: String(error?.stack || "").trim(),
    });
    throw error;
  }
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
    const payloadData = {
      url,
      payload,
    };

    console.log("[push] foreground payload received", payload);

    const showFallbackNotification = () => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") {
        return;
      }

      try {
        const browserNotification = new Notification(title, {
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          data: payloadData,
        });

        browserNotification.onclick = () => {
          window.focus();
          if (url) {
            window.location.assign(url);
          }
        };

        console.log("[push] foreground fallback notification success");
      } catch (error) {
        console.warn("[push] foreground fallback notification fail", error);
      }
    };

    const showServiceWorkerNotification = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        try {
          await registration.showNotification(title, {
            body,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            data: payloadData,
          });
          console.log("[push] foreground showNotification success");
        } catch (error) {
          console.warn("[push] foreground showNotification fail", error);
        }
      } catch (error) {
        console.warn("[push] foreground serviceWorker.ready fail", error);
        showFallbackNotification();
      }
    };

    void showServiceWorkerNotification();

    if (typeof onPayload === "function") {
      onPayload(payload);
    }
  });
}
