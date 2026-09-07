import { normalizeDisplay } from "../control-state.js";

const API = window.DINO_API_BASE_URL || "https://api.dym-dino.ru";
const modes = ["NOW", "TODAY", "WEEK"];
const rotateMs = 18_000;
const russian = "ru-RU";

const screen = document.querySelector("#screen");
const noteEl = document.querySelector("#note");
const clockEl = document.querySelector("#clock");
const dateLine = document.querySelector("#dateLine");
const pairEl = document.querySelector("#pair");
const pairCode = document.querySelector("#pairCode");
const photo = document.querySelector("#photo");

let snapshot = null;
let mode = "NOW";
let session = readSession();
let rotateTimer;
let lastForcedMode = "";

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

function eventsFor(date) {
  const day = (snapshot?.days || []).find((item) => item.date === date);
  return day?.events || [];
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

function nextEvent(now = new Date()) {
  const stamp = now.toISOString();
  return (snapshot?.days || []).flatMap((day) => day.events).find((event) => event.end >= stamp);
}

function minutesUntil(event, now = new Date()) {
  const start = asDate(event.start).getTime() - now.getTime();
  return Math.max(0, Math.round(start / 60_000));
}

function eventRow(event, large = false) {
  return `<div class="event">
    <i style="background:${event.color}"></i>
    <div>
      <strong class="${large ? "title-lg" : ""}">${escapeHtml(titleOf(event))}</strong>
      <div class="muted">${timeOf(event.start)} — ${timeOf(event.end)} · ${escapeHtml(event.calendarName)}</div>
    </div>
  </div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function renderNow(now) {
  const next = nextEvent(now);
  const today = eventsFor(todayStamp(now));
  const weather = snapshot.weather;
  const wait = next ? minutesUntil(next, now) : 0;
  return `<section class="grid-now">
    <div class="stack">
      <div class="hero">
        <p class="muted">${now.toLocaleDateString(russian, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1>${pad(now.getHours())}:${pad(now.getMinutes())}</h1>
        <p class="gold">Ваш дом. Ваш ритм.</p>
      </div>
      <div class="weather-now">
        <b>${weather.temperature}°</b>
        <div>
          <div>${escapeHtml(weather.description)}</div>
          <div class="muted">${escapeHtml(weather.location)} · ощущается как ${weather.feelsLike}°</div>
        </div>
      </div>
    </div>
    <div class="stack">
      <article class="card next-card">
        <p class="kicker">Дальше</p>
        ${next ? `<h3>${escapeHtml(titleOf(next))}</h3>
          <p class="muted">${timeOf(next.start)} — ${timeOf(next.end)} · ${escapeHtml(next.calendarName)}</p>
          <p class="when">${wait === 0 ? "Сейчас" : `Через ${wait} мин`}</p>` : `<h3>Свободный вечер</h3><p class="muted">В календаре больше ничего нет.</p>`}
      </article>
      <article class="card">
        <p class="kicker">Сегодня</p>
        <div class="events">${today.length ? today.map((event) => eventRow(event)).join("") : `<p class="empty">Сегодня можно никуда не спешить.</p>`}</div>
      </article>
    </div>
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
      <div class="events">${today.length ? today.map((event) => eventRow(event, true)).join("") : `<p class="empty">Сегодня можно никуда не спешить.</p>`}</div>
    </article>
    <div class="stack">
      <article class="card">
        <p class="kicker">Погода</p>
        <div class="weather-now"><b>${weather.temperature}°</b><div>${escapeHtml(weather.description)}<div class="muted">${weather.high}° / ${weather.low}°</div></div></div>
        <div class="periods">${periods.map((period) => `<div class="period"><small>${escapeHtml(period.label)}</small><b>${period.temperature}°</b><small>${escapeHtml(period.description)}</small></div>`).join("")}</div>
        <div class="hours">${hours.map((hour) => `<span><small>${pad(hour.hour)}:00</small><b>${hour.temperature}°</b></span>`).join("")}</div>
      </article>
    </div>
  </section>`;
}

function renderWeek(now) {
  const formatter = new Intl.DateTimeFormat(russian, { weekday: "long" });
  const dayNum = new Intl.DateTimeFormat(russian, { day: "numeric", month: "short" });
  return `<section class="week">${weekDates(now).map((date) => {
    const events = eventsFor(date);
    const current = date === todayStamp(now);
    return `<article class="card ${current ? "today" : ""}">
      <div class="day-name">${formatter.format(new Date(`${date}T12:00:00+03:00`))}</div>
      <div class="title-lg">${dayNum.format(new Date(`${date}T12:00:00+03:00`))}</div>
      <div class="events">${events.length ? events.slice(0, 6).map((event) => eventRow(event)).join("") : `<p class="empty">Свободно</p>`}</div>
    </article>`;
  }).join("")}</section>`;
}

function paint() {
  if (!snapshot) return;
  const now = new Date();
  const display = normalizeDisplay(snapshot.display);
  document.body.dataset.theme = display.theme;
  document.body.classList.toggle("has-photo", Boolean(snapshot.display.backgroundUrl));
  photo.style.backgroundImage = snapshot.display.backgroundUrl ? `url("${snapshot.display.backgroundUrl}")` : "";
  dateLine.textContent = now.toLocaleDateString(russian, { weekday: "long", day: "numeric", month: "long" });
  clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  document.querySelectorAll("#modes [data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  if (snapshot.display.note?.text) {
    noteEl.hidden = false;
    noteEl.textContent = snapshot.display.note.text;
  } else {
    noteEl.hidden = true;
  }
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
  paint();
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
    paint();
  }, rotateMs);
}

document.querySelectorAll("#modes [data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    paint();
    startRotation();
  });
});

setInterval(() => { if (snapshot) paint(); }, 1000);
setInterval(() => { if (session) loadSnapshot().catch(() => {}); }, 20_000);

if (session) {
  loadSnapshot().then(startRotation).catch(startPairing);
} else {
  startPairing();
}
