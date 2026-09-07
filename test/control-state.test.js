import assert from "node:assert/strict";
import test from "node:test";
import { displayModeName, displayMoodName, normalizeDisplay, screenTheme, shouldApplyTvReload } from "../control-state.js";

test("normalizes incomplete display state to a safe gallery dashboard", () => {
  assert.deepEqual(normalizeDisplay(), { mode: "NOW", theme: "gallery", mood: "home", privacy: false, backgroundUrl: "" });
  assert.deepEqual(normalizeDisplay({ mode: "TODAY", theme: "stone", privacy: true }), { mode: "TODAY", theme: "stone", mood: "home", privacy: true, backgroundUrl: "" });
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

test("reloads the television only when a new flush token arrives", () => {
  assert.equal(shouldApplyTvReload("", ""), false);
  assert.equal(shouldApplyTvReload("", "2026-09-07T18:00:00.000Z"), true);
  assert.equal(shouldApplyTvReload("2026-09-07T18:00:00.000Z", "2026-09-07T18:00:00.000Z"), false);
  assert.equal(shouldApplyTvReload("2026-09-07T18:00:00.000Z", "2026-09-07T18:00:01.000Z"), true);
});
