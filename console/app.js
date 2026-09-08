import { normalizeDisplay, normalizeNote, normalizeNowPlaying, noteDurations, rotationPresets, screenTheme, tvRemoteStatus, musicRemoteCopy } from "../control-state.js";
import { shouldLoadTelegramSdk } from "./telegram.js";

const API = window.DINO_API_BASE_URL || "https://api.dym-dino.ru";
let telegram = window.Telegram?.WebApp;
let display = normalizeDisplay();
let currentNote = null;
let noteMinutes = 60;
let nowPlaying = normalizeNowPlaying();
let tvLinked = false;
let tvOnline = false;
let tvPower = "on";
const notice = document.querySelector("#notice");
let initData = telegram?.initData || "";

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
  try { localStorage.removeItem("dinoHomeToken"); } catch { /* ignore */ }
}

function hasRemoteAuth() {
  return Boolean(initData || homeToken());
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

function setNotice(text, type = "") {
  notice.textContent = text;
  notice.className = `status ${type}`;
}

function showTab(tab) {
  document.querySelectorAll(".pane").forEach((pane) => { pane.hidden = pane.id !== `pane-${tab}`; });
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
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
  document.querySelectorAll("[data-privacy]").forEach((button) => button.classList.toggle("active", String(display.privacy) === button.dataset.privacy));
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
  inviteButton.hidden = !authed;
  hint.textContent = authed
    ? "Второй пульт — когда удобно: нажмите «Показать код». Цифры появятся здесь и на телевизоре."
    : "Код на телевизоре. Если экран уже дома, на другом телефоне откройте «Ещё» и нажмите «Показать код».";
  if (!authed) inviteCode.hidden = true;
}

function showInviteCode(code) {
  const el = document.querySelector("#inviteCode");
  el.textContent = code;
  el.hidden = !code;
}

async function request(path, options = {}) {
  const allowUnauthedPair = path.includes("/pair/approve");
  if (!hasRemoteAuth() && !allowUnauthedPair) throw new Error("Введите код с телевизора во вкладке «Ещё»");
  const method = (options.method || "GET").toUpperCase();
  const headers = { ...(options.headers || {}) };
  let body = options.body;
  if (body === undefined && method !== "GET" && method !== "HEAD") body = "{}";
  if (body !== undefined) headers["content-type"] = "application/json";
  if (initData) headers["x-telegram-init-data"] = initData;
  const token = homeToken();
  if (token) headers["x-dino-home-token"] = token;
  const response = await fetch(`${API}${path}`, {
    ...options,
    method,
    headers,
    body,
  });
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
      showTab("more");
      message = "Связь устарела. Введите свежий код с телевизора во вкладке «Ещё».";
    }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

function applyState(data) {
  if (data.display) {
    display = normalizeDisplay({ ...data.display, backgroundUrl: data.display.backgroundUrl || display.backgroundUrl });
    currentNote = normalizeNote(data.display.note);
  }
  if ("nowPlaying" in data) nowPlaying = normalizeNowPlaying(data.nowPlaying || {});
  if (data.tvLinked !== undefined) tvLinked = Boolean(data.tvLinked);
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

async function tvCommand(body, button) {
  bumpRemoteButton(button, "pressing");
  try {
    navigator.vibrate?.(12);
    telegram?.HapticFeedback?.impactOccurred?.("medium");
    const data = await request("/v1/miniapp/tv", { method: "POST", body: JSON.stringify(body) });
    applyState(data);
    bumpRemoteButton(button, "sent");
    telegram?.HapticFeedback?.impactOccurred?.("light");
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
  if (!connected.misha) missing.push("Миша");
  if (!connected.natasha) missing.push("Наташа");
  const warning = document.querySelector("#calendarWarning");
  if (!missing.length) {
    warning.hidden = true;
    warning.textContent = "";
    return;
  }
  warning.hidden = false;
  warning.textContent = missing.length === 2 ? "Календари отвалились" : `Календарь ${missing[0]} отвалился`;
}

async function load() {
  paint();
  if (!hasRemoteAuth()) {
    showTab("more");
    setNotice("Введите код с телевизора, чтобы пульт запомнил дом");
    return;
  }
  try {
    const data = await request("/v1/miniapp/state");
    applyState(data);
    if (!tvLinked) showTab("more");
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
document.querySelectorAll("[data-tv-key]").forEach((button) => {
  button.addEventListener("pointerdown", () => {
    button.classList.add("is-pressing");
    navigator.vibrate?.(8);
  });
  button.addEventListener("pointerup", () => button.classList.remove("is-pressing"));
  button.addEventListener("pointercancel", () => button.classList.remove("is-pressing"));
  button.addEventListener("pointerleave", () => button.classList.remove("is-pressing"));
  button.addEventListener("click", () => tvCommand({ action: "key", key: button.dataset.tvKey }, button));
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
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const image = await readFile(file);
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
document.querySelector("#pairForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = document.querySelector("#pairCode").value.replace(/\D/g, "");
  if (code.length !== 6) {
    setNotice("Шесть цифр с телевизора", "error");
    return;
  }
  try {
    const data = await request("/v1/miniapp/pair/approve", { method: "POST", body: JSON.stringify({ code }) });
    rememberHomeToken(data.homeToken);
    document.querySelector("#pairCode").value = "";
    tvLinked = true;
    showInviteCode("");
    showTab("screen");
    telegram?.HapticFeedback?.notificationOccurred("success");
    setNotice("Пульт связан с домом. Второй телефон можно добавить позже в «Ещё» → «Показать код».", "online");
    const state = await request("/v1/miniapp/state");
    applyState(state);
  } catch (error) {
    telegram?.HapticFeedback?.notificationOccurred("error");
    setNotice(error.message, "error");
  }
});
document.querySelector("#invitePhone").addEventListener("click", async () => {
  try {
    const data = await request("/v1/miniapp/pair/invite", { method: "POST" });
    showInviteCode(data.code);
    telegram?.HapticFeedback?.impactOccurred?.("light");
    setNotice("Введите этот код на втором телефоне", "online");
  } catch (error) {
    telegram?.HapticFeedback?.notificationOccurred("error");
    setNotice(error.message, "error");
  }
});

async function boot() {
  await bootTelegram();
  await load();
  setInterval(() => {
    if (!hasRemoteAuth()) return;
    request("/v1/miniapp/state").then(applyState).catch(() => {});
  }, 2000);
}

boot();
