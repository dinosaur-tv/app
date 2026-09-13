import assert from "node:assert/strict";
import test from "node:test";
import { screenNameFrom } from "../tv/screen-name.js";

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
