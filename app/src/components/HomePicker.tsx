"use client";

import { useState, type ReactNode } from "react";
import Link from "@/components/NavLink";
import { LeaderboardPanel } from "@/components/LeaderboardPanel";
import { StartExamForm } from "@/components/StartExamForm";
import { examSummary, formatMark } from "@/lib/exam";
import { noteHref } from "@/lib/notes";

export type TopicView = { id: string; number: number; title: string; hasNote: boolean };
export type SetView = { id: string; name: string; best: number | null; max: number | null };
export type ExamView = {
  id: string;
  name: string;
  questionCount: number;
  timeSeconds: number;
  negativeMark: number;
  topics: TopicView[];
  liveSets: SetView[];
};
export type SubjectView = { id: string; name: string; exams: ExamView[] };

// Home (mockup frame 1): subject, exam, topics (all preselected, tap to narrow), set (Set 1, 2, 3, new random), then
// "Read notes first" and "Start exam". Narrowing the topics means a new random set from just those topics, because a saved
// set is a fixed list. The leaderboard sits in the side column next to the invite panel.
export function HomePicker({ subjects, side }: { subjects: SubjectView[]; side?: ReactNode }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const subject = subjects.find((s) => s.id === subjectId) ?? subjects[0];
  const [examId, setExamId] = useState(subject?.exams[0]?.id ?? "");
  const exam = subject?.exams.find((e) => e.id === examId) ?? subject?.exams[0];
  // The topics the student narrowed the scope to. Empty means all of the exam's topics.
  const [narrowed, setNarrowed] = useState<string[]>([]);
  // A saved set id, "random" for a new random set, or "" for the exam's first live set.
  const [setChoice, setSetChoice] = useState("");

  function pickSubject(id: string) {
    setSubjectId(id);
    setExamId(subjects.find((s) => s.id === id)?.exams[0]?.id ?? "");
    setNarrowed([]);
    setSetChoice("");
  }

  function toggleTopic(id: string) {
    setNarrowed((cur) => (cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]));
  }

  const chosenTopics = exam ? exam.topics.filter((t) => narrowed.includes(t.id)) : [];
  const narrowing = chosenTopics.length > 0;
  const firstSet = exam?.liveSets[0]?.id ?? "random";
  const effectiveSet = narrowing ? "random" : setChoice && (setChoice === "random" || exam?.liveSets.some((s) => s.id === setChoice)) ? setChoice : firstSet;

  // Notes to read first: the narrowed topics, or all of the exam's topics, keeping those that have a note.
  const readTopics = (narrowing ? chosenTopics : (exam?.topics ?? [])).filter((t) => t.hasNote);
  const readHref =
    exam && readTopics.length
      ? noteHref(readTopics[0].id, { topics: readTopics.map((t) => t.id), exam: exam.id, set: effectiveSet === "random" ? null : effectiveSet, narrow: narrowing })
      : null;

  const main = !subject ? (
    <p className="small muted">No subjects yet. The admin adds them in the portal.</p>
  ) : (
    <section className="stack" style={{ gap: 22 }}>
      <div className="stack-sm">
        <p className="label">Subject</p>
        <div className="wrap">
          {subjects.map((s) => (
            <button key={s.id} type="button" className={`pill${s.id === subject.id ? " pill-active" : ""}`} aria-pressed={s.id === subject.id} onClick={() => pickSubject(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="stack-sm">
        <p className="label">Exam</p>
        {subject.exams.length === 0 ? <p className="small muted">No exams for {subject.name} yet.</p> : null}
        <div className="stack" style={{ gap: 14 }}>
          {subject.exams.map((e) => (
            <button
              key={e.id}
              type="button"
              className={`exam-card${e.id === exam?.id ? " exam-card-on" : ""}`}
              aria-pressed={e.id === exam?.id}
              onClick={() => {
                setExamId(e.id);
                setNarrowed([]);
                setSetChoice("");
              }}
            >
              <span>
                <b>{e.name}</b>
                <span className="exam-card-sub small">{examSummary({ question_count: e.questionCount, time_seconds: e.timeSeconds }, e.topics.length)}</span>
              </span>
              <span className="chip">-{formatMark(e.negativeMark)}</span>
            </button>
          ))}
        </div>
      </div>

      {exam ? (
        <>
          <div className="stack-sm">
            <p className="label">Topics</p>
            {exam.topics.length === 0 ? (
              <p className="small muted">No topics in this exam yet.</p>
            ) : (
              <div className="wrap">
                <button type="button" className={`pill${!narrowing ? " pill-active" : ""}`} aria-pressed={!narrowing} onClick={() => setNarrowed([])}>
                  All
                </button>
                {exam.topics.map((t) => {
                  const on = narrowed.includes(t.id);
                  return (
                    <button key={t.id} type="button" className={`pill${on ? " pill-active" : ""}`} aria-pressed={on} onClick={() => toggleTopic(t.id)}>
                      {t.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="stack-sm">
            <p className="label">Set</p>
            <div className="wrap">
              {exam.liveSets.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`pill${effectiveSet === s.id ? " pill-active" : ""}`}
                  aria-pressed={effectiveSet === s.id}
                  disabled={narrowing}
                  onClick={() => setSetChoice(s.id)}
                >
                  {s.name}
                  {s.best !== null && s.max ? <span className="small"> · best {formatMark(s.best)}/{formatMark(s.max)}</span> : null}
                </button>
              ))}
              <button type="button" className={`pill${effectiveSet === "random" ? " pill-active" : ""}`} aria-pressed={effectiveSet === "random"} onClick={() => setSetChoice("random")}>
                New random
              </button>
            </div>
            <p className="small muted">
              {narrowing
                ? `Narrowed to ${chosenTopics.length} topic${chosenTopics.length === 1 ? "" : "s"}: you get a new random set of ${exam.questionCount} from them.`
                : exam.liveSets.length === 0
                  ? `No saved sets yet. A new random set of ${exam.questionCount} questions is used.`
                  : `${exam.questionCount} questions per set. Redoing a set shows your best score.`}
            </p>
          </div>

          <div className="between" style={{ flexWrap: "wrap", gap: 12 }}>
            {readHref ? (
              <Link href={readHref} className="btn">
                Read notes first
              </Link>
            ) : (
              <button type="button" className="btn" disabled title="These topics have no notes yet">
                Read notes first
              </button>
            )}
            <StartExamForm examId={exam.id} setId={effectiveSet} topicIds={chosenTopics.map((t) => t.id)} />
          </div>
        </>
      ) : null}
    </section>
  );

  return (
    <div className="dash-grid">
      {main}
      <aside className="dash-side stack">
        {side}
        <LeaderboardPanel examId={exam?.id} examName={exam?.name} />
      </aside>
    </div>
  );
}
