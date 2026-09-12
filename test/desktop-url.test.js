import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const { screenUrl } = createRequire(import.meta.url)("../desktop/screen-url.js");

test("any form of the server address opens the screen page", () => {
  for (const input of ["https://home.example.com", "https://home.example.com/", "https://home.example.com/tv", " https://home.example.com/tv/ "]) {
    assert.equal(screenUrl(input), "https://home.example.com/tv/", input);
  }
  assert.equal(screenUrl("https://home.example.com:8443"), "https://home.example.com:8443/tv/");
});

test("anything that is not a plain https origin is refused", () => {
  for (const input of [
    "", "не адрес", "home.example.com",
    "http://home.example.com",
    "https://user:pass@home.example.com",
    "https://home.example.com/console/",
    "https://home.example.com/?token=x",
    "https://home.example.com/#session",
    "file:///C:/tv.html",
    "javascript:alert(1)",
  ]) {
    assert.equal(screenUrl(input), null, input);
  }
});
