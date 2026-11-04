// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { EXAM_DEFAULTS, examSummary, formatDuration, formatMark, parseNumber, plural, secondsPerQuestion, totalSeconds } from "./exam.ts";

test("defaults: 36 seconds per question is 12 minutes for 20 questions", () => {
  assert.equal(totalSeconds(EXAM_DEFAULTS.questionCount, EXAM_DEFAULTS.secondsPerQuestion), 720);
  assert.equal(formatDuration(720), "12 min");
  assert.equal(secondsPerQuestion(720, 20), 36);
});

test("time per question scales with the question count", () => {
  assert.equal(totalSeconds(30, 36), 1080);
  assert.equal(formatDuration(1080), "18 min");
  assert.equal(totalSeconds(25, 36), 900);
  assert.equal(secondsPerQuestion(750, 20), 37.5);
  assert.equal(secondsPerQuestion(100, 0), 36);
});

test("formatDuration", () => {
  assert.equal(formatDuration(45), "45 s");
  assert.equal(formatDuration(750), "12 min 30 s");
  assert.equal(formatDuration(0), "0 s");
  assert.equal(formatDuration(-5), "0 s");
});

test("formatMark drops trailing zeros", () => {
  assert.equal(formatMark(1), "1");
  assert.equal(formatMark(0.25), "0.25");
  assert.equal(formatMark(1.5), "1.5");
});

test("examSummary", () => {
  assert.equal(examSummary({ question_count: 20, time_seconds: 720 }, 3), "3 topics · 20 questions · 12 min");
  assert.equal(examSummary({ question_count: 1, time_seconds: 36 }, 1), "1 topic · 1 question · 36 s");
  assert.equal(plural(0, "topic"), "0 topics");
});

test("parseNumber", () => {
  assert.equal(parseNumber("20", 1, 200, { integer: true }), 20);
  assert.equal(parseNumber(" 0.25 ", 0, 10), 0.25);
  assert.equal(parseNumber("2.5", 1, 200, { integer: true }), null);
  assert.equal(parseNumber("", 0, 10), null);
  assert.equal(parseNumber("abc", 0, 10), null);
  assert.equal(parseNumber("1e3", 0, 10000), null);
  assert.equal(parseNumber("300", 1, 200), null);
  assert.equal(parseNumber(null, 0, 10), null);
});
