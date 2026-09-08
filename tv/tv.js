import { normalizeDisplay, normalizeRotation, pickNowPlaying, rotationSignature, screenTheme, shouldApplyTvReload } from "../control-state.js";
import { minutesPhrase, nextEventCue } from "../event-cue.js";

const API = window.DINO_API_BASE_URL || "https://api.dym-dino.ru";
const modes = ["TODAY", "TOMORROW", "WEEK"];
const sceneThemes = [
  "gallery", "home-day", "home-evening", "night", "play", "forest", "mountains", "sea", "space",
  "petersburg", "rome", "florence", "venice", "palace", "oak-study", "rus", "byzantium", "india", "italy",
];
const russian = "ru-RU";

const screen = document.querySelector("#screen");
const noteEl = document.querySelector("#note");
const clockEl = document.querySelector("#clock");
const dateLine = document.querySelector("#dateLine");
const weatherLine = document.querySelector("#weatherLine");
const pairEl = document.querySelector("#pair");
const pairCode = document.querySelector("#pairCode");
const pairEyebrow = document.querySelector("#pairEyebrow");
const pairTitle = document.querySelector("#pairTitle");
const pairNote = document.querySelector("#pairNote");
const photo = document.querySelector("#photo");
const mediaBar = document.querySelector("#mediaBar");
const mediaTitle = document.querySelector("#mediaTitle");
const mediaArtist = document.querySelector("#mediaArtist");
const mediaSource = document.querySelector("#mediaSource");

let snapshot = null;
let mode = "TODAY";
let session = readSession();
let rotateTimer;
let eventCueTimer;
const shownCues = readShownCues();
let lastForcedMode = "";
let lastRotationKey = "";
let paintedKey = "";
let appliedReloadAt = localStorage.getItem("dinoTvReloadAt") || "";
let appliedPowerAt = localStorage.getItem("dinoTvPowerAt") || "";
let asleep = false;
let nativeNowPlaying = null;
let agendaPage = 0;
let agendaPageCount = 1;
const scenePageSizes = new Map();

function nativeBridge() {
  return window.DinoTV || null;
}

function nativeForeground() {
  const bridge = nativeBridge();
  if (!bridge || typeof bridge.isForeground !== "function") return true;
  try {
    return bridge.isForeground() !== "0";
  } catch {
    return true;
  }
}

function flushTvApp(reloadAt) {
  if (!shouldApplyTvReload(appliedReloadAt, reloadAt)) return false;
  const next = new URL(location.href);
  if (next.searchParams.get("reloadAt") === reloadAt) {
    appliedReloadAt = reloadAt;
    try { localStorage.setItem("dinoTvReloadAt", reloadAt); } catch { /* ignore */ }
    return false;
  }
  appliedReloadAt = reloadAt;
  try { localStorage.setItem("dinoTvReloadAt", reloadAt); } catch { /* ignore */ }
  next.searchParams.set("reloadAt", reloadAt);
  next.searchParams.delete("r");
  location.replace(next.toString());
  return true;
}

function applyPower(power, powerAt) {
  if (!shouldApplyTvReload(appliedPowerAt, powerAt)) return;
  appliedPowerAt = powerAt;
  localStorage.setItem("dinoTvPowerAt", powerAt);
  asleep = power === "off";
  document.body.classList.toggle("asleep", asleep);
  const bridge = nativeBridge();
  if (asleep && bridge) bridge.powerOff();
}

function syncNativeSession() {
  const bridge = nativeBridge();
  if (session && bridge) bridge.saveSession(session);
}

function readShownCues() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem("dinoTvCues") || "[]"));
  } catch {
    return new Set();
  }
}

function rememberCue(id) {
  shownCues.add(id);
  try { sessionStorage.setItem("dinoTvCues", JSON.stringify([...shownCues])); } catch { /* ignore */ }
}

function showEventCue(cue) {
  const el = document.querySelector("#eventCue");
  document.querySelector("#eventCueWhen").textContent = minutesPhrase(cue.minutes);
  document.querySelector("#eventCueTitle").textContent = cue.title;
  document.querySelector("#eventCueMeta").textContent = [cue.ownerName, timeOf(cue.start)].filter(Boolean).join(" · ");
  el.hidden = false;
  clearTimeout(eventCueTimer);
  eventCueTimer = setTimeout(() => { el.hidden = true; }, 12_000);
}

function maybeEventCue(now = new Date()) {
  if (!snapshot || asleep) return;
  const display = normalizeDisplay(snapshot.display);
  const events = (snapshot.days || []).flatMap((day) => day.events || []);
  const cue = nextEventCue(events, {
    now: now.getTime(),
    shownIds: [...shownCues],
    privacy: display.privacy,
    showCalendar: display.showCalendar,
  });
  if (!cue) return;
  rememberCue(cue.id);
  showEventCue(cue);
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

function upcomingEvents(now = new Date(), limit) {
  const events = (snapshot?.days || [])
    .flatMap((day) => day.events || [])
    .filter((event) => isLive(event, now))
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));
  return Number.isFinite(limit) ? events.slice(0, limit) : events;
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

function dayForMode(now = new Date()) {
  return mode === "TOMORROW" ? weekDates(now)[1] : todayStamp(now);
}

function weatherForSelectedDay(date, now = new Date()) {
  if (date === todayStamp(now)) return snapshot?.weather || null;
  return weatherFor(date) || null;
}

function periodsBlock(periods) {
  if (!periods?.length) return "";
  return `<div class="periods">${periods.map((period) => `<div class="period"><small>${escapeHtml(period.label)}</small><b>${period.temperature}°</b><small>${escapeHtml(period.description)}</small></div>`).join("")}</div>`;
}

function screenLayers() {
  const display = normalizeDisplay(snapshot?.display);
  return {
    weather: display.showWeather && Boolean(snapshot?.weather),
    calendar: display.showCalendar && !display.privacy,
    privacy: display.privacy,
  };
}

function weatherDayHtml(date, now = new Date()) {
  const weather = weatherForSelectedDay(date, now);
  if (!weather) return `<p class="empty">Прогноз пока недоступен.</p>`;
  const today = date === todayStamp(now);
  const headline = today ? `${weather.temperature}°` : `${weather.high}° / ${weather.low}°`;
  return `<div class="weather-now"><b>${headline}</b><div>${escapeHtml(weather.description)}<div class="muted">Санкт-Петербург</div></div></div>${periodsBlock(weather.periods)}`;
}

function renderGuest(now = new Date()) {
  if (!screenLayers().weather) return "";
  const date = mode === "WEEK" ? todayStamp(now) : dayForMode(now);
  return `<section class="guest-weather">${weatherDayHtml(date, now)}</section>`;
}

function renderDay(now) {
  const layers = screenLayers();
  if (layers.privacy) return renderGuest(now);
  const date = dayForMode(now);
  const title = mode === "TOMORROW" ? "Завтра" : "Сегодня";
  const events = layers.calendar ? eventsFor(date, now, mode === "TODAY") : [];
  if (!layers.calendar && !layers.weather) return "";
  return `<section class="grid-today">
    ${layers.calendar ? `<article class="card">
      <p class="kicker">${title}</p>
      <div class="events">${events.length ? events.map((event) => eventRow(event)).join("") : `<p class="empty">${title} спокойно — дел нет.</p>`}</div>
    </article>` : ""}
    ${layers.weather ? `<article class="card"><p class="kicker">Погода</p>${weatherDayHtml(date, now)}</article>` : ""}
  </section>`;
}

function sceneWeather(periods) {
  if (!periods?.length) return "";
  return `<div class="scene-weather">${periods.slice(0, 4).map((period) => `<div><small>${escapeHtml(period.label)}</small><b>${period.temperature}°</b><span>${escapeHtml(period.description)}</span></div>`).join("")}</div>`;
}

function scenePageSizeKey(scene) {
  const layers = screenLayers();
  return [scene, mode, window.innerWidth, window.innerHeight, layers.weather].join(":");
}

function scenePageSize(scene) {
  const measured = scenePageSizes.get(scenePageSizeKey(scene));
  if (measured) return measured;
  const compactVertical = ["night", "mountains", "florence", "byzantium", "palace", "oak-study"].includes(scene);
  if (mode === "TODAY" || mode === "TOMORROW") return compactVertical && window.innerHeight <= 800 ? 5 : window.innerHeight <= 800 ? 6 : 8;
  if (compactVertical) return window.innerHeight <= 800 ? 7 : 9;
  return window.innerHeight <= 800 ? 7 : 9;
}

function measuredScenePageSize(scene) {
  const list = screen.querySelector(".scene-list");
  const rows = [...screen.querySelectorAll(".scene-event")];
  if (!list || !rows.length || list.clientHeight < 1) return null;
  if (["mountains", "florence", "byzantium"].includes(scene)) {
    const gap = Number.parseFloat(window.getComputedStyle(list).columnGap) || 0;
  return Math.max(1, Math.min(16, Math.floor((list.clientWidth + gap) / (190 + gap))));
  }
  const rowHeight = Math.max(...rows.map((row) => row.getBoundingClientRect().height));
  if (!Number.isFinite(rowHeight) || rowHeight < 1) return null;
  return Math.max(1, Math.min(16, Math.floor((list.clientHeight + 1) / rowHeight)));
}

function agendaDayLabel(date, now, compact = false) {
  const stamp = new Date(`${date}T12:00:00+03:00`);
  const full = stamp.toLocaleDateString(russian, { weekday: "long", day: "numeric", month: "long" });
  if (compact) return full;
  if (date === todayStamp(now)) return `Сегодня · ${full}`;
  if (date === weekDates(now)[1]) return `Завтра · ${full}`;
  return full;
}

function agendaPages(events, size, now, fallbackDate = todayStamp(now)) {
  const groups = new Map();
  events.forEach((event) => {
    const date = dayKey(event.start, now);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(event);
  });
  const pages = [];
  groups.forEach((dayEvents, date) => {
    const parts = Math.max(1, Math.ceil(dayEvents.length / size));
    for (let part = 0; part < parts; part += 1) {
      pages.push({ date, events: dayEvents.slice(part * size, (part + 1) * size), part: part + 1, parts });
    }
  });
  return pages.length ? pages : [{ date: fallbackDate, events: [], part: 1, parts: 1 }];
}

function renderSceneAgenda(now, scene) {
  agendaPageCount = 1;
  const layers = screenLayers();
  if (layers.privacy) return renderGuest(now);
  if (!layers.calendar && !layers.weather) return "";
  const week = new Set(weekDates(now));
  const daily = mode === "TODAY" || mode === "TOMORROW";
  const selectedDate = dayForMode(now);
  const events = layers.calendar
    ? (daily
      ? eventsFor(selectedDate, now, mode === "TODAY")
      : upcomingEvents(now).filter((event) => week.has(dayKey(event.start, now))))
    : [];
  const pages = agendaPages(events, scenePageSize(scene), now, selectedDate);
  agendaPageCount = layers.calendar ? pages.length : 1;
  const pageIndex = agendaPage % pages.length;
  const page = pages[pageIndex];
  const title = mode === "TODAY" ? "Сегодня" : mode === "TOMORROW" ? "Завтра" : "Эта неделя";
  return `<section class="scene-agenda scene-${scene}">
    ${layers.calendar ? `<p class="kicker"><span>${title}</span><span class="scene-day-label">${escapeHtml(agendaDayLabel(page.date, now, daily))}${page.parts > 1 ? ` · ${page.part}/${page.parts}` : ""}</span></p>` : ""}
    ${layers.weather && daily ? sceneWeather(weatherForSelectedDay(selectedDate, now)?.periods) : ""}
    ${layers.calendar ? `<div class="scene-list" style="--event-count:${Math.max(page.events.length, 1)}">${page.events.length ? page.events.map((event, index) => `<article class="scene-event" style="--event-index:${index}">
      <time class="scene-time">${timeOf(event.start)}</time>
      <div class="scene-title"><strong>${escapeHtml(titleOf(event))}</strong><small>${durationLabel(event)}</small></div>
      <span class="scene-owner"><i style="background:${event.color}"></i>${escapeHtml(eventOwner(event))}</span>
    </article>`).join("") : `<p class="empty">${mode === "TOMORROW" ? "Завтра" : "Сегодня"} тихо. Можно никуда не спешить.</p>`}</div>
    ${pages.length > 1 ? `<div class="agenda-pages"><span>${pageIndex + 1} / ${pages.length}</span><i style="--page-progress:${((pageIndex + 1) / pages.length) * 100}%"></i></div>` : ""}` : ""}
  </section>`;
}

function renderWeek(now) {
  const layers = screenLayers();
  if (layers.privacy) return renderGuest();
  if (!layers.calendar && !layers.weather) return "";
  const weekday = new Intl.DateTimeFormat(russian, { weekday: "short" });
  return `<section class="week">${weekDates(now).map((date) => {
    const stamp = new Date(`${date}T12:00:00+03:00`);
    const weather = layers.weather ? weatherFor(date) : null;
    const liveOnly = date === todayStamp(now);
    const events = layers.calendar ? eventsFor(date, now, liveOnly) : [];
    return `<article class="card ${date === todayStamp(now) ? "today" : ""}">
      <div class="day-name">${weekday.format(stamp)}</div>
      <div class="day-num">${stamp.getDate()}</div>
      ${layers.weather ? `<div class="day-weather">${weather ? `${weather.high}° / ${weather.low}°` : "—"}<small>${weather ? escapeHtml(weather.description) : ""}</small></div>` : ""}
      ${layers.calendar ? `<div class="events">${events.length ? events.map((event) => eventRow(event)).join("") : `<p class="empty">Тихо</p>`}</div>` : ""}
    </article>`;
  }).join("")}</section>`;
}

function paintClock(now = new Date()) {
  if (!clockEl) return;
  clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  if (dateLine) dateLine.textContent = now.toLocaleDateString(russian, { weekday: "long", day: "numeric", month: "long" });
  if (weatherLine) {
    const visible = screenLayers().weather;
    weatherLine.hidden = !visible;
    weatherLine.textContent = visible ? `${snapshot.weather.temperature}° · ${snapshot.weather.description}` : "";
  }
}

function readNativeNowPlaying() {
  const bridge = nativeBridge();
  if (!bridge || typeof bridge.nowPlaying !== "function") return;
  try {
    const raw = bridge.nowPlaying();
    nativeNowPlaying = raw ? JSON.parse(raw) : null;
  } catch {
    nativeNowPlaying = null;
  }
}

function paintMedia() {
  const playing = pickNowPlaying(nativeNowPlaying, snapshot);
  const visible = Boolean(playing?.title);
  mediaBar.hidden = !visible;
  if (!visible) return;
  mediaBar.classList.toggle("is-playing", playing.isPlaying !== false);
  mediaTitle.textContent = playing.title;
  mediaArtist.textContent = playing.artist || "";
  mediaArtist.hidden = !playing.artist;
  mediaSource.textContent = playing.source || "";
  mediaSource.hidden = !playing.source;
}

function viewSig() {
  const display = normalizeDisplay(snapshot.display);
  const events = (snapshot.days || []).flatMap((day) => day.events || []);
  return [
    mode,
    display.theme,
    display.mood,
    display.privacy,
    display.showWeather,
    display.showCalendar,
    snapshot.display?.note?.text || "",
    snapshot.display?.backgroundUrl || "",
    snapshot.weather?.temperature,
    snapshot.nowPlaying?.title || "",
    snapshot.nowPlaying?.isPlaying || false,
    nativeNowPlaying?.title || "",
    nativeNowPlaying?.isPlaying || false,
    events.length,
    events[0]?.id || "",
    events[events.length - 1]?.id || "",
    agendaPage,
  ].join("|");
}

function paint(force = false) {
  if (!snapshot) return;
  const now = new Date();
  const display = normalizeDisplay(snapshot.display);
  const activeTheme = screenTheme(display);
  if (!sceneThemes.includes(activeTheme)) agendaPageCount = 1;
  document.body.dataset.theme = activeTheme;
  document.body.dataset.mode = mode.toLowerCase();
  document.body.classList.toggle("immersive", sceneThemes.includes(activeTheme));
  document.body.classList.toggle("has-photo", Boolean(snapshot.display.backgroundUrl) && display.mood !== "night");
  document.body.classList.toggle("guests", display.privacy);
  document.body.classList.toggle("hide-weather", !display.showWeather);
  document.body.classList.toggle("hide-calendar", !display.showCalendar);
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
  if (sceneThemes.includes(activeTheme)) {
    const sizeKey = scenePageSizeKey(activeTheme);
    const previousSize = scenePageSize(activeTheme);
    screen.innerHTML = renderSceneAgenda(now, activeTheme);
    const measuredSize = measuredScenePageSize(activeTheme);
    if (measuredSize && measuredSize !== previousSize) {
      scenePageSizes.set(sizeKey, measuredSize);
      screen.innerHTML = renderSceneAgenda(now, activeTheme);
    }
  } else {
    screen.innerHTML = mode === "WEEK" ? renderWeek(now) : renderDay(now);
  }
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (session) headers.authorization = `Bearer ${session}`;
  headers["x-dino-visible"] = asleep || !nativeForeground() ? "0" : "1";
  const response = await fetch(`${API}${path}`, { ...options, headers });
  if (response.status === 401) {
    session = "";
    localStorage.removeItem("dinoTvSession");
    throw new Error("auth");
  }
  if (!response.ok) throw new Error(await response.text() || "request failed");
  return response.json();
}

function showGuestPair(code) {
  if (!session || !code) {
    if (session) pairEl.hidden = true;
    return;
  }
  pairEyebrow.textContent = "Другой телефон";
  pairTitle.textContent = "Введите код на втором пульте";
  pairNote.textContent = "Код живёт десять минут";
  pairCode.textContent = code;
  pairEl.hidden = false;
}

async function loadSnapshot() {
  const data = await request("/v1/display/snapshot");
  if (flushTvApp(data.reloadAt)) return;
  applyPower(data.power, data.powerAt);
  syncNativeSession();
  snapshot = data;
  showGuestPair(data.inviteCode);
  if (asleep) return;
  const rotation = normalizeRotation(data.display?.rotation);
  if (!rotation.enabled && modes.includes(data.display?.mode)) {
    mode = data.display.mode;
  }
  if (modes.includes(data.display?.mode) && data.display.mode !== lastForcedMode) {
    mode = data.display.mode;
    lastForcedMode = data.display.mode;
    if (session) startRotation();
    agendaPage = 0;
  }
  const nextRotationKey = rotationSignature(rotation);
  if (session && nextRotationKey !== lastRotationKey) {
    lastRotationKey = nextRotationKey;
    startRotation();
  }
  paint();
}

async function startPairing() {
  pairEl.hidden = false;
  pairEyebrow.textContent = "Подключение экрана";
  pairTitle.textContent = "Откройте Dino TV в телефоне и введите код";
  pairNote.textContent = "Код живёт десять минут. После этого телевизор запомнит дом сам.";
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

function dwellMs(currentMode) {
  const rotation = normalizeRotation(snapshot?.display?.rotation);
  const seconds = currentMode === "TODAY" ? rotation.today : currentMode === "TOMORROW" ? rotation.tomorrow : rotation.week;
  return seconds * 1000;
}

function startRotation() {
  clearTimeout(rotateTimer);
  clearInterval(rotateTimer);
  rotateTimer = undefined;
  const rotation = normalizeRotation(snapshot?.display?.rotation);
  if (!rotation.enabled) return;
  rotateTimer = setTimeout(() => {
    mode = modes[(modes.indexOf(mode) + 1) % modes.length];
    agendaPage = 0;
    paint(true);
    startRotation();
  }, dwellMs(mode));
}

document.querySelectorAll("#modes [data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    agendaPage = 0;
    paint(true);
    startRotation();
  });
});

setInterval(() => {
  if (!snapshot || asleep || agendaPageCount <= 1) return;
  agendaPage = (agendaPage + 1) % agendaPageCount;
  paint(true);
}, 10_000);

paintClock();
setInterval(() => {
  const now = new Date();
  paintClock(now);
  maybeEventCue(now);
  readNativeNowPlaying();
  paintMedia();
  if (!snapshot) return;
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
        const requestedScene = new URLSearchParams(location.search).get("scene");
        if (sceneThemes.includes(requestedScene)) {
          preview.display = {
            ...preview.display,
            theme: requestedScene === "night" || requestedScene === "play" ? "gallery" : requestedScene,
            mood: requestedScene === "night" || requestedScene === "play" ? requestedScene : "home",
          };
        }
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
