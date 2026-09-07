import { normalizeDisplay, screenTheme, shouldApplyTvReload } from "../control-state.js";

const API = window.DINO_API_BASE_URL || "https://api.dym-dino.ru";
const modes = ["NOW", "TODAY", "WEEK"];
const rotateMs = 30_000;
const russian = "ru-RU";

const screen = document.querySelector("#screen");
const noteEl = document.querySelector("#note");
const clockEl = document.querySelector("#clock");
const dateLine = document.querySelector("#dateLine");
const weatherLine = document.querySelector("#weatherLine");
const pairEl = document.querySelector("#pair");
const pairCode = document.querySelector("#pairCode");
const photo = document.querySelector("#photo");
const mediaBar = document.querySelector("#mediaBar");
const mediaArt = document.querySelector("#mediaArt");
const mediaTitle = document.querySelector("#mediaTitle");
const mediaArtist = document.querySelector("#mediaArtist");
const mediaState = document.querySelector("#mediaState");
const mediaVolume = document.querySelector("#mediaVolume");
const volumeFill = document.querySelector("#volumeFill");

let snapshot = null;
let mode = "NOW";
let session = readSession();
let rotateTimer;
let lastForcedMode = "";
let paintedKey = "";
let appliedReloadAt = localStorage.getItem("dinoTvReloadAt") || "";

function flushTvApp(reloadAt) {
  if (!shouldApplyTvReload(appliedReloadAt, reloadAt)) return false;
  appliedReloadAt = reloadAt;
  localStorage.setItem("dinoTvReloadAt", reloadAt);
  const next = new URL(location.href);
  next.searchParams.set("r", String(Date.now()));
  location.replace(next.toString());
  return true;
}

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
  return event.title;
}

function dayKey(value, now = new Date()) {
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00+03:00`)
    : asDate(value);
  if (Number.isNaN(date.getTime())) return todayStamp(now);
  return todayStamp(date);
}

function isLive(event, now = new Date()) {
  return asDate(event.end).getTime() >= now.getTime();
}

function eventsFor(date, now = new Date(), liveOnly = false) {
  return (snapshot?.days || [])
    .flatMap((item) => item.events || [])
    .filter((event) => dayKey(event.start, now) === date && (!liveOnly || isLive(event, now)));
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

function upcomingEvents(now = new Date(), limit = 6) {
  return (snapshot?.days || [])
    .flatMap((day) => day.events || [])
    .filter((event) => isLive(event, now))
    .sort((a, b) => String(a.start).localeCompare(String(b.start)))
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
      <span class="event-owner">${escapeHtml(eventOwner(event))}</span>
      <div class="muted">${timeOf(event.start)} — ${timeOf(event.end)}</div>
    </div>
  </div>`;
}

function durationLabel(event) {
  if (event.allDay) return "Весь день";
  const minutes = Math.max(0, Math.round((asDate(event.end).getTime() - asDate(event.start).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} мин`;
  if (minutes % 60 === 0) return `${minutes / 60} ч`;
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
}

function eventOwner(event) {
  return event.ownerName || event.calendarName || "Дом";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function weatherFor(date) {
  return (snapshot?.weather?.days || []).find((day) => day.date === date);
}

function periodsBlock(periods) {
  if (!periods?.length) return "";
  return `<div class="periods">${periods.map((period) => `<div class="period"><small>${escapeHtml(period.label)}</small><b>${period.temperature}°</b><small>${escapeHtml(period.description)}</small></div>`).join("")}</div>`;
}

function renderGuest() {
  const weather = snapshot.weather;
  return `<section class="guest-weather">
    <div class="weather-now"><b>${weather.temperature}°</b><div>${escapeHtml(weather.description)}<div class="muted">${weather.high}° / ${weather.low}°</div></div></div>
    ${periodsBlock(weather.periods)}
  </section>`;
}

function renderNow(now) {
  if (snapshot.display?.privacy) return renderGuest();
  const next = nextEvent(now);
  const rest = upcomingEvents(now, 6).filter((event) => event.id !== next?.id).slice(0, 4);
  const weather = snapshot.weather;
  return `<section class="grid-now">
    <article class="card next-card">
      <p class="kicker">${next && asDate(next.start) <= now ? "Сейчас" : "Дальше"}</p>
      ${next ? `<h3>${escapeHtml(titleOf(next))}</h3>
        <p class="muted">${timeOf(next.start)} — ${timeOf(next.end)}</p>
        <p class="when">${waitLabel(next, now)}</p>` : `<h3>Свободно</h3><p class="muted">Ближайших дел нет.</p>`}
    </article>
    <article class="card">
      <p class="kicker">Погода</p>
      <div class="weather-now"><b>${weather.temperature}°</b><div>${escapeHtml(weather.description)}<div class="muted">${weather.high}° / ${weather.low}°</div></div></div>
      ${periodsBlock(weather.periods)}
      ${rest.length ? `<div class="events">${rest.map((event) => eventRow(event)).join("")}</div>` : ""}
    </article>
  </section>`;
}

function renderToday(now) {
  if (snapshot.display?.privacy) return renderGuest();
  const today = eventsFor(todayStamp(now), now, true);
  const weather = snapshot.weather;
  return `<section class="grid-today">
    <article class="card">
      <p class="kicker">Расписание</p>
      <div class="events">${today.length ? today.map((event) => eventRow(event)).join("") : `<p class="empty">Сегодня больше ничего нет.</p>`}</div>
    </article>
    <article class="card">
      <p class="kicker">Погода</p>
      <div class="weather-now"><b>${weather.temperature}°</b><div>${escapeHtml(weather.description)}<div class="muted">${weather.high}° / ${weather.low}°</div></div></div>
      ${periodsBlock(weather.periods)}
    </article>
  </section>`;
}

function renderGallery(now) {
  if (snapshot.display?.privacy) return renderGuest();
  if (mode === "WEEK") return renderWeek(now);
  const events = mode === "TODAY"
    ? eventsFor(todayStamp(now), now, true).slice(0, 5)
    : upcomingEvents(now, 5);
  const title = mode === "TODAY" ? "Сегодня" : "Ближайшие дела";
  return `<section class="gallery-agenda">
    <p class="kicker">${title}</p>
    <div class="gallery-list">${events.length ? events.map((event) => `<article class="gallery-event">
      <time class="gallery-time">${timeOf(event.start)}</time>
      <div class="gallery-title"><strong>${escapeHtml(titleOf(event))}</strong><small>${durationLabel(event)}</small></div>
      <span class="gallery-owner"><i style="background:${event.color}"></i>${escapeHtml(eventOwner(event))}</span>
    </article>`).join("") : `<p class="empty">Сегодня тихо. Можно никуда не спешить.</p>`}</div>
  </section>`;
}

function renderWeek(now) {
  if (snapshot.display?.privacy) return renderGuest();
  const weekday = new Intl.DateTimeFormat(russian, { weekday: "short" });
  return `<section class="week">${weekDates(now).map((date) => {
    const stamp = new Date(`${date}T12:00:00+03:00`);
    const weather = weatherFor(date);
    const liveOnly = date === todayStamp(now);
    const events = eventsFor(date, now, liveOnly);
    return `<article class="card ${date === todayStamp(now) ? "today" : ""}">
      <div class="day-name">${weekday.format(stamp)}</div>
      <div class="day-num">${stamp.getDate()}</div>
      <div class="day-weather">${weather ? `${weather.high}° / ${weather.low}°` : "—"}<small>${weather ? escapeHtml(weather.description) : ""}</small></div>
      <div class="events">${events.length ? events.map((event) => eventRow(event)).join("") : `<p class="empty">Тихо</p>`}</div>
    </article>`;
  }).join("")}</section>`;
}

function paintClock(now = new Date()) {
  clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  dateLine.textContent = now.toLocaleDateString(russian, { weekday: "long", day: "numeric", month: "long" });
  const weather = snapshot?.weather;
  weatherLine.textContent = weather ? `${weather.temperature}° · ${weather.description}` : "";
}

function paintMedia() {
  const playing = snapshot?.nowPlaying;
  const visible = Boolean(playing?.title);
  mediaBar.hidden = !visible;
  document.body.classList.toggle("has-media", visible);
  if (!visible) return;
  mediaTitle.textContent = playing.title;
  mediaArtist.textContent = [playing.artist, playing.source].filter(Boolean).join(" · ");
  mediaState.textContent = playing.isPlaying ? "││" : "▶";
  const volume = Math.max(0, Math.min(100, Number(playing.volumePercent) || 0));
  mediaVolume.textContent = String(volume);
  volumeFill.style.width = `${volume}%`;
  mediaArt.style.backgroundImage = playing.artworkUrl ? `url("${playing.artworkUrl}")` : "";
  mediaArt.style.backgroundSize = playing.artworkUrl ? "cover" : "auto";
}

function viewSig() {
  const display = normalizeDisplay(snapshot.display);
  const events = (snapshot.days || []).flatMap((day) => day.events || []);
  return [
    mode,
    display.theme,
    display.mood,
    display.privacy,
    snapshot.display?.note?.text || "",
    snapshot.display?.backgroundUrl || "",
    snapshot.weather?.temperature,
    snapshot.nowPlaying?.title || "",
    snapshot.nowPlaying?.isPlaying || false,
    events.length,
    events[0]?.id || "",
    events[events.length - 1]?.id || "",
  ].join("|");
}

function paint(force = false) {
  if (!snapshot) return;
  const now = new Date();
  const display = normalizeDisplay(snapshot.display);
  const activeTheme = screenTheme(display);
  document.body.dataset.theme = activeTheme;
  document.body.classList.toggle("has-photo", Boolean(snapshot.display.backgroundUrl) && display.mood !== "night");
  document.body.classList.toggle("guests", display.privacy);
  photo.style.backgroundImage = snapshot.display.backgroundUrl ? `url("${snapshot.display.backgroundUrl}")` : "";
  paintClock(now);
  paintMedia();
  document.querySelectorAll("#modes [data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  if (snapshot.display.note?.text && !display.privacy) {
    noteEl.hidden = false;
    noteEl.textContent = snapshot.display.note.text;
  } else {
    noteEl.hidden = true;
  }
  const key = `${viewSig()}|${now.getMinutes()}`;
  if (!force && key === paintedKey) return;
  paintedKey = key;
  screen.innerHTML = activeTheme === "gallery"
    ? renderGallery(now)
    : mode === "WEEK" ? renderWeek(now) : mode === "TODAY" ? renderToday(now) : renderNow(now);
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
  if (flushTvApp(data.reloadAt)) return;
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
let polling = false;
setInterval(() => {
  if (!session || polling) return;
  polling = true;
  loadSnapshot().catch(() => {}).finally(() => { polling = false; });
}, 500);

const pixelShifts = [[0, 0], [7, -4], [-5, 6], [4, 5], [-7, -3], [2, -6]];
let pixelShiftIndex = 0;
function shiftPixels() {
  pixelShiftIndex = (pixelShiftIndex + 1) % pixelShifts.length;
  const [x, y] = pixelShifts[pixelShiftIndex];
  document.documentElement.style.setProperty("--pixel-x", `${x}px`);
  document.documentElement.style.setProperty("--pixel-y", `${y}px`);
}
setInterval(shiftPixels, 90_000);

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
