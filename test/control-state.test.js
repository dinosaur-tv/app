import assert from "node:assert/strict";
import test from "node:test";
import { displayModeName, normalizeDisplay } from "../control-state.js";

test("normalizes incomplete display state to a safe gallery dashboard", () => {
  assert.deepEqual(normalizeDisplay(), { mode: "NOW", theme: "gallery", privacy: false, backgroundUrl: "" });
  assert.deepEqual(normalizeDisplay({ mode: "TODAY", theme: "stone", privacy: true }), { mode: "TODAY", theme: "stone", privacy: true, backgroundUrl: "" });
});

test("does not let unknown API values break the controls", () => {
  assert.equal(displayModeName("UNKNOWN"), "Сейчас");
  assert.deepEqual(normalizeDisplay({ mode: "MONTH", theme: "pink", privacy: "yes" }), { mode: "NOW", theme: "gallery", privacy: false, backgroundUrl: "" });
});
