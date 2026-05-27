import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { deleteBookingCancellationHistory, getBookingCancellationHistory } from "../api";
import { formatThaiDateTime } from "../utils/date";
import { hasPermission, normalizeRole } from "../permissions";
import { showConfirm, showError, showSuccess } from "../utils/alert";

const ROWS_PER_PAGE = 5;

function sortLatestFirst(items) {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.cancelled_at || a.updated_at || a.created_at).getTime();
    const dateB = new Date(b.cancelled_at || b.updated_at || b.created_at).getTime();
    return dateB - dateA;
  });
}

function paginate(items, page) {
  const start = (page - 1) * ROWS_PER_PAGE;
  return items.slice(start, start + ROWS_PER_PAGE);
}

function totalPages(items) {
  return Math.max(1, Math.ceil(items.length / ROWS_PER_PAGE));
}

function getCancellationDeleteId(item) {
  return String(item.cancellation_id || item.booking_id || item.id || item.row_number || "").trim();
}

function getStatusMeta() {
  return {
    label: "ยกเลิกแล้ว",
    className: "red",
    help: "รายการนี้ถูกยกเลิกและบันทึกลงในประวัติการยกเลิก",
  };
}

function Icon({ children, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

function RefreshIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="M21 12a9 9 0 0 0-15.3-6.4" />
      <path d="M3 4v5h5" />
      <path d="M3 12a9 9 0 0 0 15.3 6.4" />
      <path d="M21 20v-5h-5" />
    </Icon>
  );
}

function ExportIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 15v3a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-3" />
    </Icon>
  );
}

function FilterIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
    </Icon>
  );
}

function TrashIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M9 7V4h6v3" />
    </Icon>
  );
}

function ChevronDownIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

function ChevronRightIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}

function FilterField({
  label,
  value,
  placeholder,
  onChange,
  labelClassName = "text-[13px] font-semibold text-slate-600 sm:text-[14px]",
  inputClassName = "h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-[15px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 sm:h-11 sm:px-4 sm:text-[16px]",
}) {
  return (
    <label className="grid gap-1">
      <span className={labelClassName}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClassName}
      />
    </label>
  );
}

function Pagination({ page, total, onChange, compact = false }) {
  if (total <= 1) return null;

  const buttonBase = compact
    ? "inline-flex h-9 min-w-9 items-center justify-center rounded-xl border px-3 text-[13px] font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
    : "inline-flex h-9 min-w-12 items-center justify-center rounded-xl border px-3 text-[14px] font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50";

  const buttonIdle = compact
    ? "border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50"
    : "border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50";

  const buttonActive = "border-blue-600 bg-blue-600 text-white";

  return (
    <div className={compact ? "mt-4 flex flex-wrap items-center justify-center gap-1.5" : "pagination"}>
      <button
        type="button"
        onClick={() => onChange(1)}
        disabled={page <= 1}
        className={`${buttonBase} ${buttonIdle}`}
      >
        แรก
      </button>
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={`${buttonBase} ${buttonIdle}`}
      >
        ก่อนหน้า
      </button>

      {Array.from({ length: total }).map((_, index) => {
        const current = index + 1;
        return (
          <button
            key={current}
            type="button"
            onClick={() => onChange(current)}
            className={`${buttonBase} ${page === current ? buttonActive : buttonIdle}`}
          >
            {current}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= total}
        className={`${buttonBase} ${buttonIdle}`}
      >
        ถัดไป
      </button>
      <button
        type="button"
        onClick={() => onChange(total)}
        disabled={page >= total}
        className={`${buttonBase} ${buttonIdle}`}
      >
        ท้าย
      </button>
    </div>
  );
}

export default function BookingCancellationHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState("");
  const [expandedHistoryId, setExpandedHistoryId] = useState("");
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    requester: "",
    destination: "",
    reason: "",
    cancelled_by: "",
  });

  const canViewHistory = hasPermission(null, "bookings_view");
  const currentRole = useMemo(() => {
    try {
      const savedUser = JSON.parse(localStorage.getItem("odc_user") || "null");
      return normalizeRole(savedUser?.role);
    } catch {
      return "";
    }
  }, []);
  const canManageHistory = currentRole === "ADMIN" || currentRole === "STAFF";

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const data = await getBookingCancellationHistory();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err.message || "โหลดประวัติการยกเลิกไม่สำเร็จ";
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setPage(1);
    setExpandedHistoryId("");
  }, [filters]);

  const sortedHistory = useMemo(() => sortLatestFirst(history), [history]);

  const filteredHistory = useMemo(() => {
    const requester = filters.requester.trim().toLowerCase();
    const destination = filters.destination.trim().toLowerCase();
    const reason = filters.reason.trim().toLowerCase();
    const cancelledBy = filters.cancelled_by.trim().toLowerCase();

    return sortedHistory.filter((item) => {
      if (requester && !String(item.requester_name || "").toLowerCase().includes(requester)) {
        return false;
      }

      if (destination && !String(item.destination || "").toLowerCase().includes(destination)) {
        return false;
      }

      if (reason && !String(item.reason || "").toLowerCase().includes(reason)) {
        return false;
      }

      if (cancelledBy && !String(item.cancelled_by || "").toLowerCase().includes(cancelledBy)) {
        return false;
      }

      return true;
    });
  }, [filters, sortedHistory]);

  const historyPages = useMemo(() => totalPages(filteredHistory), [filteredHistory]);
  const pageItems = useMemo(() => paginate(filteredHistory, page), [filteredHistory, page]);

  useEffect(() => {
    if (page > historyPages) {
      setPage(historyPages);
    }
  }, [page, historyPages]);

  function setFilter(field, value) {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function clearFilters() {
    setFilters({
      requester: "",
      destination: "",
      reason: "",
      cancelled_by: "",
    });
  }

  function handleExportExcel() {
    const rows = filteredHistory.map((item, index) => ({
      ลำดับ: index + 1,
      เลขที่รายการ: item.booking_no || item.cancellation_id || "-",
      ผู้จอง: item.requester_name || "-",
      ปลายทาง: item.destination || "-",
      เหตุผลการยกเลิก: item.reason || "-",
      ผู้ยกเลิก: item.cancelled_by || "-",
      ยกเลิกเมื่อ: item.cancelled_at ? formatThaiDateTime(item.cancelled_at) : "-",
      สถานะ: "ยกเลิกแล้ว",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    XLSX.utils.book_append_sheet(workbook, worksheet, "ประวัติการยกเลิก");

    XLSX.writeFile(
      workbook,
      `booking-cancellation-history-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  }

  async function handleDelete(item) {
    if (!canManageHistory) {
      return;
    }

    const cancellationId = getCancellationDeleteId(item);
    if (!cancellationId) {
      showError("ไม่พบรหัสรายการที่ต้องการลบ");
      return;
    }

    const confirmed = await showConfirm(
      `ต้องการลบประวัติการยกเลิกรายการ ${item.booking_no || cancellationId} ใช่หรือไม่`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(cancellationId);

      await deleteBookingCancellationHistory({
        cancellation_id: item.cancellation_id || "",
        booking_id: item.booking_id || "",
        id: item.id || "",
        row_number: item.row_number || "",
      });

      setHistory((current) => current.filter((row) => getCancellationDeleteId(row) !== cancellationId));
      setExpandedHistoryId("");
      showSuccess("ลบประวัติการยกเลิกสำเร็จ");
    } catch (err) {
      console.error("Delete cancellation history failed", err);
      const message = err.message || "ลบประวัติการยกเลิกไม่สำเร็จ";
      showError(message);
    } finally {
      setDeletingId("");
    }
  }

  const statusMeta = getStatusMeta();
  const activeFilterCount = [
    filters.requester,
    filters.destination,
    filters.reason,
    filters.cancelled_by,
  ].filter(Boolean).length;
  const pageStart = filteredHistory.length === 0 ? 0 : (page - 1) * ROWS_PER_PAGE + 1;
  const pageEnd = Math.min(page * ROWS_PER_PAGE, filteredHistory.length);

  if (!canViewHistory) {
    return <div className="form-card">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 pb-6 mt-15">
      <section className="hidden rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5 md:block">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-[26px] font-bold leading-tight text-blue-950 sm:text-[28px]">
              ประวัติรายการยกเลิก
            </h2>
            <p className="mt-1 text-[15px] leading-6 text-slate-500 sm:text-[16px]">
              ตรวจสอบประวัติการยกเลิก เหตุผล ผู้ยกเลิก และช่วงเวลาที่บันทึกไว้
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={loadData}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-3 text-[14px] font-semibold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 sm:w-auto"
            >
              <RefreshIcon className="h-4 w-4" />
              <span>รีเฟรช</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredHistory.length === 0}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-600 px-3 text-[14px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <ExportIcon className="h-4 w-4" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="form-card">กำลังโหลดประวัติการยกเลิก...</div>
      ) : error ? (
        <div className="form-card text-red-700">{error}</div>
      ) : (
        <>
          <section className="hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:block">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="inline-flex items-center gap-2 text-[20px] font-bold text-slate-900 sm:text-[22px]">
                  <FilterIcon className="h-5 w-5 text-blue-700" />
                  <span>กรองข้อมูล</span>
                </h3>
                <p className="mt-1 text-[15px] leading-6 text-slate-500">
                  ค้นหาตามผู้จอง ปลายทาง เหตุผล หรือผู้ยกเลิก
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex min-h-8 items-center rounded-full bg-slate-100 px-3.5 text-[14px] font-semibold text-slate-700">
                  จำนวนรายการยกเลิกทั้งหมด {history.length} รายการ
                </span>
                <span className="inline-flex min-h-8 items-center rounded-full bg-blue-50 px-3.5 text-[14px] font-semibold text-blue-700">
                  จำนวนที่แสดงหลังกรอง {filteredHistory.length} รายการ
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FilterField
                label="ผู้จอง"
                value={filters.requester}
                onChange={(value) => setFilter("requester", value)}
                placeholder="ค้นหาชื่อผู้จอง"
              />
              <FilterField
                label="ปลายทาง"
                value={filters.destination}
                onChange={(value) => setFilter("destination", value)}
                placeholder="ค้นหาปลายทาง"
              />
              <FilterField
                label="เหตุผล"
                value={filters.reason}
                onChange={(value) => setFilter("reason", value)}
                placeholder="ค้นหาเหตุผล"
              />
              <FilterField
                label="ผู้ยกเลิก"
                value={filters.cancelled_by}
                onChange={(value) => setFilter("cancelled_by", value)}
                placeholder="ค้นหาผู้ยกเลิก"
              />
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[15px] leading-6 text-slate-600">
                {filteredHistory.length > 0
                  ? `แสดง ${pageStart}-${pageEnd} จากทั้งหมด ${filteredHistory.length} รายการ`
                  : "ไม่พบข้อมูลที่ตรงกับตัวกรอง"}
              </div>

              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-[14px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
              >
                <FilterIcon className="h-4 w-4" />
                <span>ล้างตัวกรอง</span>
              </button>
            </div>
          </section>

          <section className="hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:block">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-[20px] font-bold text-slate-900 sm:text-[22px]">
                  <span>ประวัติรายการยกเลิก</span>
                </h3>
                <p className="mt-1 text-[15px] leading-6 text-slate-500">
                  ตารางสรุปรายการยกเลิกล่าสุด พร้อมข้อมูลผู้จอง เหตุผล และผู้ยกเลิก
                </p>
              </div>

              <span className="inline-flex w-fit rounded-full bg-slate-100 px-3.5 py-1.5 text-[14px] font-semibold text-slate-700">
                หน้า {page} / {historyPages}
              </span>
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[960px] w-full border-collapse bg-white">
                <thead className="bg-slate-50/90">
                  <tr className="text-left text-[14px] font-semibold text-slate-700">
                    <th className="w-[72px] px-4 py-3">ลำดับ</th>
                    <th className="w-[180px] px-4 py-3">ผู้จอง</th>
                    <th className="w-[280px] px-4 py-3">ปลายทาง</th>
                    <th className="w-[280px] px-4 py-3">เหตุผล</th>
                    <th className="w-[180px] px-4 py-3">ผู้ยกเลิก</th>
                    <th className="w-[180px] px-4 py-3">ยกเลิกเมื่อ</th>
                    <th className="w-[110px] px-4 py-3">สถานะ</th>
                    <th className="w-[120px] px-4 py-3">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-500">
                          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                            <FilterIcon className="h-5 w-5" />
                          </span>
                          <span className="text-[16px] font-medium text-slate-600">
                            ไม่พบประวัติการยกเลิก
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((item, index) => {
                      const deleteId = getCancellationDeleteId(item);
                      const isDeleting = deletingId === deleteId;

                      return (
                        <tr key={deleteId || item.booking_no} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 text-[15px] font-semibold text-slate-900">
                            {pageStart + index}
                          </td>
                          <td className="px-4 py-3 text-[15px] text-slate-800">
                            <div className="truncate">{item.requester_name || "-"}</div>
                          </td>
                          <td className="px-4 py-3 text-[15px] text-slate-800">
                            <div className="max-w-[280px] break-words">{item.destination || "-"}</div>
                          </td>
                          <td className="px-4 py-3 text-[15px] text-slate-800">
                            <div className="max-w-[280px] break-words">{item.reason || "-"}</div>
                          </td>
                          <td className="px-4 py-3 text-[15px] text-slate-800">
                            <div className="truncate">{item.cancelled_by || "-"}</div>
                          </td>
                          <td className="px-4 py-3 text-[15px] text-slate-700 whitespace-nowrap">
                            {formatThaiDateTime(item.cancelled_at || item.updated_at || item.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex min-h-8 items-center rounded-full border px-3 text-[13px] font-semibold ${statusMeta.className}`}
                              title={statusMeta.help}
                            >
                              {statusMeta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {canManageHistory ? (
                              <button
                                type="button"
                                onClick={() => handleDelete(item)}
                                disabled={isDeleting}
                                className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[14px] font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <TrashIcon className="h-4 w-4" />
                                <span>{isDeleting ? "กำลังลบ..." : "ลบ"}</span>
                              </button>
                            ) : (
                              <span className="text-[14px] text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Pagination page={page} total={historyPages} onChange={setPage} />
          </section>

          <section className="block md:hidden">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="min-w-0 truncate text-[22px] font-bold leading-tight text-blue-950">
                    ประวัติรายการยกเลิก
                  </h2>
                  <p className="mt-0.5 text-[12px] leading-4 text-slate-500">
                    ตรวจสอบประวัติการยกเลิก เหตุผล ผู้ยกเลิก และช่วงเวลาที่บันทึกไว้
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={loadData}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    <RefreshIcon className="h-4 w-4" />
                    <span>รีเฟรช</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportExcel}
                    disabled={filteredHistory.length === 0}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ExportIcon className="h-4 w-4" />
                    <span>Export</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen((current) => !current)}
                className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                aria-expanded={isMobileFilterOpen}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                    <FilterIcon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-slate-900">ตัวกรองข้อมูล</div>
                    <div className="text-[11px] leading-4 text-slate-500">
                      ค้นหาตามผู้จอง ปลายทาง เหตุผล หรือผู้ยกเลิก
                    </div>
                  </div>
                </div>
                <ChevronRightIcon
                  className={[
                    "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform",
                    isMobileFilterOpen ? "rotate-90" : "",
                  ].join(" ")}
                />
              </button>

              {isMobileFilterOpen ? (
                <div className="mt-2 grid gap-2 rounded-xl bg-slate-50/80 p-3">
                  <div className="grid gap-2">
                    <FilterField
                      label="ผู้จอง"
                      value={filters.requester}
                      onChange={(value) => setFilter("requester", value)}
                      placeholder="ค้นหาชื่อผู้จอง"
                      labelClassName="text-[12px] font-semibold text-slate-600"
                      inputClassName="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                    <FilterField
                      label="ปลายทาง"
                      value={filters.destination}
                      onChange={(value) => setFilter("destination", value)}
                      placeholder="ค้นหาปลายทาง"
                      labelClassName="text-[12px] font-semibold text-slate-600"
                      inputClassName="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                    <FilterField
                      label="เหตุผล"
                      value={filters.reason}
                      onChange={(value) => setFilter("reason", value)}
                      placeholder="ค้นหาเหตุผล"
                      labelClassName="text-[12px] font-semibold text-slate-600"
                      inputClassName="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                    <FilterField
                      label="ผู้ยกเลิก"
                      value={filters.cancelled_by}
                      onChange={(value) => setFilter("cancelled_by", value)}
                      placeholder="ค้นหาผู้ยกเลิก"
                      labelClassName="text-[12px] font-semibold text-slate-600"
                      inputClassName="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[12px] font-semibold text-slate-500">
                      ตัวกรองที่ใช้งาน {activeFilterCount || 0}
                    </span>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 sm:w-auto"
                    >
                      ล้างตัวกรอง
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <div className="flex items-center justify-between gap-2 px-1 pb-2">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-slate-900">รายการยกเลิก</div>
                  <div className="text-[12px] leading-4 text-slate-500">
                    {filteredHistory.length > 0
                      ? `แสดง ${pageStart}-${pageEnd} จากทั้งหมด ${filteredHistory.length} รายการ`
                      : "ไม่พบข้อมูลที่ตรงกับตัวกรอง"}
                  </div>
                </div>
                <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                  หน้า {page}/{historyPages}
                </span>
              </div>

              <div className="grid gap-1.5">
                {pageItems.length === 0 ? (
                  <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center">
                    <div className="flex flex-col items-center gap-1 text-slate-500">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <FilterIcon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-medium text-slate-600">
                        ไม่พบประวัติการยกเลิกรายการจอง
                      </span>
                    </div>
                  </div>
                ) : (
                  pageItems.map((item, index) => {
                    const deleteId = getCancellationDeleteId(item);
                    const isExpanded = expandedHistoryId === deleteId;
                    const isDeleting = deletingId === deleteId;

                    return (
                      <article
                        key={deleteId || item.booking_no || index}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedHistoryId((current) => (current === deleteId ? "" : deleteId))
                          }
                          aria-expanded={isExpanded}
                          aria-controls={`booking-cancellation-mobile-${deleteId || index}`}
                          className="grid w-full grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-1.5 px-3 py-2 text-left"
                        >
                          <div className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-50 px-1.5 text-[12px] font-semibold text-red-700">
                            {pageStart + index}
                          </div>

                          <div className="min-w-0 truncate text-[14px] font-semibold text-slate-900">
                            {item.requester_name || "-"}
                          </div>

                          <div className="min-w-0 truncate text-[13px] text-slate-500">
                            {item.destination || "-"}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex shrink-0 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                              ยกเลิกแล้ว
                            </span>
                            <ChevronDownIcon
                              className={[
                                "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform",
                                isExpanded ? "rotate-180" : "",
                              ].join(" ")}
                            />
                          </div>
                        </button>

                        {isExpanded ? (
                          <div
                            id={`booking-cancellation-mobile-${deleteId || index}`}
                            className="border-t border-slate-100 px-3 py-2.5"
                          >
                            <div className="grid gap-1.5">
                              <div className="grid gap-0.5">
                                <span className="text-[12px] font-semibold text-slate-500">เลขที่รายการ</span>
                                <div className="text-[14px] text-slate-800">
                                  {item.booking_no || item.cancellation_id || "-"}
                                </div>
                              </div>
                              <div className="grid gap-0.5">
                                <span className="text-[12px] font-semibold text-slate-500">
                                  เหตุผลการยกเลิก
                                </span>
                                <div className="break-words text-[14px] text-slate-800">
                                  {item.reason || "-"}
                                </div>
                              </div>
                              <div className="grid gap-0.5">
                                <span className="text-[12px] font-semibold text-slate-500">ผู้ยกเลิก</span>
                                <div className="break-words text-[14px] text-slate-800">
                                  {item.cancelled_by || "-"}
                                </div>
                              </div>
                              <div className="grid gap-0.5">
                                <span className="text-[12px] font-semibold text-slate-500">ยกเลิกเมื่อ</span>
                                <div className="text-[14px] text-slate-800">
                                  {formatThaiDateTime(item.cancelled_at || item.updated_at || item.created_at)}
                                </div>
                              </div>

                              {canManageHistory ? (
                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(item)}
                                    disabled={isDeleting}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                    <span>{isDeleting ? "กำลังลบ..." : "ลบ"}</span>
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </div>

              <Pagination page={page} total={historyPages} onChange={setPage} compact />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
