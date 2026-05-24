/* global firebase */

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

  return self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      url,
    },
  });
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  return showNotificationFromPayload(payload || {});
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

  event.waitUntil(showNotificationFromPayload(payload));
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
