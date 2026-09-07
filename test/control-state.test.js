import assert from "node:assert/strict";
import test from "node:test";
import { displayModeName, displayMoodName, normalizeDisplay, normalizeNote, normalizeNowPlaying, noteDurations, screenTheme, shouldApplyTvReload } from "../control-state.js";

test("normalizes incomplete display state to a safe gallery dashboard", () => {
  assert.deepEqual(normalizeDisplay(), { mode: "NOW", theme: "gallery", mood: "home", privacy: false, backgroundUrl: "" });
  assert.deepEqual(normalizeDisplay({ mode: "TODAY", theme: "forest", privacy: true }), { mode: "TODAY", theme: "forest", mood: "home", privacy: true, backgroundUrl: "" });
});

test("does not let unknown API values break the controls", () => {
  assert.equal(displayModeName("UNKNOWN"), "Сейчас");
  assert.equal(displayMoodName("UNKNOWN"), "Дом");
  assert.deepEqual(normalizeDisplay({ mode: "MONTH", theme: "pink", privacy: "yes" }), { mode: "NOW", theme: "gallery", mood: "home", privacy: false, backgroundUrl: "" });
});

test("treats night and play as moods, not color themes", () => {
  assert.deepEqual(normalizeDisplay({ theme: "night" }), { mode: "NOW", theme: "gallery", mood: "night", privacy: false, backgroundUrl: "" });
  assert.deepEqual(normalizeDisplay({ theme: "play", mood: "home" }), { mode: "NOW", theme: "gallery", mood: "play", privacy: false, backgroundUrl: "" });
  assert.equal(normalizeDisplay({ theme: "forest", mood: "night" }).theme, "forest");
  assert.equal(normalizeDisplay({ theme: "forest", mood: "night" }).mood, "night");
  assert.equal(screenTheme(normalizeDisplay({ theme: "forest", mood: "night" })), "night");
  assert.equal(screenTheme(normalizeDisplay({ theme: "forest", mood: "home" })), "forest");
});

test("keeps every designed scene available to the television and console", () => {
  for (const theme of ["gallery", "home-day", "home-evening", "forest", "mountains", "sea", "space", "petersburg", "rome", "florence", "venice"]) {
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
