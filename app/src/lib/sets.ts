// Set building (PLAN.md section 2). Pure functions, tested with `npm test`.
//
// A set is a saved list of exactly `size` questions (20 by default) from one exam's topics. The builder takes the
// approved questions that no set of the exam uses yet, spreads every topic evenly through them, tops up short draft sets
// first, and cuts the rest into sets. A full set can go live, the last short one stays a draft until its missing
// questions are imported.

export type PoolQuestion = { id: string; topic_id: string };

// A small seeded random generator, so a build can be repeated in tests. The app seeds it with the clock.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Orders the questions so each topic is spread evenly along the whole list. A topic with 30 questions and one with 10
// come out as three to one in every stretch, so a set cut from any part of the list mirrors the whole pool.
export function spread(pool: readonly PoolQuestion[], rng: () => number): string[] {
  const byTopic = new Map<string, string[]>();
  for (const q of pool) byTopic.set(q.topic_id, [...(byTopic.get(q.topic_id) ?? []), q.id]);
  const keyed: { id: string; key: number; topic: string }[] = [];
  for (const [topic, ids] of byTopic) {
    const mixed = shuffle(ids, rng);
    mixed.forEach((id, i) => keyed.push({ id, key: (i + 0.5) / mixed.length, topic }));
  }
  keyed.sort((a, b) => a.key - b.key || (a.topic < b.topic ? -1 : a.topic > b.topic ? 1 : 0));
  return keyed.map((k) => k.id);
}

export type ShortSet = { id: string; question_ids: string[] };
export type TopUp = { setId: string; add: string[]; full: boolean };
export type NewSet = { question_ids: string[]; full: boolean };
export type SetPlan = { topUps: TopUp[]; newSets: NewSet[] };

// What to do with the unused approved questions: first top up the existing short draft sets (in the order given),
// then cut what is left into new sets of `size`. Nothing is dropped and no question is used twice.
export function planSets(opts: { size: number; pool: readonly PoolQuestion[]; shortSets: readonly ShortSet[]; rng?: () => number }): SetPlan {
  const { size } = opts;
  if (!Number.isInteger(size) || size < 1) throw new Error("size must be a whole number of at least 1");
  const queue = spread(opts.pool, opts.rng ?? Math.random);
  const topUps: TopUp[] = [];
  let at = 0;
  for (const set of opts.shortSets) {
    const need = size - set.question_ids.length;
    if (need <= 0 || at >= queue.length) continue;
    const add = queue.slice(at, at + need);
    at += add.length;
    topUps.push({ setId: set.id, add, full: add.length === need });
  }
  const newSets: NewSet[] = [];
  for (let i = at; i < queue.length; i += size) {
    const ids = queue.slice(i, i + size);
    newSets.push({ question_ids: ids, full: ids.length === size });
  }
  return { topUps, newSets };
}

// "Set 1", "Set 2", ... The next number after the highest "Set N" already used, so deleting a set never reuses a name.
export function nextSetNumber(names: readonly string[]): number {
  let max = 0;
  for (const name of names) {
    const m = /^Set (\d+)$/.exec(name.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

// How a set's questions fall across topics, for the sets list: "T1 x8 · T2 x6" (topic numbers).
export function spreadSummary(topicNumbers: readonly number[]): string {
  const counts = new Map<number, number>();
  for (const n of topicNumbers) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, c]) => `T${n} x${c}`)
    .join(" · ");
}

// Questions still missing from the last set of a pool: 34 approved questions in sets of 20 miss 6.
export function missingForLastSet(approved: number, size: number): number {
  if (approved === 0) return size;
  const rest = approved % size;
  return rest === 0 ? 0 : size - rest;
}
