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
  if (!initData) throw new Error("Откройте управление через Telegram-бота");
  const response = await fetch(`${API}${path}`, { ...options, headers: { "content-type": "application/json", "x-telegram-init-data": initData, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(await response.text() || "Не удалось сохранить настройку");
  return response.status === 204 ? null : response.json();
}
async function save(patch, successText = "Настройка сохранена") {
  try { setNotice("Сохраняем…"); const data = await request("/v1/miniapp/display", { method: "PATCH", body: JSON.stringify(patch) }); display = normalizeDisplay(data.display); paint(); telegram?.HapticFeedback?.notificationOccurred("success"); setNotice(successText, "online"); }
  catch (error) { telegram?.HapticFeedback?.notificationOccurred("error"); setNotice(error.message, "error"); }
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
  if (!initData) { setNotice("Предпросмотр: откройте Mini App из бота", "error"); return; }
  try {
    const data = await request("/v1/miniapp/state");
    display = normalizeDisplay(data.display);
    paint();
    document.querySelector("#mishaStatus").textContent = data.connectedCalendars.misha ? "подключён" : "не подключён";
    document.querySelector("#natashaStatus").textContent = data.connectedCalendars.natasha ? "подключён" : "не подключён";
    document.querySelector("#connectionState").textContent = "На связи";
    setNotice("Изменения появляются на телевизоре почти сразу", "online");
  } catch (error) { document.querySelector("#connectionState").textContent = "Нет связи"; setNotice(error.message, "error"); }
}
document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => save({ mode: button.dataset.mode }, `Экран: ${displayModeName(button.dataset.mode)}`)));
document.querySelectorAll("[data-theme]").forEach((button) => button.addEventListener("click", () => save({ theme: button.dataset.theme }, `Тема «${themeNames[button.dataset.theme] || button.dataset.theme}» выбрана`)));
document.querySelector("#privacySwitch").addEventListener("click", () => save({ privacy: !display.privacy }, !display.privacy ? "Гостевой режим включён" : "Гостевой режим выключен"));
document.querySelector("#noteForm").addEventListener("submit", (event) => { event.preventDefault(); const text = document.querySelector("#note").value.trim(); if (text) save({ note: text }, "Заметка показана на один час"); });
document.querySelector("#clearNote").addEventListener("click", () => save({ clearNote: true }, "Заметка убрана"));
document.querySelector("#clearBackground").addEventListener("click", () => save({ clearBackground: true }, "Свой фон убран"));
document.querySelector("#background").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    setNotice("Загружаем картинку…");
    const image = await readFile(file);
    const data = await request("/v1/miniapp/background", { method: "POST", body: JSON.stringify({ image }) });
    display = normalizeDisplay(data.display);
    paint();
    telegram?.HapticFeedback?.notificationOccurred("success");
    setNotice("Фон уже на телевизоре", "online");
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
  if (code.length !== 6) { setNotice("Нужны шесть цифр с телевизора", "error"); return; }
  try {
    await request("/v1/miniapp/pair/approve", { method: "POST", body: JSON.stringify({ code }) });
    document.querySelector("#pairCode").value = "";
    telegram?.HapticFeedback?.notificationOccurred("success");
    setNotice("Телевизор подключён", "online");
  } catch (error) {
    telegram?.HapticFeedback?.notificationOccurred("error");
    setNotice(error.message, "error");
  }
});
load();
