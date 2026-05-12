const API_BASE_URL = "https://odc-vehicle-api.kooysky.workers.dev";
// const API_BASE_URL = "http://localhost:8787";

const API_CACHE_TTL_MS = 30000;
const apiCache = new Map();

function cloneData(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function invalidateApiCache(keys) {
  keys.forEach((key) => apiCache.delete(key));
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message || "Request failed");
  }

  return json;
}

async function getCachedCollection(key, fetcher) {
  const now = Date.now();
  const entry = apiCache.get(key);

  if (entry?.data && now - entry.timestamp < API_CACHE_TTL_MS) {
    return cloneData(entry.data);
  }

  if (entry?.promise) {
    const data = await entry.promise;
    return cloneData(data);
  }

  const promise = (async () => {
    try {
      const data = await fetcher();
      apiCache.set(key, {
        data,
        timestamp: Date.now(),
        promise: null,
      });
      return data;
    } catch (err) {
      apiCache.delete(key);
      throw err;
    }
  })();

  apiCache.set(key, {
    data: entry?.data || null,
    timestamp: entry?.timestamp || 0,
    promise,
  });

  const data = await promise;
  return cloneData(data);
}

function toVehiclePayload(data = {}) {
  const vehicleName = data.vehicle_name ?? data.vehicle_code ?? "";
  const licensePlate = data.license_plate ?? data.plate_no ?? "";
  const note = data.note ?? data.driver_name ?? data.next_booking ?? "";

  return {
    vehicle_id: data.vehicle_id,
    vehicle_name: vehicleName,
    vehicle_code: data.vehicle_code ?? vehicleName,
    license_plate: licensePlate,
    plate_no: data.plate_no ?? licensePlate,
    vehicle_type: data.vehicle_type ?? "",
    status: data.status ?? "AVAILABLE",
    note,
    driver_name: data.driver_name ?? note,
    next_booking: data.next_booking ?? "",
  };
}

// ---------------------
// VEHICLES
// ---------------------

export async function getVehicles() {
  return getCachedCollection("vehicles", async () => {
    const json = await fetchJson(`${API_BASE_URL}/api/vehicles`);

    return (json.data || []).map((vehicle) => {
      const vehicleName = vehicle.vehicle_name ?? vehicle.vehicle_code ?? "";
      const licensePlate = vehicle.license_plate ?? vehicle.plate_no ?? "";
      const note = vehicle.note ?? vehicle.driver_name ?? vehicle.next_booking ?? "";

      return {
        ...vehicle,
        vehicle_name: vehicleName,
        vehicle_code: vehicle.vehicle_code ?? vehicleName,
        license_plate: licensePlate,
        plate_no: vehicle.plate_no ?? licensePlate,
        note,
        driver_name: vehicle.driver_name ?? note,
      };
    });
  });
}

export async function createVehicle(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/vehicles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(toVehiclePayload(data)),
  });

  invalidateApiCache(["vehicles", "bookings"]);
  return json.data;
}

export async function updateVehicle(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/vehicles/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toVehiclePayload(data)),
  });

  invalidateApiCache(["vehicles", "bookings"]);
  return json.data;
}

export async function deleteVehicle(vehicle_id) {
  const json = await fetchJson(`${API_BASE_URL}/api/vehicles/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vehicle_id }),
  });

  invalidateApiCache(["vehicles", "bookings"]);
  return json.data;
}

// ---------------------
// BOOKINGS
// ---------------------

export async function getBookings() {
  return getCachedCollection("bookings", async () => {
    const json = await fetchJson(`${API_BASE_URL}/api/bookings`);
    return json.data || [];
  });
}

export async function getBookingCancellationHistory() {
  return getCachedCollection("booking-cancellations", async () => {
    const json = await fetchJson(`${API_BASE_URL}/api/bookings/cancellations`);
    return json.data || [];
  });
}

export async function deleteBookingCancellationHistory(cancellation_id) {
  const json = await fetchJson(`${API_BASE_URL}/api/bookings/cancellations/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cancellation_id }),
  });

  invalidateApiCache(["booking-cancellations"]);
  return json.data;
}

export async function createBooking(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  invalidateApiCache(["bookings"]);
  return json.data;
}

export async function approveBooking(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/bookings/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  invalidateApiCache(["bookings"]);
  return json.data;
}

export async function startTrip(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/bookings/start-trip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  invalidateApiCache(["bookings"]);
  return json.data;
}

export async function completeTrip(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/bookings/complete-trip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  invalidateApiCache(["bookings"]);
  return json.data;
}

export async function cancelBooking(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/bookings/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  invalidateApiCache(["bookings", "booking-cancellations"]);
  return json.data;
}

export async function updateBooking(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/bookings/update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  invalidateApiCache(["bookings"]);
  return json.data;
}

// ---------------------
// AUTH
// ---------------------

export async function login(email, password) {
  const json = await fetchJson(`${API_BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  return json.data;
}

// ---------------------
// DRIVERS
// ---------------------

export async function getDrivers() {
  return getCachedCollection("drivers", async () => {
    const json = await fetchJson(`${API_BASE_URL}/api/drivers`);
    return json.data || [];
  });
}

export async function createDriver(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/drivers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  invalidateApiCache(["drivers"]);
  return json.data;
}

export async function updateDriverStatus(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/drivers/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  invalidateApiCache(["drivers", "bookings"]);
  return json.data;
}

export async function updateDriver(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/drivers/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  invalidateApiCache(["drivers"]);
  return json.data;
}

export async function deleteDriver(driver_id) {
  const json = await fetchJson(`${API_BASE_URL}/api/drivers/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ driver_id }),
  });

  invalidateApiCache(["drivers", "bookings"]);
  return json.data;
}

// ---------------------
// USERS
// ---------------------

export async function getUsers() {
  return getCachedCollection("users", async () => {
    const json = await fetchJson(`${API_BASE_URL}/api/users`);
    return json.data || [];
  });
}

export async function createUser(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  invalidateApiCache(["users"]);
  return json.data;
}

export async function updateUser(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/users/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  invalidateApiCache(["users"]);
  return json.data;
}

export async function resetUserPassword(data) {
  const json = await fetchJson(`${API_BASE_URL}/api/users/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  invalidateApiCache(["users"]);
  return json.data;
}

export async function disableUser(user_id) {
  const json = await fetchJson(`${API_BASE_URL}/api/users/disable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id }),
  });

  invalidateApiCache(["users"]);
  return json.data;
}

export async function deleteUser(user_id) {
  const json = await fetchJson(`${API_BASE_URL}/api/users/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id }),
  });

  invalidateApiCache(["users"]);
  return json.data;
}
