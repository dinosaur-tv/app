import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { displayThemes } from "../control-state.js";

test("every filmed scene ships its loop, its poster and its phone thumbnail", async () => {
  // scene-video.js touches the DOM on import; read its list without running it.
  const source = await import("node:fs").then((fs) => fs.readFileSync(new URL("../tv/scene-video.js", import.meta.url), "utf8"));
  const scenes = JSON.parse(source.match(/export const videoScenes = (\[[^\]]+\])/)[1]);
  for (const scene of scenes) {
    assert.ok(displayThemes.includes(scene), scene);
    for (const path of [`scenes/motion/${scene}.mp4`, `scenes/${scene}.webp`, `scenes/thumbs/${scene}.webp`]) {
      assert.ok(existsSync(new URL(`../assets/${path}`, import.meta.url)), path);
    }
  }
});
