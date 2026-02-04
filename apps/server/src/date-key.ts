export const toUtcDateKey = (date: Date = new Date()) =>
  date.toISOString().slice(0, 10);

const formatDateKeyInTimeZone = (date: Date, timeZone: string): string | null => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  let year = "";
  let month = "";
  let day = "";

  for (const part of parts) {
    if (part.type === "year") year = part.value;
    if (part.type === "month") month = part.value;
    if (part.type === "day") day = part.value;
  }

  if (!year || !month || !day) {
    return null;
  }

  return `${year}-${month}-${day}`;
};

export const toDateKeyInTimeZone = (
  date: Date,
  timeZone?: string | null
): string => {
  if (!timeZone) {
    return toUtcDateKey(date);
  }

  try {
    return formatDateKeyInTimeZone(date, timeZone) ?? toUtcDateKey(date);
  } catch {
    return toUtcDateKey(date);
  }
};

export const shiftDateKey = (dateKey: string, offsetDays: number): string => {
  if (!dateKey) {
    return toUtcDateKey();
  }

  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return dateKey;
  }

  const shifted = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return toUtcDateKey(shifted);
};
