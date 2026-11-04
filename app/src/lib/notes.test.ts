// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { clampPage, noteHref, parseTopicList, readingPercent, startPage } from "./notes.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

test("topic lists keep valid distinct ids in order", () => {
  assert.deepEqual(parseTopicList(`${A},${B},${A},nope,`), [A, B]);
  assert.deepEqual(parseTopicList(undefined), []);
  assert.deepEqual(parseTopicList([`${B}`, A]), [B]);
  assert.equal(parseTopicList(Array(50).fill(0).map((_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`).join(",")).length, 30);
});

test("page numbers are clamped to the note", () => {
  assert.equal(clampPage("5", 9), 5);
  assert.equal(clampPage("50", 9), 9);
  assert.equal(clampPage("0", 9), null);
  assert.equal(clampPage("abc", 9), null);
  assert.equal(clampPage(3, null), 3);
  assert.equal(clampPage(99999, null), 10000);
});

test("the start page prefers the link, then the saved page, then 1", () => {
  assert.equal(startPage({ requested: "12", saved: 4, pages: 20 }), 12);
  assert.equal(startPage({ requested: undefined, saved: 4, pages: 20 }), 4);
  assert.equal(startPage({ requested: "x", saved: 40, pages: 20 }), 20);
  assert.equal(startPage({ requested: undefined, saved: null, pages: 20 }), 1);
});

test("reading percent", () => {
  assert.equal(readingPercent(3, 9), 33);
  assert.equal(readingPercent(9, 9), 100);
  assert.equal(readingPercent(1, 0), 0);
  assert.equal(readingPercent(99, 9), 100);
});

test("viewer links", () => {
  assert.equal(noteHref(A), `/notes/${A}`);
  assert.equal(noteHref(A, { page: 1 }), `/notes/${A}`);
  assert.equal(noteHref(A, { page: 12 }), `/notes/${A}?page=12`);
  assert.equal(noteHref(A, { topics: [A, B], exam: "e1", set: "s1" }), `/notes/${A}?topics=${A}%2C${B}&exam=e1&set=s1`);
});
