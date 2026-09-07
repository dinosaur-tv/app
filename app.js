import { displayModeName, normalizeDisplay, themeNames } from "./control-state.js";

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

function setNotice(text, type = "") { notice.textContent = text; notice.className = `footnote ${type}`; }
function paint() {
  document.querySelector("[data-current-mode]").textContent = displayModeName(display.mode);
  document.querySelectorAll("[data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === display.mode));
  document.querySelectorAll("[data-theme]").forEach((button) => button.classList.toggle("active", button.dataset.theme === display.theme));
  const privacy = document.querySelector("#privacySwitch");
  privacy.classList.toggle("active", display.privacy); privacy.setAttribute("aria-pressed", String(display.privacy));
}
async function request(path, options = {}) {
  if (!initData) throw new Error("Откройте управление через Telegram-бота");
  const response = await fetch(`${API}${path}`, { ...options, headers: { "content-type": "application/json", "x-telegram-init-data": initData, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(await response.text() || "Не удалось сохранить настройку");
  return response.status === 204 ? null : response.json();
}
async function save(patch, successText = "Настройка сохранена") {
  try { setNotice("Сохраняем…"); const data = await request("/v1/miniapp/display", { method: "PATCH", body: JSON.stringify(patch) }); display = normalizeDisplay(data.display); paint(); telegram?.HapticFeedback?.notificationOccurred("success"); setNotice(successText, "online"); }
  catch (error) { telegram?.HapticFeedback?.notificationOccurred("error"); setNotice(error.message, "error"); }
}
async function load() {
  paint();
  if (!initData) { setNotice("Предпросмотр: откройте Mini App из бота", "error"); return; }
  try { const data = await request("/v1/miniapp/state"); display = normalizeDisplay(data.display); paint(); document.querySelector("#mishaStatus").textContent = data.connectedCalendars.misha ? "подключён" : "не подключён"; document.querySelector("#natashaStatus").textContent = data.connectedCalendars.natasha ? "подключён" : "не подключён"; document.querySelector("#connectionState").textContent = "На связи"; setNotice("Изменения появляются на телевизоре почти сразу", "online"); }
  catch (error) { document.querySelector("#connectionState").textContent = "Нет связи"; setNotice(error.message, "error"); }
}
document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => save({ mode: button.dataset.mode }, `Экран: ${displayModeName(button.dataset.mode)}`)));
document.querySelectorAll("[data-theme]").forEach((button) => button.addEventListener("click", () => save({ theme: button.dataset.theme }, `Тема «${themeNames[button.dataset.theme] || button.dataset.theme}» выбрана`)));
document.querySelector("#privacySwitch").addEventListener("click", () => save({ privacy: !display.privacy }, !display.privacy ? "Гостевой режим включён" : "Гостевой режим выключен"));
document.querySelector("#noteForm").addEventListener("submit", (event) => { event.preventDefault(); const text = document.querySelector("#note").value.trim(); if (text) save({ note: text }, "Заметка показана на один час"); });
document.querySelector("#clearNote").addEventListener("click", () => save({ clearNote: true }, "Заметка убрана"));
load();
