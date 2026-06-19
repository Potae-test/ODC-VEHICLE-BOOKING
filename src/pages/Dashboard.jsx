import { useEffect, useMemo, useState } from "react";
import { getBookings, getDriverUnavailable, getUsers } from "../api";
import { formatThaiDateTime } from "../utils/date";
import PageSkeleton from "../components/skeletons/PageSkeleton";
import useMinimumLoading from "../hooks/useMinimumLoading";

const MONTH_LABELS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const LATEST_BOOKINGS_LIMIT = 8;
const PIE_CHART_SIZE = 220;
const PIE_CHART_STROKE = 30;
const PIE_CHART_RADIUS = (PIE_CHART_SIZE - PIE_CHART_STROKE) / 2;
const PIE_CHART_CIRCUMFERENCE = 2 * Math.PI * PIE_CHART_RADIUS;

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sortLatestFirst(items) {
  return [...items].sort((left, right) => {
    const rightDate = parseDate(right.created_at || right.updated_at || right.start_datetime)?.getTime() || 0;
    const leftDate = parseDate(left.created_at || left.updated_at || left.start_datetime)?.getTime() || 0;
    return rightDate - leftDate;
  });
}

function getBookingStatusMeta(booking) {
  const status = normalizeStatus(booking?.status);

  if (status === "PENDING") {
    return { label: "รออนุมัติ", className: "amber" };
  }
  if (status === "APPROVED") {
    return { label: "อนุมัติแล้ว", className: "blue" };
  }
  if (status === "IN_USE") {
    return { label: "กำลังใช้งาน", className: "green" };
  }
  if (status === "COMPLETED") {
    return { label: "เสร็จสิ้น", className: "gray" };
  }
  if (status === "DRIVER_CANCELLED") {
    return { label: "คนขับยกเลิก", className: "red" };
  }
  if (status === "CANCELLED") {
    return { label: "ยกเลิก", className: "red" };
  }

  return { label: status || "-", className: "purple" };
}

function formatDashboardDateTime(value) {
  if (!value) return "-";
  return formatThaiDateTime(value);
}

function formatMonthLabel(date) {
  return `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function formatDeltaText(value, unit = "รายการ") {
  if (value === 0) return `คงที่จากเดือนก่อน`;
  if (value > 0) return `มากกว่าเดือนก่อน +${value} ${unit}`;
  return `น้อยกว่าเดือนก่อน ${value} ${unit}`;
}

function SummaryCard({ title, value, tone, description, accent }) {
  return (
    <div className={`summary-card dashboard-summary-card dashboard-summary-card--${tone}`}>
      <h3>{title}</h3>
      <strong>{value}</strong>
      <span>{description}</span>
      {accent ? <small>{accent}</small> : null}
    </div>
  );
}

function MetricBar({ label, value, total, tone = "blue" }) {
  const safeTotal = total > 0 ? total : 1;
  const width = Math.max(0, Math.min(100, (value / safeTotal) * 100));

  return (
    <div className="dashboard-metric-bar">
      <div className="dashboard-metric-bar-head">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="dashboard-metric-bar-track">
        <div className={`dashboard-metric-bar-fill dashboard-metric-bar-fill--${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function PieChart({ items, total }) {
  let runningOffset = 0;
  const safeTotal = total > 0 ? total : 1;

  return (
    <div className="dashboard-pie-card">
      <div className="dashboard-pie-chart-wrap" aria-hidden="true">
        <svg
          className="dashboard-pie-chart"
          viewBox={`0 0 ${PIE_CHART_SIZE} ${PIE_CHART_SIZE}`}
          role="img"
          aria-label="สัดส่วนสถานะรายการจอง"
        >
          <circle
            cx={PIE_CHART_SIZE / 2}
            cy={PIE_CHART_SIZE / 2}
            r={PIE_CHART_RADIUS}
            className="dashboard-pie-chart-track"
          />
          {items.map((item) => {
            const fraction = item.value / safeTotal;
            const dashLength = PIE_CHART_CIRCUMFERENCE * fraction;
            const dashArray = `${dashLength} ${PIE_CHART_CIRCUMFERENCE - dashLength}`;
            const dashOffset = -runningOffset;
            runningOffset += dashLength;

            return (
              <circle
                key={item.key}
                cx={PIE_CHART_SIZE / 2}
                cy={PIE_CHART_SIZE / 2}
                r={PIE_CHART_RADIUS}
                className={`dashboard-pie-chart-segment dashboard-pie-chart-segment--${item.tone}`}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
              />
            );
          })}
        </svg>
        <div className="dashboard-pie-chart-center">
          <strong>{total}</strong>
          <span>รายการรวม</span>
        </div>
      </div>

      <div className="dashboard-pie-legend">
        {items.map((item) => {
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div className="dashboard-pie-legend-row" key={item.key}>
              <div className="dashboard-pie-legend-copy">
                <span className={`dashboard-pie-legend-dot dashboard-pie-legend-dot--${item.tone}`} />
                <b>{item.label}</b>
              </div>
              <div className="dashboard-pie-legend-metric">
                <strong>{item.value}</strong>
                <span>{percent}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [driverUnavailableRecords, setDriverUnavailableRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const visibleLoading = useMinimumLoading(loading, 350);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardData() {
      try {
        setLoading(true);
        setError("");

        const [bookingData, userData, unavailableData] = await Promise.all([
          getBookings(),
          getUsers(),
          getDriverUnavailable(),
        ]);

        if (cancelled) return;

        setBookings(Array.isArray(bookingData) ? bookingData : []);
        setUsers(Array.isArray(userData) ? userData : []);
        setDriverUnavailableRecords(Array.isArray(unavailableData) ? unavailableData : []);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || "โหลดข้อมูล Dashboard ไม่สำเร็จ");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, []);

  const dashboardStats = useMemo(() => {
    const totalBookings = bookings.length;
    const pendingCount = bookings.filter((booking) => normalizeStatus(booking.status) === "PENDING").length;
    const approvedCount = bookings.filter((booking) => normalizeStatus(booking.status) === "APPROVED").length;
    const inUseCount = bookings.filter((booking) => normalizeStatus(booking.status) === "IN_USE").length;
    const completedCount = bookings.filter((booking) => normalizeStatus(booking.status) === "COMPLETED").length;
    const cancelledOrPendingCancelCount = bookings.filter((booking) => {
      const status = normalizeStatus(booking.status);
      const pendingDriverCancel = normalizeStatus(booking.driver_cancel_request_status) === "PENDING";
      return status === "CANCELLED" || status === "DRIVER_CANCELLED" || pendingDriverCancel;
    }).length;

    const activeDrivers = users.filter((user) => {
      return normalizeStatus(user.role) === "DRIVER" && normalizeStatus(user.status || "ACTIVE") === "ACTIVE";
    }).length;

    const activeUnavailableDrivers = driverUnavailableRecords.filter(
      (record) => normalizeStatus(record.status) === "ACTIVE"
    ).length;
    const inUseDriverKeys = new Set();

    bookings.forEach((booking) => {
      if (normalizeStatus(booking.status) !== "IN_USE") return;
      const assignedUserId = String(booking.assigned_user_id || "").trim();
      const assignedUserName = String(booking.assigned_user_name || booking.driver_name || "").trim();
      const driverKey = assignedUserId ? `id:${assignedUserId}` : assignedUserName ? `name:${assignedUserName.toLowerCase()}` : "";
      if (driverKey) {
        inUseDriverKeys.add(driverKey);
      }
    });

    const inUseDrivers = inUseDriverKeys.size;
    const readyDrivers = Math.max(0, activeDrivers - activeUnavailableDrivers - inUseDrivers);
    const closedJobs = completedCount + cancelledOrPendingCancelCount;
    const successRate = closedJobs > 0 ? Math.round((completedCount / closedJobs) * 100) : 0;

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = currentMonthStart;

    let currentMonthBookings = 0;
    let previousMonthBookings = 0;

    bookings.forEach((booking) => {
      const bookingDate = parseDate(booking.start_datetime || booking.created_at || booking.updated_at);
      if (!bookingDate) return;
      if (bookingDate >= currentMonthStart && bookingDate < currentMonthEnd) {
        currentMonthBookings += 1;
      } else if (bookingDate >= previousMonthStart && bookingDate < previousMonthEnd) {
        previousMonthBookings += 1;
      }
    });

    const monthOverMonthDiff = currentMonthBookings - previousMonthBookings;
    const monthOverMonthPercent =
      previousMonthBookings > 0 ? Math.round((monthOverMonthDiff / previousMonthBookings) * 100) : currentMonthBookings > 0 ? 100 : 0;

    return {
      totalBookings,
      pendingCount,
      approvedCount,
      inUseCount,
      completedCount,
      cancelledOrPendingCancelCount,
      activeDrivers,
      activeUnavailableDrivers,
      inUseDrivers,
      readyDrivers,
      closedJobs,
      successRate,
      currentMonthBookings,
      previousMonthBookings,
      monthOverMonthDiff,
      monthOverMonthPercent,
      currentMonthLabel: formatMonthLabel(currentMonthStart),
      previousMonthLabel: formatMonthLabel(previousMonthStart),
    };
  }, [bookings, driverUnavailableRecords, users]);

  const statusDistribution = useMemo(() => {
    const total = bookings.length;
    return [
      { key: "pending", label: "รออนุมัติ", value: dashboardStats.pendingCount, tone: "amber" },
      { key: "approved", label: "อนุมัติแล้ว", value: dashboardStats.approvedCount, tone: "blue" },
      { key: "in_use", label: "กำลังใช้งาน", value: dashboardStats.inUseCount, tone: "green" },
      { key: "completed", label: "เสร็จสิ้น", value: dashboardStats.completedCount, tone: "slate" },
      { key: "cancelled", label: "ยกเลิก/รอยกเลิก", value: dashboardStats.cancelledOrPendingCancelCount, tone: "red" },
    ].map((item) => ({
      ...item,
      total,
    }));
  }, [bookings.length, dashboardStats]);

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const buckets = [];

    for (let offset = 5; offset >= 0; offset -= 1) {
      const bucketDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      buckets.push({
        key: `${bucketDate.getFullYear()}-${bucketDate.getMonth() + 1}`,
        label: `${MONTH_LABELS[bucketDate.getMonth()]} ${String(bucketDate.getFullYear() + 543).slice(-2)}`,
        count: 0,
      });
    }

    const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    bookings.forEach((booking) => {
      const bookingDate = parseDate(booking.start_datetime || booking.created_at || booking.updated_at);
      if (!bookingDate) return;
      const key = `${bookingDate.getFullYear()}-${bookingDate.getMonth() + 1}`;
      const bucket = bucketMap.get(key);
      if (bucket) {
        bucket.count += 1;
      }
    });

    const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
    return buckets.map((bucket) => ({
      ...bucket,
      percent: Math.max(10, Math.round((bucket.count / maxCount) * 100)),
    }));
  }, [bookings]);

  const driverStatusBars = useMemo(() => {
    const total = dashboardStats.activeDrivers;
    return [
      { key: "ready", label: "พร้อมรับงาน", value: dashboardStats.readyDrivers, tone: "green", total },
      { key: "in_use", label: "กำลังปฏิบัติงาน", value: dashboardStats.inUseDrivers, tone: "blue", total },
      { key: "unavailable", label: "ไม่พร้อมรับงาน", value: dashboardStats.activeUnavailableDrivers, tone: "red", total },
    ];
  }, [dashboardStats]);

  const topDrivers = useMemo(() => {
    const driverLookup = new Map();
    users.forEach((user) => {
      if (normalizeStatus(user.role) !== "DRIVER") return;
      const userId = String(user.user_id || "").trim();
      const name = String(user.name || "").trim();
      if (userId) {
        driverLookup.set(`id:${userId}`, { name: name || userId, userId });
      }
      if (name) {
        driverLookup.set(`name:${name.toLowerCase()}`, { name, userId });
      }
    });

    const counts = new Map();
    bookings.forEach((booking) => {
      const assignedUserId = String(booking.assigned_user_id || "").trim();
      const assignedUserName = String(booking.assigned_user_name || booking.driver_name || "").trim();
      const key = assignedUserId ? `id:${assignedUserId}` : assignedUserName ? `name:${assignedUserName.toLowerCase()}` : "";
      if (!key) return;

      const matched = driverLookup.get(key);
      const displayName = matched?.name || assignedUserName || assignedUserId || "-";
      const current = counts.get(key) || {
        key,
        name: displayName,
        count: 0,
      };
      current.count += 1;
      counts.set(key, current);
    });

    const topRows = [...counts.values()]
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return left.name.localeCompare(right.name, "th");
      })
      .slice(0, 5);

    const maxCount = Math.max(1, ...topRows.map((row) => row.count), 1);
    return topRows.map((row) => ({
      ...row,
      percent: Math.max(12, Math.round((row.count / maxCount) * 100)),
    }));
  }, [bookings, users]);

  const topDestinationRows = useMemo(() => {
    const counts = new Map();

    bookings.forEach((booking) => {
      const destination = String(booking.destination || "").trim();
      if (!destination) return;
      counts.set(destination, (counts.get(destination) || 0) + 1);
    });

    const rows = [...counts.entries()]
      .map(([destination, count]) => ({ destination, count }))
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return left.destination.localeCompare(right.destination, "th");
      })
      .slice(0, 5);

    const maxCount = Math.max(1, ...rows.map((row) => row.count), 1);
    return rows.map((row) => ({
      ...row,
      percent: Math.max(12, Math.round((row.count / maxCount) * 100)),
    }));
  }, [bookings]);

  const championDriver = topDrivers[0] || null;
  const assignedBookingTotal = useMemo(() => topDrivers.reduce((sum, driver) => sum + driver.count, 0), [topDrivers]);

  const latestBookings = useMemo(() => {
    return sortLatestFirst(bookings).slice(0, LATEST_BOOKINGS_LIMIT);
  }, [bookings]);

  const latestUnavailableDrivers = useMemo(() => {
    return sortLatestFirst(
      driverUnavailableRecords.filter((record) => normalizeStatus(record.status) === "ACTIVE")
    ).slice(0, 8);
  }, [driverUnavailableRecords]);

  if (visibleLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="dashboard-page">
      <div className="page-header dashboard-page-header">
        <div className="dashboard-page-header-copy">
          <h2>Dashboard</h2>
          <p>ภาพรวมการจอง งานคนขับ และสถานะการปฏิบัติงานล่าสุดของระบบ ODC Vehicle Booking</p>
        </div>
        <div className="dashboard-page-header-meta">
          <span>อัปเดตจากข้อมูลปัจจุบัน</span>
          <strong>{formatDashboardDateTime(new Date().toISOString())}</strong>
        </div>
      </div>

      {error && <div className="form-card dashboard-error-card">{error}</div>}

      <section className="dashboard-summary-grid">
        <SummaryCard title="รายการจองทั้งหมด" value={dashboardStats.totalBookings} tone="blue" description="ภาพรวมทุกสถานะ" />
        <SummaryCard title="รออนุมัติ" value={dashboardStats.pendingCount} tone="amber" description="รายการที่ต้องดำเนินการ" />
        <SummaryCard title="อนุมัติแล้ว" value={dashboardStats.approvedCount} tone="sky" description="พร้อมใช้งานตามแผน" />
        <SummaryCard title="กำลังใช้งาน" value={dashboardStats.inUseCount} tone="green" description="งานที่กำลังปฏิบัติงาน" />
        <SummaryCard title="เสร็จสิ้น" value={dashboardStats.completedCount} tone="slate" description="ปิดงานเรียบร้อยแล้ว" />
        <SummaryCard title="Success Rate" value={`${dashboardStats.successRate}%`} tone="emerald" description={`สำเร็จจากงานปิดแล้ว ${dashboardStats.closedJobs} รายการ`} />
        <SummaryCard
          title="งานเดือนนี้"
          value={dashboardStats.currentMonthBookings}
          tone="blue"
          description={dashboardStats.currentMonthLabel}
          accent={`${formatDeltaText(dashboardStats.monthOverMonthDiff)} (${dashboardStats.monthOverMonthPercent > 0 ? "+" : ""}${dashboardStats.monthOverMonthPercent}%)`}
        />
        <SummaryCard title="ยกเลิก/รอยกเลิก" value={dashboardStats.cancelledOrPendingCancelCount} tone="red" description="รวมคำขอยกเลิกที่รอพิจารณา" />
        <SummaryCard title="คนขับพร้อมรับงาน" value={dashboardStats.readyDrivers} tone="emerald" description={`จากคนขับ Active ${dashboardStats.activeDrivers} คน`} />
        <SummaryCard title="คนขับ Active" value={dashboardStats.activeDrivers} tone="purple" description={`ไม่พร้อมรับงาน ${dashboardStats.activeUnavailableDrivers} รายการ`} />
      </section>

      <section className="dashboard-visual-grid">
        <div className="form-card dashboard-panel">
          <div className="dashboard-panel-head">
            <h3>สัดส่วนสถานะรายการจอง</h3>
            <span>{dashboardStats.totalBookings} รายการ</span>
          </div>
          <PieChart items={statusDistribution} total={dashboardStats.totalBookings} />
        </div>

        <div className="form-card dashboard-panel">
          <div className="dashboard-panel-head">
            <h3>แนวโน้มการจอง 6 เดือนล่าสุด</h3>
            <span>นับตามวันเวลาไป</span>
          </div>
          <div className="dashboard-trend-chart">
            {monthlyTrend.map((item) => (
              <div className="dashboard-trend-column" key={item.key}>
                <div className="dashboard-trend-value">{item.count}</div>
                <div className="dashboard-trend-bar-track">
                  <div className="dashboard-trend-bar-fill" style={{ height: `${item.percent}%` }} />
                </div>
                <div className="dashboard-trend-label">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="form-card dashboard-panel">
          <div className="dashboard-panel-head">
            <h3>สถานะคนขับ</h3>
            <span>{dashboardStats.activeDrivers} คน</span>
          </div>
          <div className="dashboard-metric-list">
            {driverStatusBars.map((item) => (
              <MetricBar key={item.key} label={item.label} value={item.value} total={item.total} tone={item.tone} />
            ))}
          </div>
        </div>

        <div className="form-card dashboard-panel dashboard-champion-panel">
          <div className="dashboard-panel-head">
            <h3>Top Driver Champion</h3>
            <span>ผู้ขับที่รับงานสูงสุด</span>
          </div>
          {championDriver ? (
            <div className="dashboard-champion-card">
              <div className="dashboard-champion-badge">#1</div>
              <strong>{championDriver.name}</strong>
              <div className="dashboard-champion-metrics">
                <div>
                  <span>จำนวนงาน</span>
                  <b>{championDriver.count}</b>
                </div>
                <div>
                  <span>สัดส่วน</span>
                  <b>{assignedBookingTotal > 0 ? Math.round((championDriver.count / assignedBookingTotal) * 100) : 0}%</b>
                </div>
              </div>
              <p>ผลงานเด่นจากรายการที่มีการมอบหมายคนขับในระบบ</p>
            </div>
          ) : (
            <div className="dashboard-empty-state">ยังไม่มีข้อมูลคนขับที่ได้รับมอบหมายงาน</div>
          )}
        </div>

        <div className="form-card dashboard-panel">
          <div className="dashboard-panel-head">
            <h3>Top Destination</h3>
            <span>ปลายทางยอดนิยม</span>
          </div>
          <div className="dashboard-top-driver-list">
            {topDestinationRows.length === 0 ? (
              <div className="dashboard-empty-state">ยังไม่มีข้อมูลปลายทาง</div>
            ) : (
              topDestinationRows.map((destination, index) => (
                <div className="dashboard-top-driver-row" key={`${destination.destination}-${index}`}>
                  <div className="dashboard-top-driver-rank">{index + 1}</div>
                  <div className="dashboard-top-driver-copy">
                    <strong>{destination.destination}</strong>
                    <span>{destination.count} งาน</span>
                  </div>
                  <div className="dashboard-top-driver-bar">
                    <div className="dashboard-top-driver-bar-fill" style={{ width: `${destination.percent}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="form-card dashboard-panel">
          <div className="dashboard-panel-head">
            <h3>Top 5 คนขับตามจำนวนงาน</h3>
            <span>จากรายการที่มีการมอบหมาย</span>
          </div>
          <div className="dashboard-top-driver-list">
            {topDrivers.length === 0 ? (
              <div className="dashboard-empty-state">ยังไม่มีข้อมูลการมอบหมายคนขับ</div>
            ) : (
              topDrivers.map((driver, index) => (
                <div className="dashboard-top-driver-row" key={driver.key}>
                  <div className="dashboard-top-driver-rank">{index + 1}</div>
                  <div className="dashboard-top-driver-copy">
                    <strong>{driver.name}</strong>
                    <span>{driver.count} งาน</span>
                  </div>
                  <div className="dashboard-top-driver-bar">
                    <div className="dashboard-top-driver-bar-fill" style={{ width: `${driver.percent}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="form-card dashboard-panel">
        <div className="dashboard-panel-head">
          <h3>รายการจองล่าสุด</h3>
          <span>{latestBookings.length} รายการล่าสุด</span>
        </div>

        {latestBookings.length === 0 ? (
          <div className="dashboard-empty-state">ยังไม่มีข้อมูลรายการจอง</div>
        ) : (
          <div className="dashboard-booking-table-wrap">
            <table className="dashboard-booking-table">
              <thead>
                <tr>
                  <th>เลขที่จอง</th>
                  <th>ผู้จอง</th>
                  <th>ปลายทาง</th>
                  <th>คนขับ</th>
                  <th>วันที่ไป</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {latestBookings.map((booking, index) => {
                  const statusMeta = getBookingStatusMeta(booking);
                  const bookingKey = String(booking.booking_id || booking.booking_no || booking.start_datetime || `booking-${index}`);
                  return (
                    <tr key={bookingKey}>
                      <td>{booking.booking_no || booking.booking_id || "-"}</td>
                      <td>{booking.requester_name || "-"}</td>
                      <td>{booking.destination || "-"}</td>
                      <td>{booking.assigned_user_name || booking.driver_name || "-"}</td>
                      <td>{formatDashboardDateTime(booking.start_datetime)}</td>
                      <td>
                        <span className={`status ${statusMeta.className}`}>{statusMeta.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="dashboard-booking-mobile-list">
              {latestBookings.map((booking, index) => {
                const statusMeta = getBookingStatusMeta(booking);
                const bookingKey = String(booking.booking_id || booking.booking_no || booking.start_datetime || `mobile-booking-${index}`);
                return (
                  <article className="dashboard-booking-mobile-card" key={`mobile-${bookingKey}`}>
                    <div className="dashboard-booking-mobile-card-head">
                      <strong>{booking.booking_no || booking.booking_id || "-"}</strong>
                      <span className={`status ${statusMeta.className}`}>{statusMeta.label}</span>
                    </div>
                    <div className="dashboard-booking-mobile-card-grid">
                      <div>
                        <span>ผู้จอง</span>
                        <b>{booking.requester_name || "-"}</b>
                      </div>
                      <div>
                        <span>ปลายทาง</span>
                        <b>{booking.destination || "-"}</b>
                      </div>
                      <div>
                        <span>คนขับ</span>
                        <b>{booking.assigned_user_name || booking.driver_name || "-"}</b>
                      </div>
                      <div>
                        <span>วันที่ไป</span>
                        <b>{formatDashboardDateTime(booking.start_datetime)}</b>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="dashboard-footnote-grid">
        <div className="form-card dashboard-footnote-card">
          <h3>คนขับไม่พร้อมรับงานล่าสุด</h3>
          <div className="dashboard-vehicle-chip-list">
            {latestUnavailableDrivers.length === 0 ? (
              <div className="dashboard-empty-state">ไม่มีคนขับที่ไม่พร้อมรับงาน</div>
            ) : (
              latestUnavailableDrivers.map((record, index) => {
                const recordKey = String(record.record_id || record.unavailable_id || `${record.driver_name || "driver"}-${index}`);
                const reasonText = String(record.reason || record.unavailable_type || record.type || "-").trim() || "-";
                return (
                  <div className="dashboard-vehicle-chip" key={recordKey}>
                    <div>
                      <strong>{record.driver_name || "-"}</strong>
                      <span>{reasonText}</span>
                      <span>
                        {formatDashboardDateTime(record.start_datetime)} - {formatDashboardDateTime(record.end_datetime)}
                      </span>
                    </div>
                    <span className="status blue">ACTIVE</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
