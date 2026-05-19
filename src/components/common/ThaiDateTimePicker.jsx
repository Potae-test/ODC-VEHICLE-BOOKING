import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { Thai } from "flatpickr/dist/l10n/th.js";

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatThaiDateTimeValue(date) {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear() + 543} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
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

function ensureTimeLabels(instance) {
  const timeContainer = instance?.calendarContainer?.querySelector(".flatpickr-time");
  if (!timeContainer || timeContainer.querySelector(".thai-time-label-row")) return;

  const labelRow = document.createElement("div");
  labelRow.className = "thai-time-label-row";
  labelRow.innerHTML = `
    <span>เวลา</span>
    <span>นาที</span>
  `;

  timeContainer.prepend(labelRow);
}

function ensureTimeGridLabels(instance) {
  const timeContainer = instance?.calendarContainer?.querySelector(".flatpickr-time");
  if (!timeContainer || timeContainer.querySelector(".thai-time-grid-labels")) return;

  const legacyLabels = timeContainer.querySelector(".thai-time-label-row");
  if (legacyLabels) {
    legacyLabels.remove();
  }

  const labelRow = document.createElement("div");
  labelRow.className = "thai-time-grid-labels";
  labelRow.innerHTML = `
    <span>เวลา</span>
    <span>นาที</span>
  `;

  timeContainer.prepend(labelRow);
}

function syncBuddhistYearHeader(instance) {
  if (!instance?.calendarContainer) return;

  instance.calendarContainer.classList.add("booking-flatpickr-calendar");
  ensureTimeGridLabels(instance);

  const yearInput = instance.currentYearElement;
  if (yearInput) {
    yearInput.value = String(instance.currentYear + 543);
    yearInput.setAttribute("inputmode", "numeric");
  }
}

const ThaiDateTimePicker = forwardRef(function ThaiDateTimePicker(
  {
    value,
    onChange,
    placeholder,
    id,
    showTodayButton = true,
    className = "",
  },
  ref
) {
  const inputRef = useRef(null);
  const pickerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    clear() {
      pickerRef.current?.clear?.();
    },
    setDate(nextValue, triggerChange = true) {
      pickerRef.current?.setDate?.(nextValue, triggerChange);
    },
    destroy() {
      pickerRef.current?.destroy?.();
      pickerRef.current = null;
    },
  }), []);

  useEffect(() => {
    if (!inputRef.current) return undefined;

    const normalizedDefaultDate =
      value instanceof Date
        ? value
        : value
          ? String(value).trim().replace("T", " ")
          : undefined;

    const instance = flatpickr(inputRef.current, {
      enableTime: true,
      noCalendar: false,
      time_24hr: true,
      minuteIncrement: 5,
      locale: {
        ...Thai,
        today: "วันนี้",
      },
      dateFormat: "Y-m-d H:i",
      altInput: true,
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
      onMonthChange: [(_, __, currentInstance) => syncBuddhistYearHeader(currentInstance)],
      onYearChange: [(_, __, currentInstance) => syncBuddhistYearHeader(currentInstance)],
      onReady: [
        (_, __, currentInstance) => {
          syncBuddhistYearHeader(currentInstance);

          if (showTodayButton && !currentInstance.calendarContainer.querySelector(".thai-picker-footer")) {
            const footer = document.createElement("div");
            footer.className = "thai-picker-footer";
            footer.innerHTML = `
              <button
                type="button"
                class="thai-picker-today"
              >
                วันนี้
              </button>
            `;

            footer.onclick = () => {
              currentInstance.setDate(new Date(), true);
            };

            currentInstance.calendarContainer.appendChild(footer);
          }
        },
      ],
      onChange: onChange
        ? [
            (_, __, currentInstance) => {
              onChange(currentInstance.input.value || "");
            },
          ]
        : undefined,
      onValueUpdate: onChange
        ? [
            (_, __, currentInstance) => {
              onChange(currentInstance.input.value || "");
            },
          ]
        : undefined,
    });

    syncBuddhistYearHeader(instance);
    pickerRef.current = instance;

    return () => {
      pickerRef.current?.destroy?.();
      pickerRef.current = null;
    };
  }, [onChange, showTodayButton]);

  useEffect(() => {
    const instance = pickerRef.current;
    if (!instance) return;

    const normalizedValue = value ? String(value).trim().replace("T", " ") : "";
    const currentValue = String(instance.input.value || "").trim();

    if (!normalizedValue) {
      if (currentValue) {
        instance.clear(false);
      }
      return;
    }

    if (currentValue !== normalizedValue) {
      instance.setDate(normalizedValue, false);
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      id={id}
      className={`thai-datetime-source-input ${className}`.trim()}
      type="text"
      lang="en-GB"
      placeholder={placeholder}
    />
  );
});

export default ThaiDateTimePicker;
