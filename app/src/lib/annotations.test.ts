// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanComment, cleanRects, cleanText, isColor, mergeLineRects, snippet } from "./annotations.ts";

test("rects are clamped, rounded and bad ones dropped", () => {
  const out = cleanRects([
    { x: 0.1, y: 0.2, w: 0.3, h: 0.02 },
    { x: 0.9, y: 0.5, w: 0.5, h: 0.1 },
    { x: "a", y: 0, w: 1, h: 1 },
    { x: 0, y: 0, w: 0, h: 1 },
    null,
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[1].w, 0.1);
  assert.deepEqual(cleanRects("nope"), []);
  assert.equal(cleanRects(Array.from({ length: 500 }, () => ({ x: 0, y: 0, w: 0.1, h: 0.1 }))).length, 200);
});

test("boxes on one line join, other lines stay apart", () => {
  const merged = mergeLineRects([
    { x: 0.3, y: 0.1, w: 0.1, h: 0.02 },
    { x: 0.1, y: 0.1, w: 0.19, h: 0.02 },
    { x: 0.1, y: 0.14, w: 0.2, h: 0.02 },
    { x: 0.7, y: 0.1, w: 0.1, h: 0.02 },
  ]);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].x, 0.1);
  assert.ok(Math.abs(merged[0].w - 0.3) < 1e-9);
});

test("text helpers", () => {
  assert.equal(cleanText("  a \n  b  ", 10), "a b");
  assert.equal(cleanText(5, 10), "");
  assert.equal(cleanText("ab\u0000cd", 10), "abcd");
  assert.equal(cleanComment("a\r\n\n\n\nb "), "a\n\nb");
  assert.equal(snippet("short"), "short");
  assert.ok(snippet("word ".repeat(60), 40).endsWith("..."));
  assert.ok(isColor("pink"));
  assert.ok(!isColor("red"));
});
