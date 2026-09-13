import { normalizeDisplay, normalizeNote, normalizeNowPlaying, noteDurations, rotationPresets, screenTheme, tvRemoteStatus, musicRemoteCopy } from "../control-state.js";
import { shouldLoadTelegramSdk } from "./telegram.js";
import { createRemotePressController } from "./remote-press.js";
import { createHouseholdScope } from "./household-scope.js";
import { searchPlaces } from "./places.js";
import { needsAccount, needsHome } from "./request-scope.js";

const API = window.DINO_API_BASE_URL || `${location.origin}/api`;
let remoteEnabled = false;
let calendarUiKey = "";
const householdScope = createHouseholdScope();
let canManageHome = false;
let calendarPermissions = {};
let houseList = [];
let personLabels = { misha: "Участник 1", natasha: "Участник 2" };
let telegram = window.Telegram?.WebApp;
let display = normalizeDisplay();
let currentNote = null;
let noteMinutes = 60;
let nowPlaying = normalizeNowPlaying();
let tvLinked = false;
let tvOnline = false;
let tvPower = "on";
const messageBox = document.querySelector("#message");
let initData = telegram?.initData || "";

function sessionToken() {
  try {
    return localStorage.getItem("dinoSession") || "";
  } catch {
    return "";
  }
}

function rememberSession(token) {
  if (!token) return;
  try { localStorage.setItem("dinoSession", token); } catch { /* ignore */ }
}

function forgetSession() {
  try { localStorage.removeItem("dinoSession"); } catch { /* ignore */ }
}

function homeToken() {
  try {
    return window.DINO_HOME_TOKEN || localStorage.getItem("dinoHomeToken") || "";
  } catch {
    return window.DINO_HOME_TOKEN || "";
  }
}

function rememberHomeToken(token) {
  if (!token) return;
  try { localStorage.setItem("dinoHomeToken", token); } catch { /* ignore */ }
}

function forgetHomeToken() {
  window.DINO_HOME_TOKEN = "";
  try { localStorage.removeItem("dinoHomeToken"); } catch { /* ignore */ }
}

function hasRemoteAuth() {
  return Boolean(initData || homeToken() || sessionToken());
}

function isNativeIos() {
  return Boolean(window.__DINO_NATIVE_IOS__) || /DinoHome\//i.test(navigator.userAgent);
}

function applyTelegram() {
  if (!telegram) return;
  telegram.ready();
  telegram.expand();
  telegram.setHeaderColor?.("#171614");
  telegram.setBackgroundColor?.("#171614");
}

async function bootTelegram() {
  if (telegram) {
    applyTelegram();
    return;
  }
  if (!shouldLoadTelegramSdk({
    hasTelegram: Boolean(window.Telegram?.WebApp),
    isNative: isNativeIos(),
    userAgent: navigator.userAgent,
    hasTelegramProxy: Boolean(window.TelegramWebviewProxy),
  })) {
    return;
  }
  await new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.onload = resolve;
    script.onerror = resolve;
    document.head.appendChild(script);
  });
  telegram = window.Telegram?.WebApp;
  initData = telegram?.initData || "";
  applyTelegram();
}

// A line under the fold went unread; anything worth saying is worth stopping for.
function setNotice(text, type = "") {
  if (!text) { if (messageBox.open) messageBox.close(); return; }
  document.querySelector("#messageText").textContent = text;
  messageBox.className = `message ${type}`;
  if (!messageBox.open) messageBox.showModal();
}

document.querySelector("#messageClose").addEventListener("click", () => messageBox.close());

// Only the group holding the current scene is worth having open; the rest stay folded.
function paintSceneGroups() {
  let opened = false;
  for (const group of document.querySelectorAll(".theme-row")) {
    const chosen = group.querySelector("[data-scene].active");
    group.querySelector(".row-value").textContent = chosen ? chosen.querySelector("span").textContent : "";
    if (chosen && !opened) { group.open = true; opened = true; }
    else if (!chosen && !group.dataset.touched) group.open = false;
  }
}

// Once someone opens a group by hand, stop closing it for them.
for (const group of document.querySelectorAll(".theme-row")) {
  group.addEventListener("toggle", () => { if (group.open) group.dataset.touched = "1"; });
}

function showTab(tab) {
  if (!hasRemoteAuth()) tab = "signin";
  else if (!householdScope.id) tab = "home";
  else if (!tvLinked && tab !== "home") tab = "setup";
  if (tab === "remote" && !remoteEnabled) tab = "screen";
  document.querySelectorAll(".pane").forEach((pane) => { pane.hidden = pane.id !== `pane-${tab}`; });
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  // The dock is noise until there is a screen to control.
  // The dock returns as soon as there is a home to control; before that it leads nowhere.
  document.querySelector(".dock").hidden = tab === "signin" || tab === "setup" || (tab === "home" && !houseList.length);
  document.querySelector("#homePaneBack").hidden = !houseList.length;
  document.querySelector("#homePaneTitle").textContent = houseList.length ? "Ещё один дом" : "Ваш дом";
}

function paintMusic() {
  const card = document.querySelector(".now-playing");
  const art = document.querySelector("#musicArt");
  const title = document.querySelector("#musicTitle");
  const artist = document.querySelector("#musicArtist");
  const toggle = document.querySelector("#musicToggle");
  const volume = document.querySelector("#musicVolume");
  const hint = document.querySelector("#musicHint");
  const toTv = document.querySelector("[data-music=toTv]");
  const live = Boolean(nowPlaying.title);
  const copy = musicRemoteCopy({ tvOnline, nowPlaying });
  title.textContent = nowPlaying.title || "Тихо";
  artist.textContent = live
    ? (nowPlaying.artist || nowPlaying.source || "Яндекс Музыка")
    : "На телевизоре сейчас ничего не играет";
  art.classList.toggle("has-art", Boolean(nowPlaying.artworkUrl));
  art.style.backgroundImage = nowPlaying.artworkUrl ? `url("${nowPlaying.artworkUrl}")` : "";
  card.classList.toggle("is-playing", live && nowPlaying.isPlaying);
  toggle.textContent = nowPlaying.isPlaying ? "❚❚" : "▶";
  toggle.setAttribute("aria-label", nowPlaying.isPlaying ? "Пауза" : "Играть");
  if (document.activeElement !== volume && Date.now() - volumeTouchedAt > 2_500) {
    volume.value = String(nowPlaying.volumePercent ?? 50);
    lastSentVolume = Number(volume.value);
  }
  document.querySelectorAll("[data-music]").forEach((button) => {
    if (button.dataset.music === "toTv") button.disabled = tvOnline;
    else button.disabled = !live;
  });
  volume.disabled = !live;
  toTv.textContent = copy.toTv;
  hint.textContent = copy.hint;
}

function rotationInputs() {
  return [
    ["rotateToday", "today"],
    ["rotateTomorrow", "tomorrow"],
    ["rotateWeek", "week"],
  ];
}

function paintRotation() {
  const rotation = display.rotation;
  document.querySelectorAll("[data-rotation-enabled]").forEach((button) => {
    button.classList.toggle("active", String(rotation.enabled) === button.dataset.rotationEnabled);
  });
  const focused = document.activeElement;
  for (const [id, key] of rotationInputs()) {
    const input = document.querySelector(`#${id}`);
    input.disabled = !rotation.enabled;
    if (focused !== input) input.value = String(rotation[key]);
  }
  const uniform = rotation.today === rotation.tomorrow && rotation.tomorrow === rotation.week;
  document.querySelectorAll("[data-rotation-seconds]").forEach((button) => {
    button.disabled = !rotation.enabled;
    button.classList.toggle("active", uniform && Number(button.dataset.rotationSeconds) === rotation.today);
  });
}

function paint() {
  document.querySelectorAll("[data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === display.mode));
  const activeScene = screenTheme(display);
  document.querySelectorAll("[data-scene]").forEach((button) => button.classList.toggle("active", button.dataset.scene === activeScene));
  paintSceneGroups();
  document.querySelectorAll("[data-privacy]").forEach((button) => button.classList.toggle("active", String(display.privacy) === button.dataset.privacy));
  document.querySelector("#guestsValue").textContent = display.privacy ? "скрыты названия" : "выключен";
  document.querySelector("#wallpaperValue").textContent = display.backgroundUrl ? "свои" : "по теме";
  document.querySelectorAll("[data-layer]").forEach((button) => {
    const layer = button.dataset.layer;
    const on = layer === "showWeather" ? display.showWeather : layer === "showCalendar" ? display.showCalendar : false;
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute("aria-checked", String(on));
  });
  const preview = document.querySelector("#backgroundPreview");
  const wallpaperLabel = document.querySelector("#wallpaperLabel");
  if (display.backgroundUrl) {
    preview.hidden = false;
    preview.style.backgroundImage = `url("${display.backgroundUrl}")`;
    wallpaperLabel.textContent = "Сменить обои";
  } else {
    preview.hidden = true;
    preview.style.backgroundImage = "";
    wallpaperLabel.textContent = "Поставить обои";
  }
  const hasNote = Boolean(currentNote?.text);
  document.querySelector("#addNote").hidden = hasNote;
  document.querySelector("#noteCard").hidden = !hasNote;
  document.querySelector("#notePreview").textContent = currentNote?.text || "";
  document.querySelector("#noteValue").textContent = hasNote ? "на экране" : "нет";
  const status = document.querySelector("#tvStatus");
  const state = document.querySelector("#tvState");
  const power = document.querySelector("#tvPower");
  const remote = tvRemoteStatus({ tvOnline, tvPower, nowPlaying });
  status.classList.toggle("online", tvOnline);
  status.classList.toggle("music", Boolean(nowPlaying.title) && !tvOnline);
  state.textContent = remote.state;
  power.textContent = remote.power;
  paintMusic();
  paintRotation();
  paintPairingUi();
}

function paintPairingUi() {
  const authed = hasRemoteAuth();
  const inviteButton = document.querySelector("#invitePhone");
  const inviteCode = document.querySelector("#inviteCode");
  const hint = document.querySelector("#pairHint");
  inviteButton.hidden = !authed || !householdScope.id;
  document.querySelector("#revokeDevices").hidden = !authed || !canManageHome;
  hint.textContent = "Код с телевизора привяжет его к этому дому. Свой телефон — кнопкой ниже, чужой человек — приглашением участника.";
  if (!authed) inviteCode.hidden = true;
}

function showInviteCode(code) {
  const el = document.querySelector("#inviteCode");
  el.textContent = code;
  el.hidden = !code;
}

async function request(path, options = {}) {
  const scope = householdScope.capture();
  if (!scope.id && needsHome(path)) throw new Error("Сначала выберите или создайте дом");
  if (!hasRemoteAuth() && needsAccount(path)) { showTab("signin"); throw new Error("Сначала войдите"); }
  const method = (options.method || "GET").toUpperCase();
  const headers = { ...(options.headers || {}) };
  let body = options.body;
  if (body === undefined && method !== "GET" && method !== "HEAD") body = "{}";
  if (body !== undefined) headers["content-type"] = "application/json";
  if (initData) headers["x-telegram-init-data"] = initData;
  const session = sessionToken();
  if (session) headers["x-dino-session"] = session;
  const token = homeToken();
  if (token) headers["x-dino-home-token"] = token;
  if (scope.id) headers["x-dino-home-id"] = scope.id;
  const response = await fetch(`${API}${path}`, {
    ...options,
    method,
    headers,
    body,
  });
  scope.assertCurrent();
  if (!response.ok) {
    const text = await response.text() || "Не удалось сохранить";
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed.error || parsed.message || text;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    if (response.status === 401 && /устарела|Нет доступа к пульту/i.test(message)) {
      forgetHomeToken();
      forgetSession();
      showTab("signin");
      message = "Связь устарела. Войдите заново.";
    }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

function applyState(data) {
  if (data.permissions) {
    canManageHome = data.permissions.manageHome === true;
    calendarPermissions = data.permissions.manageCalendars || {};
    document.querySelector("#householdOwner").hidden = !canManageHome;
    document.querySelector("#householdDanger").hidden = !canManageHome;
    document.querySelector("#labelsRow").hidden = !canManageHome;
    document.querySelector("#calendarSettings").hidden = false;
  }
  if (data.household) {
    document.querySelector("#householdRole").textContent = data.household.role === "owner" ? "Владелец · только ваши участники и устройства" : "Участник · общее расписание этого дома";
    document.querySelector("#homeRowValue").textContent = data.household.role === "owner" ? "Владелец" : "Участник";
  }
  if (data.connectedCalendars) {
    const linked = Object.values(data.connectedCalendars).filter(Boolean).length;
    document.querySelector("#calendarValue").textContent = linked ? `${linked} из 2` : "не подключены";
  }
  document.querySelector("#devicesValue").textContent = data.tvLinked ? "экран привязан" : "нет экранов";
  if (data.display) {
    const rotation = normalizeDisplay(data.display).rotation;
    document.querySelector("#rotationValue").textContent = rotation.enabled ? `${rotation.today} сек` : "выключена";
  }
  if (data.features) {
    remoteEnabled = data.features.tvRemote === true;
    document.querySelector('[data-tab="remote"]').hidden = !remoteEnabled;
    if (!remoteEnabled && !document.querySelector("#pane-remote").hidden) showTab("screen");
  }
  if (data.personLabels) {
    personLabels = data.personLabels;
    document.querySelector("#labelsValue").textContent = `${data.personLabels.misha} и ${data.personLabels.natasha}`;
    for (const person of ["misha", "natasha"]) {
      const field = document.querySelector(`#householdLabels [name="${person}"]`);
      if (document.activeElement !== field) field.value = personLabels[person];
    }
  }
  if (data.connectedCalendars) paintCalendars(data.connectedCalendars, data.googleConfigured);
  if (data.display?.place) paintPlace(data.display.place);
  if (data.display) {
    display = normalizeDisplay({ ...data.display, backgroundUrl: data.display.backgroundUrl || "" });
    currentNote = normalizeNote(data.display.note);
  }
  if ("nowPlaying" in data) nowPlaying = normalizeNowPlaying(data.nowPlaying || {});
  if (data.tvLinked !== undefined) {
    const had = tvLinked;
    tvLinked = Boolean(data.tvLinked);
    if (had !== tvLinked) showTab(tvLinked ? "screen" : "setup");
  }
  if ("tvOnline" in data) tvOnline = data.tvOnline === true;
  if (data.tvPower === "on" || data.tvPower === "off") tvPower = data.tvPower;
  paint();
  if (data.connectedCalendars) showCalendarWarning(data.connectedCalendars);
}

async function save(patch, successText = "") {
  const keepNoteUi = Boolean(patch.note || patch.clearNote);
  if (patch.tvPower === "off") tvOnline = false;
  if (patch.tvPower === "on" || patch.tvPower === "off") tvPower = patch.tvPower;
  if (!keepNoteUi) {
    const next = { ...patch };
    if (patch.rotation) next.rotation = { ...display.rotation, ...patch.rotation };
    display = normalizeDisplay({ ...display, ...next });
    paint();
  }
  try {
    const data = await request("/v1/miniapp/display", { method: "PATCH", body: JSON.stringify(patch) });
    applyState(data);
    telegram?.HapticFeedback?.impactOccurred?.("light");
    if (successText) setNotice(successText, "online");
    else setNotice("");
    return true;
  } catch (error) {
    telegram?.HapticFeedback?.notificationOccurred("error");
    setNotice(error.message, "error");
    return false;
  }
}

async function musicCommand(action, extra = {}) {
  try {
    const data = await request("/v1/miniapp/music", { method: "POST", body: JSON.stringify({ action, ...extra }) });
    applyState(data);
    telegram?.HapticFeedback?.impactOccurred?.("light");
    setNotice("");
  } catch (error) {
    telegram?.HapticFeedback?.notificationOccurred("error");
    setNotice(error.message, "error");
  }
}

async function tvCommand(body, button, { repeat = false } = {}) {
  if (!remoteEnabled) return;
  if (!repeat) bumpRemoteButton(button, "pressing");
  try {
    if (!repeat) {
      navigator.vibrate?.(12);
      telegram?.HapticFeedback?.impactOccurred?.("medium");
    }
    const data = await request("/v1/miniapp/tv", { method: "POST", body: JSON.stringify(body) });
    applyState(data);
    if (!repeat) {
      bumpRemoteButton(button, "sent");
      telegram?.HapticFeedback?.impactOccurred?.("light");
    }
    setNotice("");
  } catch (error) {
    bumpRemoteButton(button, "error");
    navigator.vibrate?.([18, 40, 18]);
    telegram?.HapticFeedback?.notificationOccurred("error");
    setNotice(error.message, "error");
  }
}

function bumpRemoteButton(button, kind) {
  if (!button) return;
  button.classList.remove("is-pressing", "is-sent", "is-error");
  if (kind === "pressing") {
    button.classList.add("is-pressing");
    return;
  }
  button.classList.remove("is-pressing");
  const cls = kind === "error" ? "is-error" : "is-sent";
  button.classList.add(cls);
  window.setTimeout(() => button.classList.remove(cls), kind === "error" ? 420 : 380);
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Не получилось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

function showCalendarWarning(connected = {}) {
  const missing = [];
  if (!connected.misha) missing.push(personLabels.misha);
  if (!connected.natasha) missing.push(personLabels.natasha);
  const warning = document.querySelector("#calendarWarning");
  if (!missing.length) {
    warning.hidden = true;
    warning.textContent = "";
    return;
  }
  warning.hidden = false;
  warning.textContent = `Ещё не подключены: ${missing.join(", ")}.`;
}

async function load() {
  paint();
  if (!hasRemoteAuth()) {
    showTab("signin");
    return;
  }
  try {
    if (!householdScope.id) {
      await loadHouseholds();
      if (!householdScope.id) return;
    }
    const data = await request("/v1/miniapp/state");
    applyState(data);
    if (!tvLinked) showTab("setup");
    setNotice("");
  } catch (error) {
    setNotice(error.message, "error");
  }
}

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => showTab(button.dataset.tab));
});
document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => save({ mode: button.dataset.mode }));
});
document.querySelectorAll("[data-scene]").forEach((button) => {
  button.addEventListener("click", () => {
    const scene = button.dataset.scene;
    if (scene === "night" || scene === "play") save({ mood: scene });
    else save({ theme: scene, mood: "home" });
  });
});
document.querySelectorAll("[data-privacy]").forEach((button) => {
  button.addEventListener("click", () => save({ privacy: button.dataset.privacy === "true" }));
});
document.querySelectorAll("[data-layer]").forEach((button) => {
  button.addEventListener("click", () => {
    const layer = button.dataset.layer;
    if (layer !== "showWeather" && layer !== "showCalendar") return;
    save({ [layer]: display[layer] === false });
  });
});
document.querySelectorAll("[data-rotation-enabled]").forEach((button) => {
  button.addEventListener("click", () => save({ rotation: { enabled: button.dataset.rotationEnabled === "true" } }));
});

const rotationPresetsEl = document.querySelector("#rotationPresets");
for (const seconds of rotationPresets) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.rotationSeconds = String(seconds);
  button.textContent = seconds % 60 === 0 ? `${seconds / 60}м` : `${seconds}с`;
  rotationPresetsEl.append(button);
}
rotationPresetsEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-rotation-seconds]");
  if (!button || button.disabled) return;
  const seconds = Number(button.dataset.rotationSeconds);
  save({ rotation: { today: seconds, tomorrow: seconds, week: seconds } });
});

function readRotationField(input, key) {
  const seconds = Number(input.value);
  if (!Number.isFinite(seconds)) return;
  save({ rotation: { [key]: seconds } });
}

for (const [id, key] of rotationInputs()) {
  const input = document.querySelector(`#${id}`);
  input.addEventListener("change", () => readRotationField(input, key));
}

const noteSheet = document.querySelector("#noteSheet");
const noteField = document.querySelector("#note");
const noteDurationsEl = document.querySelector("#noteDurations");
for (const item of noteDurations) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.minutes = String(item.minutes);
  button.textContent = item.label;
  noteDurationsEl.append(button);
}

function paintDurations() {
  noteDurationsEl.querySelectorAll("[data-minutes]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.minutes) === noteMinutes);
  });
}

function openNoteSheet() {
  noteMinutes = 60;
  noteField.value = "";
  paintDurations();
  noteSheet.hidden = false;
}

function closeNoteSheet() {
  noteSheet.hidden = true;
}

document.querySelector("#addNote").addEventListener("click", openNoteSheet);
document.querySelector("#noteSheetClose").addEventListener("click", closeNoteSheet);
noteDurationsEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-minutes]");
  if (!button) return;
  noteMinutes = Number(button.dataset.minutes);
  paintDurations();
});
document.querySelector("#noteForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = noteField.value.trim();
  if (!text) {
    setNotice("Напишите заметку", "error");
    return;
  }
  if (await save({ note: text, noteMinutes })) closeNoteSheet();
});
document.querySelector("#clearNote").addEventListener("click", () => save({ clearNote: true }));
document.querySelector("#tvPower").addEventListener("click", () => save({ tvPower: tvOnline ? "off" : "on" }));
document.querySelector("#clearBackground").addEventListener("click", () => save({ clearBackground: true }, "Обои сброшены"));
document.querySelector("#reloadTv").addEventListener("click", async () => {
  try {
    await request("/v1/miniapp/display", { method: "PATCH", body: JSON.stringify({ reloadTv: true }) });
    telegram?.HapticFeedback?.impactOccurred?.("light");
    setNotice("Заливаю на телевизор", "online");
  } catch (error) {
    telegram?.HapticFeedback?.notificationOccurred("error");
    setNotice(error.message, "error");
  }
});
document.querySelectorAll("[data-music]").forEach((button) => {
  button.addEventListener("click", () => musicCommand(button.dataset.music));
});
document.querySelector("#openKinopoisk")?.addEventListener("click", (event) => {
  tvCommand({ action: "launch", app: "kinopoisk" }, event.currentTarget);
});
const remotePress = createRemotePressController({
  send: (key, button, options) => tvCommand({ action: "key", key }, button, options),
  feedback: () => navigator.vibrate?.(8),
});
document.querySelectorAll("[data-tv-key]").forEach((button) => {
  button.addEventListener("pointerdown", (event) => remotePress.pointerDown(button, event));
  button.addEventListener("pointerup", (event) => remotePress.pointerEnd(button, event));
  button.addEventListener("pointercancel", (event) => remotePress.pointerEnd(button, event));
  button.addEventListener("lostpointercapture", (event) => remotePress.pointerEnd(button, event));
  button.addEventListener("click", (event) => remotePress.click(button, event));
});
document.querySelectorAll("[data-tv-launch]").forEach((button) => {
  button.addEventListener("pointerdown", () => {
    button.classList.add("is-pressing");
    navigator.vibrate?.(8);
  });
  button.addEventListener("pointerup", () => button.classList.remove("is-pressing"));
  button.addEventListener("pointercancel", () => button.classList.remove("is-pressing"));
  button.addEventListener("pointerleave", () => button.classList.remove("is-pressing"));
  button.addEventListener("click", () => tvCommand({ action: "launch", app: button.dataset.tvLaunch }, button));
});
let volumeTimer;
let lastSentVolume;
let volumeTouchedAt = 0;
function sendVolume(value) {
  const next = Math.max(0, Math.min(100, Math.round(Number(value))));
  if (!Number.isFinite(next) || lastSentVolume === next) return;
  lastSentVolume = next;
  volumeTouchedAt = Date.now();
  nowPlaying.volumePercent = next;
  musicCommand("volume", { volume: next });
}
document.querySelector("#musicVolume").addEventListener("input", (event) => {
  volumeTouchedAt = Date.now();
  nowPlaying.volumePercent = Number(event.target.value);
  clearTimeout(volumeTimer);
  volumeTimer = setTimeout(() => sendVolume(event.target.value), 320);
});
document.querySelector("#musicVolume").addEventListener("change", (event) => {
  volumeTouchedAt = Date.now();
  clearTimeout(volumeTimer);
  sendVolume(event.target.value);
});
document.querySelector("#musicVolume").addEventListener("pointerdown", () => {
  volumeTouchedAt = Date.now();
});
document.querySelector("#musicVolume").addEventListener("touchstart", () => {
  volumeTouchedAt = Date.now();
}, { passive: true });
document.querySelector("#background").addEventListener("change", async (event) => {
  const scope = householdScope.capture();
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const image = await readFile(file);
    scope.assertCurrent();
    const data = await request("/v1/miniapp/background", { method: "POST", body: JSON.stringify({ image }) });
    applyState(data);
    telegram?.HapticFeedback?.notificationOccurred("success");
    setNotice("Обои", "online");
  } catch (error) {
    telegram?.HapticFeedback?.notificationOccurred("error");
    setNotice(error.message, "error");
  } finally {
    event.target.value = "";
  }
});
async function submitPairCode(event, fieldId) {
  event.preventDefault();
  const code = document.querySelector(fieldId).value.replace(/\D/g, "");
  if (![6, 10].includes(code.length)) {
    setNotice("Код ТВ — 6 цифр, приглашение телефона — 10", "error");
    return;
  }
  try {
    const data = await request("/v1/miniapp/pair/approve", { method: "POST", body: JSON.stringify({ code }) });
    rememberHomeToken(data.homeToken);
    if (!householdScope.id) { await loadHouseholds(); }
    document.querySelector(fieldId).value = "";
    tvLinked = true;
    showInviteCode("");
    showTab("screen");
    telegram?.HapticFeedback?.notificationOccurred("success");
    setNotice("Устройство связано с выбранным домом.", "online");
    const state = await request("/v1/miniapp/state");
    applyState(state);
  } catch (error) {
    telegram?.HapticFeedback?.notificationOccurred("error");
    setNotice(error.message, "error");
  }
}

// Один код на все случаи: восемь цифр — вход, шесть — экран, десять — приглашение.
document.querySelector("#otherHomes").addEventListener("click", () => showTab("home"));
document.querySelector("#homePaneBack").addEventListener("click", () => showTab("more"));

document.querySelector("#signInForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const field = document.querySelector("#signInCode");
  const code = field.value.replace(/\D/g, "");
  if (code.length === 8) {
    try {
      const { token } = await request("/v1/miniapp/login", { method: "POST", body: JSON.stringify({ code }) });
      rememberSession(token);
      field.value = "";
      await load();
    } catch (error) {
      setNotice(error.message, "error");
    }
    return;
  }
  await submitPairCode(event, "#signInCode");
});

document.querySelector("#pairForm").addEventListener("submit", (event) => submitPairCode(event, "#pairCode"));
document.querySelector("#setupPairForm").addEventListener("submit", (event) => submitPairCode(event, "#setupPairCode"));

document.querySelector("#invitePhone").addEventListener("click", async () => {
  try {
    const data = await request("/v1/miniapp/pair/invite", { method: "POST" });
    showInviteCode(data.code);
    telegram?.HapticFeedback?.impactOccurred?.("light");
    setNotice("Код на 10 минут. Даёт телефону ваш доступ — не передавайте другим людям.", "online");
  } catch (error) {
    telegram?.HapticFeedback?.notificationOccurred("error");
    setNotice(error.message, "error");
  }
});

document.querySelector("#revokeDevices").addEventListener("click", async (event) => {
  if (!window.confirm("Отключить все связанные телевизоры и телефоны, включая этот? Календари сохранятся. Владельцы в Telegram сохранят доступ.")) return;
  event.currentTarget.disabled = true;
  try {
    await request("/v1/miniapp/access/revoke", { method: "POST" });
    forgetHomeToken();
    tvLinked = false;
    tvOnline = false;
    showInviteCode("");
    await load();
    showTab("more");
    setNotice("Устройства отключены. Для повторного подключения начните с консоли в Telegram.", "online");
  } catch (error) {
    setNotice(error.message, "error");
  } finally {
    document.querySelector("#revokeDevices").disabled = false;
  }
});

async function boot() {
  await bootTelegram();
  await load();
  setInterval(() => {
    if (!hasRemoteAuth() || !householdScope.id || document.hidden) return;
    request("/v1/miniapp/state").then(applyState).catch(() => {});
  }, 2000);
}

boot();

function resetHousehold(id) {
  householdScope.select(id);
  remotePress.stop(); clearTimeout(volumeTimer); closeNoteSheet();
  display = normalizeDisplay(); currentNote = null; nowPlaying = normalizeNowPlaying();
  tvLinked = false; tvOnline = false; tvPower = "on"; calendarUiKey = ""; canManageHome = false;
  personLabels = { misha: "Участник 1", natasha: "Участник 2" }; calendarPermissions = {};
  document.querySelector("#calendarAccounts").replaceChildren();
  document.querySelector("#householdAccess").replaceChildren();
  document.querySelector("#householdOwner").hidden = true;
  document.querySelector("#householdDanger").hidden = true;
  document.querySelector("#labelsRow").hidden = true;
  document.querySelector("#calendarSettings").hidden = true;
  document.querySelector("#householdRole").textContent = "";
  document.querySelector("#calendarWarning").hidden = true;
  // The header names the home even when the switch happens outside loadHouseholds.
  document.querySelector("#homeName").textContent = houseList.find((home) => home.id === id)?.name || "Dino TV";
  showInviteCode(""); paint();
}

/** The empty state names the step the person can actually take here. */
function houseStartHint(data) {
  if (data.registrationOpen) return "Дом — это ваш экран, календари и участники. Создайте свой или войдите в чужой по приглашению.";
  return "Новые дома сейчас не создаются. Введите код приглашения от владельца дома.";
}

async function loadHouseholds(preferred) {
  const data = await request("/v1/miniapp/households");
  houseList = data.households || [];
  const selected = houseList.find((h) => h.id === (preferred || householdScope.id || data.activeHomeId)) || houseList[0];
  const select = document.querySelector("#householdSelect");
  select.replaceChildren();
  for (const home of houseList) { const option = document.createElement("option"); option.value = home.id; option.textContent = home.name; select.append(option); }
  // The header shows the home; the invisible select over it only earns its place with a choice to make.
  select.hidden = !data.telegram || houseList.length < 2;
  document.querySelector("#homeName").textContent = selected?.name || "Dino TV";
  document.querySelector(".home").classList.toggle("switchable", !select.hidden);
  document.querySelector("#createHousehold").hidden = !data.telegram || !data.registrationOpen;
  document.querySelector("#joinHousehold").hidden = !data.telegram;
  document.querySelector("#otherHomes").hidden = !data.telegram;
  document.querySelector("#householdEmpty").textContent = houseStartHint(data);
  if ((selected?.id || "") !== householdScope.id) resetHousehold(selected?.id || "");
  if (selected) select.value = selected.id;
  else showTab("home");
}

document.querySelector("#householdSelect").addEventListener("change", async (event) => {
  const id = event.target.value;
  if (!houseList.some((home) => home.id === id)) return;
  resetHousehold(id);
  try {
    await request("/v1/miniapp/households/select", { method: "POST", body: JSON.stringify({ id }) });
    await load();
  } catch (error) { resetHousehold(""); setNotice(error.message, "error"); }
});

for (const [formId, path, field] of [["createHousehold", "/v1/miniapp/households", "name"], ["joinHousehold", "/v1/miniapp/households/join", "code"]]) {
  document.querySelector(`#${formId}`).addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector("button");
    button.disabled = true;
    try {
      const value = new FormData(form).get(field).trim();
      const data = await request(path, { method: "POST", body: JSON.stringify({ [field]: value }) });
      await loadHouseholds(data.household?.id || data.homeId); await load(); form.reset();
    } catch (error) { setNotice(error.message, "error"); } finally { button.disabled = false; }
  });
}

document.querySelector("#inviteMember").addEventListener("click", async () => {
  try {
    const data = await request("/v1/miniapp/households/invite", { method: "POST" });
    showInviteCode(data.code); setNotice("На 10 минут: участник открывает бота и вводит код в поле «Приглашение участника». Он увидит расписание этого дома.");
  } catch (error) { setNotice(error.message, "error"); }
});

document.querySelector("#householdLabels").addEventListener("submit", async (event) => {
  event.preventDefault(); const fields = new FormData(event.currentTarget);
  try {
    await request("/v1/miniapp/households/labels", { method: "PATCH", body: JSON.stringify(Object.fromEntries(fields)) });
    await load(); setNotice("Подписи календарей сохранены", "online");
  } catch (error) { setNotice(error.message, "error"); }
});

async function loadAccessList() {
  const [members, devices] = await Promise.all([request("/v1/miniapp/households/members"), request("/v1/miniapp/households/devices")]);
  const root = document.querySelector("#householdAccess"); root.replaceChildren();
  const row = (text, url) => {
    const item = document.createElement("div"), label = document.createElement("span");
    item.className = "household-access-row"; label.textContent = text; item.append(label);
    if (url) { const button = document.createElement("button"); button.type = "button"; button.textContent = "Отключить";
      button.addEventListener("click", async () => {
        if (!window.confirm("Отключить доступ к этому дому?")) return;
        try { await request(url, { method: "DELETE" }); await loadAccessList(); } catch (error) { setNotice(error.message, "error"); }
      }); item.append(button); }
    root.append(item);
  };
  for (const member of members.members) row(`Telegram ${member.userId} · ${member.role === "owner" ? "владелец" : "участник"}`, member.role === "owner" ? null : `/v1/miniapp/households/members/${member.userId}`);
  for (const device of devices.devices) row(`${device.label} · ${new Date(device.created).toLocaleDateString("ru-RU")} · ${device.id.slice(0, 6)}`, `/v1/miniapp/households/devices/${device.id}`);
}
function paintPlace(place) {
  const label = document.querySelector("#placeCurrent");
  label.textContent = place?.name || "не выбрано";
}

async function savePlace(place) {
  await request("/v1/miniapp/display", {
    method: "PATCH",
    body: JSON.stringify({ place: { name: place.name, latitude: place.latitude, longitude: place.longitude, timezone: place.timezone } }),
  });
  paintPlace(place);
  document.querySelector("#placeResults").replaceChildren();
  document.querySelector("#placeSearch").reset();
  setNotice(`Погода теперь для места «${place.name}». Экран подхватит в течение минуты.`, "online");
}

function showPlaceResults(found) {
  const root = document.querySelector("#placeResults");
  root.replaceChildren();
  if (!found.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "Ничего не нашлось. Попробуйте соседний крупный город или напишите название латиницей.";
    root.append(empty);
    return;
  }
  for (const place of found) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "place-option";
    const name = document.createElement("strong");
    name.textContent = place.name;
    const region = document.createElement("small");
    region.textContent = place.region || place.timezone;
    button.append(name, region);
    button.addEventListener("click", () => savePlace(place).catch((error) => setNotice(error.message, "error")));
    root.append(button);
  }
}

document.querySelector("#placeSearch").addEventListener("submit", async (event) => {
  event.preventDefault();
  const field = event.target.elements.query;
  const button = event.target.querySelector("button");
  button.disabled = true;
  try {
    showPlaceResults(await searchPlaces(field.value));
  } catch (error) {
    setNotice(error.message, "error");
  } finally {
    button.disabled = false;
  }
});

// The phone knows where it is; a television almost never does.
document.querySelector("#placeLocate").addEventListener("click", () => {
  const button = document.querySelector("#placeLocate");
  if (!navigator.geolocation) return setNotice("Этот телефон не умеет определять место", "error");
  button.disabled = true;
  navigator.geolocation.getCurrentPosition(async (position) => {
    try {
      const name = window.prompt("Как назвать это место на экране?", "Дом");
      if (!name?.trim()) return;
      await savePlace({
        name: name.trim().slice(0, 60),
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch (error) {
      setNotice(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }, () => {
    button.disabled = false;
    setNotice("Не удалось определить место. Разрешите доступ к геопозиции или найдите город вручную.", "error");
  }, { timeout: 15_000, maximumAge: 600_000 });
});

document.querySelector("#showHouseholdAccess").addEventListener("click", () => loadAccessList().catch((error) => setNotice(error.message, "error")));
document.querySelector("#deleteHousehold").addEventListener("click", async () => {
  if (!window.confirm("Удалить выбранный дом, календари, фон и доступ всех его устройств? Это нельзя отменить.")) return;
  try { await request("/v1/miniapp/households/current", { method: "DELETE" }); resetHousehold(""); if (!initData) forgetHomeToken(); else await loadHouseholds(); await load(); }
  catch (error) { setNotice(error.message, "error"); }
});

function paintCalendars(connected, configured) {
  const key = JSON.stringify([connected, configured, personLabels, calendarPermissions]);
  if (key === calendarUiKey) return;
  calendarUiKey = key;
  const root = document.querySelector("#calendarAccounts");
  root.replaceChildren();
  if (configured === false) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Владелец сервера должен заполнить GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET в .env.";
    root.append(hint);
    return;
  }
  for (const person of ["misha", "natasha"]) {
    const card = document.createElement("div");
    card.className = "calendar-account";
    const title = document.createElement("strong");
    title.textContent = `${personLabels[person]} · ${connected[person] ? "подключён" : "не подключён"}`;
    card.append(title);
    if (calendarPermissions[person] === false) {
      const hint = document.createElement("p"); hint.className = "hint"; hint.textContent = "Настраивает владелец этого календаря или дома."; card.append(hint); root.append(card); continue;
    }
    const button = (text, action) => {
      const el = document.createElement("button");
      el.type = "button";
      el.textContent = text;
      el.addEventListener("click", async () => {
        el.disabled = true;
        try { await action(); } catch (error) { setNotice(error.message, "error"); }
        finally { el.disabled = false; }
      });
      card.append(el);
    };
    button(connected[person] ? "Подключить заново" : "Подключить Google", async () => {
      const result = await request("/v1/miniapp/calendars/connect", { method: "POST", body: JSON.stringify({ person }) });
      // Native wrappers open this HTTPS navigation in the system browser, not an embedded Google login.
      const target = new URL(result.url);
      if (target.protocol !== "https:" || target.hostname !== "accounts.google.com") throw new Error("Некорректная ссылка Google");
      if (telegram?.openLink) telegram.openLink(target.href);
      else window.location.assign(target.href);
    });
    if (connected[person]) {
      button("Выбрать календари", async () => {
        const result = await request(`/v1/miniapp/calendars/${person}`);
        card.querySelector("form")?.remove();
        const form = document.createElement("form");
        for (const item of result.calendars) {
          const label = document.createElement("label");
          const check = document.createElement("input");
          check.type = "checkbox"; check.value = item.id; check.checked = item.selected;
          label.append(check, document.createTextNode(item.name));
          form.append(label);
        }
        const save = document.createElement("button");
        save.textContent = "Сохранить выбор"; save.type = "submit";
        form.append(save);
        form.addEventListener("submit", async (event) => {
          event.preventDefault(); save.disabled = true;
          try {
            const calendarIds = [...form.querySelectorAll("input:checked")].map((el) => el.value);
            if (!calendarIds.length) throw new Error("Выберите хотя бы один календарь или отключите аккаунт.");
            await request(`/v1/miniapp/calendars/${person}`, { method: "PATCH", body: JSON.stringify({ calendarIds }) });
            setNotice("Календари сохранены", "online"); form.remove();
          } catch (error) { setNotice(error.message, "error"); }
          finally { save.disabled = false; }
        });
        card.append(form);
      });
      button("Отключить", async () => {
        if (!window.confirm(`Убрать календарь «${personLabels[person]}» из этого дома?`)) return;
        await request("/v1/miniapp/calendars/disconnect", { method: "POST", body: JSON.stringify({ person }) });
        await load();
      });
    }
    root.append(card);
  }
}
