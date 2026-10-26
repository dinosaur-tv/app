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

function dayStamp(value, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
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

const WEEKDAYS = ["в воскресенье", "в понедельник", "во вторник", "в среду", "в четверг", "в пятницу", "в субботу"];

function daysBetween(fromStamp, toStamp) {
  return Math.round((Date.parse(`${toStamp}T12:00:00Z`) - Date.parse(`${fromStamp}T12:00:00Z`)) / 86_400_000);
}

/**
 * The soonest timed event of the coming week, or the one still going. An evening with
 * nothing left used to leave the card empty although tomorrow morning was already known.
 */
export function nextUpEvent(events, {
  now = Date.now(),
  privacy = false,
  showCalendar = true,
  timeZone = "Europe/Moscow",
} = {}) {
  if (privacy || showCalendar === false) return null;
  const today = dayStamp(now, timeZone);
  const timed = (events || []).filter((event) => event && !event.allDay && event.start && event.end);
  const upcoming = timed
    .map((event) => ({ event, days: daysBetween(today, dayStamp(event.start, timeZone)) }))
    .filter(({ event, days }) => Date.parse(event.start) > now && days >= 0 && days < 7)
    .sort((a, b) => Date.parse(a.event.start) - Date.parse(b.event.start));
  const next = upcoming[0];
  if (next) {
    return {
      title: next.event.title || "Дело",
      start: next.event.start,
      minutes: Math.max(1, Math.round((Date.parse(next.event.start) - now) / 60_000)),
      days: next.days,
      live: false,
    };
  }
  const live = timed
    .filter((event) => Date.parse(event.start) <= now && Date.parse(event.end) > now)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  if (!live) return null;
  return { title: live.title || "Дело", start: live.start, minutes: 0, days: 0, live: true };
}

/** When it is, the way it would be said: soon in minutes, later today by the clock, then by the day. */
export function whenPhrase(event, { timeZone = "Europe/Moscow" } = {}) {
  const minutes = Math.max(1, Number(event.minutes) || 1);
  const days = Number(event.days) || 0;
  const clock = clockStamp(event.start, timeZone);
  if (days === 0 && minutes < 60) return `через ${minutes} мин`;
  if (days === 0 && minutes < 240) {
    const rest = minutes % 60;
    return `через ${Math.floor(minutes / 60)} ч${rest ? ` ${rest} мин` : ""}`;
  }
  if (days === 0) return `сегодня в ${clock}`;
  if (days === 1) return `завтра в ${clock}`;
  const weekday = new Date(Date.parse(`${dayStamp(event.start, timeZone)}T12:00:00Z`)).getUTCDay();
  return `${WEEKDAYS[weekday]} в ${clock}`;
}

export function nextUpPhrase(event, { timeZone = "Europe/Moscow" } = {}) {
  if (!event) return "";
  const title = event.title || "Дело";
  if (event.live) return `Сейчас · ${title}`;
  const when = whenPhrase(event, { timeZone });
  return `${when[0].toUpperCase()}${when.slice(1)} · ${title}`;
}

/**
 * Timed events going on right now. The screen used to name only what comes next, so a
 * meeting already under way disappeared from the hero the moment it started.
 */
export function liveEvents(events, {
  now = Date.now(),
  privacy = false,
  showCalendar = true,
} = {}) {
  if (privacy || showCalendar === false) return [];
  return (events || [])
    .filter((event) => event && !event.allDay && event.start && event.end
      && Date.parse(event.start) <= now && Date.parse(event.end) > now)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .map((event) => liveState(event, now));
}

/** How far along an event is, for the bar under it and the «ещё N мин» beside it. */
export function liveState(event, now = Date.now()) {
  const start = Date.parse(event.start);
  const end = Date.parse(event.end);
  const span = Math.max(1, end - start);
  return {
    ...event,
    minutesLeft: Math.max(1, Math.ceil((end - now) / 60_000)),
    progress: Math.min(1, Math.max(0, (now - start) / span)),
  };
}

export function isLiveNow(event, now = Date.now()) {
  return Boolean(event && !event.allDay && event.start && event.end
    && Date.parse(event.start) <= now && Date.parse(event.end) > now);
}

/** «ещё 25 мин» while the end is near, «до 18:30» when it is hours away. */
export function leftPhrase(event, { timeZone = "Europe/Moscow" } = {}) {
  const minutes = Math.max(1, Number(event?.minutesLeft) || 1);
  if (minutes <= 90) return `ещё ${minutes} мин`;
  return `до ${clockStamp(event.end, timeZone)}`;
}
