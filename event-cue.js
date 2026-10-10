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

/** The quiet line under the clock: soonest timed event still ahead, else one that is live. */
export function nextUpEvent(events, {
  now = Date.now(),
  privacy = false,
  showCalendar = true,
} = {}) {
  if (privacy || showCalendar === false) return null;
  const timed = (events || []).filter((event) => event && !event.allDay && event.start && event.end);
  const upcoming = timed
    .filter((event) => Date.parse(event.start) > now)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const next = upcoming[0];
  if (next) {
    return {
      title: next.title || "Дело",
      start: next.start,
      minutes: Math.max(1, Math.round((Date.parse(next.start) - now) / 60_000)),
      live: false,
    };
  }
  const live = timed
    .filter((event) => Date.parse(event.start) <= now && Date.parse(event.end) > now)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  if (!live) return null;
  return { title: live.title || "Дело", start: live.start, minutes: 0, live: true };
}

function clockStamp(value, timeZone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

function dayStamp(value, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

/** One glance from the sofa: when, then what. */
export function nextUpPhrase(event, { now = Date.now(), timeZone = "Europe/Moscow" } = {}) {
  if (!event) return "";
  const title = event.title || "Дело";
  if (event.live) return `Сейчас · ${title}`;
  const minutes = Math.max(1, Number(event.minutes) || 1);
  if (minutes <= 90) return `Через ${minutes} мин · ${title}`;
  const startDay = dayStamp(event.start, timeZone);
  const today = dayStamp(now, timeZone);
  const tomorrow = dayStamp(now + 24 * 60 * 60 * 1000, timeZone);
  const time = clockStamp(event.start, timeZone);
  if (startDay === today) return `в ${time} · ${title}`;
  if (startDay === tomorrow) return `Завтра в ${time} · ${title}`;
  const weekday = new Intl.DateTimeFormat("ru-RU", { timeZone, weekday: "short" }).format(new Date(event.start));
  return `${weekday} в ${time} · ${title}`;
}
