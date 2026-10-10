import assert from "node:assert/strict";
import test from "node:test";
import { minutesPhrase, nextEventCue, nextUpEvent, nextUpPhrase } from "../event-cue.js";

const now = Date.parse("2026-09-08T16:00:00+03:00");

test("does not nag about distant or guest-hidden events", () => {
  assert.equal(nextEventCue([{ id: "1", title: "Ужин", start: "2026-09-08T17:00:00+03:00" }], { now }), null);
  assert.equal(nextEventCue([{ id: "1", title: "Ужин", start: "2026-09-08T16:05:00+03:00" }], { now, privacy: true }), null);
  assert.equal(nextEventCue([{ id: "1", title: "Ужин", start: "2026-09-08T16:05:00+03:00" }], { now, showCalendar: false }), null);
  assert.equal(nextEventCue([{ id: "1", title: "Ужин", start: "2026-09-08T16:05:00+03:00", allDay: true }], { now }), null);
});

test("the next-up line names today's soonest timed event, or the one still going", () => {
  assert.equal(nextUpEvent([], { now }), null);
  assert.equal(nextUpEvent([{ title: "День рождения", start: "2026-09-08", end: "2026-09-09", allDay: true }], { now }), null);
  assert.equal(nextUpEvent([{ title: "Ужин", start: "2026-09-08T19:00:00+03:00", end: "2026-09-08T21:00:00+03:00" }], { now, privacy: true }), null);
  assert.equal(
    nextUpEvent([{ title: "Понедельник", start: "2026-09-10T10:00:00+03:00", end: "2026-09-10T11:00:00+03:00" }], { now }),
    null,
    "a Monday meeting is not next on Saturday",
  );

  const soon = nextUpEvent([
    { title: "Ужин", start: "2026-09-08T19:00:00+03:00", end: "2026-09-08T21:00:00+03:00" },
    { title: "Созвон", start: "2026-09-08T16:40:00+03:00", end: "2026-09-08T17:00:00+03:00" },
    { title: "Понедельник", start: "2026-09-10T10:00:00+03:00", end: "2026-09-10T11:00:00+03:00" },
  ], { now });
  assert.deepEqual(soon, { title: "Созвон", start: "2026-09-08T16:40:00+03:00", minutes: 40, live: false });

  const live = nextUpEvent([
    { title: "Йога", start: "2026-09-08T15:30:00+03:00", end: "2026-09-08T16:30:00+03:00" },
  ], { now });
  assert.equal(live.live, true);
  assert.equal(live.title, "Йога");
});

test("the next-up phrase stays short enough to read from the sofa", () => {
  assert.equal(nextUpPhrase({ title: "Йога", live: true }), "Сейчас · Йога");
  assert.equal(nextUpPhrase({ title: "Созвон", start: "2026-09-08T16:40:00+03:00", minutes: 40 }), "Через 40 мин · Созвон");
  assert.equal(nextUpPhrase({ title: "Ужин", start: "2026-09-08T19:00:00+03:00", minutes: 180 }), "в 19:00 · Ужин");
});

test("cues thirty minutes and again at five", () => {
  const halfHour = nextEventCue([
    { id: "meet", title: "Созвон", start: "2026-09-08T16:25:00+03:00", ownerName: "Наташа" },
  ], { now });
  assert.deepEqual(halfHour, {
    id: "meet@30",
    title: "Созвон",
    ownerName: "Наташа",
    start: "2026-09-08T16:25:00+03:00",
    minutes: 25,
  });

  const five = nextEventCue([
    { id: "meet", title: "Созвон", start: "2026-09-08T16:05:00+03:00", ownerName: "Наташа" },
  ], { now, shownIds: ["meet@30"] });
  assert.deepEqual(five, {
    id: "meet@5",
    title: "Созвон",
    ownerName: "Наташа",
    start: "2026-09-08T16:05:00+03:00",
    minutes: 5,
  });
  assert.equal(minutesPhrase(5), "Через 5 минут");
  assert.equal(minutesPhrase(1), "Через 1 минуту");
  assert.equal(minutesPhrase(2), "Через 2 минуты");
});

test("skips a lead that already had its overlay", () => {
  const events = [
    { id: "soon", title: "Созвон", start: "2026-09-08T16:04:00+03:00" },
    { id: "next", title: "Ужин", start: "2026-09-08T16:05:00+03:00" },
  ];
  assert.equal(nextEventCue(events, { now, shownIds: ["soon@5"] }).id, "next@5");
});
