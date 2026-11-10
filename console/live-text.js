// Typing on the phone that lands on the screen as it is typed, the way a TV remote's
// keyboard behaves: no «send» button. The field is compared with what was already sent,
// and only the difference travels — new letters as text, removed ones as backspaces.

/** What turns `before` into `after`: how many characters to erase, then what to type. */
export function textDiff(before, after) {
  const a = Array.from(before);
  const b = Array.from(after);
  let same = 0;
  while (same < a.length && same < b.length && a[same] === b[same]) same += 1;
  return { erase: a.length - same, type: b.slice(same).join("") };
}

/**
 * Sends one change at a time, in order: a backspace must not overtake the letter before it.
 * `send` returns a promise; a failed send does not stop the next one.
 */
export function createSerialSender(send) {
  let chain = Promise.resolve();
  return (body) => {
    chain = chain.then(() => send(body)).catch(() => {});
    return chain;
  };
}

export function createLiveText(input, { send }) {
  const queue = createSerialSender(send);
  let sent = "";
  let composing = false;

  function flush() {
    if (composing) return;
    const { erase, type } = textDiff(sent, input.value);
    for (let i = 0; i < erase; i += 1) queue({ action: "key", key: "backspace" });
    if (type) queue({ action: "text", text: type });
    sent = input.value;
  }

  // Keyboards that compose words (Gboard, Russian autocorrect) settle the word first.
  input.addEventListener("compositionstart", () => { composing = true; });
  input.addEventListener("compositionend", () => { composing = false; flush(); });
  input.addEventListener("input", flush);
  // An empty field gives no input event for ⌫, so the key itself is sent.
  input.addEventListener("beforeinput", (event) => {
    if (event.inputType === "deleteContentBackward" && input.value === "") queue({ action: "key", key: "backspace" });
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      flush();
      queue({ action: "key", key: "enter" });
      input.value = "";
      sent = "";
    }
  });

  return {
    /** Starts afresh: whatever is on the screen stays, the field forgets it. */
    reset() { input.value = ""; sent = ""; composing = false; },
  };
}
