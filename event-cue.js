export const EVENT_CUE_LEAD_MINUTES = 5;

export function minutesPhrase(minutes) {
  const n = Math.max(1, Number(minutes) || 1);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `Через ${n} минуту`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `Через ${n} минуты`;
  return `Через ${n} минут`;
}

export function nextEventCue(events, {
  now = Date.now(),
  shownIds = [],
  leadMinutes = EVENT_CUE_LEAD_MINUTES,
  privacy = false,
  showCalendar = true,
} = {}) {
  if (privacy || showCalendar === false) return null;
  const shown = new Set(shownIds);
  const upcoming = (events || [])
    .filter((event) => event && !event.allDay && event.id && event.start && Date.parse(event.start) > now)
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));
  for (const event of upcoming) {
    if (shown.has(event.id)) continue;
    const minutes = Math.max(1, Math.round((Date.parse(event.start) - now) / 60_000));
    if (minutes > leadMinutes) return null;
    return {
      id: event.id,
      title: event.title || "Дело",
      ownerName: event.ownerName || event.calendarName || "",
      start: event.start,
      minutes,
    };
  }
  return null;
}
