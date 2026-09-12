// Dino TV on a computer monitor. The screen itself is the same web page the television
// loads, so this window only has to do the three things a browser tab cannot: remember
// which server to open, stay awake, and fill the display without any chrome around it.
const { app, BrowserWindow, ipcMain, powerSaveBlocker, shell, screen } = require("electron");
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { join, dirname } = require("node:path");
const { screenUrl } = require("./screen-url.js");

const settingsPath = join(app.getPath("userData"), "settings.json");
let window = null;
let awake = 0;

function readSettings() {
  try {
    return JSON.parse(readFileSync(settingsPath, "utf8"));
  } catch {
    return {};
  }
}

function writeSettings(settings) {
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function keepAwake(on) {
  if (on && !powerSaveBlocker.isStarted(awake)) awake = powerSaveBlocker.start("prevent-display-sleep");
  if (!on && powerSaveBlocker.isStarted(awake)) powerSaveBlocker.stop(awake);
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  window = new BrowserWindow({
    width: Math.min(1600, width),
    height: Math.min(900, height),
    backgroundColor: "#141311",
    autoHideMenuBar: true,
    title: "Dino TV",
    webPreferences: { preload: join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });

  const settings = readSettings();
  const url = screenUrl(settings.server ?? "");
  if (url) {
    window.loadURL(url);
    keepAwake(true);
  } else {
    window.loadFile(join(__dirname, "setup.html"));
  }

  // The screen is a single page; anything else it offers opens in the real browser.
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith("https://")) shell.openExternal(target);
    return { action: "deny" };
  });
  window.on("closed", () => { window = null; keepAwake(false); });
}

ipcMain.handle("dino:save-server", (event, value) => {
  const url = screenUrl(value);
  if (!url) return { ok: false, message: "Нужен адрес вида https://home.example.com" };
  writeSettings({ ...readSettings(), server: new URL(url).origin });
  window?.loadURL(url);
  keepAwake(true);
  return { ok: true };
});

ipcMain.handle("dino:current-server", () => readSettings().server ?? "");

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

// F11 toggles the fullscreen a living-room screen wants; Ctrl+Shift+S returns to the address form.
app.on("browser-window-created", (event, created) => {
  created.webContents.on("before-input-event", (input, key) => {
    if (key.type !== "keyDown") return;
    if (key.key === "F11") created.setFullScreen(!created.isFullScreen());
    if (key.control && key.shift && key.key.toLowerCase() === "s") created.loadFile(join(__dirname, "setup.html"));
  });
});
