import assert from "node:assert/strict";
import test from "node:test";
import { createHouseholdScope } from "./household-scope.js";

test("ответ старого дома отклоняется после переключения", () => {
  const scope = createHouseholdScope(); scope.select("A"); const request = scope.capture();
  assert.equal(request.id, "A"); request.assertCurrent(); scope.select("B");
  assert.throws(() => request.assertCurrent(), /переключён/);
  assert.equal(scope.capture().id, "B");
});
test("возвращение A → B → A не оживляет старые запросы", () => {
  const scope = createHouseholdScope(); scope.select("A"); const request = scope.capture();
  scope.select("B"); scope.select("A"); assert.throws(() => request.assertCurrent());
});
test("выход очищает выбранный дом", () => {
  const scope = createHouseholdScope(); scope.select("A"); scope.select(""); assert.equal(scope.id, "");
});
