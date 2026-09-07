import { displayModeName, normalizeDisplay, themeNames } from "../control-state.js";

const API = window.DINO_API_BASE_URL || "https://api.dym-dino.ru";
const telegram = window.Telegram?.WebApp;
let display = normalizeDisplay();
let tvLinked = false;
const notice = document.querySelector("#notice");
const settings = document.querySelector("#settings");
const initData = telegram?.initData || "";

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

function paint() {
  document.querySelectorAll("[data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === display.mode));
  document.querySelectorAll("[data-theme]").forEach((button) => button.classList.toggle("active", button.dataset.theme === display.theme));
  document.querySelectorAll("[data-privacy]").forEach((button) => button.classList.toggle("active", String(display.privacy) === button.dataset.privacy));
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
}

async function request(path, options = {}) {
  if (!initData) throw new Error("Откройте пульт из приложения");
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "content-type": "application/json", "x-telegram-init-data": initData, ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(await response.text() || "Не удалось сохранить");
  return response.status === 204 ? null : response.json();
}

async function save(patch, successText = "") {
  display = normalizeDisplay({ ...display, ...patch });
  paint();
  try {
    const data = await request("/v1/miniapp/display", { method: "PATCH", body: JSON.stringify(patch) });
    display = normalizeDisplay({ ...data.display, backgroundUrl: data.display.backgroundUrl || display.backgroundUrl });
    paint();
    telegram?.HapticFeedback?.impactOccurred?.("light");
    if (successText) setNotice(successText, "online");
    else setNotice("");
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
  if (!initData) return;
  try {
    const data = await request("/v1/miniapp/state");
    display = normalizeDisplay(data.display);
    tvLinked = Boolean(data.tvLinked);
    paint();
    showCalendarWarning(data.connectedCalendars);
    if (!tvLinked) settings.hidden = false;
    setNotice("");
  } catch (error) {
    setNotice(error.message, "error");
  }
}

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => save({ mode: button.dataset.mode }, displayModeName(button.dataset.mode)));
});
document.querySelectorAll("[data-theme]").forEach((button) => {
  button.addEventListener("click", () => save({ theme: button.dataset.theme }, themeNames[button.dataset.theme]));
});
document.querySelectorAll("[data-privacy]").forEach((button) => {
  button.addEventListener("click", () => {
    const privacy = button.dataset.privacy === "true";
    save({ privacy }, privacy ? "Гости" : "Нет гостей");
  });
});
document.querySelector("#noteForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const text = document.querySelector("#note").value.trim();
  if (text) save({ note: text }, "Заметка");
});
document.querySelector("#clearNote").addEventListener("click", () => save({ clearNote: true }, "Снято"));
document.querySelector("#clearBackground").addEventListener("click", () => save({ clearBackground: true }, "Обои сброшены"));
document.querySelector("#background").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const image = await readFile(file);
    const data = await request("/v1/miniapp/background", { method: "POST", body: JSON.stringify({ image }) });
    display = normalizeDisplay(data.display);
    paint();
    telegram?.HapticFeedback?.notificationOccurred("success");
    setNotice("Обои", "online");
  } catch (error) {
    telegram?.HapticFeedback?.notificationOccurred("error");
    setNotice(error.message, "error");
  } finally {
    event.target.value = "";
  }
});
document.querySelector("#settingsBtn").addEventListener("click", () => { settings.hidden = false; });
document.querySelector("#closeSettings").addEventListener("click", () => { settings.hidden = true; });
settings.addEventListener("click", (event) => {
  if (event.target === settings) settings.hidden = true;
});
document.querySelector("#pairForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = document.querySelector("#pairCode").value.replace(/\D/g, "");
  if (code.length !== 6) {
    setNotice("Шесть цифр с телевизора", "error");
    return;
  }
  try {
    await request("/v1/miniapp/pair/approve", { method: "POST", body: JSON.stringify({ code }) });
    document.querySelector("#pairCode").value = "";
    tvLinked = true;
    settings.hidden = true;
    telegram?.HapticFeedback?.notificationOccurred("success");
    setNotice("Телевизор связан", "online");
  } catch (error) {
    telegram?.HapticFeedback?.notificationOccurred("error");
    setNotice(error.message, "error");
  }
});
load();
