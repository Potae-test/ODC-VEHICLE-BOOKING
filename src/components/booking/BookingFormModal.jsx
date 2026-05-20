import { createRoot } from "react-dom/client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import Swal from "sweetalert2";
import { createBooking, updateBooking } from "../../api";
import { showError, showSuccess } from "../../utils/alert";
import ThaiDateTimeField from "../common/ThaiDateTimeField";
import { parseAppDateTime, toLocalDateTimeString } from "../../utils/datetime";
import { FEATURES } from "../../config/features";

const DEFAULT_VEHICLE_TYPES = ["VAN", "SEDAN", "MOTORCYCLE", "OTHER"];

function isStaffOrAdmin(user) {
  const role = String(user?.role || "").trim().toUpperCase();
  return role === "STAFF" || role === "ADMIN";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getDefaultVehicleTypeLabel(type) {
  const normalized = String(type || "").trim().toUpperCase();
  if (normalized === "VAN") return "รถตู้";
  if (normalized === "SEDAN") return "รถเก๋ง";
  if (normalized === "MOTORCYCLE") return "จักรยานยนต์";
  if (normalized === "OTHER") return "อื่นๆ";
  return type || "-";
}

function buildVehicleTypeOptions(vehicleTypes, defaultVehicleType) {
  const mergedTypes = [
    ...new Set(
      [...DEFAULT_VEHICLE_TYPES, ...(Array.isArray(vehicleTypes) ? vehicleTypes : []), defaultVehicleType]
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean)
    ),
  ];

  return mergedTypes
    .map(
      (type) =>
        `<option value="${escapeHtml(type)}"${type === defaultVehicleType ? " selected" : ""}>${escapeHtml(
          getDefaultVehicleTypeLabel(type)
        )}</option>`
    )
    .join("");
}

function getBookingId(booking) {
  return String(booking?.booking_id || booking?.id || booking?.bookingId || "").trim();
}

function getOverlapBookings(bookings, currentBookingId, startDatetime, endDatetime) {
  const start = parseAppDateTime(startDatetime)?.getTime();
  const end = parseAppDateTime(endDatetime)?.getTime();

  if (!start || !end) return [];

  return (Array.isArray(bookings) ? bookings : []).filter((booking) => {
    const bookingId = getBookingId(booking);
    if (currentBookingId && bookingId === String(currentBookingId)) return false;

    const bookingStart = parseAppDateTime(booking?.start_datetime)?.getTime();
    const bookingEnd = parseAppDateTime(booking?.end_datetime)?.getTime();

    if (!bookingStart || !bookingEnd) return false;

    return start < bookingEnd && bookingStart < end;
  });
}

function BookingDateTimeFields({ initialStart, initialEnd, onChange }) {
  const [startValue, setStartValue] = useState(initialStart);
  const [endValue, setEndValue] = useState(initialEnd);

  useEffect(() => {
    onChange?.({
      start_datetime: startValue,
      end_datetime: endValue,
    });
  }, [endValue, onChange, startValue]);

  return (
    <div className="booking-datetime-stack">
      <ThaiDateTimeField
        id="start_datetime"
        label="เวลาไป"
        value={startValue}
        onChange={setStartValue}
        placeholder="เลือกเวลาไป"
        required
      />
      <ThaiDateTimeField
        id="end_datetime"
        label="เวลากลับ"
        value={endValue}
        onChange={setEndValue}
        placeholder="เลือกเวลากลับ"
        required
      />
    </div>
  );
}

function buildModalHtml(booking, vehicleTypes, showBackdatedCheckbox) {
  const defaultVehicleType = String(booking?.vehicle_type_request || booking?.vehicle_type || "VAN").trim() || "VAN";
  const vehicleTypeOptions = buildVehicleTypeOptions(vehicleTypes, defaultVehicleType);
  const isBackdated = String(booking?.is_backdated || "").trim().toUpperCase() === "TRUE";

  return `
    <div class="swal-form">
      <label>ชื่อผู้จอง</label>
      <input
        id="requester_name"
        class="swal2-input"
        placeholder="ชื่อ-นามสกุล"
        value="${escapeHtml(booking?.requester_name || "")}"
      >

      <label>หน่วยงาน / ฝ่าย</label>
      <input
        id="department"
        class="swal2-input"
        placeholder="เช่น ฝ่ายประสานงาน"
        value="${escapeHtml(booking?.department || "")}"
      >

      <label>เบอร์โทร</label>
      <input
        id="phone"
        class="swal2-input"
        placeholder="08x-xxx-xxxx"
        value="${escapeHtml(booking?.phone || "")}"
      >

      <label>เวลาไป</label>
      <div id="booking_overlap_warning" class="booking-overlap-warning">
        แจ้งเตือน: คุณมีรายการจองอื่นในช่วงวันเวลาใกล้เคียงกัน !!
      </div>

      <div class="booking-form-full-row booking-datetime-stack" id="booking_datetime_mount"></div>

      <label>ประเภทรถ</label>
      ${
        FEATURES.vehicleModule
          ? `<select id="vehicle_type_request" class="swal2-select">
        ${vehicleTypeOptions}
      </select>`
          : ""
      }

      <label>ปลายทาง</label>
      <textarea
        id="destination"
        class="swal2-textarea"
        rows="4"
        placeholder="เช่น ศาลากลางจังหวัด"
        style="
          width:100%;
          max-width:100%;
          min-height:110px;
          margin:0;
          resize:vertical;
          box-sizing:border-box;
        "
      >${escapeHtml(booking?.destination || "")}</textarea>

      <label>รายละเอียดการใช้รถ</label>
      <textarea
        id="purpose"
        class="swal2-textarea"
        rows="4"
        placeholder="เช่น ประชุมราชการ"
        style="
          width:100%;
          max-width:100%;
          min-height:110px;
          margin:0;
          resize:vertical;
          box-sizing:border-box;
        "
      >${escapeHtml(booking?.purpose || "")}</textarea>

      ${
        showBackdatedCheckbox
          ? `
      <label style="display:flex; align-items:center; gap:10px; margin-top:8px; font-size:25px; font-weight:700; color:#0f2d5c;">
        <input
          id="is_backdated"
          type="checkbox"
          ${isBackdated ? "checked" : ""}
          style="width:22px; height:22px;"
        >
        <span>เป็นรายการจองย้อนหลังหรือไม่ (กดเลือกเพื่อบันทึกเป็นรายการย้อนหลัง)</span>
      </label>
      `
          : ""
      }
    </div>
  `;
}

const BookingFormModal = forwardRef(function BookingFormModal(
  { overlapCandidates = [], vehicleTypes = DEFAULT_VEHICLE_TYPES, onSuccess, currentUser },
  ref
) {
  const open = useCallback(
    async ({ booking = null, defaultStart, defaultEnd } = {}) => {
      const now = new Date();
      const resolvedStart = booking?.start_datetime || defaultStart || now;
      const resolvedEnd = booking?.end_datetime || defaultEnd || new Date(now.getTime() + 60 * 60 * 1000);
      const datetimeState = {
        start_datetime: booking?.start_datetime || toLocalDateTimeString(resolvedStart),
        end_datetime: booking?.end_datetime || toLocalDateTimeString(resolvedEnd),
      };
      let datetimeRoot = null;

      const result = await Swal.fire({
        title: booking ? "แก้ไขรายการจอง" : "จองรถใหม่",
        html: buildModalHtml(booking, vehicleTypes, isStaffOrAdmin(currentUser)),
        width: 780,
        showCancelButton: true,
        confirmButtonText: booking ? "บันทึก" : "ส่งคำขอจองรถ",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#1455c8",
        cancelButtonColor: "#64748b",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          const modal = Swal.getPopup();
          const warningEl = modal?.querySelector("#booking_overlap_warning");
          const datetimeMount = modal?.querySelector("#booking_datetime_mount");
          if (!FEATURES.vehicleModule) {
            modal?.querySelectorAll("label").forEach((label) => {
              if (label.nextElementSibling?.tagName === "LABEL") {
                label.style.display = "none";
              }
            });
          }

          if (!warningEl || !datetimeMount) return;

          const updateWarning = () => {
            const overlaps = getOverlapBookings(
              overlapCandidates,
              getBookingId(booking),
              datetimeState.start_datetime,
              datetimeState.end_datetime
            );

            warningEl.style.display = overlaps.length > 0 ? "block" : "none";
          };

          datetimeRoot = createRoot(datetimeMount);
          datetimeRoot.render(
            <BookingDateTimeFields
              initialStart={datetimeState.start_datetime}
              initialEnd={datetimeState.end_datetime}
              onChange={(nextValues) => {
                datetimeState.start_datetime = nextValues.start_datetime;
                datetimeState.end_datetime = nextValues.end_datetime;
                updateWarning();
              }}
            />
          );

          updateWarning();
        },
        willClose: () => {
          datetimeRoot?.unmount?.();
          datetimeRoot = null;
        },
        preConfirm: () => {
          const requester_name = document.getElementById("requester_name")?.value.trim();
          const department = document.getElementById("department")?.value.trim();
          const phone = document.getElementById("phone")?.value.trim();
          const start_datetime = datetimeState.start_datetime;
          const end_datetime = datetimeState.end_datetime;
          const vehicle_type_request = FEATURES.vehicleModule
            ? document.getElementById("vehicle_type_request")?.value.trim() || ""
            : "";
          const destination = document.getElementById("destination")?.value.trim();
          const purpose = document.getElementById("purpose")?.value.trim();
          const isBackdatedInput = document.getElementById("is_backdated");

          if (!requester_name || !phone || !start_datetime || !end_datetime || !destination) {
            Swal.showValidationMessage("กรุณากรอกข้อมูลที่จำเป็นให้ครบ");
            return false;
          }

          if ((parseAppDateTime(end_datetime)?.getTime() || 0) <= (parseAppDateTime(start_datetime)?.getTime() || 0)) {
            Swal.showValidationMessage("วันเวลาสิ้นสุดต้องมากกว่าวันเวลาเริ่ม");
            return false;
          }

          return {
            booking_id: booking?.booking_id || "",
            requester_name,
            department,
            phone,
            start_datetime,
            end_datetime,
            vehicle_type_request,
            destination,
            purpose,
            vehicle_id: booking?.vehicle_id || "",
            is_backdated: isBackdatedInput
              ? isBackdatedInput.checked
                ? "TRUE"
                : "FALSE"
              : String(booking?.is_backdated || "").trim().toUpperCase() === "TRUE"
                ? "TRUE"
                : "FALSE",
          };
        },
      });

      if (!result.isConfirmed) return { success: false, cancelled: true };

      try {
        if (booking) {
          const updated = await updateBooking(result.value);
          const merged = { ...result.value, ...(updated || {}) };
          await showSuccess("แก้ไขรายการจองสำเร็จ");
          await onSuccess?.(merged, "edit");
          return { success: true, mode: "edit", data: merged };
        }

        const created = await createBooking(result.value);
        const merged = { ...result.value, ...(created || {}) };
        await showSuccess("ส่งคำขอจองรถสำเร็จ");
        await onSuccess?.(merged, "create");
        return { success: true, mode: "create", data: merged };
      } catch (err) {
        await showError(err.message || (booking ? "แก้ไขรายการจองไม่สำเร็จ" : "จองรถไม่สำเร็จ"));
        return { success: false, error: err };
      }
    },
    [currentUser, onSuccess, overlapCandidates, vehicleTypes]
  );

  useImperativeHandle(
    ref,
    () => ({
      openCreate: (options = {}) => open({ ...options, booking: null }),
      openEdit: (booking, options = {}) => open({ ...options, booking }),
      open,
    }),
    [open]
  );

  return null;
});

export default BookingFormModal;
