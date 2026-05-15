const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbwqsGXCt7Ac0p92IFYFWndE8PY_-u1rmo8J7f7mMihYMKkVAub8jAOlbpLMCy0hah3A/exec";

function jsonResponse(data: any, status = 200) {
  return Response.json(data, {
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
      message: "Apps Script ไม่ได้ส่ง JSON กลับมา",
      status: res.status,
      preview: text.slice(0, 300),
    };
  }
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
        message: "ODC Vehicle Booking API Running",
        time: new Date().toISOString(),
      });
    }

    if (url.pathname === "/api/vehicles" && request.method === "GET") {
      const sheetJson = await fetchSheetJson(`${SHEET_API_URL}?action=vehicles`);
      return jsonResponse(sheetJson);
    }

    if (url.pathname === "/api/vehicles" && request.method === "POST") {
      const body = await request.json();

      const sheetJson = await fetchSheetJson(SHEET_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "createVehicle",
          data: body,
        }),
      });

      return jsonResponse(sheetJson);
    }
    if (url.pathname === "/api/bookings" && request.method === "GET") {
      const sheetJson = await fetchSheetJson(`${SHEET_API_URL}?action=bookings`);
      return jsonResponse(sheetJson);
    }

    if (url.pathname === "/api/bookings" && request.method === "POST") {
      const body = await request.json();

      const sheetJson = await fetchSheetJson(SHEET_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "createBooking",
          data: body,
        }),
      });

      return jsonResponse(sheetJson);
    }
    if (url.pathname === "/api/bookings/approve" && request.method === "POST") {
      const body = await request.json();

      const sheetJson = await fetchSheetJson(SHEET_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "approveBooking",
          data: body,
        }),
      });

      return jsonResponse(sheetJson);
    }
    if (url.pathname === "/api/bookings/start-trip" && request.method === "POST") {
      const body = await request.json();

      const sheetJson = await fetchSheetJson(SHEET_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "startTrip",
          data: body,
        }),
      });

      return jsonResponse(sheetJson);
    }

    if (url.pathname === "/api/bookings/complete-trip" && request.method === "POST") {
      const body = await request.json();

      const sheetJson = await fetchSheetJson(SHEET_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "completeTrip",
          data: body,
        }),
      });

      return jsonResponse(sheetJson);
    }
    if (url.pathname === "/api/bookings/driver-cancel-job" && request.method === "POST") {
      const body = await request.json();

      const sheetJson = await fetchSheetJson(SHEET_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "driverCancelJob",
          data: body,
        }),
      });

      return jsonResponse(sheetJson);
    }
    if (url.pathname === "/api/bookings/cancel" && request.method === "POST") {
      const body = await request.json();

      const sheetJson = await fetchSheetJson(SHEET_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "cancelBooking",
          data: body,
        }),
      });

      return jsonResponse(sheetJson);
    }
    if (url.pathname === "/api/bookings/cancellations" && request.method === "GET") {
      const sheetJson = await fetchSheetJson(`${SHEET_API_URL}?action=bookingCancellations`);
      return jsonResponse(sheetJson);
    }
    if ((url.pathname === "/api/driver-job-logs" || url.pathname === "/api/driver_job_logs") && request.method === "GET") {
      const sheetJson = await fetchSheetJson(`${SHEET_API_URL}?action=driver_job_logs`);
      return jsonResponse(sheetJson);
    }
    if (url.pathname === "/api/bookings/cancellations/delete" && request.method === "POST") {
      const body = await request.json();

      const sheetJson = await fetchSheetJson(SHEET_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "deleteBookingCancellationHistory",
          data: body,
        }),
      });

      return jsonResponse(sheetJson);
    }
    if (url.pathname === "/api/login" && request.method === "POST") {
      const body = await request.json();

      const sheetJson = await fetchSheetJson(SHEET_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "loginUser",
          data: body,
        }),
      });

      return jsonResponse(sheetJson);
    }
    if (url.pathname === "/api/drivers" && request.method === "GET") {
      const sheetJson = await fetchSheetJson(`${SHEET_API_URL}?action=drivers`);
      return jsonResponse(sheetJson);
    }
    if (url.pathname === "/api/drivers" && request.method === "POST") {
      const body = await request.json();

      const sheetJson = await fetchSheetJson(SHEET_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "createDriver",
          data: body,
        }),
      });

      return jsonResponse(sheetJson);
    }
    if (url.pathname === "/api/drivers/status" && request.method === "POST") {
      const body = await request.json();

      const sheetJson = await fetchSheetJson(SHEET_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "updateDriverStatus",
          data: body,
        }),
      });

      return jsonResponse(sheetJson);
    }
if (url.pathname === "/api/users" && request.method === "GET") {
  const sheetJson = await fetchSheetJson(`${SHEET_API_URL}?action=users`);
  return jsonResponse(sheetJson);
}

if (url.pathname === "/api/users" && request.method === "POST") {
  const body = await request.json();

  const sheetJson = await fetchSheetJson(SHEET_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "createUser",
      data: body,
    }),
  });

  return jsonResponse(sheetJson);
}

if (url.pathname === "/api/users/update" && request.method === "POST") {
  const body = await request.json();

  const sheetJson = await fetchSheetJson(SHEET_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "updateUser",
      data: body,
    }),
  });

  return jsonResponse(sheetJson);
}

if (url.pathname === "/api/users/reset-password" && request.method === "POST") {
  const body = await request.json();

  const sheetJson = await fetchSheetJson(SHEET_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "resetUserPassword",
      data: body,
    }),
  });

  return jsonResponse(sheetJson);
  }
 if (url.pathname === "/api/vehicles/delete" && request.method === "POST") {
  const body = await request.json();

  const sheetJson = await fetchSheetJson(SHEET_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "deleteVehicle",
      data: body,
    }),
  });

  return jsonResponse(sheetJson);
  }

  if (url.pathname === "/api/vehicles/update" && request.method === "POST") {
    const body = await request.json();

    const sheetJson = await fetchSheetJson(SHEET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "updateVehicle",
        data: body,
      }),
    });

    return jsonResponse(sheetJson);
  }
if (url.pathname === "/api/users/disable" && request.method === "POST") {
  const body = await request.json();

  const sheetJson = await fetchSheetJson(SHEET_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "disableUser",
      data: body,
    }),
  });

  return jsonResponse(sheetJson);
    }

    if (url.pathname === "/api/users/delete" && request.method === "POST") {
      const body = await request.json();

      const sheetJson = await fetchSheetJson(SHEET_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "deleteUser",
          data: body,
        }),
      });

      return jsonResponse(sheetJson);
    }
if (url.pathname === "/api/drivers/update" && request.method === "POST") {
  const body = await request.json();

  const sheetJson = await fetchSheetJson(SHEET_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "updateDriver",
      data: body,
    }),
  });

  return jsonResponse(sheetJson);
  }

  if (url.pathname === "/api/drivers/delete" && request.method === "POST") {
    const body = await request.json();

    const sheetJson = await fetchSheetJson(SHEET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "deleteDriver",
        data: body,
      }),
    });

    return jsonResponse(sheetJson);
  }
  if (url.pathname === "/api/bookings/update" && request.method === "POST") {
    const body = await request.json();

    const sheetJson = await fetchSheetJson(SHEET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "updateBooking",
        data: body,
      }),
    });

    return jsonResponse(sheetJson);
  }
    return jsonResponse(
      {
        success: false,
        message: "API Not Found",
        path: url.pathname,
      },
      404
    );
  },
};
