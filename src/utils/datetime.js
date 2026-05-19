function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function pad2(value) {
  return String(toInteger(value)).padStart(2, "0");
}

export function parseAppDateTime(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const thaiMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (thaiMatch) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = thaiMatch;
    return new Date(
      Number(year) - 543,
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      0
    );
  }

  const gregorianMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (gregorianMatch) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = gregorianMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      0
    );
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function formatThaiDate(date) {
  const parsed = parseAppDateTime(date);
  if (!parsed) return "";

  return `${pad2(parsed.getDate())}/${pad2(parsed.getMonth() + 1)}/${parsed.getFullYear() + 543}`;
}

export function formatThaiTime(date) {
  const parsed = parseAppDateTime(date);
  if (!parsed) return "";

  return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
}

export function toLocalDateTimeString(date, time) {
  const parsed = parseAppDateTime(date);
  if (!parsed) return "";

  const next = new Date(parsed.getTime());
  if (time) {
    const [hour = "0", minute = "0"] = String(time).trim().split(":");
    next.setHours(toInteger(hour), toInteger(minute), 0, 0);
  }

  return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(next.getDate())} ${pad2(
    next.getHours()
  )}:${pad2(next.getMinutes())}`;
}

export function splitDateTime(value) {
  const parsed = parseAppDateTime(value);
  if (!parsed) {
    return {
      date: "",
      hour: "00",
      minute: "00",
    };
  }

  return {
    date: `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`,
    hour: pad2(parsed.getHours()),
    minute: pad2(parsed.getMinutes()),
  };
}

export function combineThaiDateAndTime(dateValue, hour, minute) {
  const parsedDate = parseAppDateTime(dateValue);
  if (!parsedDate) return "";

  const next = new Date(parsedDate.getTime());
  next.setHours(toInteger(hour), toInteger(minute), 0, 0);

  return toLocalDateTimeString(next);
}
