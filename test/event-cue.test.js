import assert from "node:assert/strict";
import test from "node:test";
import { minutesPhrase, nextEventCue } from "../event-cue.js";

const now = Date.parse("2026-09-08T16:00:00+03:00");

test("does not nag about distant or guest-hidden events", () => {
  assert.equal(nextEventCue([{ id: "1", title: "Ужин", start: "2026-09-08T17:00:00+03:00" }], { now }), null);
  assert.equal(nextEventCue([{ id: "1", title: "Ужин", start: "2026-09-08T16:05:00+03:00" }], { now, privacy: true }), null);
  assert.equal(nextEventCue([{ id: "1", title: "Ужин", start: "2026-09-08T16:05:00+03:00" }], { now, showCalendar: false }), null);
  assert.equal(nextEventCue([{ id: "1", title: "Ужин", start: "2026-09-08T16:05:00+03:00", allDay: true }], { now }), null);
});

test("cues the next timed event inside five minutes", () => {
  const cue = nextEventCue([
    { id: "later", title: "Поздний", start: "2026-09-08T18:00:00+03:00" },
    { id: "soon", title: "Созвон", start: "2026-09-08T16:05:00+03:00", ownerName: "Наташа" },
  ], { now });
  assert.deepEqual(cue, { id: "soon", title: "Созвон", ownerName: "Наташа", start: "2026-09-08T16:05:00+03:00", minutes: 5 });
  assert.equal(minutesPhrase(5), "Через 5 минут");
  assert.equal(minutesPhrase(1), "Через 1 минуту");
  assert.equal(minutesPhrase(2), "Через 2 минуты");
});

test("skips an event that already had its overlay", () => {
  const events = [
    { id: "soon", title: "Созвон", start: "2026-09-08T16:04:00+03:00" },
    { id: "next", title: "Ужин", start: "2026-09-08T16:05:00+03:00" },
  ];
  assert.equal(nextEventCue(events, { now, shownIds: ["soon"] }).id, "next");
});
