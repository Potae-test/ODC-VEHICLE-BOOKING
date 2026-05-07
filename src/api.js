const API_BASE_URL = "https://odc-vehicle-api.kooysky.workers.dev";;

// ---------------------
// VEHICLES
// ---------------------

export async function getVehicles() {
  const res = await fetch(`${API_BASE_URL}/api/vehicles`);
  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message || "โหลดข้อมูลรถไม่สำเร็จ");
  }

  return json.data;
}

export async function createVehicle(data) {
  const res = await fetch(`${API_BASE_URL}/api/vehicles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message || "เพิ่มรถไม่สำเร็จ");
  }

  return json.data;
}

// ---------------------
// BOOKINGS
// ---------------------

export async function getBookings() {
  const res = await fetch(`${API_BASE_URL}/api/bookings`);
  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message || "โหลดรายการจองไม่สำเร็จ");
  }

  return json.data;
}

export async function createBooking(data) {
  const res = await fetch(`${API_BASE_URL}/api/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message || "จองรถไม่สำเร็จ");
  }

  return json.data;
}
export async function approveBooking(data) {
  const res = await fetch(`${API_BASE_URL}/api/bookings/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message || "อนุมัติรายการไม่สำเร็จ");
  }

  return json.data;
}
export async function startTrip(data) {
  const res = await fetch(`${API_BASE_URL}/api/bookings/start-trip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message || "บันทึกรถออกไม่สำเร็จ");
  }

  return json.data;
}

export async function completeTrip(data) {
  const res = await fetch(`${API_BASE_URL}/api/bookings/complete-trip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message || "บันทึกรถเข้าไม่สำเร็จ");
  }

  return json.data;
}
export async function cancelBooking(data) {
  const res = await fetch(`${API_BASE_URL}/api/bookings/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message || "ยกเลิกรายการไม่สำเร็จ");
  }

  return json.data;
}
export async function login(email, password) {
  const res = await fetch(`${API_BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message || "เข้าสู่ระบบไม่สำเร็จ");
  }

  return json.data;
}
export async function getDrivers() {
  const res = await fetch(`${API_BASE_URL}/api/drivers`);
  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message || "โหลดข้อมูลคนขับไม่สำเร็จ");
  }

  return json.data;
}
export async function createDriver(data) {
  const res = await fetch(`${API_BASE_URL}/api/drivers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message || "เพิ่มคนขับไม่สำเร็จ");
  }

  return json.data;
}
export async function updateDriverStatus(data) {
  const res = await fetch(`${API_BASE_URL}/api/drivers/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message || "อัปเดตสถานะคนขับไม่สำเร็จ");
  }

  return json.data;
}
export async function getUsers() {
  const res = await fetch(`${API_BASE_URL}/api/users`);
  const json = await res.json();

  if (!json.success) throw new Error(json.message || "โหลดผู้ใช้งานไม่สำเร็จ");
  return json.data;
}

export async function createUser(data) {
  const res = await fetch(`${API_BASE_URL}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const json = await res.json();

  if (!json.success) throw new Error(json.message || "เพิ่มผู้ใช้งานไม่สำเร็จ");
  return json.data;
}

export async function updateUser(data) {
  const res = await fetch(`${API_BASE_URL}/api/users/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const json = await res.json();

  if (!json.success) throw new Error(json.message || "แก้ไขผู้ใช้งานไม่สำเร็จ");
  return json.data;
}

export async function resetUserPassword(data) {
  const res = await fetch(`${API_BASE_URL}/api/users/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const json = await res.json();

  if (!json.success) throw new Error(json.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
  return json.data;
}