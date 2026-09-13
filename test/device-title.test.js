import assert from "node:assert/strict";
import test from "node:test";
import { deviceTitle, lastSeenPhrase } from "../console/device-title.js";

const now = Date.UTC(2026, 8, 14, 12, 0, 0);

test("экран, который никогда не отзывался, так и написан — его и удаляют", () => {
  assert.equal(lastSeenPhrase(undefined, now), "ни разу не выходил на связь");
  assert.equal(lastSeenPhrase(0, now), "ни разу не выходил на связь");
});

test("свежий опрос читается как «на связи», а не как время", () => {
  assert.equal(lastSeenPhrase(now - 5_000, now), "на связи");
  assert.equal(lastSeenPhrase(now - 90_000, now), "на связи");
});

test("дальше счёт идёт минутами, часами, потом днями", () => {
  assert.equal(lastSeenPhrase(now - 10 * 60_000, now), "был 10 мин назад");
  assert.equal(lastSeenPhrase(now - 5 * 3600_000, now), "был 5 ч назад");
  assert.equal(lastSeenPhrase(now - 30 * 3600_000, now), "был вчера");
  assert.equal(lastSeenPhrase(Date.UTC(2026, 8, 1, 12), now), "был 1 сентября");
});

test("строка под именем говорит, что это и когда его видели", () => {
  const title = deviceTitle({ kind: "tv", created: Date.UTC(2026, 8, 10, 12), seen: now - 20_000 }, now);
  assert.equal(title, "Экран · на связи · с 10 сентября");
  assert.match(deviceTitle({ kind: "phone", created: now, seen: 0 }, now), /^Телефон · ни разу/);
});
