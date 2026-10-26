import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { artCollections, artworks, artworksIn, artworkFor, artworkUrl, artworkThumbnailUrl, slideshowArtwork } from "../artworks.js";
import { normalizeArt, normalizeDisplay } from "../control-state.js";

test("every selectable painting has a local image and a public-domain source record", () => {
  const sources = JSON.parse(readFileSync(new URL("../assets/art/sources.json", import.meta.url))).works;
  for (const work of artworks) {
    assert.equal(artworkFor(work.id), work);
    assert.equal(normalizeDisplay({ theme: work.id }).theme, work.id);
    const source = sources.find((item) => item.id === work.file);
    assert.ok(source, `Missing source: ${work.id}`);
    assert.match(source.license, /Public domain|CC0/);
    assert.ok(source.width >= 1600 && source.height >= 1200, `Insufficient resolution: ${work.id}`);
    assert.ok(existsSync(new URL(`..${artworkUrl(work)}`, import.meta.url)));
    assert.ok(existsSync(new URL(`..${artworkThumbnailUrl(work)}`, import.meta.url)));
    assert.ok(work.artist && work.title && work.year && work.collection);
  }
  assert.equal(new Set(artworks.map((work) => work.id)).size, artworks.length);
  assert.equal(artworkFor("forest"), null);
});

test("every painting belongs to a listed gallery section, and the slideshow walks it in order", () => {
  const names = artCollections.map((item) => item.name);
  for (const work of artworks) assert.ok(names.includes(work.collection), `${work.id}: ${work.collection}`);
  const modern = artworksIn("Модерн");
  const step = 5 * 60_000;
  assert.equal(slideshowArtwork("Модерн", 5, 0), modern[0]);
  assert.equal(slideshowArtwork("Модерн", 5, step), modern[1]);
  assert.equal(slideshowArtwork("Модерн", 5, step * modern.length), modern[0]);
  assert.equal(slideshowArtwork("", 5, step * 3), artworks[3]);
});

test("the full-screen and slideshow settings survive bad values", () => {
  assert.deepEqual(normalizeArt({ fullscreen: "yes", slideshow: true, minutes: 7, collection: "  Модерн " }), { fullscreen: false, slideshow: true, minutes: 5, collection: "Модерн" });
  assert.deepEqual(normalizeDisplay({ art: { fullscreen: true, minutes: 30 } }).art, { fullscreen: true, slideshow: false, minutes: 30, collection: "" });
});
