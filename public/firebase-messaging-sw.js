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

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || "แจ้งเตือน";
  const body = payload?.notification?.body || "";
  const url = payload?.fcmOptions?.link || payload?.data?.url || "/";

  self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    data: {
      url,
      payload,
    },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const notificationUrl = event.notification?.data?.url || "/";
  const targetUrl = new URL(notificationUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (!("focus" in client)) continue;

        if (client.url === targetUrl && "navigate" in client) {
          return client.focus();
        }

        if (client.url.startsWith(self.location.origin) && "navigate" in client) {
          return client.navigate(targetUrl).then(() => client.focus());
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
