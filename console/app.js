import { normalizeDisplay, normalizeNote, normalizeNowPlaying, noteDurations, rotationPresets, screenTheme } from "../control-state.js";

const API = window.DINO_API_BASE_URL || "https://api.dym-dino.ru";
const telegram = window.Telegram?.WebApp;
let display = normalizeDisplay();
let currentNote = null;
let noteMinutes = 60;
let nowPlaying = normalizeNowPlaying();
let musicConnected = false;
let tvLinked = false;
let tvOnline = false;
let tvPower = "on";
const notice = document.querySelector("#notice");
const initData = telegram?.initData || "";

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

function hasRemoteAuth() {
  return Boolean(initData || homeToken());
}

if (telegram) {
  telegram.ready();
  telegram.expand();
  telegram.setHeaderColor?.("#171614");
  telegram.setBackgroundColor?.("#171614");
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
  const art = document.querySelector("#musicArt");
  const title = document.querySelector("#musicTitle");
  const artist = document.querySelector("#musicArtist");
  const toggle = document.querySelector("#musicToggle");
  const volume = document.querySelector("#musicVolume");
  const hint = document.querySelector("#musicHint");
  title.textContent = nowPlaying.title || "Тихо";
  artist.textContent = [nowPlaying.artist, nowPlaying.deviceName || nowPlaying.source].filter(Boolean).join(" · ") || "Яндекс Музыка";
  art.style.backgroundImage = nowPlaying.artworkUrl ? `url("${nowPlaying.artworkUrl}")` : "";
  toggle.textContent = nowPlaying.isPlaying ? "❚❚" : "▶";
  toggle.setAttribute("aria-label", nowPlaying.isPlaying ? "Пауза" : "Играть");
  volume.value = String(nowPlaying.volumePercent ?? 50);
  document.querySelectorAll("[data-music]").forEach((button) => { button.disabled = !musicConnected && button.dataset.music !== "toTv"; });
  volume.disabled = !musicConnected;
  hint.textContent = musicConnected
    ? (nowPlaying.deviceName ? `Играет: ${nowPlaying.deviceName}` : "Управляется через Яндекс Музыку")
    : "Кнопка «На телевизор» не переносит трек. В Яндекс Музыке на телефоне нажмите колонку и выберите Кинопоиск. «Вкл» справа вверху открывает сам Dino TV.";
}

function rotationInputs() {
  return [
    ["rotateNow", "now"],
    ["rotateToday", "today"],
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
  const uniform = rotation.now === rotation.today && rotation.today === rotation.week;
  document.querySelectorAll("[data-rotation-seconds]").forEach((button) => {
    button.disabled = !rotation.enabled;
    button.classList.toggle("active", uniform && Number(button.dataset.rotationSeconds) === rotation.now);
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
  status.classList.toggle("online", tvOnline);
  state.textContent = tvOnline ? "на экране" : tvPower === "off" ? "выключен" : "не на связи";
  power.textContent = tvOnline ? "Выкл" : "Вкл";
  paintMusic();
  paintRotation();
}

async function request(path, options = {}) {
  const allowUnauthedPair = path.includes("/pair/approve");
  if (!hasRemoteAuth() && !allowUnauthedPair) throw new Error("Введите код с телевизора во вкладке «Ещё»");
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (initData) headers["x-telegram-init-data"] = initData;
  const token = homeToken();
  if (token) headers["x-dino-home-token"] = token;
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const text = await response.text() || "Не удалось сохранить";
    try {
      const parsed = JSON.parse(text);
      throw new Error(parsed.error || parsed.message || text);
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(text);
      throw error;
    }
  }
  return response.status === 204 ? null : response.json();
}

function applyState(data) {
  if (data.display) {
    display = normalizeDisplay({ ...data.display, backgroundUrl: data.display.backgroundUrl || display.backgroundUrl });
    currentNote = normalizeNote(data.display.note);
  }
  if ("nowPlaying" in data) nowPlaying = normalizeNowPlaying(data.nowPlaying);
  if (data.music) musicConnected = data.music.connected === true;
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
  save({ rotation: { now: seconds, today: seconds, week: seconds } });
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
let volumeTimer;
document.querySelector("#musicVolume").addEventListener("input", (event) => {
  clearTimeout(volumeTimer);
  volumeTimer = setTimeout(() => musicCommand("volume", { volume: Number(event.target.value) }), 180);
});
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
    showTab("screen");
    telegram?.HapticFeedback?.notificationOccurred("success");
    setNotice("Телевизор связан", "online");
    const state = await request("/v1/miniapp/state");
    applyState(state);
  } catch (error) {
    telegram?.HapticFeedback?.notificationOccurred("error");
    setNotice(error.message, "error");
  }
});
load();
setInterval(() => {
  if (!hasRemoteAuth()) return;
  request("/v1/miniapp/state").then(applyState).catch(() => {});
}, 2000);
