export const OFFICE_CHAT_POSITION_KEY = "cleansheet.office-chat-position";

export function getOfficeMessage(office, kind, turn = 0, context = {}) {
  const source = office?.[kind];
  const choices = Array.isArray(source) ? source : source ? [source] : [];
  if (!choices.length) return null;
  const choice = choices[Math.abs(turn) % choices.length];
  const entry = typeof choice === "string" ? { text: choice } : choice;
  if (!entry?.text) return null;
  return {
    sender: entry.sender ?? office.sender ?? "Unknown coworker",
    department: entry.department ?? office.department ?? "Somewhere in the building",
    text: interpolateOfficeText(entry.text, context),
    kind,
  };
}

function interpolateOfficeText(text, context = {}) {
  return String(text).replace(/\{\{(\w+)\}\}/g, (match, key) => (
    context[key] == null ? match : String(context[key])
  ));
}

export function clampOfficePosition(position, size, viewport, margin = 8) {
  const maxRight = Math.max(margin, viewport.width - size.width - margin);
  const maxTop = Math.max(margin, viewport.height - size.height - margin);
  return {
    right: clampNumber(position.right, margin, maxRight),
    top: clampNumber(position.top, margin, maxTop),
  };
}

export function readOfficePosition(storage = globalThis.window?.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(OFFICE_CHAT_POSITION_KEY) ?? "null");
    if (!Number.isFinite(parsed?.right) || !Number.isFinite(parsed?.top)) return null;
    return { right: parsed.right, top: parsed.top };
  } catch {
    return null;
  }
}

export function writeOfficePosition(position, storage = globalThis.window?.localStorage) {
  try {
    storage?.setItem(OFFICE_CHAT_POSITION_KEY, JSON.stringify(position));
  } catch {
    // The Inbox can still move for the current session when storage is unavailable.
  }
}

function clampNumber(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}
