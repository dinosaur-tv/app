import assert from "node:assert/strict";
import test from "node:test";
import { displayModeName, displayMoodName, normalizeDisplay, normalizeNote, normalizeNowPlaying, normalizeRotation, noteDurations, screenTheme, shouldApplyTvReload } from "../control-state.js";

const idleDisplay = { mode: "NOW", theme: "gallery", mood: "home", privacy: false, showWeather: true, showCalendar: true, backgroundUrl: "", rotation: { enabled: true, now: 30, today: 30, week: 30 } };

test("normalizes incomplete display state to a safe gallery dashboard", () => {
  assert.deepEqual(normalizeDisplay(), idleDisplay);
  assert.deepEqual(normalizeDisplay({ mode: "TODAY", theme: "forest", privacy: true }), { ...idleDisplay, mode: "TODAY", theme: "forest", privacy: true });
});

test("does not let unknown API values break the controls", () => {
  assert.equal(displayModeName("UNKNOWN"), "Сейчас");
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
  for (const theme of ["gallery", "home-day", "home-evening", "forest", "mountains", "sea", "space", "petersburg", "rome", "florence", "venice", "palace", "oak-study", "rus", "byzantium", "india", "italy"]) {
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

test("keeps tab rotation on by default and clamps how long each view stays", () => {
  assert.deepEqual(normalizeRotation(), { enabled: true, now: 30, today: 30, week: 30 });
  assert.deepEqual(normalizeRotation({ enabled: false, seconds: 15 }), { enabled: false, now: 15, today: 15, week: 15 });
  assert.deepEqual(normalizeRotation({ enabled: true, now: 10, today: 45, week: 120 }), { enabled: true, now: 10, today: 45, week: 120 });
  assert.equal(normalizeRotation({ now: 1 }).now, 5);
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
