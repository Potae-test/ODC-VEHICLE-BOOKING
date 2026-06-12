/* global firebase */

import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const appShellHandler = async ({ event }) => {
  try {
    return await caches.match(event.request, {
      ignoreSearch: true,
    }) || (await fetch(event.request));
  } catch (error) {
    return caches.match("/offline.html", { ignoreSearch: true });
  }
};

registerRoute(new NavigationRoute(appShellHandler));

importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAOHfDqaKd8eEbbZYD46AkfBSYuQNfWkac",
  authDomain: "odc-vehicle-booking.firebaseapp.com",
  projectId: "odc-vehicle-booking",
  storageBucket: "odc-vehicle-booking.firebasestorage.app",
  messagingSenderId: "8284603152",
  appId: "1:8284603152:web:7dcd50e4da713f81821b95",
});

const messaging = firebase.messaging();

function getClientReceivedAt() {
  return new Date().toISOString();
}

function extractPushFields(payload) {
  const title =
    payload?.notification?.title ||
    payload?.data?.title ||
    payload?.title ||
    "ODC Vehicle Booking";
  const body =
    payload?.notification?.body ||
    payload?.data?.body ||
    payload?.body ||
    "มีการแจ้งเตือนใหม่";
  const url =
    payload?.fcmOptions?.link ||
    payload?.data?.url ||
    payload?.url ||
    "/";
  const category = payload?.data?.category || payload?.category || "";
  const type = payload?.data?.type || payload?.type || "";
  const bookingId = payload?.data?.booking_id || payload?.booking_id || "";
  const notificationId = payload?.data?.notification_id || payload?.notification_id || "";
  const tag = payload?.notification?.tag || payload?.tag || "";

  return {
    title,
    body,
    url,
    category,
    type,
    booking_id: bookingId,
    notification_id: notificationId,
    tag,
  };
}

function isFcmPushPayload(payload) {
  return Boolean(
    payload?.from ||
    payload?.fcmOptions ||
    payload?.notification ||
    payload?.data?.provider === "FCM" ||
    payload?.data?.fcm_token
  );
}

function showNotificationFromPayload(payload) {
  const fields = extractPushFields(payload);
  const dedupeWindowMs = 30 * 1000;
  const dedupeStore =
    self.__odcRecentNotificationMap instanceof Map
      ? self.__odcRecentNotificationMap
      : new Map();
  const now = Date.now();
  const contentKey = [fields.title, fields.body, fields.url].join("|");
  const dedupeKeys = [
    fields.notification_id ? `notification_id:${fields.notification_id}` : "",
    contentKey ? `content:${contentKey}` : "",
  ].filter(Boolean);

  self.__odcRecentNotificationMap = dedupeStore;

  dedupeStore.forEach((timestamp, key) => {
    if (now - Number(timestamp || 0) > dedupeWindowMs) {
      dedupeStore.delete(key);
    }
  });

  const duplicateKey = dedupeKeys.find((key) => now - Number(dedupeStore.get(key) || 0) <= dedupeWindowMs);
  if (duplicateKey) {
    console.log("[push] skip duplicate notification", {
      duplicate_key: duplicateKey,
      notification_id: fields.notification_id,
      url: fields.url,
    });
    return Promise.resolve();
  }

  dedupeKeys.forEach((key) => {
    dedupeStore.set(key, now);
  });

  const notificationData = {
    url: fields.url,
    category: fields.category,
    type: fields.type,
    booking_id: fields.booking_id,
    notification_id: fields.notification_id,
  };

  return self.registration.showNotification(fields.title, {
    body: fields.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: fields.notification_id || fields.tag || fields.booking_id || fields.type || "odc-notification",
    renotify: true,
    requireInteraction: false,
    data: notificationData,
  });
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  const clientReceivedAt = getClientReceivedAt();
  console.log("[push] background payload received", {
    type: payload?.data?.type || "",
    booking_id: payload?.data?.booking_id || "",
    client_received_at: clientReceivedAt,
  });
  return showNotificationFromPayload(payload || {})
    .then(() => {
      console.log("[push] background showNotification success", {
        type: payload?.data?.type || "",
        booking_id: payload?.data?.booking_id || "",
        client_received_at: clientReceivedAt,
      });
    })
    .catch((error) => {
      console.warn("[push] background showNotification fail", {
        type: payload?.data?.type || "",
        booking_id: payload?.data?.booking_id || "",
        client_received_at: clientReceivedAt,
        error,
      });
    });
});

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    payload = {
      title: "ODC Vehicle Booking",
      body: event.data ? event.data.text() : "มีการแจ้งเตือนใหม่",
      url: "/",
    };
  }

  const clientReceivedAt = getClientReceivedAt();
  console.log("[push] push event received", {
    type: payload?.data?.type || payload?.type || "",
    booking_id: payload?.data?.booking_id || payload?.booking_id || "",
    client_received_at: clientReceivedAt,
  });

  if (isFcmPushPayload(payload)) {
    console.log("[push] skip FCM payload in generic push handler", {
      type: payload?.data?.type || payload?.type || "",
      booking_id: payload?.data?.booking_id || payload?.booking_id || "",
      client_received_at: clientReceivedAt,
    });
    return;
  }

  event.waitUntil(
    showNotificationFromPayload(payload)
      .then(() => {
        console.log("[push] push event showNotification success", {
          type: payload?.data?.type || payload?.type || "",
          booking_id: payload?.data?.booking_id || payload?.booking_id || "",
          client_received_at: clientReceivedAt,
        });
      })
      .catch((error) => {
        console.warn("[push] push event showNotification fail", {
          type: payload?.data?.type || payload?.type || "",
          booking_id: payload?.data?.booking_id || payload?.booking_id || "",
          client_received_at: clientReceivedAt,
          error,
        });
      })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) {
            return client.navigate(url);
          }
          return undefined;
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url);
      }

      return undefined;
    })
  );
});
