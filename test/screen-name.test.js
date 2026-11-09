import assert from "node:assert/strict";
import test from "node:test";
import { screenNameFrom, screenNameHeader } from "../tv/screen-name.js";

test("на компьютере экран называется по имени машины", () => {
  assert.equal(screenNameFrom("Mozilla/5.0", "Кабинет"), "Dino TV на Кабинет");
});

test("телевизор в браузере называется своей платформой", () => {
  assert.equal(screenNameFrom("Mozilla/5.0 (Web0S; Linux/SmartTV)"), "LG webOS");
  assert.equal(screenNameFrom("Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0)"), "Samsung Tizen");
  assert.equal(screenNameFrom("Mozilla/5.0 (Linux; Android 11; AFTKA Build/x)"), "Fire TV");
});

test("обычный браузер молчит, и сервер оставляет своё имя", () => {
  assert.equal(screenNameFrom("Mozilla/5.0 (Windows NT 10.0) Chrome/120"), "");
  assert.equal(screenNameFrom(), "");
});

test("имя машины не вылезает за поле", () => {
  assert.equal(screenNameFrom("", "И".repeat(60)).length <= 40, true);
});

test("имя по-русски уходит в заголовок без символов, которые fetch не пропустит", () => {
  const header = screenNameHeader(screenNameFrom("Mozilla/5.0", "Кабинет"));
  assert.match(header, /^[\x20-\x7e]+$/);
  assert.equal(decodeURIComponent(header), "Dino TV на Кабинет");
  assert.equal(new globalThis.Headers({ "x-dino-screen-name": header }).get("x-dino-screen-name"), header);
});

test("латинское имя кодируется так же, а пустое не отправляется", () => {
  assert.equal(decodeURIComponent(screenNameHeader("LG webOS")), "LG webOS");
  assert.equal(screenNameHeader(""), "");
});
