export const DATE_PRESET_IDS = [
  "date-iso-dash",
  "date-iso-slash",
  "date-us",
  "date-eu",
];

export function buildDateConversionChanges(rows, column, sourcePresetId, targetPresetId) {
  if (!DATE_PRESET_IDS.includes(sourcePresetId) || !DATE_PRESET_IDS.includes(targetPresetId)) {
    return {
      valid: false,
      error: "Choose a built in source and target date format",
      changes: [],
      changeCount: 0,
      skippedCount: 0,
      emptyCount: 0,
    };
  }

  const changes = [];
  let skippedCount = 0;
  let emptyCount = 0;

  for (const row of rows) {
    const before = row[column] ?? "";
    const text = String(before).trim();
    if (!text) {
      emptyCount += 1;
      continue;
    }

    const parts = parseDateParts(text, targetPresetId) ?? parseDateParts(text, sourcePresetId);
    if (!parts) {
      skippedCount += 1;
      continue;
    }

    const after = formatDateParts(parts, targetPresetId);
    if (String(before) !== after) {
      changes.push({ rowId: row.__rowId, column, before, after });
    }
  }

  return {
    valid: true,
    error: "",
    changes,
    changeCount: changes.length,
    skippedCount,
    emptyCount,
  };
}

export function isDate(value, presetId = "date-iso-dash") {
  return Boolean(parseDateParts(String(value ?? "").trim(), presetId));
}

export function parseDateParts(value, presetId) {
  const text = String(value ?? "").trim();
  let match;
  let parts;

  if (presetId === "date-iso-dash") {
    match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    parts = match && { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  } else if (presetId === "date-iso-slash") {
    match = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    parts = match && { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  } else if (presetId === "date-us") {
    match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    parts = match && { year: Number(match[3]), month: Number(match[1]), day: Number(match[2]) };
  } else if (presetId === "date-eu") {
    match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    parts = match && { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) };
  }

  if (!parts || !isRealDate(parts.year, parts.month, parts.day)) return null;
  return parts;
}

export function formatDateParts(parts, presetId) {
  const year = String(parts.year).padStart(4, "0");
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");

  if (presetId === "date-iso-dash") return `${year}-${month}-${day}`;
  if (presetId === "date-iso-slash") return `${year}/${month}/${day}`;
  if (presetId === "date-us") return `${month}/${day}/${year}`;
  if (presetId === "date-eu") return `${day}/${month}/${year}`;
  return "";
}

export function isRealDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
