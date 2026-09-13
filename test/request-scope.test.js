import assert from "node:assert/strict";
import test from "node:test";
import { needsAccount, needsHome } from "../console/request-scope.js";

test("вход и выход доступны без аккаунта и без дома", () => {
  for (const path of ["/v1/miniapp/login", "/v1/miniapp/logout", "/v1/miniapp/pair/approve"]) {
    assert.equal(needsAccount(path), false, path);
    assert.equal(needsHome(path), false, path);
  }
});

test("список домов требует аккаунт, но не дом — иначе первый дом не создать", () => {
  assert.equal(needsAccount("/v1/miniapp/households"), true);
  assert.equal(needsHome("/v1/miniapp/households"), false);
  assert.equal(needsHome("/v1/miniapp/households/select"), false);
});

test("всё остальное требует и аккаунт, и дом", () => {
  for (const path of ["/v1/miniapp/state", "/v1/miniapp/display", "/v1/miniapp/tv", "/v1/miniapp/calendars/misha"]) {
    assert.equal(needsAccount(path), true, path);
    assert.equal(needsHome(path), true, path);
  }
});

test("совпадение по префиксу не задевает соседние пути", () => {
  assert.equal(needsAccount("/v1/miniapp/logins"), true, "чужой путь не должен проходить как /login");
  assert.equal(needsAccount("/v1/miniapp/login?code=1"), false, "а параметры запроса — должны");
});
