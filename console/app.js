import { displayModeName, normalizeDisplay, themeNames } from "../control-state.js";

const API = window.DINO_API_BASE_URL || "https://api.dym-dino.ru";
const telegram = window.Telegram?.WebApp;
let display = normalizeDisplay();
const notice = document.querySelector("#notice");
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
  const privacy = document.querySelector("#privacySwitch");
  privacy.classList.toggle("active", display.privacy);
  privacy.setAttribute("aria-pressed", String(display.privacy));
  const preview = document.querySelector("#backgroundPreview");
  if (display.backgroundUrl) {
    preview.hidden = false;
    preview.style.backgroundImage = `url("${display.backgroundUrl}")`;
  } else {
    preview.hidden = true;
    preview.style.backgroundImage = "";
  }
}

async function request(path, options = {}) {
  if (!initData) throw new Error("Откройте пульт из Telegram");
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "content-type": "application/json", "x-telegram-init-data": initData, ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(await response.text() || "Не удалось сохранить");
  return response.status === 204 ? null : response.json();
}

async function save(patch, successText = "Готово") {
  try {
    const data = await request("/v1/miniapp/display", { method: "PATCH", body: JSON.stringify(patch) });
    display = normalizeDisplay(data.display);
    paint();
    telegram?.HapticFeedback?.notificationOccurred("success");
    setNotice(successText, "online");
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

async function load() {
  paint();
  if (!initData) {
    document.querySelector("#connectionState").textContent = "превью";
    return;
  }
  try {
    const data = await request("/v1/miniapp/state");
    display = normalizeDisplay(data.display);
    paint();
    document.querySelector("#mishaStatus").textContent = data.connectedCalendars.misha ? "ок" : "нет";
    document.querySelector("#natashaStatus").textContent = data.connectedCalendars.natasha ? "ок" : "нет";
    document.querySelector("#connectionState").textContent = "онлайн";
    setNotice("");
  } catch (error) {
    document.querySelector("#connectionState").textContent = "нет сети";
    setNotice(error.message, "error");
  }
}

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => save({ mode: button.dataset.mode }, displayModeName(button.dataset.mode)));
});
document.querySelectorAll("[data-theme]").forEach((button) => {
  button.addEventListener("click", () => save({ theme: button.dataset.theme }, themeNames[button.dataset.theme]));
});
document.querySelector("#privacySwitch").addEventListener("click", () => {
  save({ privacy: !display.privacy }, !display.privacy ? "Гости" : "Свои");
});
document.querySelector("#noteForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const text = document.querySelector("#note").value.trim();
  if (text) save({ note: text }, "Заметка");
});
document.querySelector("#clearNote").addEventListener("click", () => save({ clearNote: true }, "Снято"));
document.querySelector("#clearBackground").addEventListener("click", () => save({ clearBackground: true }, "Фон сброшен"));
document.querySelector("#background").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const image = await readFile(file);
    const data = await request("/v1/miniapp/background", { method: "POST", body: JSON.stringify({ image }) });
    display = normalizeDisplay(data.display);
    paint();
    telegram?.HapticFeedback?.notificationOccurred("success");
    setNotice("Фон", "online");
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
    await request("/v1/miniapp/pair/approve", { method: "POST", body: JSON.stringify({ code }) });
    document.querySelector("#pairCode").value = "";
    telegram?.HapticFeedback?.notificationOccurred("success");
    setNotice("Телевизор связан", "online");
  } catch (error) {
    telegram?.HapticFeedback?.notificationOccurred("error");
    setNotice(error.message, "error");
  }
});
load();
