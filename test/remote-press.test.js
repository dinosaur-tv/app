import assert from "node:assert/strict";
import test from "node:test";
import { createRemotePressController, repeatingTvKeys } from "../console/remote-press.js";

function button(key) {
  const classes = new Set();
  return {
    dataset: { tvKey: key },
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    setPointerCapture() {},
  };
}

test("sends a physical remote press on pointer down and suppresses its synthetic click", () => {
  const sent = [];
  const key = button("ok");
  const controller = createRemotePressController({ send: (...args) => sent.push(args), now: () => 100 });
  controller.pointerDown(key, { pointerId: 1, button: 0, preventDefault() {} });
  controller.pointerEnd(key, { pointerId: 1 });
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], "ok");
  assert.equal(controller.click(key, { preventDefault() {} }), false);
  assert.equal(sent.length, 1);
});

test("repeats arrows while held and stops immediately on release", () => {
  const sent = [];
  const timers = [];
  const canceled = new Set();
  const key = button("right");
  const controller = createRemotePressController({
    send: (name, _button, meta) => sent.push([name, meta.repeat]),
    schedule: (callback) => {
      timers.push(callback);
      return timers.length - 1;
    },
    cancel: (id) => canceled.add(id),
    now: () => 100,
  });
  controller.pointerDown(key, { pointerId: 2, button: 0, preventDefault() {} });
  timers[0]();
  assert.deepEqual(sent, [["right", false], ["right", true]]);
  controller.pointerEnd(key, { pointerId: 2 });
  assert.equal(canceled.has(1), true);
  assert.equal(key.classList.contains("is-pressing"), false);
});

test("only navigation and volume keys repeat", () => {
  assert.equal(repeatingTvKeys.has("up"), true);
  assert.equal(repeatingTvKeys.has("volume_down"), true);
  assert.equal(repeatingTvKeys.has("ok"), false);
  assert.equal(repeatingTvKeys.has("back"), false);
});
