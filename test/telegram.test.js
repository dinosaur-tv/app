import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { shouldLoadTelegramSdk } from "../console/telegram.js";

const root = dirname(fileURLToPath(import.meta.url));

test("does not block the console on telegram.org", () => {
  const html = readFileSync(join(root, "../console/index.html"), "utf8");
  assert.equal(/<script[^>]+telegram\.org/.test(html), false);
  assert.match(html, /id="invitePhone"/);
  assert.match(html, /data-tab="remote"/);
  assert.match(html, /id="openKinopoisk"/);
});

test("loads the Telegram SDK only inside Telegram", () => {
  assert.equal(shouldLoadTelegramSdk({ isNative: true, userAgent: "DinoHome/1.0" }), false);
  assert.equal(shouldLoadTelegramSdk({ hasTelegram: true, userAgent: "Telegram" }), false);
  assert.equal(shouldLoadTelegramSdk({ userAgent: "Mozilla/5.0" }), false);
  assert.equal(shouldLoadTelegramSdk({ userAgent: "Telegram iOS" }), true);
  assert.equal(shouldLoadTelegramSdk({ hasTelegramProxy: true }), true);
});
