// The phone as a laptop touchpad for a computer under the television: one finger moves the
// cursor, a short tap clicks, two fingers scroll. Movement is summed and sent a few times a
// second, so a swipe is a handful of requests rather than one per finger event.

export const TOUCHPAD_SPEED = 2.2;
const TAP_MS = 230;
/** How long the pad waits for an answer before it sends the next move regardless. */
export const STALL_MS = 1200;
const TAP_SLOP = 8;
const SCROLL_STEP = 14;

/**
 * Pointer acceleration, as on a laptop touchpad: a slow finger moves the cursor a little
 * for precision, a quick swipe carries it across the screen.
 */
export function acceleration(step, base = TOUCHPAD_SPEED) {
  return Math.min(base * 2.4, base * (0.75 + step * 0.09));
}

/** Adds finger travel up and hands it out in whole pixels, keeping the remainder. */
export function createMotionAccumulator(speed = TOUCHPAD_SPEED, { accelerate = false } = {}) {
  let dx = 0;
  let dy = 0;
  return {
    add(x, y) {
      const factor = accelerate ? acceleration(Math.hypot(x, y), speed) : speed;
      dx += x * factor;
      dy += y * factor;
    },
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

/** How long a stroke stays visible, and which points of it are still worth drawing. */
export const TRAIL_MS = 650;
export function liveTrail(points, at, life = TRAIL_MS) {
  return points.filter((point) => at - point.t < life);
}

/**
 * A fading line behind the finger, so the thumb sees what the cursor is being told to do.
 * Each finger keeps its own stroke; the newest part is brightest.
 */
function createTrail(canvas, now) {
  if (!canvas?.getContext) return { add() {}, resize() {}, clear() {} };
  const context = canvas.getContext("2d");
  const strokes = new Map();
  let frame = 0;
  let ratio = 1;
  const color = () => window.getComputedStyle(canvas).getPropertyValue("--trail").trim() || "#c4a06a";

  function resize() {
    ratio = window.devicePixelRatio || 1;
    const box = canvas.getBoundingClientRect();
    canvas.width = Math.round(box.width * ratio);
    canvas.height = Math.round(box.height * ratio);
  }

  function draw() {
    frame = 0;
    const at = now();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = color();
    let alive = false;
    for (const [id, points] of strokes) {
      const live = liveTrail(points, at);
      strokes.set(id, live);
      if (!live.length) { strokes.delete(id); continue; }
      alive = true;
      for (let i = 1; i < live.length; i += 1) {
        const fade = 1 - (at - live[i].t) / TRAIL_MS;
        context.globalAlpha = Math.max(0, fade) * 0.9;
        context.lineWidth = (3 + 9 * fade) * ratio;
        context.beginPath();
        context.moveTo(live[i - 1].x * ratio, live[i - 1].y * ratio);
        context.lineTo(live[i].x * ratio, live[i].y * ratio);
        context.stroke();
      }
      const head = live.at(-1);
      context.globalAlpha = Math.max(0, 1 - (at - head.t) / TRAIL_MS);
      context.fillStyle = context.strokeStyle;
      context.beginPath();
      context.arc(head.x * ratio, head.y * ratio, 9 * ratio, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    if (alive) frame = window.requestAnimationFrame(draw);
  }

  return {
    add(id, x, y) {
      const box = canvas.getBoundingClientRect();
      const points = strokes.get(id) ?? [];
      points.push({ x: x - box.left, y: y - box.top, t: now() });
      strokes.set(id, points);
      if (!frame) frame = window.requestAnimationFrame(draw);
    },
    resize,
    clear() { strokes.clear(); context.clearRect(0, 0, canvas.width, canvas.height); },
  };
}

export function createTouchpad(element, { send, trail: canvas, every = 60, now = () => Date.now() }) {
  const trail = createTrail(canvas, now);
  const fingers = new Map();
  const motion = createMotionAccumulator(TOUCHPAD_SPEED, { accelerate: true });
  const scroll = createScrollAccumulator();
  let timer = null;
  let gesture = null;

  // One request in flight at a time. On a slow connection the moves made meanwhile are
  // added up and go out together, instead of queueing behind each other and arriving late.
  let busy = false;
  function flush() {
    if (busy) return;
    const move = motion.take();
    const lines = scroll.take();
    const sends = [];
    if (move) sends.push(send({ action: "pointer", ...move }));
    if (lines) sends.push(send({ action: "scroll", dy: lines }));
    if (!sends.length) return;
    busy = true;
    // A request a mobile network never answers must not freeze the pad: after a moment the
    // next move goes out anyway.
    const giveUp = new Promise((resolve) => window.setTimeout(resolve, STALL_MS));
    Promise.race([Promise.allSettled(sends), giveUp]).finally(() => { busy = false; });
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
    // Some webviews refuse capture for a pointer they did not start; the pad works without it.
    try { element.setPointerCapture?.(event.pointerId); } catch { /* keep going */ }
    fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    trail.add(event.pointerId, event.clientX, event.clientY);
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
    trail.add(event.pointerId, event.clientX, event.clientY);
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

  return {
    stop() { stop(); fingers.clear(); gesture = null; busy = false; trail.clear(); },
    resize: trail.resize,
  };
}
