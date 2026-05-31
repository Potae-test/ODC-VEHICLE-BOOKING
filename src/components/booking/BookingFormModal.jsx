import { createRoot } from "react-dom/client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import Swal from "sweetalert2";
import { createBooking, updateBooking } from "../../api";
import { showError, showSuccess } from "../../utils/alert";
import ThaiDateTimeField from "../common/ThaiDateTimeField";
import { parseAppDateTime } from "../../utils/datetime";
import { FEATURES } from "../../config/features";

const DEFAULT_VEHICLE_TYPES = ["VAN", "SEDAN", "MOTORCYCLE", "OTHER"];

function isStandardUser(user) {
  return String(user?.role || "").trim().toUpperCase() === "USER";
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

function createEmptyThaiDateTime() {
  const now = new Date();

  now.setHours(0);
  now.setMinutes(0);
  now.setSeconds(0);
  now.setMilliseconds(0);

  return now.toISOString();
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
    <style>
      @media (max-width: 600px) {
        .booking-form-popup .booking-form-html {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }

        .booking-form-popup .swal-form.booking-form-modal {
          display: grid;
          gap: 10px;
          padding: 20px;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .booking-form-popup .swal-form.booking-form-modal label {
          margin: 0 0 4px;
          font-size: 18px;
          line-height: 1.15;
        }

        .booking-form-popup .swal2-input.booking-form-input,
        .booking-form-popup .swal2-select.booking-form-input {
          width: 100% !important;
          max-width: 100% !important;
          min-height: 48px !important;
          height: 48px;
          padding: 8px 12px !important;
          margin: 0 !important;
          font-size: 18px !important;
          line-height: 1.15;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }

        .booking-form-popup .swal2-input.booking-form-input::placeholder,
        .booking-form-popup .swal2-textarea.booking-form-textarea::placeholder {
          font-size: 16px !important;
        }

        .booking-form-popup .booking-overlap-warning {
          margin: 2px 0 0;
          padding: 10px 12px;
          font-size: 16px;
          line-height: 1.35;
        }

        .booking-form-popup .booking-form-datetime {
          gap: 8px;
        }

        .booking-form-popup .booking-datetime-stack {
          gap: 8px;
          min-width: 0;
        }

        .booking-form-popup .booking-datetime-stack .thai-datetime-label-row {
          grid-template-columns: minmax(0, 1fr) auto !important;
          gap: 8px;
          min-width: 0;
        }

        .booking-form-popup .booking-datetime-stack .thai-datetime-input-row {
          grid-template-columns: minmax(0, 1fr) 70px 70px !important;
          gap: 8px;
          min-width: 0;
          align-items: end;
        }

        .booking-form-popup .booking-datetime-stack .thai-datetime-main-label,
        .booking-form-popup .booking-datetime-stack .thai-datetime-time-labels {
          font-size: 16px;
          min-width: 0;
        }

        .booking-form-popup .booking-datetime-stack .thai-datetime-date-col,
        .booking-form-popup .booking-datetime-stack .thai-datetime-time-row {
          min-width: 0;
          width: 100%;
        }

        .booking-form-popup .booking-datetime-stack .thai-datetime-date-col input,
        .booking-form-popup .booking-datetime-stack .thai-datetime-picker-input.flatpickr-input {
          width: 100% !important;
          max-width: 100% !important;
          min-height: 56px !important;
          height: 56px;
          padding: 8px 10px !important;
          margin: 0 !important;
          font-size: 16px !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }

        .booking-form-popup .booking-datetime-stack .thai-datetime-time-row {
          grid-template-columns: 70px auto 70px;
          gap: 6px;
          align-items: center;
          min-width: 0;
        }

        .booking-form-popup .booking-datetime-stack .thai-hour-input,
        .booking-form-popup .booking-datetime-stack .thai-minute-input {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          min-height: 50px;
          height: 50px;
          padding: 6px 6px;
          font-size: 16px !important;
          box-sizing: border-box;
        }

        .booking-form-popup .booking-datetime-stack .thai-time-separator {
          font-size: 16px;
        }

        .booking-form-popup .swal2-textarea.booking-form-textarea {
          width: 100% !important;
          max-width: 100% !important;
          min-height: 132px !important;
          padding: 10px 12px !important;
          margin: 0 !important;
          font-size: 18px !important;
          line-height: 1.35;
          min-width: 0 !important;
          box-sizing: border-box !important;
          resize: vertical;
        }

        .booking-form-popup .swal2-actions.booking-form-actions {
          width: 100%;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .booking-form-popup .swal2-actions.booking-form-actions .booking-form-confirm,
        .booking-form-popup .swal2-actions.booking-form-actions .booking-form-cancel {
          flex: 1 1 0;
          min-width: 150px;
          min-height: 44px;
          padding: 8px 12px !important;
          font-size: 18px !important;
          border-radius: 12px !important;
        }

        .booking-form-popup .swal2-actions.booking-form-actions .booking-form-confirm {
          order: 1;
        }

        .booking-form-popup .swal2-actions.booking-form-actions .booking-form-cancel {
          order: 2;
        }
      }
    </style>
    <div class="swal-form booking-form-modal">
      <label>ชื่อผู้จอง</label>
      <input
        id="requester_name"
        class="swal2-input booking-form-input"
        placeholder="ชื่อ-นามสกุล"
        value="${escapeHtml(booking?.requester_name || "")}"
      >

      <label>หน่วยงาน / ฝ่าย</label>
      <input
        id="department"
        class="swal2-input booking-form-input"
        placeholder="เช่น ฝ่ายประสานงาน"
        value="${escapeHtml(booking?.department || "")}"
      >

      <label>เบอร์โทร</label>
      <input
        id="phone"
        class="swal2-input booking-form-input"
        placeholder="08x-xxx-xxxx"
        value="${escapeHtml(booking?.phone || "")}"
      >

      
      <div id="booking_overlap_warning" class="booking-overlap-warning">
        แจ้งเตือน: คุณมีรายการจองอื่นในช่วงวันเวลาใกล้เคียงกัน !!
      </div>

      <div class="booking-form-full-row booking-datetime-stack booking-form-datetime" id="booking_datetime_mount"></div>

      <label>ประเภทรถ</label>
      ${
        FEATURES.vehicleModule
          ? `<select id="vehicle_type_request" class="swal2-select booking-form-input">
        ${vehicleTypeOptions}
      </select>`
          : ""
      }

      <label>ปลายทาง</label>
      <textarea
        id="destination"
        class="swal2-textarea booking-form-textarea"
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
        class="swal2-textarea booking-form-textarea"
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
        <span>บันทึกรายการย้อนหลัง</span>
      </label>
      `
          : ""
      }
    </div>
  `;
}

const BookingFormModal = forwardRef(function BookingFormModal(
  { overlapCandidates = [], vehicleTypes = DEFAULT_VEHICLE_TYPES, onSuccess, currentUser, showBackdatedCheckbox = false },
  ref
) {
  const open = useCallback(
    async ({ booking = null } = {}) => {
      const userOwnedCreateFlow = !booking && isStandardUser(currentUser);
      const initialBooking = {
        ...booking,
        requester_name: userOwnedCreateFlow
          ? currentUser?.name || currentUser?.email || booking?.requester_name || ""
          : booking?.requester_name || "",
        requester_user_id: userOwnedCreateFlow
          ? currentUser?.user_id || booking?.requester_user_id || ""
          : booking?.requester_user_id || "",
        department: userOwnedCreateFlow
          ? currentUser?.department || booking?.department || ""
          : booking?.department || "",
        phone: userOwnedCreateFlow
          ? currentUser?.phone || booking?.phone || ""
          : booking?.phone || "",
      };
      const datetimeState = {
        start_datetime: initialBooking.start_datetime || createEmptyThaiDateTime(),
        end_datetime: initialBooking.end_datetime || createEmptyThaiDateTime(),
      };
      let datetimeRoot = null;

      const result = await Swal.fire({
        title: booking ? "แก้ไขรายการจอง" : "เพิ่มรายการจอง",
        html: buildModalHtml(initialBooking, vehicleTypes, Boolean(showBackdatedCheckbox)),
        width: 780,
        showCancelButton: true,
        reverseButtons: false,
        confirmButtonText: booking ? "บันทึก" : "ส่งคำขอจองรถ",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#1455c8",
        cancelButtonColor: "#64748b",
        allowOutsideClick: false,
        allowEscapeKey: false,
        customClass: {
          popup: "booking-form-popup",
          htmlContainer: "booking-form-html",
          actions: "booking-form-actions",
          confirmButton: "booking-form-confirm",
          cancelButton: "booking-form-cancel",
        },
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
              getBookingId(initialBooking),
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
          const resolvedRequesterName = isStandardUser(currentUser)
            ? currentUser?.name || currentUser?.email || requester_name
            : requester_name;
          const resolvedRequesterUserId = isStandardUser(currentUser)
            ? currentUser?.user_id || initialBooking.requester_user_id || ""
            : initialBooking.requester_user_id || "";
          const resolvedDepartment = isStandardUser(currentUser)
            ? currentUser?.department || department || initialBooking.department || ""
            : department;
          const resolvedPhone = isStandardUser(currentUser)
            ? currentUser?.phone || phone || initialBooking.phone || ""
            : phone;

          if (!resolvedRequesterName || !resolvedPhone || !start_datetime || !end_datetime || !destination) {
            Swal.showValidationMessage("กรุณากรอกข้อมูลที่จำเป็นให้ครบ");
            return false;
          }

          if ((parseAppDateTime(end_datetime)?.getTime() || 0) <= (parseAppDateTime(start_datetime)?.getTime() || 0)) {
            Swal.showValidationMessage("วันเวลาสิ้นสุดต้องมากกว่าวันเวลาเริ่ม");
            return false;
          }

          return {
            booking_id: booking?.booking_id || "",
            requester_name: resolvedRequesterName,
            requester_user_id: resolvedRequesterUserId,
            department: resolvedDepartment,
            phone: resolvedPhone,
            start_datetime,
            end_datetime,
            vehicle_type_request,
            destination,
            purpose,
            vehicle_id: booking?.vehicle_id || "",
            created_by_user_id: currentUser?.user_id || "",
            created_by: currentUser?.name || currentUser?.email || "",
            updated_by_user_id: currentUser?.user_id || "",
            updated_by: currentUser?.name || currentUser?.email || "",
            updated_by_role: currentUser?.role || "",
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
