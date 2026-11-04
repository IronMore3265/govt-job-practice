// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { toInviteViews, unusedCounts } from "./invites.ts";
import type { Invite } from "./database.types.ts";

const base: Invite = {
  id: "1",
  code: "AAAA-BBBB-CCCC",
  created_by: "u",
  used_by: null,
  used_at: null,
  expires_at: "2026-11-11T10:00:00.000Z",
  created_at: "2026-11-04T10:00:00.000Z",
};

test("toInviteViews: unused, used and expired", () => {
  const now = Date.parse("2026-11-05T10:00:00.000Z");
  const views = toInviteViews(
    [
      base,
      { ...base, id: "2", used_by: "x", used_at: "2026-11-05T09:00:00.000Z" },
      { ...base, id: "3", expires_at: "2026-11-05T09:59:59.000Z" },
    ],
    now,
  );
  assert.deepEqual(
    views.map((v) => v.status),
    ["unused", "used", "expired"],
  );
  assert.equal(views[0].expires, "2026-11-11");
});

test("unusedCounts: only unused, unexpired codes count", () => {
  const now = Date.parse("2026-11-05T10:00:00.000Z");
  const counts = unusedCounts(
    [
      base,
      { ...base, id: "2" },
      { ...base, id: "3", used_at: "2026-11-05T09:00:00.000Z" },
      { ...base, id: "4", expires_at: "2026-11-05T09:00:00.000Z" },
      { ...base, id: "5", created_by: "v" },
    ],
    now,
  );
  assert.equal(counts.get("u"), 2);
  assert.equal(counts.get("v"), 1);
});
