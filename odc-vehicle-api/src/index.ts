const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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
  "/api/reviewDriverCancelRequest": "reviewDriverCancelRequest",
  "/api/bookings/cancel": "cancelBooking",
  "/api/bookings/cancellations/delete": "deleteBookingCancellationHistory",
  "/api/unassign_booking_driver": "unassign_booking_driver",
  "/api/login": "loginUser",
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
};

type Env = {
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
};

type SheetResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
  created_notifications?: WorkerNotification[];
  [key: string]: unknown;
};

type WorkerNotification = {
  target_user_id?: string;
  title?: string;
  message?: string;
  url?: string;
  type?: string;
  booking_id?: string;
};

type PushSubscriptionRecord = {
  subscription_id?: string;
  user_id?: string;
  fcm_token?: string;
  provider?: string;
  status?: string;
  user_agent?: string;
};

const FIREBASE_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const FIREBASE_TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";
const FIREBASE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const textEncoder = new TextEncoder();

let firebaseAccessTokenCache: {
  accessToken: string;
  expiresAt: number;
  cacheKey: string;
} | null = null;

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: corsHeaders,
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

function getDeviceTypeFromUserAgent(userAgent: string) {
  const normalized = String(userAgent || "").trim().toLowerCase();
  if (!normalized) return "unknown";
  if (/(android|iphone|ipad|ipod|mobile|mobi)/.test(normalized)) return "mobile";
  if (/(windows|macintosh|mac os|linux|x11)/.test(normalized)) return "desktop";
  return "unknown";
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

  for (const subscription of subscriptions) {
    const token = String(subscription.fcm_token || "").trim();
    if (!token || seenTokens.has(token)) continue;
    seenTokens.add(token);
    uniqueSubscriptions.push(subscription);
  }

  return uniqueSubscriptions;
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

async function disableFcmToken(fcmToken: string) {
  const response = await forwardSheetPost("disablePushSubscription", {
    fcm_token: fcmToken,
  });

  if (!response.success) {
    throw new Error(response.message || "Unable to disable push subscription");
  }
}

async function sendFcmPush(env: Env, fcmToken: string, notification: WorkerNotification) {
  const projectId = String(env.FIREBASE_PROJECT_ID || "").trim();
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID is not configured");
  }

  const maskedToken = `${fcmToken.slice(0, 10)}...`;
  const accessToken = await getFirebaseAccessToken(env);
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
            title: notification.title || "ODC Vehicle Booking",
            body: notification.message || "",
          },
          data: {
            url: notification.url || "/",
            type: notification.type || "",
            booking_id: notification.booking_id || "",
          },
          webpush: {
            headers: {
              Urgency: "high",
            },
            notification: {
              title: notification.title || "ODC Vehicle Booking",
              body: notification.message || "มีการแจ้งเตือนใหม่",
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              tag: notification.booking_id || notification.type || "odc-notification",
              renotify: true,
              requireInteraction: false,
              data: {
                url: notification.url || "/",
                type: notification.type || "",
                booking_id: notification.booking_id || "",
              },
            },
            fcm_options: {
              link: notification.url || "/",
            },
          },
        },
      }),
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.warn("[push] send fail", {
      token: maskedToken,
      type: notification.type || "",
      booking_id: notification.booking_id || "",
      status: response.status,
    });
    console.warn("[push] firebase response status", {
      status: response.status,
      token: maskedToken,
      type: notification.type || "",
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

  return payload;
}

async function sendPushNotificationBatch(
  env: Env,
  userId: string,
  notification: WorkerNotification,
  options?: { logPrefix?: string }
) {
  const targetUserId = String(userId || "").trim();
  const logPrefix = String(options?.logPrefix || "[push]").trim() || "[push]";

  if (!targetUserId) {
    return {
      target_user_id: "",
      subscription_count: 0,
      token_count: 0,
      success_count: 0,
      failure_count: 0,
      user_agents: [] as string[],
      device_types: [] as string[],
      error_codes: [] as string[],
      results: [],
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

  const activeSubscriptions = normalizeFcmSubscriptions(subscriptions);
  const uniqueSubscriptions = dedupeFcmSubscriptionsByToken(activeSubscriptions);
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
  });
  console.log(`${logPrefix} subscription count per user_id`, {
    user_id: targetUserId,
    subscription_count: activeSubscriptions.length,
    token_count: uniqueSubscriptions.length,
    type: notification.type || "",
    booking_id: notification.booking_id || "",
  });
  console.log(`${logPrefix} target user_id list`, [targetUserId]);
  console.log(`${logPrefix} subscription metadata`, {
    user_id: targetUserId,
    user_agents: userAgents,
    device_types: deviceTypes,
  });

  const results: Array<{
    token: string;
    user_agent: string;
    device_type: string;
    success: boolean;
    status?: number;
    error_codes?: string[];
    invalid_token?: boolean;
  }> = [];

  for (const subscription of uniqueSubscriptions) {
    const token = String(subscription.fcm_token || "").trim();
    const userAgent = String(subscription.user_agent || "").trim();
    const deviceType = getDeviceTypeFromUserAgent(userAgent);
    const maskedToken = `${token.slice(0, 10)}...`;

    console.log(`${logPrefix} send token`, {
      user_id: targetUserId,
      token: maskedToken,
      user_agent: userAgent,
      device_type: deviceType,
      type: notification.type || "",
      booking_id: notification.booking_id || "",
    });

    try {
      await sendFcmPush(env, token, notification);
      console.log(`${logPrefix} send success`, {
        user_id: targetUserId,
        token: maskedToken,
        user_agent: userAgent,
        device_type: deviceType,
        type: notification.type || "",
        booking_id: notification.booking_id || "",
      });
      results.push({
        token: maskedToken,
        user_agent: userAgent,
        device_type: deviceType,
        success: true,
      });
    } catch (error) {
      const status = Number((error as { status?: number })?.status || 0);
      const payload = (error as { payload?: unknown })?.payload;
      const invalidToken = isInvalidFcmTokenResponse(status, payload);
      const errorCodes = extractFcmErrorCodes(payload);

      console.warn(`${logPrefix} send fail`, {
        user_id: targetUserId,
        token: maskedToken,
        user_agent: userAgent,
        device_type: deviceType,
        type: notification.type || "",
        booking_id: notification.booking_id || "",
        invalid_token: invalidToken,
        firebase_status: status,
        error_codes: errorCodes,
        error: error instanceof Error ? error.message : String(error),
      });

      if (invalidToken) {
        try {
          console.warn(`${logPrefix} disabling invalid token`, maskedToken);
          await disableFcmToken(token);
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

      results.push({
        token: maskedToken,
        user_agent: userAgent,
        device_type: deviceType,
        success: false,
        status,
        error_codes: errorCodes,
        invalid_token: invalidToken,
      });
    }
  }

  const successCount = results.filter((result) => result.success).length;
  const failureCount = results.length - successCount;
  const errorCodes = Array.from(new Set(results.flatMap((result) => result.error_codes || [])));

  return {
    target_user_id: targetUserId,
    subscription_count: activeSubscriptions.length,
    token_count: uniqueSubscriptions.length,
    success_count: successCount,
    failure_count: failureCount,
    user_agents: userAgents,
    device_types: deviceTypes,
    error_codes: errorCodes,
    results,
  };
}

async function deliverNotificationPushes(env: Env, notifications: WorkerNotification[]) {
  const targetUserIds = Array.from(
    new Set(
      (notifications || [])
        .map((notification) => String(notification?.target_user_id || "").trim())
        .filter(Boolean)
    )
  );

  console.log("[push] target user_id list", targetUserIds);

  for (const notification of notifications) {
    const targetUserId = String(notification?.target_user_id || "").trim();
    if (!targetUserId) continue;

    console.log("[push] dispatch notification", {
      target_user_id: targetUserId,
      type: notification.type || "",
      booking_id: notification.booking_id || "",
    });

    try {
      await sendPushNotificationBatch(env, targetUserId, notification, { logPrefix: "[push]" });
    } catch (error) {
      console.warn("[push] dispatch failed", {
        user_id: targetUserId,
        type: notification.type || "",
        booking_id: notification.booking_id || "",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function maybeDeliverCreatedNotifications(env: Env, response: SheetResponse) {
  console.log(
    "[push] created_notifications:",
    response.created_notifications?.length || 0
  );

  if (!Array.isArray(response.created_notifications) || response.created_notifications.length === 0) {
    return;
  }

  await deliverNotificationPushes(env, response.created_notifications);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (url.pathname === "/api/health") {
      return jsonResponse({
        success: true,
        data: {
          time: new Date().toISOString(),
        },
        message: "ODC Vehicle Booking API Running",
      });
    }

    if (request.method === "GET") {
      const action = getRouteActions[url.pathname];
      if (action) {
        return jsonResponse(await forwardSheetGet(action, url.searchParams));
      }
    }

    if (request.method === "POST") {
      const body = await readRequestBody(request);

      if (url.pathname === "/api/thai_holidays") {
        const requestedAction = String(body?.action || "thai_holidays").trim();
        const action = requestedAction === "getThaiHolidays" ? "getThaiHolidays" : "thai_holidays";
        return jsonResponse(await forwardSheetPost(action, body?.data || body || {}));
      }

      const action = postRouteActions[url.pathname];
      if (action) {
        const response = await forwardSheetPost(action, body);
        await maybeDeliverCreatedNotifications(env, response);
        return jsonResponse(response);
      }
    }

    return jsonResponse(
      {
        success: false,
        data: null,
        message: "API Not Found",
        path: url.pathname,
      },
      404
    );
  },
};
