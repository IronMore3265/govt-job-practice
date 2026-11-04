// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatBytes, LIMITS_BYTES, usageNote, usagePercent } from "./storage.ts";

test("byte sizes read plainly", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(900), "900 B");
  assert.equal(formatBytes(2048), "2 KB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
  assert.equal(formatBytes(1.5 * 1024 * 1024 * 1024), "1.50 GB");
  assert.equal(formatBytes(-5), "0 B");
});

test("usage against the free plan limits", () => {
  assert.equal(usagePercent(LIMITS_BYTES.storage / 2, LIMITS_BYTES.storage), 50);
  assert.equal(usagePercent(LIMITS_BYTES.database * 2, LIMITS_BYTES.database), 100);
  assert.equal(usagePercent(5, 0), 0);
  assert.match(usageNote(95), /Almost full/);
  assert.match(usageNote(75), /Getting full/);
  assert.match(usageNote(10), /Plenty/);
});
