import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { Thai } from "flatpickr/dist/l10n/th.js";
import { formatThaiDate, parseAppDateTime } from "../../utils/datetime";

function syncBuddhistYearHeader(instance) {
  if (!instance?.calendarContainer) return;

  instance.calendarContainer.classList.add("booking-flatpickr-calendar");

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
    disabled = false,
    required = false,
  },
  ref
) {
  const inputRef = useRef(null);
  const pickerRef = useRef(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useImperativeHandle(
    ref,
    () => ({
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
    }),
    []
  );

  useEffect(() => {
    if (!inputRef.current) return undefined;

    const normalizedDefaultDate =
      value instanceof Date
        ? value
        : value
          ? parseAppDateTime(value) || String(value).trim().split(" ")[0]
          : undefined;

    const instance = flatpickr(inputRef.current, {
      enableTime: false,
      noCalendar: false,
      locale: {
        ...Thai,
        today: "วันนี้",
      },
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d/m/Y",
      allowInput: false,
      disableMobile: true,
      defaultDate: normalizedDefaultDate,
      formatDate: (date, formatStr, locale) => {
        if (formatStr === "d/m/Y") {
          return formatThaiDate(date);
        }

        return flatpickr.formatDate(date, formatStr, locale);
      },
      parseDate: (dateStr, formatStr) => {
        const parsed = parseAppDateTime(dateStr);
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
              onChangeRef.current?.(currentInstance.input.value || "");
            },
          ]
        : undefined,
      onValueUpdate: onChange
        ? [
            (_, __, currentInstance) => {
              onChangeRef.current?.(currentInstance.input.value || "");
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
  }, [showTodayButton]);

  useEffect(() => {
    const instance = pickerRef.current;
    if (!instance) return;

    const normalizedValue = value ? parseAppDateTime(value) || String(value).trim().split(" ")[0] : "";
    const currentValue = String(instance.input.value || "").trim();

    if (!normalizedValue) {
      if (currentValue) {
        instance.clear(false);
      }
      return;
    }

    const nextValue = normalizedValue instanceof Date ? normalizedValue : normalizedValue;
    const nextSerialized = nextValue instanceof Date ? flatpickr.formatDate(nextValue, "Y-m-d") : String(nextValue);

    if (currentValue !== nextSerialized) {
      instance.setDate(nextValue, false);
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      id={id}
      className={`thai-datetime-source-input thai-datetime-picker-input ${className}`.trim()}
      type="text"
      lang="en-GB"
      placeholder={placeholder}
      disabled={disabled}
      required={required}
    />
  );
});

export default ThaiDateTimePicker;
