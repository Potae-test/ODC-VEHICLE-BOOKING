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

function showNotificationFromPayload(payload) {
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
  const notificationData = {
    url,
    payload,
  };

  return self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload?.data?.booking_id || payload?.data?.type || payload?.notification?.tag || "odc-notification",
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
  console.log("[push] background payload received", payload);
  return showNotificationFromPayload(payload || {})
    .then(() => {
      console.log("[push] background showNotification success");
    })
    .catch((error) => {
      console.warn("[push] background showNotification fail", error);
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

  console.log("[push] background payload received", payload);
  event.waitUntil(
    showNotificationFromPayload(payload)
      .then(() => {
        console.log("[push] background showNotification success");
      })
      .catch((error) => {
        console.warn("[push] background showNotification fail", error);
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
