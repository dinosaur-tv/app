export const EVENT_CUE_LEADS = [30, 5];

export function minutesPhrase(minutes) {
  const n = Math.max(1, Number(minutes) || 1);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `Через ${n} минуту`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `Через ${n} минуты`;
  return `Через ${n} минут`;
}

export function cueInBand(minutes, lead) {
  const n = Math.max(1, Number(minutes) || 1);
  if (lead === 30) return n >= 6 && n <= 30;
  if (lead === 5) return n >= 1 && n <= 5;
  return n >= 1 && n <= lead;
}

export function nextEventCue(events, {
  now = Date.now(),
  shownIds = [],
  leads = EVENT_CUE_LEADS,
  privacy = false,
  showCalendar = true,
} = {}) {
  if (privacy || showCalendar === false) return null;
  const shown = new Set(shownIds);
  const upcoming = (events || [])
    .filter((event) => event && !event.allDay && event.id && event.start && Date.parse(event.start) > now)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  for (const event of upcoming) {
    const minutes = Math.max(1, Math.round((Date.parse(event.start) - now) / 60_000));
    for (const lead of leads) {
      if (!cueInBand(minutes, lead)) continue;
      const id = `${event.id}@${lead}`;
      if (shown.has(id)) continue;
      return {
        id,
        title: event.title || "Дело",
        ownerName: event.ownerName || event.calendarName || "",
        start: event.start,
        minutes,
      };
    }
  }
  return null;
}
