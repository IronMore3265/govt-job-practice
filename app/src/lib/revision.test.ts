import test from "node:test";
import assert from "node:assert/strict";
import { pickRevisionSubject, revisionSubjects, type RevisionItem } from "./revision.ts";

const item = (subject_id: string, subject: string): RevisionItem => ({
  question_id: Math.random().toString(),
  text: "q",
  lang: "bn",
  figure_id: null,
  source_page: null,
  subject_id,
  subject,
  topic_id: "t",
  topic: "T",
  topic_number: 1,
  has_note: false,
  times_wrong: 1,
  last_wrong: "2026-11-05T00:00:00Z",
  selected_option: null,
  explanation: null,
  options: [],
});

test("revisionSubjects counts per subject and keeps the order", () => {
  const subs = revisionSubjects([item("a", "Bangla"), item("a", "Bangla"), item("b", "English")]);
  assert.deepEqual(subs, [
    { id: "a", name: "Bangla", count: 2 },
    { id: "b", name: "English", count: 1 },
  ]);
  assert.deepEqual(revisionSubjects([]), []);
});

test("pickRevisionSubject falls back to the first subject", () => {
  const subs = revisionSubjects([item("a", "Bangla"), item("b", "English")]);
  assert.equal(pickRevisionSubject(subs, "b")?.id, "b");
  assert.equal(pickRevisionSubject(subs, "zzz")?.id, "a");
  assert.equal(pickRevisionSubject(subs, undefined)?.id, "a");
  assert.equal(pickRevisionSubject([], "a"), null);
});
