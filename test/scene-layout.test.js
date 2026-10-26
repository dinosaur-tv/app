import assert from "node:assert/strict";
import test from "node:test";
import { sceneLayout } from "../tv/scene-layout.js";

test("every scene gets one of four compositions", () => {
  assert.equal(sceneLayout("gallery"), "split");
  assert.equal(sceneLayout("sea"), "split");
  assert.equal(sceneLayout("home-day"), "mirror", "the subject of the picture is on the right");
  assert.equal(sceneLayout("night"), "night");
  assert.equal(sceneLayout("art-monet", { artwork: true }), "art");
});

test("a custom wallpaper keeps the plain composition", () => {
  assert.equal(sceneLayout("home-day", { customPhoto: true }), "split");
  assert.equal(sceneLayout("art-monet", { artwork: true, customPhoto: true }), "split");
});
