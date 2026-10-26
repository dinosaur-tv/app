import { displayThemes, normalizeDisplay, normalizeRotation, pickNowPlaying, rotationSignature, screenTheme, shouldApplyTvReload } from "../control-state.js";
import { paintSceneMotion } from "./scene-motion.js";
import { paintSceneVideo } from "./scene-video.js";
import { sceneLayout } from "./scene-layout.js";
import { artworkFor, artworkUrl, slideshowArtwork } from "../artworks.js";
import { isLiveNow, leftPhrase, liveEvents, liveState, minutesPhrase, nextEventCue, nextUpEvent, whenPhrase } from "../event-cue.js";
import { fallbackWeather, fetchWeather, placeKey } from "./weather.js";
import { screenNameFrom } from "./screen-name.js";

const API = window.DINO_API_BASE_URL || `${location.origin}/api`;
const modes = ["TODAY", "TOMORROW", "WEEK"];
const sceneThemes = [...displayThemes, "night", "play"];
const russian = "ru-RU";
const WEATHER_TTL_MS = 20 * 60 * 1000;

// The forecast belongs to the screen now: the snapshot only says which place to ask about.
let weatherKey = "";
let weatherAt = 0;
let weatherPending = false;
let weather = readStoredWeather();

function readStoredWeather() {
  try {
    const stored = JSON.parse(localStorage.getItem("dinoTvWeather") || "null");
    if (stored?.weather?.periods) {
      weatherKey = stored.key || "";
      weatherAt = Number(stored.at) || 0;
      return stored.weather;
    }
  } catch { /* a cleared or corrupt cache is the same as no cache */ }
  return fallbackWeather();
}

function adoptWeather(next, place) {
  if (!next?.periods) return false;
  weather = next;
  weatherKey = placeKey(place);
  weatherAt = Date.now();
  try { localStorage.setItem("dinoTvWeather", JSON.stringify({ key: weatherKey, at: weatherAt, weather: next })); } catch { /* ignore */ }
  return true;
}

async function refreshWeather(place) {
  // Prefer the forecast the server already attached to the snapshot. Xiaomi WebViews
  // often cannot open api.open-meteo.com themselves, so a direct fetch is only a fallback
  // for older backends that still omit weather from the snapshot.
  if (!place || weatherPending) return;
  const key = placeKey(place);
  if (key === weatherKey && Date.now() - weatherAt < WEATHER_TTL_MS) return;
  weatherPending = true;
  try {
    const next = await fetchWeather(place);
    adoptWeather(next, place);
    if (snapshot) { snapshot.weather = weather; paint(true); }
  } catch {
    // Keep showing the last good reading; the next tick tries again.
    if (key !== weatherKey) weather = fallbackWeather(place.name);
  } finally {
    weatherPending = false;
  }
}

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
const artworkFrame = document.querySelector("#artworkFrame");
const artworkImage = document.querySelector("#artworkImage");
const mediaBar = document.querySelector("#mediaBar");
const mediaTitle = document.querySelector("#mediaTitle");
const mediaArtist = document.querySelector("#mediaArtist");
const mediaSource = document.querySelector("#mediaSource");
const mediaBars = [...document.querySelectorAll(".media-wave i")];

let snapshot = null;
let mode = "TODAY";
let session = readSession();
let rotateTimer;
// Long enough to read twice, short enough not to sit on the screen.
const EVENT_CUE_DWELL_MS = 20_000;
const EVENT_CUE_LEAVE_MS = 320;
let eventCueTimer;
const shownCues = readShownCues();
let lastForcedMode = "";
let lastRotationKey = "";
let paintedKey = "";
let paintedHtml = null;

/**
 * The 4K pictures cost a 33 MB texture, which a 1080p television never shows, so they are
 * loaded only where the panel really draws that many pixels (a 4K monitor or a TV whose
 * interface runs at 4K). The ordinary picture stays up until the large one has arrived.
 */
const HI_RES = Math.max(window.screen.width, window.screen.height) * (window.devicePixelRatio || 1) >= 2560;
const backdrop = document.querySelector("#sceneBackdrop");

function upgradeBackdrop(theme) {
  if (!HI_RES || backdrop.dataset.theme === theme) return;
  backdrop.dataset.theme = theme;
  backdrop.style.backgroundImage = "";
  const css = window.getComputedStyle(backdrop).backgroundImage;
  const match = css.match(/\/assets\/scenes\/([\w-]+)\.webp/);
  if (!match) return;
  const large = `/assets/scenes/4k/${match[1]}.webp`;
  const probe = new window.Image();
  probe.onload = () => {
    if (backdrop.dataset.theme === theme) backdrop.style.backgroundImage = css.replace(`/assets/scenes/${match[1]}.webp`, large);
  };
  probe.src = large;
}
let appliedReloadAt = localStorage.getItem("dinoTvReloadAt") || "";
let appliedPowerAt = localStorage.getItem("dinoTvPowerAt") || "";
let asleep = false;
let nativeNowPlaying = null;
let nativeSpectrumMayBeRunning = false;
let agendaPage = 0;
let agendaPageCount = 1;
const scenePageSizes = new Map();

function nativeBridge() {
  return window.DinoTV || null;
}

/**
 * Writing the same text again still swaps the text node and makes the page lay itself out,
 * and the clock and the track line were doing it every second. Only a change is written.
 */
function setText(el, value) {
  const text = String(value ?? "");
  if (el && el.textContent !== text) el.textContent = text;
}

function setHidden(el, hidden) {
  if (el && el.hidden !== hidden) el.hidden = hidden;
}

if (nativeBridge()) {
  document.body.classList.add("native-tv");
  if (typeof nativeBridge().audioSpectrum === "function") document.body.classList.add("supports-audio-spectrum");
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
  el.classList.remove("leaving");
  el.hidden = false;
  document.body.classList.add("cue-visible");
  const bar = document.querySelector("#eventCueProgress");
  // Restart the drain even when one cue replaces another mid-flight.
  bar.style.animation = "none";
  void bar.offsetWidth;
  bar.style.animation = `cueDrain ${EVENT_CUE_DWELL_MS}ms linear forwards`;
  clearTimeout(eventCueTimer);
  eventCueTimer = setTimeout(() => {
    el.classList.add("leaving");
    eventCueTimer = setTimeout(() => {
      el.hidden = true;
      el.classList.remove("leaving");
      document.body.classList.remove("cue-visible");
    }, EVENT_CUE_LEAVE_MS);
  }, EVENT_CUE_DWELL_MS);
}

function hideEventCue() {
  const el = document.querySelector("#eventCue");
  if (!el) return;
  clearTimeout(eventCueTimer);
  eventCueTimer = undefined;
  el.hidden = true;
  el.classList.remove("leaving");
  document.body.classList.remove("cue-visible");
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
    .filter((event) => dayKey(event.start, now) === date && (!liveOnly || isLive(event, now)))
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));
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

// A colour reaches here from a calendar label, so it is checked before it becomes markup.
function dotColor(value) {
  return /^#[0-9a-f]{3,8}$/i.test(String(value)) ? value : "var(--accent)";
}

/** One dot per person who has this event: an invitation shared by two shows two. */
function ownerDots(event) {
  const owners = Array.isArray(event.owners) && event.owners.length ? event.owners : [{ color: event.color }];
  return `<span class="owner-dots">${owners.slice(0, 4).map((owner) => `<i style="background:${dotColor(owner.color)}"></i>`).join("")}</span>`;
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
  // Day slices from the week forecast omit the place name; fall back to the live reading.
  const location = weather.location || snapshot?.weather?.location || "";
  const place = location ? `<div class="muted">${escapeHtml(location)}</div>` : "";
  return `<div class="weather-now"><b>${headline}</b><div>${escapeHtml(weather.description || "")}${place}</div></div>${periodsBlock(weather.periods)}`;
}

function renderGuest(now = new Date()) {
  if (!screenLayers().weather) return "";
  const date = mode === "WEEK" ? todayStamp(now) : dayForMode(now);
  return `<section class="guest-weather">${weatherDayHtml(date, now)}</section>`;
}


function sceneWeather(periods) {
  if (!periods?.length) return "";
  return `<div class="scene-weather">${periods.slice(0, 4).map((period) => `<div><small>${escapeHtml(period.label)}</small><b>${period.temperature}°</b><span>${escapeHtml(period.description)}</span></div>`).join("")}</div>`;
}

function scenePageSizeKey(scene) {
  const layers = screenLayers();
  // The window, not the panel: the panel now grows and shrinks with its events.
  return [scene, mode, window.innerWidth, window.innerHeight, layers.weather, Boolean(snapshot?.display?.note?.text), document.body.classList.contains("media-visible")].join(":");
}

function scenePageSize(scene) {
  const measured = scenePageSizes.get(scenePageSizeKey(scene));
  if (measured) return measured;
  const compactVertical = ["night", "mountains", "florence", "byzantium", "palace", "oak-study", "palace-study"].includes(scene);
  if (mode === "TODAY" || mode === "TOMORROW") return compactVertical && window.innerHeight <= 800 ? 5 : window.innerHeight <= 800 ? 6 : 8;
  if (compactVertical) return window.innerHeight <= 800 ? 7 : 9;
  return window.innerHeight <= 800 ? 7 : 9;
}

function measuredScenePageSize() {
  const list = screen.querySelector(".scene-list");
  const rows = [...screen.querySelectorAll(".scene-event")];
  if (!list || !rows.length || list.clientHeight < 1) return null;
  const heights = rows.map((row) => row.getBoundingClientRect().height).filter((height) => Number.isFinite(height) && height > 0);
  if (!heights.length) return null;
  return Math.max(1, Math.min(16, Math.floor(list.clientHeight / Math.max(...heights))));
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

// A day heading is about half the height of an event row.
const DAY_HEADING_ROWS = 0.5;

/**
 * The week used to give each day its own page, so a quiet week was seven pages of one
 * event each. Now the days run on as one list, each under its own heading, and a page
 * breaks only when the screen is full. A day split across pages repeats its heading.
 */
function weekPages(events, size, now) {
  const pages = [];
  let items = [];
  let used = 0;
  let lastDate = "";
  for (const event of events) {
    const date = dayKey(event.start, now);
    const heading = date !== lastDate || !items.length;
    const cost = 1 + (heading ? DAY_HEADING_ROWS : 0);
    if (items.length && used + cost > size) {
      pages.push(items);
      items = [];
      used = 0;
    }
    if (date !== lastDate || !items.length) {
      items.push({ date });
      used += DAY_HEADING_ROWS;
      lastDate = date;
    }
    items.push({ event });
    used += 1;
  }
  if (items.length) pages.push(items);
  return pages;
}

function weekDayHeading(date, now) {
  const stamp = new Date(`${date}T12:00:00+03:00`);
  const day = stamp.toLocaleDateString(russian, { day: "numeric", month: "long" });
  const name = date === todayStamp(now) ? "Сегодня"
    : date === weekDates(now)[1] ? "Завтра"
      : stamp.toLocaleDateString(russian, { weekday: "long" });
  return `<h3 class="scene-day">${escapeHtml(name)}<small>${escapeHtml(day)}</small></h3>`;
}

function screenTimeZone() {
  return snapshot?.timezone || snapshot?.display?.place?.timezone || "Europe/Moscow";
}

/** An event under way says so, shows what is left of it, and fills a bar as it goes. */
function sceneEventHtml(event, index) {
  const now = Date.now();
  const live = isLiveNow(event, now) ? liveState(event, now) : null;
  const detail = live
    ? `<small class="live-left">Идёт · ${escapeHtml(leftPhrase(live, { timeZone: screenTimeZone() }))}</small>`
    : `<small>${durationLabel(event)}</small>`;
  const bar = live ? `<i class="live-bar" style="--live-progress:${live.progress.toFixed(3)}"></i>` : "";
  return `<article class="scene-event${live ? " is-live" : ""}" style="--event-index:${index}">
      <time class="scene-time">${live ? "Сейчас" : timeOf(event.start)}</time>
      <div class="scene-title"><strong title="${escapeHtml(titleOf(event))}">${escapeHtml(titleOf(event))}</strong>${detail}${bar}</div>
      <span class="scene-owner" title="${escapeHtml(eventOwner(event))}">${ownerDots(event)}<span>${escapeHtml(eventOwner(event))}</span></span>
    </article>`;
}

function pagerHtml(index, count) {
  const ratio = (index + 1) / count;
  return `<div class="agenda-pages${count > 1 ? "" : " single-page"}"><span>${index + 1} / ${count}</span><i style="--page-progress:${ratio * 100}%;--page-progress-ratio:${ratio}"></i></div>`;
}

function renderWeekAgenda(now, scene) {
  const layers = screenLayers();
  const week = new Set(weekDates(now));
  const events = layers.calendar ? upcomingEvents(now).filter((event) => week.has(dayKey(event.start, now))) : [];
  const pages = weekPages(events, scenePageSize(scene), now);
  agendaPageCount = Math.max(1, pages.length);
  const pageIndex = agendaPage % agendaPageCount;
  const items = pages[pageIndex] || [];
  const first = weekDates(now)[0];
  const last = weekDates(now)[6];
  const range = `${new Date(`${first}T12:00:00+03:00`).getDate()}–${new Date(`${last}T12:00:00+03:00`).toLocaleDateString(russian, { day: "numeric", month: "long" })}`;
  let eventIndex = 0;
  const body = items.map((item) => (item.event ? sceneEventHtml(item.event, eventIndex++) : weekDayHeading(item.date, now))).join("");
  return `<section class="scene-agenda scene-${scene}">
    <p class="kicker"><span>Эта неделя</span><span class="scene-day-label">${escapeHtml(range)}</span></p>
    ${upNextHtml(now, { liveListed: body.includes("is-live") })}
    <div class="scene-list" style="--event-count:${Math.max(eventIndex, 1)}">${body || `<p class="empty">На неделе тихо. Можно ничего не планировать.</p>`}</div>
    ${pagerHtml(pageIndex, agendaPageCount)}
  </section>`;
}

function renderSceneAgenda(now, scene) {
  agendaPageCount = 1;
  const layers = screenLayers();
  if (layers.privacy) return renderGuest(now);
  if (!layers.calendar && !layers.weather) return "";
  if (mode === "WEEK" && layers.calendar) return renderWeekAgenda(now, scene);
  const daily = mode === "TODAY" || mode === "TOMORROW";
  const selectedDate = dayForMode(now);
  const events = layers.calendar && daily ? eventsFor(selectedDate, now, mode === "TODAY") : [];
  const pages = agendaPages(events, scenePageSize(scene), now, selectedDate);
  agendaPageCount = layers.calendar ? pages.length : 1;
  const pageIndex = agendaPage % pages.length;
  const page = pages[pageIndex];
  const title = mode === "TODAY" ? "Сегодня" : mode === "TOMORROW" ? "Завтра" : "Эта неделя";
  return `<section class="scene-agenda scene-${scene}">
    ${layers.calendar ? `<p class="kicker"><span>${title}</span><span class="scene-day-label">${escapeHtml(agendaDayLabel(page.date, now, daily))}${page.parts > 1 ? ` · ${page.part}/${page.parts}` : ""}</span></p>
    ${upNextHtml(now, { liveListed: page.events.some((event) => isLiveNow(event, now.getTime())) })}` : ""}
    ${layers.weather && daily ? sceneWeather(weatherForSelectedDay(selectedDate, now)?.periods) : ""}
    ${layers.calendar ? `<div class="scene-list" style="--event-count:${Math.max(page.events.length, 1)}">${page.events.length ? page.events.map(sceneEventHtml).join("") : `<p class="empty">${mode === "TOMORROW" ? "Завтра" : "Сегодня"} тихо. Можно никуда не спешить.</p>`}</div>
    ${pagerHtml(pageIndex, pages.length)}` : ""}
  </section>`;
}


/**
 * What is on now and what comes next, at the top of the agenda: the panel says «Сегодня»,
 * then where the day stands, then the list. Each line only when it exists, and «Сейчас»
 * only when the list below does not already show that event.
 */
function upNextHtml(now, { liveListed = false } = {}) {
  const layers = screenLayers();
  if (!layers.calendar) return "";
  const display = normalizeDisplay(snapshot?.display);
  const timeZone = screenTimeZone();
  const events = (snapshot?.days || []).flatMap((day) => day.events || []);
  const options = { now: now.getTime(), privacy: display.privacy, showCalendar: display.showCalendar, timeZone };
  const live = liveEvents(events, options)[0];
  const next = nextUpEvent(events, options);
  const rows = [];
  // «Сейчас» is said once: the list marks it when the event is on this page.
  if (live && !liveListed) rows.push(["now", "Сейчас", live.title || "Дело", leftPhrase(live, { timeZone })]);
  if (next && !next.live) rows.push(["next", "Дальше", next.title, whenPhrase(next, { timeZone })]);
  if (!rows.length) return "";
  return `<div class="scene-upnext">${rows.map(([kind, label, title, when]) => `<p class="up-${kind}"><b>${label}</b><strong>${escapeHtml(title)}</strong><span>${escapeHtml(when)}</span></p>`).join("")}</div>`;
}

function paintClock(now = new Date()) {
  if (!clockEl) return;
  setText(clockEl, `${pad(now.getHours())}:${pad(now.getMinutes())}`);
  setText(dateLine, now.toLocaleDateString(russian, { weekday: "long", day: "numeric", month: "long" }));
  if (weatherLine) {
    // The clock runs before the first snapshot; the forecast has nothing to say yet.
    const visible = Boolean(snapshot?.weather) && screenLayers().weather;
    setHidden(weatherLine, !visible);
    setText(weatherLine, visible ? `${snapshot.weather.temperature}° · ${snapshot.weather.description}` : "");
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

/**
 * Hangs a painting. The next one is loaded off-screen and the old one fades out only once
 * the new one is ready, so a slideshow never shows an empty wall or a half-drawn canvas.
 */
function showArtwork(work) {
  if (artworkImage.dataset.work === work.id) return;
  artworkImage.dataset.work = work.id;
  const first = !artworkImage.getAttribute("src");
  const apply = () => {
    if (artworkImage.dataset.work !== work.id) return;
    document.body.dataset.artTone = work.tone;
    document.body.style.setProperty("--art-wall", work.wall);
    artworkImage.src = artworkUrl(work);
    artworkImage.alt = `${work.artist}. ${work.title}, ${work.year}`;
    document.querySelector("#artworkTitle").textContent = work.title;
    document.querySelector("#artworkArtist").textContent = work.artist;
    document.querySelector("#artworkYear").textContent = work.year;
    artworkFrame.classList.remove("swapping");
  };
  if (first) return apply();
  const next = new window.Image();
  next.onload = () => {
    artworkFrame.classList.add("swapping");
    setTimeout(apply, 900);
  };
  next.onerror = apply;
  next.src = artworkUrl(work);
}

/** The splash leaves once there is something real to show: the day, or the pairing code. */
function dismissSplash() {
  const splash = document.querySelector("#splash");
  if (!splash || splash.classList.contains("leaving")) return;
  splash.classList.add("leaving");
  setTimeout(() => splash.remove(), 900);
}

/** Footage plays only while someone can see it: not asleep, not hidden behind another app. */
function videoRunning() {
  return !document.hidden && !asleep && nativeForeground();
}

let heldTrack = null;
let heldTrackAt = 0;

function paintMedia() {
  const picked = pickNowPlaying(nativeNowPlaying, snapshot);
  // The player drops out for a beat between tracks and when the overlay opens. Hiding the
  // strip for that beat moved the whole column, the agenda frame with it, twice in a row.
  if (picked?.title) {
    heldTrack = picked;
    heldTrackAt = Date.now();
  }
  const playing = picked?.title ? picked : (Date.now() - heldTrackAt < 8_000 ? heldTrack : null);
  const visible = Boolean(playing?.title);
  document.body.classList.toggle("media-visible", visible);
  setHidden(mediaBar, !visible);
  if (!visible) {
    stopNativeSpectrum();
    return;
  }
  const live = playing.isPlaying !== false;
  mediaBar.classList.toggle("is-playing", live);
  if (!live) stopNativeSpectrum();
  setText(mediaTitle, playing.title);
  setText(mediaArtist, playing.artist || "");
  setHidden(mediaArtist, !playing.artist);
  // The player is not named: «Яндекс Музыка» under a track only repeated what the wave says.
  // Still on the player, just not moving — said plainly, since the wave has gone still.
  setText(mediaSource, live ? "" : "на паузе");
  setHidden(mediaSource, !mediaSource.textContent);
}

function stopNativeSpectrum() {
  mediaBar.classList.remove("has-audio-spectrum");
  for (const bar of mediaBars) bar.style.removeProperty("--level");
  const bridge = nativeBridge();
  if (nativeSpectrumMayBeRunning) {
    nativeSpectrumMayBeRunning = false;
    try { bridge?.stopAudioSpectrum?.(); } catch { /* native audio capture is optional */ }
  }
}

function paintNativeSpectrum() {
  const bridge = nativeBridge();
  if (!bridge || typeof bridge.audioSpectrum !== "function" || mediaBar.hidden || !mediaBar.classList.contains("is-playing")) return;
  try {
    nativeSpectrumMayBeRunning = true;
    const spectrum = JSON.parse(bridge.audioSpectrum());
    const active = spectrum?.state === "active" && Array.isArray(spectrum.bands);
    mediaBar.classList.toggle("has-audio-spectrum", active);
    if (!active) {
      for (const bar of mediaBars) bar.style.removeProperty("--level");
      return;
    }
    // Scaled, not resized: a transform never makes the page lay itself out again.
    mediaBars.forEach((bar, index) => {
      const level = Math.max(0, Math.min(1, Number(spectrum.bands[index]) || 0));
      bar.style.setProperty("--level", (0.08 + level * 0.92).toFixed(2));
    });
  } catch {
    mediaBar.classList.remove("has-audio-spectrum");
  }
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
  document.body.classList.remove("waking");
  dismissSplash();
  const now = new Date();
  const display = normalizeDisplay(snapshot.display);
  const activeTheme = screenTheme(display);
  if (!sceneThemes.includes(activeTheme)) agendaPageCount = 1;
  document.body.dataset.theme = activeTheme;
  document.body.dataset.mode = mode.toLowerCase();
  document.body.classList.toggle("immersive", sceneThemes.includes(activeTheme));
  document.body.classList.toggle("has-photo", Boolean(snapshot.display.backgroundUrl) && display.mood !== "night");
  const customPhoto = document.body.classList.contains("has-photo");
  const chosenWork = customPhoto ? null : artworkFor(activeTheme);
  // A slideshow starts from the chosen painting's gallery and walks it (or every section).
  const artwork = chosenWork && display.art.slideshow
    ? slideshowArtwork(display.art.collection, display.art.minutes, now.getTime()) || chosenWork
    : chosenWork;
  document.body.classList.toggle("art-scene", Boolean(artwork));
  document.body.classList.toggle("art-full", Boolean(artwork) && display.art.fullscreen);
  artworkFrame.hidden = !artwork;
  if (artwork) showArtwork(artwork);
  document.body.dataset.layout = sceneLayout(activeTheme, { artwork: Boolean(artwork), customPhoto });
  upgradeBackdrop(activeTheme);
  paintSceneMotion(activeTheme, customPhoto || Boolean(artwork));
  paintSceneVideo(activeTheme, { running: videoRunning(), customPhoto });
  document.body.classList.toggle("guests", display.privacy);
  document.body.classList.toggle("hide-weather", !display.showWeather);
  document.body.classList.toggle("hide-calendar", !display.showCalendar);
  if (!display.showCalendar || display.privacy) hideEventCue();
  const photoUrl = snapshot.display.backgroundUrl || "";
  if (photo.dataset.url !== photoUrl) {
    photo.dataset.url = photoUrl;
    photo.style.backgroundImage = photoUrl ? `url("${photoUrl}")` : "";
  }
  paintClock(now);
  paintMedia();
  document.querySelectorAll("#modes [data-mode]").forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  if (snapshot.display.note?.text && !display.privacy) {
    setHidden(noteEl, false);
    setText(noteEl, snapshot.display.note.text);
  } else {
    setHidden(noteEl, true);
  }
  document.body.classList.toggle("has-note", !noteEl.hidden);
  const key = `${viewSig()}|${now.getMinutes()}`;
  if (!force && key === paintedKey) return;
  paintedKey = key;
  if (sceneThemes.includes(activeTheme)) {
    const sizeKey = scenePageSizeKey(activeTheme);
    let html = renderSceneAgenda(now, activeTheme);
    // Measured once per screen size, against the full column the panel may grow into.
    if (!scenePageSizes.has(sizeKey) && html) {
      const previousSize = scenePageSize(activeTheme);
      screen.classList.add("measuring");
      screen.innerHTML = html;
      const measuredSize = measuredScenePageSize();
      screen.classList.remove("measuring");
      if (measuredSize) {
        scenePageSizes.set(sizeKey, measuredSize);
        if (measuredSize !== previousSize) html = renderSceneAgenda(now, activeTheme);
      }
      paintedHtml = "";
    }
    swapScreen(html);
  }
}

/**
 * The agenda is only rebuilt when it reads differently, and then in place. Rows used to
 * slide and fade in on every page turn and every re-measure, which read as the panel
 * blinking every ten seconds.
 */
function swapScreen(html) {
  if (html === paintedHtml) return;
  paintedHtml = html;
  screen.innerHTML = html;
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (session) headers.authorization = `Bearer ${session}`;
  headers["x-dino-visible"] = asleep || !nativeForeground() ? "0" : "1";
  // Says what this screen is, so a home with two of them can tell them apart.
  const name = screenNameFrom(navigator.userAgent, window.dino?.computerName || "");
  if (name) headers["x-dino-screen-name"] = name;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  if (response.status === 401) {
    session = "";
    localStorage.removeItem("dinoTvSession");
    try { localStorage.removeItem(REMEMBERED); } catch { /* ignore */ }
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
  dismissSplash();
}

/**
 * The overlay loads this page from scratch every time it is raised over a film, and until
 * the first snapshot arrives there is nothing to draw — which showed as a stranger's
 * wallpaper and a clock reading 00:00. The last snapshot is kept so the screen comes up
 * already looking like itself, and is thrown away if the television is re-paired.
 */
const REMEMBERED = "dinoTvSnapshot";

function rememberSnapshot(data) {
  try { localStorage.setItem(REMEMBERED, JSON.stringify({ session: session.slice(0, 12), at: Date.now(), data })); } catch { /* the screen simply starts blank */ }
}

function rememberedSnapshot() {
  try {
    const kept = JSON.parse(localStorage.getItem(REMEMBERED) || "null");
    if (!kept?.data?.display || kept.session !== session.slice(0, 12)) return null;
    // A day-old agenda is worse than none; the wallpaper and theme are still right.
    return Date.now() - Number(kept.at || 0) < 12 * 3600_000 ? kept.data : null;
  } catch {
    return null;
  }
}

// The screen asks every two seconds and the answer is almost always the same; an
// unchanged answer used to repaint the screen and rewrite two caches on disk each time.
let lastSnapshotText = "";

async function loadSnapshot() {
  const data = await request("/v1/display/snapshot");
  const text = JSON.stringify(data);
  if (snapshot && text === lastSnapshotText) return;
  lastSnapshotText = text;
  if (flushTvApp(data.reloadAt)) return;
  applyPower(data.power, data.powerAt);
  syncNativeSession();
  snapshot = data;
  if (adoptWeather(data.weather, data.display?.place)) {
    snapshot.weather = weather;
  } else {
    snapshot.weather = weather;
    void refreshWeather(data.display?.place);
  }
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
  rememberSnapshot(data);
}

async function startPairing() {
  pairEl.hidden = false;
  dismissSplash();
  pairEyebrow.textContent = "Подключение экрана";
  pairTitle.textContent = "Владелец: откройте консоль из Telegram-бота и введите код";
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
  document.body.classList.toggle("motion-paused", document.hidden || asleep || !nativeForeground());
  paintSceneVideo(document.body.dataset.theme, { running: videoRunning(), customPhoto: document.body.classList.contains("has-photo") });
  paintClock(now);
  maybeEventCue(now);
  readNativeNowPlaying();
  paintMedia();
  if (!snapshot) return;
  if (now.getSeconds() === 0) paint();
}, 1000);
document.addEventListener("visibilitychange", () => {
  document.body.classList.toggle("motion-paused", document.hidden || asleep || !nativeForeground());
});
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    scenePageSizes.clear();
    agendaPage = 0;
    paint(true);
  }, 120);
});
if (typeof nativeBridge()?.audioSpectrum === "function") setInterval(paintNativeSpectrum, 80);
let polling = false;
setInterval(() => {
  if (!session || polling) return;
  polling = true;
  loadSnapshot().catch(() => {
    // Still on the splash: say why the day has not come yet, instead of spinning forever.
    const status = document.querySelector("#splashStatus");
    if (status) status.textContent = navigator.onLine === false ? "Нет интернета. Ждём сеть" : "Сервер не отвечает. Пробуем ещё раз";
  }).finally(() => { polling = false; });
}, 2_000);

// A mouse means the desktop app: the view pills come back while it moves.
let pointerTimer;
window.addEventListener("mousemove", () => {
  document.body.classList.add("pointer-active");
  clearTimeout(pointerTimer);
  pointerTimer = setTimeout(() => document.body.classList.remove("pointer-active"), 3500);
}, { passive: true });

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
    const kept = rememberedSnapshot();
    if (kept) {
      snapshot = kept;
      adoptWeather(kept.weather, kept.display?.place);
      snapshot.weather = weather;
      pairEl.hidden = true;
      paint(true);
    }
    loadSnapshot().then(startRotation).catch(startPairing);
  } else {
    startPairing();
  }
}

// The clock needs nothing from the server, so it is never allowed to read 00:00.
paintClock(new Date());
document.body.classList.add("waking");

// Physical TV remotes (and Escape on desktop) should be able to leave without the
// console power toggle — the native shell turns this into moveTaskToBack.
window.addEventListener("keydown", (event) => {
  const leave = event.key === "Escape"
    || event.key === "GoBack"
    || event.key === "BrowserBack"
    || event.keyCode === 4
    || event.keyCode === 27;
  if (!leave) return;
  const bridge = nativeBridge();
  if (!bridge || typeof bridge.powerOff !== "function") return;
  event.preventDefault();
  bridge.powerOff();
});

boot();
