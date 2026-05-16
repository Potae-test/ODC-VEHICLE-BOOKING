import { forwardRef, useCallback, useImperativeHandle } from "react";
import Swal from "sweetalert2";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { Thai } from "flatpickr/dist/l10n/th.js";
import { createBooking, updateBooking } from "../../api";
import { showError, showSuccess } from "../../utils/alert";

const DEFAULT_VEHICLE_TYPES = ["VAN", "SEDAN", "MOTORCYCLE", "OTHER"];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDateTimeInputValue(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}`;
}

function formatThaiDateTimeValue(date) {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear() + 543} ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}`;
}

function parseThaiDateTimeValue(dateStr, formatStr) {
  const raw = String(dateStr || "").trim();
  if (!raw) return null;

  const buddhistMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (buddhistMatch) {
    const [, day, month, year, hour, minute] = buddhistMatch;
    return new Date(
      Number(year) - 543,
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
      0
    );
  }

  const gregorianMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (gregorianMatch) {
    const [, year, month, day, hour = "0", minute = "0"] = gregorianMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
      0
    );
  }

  const parsed = flatpickr.parseDate(raw, formatStr);
  if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function syncBuddhistYearHeader(instance) {
  if (!instance?.calendarContainer) return;

  instance.calendarContainer.classList.add("booking-flatpickr-calendar");

  const yearInput = instance.currentYearElement;
  if (yearInput) {
    yearInput.value = String(instance.currentYear + 543);
    yearInput.setAttribute("inputmode", "numeric");
  }
}

function initThaiDateTimePicker(inputSelector, defaultValue, options = {}) {
  const input = document.querySelector(inputSelector);
  if (!input) return null;

  const { showTodayButton = true, onValueChange, useAltInput = true } = options;
  const normalizedDefaultDate =
    defaultValue instanceof Date
      ? defaultValue
      : defaultValue
        ? String(defaultValue).trim().replace("T", " ")
        : undefined;

  const instance = flatpickr(input, {
    enableTime: true,
    noCalendar: false,
    time_24hr: true,
    minuteIncrement: 5,
    locale: {
      ...Thai,
      today: "วันนี้",
    },
    dateFormat: "Y-m-d H:i",
    altInput: useAltInput,
    altFormat: "d/m/Y H:i",
    allowInput: false,
    disableMobile: true,
    defaultDate: normalizedDefaultDate,
    formatDate: (date, formatStr, locale) => {
      if (formatStr === "d/m/Y H:i") {
        return formatThaiDateTimeValue(date);
      }

      return flatpickr.formatDate(date, formatStr, locale);
    },
    parseDate: (dateStr, formatStr) => {
      const parsed = parseThaiDateTimeValue(dateStr, formatStr);
      if (parsed) return parsed;
      return flatpickr.parseDate(dateStr, formatStr);
    },
    onMonthChange: [(_, __, instance) => syncBuddhistYearHeader(instance)],
    onYearChange: [(_, __, instance) => syncBuddhistYearHeader(instance)],
    onReady: [(_, __, instance) => syncBuddhistYearHeader(instance)],
    onChange: onValueChange
      ? [
          (_, __, instance) => {
            onValueChange(instance.input.value, instance);
          },
        ]
      : undefined,
    onValueUpdate: onValueChange
      ? [
          (_, __, instance) => {
            onValueChange(instance.input.value, instance);
          },
        ]
      : undefined,
  });

  syncBuddhistYearHeader(instance);
  return instance;
}

function getOverlapBookings(bookings, currentBookingId, startDatetime, endDatetime) {
  const start = new Date(startDatetime).getTime();
  const end = new Date(endDatetime).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) return [];

  return (Array.isArray(bookings) ? bookings : []).filter((booking) => {
    const bookingId = String(booking?.booking_id || "");
    if (currentBookingId && bookingId === String(currentBookingId)) return false;

    const bookingStart = new Date(booking?.start_datetime).getTime();
    const bookingEnd = new Date(booking?.end_datetime).getTime();

    if (Number.isNaN(bookingStart) || Number.isNaN(bookingEnd)) return false;

    return start < bookingEnd && bookingStart < end;
  });
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
          type === "VAN"
            ? "รถตู้"
            : type === "SEDAN"
              ? "รถเก๋ง"
              : type === "MOTORCYCLE"
                ? "จักรยานยนต์"
                : type === "OTHER"
                  ? "อื่นๆ"
                  : type
        )}</option>`
    )
    .join("");
}

function buildModalHtml(booking, vehicleTypes, defaultStart, defaultEnd) {
  const defaultVehicleType = String(booking?.vehicle_type_request || booking?.vehicle_type || "VAN").trim() || "VAN";
  const vehicleTypeOptions = buildVehicleTypeOptions(vehicleTypes, defaultVehicleType);

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
      <div
        id="booking_overlap_warning"
        class="booking-overlap-warning"
      >
        แจ้งเตือน: คุณมีรายการจองอื่นในช่วงวันเวลาใกล้เคียงกัน !!
      </div>

      <input
        id="start_datetime"
        class="swal2-input"
        type="text"
        lang="en-GB"
        value="${escapeHtml(booking?.start_datetime || formatDateTimeInputValue(defaultStart))}"
      >

      <label>เวลากลับ</label>
      <input
        id="end_datetime"
        class="swal2-input"
        type="text"
        lang="en-GB"
        value="${escapeHtml(booking?.end_datetime || formatDateTimeInputValue(defaultEnd))}"
      >

      <label>ประเภทรถ</label>
      <select id="vehicle_type_request" class="swal2-select">
        ${vehicleTypeOptions}
      </select>

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

      <label>เหตุผลการใช้รถ</label>
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
    </div>
  `;
}

const BookingFormModal = forwardRef(function BookingFormModal(
  { overlapCandidates = [], vehicleTypes = DEFAULT_VEHICLE_TYPES, onSuccess },
  ref
) {
  const open = useCallback(
    async ({ booking = null, defaultStart, defaultEnd } = {}) => {
      const now = new Date();
      const resolvedStart =
        booking?.start_datetime || defaultStart || now;
      const resolvedEnd =
        booking?.end_datetime || defaultEnd || new Date(now.getTime() + 60 * 60 * 1000);

      const result = await Swal.fire({
        title: booking ? "แก้ไขรายการจอง" : "จองรถใหม่",
        html: buildModalHtml(booking, vehicleTypes, resolvedStart, resolvedEnd),
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
          const startInput = modal?.querySelector("#start_datetime");
          const endInput = modal?.querySelector("#end_datetime");

          if (!warningEl || !startInput || !endInput) return;

          const updateWarning = () => {
            const overlaps = getOverlapBookings(
              overlapCandidates,
              booking?.booking_id || "",
              startInput.value,
              endInput.value
            );

            warningEl.style.display = overlaps.length > 0 ? "block" : "none";
          };

          const startPicker = initThaiDateTimePicker("#start_datetime", resolvedStart);
          const endPicker = initThaiDateTimePicker("#end_datetime", resolvedEnd);

          startPicker?.config.onChange.push(updateWarning);
          startPicker?.config.onValueUpdate.push(updateWarning);
          endPicker?.config.onChange.push(updateWarning);
          endPicker?.config.onValueUpdate.push(updateWarning);

          startInput.addEventListener("input", updateWarning);
          startInput.addEventListener("change", updateWarning);
          endInput.addEventListener("input", updateWarning);
          endInput.addEventListener("change", updateWarning);
          updateWarning();
        },
        preConfirm: () => {
          const requester_name = document.getElementById("requester_name")?.value.trim();
          const department = document.getElementById("department")?.value.trim();
          const phone = document.getElementById("phone")?.value.trim();
          const start_datetime = document.getElementById("start_datetime")?.value;
          const end_datetime = document.getElementById("end_datetime")?.value;
          const vehicle_type_request = document.getElementById("vehicle_type_request")?.value.trim();
          const destination = document.getElementById("destination")?.value.trim();
          const purpose = document.getElementById("purpose")?.value.trim();

          if (!requester_name || !phone || !start_datetime || !end_datetime || !destination) {
            Swal.showValidationMessage("กรุณากรอกข้อมูลที่จำเป็นให้ครบ");
            return false;
          }

          if (new Date(end_datetime) <= new Date(start_datetime)) {
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
          };
        },
      });

      if (!result.isConfirmed) return { success: false, cancelled: true };

      try {
        if (booking) {
          const updated = await updateBooking(result.value);
          const merged = { ...result.value, ...(updated || {}) };
          await showSuccess("แก้ไขรายการสำเร็จ");
          await onSuccess?.(merged, "edit");
          return { success: true, mode: "edit", data: merged };
        }

        const created = await createBooking(result.value);
        const merged = { ...result.value, ...(created || {}) };
        await showSuccess("ส่งคำขอจองรถสำเร็จ");
        await onSuccess?.(merged, "create");
        return { success: true, mode: "create", data: merged };
      } catch (err) {
        await showError(err.message || (booking ? "แก้ไขรายการไม่สำเร็จ" : "จองรถไม่สำเร็จ"));
        return { success: false, error: err };
      }
    },
    [onSuccess, overlapCandidates, vehicleTypes]
  );

  useImperativeHandle(ref, () => ({
    openCreate: (options = {}) => open({ ...options, booking: null }),
    openEdit: (booking, options = {}) => open({ ...options, booking }),
    open,
  }), [open]);

  return null;
});

export default BookingFormModal;
