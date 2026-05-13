import { useEffect, useMemo, useState } from "react";
import { getBookings, getUsers } from "../api";
import { formatThaiDateTime } from "../utils/date";
import { hasPermission, normalizeRole } from "../permissions";

const COUNTED_STATUSES = new Set(["APPROVED", "IN_USE", "COMPLETED"]);
const TABLE_PAGE_SIZE = 5;

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseBookingDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfWeek(date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = startOfDay(date);
  start.setDate(start.getDate() + diff);
  return start;
}

function endOfWeek(date) {
  const end = startOfWeek(date);
  end.setDate(end.getDate() + 6);
  return endOfDay(end);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getRange(mode, customStart, customEnd) {
  const today = new Date();

  if (mode === "today") {
    return {
      start: startOfDay(today),
      end: endOfDay(today),
      label: "วันนี้",
    };
  }

  if (mode === "week") {
    return {
      start: startOfWeek(today),
      end: endOfWeek(today),
      label: "สัปดาห์นี้",
    };
  }

  if (mode === "month") {
    return {
      start: startOfMonth(today),
      end: endOfMonth(today),
      label: "เดือนนี้",
    };
  }

  const start = customStart ? startOfDay(new Date(customStart)) : startOfMonth(today);
  const end = customEnd ? endOfDay(new Date(customEnd)) : endOfMonth(today);

  return {
    start,
    end,
    label: "ช่วงวันที่เลือก",
  };
}

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function getStatusCategory(status) {
  const raw = String(status || "").trim();
  const normalized = raw.toUpperCase();
  const lower = raw.toLowerCase();

  if (normalized === "COMPLETED" || raw === "เสร็จสิ้น") return "completed";
  if (normalized === "APPROVED" || lower === "assigned" || raw === "อนุมัติแล้ว") return "approved";
  if (normalized === "IN_USE" || lower === "in_use" || raw === "กำลังใช้งาน") return "in_use";
  if (
    normalized === "CANCELLED" ||
    lower === "cancelled" ||
    lower === "canceled" ||
    raw === "ยกเลิก"
  ) {
    return "cancelled";
  }

  return null;
}

function normalizeDriverName(name) {
  return String(name || "").trim();
}

function normalizeDriverId(id) {
  return String(id || "").trim();
}

function driverKeyFromId(id) {
  return `id:${id}`;
}

function driverKeyFromName(name) {
  return `name:${name}`;
}

function isCountedStatus(booking) {
  return (
    COUNTED_STATUSES.has(normalizeStatus(booking.status)) &&
    normalizeDriverName(booking.assigned_user_name)
  );
}

function isSummaryStatus(booking) {
  return Boolean(getStatusCategory(booking.status)) && normalizeDriverName(booking.assigned_user_name);
}

function isInRange(booking, range) {
  const date = parseBookingDate(booking.start_datetime);
  return date && date >= range.start && date <= range.end;
}

function getStatusClass(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "COMPLETED") return "status gray";
  if (normalized === "IN_USE") return "status green";
  if (normalized === "APPROVED") return "status blue";
  return "status";
}

function countByRange(bookings, range) {
  return bookings.filter((booking) => isInRange(booking, range)).length;
}

function latestBooking(bookings) {
  return [...bookings]
    .filter((booking) => parseBookingDate(booking.start_datetime))
    .sort((a, b) => parseBookingDate(b.start_datetime) - parseBookingDate(a.start_datetime))[0];
}

function countByCategory(bookings, category) {
  return bookings.filter((booking) => getStatusCategory(booking.status) === category).length;
}

export default function DriverSummary() {
  const [bookings, setBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rangeMode, setRangeMode] = useState("today");
  const [customStart, setCustomStart] = useState(toDateInputValue(startOfMonth(new Date())));
  const [customEnd, setCustomEnd] = useState(toDateInputValue(new Date()));
  const [selectedDriver, setSelectedDriver] = useState("ALL");
  const [detailDriver, setDetailDriver] = useState(null);
  const [tablePage, setTablePage] = useState(1);
  const canViewDriverSummary = hasPermission(null, "driver_summary_view");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const bookingData = await getBookings();
      setBookings(Array.isArray(bookingData) ? bookingData : []);

      try {
        const userData = await getUsers();
        setDrivers(
          Array.isArray(userData)
            ? userData.filter((user) => normalizeRole(user.role) === "DRIVER")
            : []
        );
      } catch {
        setDrivers([]);
      }
    } catch (err) {
      setError(err.message || "โหลดข้อมูลสรุปงานคนขับไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setTablePage(1);
  }, [rangeMode, customStart, customEnd, selectedDriver]);

  const todayRange = useMemo(() => getRange("today"), []);
  const weekRange = useMemo(() => getRange("week"), []);
  const monthRange = useMemo(() => getRange("month"), []);
  const selectedRange = useMemo(
    () => getRange(rangeMode, customStart, customEnd),
    [rangeMode, customStart, customEnd]
  );

  const driverOptions = useMemo(() => {
    const options = new Map();

    drivers.forEach((driver) => {
      const name = normalizeDriverName(driver.name);
      const driverId = normalizeDriverId(driver.user_id);
      if (!name) return;

      const key = driverId ? driverKeyFromId(driverId) : driverKeyFromName(name);
      options.set(key, {
        key,
        user_id: driverId,
        name,
      });
    });

    return [...options.values()].sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [drivers]);

  const driverRows = useMemo(() => {
    const driverByName = new Map();
    const driverById = new Map();
    const currentDriverNames = new Set();

    driverOptions.forEach((driver) => {
      currentDriverNames.add(driver.name);

      if (driver.name && !driverByName.has(driver.name)) {
        driverByName.set(driver.name, driver.key);
      }

      if (driver.user_id) {
        driverById.set(driver.user_id, driver.key);
      }
    });

    const currentDriverBookings = bookings.filter((booking) => {
      const name = normalizeDriverName(booking.assigned_user_name);
      return isSummaryStatus(booking) && currentDriverNames.has(name);
    });

    function getBookingDriverKey(booking) {
      const driverId = normalizeDriverId(booking.assigned_user_id);
      const name = normalizeDriverName(booking.assigned_user_name);
      if (driverId && driverById.has(driverId)) return driverById.get(driverId);
      return driverByName.get(name);
    }

    return driverOptions
      .map((driver) => {
        const allDriverBookings = currentDriverBookings.filter(
          (booking) => getBookingDriverKey(booking) === driver.key
        );
        const driverBookings = allDriverBookings.filter(isCountedStatus);
        const selectedRangeAllBookings = allDriverBookings.filter((booking) =>
          isInRange(booking, selectedRange)
        );
        const selectedRangeBookings = driverBookings.filter((booking) =>
          isInRange(booking, selectedRange)
        );
        const latest = latestBooking(selectedRangeAllBookings) || latestBooking(allDriverBookings);

        return {
          key: driver.key,
          user_id: driver.user_id,
          name: driver.name,
          todayCount: countByRange(driverBookings, todayRange),
          weekCount: countByRange(driverBookings, weekRange),
          monthCount: countByRange(driverBookings, monthRange),
          selectedCount: selectedRangeBookings.length,
          latest,
          selectedRangeBookings: selectedRangeAllBookings,
          cardTotal: selectedRangeAllBookings.length,
          completedCount: countByCategory(selectedRangeAllBookings, "completed"),
          approvedCount: countByCategory(selectedRangeAllBookings, "approved"),
          inUseCount: countByCategory(selectedRangeAllBookings, "in_use"),
          cancelledCount: countByCategory(selectedRangeAllBookings, "cancelled"),
        };
      })
      .filter((row) => selectedDriver === "ALL" || row.key === selectedDriver)
      .sort((a, b) => b.selectedCount - a.selectedCount || a.name.localeCompare(b.name, "th"));
  }, [bookings, driverOptions, monthRange, selectedDriver, selectedRange, todayRange, weekRange]);

  const detailRow = detailDriver
    ? driverRows.find((row) => row.key === detailDriver)
    : null;

  const totalTablePages = Math.max(1, Math.ceil(driverRows.length / TABLE_PAGE_SIZE));
  const paginatedDriverRows = driverRows.slice(
    (tablePage - 1) * TABLE_PAGE_SIZE,
    tablePage * TABLE_PAGE_SIZE
  );

  if (!canViewDriverSummary) {
    return <div className="form-card">ไม่มีสิทธิ์เข้าถึงสรุปงานคนขับ</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>สรุปงานคนขับ</h2>
          <p>นับจำนวนงานจากรายการจองที่อนุมัติแล้ว กำลังใช้งาน หรือเสร็จสิ้น</p>
        </div>

        <button onClick={loadData}>รีเฟรชข้อมูล</button>
      </div>

      {!loading && !error && (
        <div className="driver-summary-card-grid">
          {driverRows.map((row) => (
            <div className="driver-summary-card" key={row.key}>
              <div className="driver-summary-card-header">
                <h3>{row.name}</h3>
                <strong>{row.cardTotal}</strong>
              </div>

              <div className="driver-summary-card-stats">
                <div className="driver-summary-stat blue-box">
                  <span>งานทั้งหมด</span>
                  <b>{row.cardTotal}</b>
                </div>
                <div className="driver-summary-stat gray-box">
                  <span>ขับแล้ว / เสร็จแล้ว</span>
                  <b>{row.completedCount}</b>
                </div>
                <div className="driver-summary-stat amber-box">
                  <span>ยังไม่ขับ / รอออกเดินทาง</span>
                  <b>{row.approvedCount}</b>
                </div>
                <div className="driver-summary-stat green-box">
                  <span>กำลังขับ / กำลังใช้งาน</span>
                  <b>{row.inUseCount}</b>
                </div>
                <div className="driver-summary-stat red-box">
                  <span>ยกเลิก</span>
                  <b>{row.cancelledCount}</b>
                </div>
              </div>

              <div className="driver-summary-cancelled">ยกเลิก {row.cancelledCount} งาน</div>

              <div className="driver-summary-latest">
                <b>งานล่าสุด</b>
                <span>
                  {row.latest
                    ? `${row.latest.booking_no || "-"} / ${row.latest.destination || "-"} / ${formatThaiDateTime(
                        row.latest.start_datetime
                      )}`
                    : "-"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="form-card">
        <h3>ตัวกรองรายงาน</h3>

        <div className="driver-summary-filters">
          <div>
            <label>ช่วงข้อมูล</label>
            <div className="segmented-control">
              <button
                type="button"
                className={rangeMode === "today" ? "active" : ""}
                onClick={() => setRangeMode("today")}
              >
                วันนี้
              </button>
              <button
                type="button"
                className={rangeMode === "week" ? "active" : ""}
                onClick={() => setRangeMode("week")}
              >
                สัปดาห์นี้
              </button>
              <button
                type="button"
                className={rangeMode === "month" ? "active" : ""}
                onClick={() => setRangeMode("month")}
              >
                เดือนนี้
              </button>
              <button
                type="button"
                className={rangeMode === "custom" ? "active" : ""}
                onClick={() => setRangeMode("custom")}
              >
                เลือกช่วงวันที่เอง
              </button>
            </div>
          </div>

          <div>
            <label>จากวันที่</label>
            <input
              type="date"
              value={customStart}
              disabled={rangeMode !== "custom"}
              onChange={(e) => setCustomStart(e.target.value)}
            />
          </div>

          <div>
            <label>ถึงวันที่</label>
            <input
              type="date"
              value={customEnd}
              disabled={rangeMode !== "custom"}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>

          <div>
            <label>คนขับ</label>
            <select value={selectedDriver} onChange={(e) => setSelectedDriver(e.target.value)}>
              <option value="ALL">คนขับทั้งหมด</option>
              {driverOptions.map((driver) => (
                <option key={driver.key} value={driver.key}>
                  {driver.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="form-card">
        <h3>ตารางเปรียบเทียบคนขับ</h3>

        <div className="section-counter">
          {selectedRange.label}: {formatThaiDateTime(selectedRange.start)} -{" "}
          {formatThaiDateTime(selectedRange.end)}
        </div>

        {loading && <p>กำลังโหลดข้อมูลสรุปงานคนขับ...</p>}
        {error && <p className="driver-summary-error">{error}</p>}

        {!loading && !error && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>คนขับ</th>
                  <th>วันนี้</th>
                  <th>สัปดาห์นี้</th>
                  <th>เดือนนี้</th>
                  <th>รวมตามช่วงที่เลือก</th>
                  <th>งานล่าสุด</th>
                  <th>รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDriverRows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <b>{row.name}</b>
                    </td>
                    <td>{row.todayCount}</td>
                    <td>{row.weekCount}</td>
                    <td>{row.monthCount}</td>
                    <td>
                      <b>{row.selectedCount}</b>
                    </td>
                    <td>
                      {row.latest
                        ? `${row.latest.booking_no || "-"} / ${formatThaiDateTime(
                            row.latest.start_datetime
                          )}`
                        : "-"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="small-button"
                        onClick={() => setDetailDriver(row.key)}
                      >
                        รายละเอียด
                      </button>
                    </td>
                  </tr>
                ))}

                {driverRows.length === 0 && (
                  <tr>
                    <td colSpan="7">ไม่พบข้อมูลคนขับสำหรับรายงาน</td>
                  </tr>
                )}
              </tbody>
            </table>
            {driverRows.length > TABLE_PAGE_SIZE && (
              <div className="pagination">
                <button
                  type="button"
                  disabled={tablePage === 1}
                  onClick={() => setTablePage((page) => Math.max(1, page - 1))}
                >
                  ก่อนหน้า
                </button>

                {Array.from({ length: totalTablePages }).map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    className={tablePage === index + 1 ? "active-page" : ""}
                    onClick={() => setTablePage(index + 1)}
                  >
                    {index + 1}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={tablePage === totalTablePages}
                  onClick={() => setTablePage((page) => Math.min(totalTablePages, page + 1))}
                >
                  ถัดไป
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {detailRow && (
        <div className="driver-summary-modal-backdrop" onClick={() => setDetailDriver(null)}>
          <div className="driver-summary-modal" onClick={(e) => e.stopPropagation()}>
            <div className="driver-summary-modal-header">
              <div>
                <h3>รายละเอียดงาน: {detailRow.name}</h3>
                <p>
                  {selectedRange.label} รวม {detailRow.selectedRangeBookings.length} งาน
                </p>
              </div>
              <button type="button" className="small-button" onClick={() => setDetailDriver(null)}>
                ปิด
              </button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>booking_no</th>
                    <th>start_datetime</th>
                    <th>destination</th>
                    <th>purpose</th>
                    <th>status</th>
                    <th>vehicle_id</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRow.selectedRangeBookings.map((booking) => (
                    <tr key={booking.booking_id}>
                      <td>{booking.booking_no || "-"}</td>
                      <td>{formatThaiDateTime(booking.start_datetime)}</td>
                      <td>{booking.destination || "-"}</td>
                      <td>{booking.purpose || "-"}</td>
                      <td>
                        <span className={getStatusClass(booking.status)}>
                          {normalizeStatus(booking.status)}
                        </span>
                      </td>
                      <td>{booking.vehicle_id || "-"}</td>
                    </tr>
                  ))}

                  {detailRow.selectedRangeBookings.length === 0 && (
                    <tr>
                      <td colSpan="6">ไม่มีงานของคนขับคนนี้ในช่วงที่เลือก</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
