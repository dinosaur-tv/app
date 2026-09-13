// The line under a device's name, which exists to answer one question: is this thing still
// in the house? A screen that has not called home in weeks is almost always one that was
// re-paired and forgotten, and the answer has to be plain enough to act on.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function day(at) {
  return new Date(at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** How long ago a screen last said hello, in words rather than a timestamp. */
export function lastSeenPhrase(seen, now = Date.now()) {
  if (!seen) return "ни разу не выходил на связь";
  const ago = now - seen;
  if (ago < 2 * MINUTE) return "на связи";
  if (ago < HOUR) return `был ${Math.round(ago / MINUTE)} мин назад`;
  if (ago < DAY) return `был ${Math.round(ago / HOUR)} ч назад`;
  if (ago < 2 * DAY) return "был вчера";
  return `был ${day(seen)}`;
}

export function deviceTitle(device, now = Date.now()) {
  const kind = device.kind === "tv" ? "Экран" : "Телефон";
  return `${kind} · ${lastSeenPhrase(device.seen, now)} · с ${day(device.created)}`;
}
