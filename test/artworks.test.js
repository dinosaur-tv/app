import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { artworks, artworkFor, artworkUrl, artworkThumbnailUrl } from "../artworks.js";
import { normalizeDisplay } from "../control-state.js";

test("every selectable painting has a local image and a public-domain source record", () => {
  const sources = JSON.parse(readFileSync(new URL("../assets/art/sources.json", import.meta.url))).works;
  for (const work of artworks) {
    assert.equal(artworkFor(work.id), work);
    assert.equal(normalizeDisplay({ theme: work.id }).theme, work.id);
    const source = sources.find((item) => item.id === work.file);
    assert.ok(source, `Missing source: ${work.id}`);
    assert.match(source.license, /Public domain/);
    assert.ok(source.width >= 1600 && source.height >= 1200, `Insufficient resolution: ${work.id}`);
    assert.ok(existsSync(new URL(`..${artworkUrl(work)}`, import.meta.url)));
    assert.ok(existsSync(new URL(`..${artworkThumbnailUrl(work)}`, import.meta.url)));
    assert.ok(work.artist && work.title && work.year && work.collection);
  }
  assert.equal(new Set(artworks.map((work) => work.id)).size, artworks.length);
  assert.equal(artworkFor("forest"), null);
});
