import { normalizeDisplay } from "../control-state.js";

const API = window.DINO_API_BASE_URL || "https://api.dym-dino.ru";
const modes = ["NOW", "TODAY", "WEEK"];
const rotateMs = 18_000;
const russian = "ru-RU";

const screen = document.querySelector("#screen");
const noteEl = document.querySelector("#note");
const clockEl = document.querySelector("#clock");
const dateLine = document.querySelector("#dateLine");
const weatherLine = document.querySelector("#weatherLine");
const pairEl = document.querySelector("#pair");
const pairCode = document.querySelector("#pairCode");
const photo = document.querySelector("#photo");

let snapshot = null;
let mode = "NOW";
let session = readSession();
let rotateTimer;
let lastForcedMode = "";
let paintedKey = "";

function readSession() {
  const fromHash = location.hash.replace(/^#/, "").trim();
  if (fromHash) {
    localStorage.setItem("dinoTvSession", fromHash);
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    return fromHash;
  }
  return localStorage.getItem("dinoTvSession") || "";
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function asDate(value) {
  return new Date(value);
}

function timeOf(value) {
  const date = asDate(value);
  if (Number.isNaN(date.getTime())) return "";
  if (/T\d{2}:\d{2}/.test(value) === false && value.length <= 10) return "весь день";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function titleOf(event) {
  if (!snapshot?.display?.privacy) return event.title;
  return "Личное";
}

function dayKey(value, now = new Date()) {
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00+03:00`)
    : asDate(value);
  if (Number.isNaN(date.getTime())) return todayStamp(now);
  return todayStamp(date);
}

function eventsFor(date) {
  return (snapshot?.days || []).flatMap((item) => item.events || []).filter((event) => dayKey(event.start) === date);
}

function todayStamp(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const pick = (type) => parts.find((part) => part.type === type)?.value;
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function weekDates(now = new Date()) {
  const start = todayStamp(now);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${start}T12:00:00+03:00`);
    date.setDate(date.getDate() + index);
    return todayStamp(date);
  });
}

function upcomingEvents(now = new Date(), limit = 5) {
  const stamp = now.toISOString();
  return (snapshot?.days || [])
    .flatMap((day) => day.events || [])
    .filter((event) => event.end >= stamp)
    .slice(0, limit);
}

function nextEvent(now = new Date()) {
  return upcomingEvents(now, 1)[0];
}

function minutesUntil(event, now = new Date()) {
  const start = asDate(event.start).getTime() - now.getTime();
  return Math.max(0, Math.round(start / 60_000));
}

function waitLabel(event, now = new Date()) {
  const start = asDate(event.start);
  if (start.getTime() <= now.getTime()) return "Сейчас";
  const mins = minutesUntil(event, now);
  if (mins < 60) return `Через ${mins} мин`;
  const hours = Math.max(1, Math.round(mins / 60));
  if (dayKey(event.start, now) === todayStamp(now)) return `Через ${hours} ч`;
  const tomorrow = weekDates(now)[1];
  if (dayKey(event.start, now) === tomorrow) return `Завтра в ${timeOf(event.start)}`;
  return `${start.toLocaleDateString(russian, { weekday: "short", day: "numeric", month: "short" })} · ${timeOf(event.start)}`;
}

function eventRow(event) {
  return `<div class="event">
    <i style="background:${event.color}"></i>
    <div>
      <strong>${escapeHtml(titleOf(event))}</strong>
      <div class="muted">${timeOf(event.start)} — ${timeOf(event.end)} · ${escapeHtml(event.calendarName)}</div>
    </div>
  </div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function renderNow(now) {
  const next = nextEvent(now);
  const rest = upcomingEvents(now, 6).filter((event) => event.id !== next?.id).slice(0, 4);
  return `<section class="grid-now">
    <article class="card next-card">
      <p class="kicker">Дальше</p>
      ${next ? `<h3>${escapeHtml(titleOf(next))}</h3>
        <p class="muted">${timeOf(next.start)} — ${timeOf(next.end)} · ${escapeHtml(next.calendarName)}</p>
        <p class="when">${waitLabel(next, now)}</p>` : `<h3>Свободно</h3><p class="muted">В календаре больше ничего нет.</p>`}
    </article>
    <article class="card">
      <p class="kicker">Ближайшее</p>
      <div class="events">${rest.length ? rest.map((event) => eventRow(event)).join("") : `<p class="empty">Больше ничего рядом нет.</p>`}</div>
    </article>
  </section>`;
}

function renderToday(now) {
  const today = eventsFor(todayStamp(now));
  const weather = snapshot.weather;
  const periods = weather.periods?.length ? weather.periods : [];
  const hours = weather.hours || [];
  return `<section class="grid-today">
    <article class="card">
      <p class="kicker">Расписание</p>
      <div class="events">${today.length ? today.map((event) => eventRow(event)).join("") : `<p class="empty">Сегодня можно никуда не спешить.</p>`}</div>
    </article>
    <article class="card">
      <p class="kicker">Погода</p>
      <div class="weather-now"><b>${weather.temperature}°</b><div>${escapeHtml(weather.description)}<div class="muted">${weather.high}° / ${weather.low}°</div></div></div>
      <div class="periods">${periods.map((period) => `<div class="period"><small>${escapeHtml(period.label)}</small><b>${period.temperature}°</b><small>${escapeHtml(period.description)}</small></div>`).join("")}</div>
      <div class="hours">${hours.map((hour) => `<span><small>${pad(hour.hour)}:00</small><b>${hour.temperature}°</b></span>`).join("")}</div>
    </article>
  </section>`;
}

function renderWeek(now) {
  const weekday = new Intl.DateTimeFormat(russian, { weekday: "short" });
  const weekdayLong = new Intl.DateTimeFormat(russian, { weekday: "long", day: "numeric", month: "long" });
  const days = weekDates(now).map((date) => {
    const stamp = new Date(`${date}T12:00:00+03:00`);
    return {
      date,
      stamp,
      events: eventsFor(date),
      current: date === todayStamp(now),
    };
  });
  const busy = days.filter((day) => day.events.length);
  return `<section class="week">
    <div class="week-strip">${days.map((day) => `<div class="strip-day ${day.current ? "today" : ""} ${day.events.length ? "" : "idle"}">
      <small>${weekday.format(day.stamp)}</small>
      <b>${day.stamp.getDate()}</b>
      <span>${day.events.length ? `${day.events.length}` : ""}</span>
    </div>`).join("")}</div>
    <div class="week-agenda">${busy.length ? busy.map((day) => `<article class="card">
      <p class="kicker">${weekdayLong.format(day.stamp)}</p>
      <div class="events">${day.events.map((event) => eventRow(event)).join("")}</div>
    </article>`).join("") : `<article class="card"><p class="empty">На ближайшие семь дней ничего не стоит.</p></article>`}</div>
  </section>`;
}

function paintClock(now = new Date()) {
  clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  dateLine.textContent = now.toLocaleDateString(russian, { weekday: "long", day: "numeric", month: "long" });
  const weather = snapshot?.weather;
  weatherLine.textContent = weather ? `${weather.temperature}° · ${weather.description}` : "";
}

function paint(force = false) {
  if (!snapshot) return;
  const now = new Date();
  const display = normalizeDisplay(snapshot.display);
  document.body.dataset.theme = display.theme;
  document.body.classList.toggle("has-photo", Boolean(snapshot.display.backgroundUrl));
  photo.style.backgroundImage = snapshot.display.backgroundUrl ? `url("${snapshot.display.backgroundUrl}")` : "";
  paintClock(now);
  document.querySelectorAll("#modes [data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  if (snapshot.display.note?.text) {
    noteEl.hidden = false;
    noteEl.textContent = snapshot.display.note.text;
  } else {
    noteEl.hidden = true;
  }
  const key = `${mode}|${snapshot.generatedAt}|${display.theme}|${display.privacy}|${snapshot.display.note?.text || ""}|${snapshot.display.backgroundUrl || ""}|${now.getMinutes()}`;
  if (!force && key === paintedKey) return;
  paintedKey = key;
  screen.innerHTML = mode === "WEEK" ? renderWeek(now) : mode === "TODAY" ? renderToday(now) : renderNow(now);
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (session) headers.authorization = `Bearer ${session}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  if (response.status === 401) {
    session = "";
    localStorage.removeItem("dinoTvSession");
    throw new Error("auth");
  }
  if (!response.ok) throw new Error(await response.text() || "request failed");
  return response.json();
}

async function loadSnapshot() {
  const data = await request("/v1/display/snapshot");
  snapshot = data;
  if (modes.includes(data.display?.mode) && data.display.mode !== lastForcedMode) {
    mode = data.display.mode;
    lastForcedMode = data.display.mode;
    if (session) startRotation();
  }
  paint(true);
}

async function startPairing() {
  pairEl.hidden = false;
  const started = await fetch(`${API}/v1/display/pair/start`, { method: "POST" }).then((response) => response.json());
  pairCode.textContent = started.code;
  const wait = async () => {
    const status = await fetch(`${API}/v1/display/pair/wait?pairId=${encodeURIComponent(started.pairId)}`).then((response) => response.json());
    if (status.status === "ready" && status.session) {
      session = status.session;
      localStorage.setItem("dinoTvSession", session);
      pairEl.hidden = true;
      await loadSnapshot();
      startRotation();
      return;
    }
    if (status.status === "expired") {
      await startPairing();
      return;
    }
    setTimeout(wait, 2000);
  };
  wait();
}

function startRotation() {
  clearInterval(rotateTimer);
  rotateTimer = setInterval(() => {
    mode = modes[(modes.indexOf(mode) + 1) % modes.length];
    paint(true);
  }, rotateMs);
}

document.querySelectorAll("#modes [data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    paint(true);
    startRotation();
  });
});

setInterval(() => {
  const now = new Date();
  if (!snapshot) return;
  paintClock(now);
  if (now.getSeconds() === 0) paint();
}, 1000);
setInterval(() => { if (session) loadSnapshot().catch(() => {}); }, 20_000);

async function boot() {
  if (["127.0.0.1", "localhost"].includes(location.hostname)) {
    try {
      const preview = await fetch("./_preview.json").then((response) => (response.ok ? response.json() : null));
      if (preview) {
        snapshot = preview;
        pairEl.hidden = true;
        paint(true);
        startRotation();
        return;
      }
    } catch {
      // Live pairing still works without a local snapshot fixture.
    }
  }
  if (session) {
    loadSnapshot().then(startRotation).catch(startPairing);
  } else {
    startPairing();
  }
}

boot();
