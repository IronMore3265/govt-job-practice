// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { missingForLastSet, mulberry32, nextSetNumber, planSets, spread, spreadSummary } from "./sets.ts";

const make = (topic: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${topic}${i}`, topic_id: topic }));
const topicOf = (id: string) => id[0];

test("spread keeps every question once", () => {
  const pool = [...make("a", 30), ...make("b", 10)];
  const out = spread(pool, mulberry32(1));
  assert.equal(out.length, 40);
  assert.equal(new Set(out).size, 40);
});

test("spread mirrors the pool in every stretch: 30 and 10 come out three to one", () => {
  const out = spread([...make("a", 30), ...make("b", 10)], mulberry32(7));
  for (const start of [0, 10, 20, 30]) {
    const b = out.slice(start, start + 10).filter((id) => topicOf(id) === "b").length;
    assert.ok(b >= 2 && b <= 3, `stretch at ${start} has ${b} from topic b`);
  }
  const first20 = out.slice(0, 20);
  assert.equal(first20.filter((id) => topicOf(id) === "b").length, 5);
});

test("spread is repeatable with the same seed and differs with another", () => {
  const pool = [...make("a", 12), ...make("b", 12)];
  assert.deepEqual(spread(pool, mulberry32(3)), spread(pool, mulberry32(3)));
  assert.notDeepEqual(spread(pool, mulberry32(3)), spread(pool, mulberry32(4)));
});

test("45 questions make two full sets and a short one of 5", () => {
  const plan = planSets({ size: 20, pool: [...make("a", 25), ...make("b", 20)], shortSets: [], rng: mulberry32(1) });
  assert.deepEqual(plan.newSets.map((s) => [s.question_ids.length, s.full]), [[20, true], [20, true], [5, false]]);
  assert.equal(plan.topUps.length, 0);
  const all = plan.newSets.flatMap((s) => s.question_ids);
  assert.equal(new Set(all).size, 45);
});

test("sets are spread across topics", () => {
  const plan = planSets({ size: 20, pool: [...make("a", 30), ...make("b", 30), ...make("c", 20)], shortSets: [], rng: mulberry32(9) });
  const first = plan.newSets[0].question_ids;
  for (const topic of ["a", "b", "c"]) {
    const n = first.filter((id) => topicOf(id) === topic).length;
    assert.ok(n >= 5, `topic ${topic} has only ${n} in the first set`);
  }
});

test("a short draft set is topped up before new sets are cut", () => {
  const short = { id: "s1", question_ids: make("a", 14).map((q) => q.id) };
  const plan = planSets({ size: 20, pool: make("b", 10), shortSets: [short], rng: mulberry32(1) });
  assert.equal(plan.topUps.length, 1);
  assert.equal(plan.topUps[0].add.length, 6);
  assert.equal(plan.topUps[0].full, true);
  assert.deepEqual(plan.newSets.map((s) => [s.question_ids.length, s.full]), [[4, false]]);
  const used = [...plan.topUps[0].add, ...plan.newSets[0].question_ids];
  assert.equal(new Set(used).size, 10);
});

test("a top up that cannot fill the set leaves it short", () => {
  const short = { id: "s1", question_ids: make("a", 14).map((q) => q.id) };
  const plan = planSets({ size: 20, pool: make("b", 3), shortSets: [short], rng: mulberry32(1) });
  assert.deepEqual([plan.topUps[0].add.length, plan.topUps[0].full], [3, false]);
  assert.equal(plan.newSets.length, 0);
});

test("an empty pool plans nothing, and a full set is never topped up", () => {
  assert.deepEqual(planSets({ size: 20, pool: [], shortSets: [] }), { topUps: [], newSets: [] });
  const full = { id: "s1", question_ids: make("a", 20).map((q) => q.id) };
  assert.equal(planSets({ size: 20, pool: make("b", 5), shortSets: [full], rng: mulberry32(1) }).topUps.length, 0);
});

test("the size can differ per exam", () => {
  const plan = planSets({ size: 5, pool: make("a", 12), shortSets: [], rng: mulberry32(1) });
  assert.deepEqual(plan.newSets.map((s) => s.question_ids.length), [5, 5, 2]);
  assert.throws(() => planSets({ size: 0, pool: [], shortSets: [] }));
});

test("set names count up and never reuse a deleted number", () => {
  assert.equal(nextSetNumber([]), 1);
  assert.equal(nextSetNumber(["Set 1", "Set 2"]), 3);
  assert.equal(nextSetNumber(["Set 1", "Set 4", "Mock paper"]), 5);
});

test("spread summary and missing count", () => {
  assert.equal(spreadSummary([2, 1, 1, 3, 1]), "T1 x3 · T2 x1 · T3 x1");
  assert.equal(spreadSummary([]), "");
  assert.equal(missingForLastSet(34, 20), 6);
  assert.equal(missingForLastSet(40, 20), 0);
  assert.equal(missingForLastSet(0, 20), 20);
});

test("chunk splits a list", async () => {
  const { chunk } = await import("./paging.ts");
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 3), []);
});
