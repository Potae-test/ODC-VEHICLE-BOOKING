import { parseAppDateTime, pad2 } from "./datetime";

const THAI_SHORT_MONTH_LABELS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

function getSafeDate(value) {
  return parseAppDateTime(value);
}

export function formatThaiDate(value) {
  const date = getSafeDate(value);
  if (!date) return "-";

  return `${date.getDate()} ${THAI_SHORT_MONTH_LABELS[date.getMonth()]} ${date.getFullYear() + 543}`;
}

export function formatThaiTime(value) {
  const date = getSafeDate(value);
  if (!date) return "-";

  return `${pad2(date.getHours())}:${pad2(date.getMinutes())} น.`;
}

export function formatThaiDateTime(value) {
  const date = getSafeDate(value);
  if (!date) return "-";

  return `${formatThaiDate(date)} เวลา ${pad2(date.getHours())}:${pad2(date.getMinutes())} น.`;
}

export function formatThaiNotificationDateTime(value) {
  if (!value) return "";

  const formatted = formatThaiDateTime(value);
  return formatted === "-" ? "" : formatted;
}
