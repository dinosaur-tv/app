import assert from "node:assert/strict";
import test from "node:test";
import { createHostSignIn } from "../console/host-sign-in.js";

function frame() {
  const listeners = [];
  const parent = { sent: [], postMessage(message, origin) { this.sent.push({ message, origin }); } };
  const win = { parent, addEventListener: (_, fn) => listeners.push(fn) };
  const deliver = (event) => Promise.all(listeners.map((fn) => fn(event)));
  return { win, parent, deliver };
}

test("framed by DinoOS, the console asks once and signs in with the code it gets", async () => {
  const { win, parent, deliver } = frame();
  const claimed = [];
  const host = createHostSignIn({ win, claim: async (code) => { claimed.push(code); return true; }, hosts: ["https://dash.test"] });
  host.ask(); host.ask();
  assert.deepEqual(parent.sent, [{ message: { type: "dino-tv:sign-in-needed" }, origin: "https://dash.test" }]);
  await deliver({ origin: "https://dash.test", source: parent, data: { type: "dino-tv:sign-in-code", code: "12345678" } });
  assert.deepEqual(claimed, ["12345678"]);
  host.ask();
  assert.equal(parent.sent.length, 2, "after a sign-in a later sign-out may ask again");
});

test("codes from other pages or of the wrong shape are ignored", async () => {
  const { win, parent, deliver } = frame();
  const claimed = [];
  createHostSignIn({ win, claim: async (code) => { claimed.push(code); return true; }, hosts: ["https://dash.test"] });
  await deliver({ origin: "https://evil.test", source: parent, data: { type: "dino-tv:sign-in-code", code: "12345678" } });
  await deliver({ origin: "https://dash.test", source: {}, data: { type: "dino-tv:sign-in-code", code: "12345678" } });
  await deliver({ origin: "https://dash.test", source: parent, data: { type: "dino-tv:sign-in-code", code: "1234" } });
  assert.deepEqual(claimed, []);
});

test("a console that is not framed never asks", () => {
  const win = { addEventListener() {} };
  win.parent = win;
  win.postMessage = () => assert.fail("asked itself");
  createHostSignIn({ win, claim: async () => true }).ask();
});
