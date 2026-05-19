import { useEffect, useMemo, useState } from "react";
import ThaiDateTimePicker from "./ThaiDateTimePicker";
import { combineThaiDateAndTime, splitDateTime } from "../../utils/datetime";

function buildHourOptions() {
  return Array.from({ length: 24 }, (_, index) => {
    const value = String(index).padStart(2, "0");
    return { value, label: value };
  });
}

function buildMinuteOptions(minuteStep, currentMinute) {
  const step = Number.isFinite(Number(minuteStep)) && Number(minuteStep) > 0 ? Number(minuteStep) : 5;
  const values = [];

  for (let minute = 0; minute < 60; minute += step) {
    values.push(String(minute).padStart(2, "0"));
  }

  const normalizedCurrent = String(currentMinute ?? "").padStart(2, "0");
  if (
    normalizedCurrent &&
    !values.includes(normalizedCurrent) &&
    Number(normalizedCurrent) >= 0 &&
    Number(normalizedCurrent) < 60
  ) {
    values.push(normalizedCurrent);
    values.sort((a, b) => Number(a) - Number(b));
  }

  return values.map((value) => ({ value, label: value }));
}

export default function ThaiDateTimeField({
  id,
  label,
  value,
  onChange,
  placeholder,
  minuteStep = 5,
  disabled = false,
  required = false,
}) {
  const initialParts = useMemo(() => splitDateTime(value), [value]);
  const [dateValue, setDateValue] = useState(initialParts.date);
  const [hourValue, setHourValue] = useState(initialParts.hour);
  const [minuteValue, setMinuteValue] = useState(initialParts.minute);

  useEffect(() => {
    const nextParts = splitDateTime(value);

    setDateValue((current) => (current === nextParts.date ? current : nextParts.date));
    setHourValue((current) => (current === nextParts.hour ? current : nextParts.hour));
    setMinuteValue((current) => (current === nextParts.minute ? current : nextParts.minute));
  }, [value]);

  const hourOptions = useMemo(() => buildHourOptions(), []);
  const minuteOptions = useMemo(
    () => buildMinuteOptions(minuteStep, minuteValue),
    [minuteStep, minuteValue]
  );

  const emitChange = (nextDate, nextHour, nextMinute) => {
    if (!onChange) return;
    onChange(combineThaiDateAndTime(nextDate, nextHour, nextMinute));
  };

  const handleDateChange = (nextDate) => {
    setDateValue(nextDate || "");
    emitChange(nextDate || "", hourValue, minuteValue);
  };

  const handleHourChange = (nextHour) => {
    setHourValue(nextHour);
    emitChange(dateValue, nextHour, minuteValue);
  };

  const handleMinuteChange = (nextMinute) => {
    setMinuteValue(nextMinute);
    emitChange(dateValue, hourValue, nextMinute);
  };

  const dateInputId = id ? `${id}` : undefined;
  const hourInputId = id ? `${id}_hour` : undefined;
  const minuteInputId = id ? `${id}_minute` : undefined;

  return (
    <div className="thai-datetime-field">
      <div className="thai-datetime-label-row">
        {label ? (
          <label className="thai-datetime-main-label" htmlFor={dateInputId}>
            {label}
          </label>
        ) : (
          <div />
        )}

        <div className="thai-datetime-time-labels" aria-hidden="true">
          <span>ชั่วโมง</span>
          <span />
          <span>นาที</span>
        </div>
      </div>

      <div className="thai-datetime-input-row">
        <div className="thai-datetime-date-col">
          <ThaiDateTimePicker
            id={dateInputId}
            value={dateValue}
            onChange={handleDateChange}
            placeholder={placeholder}
            showTodayButton={false}
            disabled={disabled}
            required={required}
          />
        </div>

        <div className="thai-datetime-time-row" aria-label={label || "เวลา"}>
          <label className="sr-only" htmlFor={hourInputId}>
            ชั่วโมง
          </label>
          <select
            id={hourInputId}
            className="thai-hour-input"
            value={hourValue}
            onChange={(e) => handleHourChange(e.target.value)}
            disabled={disabled}
            required={required}
            aria-label="ชั่วโมง"
          >
            {hourOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <span className="thai-time-separator" aria-hidden="true">
            :
          </span>

          <label className="sr-only" htmlFor={minuteInputId}>
            นาที
          </label>
          <select
            id={minuteInputId}
            className="thai-minute-input"
            value={minuteValue}
            onChange={(e) => handleMinuteChange(e.target.value)}
            disabled={disabled}
            required={required}
            aria-label="นาที"
          >
            {minuteOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
