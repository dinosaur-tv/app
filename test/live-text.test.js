import assert from "node:assert/strict";
import test from "node:test";
import { createSerialSender, textDiff } from "../console/live-text.js";

test("новые буквы уходят текстом, стёртые — нажатиями ⌫", () => {
  assert.deepEqual(textDiff("", "При"), { erase: 0, type: "При" });
  assert.deepEqual(textDiff("Привет", "Прив"), { erase: 2, type: "" });
  // Autocorrect swaps a word: erase the tail that changed, type the new one.
  assert.deepEqual(textDiff("пртвет", "привет"), { erase: 4, type: "ивет" });
  assert.deepEqual(textDiff("😀a", "😀b"), { erase: 1, type: "b" }, "emoji count as one letter");
});

test("отправка идёт строго по очереди, ошибка не останавливает следующую", async () => {
  const seen = [];
  const send = createSerialSender(async (body) => {
    await new Promise((resolve) => setTimeout(resolve, body.delay));
    if (body.fail) throw new Error("network");
    seen.push(body.id);
  });
  send({ id: 1, delay: 30 });
  send({ id: 2, delay: 1, fail: true });
  await send({ id: 3, delay: 1 });
  assert.deepEqual(seen, [1, 3]);
});
