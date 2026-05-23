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
  "/api/bookings/approve": "approveBooking",
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
  "/api/resetDriverQueueState": "resetDriverQueueState",
  "/api/resetDriverQueuePointer": "resetDriverQueuePointer",
  "/api/setCurrentDriverQueuePointer": "setCurrentDriverQueuePointer",
  "/api/recommendDriverForBooking": "recommendDriverForBooking",
  "/api/confirmDriverQueueAssignment": "confirmDriverQueueAssignment",
};

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
      data: null,
      message: "Apps Script did not return valid JSON",
      status: res.status,
      preview: text.slice(0, 300),
    };
  }
}

async function forwardSheetGet(action: string) {
  return fetchSheetJson(`${SHEET_API_URL}?action=${encodeURIComponent(action)}`);
}

async function forwardSheetPost(action: string, data: unknown) {
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

export default {
  async fetch(request: Request): Promise<Response> {
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
        return jsonResponse(await forwardSheetGet(action));
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
        return jsonResponse(await forwardSheetPost(action, body));
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
