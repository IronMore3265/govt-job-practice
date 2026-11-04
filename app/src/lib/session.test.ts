// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { clockOffset, formatClock, formatScore, formatTaken, isLowTime, missedCount, paletteCounts, paletteState, percent, secondsLeft, splitPageRefs, topicResults, weakTopics } from "./session.ts";

test("the clock follows the server, not the browser", () => {
  const offset = clockOffset("2026-11-05T10:00:00.000Z", Date.parse("2026-11-05T10:00:30.000Z")); // browser runs 30 s fast
  assert.equal(offset, -30000);
  const browserNow = Date.parse("2026-11-05T10:05:30.000Z");
  assert.equal(secondsLeft("2026-11-05T10:12:00.000Z", browserNow, offset), 7 * 60);
  assert.equal(secondsLeft("2026-11-05T10:12:00.000Z", Date.parse("2026-11-05T10:12:31.000Z"), offset), 0);
  assert.equal(secondsLeft("2026-11-05T10:12:00.000Z", Date.parse("2026-11-05T10:11:59.200Z") - offset, offset), 1, "a part second rounds up");
});

test("clock and duration text", () => {
  assert.equal(formatClock(522), "08:42");
  assert.equal(formatClock(720), "12:00");
  assert.equal(formatClock(3930), "1:05:30");
  assert.equal(formatClock(-5), "00:00");
  assert.equal(formatTaken(665), "11 min 05 s");
  assert.equal(formatTaken(45), "45 s");
});

test("low time warning", () => {
  assert.equal(isLowTime(60, 720), true);
  assert.equal(isLowTime(61, 720), false);
  assert.equal(isLowTime(10, 72), true);
  assert.equal(isLowTime(11, 72), false);
});

test("palette: marked is orange even when answered", () => {
  assert.equal(paletteState({ selected_option: "x", marked: false }), "answered");
  assert.equal(paletteState({ selected_option: "x", marked: true }), "marked");
  assert.equal(paletteState({ selected_option: null, marked: true }), "marked");
  assert.equal(paletteState({ selected_option: null, marked: false }), "open");
  assert.deepEqual(paletteCounts([{ selected_option: "a", marked: false }, { selected_option: "b", marked: true }, { selected_option: null, marked: false }]), { answered: 2, marked: 1, open: 1 });
});

test("score text and percentages", () => {
  assert.equal(formatScore(14), "14.00");
  assert.equal(formatScore(13.75), "13.75");
  assert.equal(formatScore(-0.25), "-0.25");
  assert.equal(percent(14, 20), 70);
  assert.equal(percent(-3, 20), 0);
  assert.equal(percent(5, 0), 0);
});

const q = (id: string, n: number, ok: boolean) => ({ topic_id: id, topic: `T${n}`, topic_number: n, subject: "S", is_correct: ok });

test("topic results are weakest first and count skipped as missed", () => {
  const r = topicResults([q("a", 1, true), q("a", 1, true), q("b", 2, false), q("b", 2, true), q("c", 3, false)]);
  assert.deepEqual(r.map((x) => [x.topic, x.pct]), [["T3", 0], ["T2", 50], ["T1", 100]]);
  assert.equal(missedCount([q("a", 1, true), q("a", 1, false), q("a", 1, false)]), 2);
});

test("weak topics need enough questions and a low score", () => {
  const stats = [
    { name: "a", asked: 10, correct: 4 },
    { name: "b", asked: 2, correct: 0 },
    { name: "c", asked: 10, correct: 9 },
    { name: "d", asked: 5, correct: 1 },
  ];
  assert.deepEqual(weakTopics(stats).map((s) => s.name), ["d", "a"]);
  assert.deepEqual(weakTopics(stats, 1, 50).map((s) => s.name), ["b", "d", "a"]);
});

test("page references in explanations become links", () => {
  assert.deepEqual(splitPageRefs("See page 12 for the rule."), [
    { type: "text", text: "See page " },
    { type: "page", text: "12", page: 12 },
    { type: "text", text: " for the rule." },
  ]);
  assert.deepEqual(splitPageRefs("Newton. Notes, p. 7 and pages 9."), [
    { type: "text", text: "Newton. Notes, p. " },
    { type: "page", text: "7", page: 7 },
    { type: "text", text: " and pages " },
    { type: "page", text: "9", page: 9 },
    { type: "text", text: "." },
  ]);
  assert.deepEqual(splitPageRefs("No reference here."), [{ type: "text", text: "No reference here." }]);
  assert.deepEqual(splitPageRefs("Costs $5, page 3"), [{ type: "text", text: "Costs $5, page 3" }], "text with math is left alone");
  assert.deepEqual(splitPageRefs("The year page 0 is wrong"), [{ type: "text", text: "The year page 0 is wrong" }]);
});
