import { buildPushHTTPRequest } from "@pushforge/builder";

const ALLOWED_ORIGINS = new Set([
  "https://main.odc-vehicle-booking.pages.dev",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8787",
  "http://127.0.0.1:8787",
]);

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://main.odc-vehicle-booking.pages.dev";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Token",
    Vary: "Origin",
  };
}

const SHEET_API_URL =
  "https://script.google.com/macros/s/AKfycbwqsGXCt7Ac0p92IFYFWndE8PY_-u1rmo8J7f7mMihYMKkVAub8jAOlbpLMCy0hah3A/exec";

const getRouteActions: Record<string, string> = {
  "/api/vehicles": "vehicles",
  "/api/bookings": "bookings",
  "/api/notifications": "getNotifications",
  "/api/bookings/cancellations": "bookingCancellations",
  "/api/thai_holidays": "thai_holidays",
  "/api/getDriverUnavailable": "getDriverUnavailable",
  "/api/getDriverUnavailableLogs": "getDriverUnavailableLogs",
  "/api/getDriverQueue": "getDriverQueue",
  "/api/getDriverQueueState": "getDriverQueueState",
  "/api/getDriverQueueLogs": "getDriverQueueLogs",
  "/api/driver-job-logs": "driver_job_logs",
  "/api/driver_job_logs": "driver_job_logs",
  "/api/drivers": "drivers",
  "/api/users": "users",
};

const postRouteActions: Record<string, string> = {
  "/api/vehicles": "createVehicle",
  "/api/vehicles/update": "updateVehicle",
  "/api/vehicles/delete": "deleteVehicle",
  "/api/bookings": "createBooking",
  "/api/notifications": "createNotification",
  "/api/notifications/read": "markNotificationRead",
  "/api/notifications/read-all": "markAllNotificationsRead",
  "/api/bookings/approve": "approveBooking",
  "/api/bookings/assign-central-vehicle": "assignCentralVehicle",
  "/api/bookings/start-trip": "startTrip",
  "/api/bookings/complete-trip": "completeTrip",
  "/api/backdate_complete_booking": "backdate_complete_booking",
  "/api/bookings/driver-cancel-job": "driverCancelJob",
  "/api/requestDriverCancelJob": "requestDriverCancelJob",
  "/api/withdrawDriverCancelRequest": "withdrawDriverCancelRequest",
  "/api/reviewDriverCancelRequest": "reviewDriverCancelRequest",
  "/api/bookings/cancel": "cancelBooking",
  "/api/bookings/cancellations/delete": "deleteBookingCancellationHistory",
  "/api/unassign_booking_driver": "unassign_booking_driver",
  "/api/login": "loginUser",
  "/api/logout-session": "logoutSession",
  "/api/drivers": "createDriver",
  "/api/drivers/status": "updateDriverStatus",
  "/api/drivers/update": "updateDriver",
  "/api/drivers/delete": "deleteDriver",
  "/api/users": "createUser",
  "/api/users/update": "updateUser",
  "/api/users/reset-password": "resetUserPassword",
  "/api/users/disable": "disableUser",
  "/api/users/delete": "deleteUser",
  "/api/bookings/update": "updateBooking",
  "/api/createDriverUnavailable": "createDriverUnavailable",
  "/api/updateDriverUnavailable": "updateDriverUnavailable",
  "/api/cancelDriverUnavailable": "cancelDriverUnavailable",
  "/api/checkDriverUnavailable": "checkDriverUnavailable",
  "/api/updateDriverQueue": "updateDriverQueue",
  "/api/updateDriverQueueMaster": "updateDriverQueueMaster",
  "/api/deleteDriverQueueLog": "deleteDriverQueueLog",
  "/api/resetDriverQueueState": "resetDriverQueueState",
  "/api/resetDriverQueuePointer": "resetDriverQueuePointer",
  "/api/setCurrentDriverQueuePointer": "setCurrentDriverQueuePointer",
  "/api/recommendDriverForBooking": "recommendDriverForBooking",
  "/api/confirmDriverQueueAssignment": "confirmDriverQueueAssignment",
  "/api/push-subscriptions": "savePushSubscription",
  "/api/push-subscriptions/disable": "disablePushSubscription",
  "/api/reminders/run": "runScheduledReminderNotifications",
  "/api/run-scheduled-reminders": "runScheduledReminderNotifications",
};

const protectedPostActions = new Set([
  "createBooking",
  "updateBooking",
  "approveBooking",
  "assignCentralVehicle",
  "backdate_complete_booking",
  "cancelBooking",
  "deleteBookingCancellationHistory",
  "createUser",
  "updateUser",
  "resetUserPassword",
  "disableUser",
  "deleteUser",
  "createDriver",
  "updateDriver",
  "updateDriverStatus",
  "deleteDriver",
  "createVehicle",
  "updateVehicle",
  "deleteVehicle",
  "startTrip",
  "completeTrip",
  "driverCancelJob",
  "requestDriverCancelJob",
  "withdrawDriverCancelRequest",
  "reviewDriverCancelRequest",
  "createDriverUnavailable",
  "updateDriverUnavailable",
  "cancelDriverUnavailable",
  "updateDriverQueue",
  "updateDriverQueueMaster",
  "deleteDriverQueueLog",
  "resetDriverQueueState",
  "resetDriverQueuePointer",
  "setCurrentDriverQueuePointer",
  "confirmDriverQueueAssignment",
  "runScheduledReminderNotifications",
]);

type Env = {
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_SUBJECT?: string;
  REMINDER_RUNNER_SECRET?: string;
};

type SheetResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
  created_notifications?: WorkerNotification[];
  [key: string]: unknown;
};

type WorkerNotification = {
  notification_id?: string;
  target_user_id?: string;
  target_role?: string;
  category?: string;
  title?: string;
  message?: string;
  url?: string;
  type?: string;
  booking_id?: string;
  created_at?: string;
};

type PushSubscriptionRecord = {
  subscription_id?: string;
  user_id?: string;
  endpoint?: string;
  p256dh?: string;
  auth?: string;
  fcm_token?: string;
  provider?: string;
  status?: string;
  user_agent?: string;
  created_at?: string;
};

type PushDeliveryResult = {
  provider: string;
  token_preview: string;
  endpoint_preview: string;
  user_agent: string;
  device_type: string;
  success: boolean;
  status_code?: number;
  error_code?: string;
  error_message?: string;
  invalid_subscription?: boolean;
};

type UserRecord = {
  user_id?: string;
  role?: string;
  status?: string;
};

const FIREBASE_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const FIREBASE_TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";
const FIREBASE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DEFAULT_WEB_PUSH_PUBLIC_KEY =
  "BPpPeIzc5st3eP-_CHOKS9wenNrMuvwe1wuXGppeECxdxo4lruVNDq_r4U5KmUaVzTNwqfZDj76KY9P1ZnLMKSo";
const textEncoder = new TextEncoder();

let firebaseAccessTokenCache: {
  accessToken: string;
  expiresAt: number;
  cacheKey: string;
} | null = null;

function jsonResponse(payload: unknown, request: Request, status = 200) {
  return Response.json(payload, {
    status,
    headers: getCorsHeaders(request),
  });
}

async function fetchSheetJson(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      message: "Apps Script did not return valid JSON",
      raw: text.slice(0, 500),
    };
  }
}

async function forwardSheetGet(action: string, params?: URLSearchParams): Promise<SheetResponse> {
  const query = new URLSearchParams();
  query.set("action", action);

  if (params) {
    params.forEach((value, key) => {
      if (key === "ts") return;
      query.set(key, value);
    });
  }

  return fetchSheetJson(`${SHEET_API_URL}?${query.toString()}`);
}

async function forwardSheetPost(action: string, data: unknown): Promise<SheetResponse> {
  return fetchSheetJson(SHEET_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action,
      data,
    }),
  });
}

async function readRequestBody(request: Request) {
  return (await request.json().catch(() => ({}))) as Record<string, unknown>;
}

function getBearerToken(request: Request): string {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function getReminderRunnerSecretFromRequest(request: Request): string {
  return String(
    request.headers.get("X-Reminder-Runner-Secret") ||
    request.headers.get("x-reminder-runner-secret") ||
    ""
  ).trim();
}

function base64UrlEncode(input: ArrayBuffer | Uint8Array | string) {
  const bytes =
    typeof input === "string"
      ? textEncoder.encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);

  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string) {
  const normalized = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

async function createSignedJwt(env: Env) {
  const clientEmail = String(env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKey = String(env.FIREBASE_PRIVATE_KEY || "").trim();

  if (!clientEmail || !privateKey) {
    throw new Error("Firebase service account credentials are not configured");
  }

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const claims = {
    iss: clientEmail,
    scope: FIREBASE_SCOPE,
    aud: FIREBASE_TOKEN_AUDIENCE,
    iat,
    exp,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const unsignedToken = `${encodedHeader}.${encodedClaims}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    textEncoder.encode(unsignedToken)
  );

  return {
    jwt: `${unsignedToken}.${base64UrlEncode(signature)}`,
    exp,
  };
}

async function getFirebaseAccessToken(env: Env) {
  const projectId = String(env.FIREBASE_PROJECT_ID || "").trim();
  const clientEmail = String(env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKey = String(env.FIREBASE_PRIVATE_KEY || "").trim();
  const cacheKey = `${projectId}:${clientEmail}:${privateKey.slice(0, 24)}`;

  if (
    firebaseAccessTokenCache &&
    firebaseAccessTokenCache.cacheKey === cacheKey &&
    firebaseAccessTokenCache.expiresAt > Date.now() + 60_000
  ) {
    return firebaseAccessTokenCache.accessToken;
  }

  const { jwt, exp } = await createSignedJwt(env);
  const response = await fetch(FIREBASE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Unable to get Firebase access token");
  }

  const expiresAt = Date.now() + Math.max((Number(payload.expires_in || 0) - 60) * 1000, 60_000);
  firebaseAccessTokenCache = {
    accessToken: payload.access_token,
    expiresAt: Math.min(expiresAt, exp * 1000),
    cacheKey,
  };

  return payload.access_token;
}

async function getPushSubscriptionsByUserId(userId: string) {
  const response = await forwardSheetPost("getPushSubscriptionsByUserId", {
    user_id: userId,
  });

  if (!response.success) {
    throw new Error(response.message || "Unable to get push subscriptions");
  }

  return Array.isArray(response.data) ? (response.data as PushSubscriptionRecord[]) : [];
}

async function getUsers() {
  const response = await forwardSheetGet("users");

  if (!response.success) {
    throw new Error(response.message || "Unable to get users");
  }

  return Array.isArray(response.data) ? (response.data as UserRecord[]) : [];
}

async function getActiveUserIdsByRoles(roles: string[]) {
  const normalizedRoles = Array.from(
    new Set(
      (roles || [])
        .map((role) => String(role || "").trim().toUpperCase())
        .filter(Boolean)
    )
  );

  if (normalizedRoles.length === 0) {
    return [] as string[];
  }

  const users = await getUsers();
  return Array.from(
    new Set(
      users
        .filter((user) => String(user.status || "").trim().toUpperCase() === "ACTIVE")
        .filter((user) => normalizedRoles.includes(String(user.role || "").trim().toUpperCase()))
        .map((user) => String(user.user_id || "").trim())
        .filter(Boolean)
    )
  );
}

function getDeviceTypeFromUserAgent(userAgent: string) {
  const normalized = String(userAgent || "").trim().toLowerCase();
  if (!normalized) return "unknown";
  if (/(android|iphone|ipad|ipod|mobile|mobi)/.test(normalized)) return "mobile";
  if (/(windows|macintosh|mac os|linux|x11)/.test(normalized)) return "desktop";
  return "unknown";
}

function previewTarget(value: string, options?: { head?: number; tail?: number }) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  const head = Math.max(1, Number(options?.head || 0) || 12);
  const tail = Math.max(0, Number(options?.tail || 0) || 10);
  if (normalized.length <= head + tail + 3) {
    return normalized;
  }

  return `${normalized.slice(0, head)}...${normalized.slice(-tail)}`;
}

function extractFcmErrorCodes(payload: any) {
  const codes = new Set<string>();
  const topLevelStatus = String(payload?.error?.status || "").trim();
  const topLevelCode = String(payload?.error?.code || "").trim();

  if (topLevelStatus) codes.add(topLevelStatus);
  if (topLevelCode) codes.add(topLevelCode);

  if (Array.isArray(payload?.error?.details)) {
    for (const detail of payload.error.details) {
      const detailCode = String(detail?.errorCode || detail?.status || detail?.code || "").trim();
      if (detailCode) codes.add(detailCode);
    }
  }

  return Array.from(codes);
}

function normalizeFcmSubscriptions(subscriptions: PushSubscriptionRecord[]) {
  return (Array.isArray(subscriptions) ? subscriptions : [])
    .filter((subscription) => String(subscription.provider || "").trim().toUpperCase() === "FCM")
    .filter((subscription) => String(subscription.status || "").trim().toUpperCase() === "ACTIVE")
    .filter((subscription) => String(subscription.fcm_token || "").trim().length > 0);
}

function dedupeFcmSubscriptionsByToken(subscriptions: PushSubscriptionRecord[]) {
  const seenTokens = new Set<string>();
  const uniqueSubscriptions: PushSubscriptionRecord[] = [];
  let duplicateCount = 0;

  for (const subscription of subscriptions) {
    const token = String(subscription.fcm_token || "").trim();
    const dedupeKey = `FCM:${token}`;
    if (!token) continue;
    if (seenTokens.has(dedupeKey)) {
      duplicateCount += 1;
      continue;
    }
    seenTokens.add(dedupeKey);
    uniqueSubscriptions.push(subscription);
  }

  return {
    subscriptions: uniqueSubscriptions,
    duplicate_count: duplicateCount,
  };
}

function isInvalidFcmTokenResponse(status: number, payload: any) {
  const errorStatus = String(payload?.error?.status || "").trim().toUpperCase();
  const errorMessage = String(payload?.error?.message || "").trim().toUpperCase();
  const detailCodes = Array.isArray(payload?.error?.details)
    ? payload.error.details.map((detail: any) => String(detail?.errorCode || detail?.status || "").trim().toUpperCase())
    : [];

  return (
    status === 404 ||
    errorStatus === "UNREGISTERED" ||
    errorStatus === "INVALID_ARGUMENT" ||
    errorMessage.includes("UNREGISTERED") ||
    detailCodes.includes("UNREGISTERED") ||
    detailCodes.includes("INVALID_ARGUMENT")
  );
}

async function disablePushSubscriptionRecord(options: { fcm_token?: string; endpoint?: string }) {
  const response = await forwardSheetPost("disablePushSubscription", {
    fcm_token: String(options?.fcm_token || "").trim(),
    endpoint: String(options?.endpoint || "").trim(),
  });

  if (!response.success) {
    throw new Error(response.message || "Unable to disable push subscription");
  }
}

function decodeBase64Url(value: string) {
  const normalized = String(value || "").trim().replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeBase64UrlBytes(bytes: Uint8Array) {
  return base64UrlEncode(bytes);
}

function extractWebPushErrorMessage(payload: unknown) {
  if (typeof payload === "string") {
    return payload.trim();
  }

  if (payload && typeof payload === "object") {
    const message = (payload as Record<string, unknown>).message;
    if (typeof message === "string") {
      return message.trim();
    }
  }

  return "";
}

function normalizeWebPushPublicKey(env: Env) {
  return String(env.VAPID_PUBLIC_KEY || DEFAULT_WEB_PUSH_PUBLIC_KEY).trim();
}

function previewEnvKey(value: string, length = 12) {
  return String(value || "").trim().slice(0, Math.max(0, length));
}

function isAppleWebPushEndpoint(endpoint: string) {
  try {
    return new URL(endpoint).hostname === "web.push.apple.com";
  } catch {
    return false;
  }
}

function maskWebPushAuthorizationHeader(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  const tokenMatch = normalized.match(/t=([^,\s]+)/);
  const keyMatch = normalized.match(/k=([^,\s]+)/);
  const tokenPreview = tokenMatch ? previewTarget(tokenMatch[1], { head: 12, tail: 8 }) : "";
  const keyPreview = keyMatch ? previewTarget(keyMatch[1], { head: 12, tail: 8 }) : "";

  return `vapid t=${tokenPreview || "[masked]"}, k=${keyPreview || "[masked]"}`;
}

function getMaskedWebPushHeaders(headers: Headers | Record<string, string>) {
  const headerEntries =
    headers instanceof Headers ? Array.from(headers.entries()) : Object.entries(headers || {});

  return Object.fromEntries(
    headerEntries.map(([name, value]) => {
      const normalizedName = String(name || "").trim();
      if (normalizedName.toLowerCase() === "authorization") {
        return [normalizedName, maskWebPushAuthorizationHeader(String(value || ""))];
      }
      return [normalizedName, String(value || "")];
    })
  );
}

function parseWebPushPublicKey(env: Env) {
  const publicKey = normalizeWebPushPublicKey(env);
  const bytes = decodeBase64Url(publicKey);

  if (bytes.length !== 65 || bytes[0] !== 4) {
    throw new Error("VAPID public key must be an uncompressed P-256 key");
  }

  return {
    publicKey,
    x: encodeBase64UrlBytes(bytes.slice(1, 33)),
    y: encodeBase64UrlBytes(bytes.slice(33, 65)),
  };
}

async function getWebPushPrivateJwk(env: Env) {
  const privateKey = String(env.VAPID_PRIVATE_KEY || "").trim();
  if (!privateKey) {
    throw new Error("VAPID_PRIVATE_KEY is not configured");
  }

  if (privateKey.startsWith("{")) {
    return JSON.parse(privateKey) as JsonWebKey;
  }

  if (privateKey.includes("BEGIN PRIVATE KEY")) {
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      pemToArrayBuffer(privateKey),
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      true,
      ["sign"]
    );
    return (await crypto.subtle.exportKey("jwk", cryptoKey)) as JsonWebKey;
  }

  const publicKey = parseWebPushPublicKey(env);
  return {
    kty: "EC",
    crv: "P-256",
    d: privateKey,
    x: publicKey.x,
    y: publicKey.y,
    ext: true,
  } as JsonWebKey;
}

function buildPushMessageContent(notification: WorkerNotification) {
  return {
    title: String(notification.title || "ODC Vehicle Booking").trim() || "ODC Vehicle Booking",
    body: String(notification.message || "").trim(),
    category: String(notification.category || "").trim(),
    url: String(notification.url || "/").trim() || "/",
    type: String(notification.type || "").trim(),
    booking_id: String(notification.booking_id || "").trim(),
    notification_id: String(notification.notification_id || "").trim(),
  };
}

function buildPushTopic(notification: WorkerNotification) {
  const notificationId = String(notification.notification_id || "").trim();
  if (notificationId) return notificationId;

  const bookingId = String(notification.booking_id || "").trim();
  const type = String(notification.type || "").trim();
  return bookingId || type || "odc-notification";
}

function normalizeWebPushSubscriptions(subscriptions: PushSubscriptionRecord[]) {
  return (Array.isArray(subscriptions) ? subscriptions : [])
    .filter((subscription) => String(subscription.provider || "").trim().toUpperCase() === "WEB_PUSH")
    .filter((subscription) => String(subscription.status || "").trim().toUpperCase() === "ACTIVE")
    .filter((subscription) => String(subscription.endpoint || "").trim().length > 0)
    .filter((subscription) => String(subscription.p256dh || "").trim().length > 0)
    .filter((subscription) => String(subscription.auth || "").trim().length > 0);
}

function dedupeWebPushSubscriptionsByEndpoint(subscriptions: PushSubscriptionRecord[]) {
  const seenEndpoints = new Set<string>();
  const uniqueSubscriptions: PushSubscriptionRecord[] = [];
  let duplicateCount = 0;

  for (const subscription of subscriptions) {
    const endpoint = String(subscription.endpoint || "").trim();
    const dedupeKey = `WEB_PUSH:${endpoint}`;
    if (!endpoint) continue;
    if (seenEndpoints.has(dedupeKey)) {
      duplicateCount += 1;
      continue;
    }
    seenEndpoints.add(dedupeKey);
    uniqueSubscriptions.push(subscription);
  }

  return {
    subscriptions: uniqueSubscriptions,
    duplicate_count: duplicateCount,
  };
}

function buildSubscriptionDeliveryKey(subscription: PushSubscriptionRecord, notification: WorkerNotification) {
  const notificationId = String(notification.notification_id || "").trim();
  if (!notificationId) {
    return "";
  }

  const provider = String(subscription.provider || "").trim().toUpperCase() || "FCM";
  const providerTarget =
    provider === "WEB_PUSH"
      ? String(subscription.endpoint || "").trim()
      : String(subscription.fcm_token || "").trim();
  return `${provider}|${providerTarget}|${notificationId}`;
}

async function sendFcmPush(env: Env, fcmToken: string, notification: WorkerNotification) {
  const projectId = String(env.FIREBASE_PROJECT_ID || "").trim();
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID is not configured");
  }

  const maskedToken = `${fcmToken.slice(0, 10)}...`;
  const accessToken = await getFirebaseAccessToken(env);
  const content = buildPushMessageContent(notification);
  const notificationCreatedAt = String(notification.created_at || "").trim();
  const pushSendStartedAt = new Date().toISOString();
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: {
            title: content.title,
            body: content.body,
          },
          data: {
            category: content.category,
            url: content.url,
            type: content.type,
            booking_id: content.booking_id,
            notification_id: content.notification_id,
          },
          android: {
            priority: "high",
          },
          webpush: {
            headers: {
              Urgency: "high",
              TTL: "30",
              Topic: buildPushTopic(notification),
            },
            notification: {
              title: content.title,
              body: content.body || content.title,
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              tag: buildPushTopic(notification),
              renotify: true,
              requireInteraction: false,
              data: {
                category: content.category,
                url: content.url,
                type: content.type,
                booking_id: content.booking_id,
                notification_id: content.notification_id,
              },
            },
            fcm_options: {
              link: content.url,
            },
          },
        },
      }),
    }
  );

  const fcmResponseAt = new Date().toISOString();
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.warn("[push-debug] FCM send failed", {
      token: maskedToken,
      type: notification.type || "",
      booking_id: notification.booking_id || "",
      notification_created_at: notificationCreatedAt,
      push_send_started_at: pushSendStartedAt,
      status: response.status,
      title: content.title,
      message: content.body,
    });
    console.warn("[push] send fail", {
      token: maskedToken,
      type: notification.type || "",
      booking_id: notification.booking_id || "",
      status: response.status,
      notification_created_at: notificationCreatedAt,
      push_send_started_at: pushSendStartedAt,
      fcm_response_at: fcmResponseAt,
    });
    console.warn("[push] firebase response status", {
      status: response.status,
      token: maskedToken,
      type: notification.type || "",
      notification_created_at: notificationCreatedAt,
      push_send_started_at: pushSendStartedAt,
      fcm_response_at: fcmResponseAt,
    });
    const error = new Error(
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : "Firebase push send failed"
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  console.log("[push-debug] FCM send success", {
    token: maskedToken,
    type: notification.type || "",
    booking_id: notification.booking_id || "",
    notification_created_at: notificationCreatedAt,
    push_send_started_at: pushSendStartedAt,
    fcm_response_at: fcmResponseAt,
    title: content.title,
    message: content.body,
  });
  console.log("[push] firebase send ok", {
    token: maskedToken,
    type: notification.type || "",
    booking_id: notification.booking_id || "",
    notification_created_at: notificationCreatedAt,
    push_send_started_at: pushSendStartedAt,
    fcm_response_at: fcmResponseAt,
  });

  return payload;
}

function isInvalidWebPushResponse(status: number) {
  return status === 404 || status === 410;
}

async function sendWebPush(env: Env, subscription: PushSubscriptionRecord, notification: WorkerNotification) {
  const endpoint = String(subscription.endpoint || "").trim();
  if (!endpoint) {
    throw new Error("WEB_PUSH endpoint is required");
  }
  const p256dh = String(subscription.p256dh || "").trim();
  const auth = String(subscription.auth || "").trim();
  if (!p256dh || !auth) {
    throw new Error("WEB_PUSH subscription keys are required");
  }

  const notificationCreatedAt = String(notification.created_at || "").trim();
  const pushSendStartedAt = new Date().toISOString();
  const content = buildPushMessageContent(notification);
  const topic = buildPushTopic(notification);
  const isAppleEndpoint = isAppleWebPushEndpoint(endpoint);
  const privateJWK = await getWebPushPrivateJwk(env);
  const subject = String(env.VAPID_SUBJECT || "mailto:admin@example.com").trim();
  const { endpoint: targetEndpoint, headers, body } = await buildPushHTTPRequest({
    privateJWK,
    subscription: {
      endpoint,
      keys: {
        p256dh,
        auth,
      },
    },
    message: {
      payload: {
        title: content.title,
        body: content.body || content.title,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: content.notification_id || topic,
        renotify: true,
        requireInteraction: false,
        data: {
          category: content.category,
          url: content.url,
          type: content.type,
          booking_id: content.booking_id,
          notification_id: content.notification_id,
        },
      },
      adminContact: subject,
      options: {
        ttl: 30,
        urgency: "high",
        ...(isAppleEndpoint ? {} : { topic }),
      },
    },
  });
  const maskedHeaders = getMaskedWebPushHeaders(headers);
  console.log("[push] web push request headers", {
    endpoint,
    target_endpoint: targetEndpoint,
    is_apple_web_push: isAppleEndpoint,
    topic_header_sent: Object.prototype.hasOwnProperty.call(maskedHeaders, "Topic"),
    headers: maskedHeaders,
    notification_id: content.notification_id,
    type: content.type,
    booking_id: content.booking_id,
    notification_created_at: notificationCreatedAt,
    push_send_started_at: pushSendStartedAt,
  });
  const response = await fetch(targetEndpoint, {
    method: "POST",
    headers,
    body,
  });

  const fcmResponseAt = new Date().toISOString();
  if (!response.ok) {
    const payloadText = await response.text().catch(() => "");
    console.warn("[push-debug] WebPush send failed", {
      endpoint: previewTarget(endpoint, { head: 42, tail: 14 }),
      type: notification.type || "",
      booking_id: notification.booking_id || "",
      notification_created_at: notificationCreatedAt,
      push_send_started_at: pushSendStartedAt,
      status: response.status,
      title: content.title,
      message: content.body,
    });
    const error = new Error(`Web Push send failed with status ${response.status}`) as Error & {
      status?: number;
      code?: string;
      payload?: unknown;
    };
    error.status = response.status;
    error.code = `HTTP_${response.status}`;
    error.payload = payloadText;
    console.warn("[push] web push send fail", {
      endpoint,
      target_endpoint: targetEndpoint,
      is_apple_web_push: isAppleEndpoint,
      topic_header_sent: Object.prototype.hasOwnProperty.call(maskedHeaders, "Topic"),
      request_headers: maskedHeaders,
      type: content.type,
      booking_id: content.booking_id,
      status: response.status,
      response_body: payloadText.slice(0, 300),
      notification_created_at: notificationCreatedAt,
      push_send_started_at: pushSendStartedAt,
      fcm_response_at: fcmResponseAt,
    });
    throw error;
  }

  console.log("[push-debug] WebPush send success", {
    endpoint: previewTarget(endpoint, { head: 42, tail: 14 }),
    type: notification.type || "",
    booking_id: notification.booking_id || "",
    notification_created_at: notificationCreatedAt,
    push_send_started_at: pushSendStartedAt,
    fcm_response_at: fcmResponseAt,
    title: content.title,
    message: content.body,
  });
  console.log("[push] web push send ok", {
    endpoint,
    target_endpoint: targetEndpoint,
    is_apple_web_push: isAppleEndpoint,
    topic_header_sent: Object.prototype.hasOwnProperty.call(maskedHeaders, "Topic"),
    request_headers: maskedHeaders,
    type: content.type,
    booking_id: content.booking_id,
    notification_created_at: notificationCreatedAt,
    push_send_started_at: pushSendStartedAt,
    fcm_response_at: fcmResponseAt,
  });
}

async function sendPushNotificationBatch(
  env: Env,
  userId: string,
  notification: WorkerNotification,
  options?: { logPrefix?: string; sentNotificationKeys?: Set<string> }
) {
  const targetUserId = String(userId || "").trim();
  const logPrefix = String(options?.logPrefix || "[push]").trim() || "[push]";

  if (!targetUserId) {
    return {
      target_user_id: "",
      subscription_count: 0,
      fcm_count: 0,
      web_push_count: 0,
      total_subscription_count: 0,
      token_count: 0,
      success_count: 0,
      failure_count: 0,
      user_agents: [] as string[],
      device_types: [] as string[],
      error_codes: [] as string[],
      results: [] as PushDeliveryResult[],
    };
  }

  let subscriptions: PushSubscriptionRecord[] = [];
  try {
    subscriptions = await getPushSubscriptionsByUserId(targetUserId);
  } catch (error) {
    console.warn(`${logPrefix} subscription lookup failed`, {
      user_id: targetUserId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const activeFcmSubscriptions = normalizeFcmSubscriptions(subscriptions);
  const uniqueFcmResult = dedupeFcmSubscriptionsByToken(activeFcmSubscriptions);
  const uniqueFcmSubscriptions = uniqueFcmResult.subscriptions;
  const activeWebPushSubscriptions = normalizeWebPushSubscriptions(subscriptions);
  const uniqueWebPushResult = dedupeWebPushSubscriptionsByEndpoint(activeWebPushSubscriptions);
  const uniqueWebPushSubscriptions = uniqueWebPushResult.subscriptions;
  const activeSubscriptions = activeFcmSubscriptions.concat(activeWebPushSubscriptions);
  const subscriptionsBeforeDedupe = activeSubscriptions.length;
  const subscriptionsAfterDedupe = uniqueFcmSubscriptions.length + uniqueWebPushSubscriptions.length;
  const duplicateSubscriptionCount =
    uniqueFcmResult.duplicate_count + uniqueWebPushResult.duplicate_count;
  const userAgents = Array.from(
    new Set(
      activeSubscriptions
        .map((subscription) => String(subscription.user_agent || "").trim())
        .filter(Boolean)
    )
  );
  const deviceTypes = Array.from(
    new Set(
      activeSubscriptions
        .map((subscription) => getDeviceTypeFromUserAgent(subscription.user_agent || ""))
        .filter(Boolean)
    )
  );

  console.log(`${logPrefix} notification type`, {
    user_id: targetUserId,
    type: notification.type || "",
    booking_id: notification.booking_id || "",
    notification_created_at: String(notification.created_at || "").trim(),
  });
  console.log(`${logPrefix} subscription count per user_id`, {
    user_id: targetUserId,
    subscription_count: subscriptionsBeforeDedupe,
    total_subscription_count: subscriptionsAfterDedupe,
    type: notification.type || "",
    booking_id: notification.booking_id || "",
    notification_created_at: String(notification.created_at || "").trim(),
  });
  console.log("[push-debug] subscription count", {
    user_id: targetUserId,
    notification_id: String(notification.notification_id || "").trim(),
    type: notification.type || "",
    booking_id: notification.booking_id || "",
    subscription_count: subscriptionsBeforeDedupe,
    total_subscription_count: subscriptionsAfterDedupe,
    fcm_count: uniqueFcmSubscriptions.length,
    web_push_count: uniqueWebPushSubscriptions.length,
  });
  console.log(`${logPrefix} subscriptions before dedupe`, {
    user_id: targetUserId,
    total: subscriptionsBeforeDedupe,
    fcm: activeFcmSubscriptions.length,
    web_push: activeWebPushSubscriptions.length,
    type: notification.type || "",
    booking_id: notification.booking_id || "",
  });
  console.log(`${logPrefix} subscriptions after dedupe`, {
    user_id: targetUserId,
    total: subscriptionsAfterDedupe,
    fcm: uniqueFcmSubscriptions.length,
    web_push: uniqueWebPushSubscriptions.length,
    skipped_duplicate_count: duplicateSubscriptionCount,
    type: notification.type || "",
    booking_id: notification.booking_id || "",
  });
  console.log(`${logPrefix} provider counts`, {
    user_id: targetUserId,
    fcm: uniqueFcmSubscriptions.length,
    web_push: uniqueWebPushSubscriptions.length,
  });
  console.log(`${logPrefix} target user_id list`, [targetUserId]);
  console.log(`${logPrefix} subscription metadata`, {
    user_id: targetUserId,
    user_agents: userAgents,
    device_types: deviceTypes,
  });

  const results: PushDeliveryResult[] = [];

  const sentNotificationKeys = options?.sentNotificationKeys || null;
  let skippedNotificationDuplicateCount = 0;
  const deliveryQueue = uniqueFcmSubscriptions
    .map((subscription) => ({
      ...subscription,
      send_provider: "FCM",
    }))
    .concat(
      uniqueWebPushSubscriptions.map((subscription) => ({
        ...subscription,
        send_provider: "WEB_PUSH",
      }))
    )
    .filter((subscription) => {
      if (!sentNotificationKeys) {
        return true;
      }

      const deliveryKey = buildSubscriptionDeliveryKey(subscription, notification);
      if (!deliveryKey) {
        return true;
      }
      if (sentNotificationKeys.has(deliveryKey)) {
        skippedNotificationDuplicateCount += 1;
        return false;
      }
      sentNotificationKeys.add(deliveryKey);
      return true;
    });

  if (skippedNotificationDuplicateCount > 0) {
    console.log(`${logPrefix} skipped duplicate notification deliveries`, {
      user_id: targetUserId,
      skipped_duplicate_delivery_count: skippedNotificationDuplicateCount,
      notification_id: String(notification.notification_id || "").trim(),
      type: notification.type || "",
      booking_id: notification.booking_id || "",
    });
  }

  const queuedFcmCount = deliveryQueue.filter(
    (subscription) =>
      String(
        (subscription as PushSubscriptionRecord & { send_provider?: string }).send_provider ||
          subscription.provider ||
          ""
      )
        .trim()
        .toUpperCase() === "FCM"
  ).length;
  const queuedWebPushCount = deliveryQueue.length - queuedFcmCount;

  const settledResults = await Promise.allSettled(
    deliveryQueue.map(async (subscription) => {
      const token = String(subscription.fcm_token || "").trim();
      const endpoint = String(subscription.endpoint || "").trim();
      const userAgent = String(subscription.user_agent || "").trim();
      const deviceType = getDeviceTypeFromUserAgent(userAgent);
      const tokenPreview = previewTarget(token, { head: 10, tail: 8 });
      const endpointPreview = previewTarget(endpoint, { head: 42, tail: 14 });
      const maskedTarget = tokenPreview || endpointPreview;
      const pushSendStartedAt = new Date().toISOString();
      const sendProvider = String(
        (subscription as PushSubscriptionRecord & { send_provider?: string }).send_provider ||
          subscription.provider ||
          ""
      )
        .trim()
        .toUpperCase();

      console.log(`${logPrefix} send token`, {
        user_id: targetUserId,
        provider: sendProvider,
        token: maskedTarget,
        user_agent: userAgent,
        device_type: deviceType,
        type: notification.type || "",
        booking_id: notification.booking_id || "",
        notification_created_at: String(notification.created_at || "").trim(),
        push_send_started_at: pushSendStartedAt,
      });

      try {
        if (sendProvider === "WEB_PUSH") {
          await sendWebPush(env, subscription, notification);
        } else {
          await sendFcmPush(env, token, notification);
        }
        console.log(`${logPrefix} send success`, {
          user_id: targetUserId,
          provider: sendProvider,
          token: maskedTarget,
          user_agent: userAgent,
          device_type: deviceType,
          type: notification.type || "",
          booking_id: notification.booking_id || "",
          notification_created_at: String(notification.created_at || "").trim(),
          push_send_started_at: pushSendStartedAt,
        });
        return {
          provider: sendProvider,
          token_preview: tokenPreview,
          endpoint_preview: endpointPreview,
          user_agent: userAgent,
          device_type: deviceType,
          success: true,
        };
      } catch (error) {
        const status = Number((error as { status?: number })?.status || 0);
        const payload = (error as { payload?: unknown })?.payload;
        const errorCodeFromError = String((error as { code?: string })?.code || "").trim();
        const invalidToken =
          sendProvider === "WEB_PUSH"
            ? isInvalidWebPushResponse(status)
            : isInvalidFcmTokenResponse(status, payload);
        const fcmErrorCodes = extractFcmErrorCodes(payload);
        const errorCode =
          errorCodeFromError ||
          fcmErrorCodes[0] ||
          (sendProvider === "WEB_PUSH" && status ? `HTTP_${status}` : "");
        const errorMessage =
          sendProvider === "WEB_PUSH"
            ? extractWebPushErrorMessage(payload) || (error instanceof Error ? error.message : String(error))
            : error instanceof Error
              ? error.message
              : String(error);

        console.warn(`${logPrefix} send fail`, {
          user_id: targetUserId,
          provider: sendProvider,
          token: maskedTarget,
          user_agent: userAgent,
          device_type: deviceType,
          type: notification.type || "",
          booking_id: notification.booking_id || "",
          invalid_token: invalidToken,
          firebase_status: status,
          error_code: errorCode,
          error_message: errorMessage,
          error: error instanceof Error ? error.message : String(error),
          notification_created_at: String(notification.created_at || "").trim(),
          push_send_started_at: pushSendStartedAt,
          fcm_response_at: new Date().toISOString(),
        });

        if (invalidToken) {
          try {
            console.warn(`${logPrefix} disabling invalid token`, maskedTarget);
            await disablePushSubscriptionRecord(
              sendProvider === "WEB_PUSH"
                ? { endpoint }
                : { fcm_token: token }
            );
            console.info(`${logPrefix} invalid token cleaned`, {
              user_id: targetUserId,
              type: notification.type || "",
            });
          } catch (cleanupError) {
            console.warn(`${logPrefix} invalid token cleanup failed`, {
              user_id: targetUserId,
              error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
            });
          }
        }

        return {
          provider: sendProvider,
          token_preview: tokenPreview,
          endpoint_preview: endpointPreview,
          user_agent: userAgent,
          device_type: deviceType,
          success: false,
          status_code: status || undefined,
          error_code: errorCode || undefined,
          error_message: errorMessage || undefined,
          invalid_subscription: invalidToken,
        };
      }
    })
  );

  for (const settledResult of settledResults) {
    if (settledResult.status === "fulfilled") {
      results.push(settledResult.value);
      continue;
    }

    console.warn(`${logPrefix} unexpected send task rejection`, {
      user_id: targetUserId,
      type: notification.type || "",
      booking_id: notification.booking_id || "",
      error: settledResult.reason instanceof Error ? settledResult.reason.message : String(settledResult.reason),
      notification_created_at: String(notification.created_at || "").trim(),
    });
  }

  const successCount = results.filter((result) => result.success).length;
  const failureCount = results.length - successCount;
  const errorCodes = Array.from(
    new Set(results.map((result) => String(result.error_code || "").trim()).filter(Boolean))
  );

  return {
    target_user_id: targetUserId,
    subscription_count: subscriptionsBeforeDedupe,
    fcm_count: queuedFcmCount,
    web_push_count: queuedWebPushCount,
    total_subscription_count: deliveryQueue.length,
    token_count: deliveryQueue.length,
    success_count: successCount,
    failure_count: failureCount,
    user_agents: userAgents,
    device_types: deviceTypes,
    error_codes: errorCodes,
    results,
  };
}

async function deliverNotificationPushes(env: Env, notifications: WorkerNotification[]) {
  const targetUserIds = new Set<string>();
  const sentNotificationKeys = new Set<string>();
  const deliveries = [];

  console.log("[push-debug] push dispatch started", {
    notification_count: Array.isArray(notifications) ? notifications.length : 0,
  });

  for (const notification of notifications) {
    const targetUserId = String(notification?.target_user_id || "").trim();
    const targetRole = String(notification?.target_role || "").trim().toUpperCase();
    let resolvedTargetUserIds = targetUserId ? [targetUserId] : [];

    if (!targetUserId && targetRole) {
      try {
        resolvedTargetUserIds = await getActiveUserIdsByRoles([targetRole]);
      } catch (error) {
        console.warn("[push] role target resolution failed", {
          target_role: targetRole,
          type: notification.type || "",
          booking_id: notification.booking_id || "",
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    resolvedTargetUserIds = Array.from(
      new Set(
        resolvedTargetUserIds
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      )
    );

    for (const resolvedUserId of resolvedTargetUserIds) {
      targetUserIds.add(resolvedUserId);
    }

    console.log("[push] dispatch notification", {
      target_user_id: targetUserId,
      target_role: targetRole,
      resolved_target_user_ids: resolvedTargetUserIds,
      type: notification.type || "",
      booking_id: notification.booking_id || "",
    });
    console.log("[push-debug] dispatch notification", {
      notification_id: String(notification.notification_id || "").trim(),
      target_user_id: targetUserId,
      target_role: targetRole,
      resolved_target_user_ids: resolvedTargetUserIds,
      type: notification.type || "",
      booking_id: notification.booking_id || "",
      title: String(notification.title || "").trim(),
      message: String(notification.message || "").trim(),
    });

    for (const resolvedUserId of resolvedTargetUserIds) {
      try {
        const delivery = await sendPushNotificationBatch(env, resolvedUserId, notification, {
          logPrefix: "[push]",
          sentNotificationKeys,
        });
        deliveries.push(delivery);
      } catch (error) {
        console.warn("[push] dispatch failed", {
          user_id: resolvedUserId,
          target_role: targetRole,
          type: notification.type || "",
          booking_id: notification.booking_id || "",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  console.log("[push] target user_id list", Array.from(targetUserIds));

  const pushedCount = deliveries.reduce((sum, item) => sum + Number(item?.success_count || 0), 0);
  const pushAttemptCount = deliveries.reduce((sum, item) => sum + Number(item?.total_subscription_count || 0), 0);

  return {
    notification_count: Array.isArray(notifications) ? notifications.length : 0,
    target_user_count: targetUserIds.size,
    push_attempt_count: pushAttemptCount,
    pushed_count: pushedCount,
    deliveries,
  };
}

async function maybeDeliverCreatedNotifications(env: Env, response: SheetResponse) {
  console.log("[push-debug] created notifications received", {
    created_notification_count: response.created_notifications?.length || 0,
  });
  console.log(
    "[push] created_notifications:",
    response.created_notifications?.length || 0
  );

  if (!Array.isArray(response.created_notifications) || response.created_notifications.length === 0) {
    return {
      notification_count: 0,
      target_user_count: 0,
      push_attempt_count: 0,
      pushed_count: 0,
      deliveries: [],
    };
  }

  const pushSummary = await deliverNotificationPushes(env, response.created_notifications);
  console.log("[push-debug] dispatched push count", {
    created_notification_count: response.created_notifications.length,
    pushed_count: pushSummary.pushed_count,
  });
  return pushSummary;
}

async function runScheduledReminderAction(
  env: Env,
  reminderType: string,
  options?: {
    sessionToken?: string;
    runSource?: string;
    createdBy?: string;
    internalRunnerSecret?: string;
  }
) {
  const normalizedReminderType = String(reminderType || "ALL").trim().toUpperCase() || "ALL";
  const reminderRunnerSecret = String(
    options?.internalRunnerSecret || env.REMINDER_RUNNER_SECRET || ""
  ).trim();
  if (!reminderRunnerSecret) {
    throw new Error("REMINDER_RUNNER_SECRET is not configured");
  }

  const payload: Record<string, unknown> = {
    reminder_type: normalizedReminderType,
    run_source: String(options?.runSource || "WORKER_CRON").trim() || "WORKER_CRON",
    created_by: String(options?.createdBy || "WORKER_CRON").trim() || "WORKER_CRON",
    internal_runner_secret: reminderRunnerSecret,
  };

  const response = await forwardSheetPost("runScheduledReminderNotifications", payload);
  const pushSummary = await maybeDeliverCreatedNotifications(env, response);
  const data = (response.data && typeof response.data === "object") ? response.data as Record<string, unknown> : {};
  const summaries = Array.isArray(data.summaries) ? data.summaries as Array<Record<string, unknown>> : [];
  const checkedCount = summaries.reduce((sum, item) => sum + Number(item?.checked_count || 0), 0);
  const eligibleCount = summaries.reduce((sum, item) => sum + Number(item?.eligible_count || 0), 0);
  const createdCount = Number(data.created_count || response.created_notifications?.length || 0);

  return {
    ...response,
    reminder_summary: {
      checked_count: checkedCount,
      eligible_count: eligibleCount,
      created_count: createdCount,
      pushed_count: Number(pushSummary?.pushed_count || 0),
    },
    push_summary: pushSummary,
  };
}

async function handleScheduledReminderRun(request: Request, env: Env) {
  const body = await readRequestBody(request);
  const requestSecret = getReminderRunnerSecretFromRequest(request);
  const configuredSecret = String(env.REMINDER_RUNNER_SECRET || "").trim();
  if (!configuredSecret) {
    return jsonResponse(
      {
        success: false,
        message: "REMINDER_RUNNER_SECRET is not configured",
      },
      request,
      500
    );
  }
  if (!requestSecret || requestSecret !== configuredSecret) {
    return jsonResponse(
      {
        success: false,
        message: "Invalid reminder runner secret",
      },
      request,
      401
    );
  }

  const reminderType = String(body?.reminder_type || body?.type || "ALL").trim().toUpperCase() || "ALL";
  const createdBy = String(body?.created_by || "MANUAL_API").trim() || "MANUAL_API";
  const response = await runScheduledReminderAction(env, reminderType, {
    runSource: "WORKER_API",
    createdBy,
    internalRunnerSecret: configuredSecret,
  });

  return jsonResponse(response, request);
}

function getReminderTypeFromCron(cron: string) {
  const normalizedCron = String(cron || "").trim();
  if (normalizedCron === "0 11 * * *") {
    return "BOOKING_REMINDER_TOMORROW";
  }
  if (normalizedCron === "0 14 * * *") {
    return "BOOKING_OPEN_JOB_DAILY";
  }
  return "ALL";
}

async function handlePushTest(request: Request, env: Env) {
  const body = await readRequestBody(request);
  const userId = String(body.user_id || "").trim();
  const title = String(body.title || "").trim();
  const message = String(body.body || "").trim();

  if (!userId || !title || !message) {
    return jsonResponse(
      {
        success: false,
        message: "user_id, title, and body are required",
      },
      request,
      400
    );
  }

  const delivery = await sendPushNotificationBatch(
    env,
    userId,
    {
      notification_id: crypto.randomUUID(),
      target_user_id: userId,
      title,
      message,
      type: "PUSH_TEST",
      url: "/booking",
    },
    { logPrefix: "[push-test]" }
  );

  return jsonResponse(
    {
      success: true,
      message: "Push test completed",
      data: {
        user_id: userId,
        fcm_count: delivery.fcm_count,
        web_push_count: delivery.web_push_count,
        total_subscription_count: delivery.total_subscription_count,
        token_count: delivery.token_count,
        user_agents: delivery.user_agents,
        success_count: delivery.success_count,
        failure_count: delivery.failure_count,
        error_codes: delivery.error_codes,
        results: delivery.results,
      },
    },
    request
  );
}

function handleWebPushConfigDebug(request: Request, env: Env) {
  const envPublicKey = String(env.VAPID_PUBLIC_KEY || "").trim();
  const normalizedPublicKey = normalizeWebPushPublicKey(env);
  const envPrivateKey = String(env.VAPID_PRIVATE_KEY || "").trim();
  const vapidSubject = String(env.VAPID_SUBJECT || "").trim();

  return jsonResponse(
    {
      success: true,
      data: {
        env_has_public_key: Boolean(envPublicKey),
        env_public_key_prefix: previewEnvKey(envPublicKey),
        normalized_public_key_prefix: previewEnvKey(normalizedPublicKey),
        env_has_private_key: Boolean(envPrivateKey),
        vapid_subject: vapidSubject || null,
      },
    },
    request
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request),
      });
    }

    if (url.pathname === "/api/health") {
      return jsonResponse(
        {
          success: true,
          data: {
            time: new Date().toISOString(),
          },
          message: "ODC Vehicle Booking API Running",
        },
        request
      );
    }

    if (request.method === "GET" && url.pathname === "/debug/webpush-config") {
      return handleWebPushConfigDebug(request, env);
    }

    if (request.method === "GET") {
      const action = getRouteActions[url.pathname];
      if (action) {
        return jsonResponse(await forwardSheetGet(action, url.searchParams), request);
      }
    }

    if (request.method === "POST") {
      if (url.pathname === "/push/test") {
        return handlePushTest(request, env);
      }
      if (url.pathname === "/api/reminders/run" || url.pathname === "/api/run-scheduled-reminders") {
        return handleScheduledReminderRun(request, env);
      }

      const body = await readRequestBody(request);
      const token = getBearerToken(request);

      if (url.pathname === "/api/thai_holidays") {
        const requestedAction = String(body?.action || "thai_holidays").trim();
        const action = requestedAction === "getThaiHolidays" ? "getThaiHolidays" : "thai_holidays";
        return jsonResponse(await forwardSheetPost(action, body?.data || body || {}), request);
      }

      const action = postRouteActions[url.pathname];
      if (action) {
        const rawPayload =
          body &&
          typeof body === "object" &&
          "action" in body &&
          "data" in body
            ? body.data
            : body;
        const responsePayload =
          protectedPostActions.has(action) && rawPayload && typeof rawPayload === "object"
            ? {
                ...(rawPayload as Record<string, unknown>),
                session_token: token,
              }
            : rawPayload;
        const response = await forwardSheetPost(action, responsePayload);
        ctx.waitUntil(
          maybeDeliverCreatedNotifications(env, response).catch((error) => {
            console.warn("[push] async delivery failed", {
              path: url.pathname,
              error: error instanceof Error ? error.message : String(error),
            });
          })
        );
        return jsonResponse(response, request);
      }
    }

    return jsonResponse(
      {
        success: false,
        data: null,
        message: "API Not Found",
        path: url.pathname,
      },
      request,
      404
    );
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const reminderType = getReminderTypeFromCron(controller.cron);

    ctx.waitUntil(
      runScheduledReminderAction(env, reminderType, {
        runSource: "WORKER_CRON",
        createdBy: "WORKER_CRON",
      }).catch((error) => {
        console.warn("[push] scheduled reminder run failed", {
          cron: controller.cron,
          reminder_type: reminderType,
          error: error instanceof Error ? error.message : String(error),
        });
      })
    );
  },
};
