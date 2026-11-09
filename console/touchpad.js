// The phone as a laptop touchpad for a computer under the television: one finger moves the
// cursor, a short tap clicks, two fingers scroll. Movement is summed and sent a few times a
// second, so a swipe is a handful of requests rather than one per finger event.

export const TOUCHPAD_SPEED = 2.2;
const TAP_MS = 230;
const TAP_SLOP = 8;
const SCROLL_STEP = 14;

/** Adds finger travel up and hands it out in whole pixels, keeping the remainder. */
export function createMotionAccumulator(speed = TOUCHPAD_SPEED) {
  let dx = 0;
  let dy = 0;
  return {
    add(x, y) { dx += x * speed; dy += y * speed; },
    take() {
      const out = { dx: Math.trunc(dx), dy: Math.trunc(dy) };
      dx -= out.dx; dy -= out.dy;
      return out.dx || out.dy ? out : null;
    },
  };
}

/** Two-finger travel becomes scroll lines; a small wobble scrolls nothing. */
export function createScrollAccumulator(step = SCROLL_STEP) {
  let travel = 0;
  return {
    add(y) { travel += y; },
    take() {
      const lines = Math.trunc(travel / step);
      travel -= lines * step;
      return lines || null;
    },
  };
}

export function isTap(startedAt, endedAt, moved) {
  return endedAt - startedAt <= TAP_MS && moved <= TAP_SLOP;
}

export function createTouchpad(element, { send, every = 90, now = () => Date.now() }) {
  const fingers = new Map();
  const motion = createMotionAccumulator();
  const scroll = createScrollAccumulator();
  let timer = null;
  let gesture = null;

  function flush() {
    const move = motion.take();
    if (move) send({ action: "pointer", ...move });
    const lines = scroll.take();
    if (lines) send({ action: "scroll", dy: lines });
  }

  function start() {
    if (timer === null) timer = window.setInterval(flush, every);
  }

  function stop() {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    flush();
  }

  element.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    element.setPointerCapture?.(event.pointerId);
    fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (fingers.size === 1) gesture = { at: now(), moved: 0, multi: false };
    else if (gesture) gesture.multi = true;
    start();
  });

  element.addEventListener("pointermove", (event) => {
    const last = fingers.get(event.pointerId);
    if (!last) return;
    const x = event.clientX - last.x;
    const y = event.clientY - last.y;
    fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (gesture) gesture.moved += Math.abs(x) + Math.abs(y);
    // Two fingers: each reports its own travel, so half of it makes one scroll.
    if (fingers.size >= 2) scroll.add(y / 2);
    else motion.add(x, y);
  });

  const lift = (event) => {
    if (!fingers.delete(event.pointerId)) return;
    if (fingers.size) return;
    stop();
    if (gesture && !gesture.multi && isTap(gesture.at, now(), gesture.moved)) send({ action: "click", button: "left" });
    gesture = null;
  };
  element.addEventListener("pointerup", lift);
  element.addEventListener("pointercancel", lift);

  return { stop };
}
