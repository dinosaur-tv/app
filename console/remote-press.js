export const repeatingTvKeys = new Set([
  "up",
  "down",
  "left",
  "right",
  "volume_up",
  "volume_down",
]);

export function createRemotePressController({
  send,
  feedback = () => {},
  schedule = (callback, delay) => window.setTimeout(callback, delay),
  cancel = (timer) => window.clearTimeout(timer),
  now = () => Date.now(),
  holdDelay = 430,
  repeatEvery = 145,
} = {}) {
  let active = null;
  let timer = null;
  let ignoreClickUntil = 0;

  function stop(button) {
    if (timer !== null) cancel(timer);
    timer = null;
    if (button) button.classList?.remove("is-pressing");
    if (active?.button && active.button !== button) active.button.classList?.remove("is-pressing");
    active = null;
  }

  function queueRepeat(delay) {
    timer = schedule(() => {
      if (!active) return;
      send(active.key, active.button, { repeat: true });
      queueRepeat(repeatEvery);
    }, delay);
  }

  function pointerDown(button, event = {}) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault?.();
    stop();
    const key = button.dataset.tvKey;
    active = { key, button, pointerId: event.pointerId };
    button.classList?.add("is-pressing");
    button.setPointerCapture?.(event.pointerId);
    ignoreClickUntil = now() + 900;
    feedback(key);
    send(key, button, { repeat: false });
    if (repeatingTvKeys.has(key)) queueRepeat(holdDelay);
  }

  function pointerEnd(button, event = {}) {
    if (active && event.pointerId !== undefined && active.pointerId !== undefined && event.pointerId !== active.pointerId) return;
    stop(button);
  }

  function click(button, event = {}) {
    if (now() < ignoreClickUntil) {
      event.preventDefault?.();
      return false;
    }
    feedback(button.dataset.tvKey);
    send(button.dataset.tvKey, button, { repeat: false });
    return true;
  }

  return { pointerDown, pointerEnd, click, stop };
}
