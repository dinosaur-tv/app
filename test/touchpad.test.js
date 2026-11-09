import assert from "node:assert/strict";
import test from "node:test";
import { createMotionAccumulator, createScrollAccumulator, isTap, liveTrail } from "../console/touchpad.js";

test("движение пальца копится и уходит целыми пикселями, остаток не теряется", () => {
  const motion = createMotionAccumulator(2);
  motion.add(0.3, 0);
  assert.equal(motion.take(), null);
  motion.add(0.3, -1.4);
  assert.deepEqual(motion.take(), { dx: 1, dy: -2 });
  motion.add(0.1, 0);
  assert.equal(motion.take(), null);
});

test("прокрутка двумя пальцами считается строками, дрожание не прокручивает", () => {
  const scroll = createScrollAccumulator(10);
  scroll.add(6);
  assert.equal(scroll.take(), null);
  scroll.add(-27);
  assert.equal(scroll.take(), -2);
});

test("касание — это быстро и почти без движения", () => {
  assert.equal(isTap(0, 150, 3), true);
  assert.equal(isTap(0, 400, 3), false);
  assert.equal(isTap(0, 150, 30), false);
});

test("след пальца гаснет: старые точки не рисуются", () => {
  const points = [{ x: 0, y: 0, t: 0 }, { x: 5, y: 5, t: 500 }, { x: 9, y: 9, t: 900 }];
  assert.deepEqual(liveTrail(points, 1000, 650).map((point) => point.t), [500, 900]);
});
