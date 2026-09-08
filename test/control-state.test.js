import assert from "node:assert/strict";
import test from "node:test";
import { displayModeName, displayMoodName, normalizeDisplay, normalizeNote, normalizeNowPlaying, normalizeRotation, noteDurations, pickNowPlaying, screenTheme, shouldApplyTvReload, tvRemoteStatus, musicRemoteCopy } from "../control-state.js";

const idleDisplay = { mode: "TODAY", theme: "gallery", mood: "home", privacy: false, showWeather: true, showCalendar: true, backgroundUrl: "", rotation: { enabled: true, today: 30, tomorrow: 30, week: 30 } };

test("normalizes incomplete display state to a safe gallery dashboard", () => {
  assert.deepEqual(normalizeDisplay(), idleDisplay);
  assert.deepEqual(normalizeDisplay({ mode: "TODAY", theme: "forest", privacy: true }), { ...idleDisplay, mode: "TODAY", theme: "forest", privacy: true });
});

test("does not let unknown API values break the controls", () => {
  assert.equal(displayModeName("UNKNOWN"), "Сегодня");
  assert.equal(displayModeName("TOMORROW"), "Завтра");
  assert.equal(normalizeDisplay({ mode: "NOW" }).mode, "TODAY");
  assert.equal(displayMoodName("UNKNOWN"), "Дом");
  assert.deepEqual(normalizeDisplay({ mode: "MONTH", theme: "pink", privacy: "yes" }), idleDisplay);
});

test("treats night and play as moods, not color themes", () => {
  assert.deepEqual(normalizeDisplay({ theme: "night" }), { ...idleDisplay, mood: "night" });
  assert.deepEqual(normalizeDisplay({ theme: "play", mood: "home" }), { ...idleDisplay, mood: "play" });
  assert.equal(normalizeDisplay({ theme: "forest", mood: "night" }).theme, "forest");
  assert.equal(normalizeDisplay({ theme: "forest", mood: "night" }).mood, "night");
  assert.equal(screenTheme(normalizeDisplay({ theme: "forest", mood: "night" })), "night");
  assert.equal(screenTheme(normalizeDisplay({ theme: "forest", mood: "home" })), "forest");
});

test("keeps every designed scene available to the television and console", () => {
  for (const theme of ["gallery", "home-day", "home-evening", "forest", "autumn-forest", "mountains", "sea", "space", "petersburg", "petersburg-streets", "oranienbaum", "peterhof", "rome", "florence", "venice", "italy-sunset", "palace", "oak-study", "palace-study", "rus", "gzhel", "soviet-carpet", "byzantium", "india", "italy"]) {
    assert.equal(normalizeDisplay({ theme }).theme, theme);
    assert.equal(screenTheme(normalizeDisplay({ theme })), theme);
  }
});

test("reloads the television only when a new flush token arrives", () => {
  assert.equal(shouldApplyTvReload("", ""), false);
  assert.equal(shouldApplyTvReload("", "2026-09-07T18:00:00.000Z"), true);
  assert.equal(shouldApplyTvReload("2026-09-07T18:00:00.000Z", "2026-09-07T18:00:00.000Z"), false);
  assert.equal(shouldApplyTvReload("2026-09-07T18:00:00.000Z", "2026-09-07T18:00:01.000Z"), true);
});

test("keeps a living note and drops an expired one", () => {
  assert.equal(noteDurations.length, 10);
  assert.equal(noteDurations[0].minutes, 5);
  assert.equal(noteDurations.at(-1).minutes, 720);
  assert.equal(normalizeNote(), null);
  assert.equal(normalizeNote({ text: "хлеб", expiresAt: new Date(Date.now() - 1000).toISOString() }), null);
  assert.equal(normalizeNote({ text: " хлеб ", expiresAt: new Date(Date.now() + 60_000).toISOString() }).text, "хлеб");
});

test("keeps now-playing values safe for the remote and the living-room bar", () => {
  assert.deepEqual(normalizeNowPlaying(), { title: "", artist: "", source: "Яндекс Музыка", isPlaying: false, volumePercent: 50, artworkUrl: "", deviceName: "" });
  assert.equal(normalizeNowPlaying({ title: "Ночь", isPlaying: true, volumePercent: 140 }).volumePercent, 100);
});

test("prefers the track the television can hear over the server stub", () => {
  assert.equal(pickNowPlaying({ title: "The Unforgiven", artist: "Metallica" }, { nowPlaying: { title: "Тихо" } }).title, "The Unforgiven");
  assert.equal(pickNowPlaying({ title: "  " }, { nowPlaying: { title: "Chica" } }).title, "Chica");
  assert.equal(pickNowPlaying(null, {}), null);
});

test("labels the power button for overlaying Dino over living-room music", () => {
  assert.deepEqual(tvRemoteStatus({ tvOnline: true }), { state: "на экране", power: "Выкл" });
  assert.deepEqual(tvRemoteStatus({ tvOnline: true, nowPlaying: { title: "GANG", isPlaying: true } }), { state: "поверх музыки", power: "Выкл" });
  assert.deepEqual(tvRemoteStatus({ tvOnline: false, nowPlaying: { title: "GANG", isPlaying: true } }), { state: "музыка", power: "Поверх" });
  assert.deepEqual(tvRemoteStatus({ tvOnline: false, nowPlaying: { title: "GANG", isPlaying: false } }), { state: "на паузе", power: "Поверх" });
  assert.deepEqual(tvRemoteStatus({ tvOnline: false, tvPower: "off" }), { state: "выключен", power: "Вкл" });
  assert.equal(musicRemoteCopy({ nowPlaying: { title: "GANG" } }).toTv, "Поверх музыки");
  assert.equal(musicRemoteCopy({ tvOnline: true, nowPlaying: { title: "GANG" } }).toTv, "Уже на экране");
});

test("keeps tab rotation on by default and clamps how long each view stays", () => {
  assert.deepEqual(normalizeRotation(), { enabled: true, today: 30, tomorrow: 30, week: 30 });
  assert.deepEqual(normalizeRotation({ enabled: false, seconds: 15 }), { enabled: false, today: 15, tomorrow: 15, week: 15 });
  assert.deepEqual(normalizeRotation({ enabled: true, today: 45, tomorrow: 60, week: 120 }), { enabled: true, today: 45, tomorrow: 60, week: 120 });
  assert.deepEqual(normalizeRotation({ now: 10, today: 45, week: 120 }), { enabled: true, today: 45, tomorrow: 45, week: 120 });
  assert.equal(normalizeRotation({ today: 1 }).today, 5);
  assert.equal(normalizeRotation({ week: 900 }).week, 300);
  assert.equal(normalizeDisplay({ rotation: { enabled: false, interval: 20 } }).rotation.enabled, false);
  assert.equal(normalizeDisplay({ rotation: { interval: 20 } }).rotation.today, 20);
});

test("can hide weather and calendar without breaking the rest of the screen", () => {
  assert.equal(normalizeDisplay().showWeather, true);
  assert.equal(normalizeDisplay().showCalendar, true);
  assert.equal(normalizeDisplay({ showWeather: false, showCalendar: false }).showWeather, false);
  assert.equal(normalizeDisplay({ showWeather: false, showCalendar: false }).showCalendar, false);
});
