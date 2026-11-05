// Revision list (wrong answers to go over again). The shape is what my_revision() returns
// (supabase/migrations/20261105130000_sequential_sets_and_revision.sql).

import type { ReviewOption } from "@/lib/session";

export type RevisionItem = {
  question_id: string;
  text: string;
  lang: "en" | "bn";
  figure_id: string | null;
  source_page: number | null;
  subject_id: string;
  subject: string;
  topic_id: string;
  topic: string;
  topic_number: number;
  has_note: boolean;
  times_wrong: number;
  last_wrong: string;
  selected_option: string | null;
  explanation: string | null;
  options: ReviewOption[];
};

export type RevisionSubject = { id: string; name: string; count: number };

// Subjects that have something to revise, in the order the database returned them (subject order), with how many each.
export function revisionSubjects(items: readonly RevisionItem[]): RevisionSubject[] {
  const out: RevisionSubject[] = [];
  for (const it of items) {
    const found = out.find((s) => s.id === it.subject_id);
    if (found) found.count += 1;
    else out.push({ id: it.subject_id, name: it.subject, count: 1 });
  }
  return out;
}

// The subject shown: the one asked for, else the first with items.
export function pickRevisionSubject(subjects: readonly RevisionSubject[], wanted: string | undefined): RevisionSubject | null {
  return subjects.find((s) => s.id === wanted) ?? subjects[0] ?? null;
}
