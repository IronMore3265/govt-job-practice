"use client";

import { useState } from "react";
import { examSummary, formatMark } from "@/lib/exam";

export type TopicView = { id: string; number: number; title: string };
export type ExamView = {
  id: string;
  name: string;
  questionCount: number;
  timeSeconds: number;
  negativeMark: number;
  topics: TopicView[];
  liveSets: { id: string; name: string }[];
};
export type SubjectView = { id: string; name: string; exams: ExamView[] };

// Home (mockup frame 1): subject, exam, topics (all preselected, tap to narrow), set, then
// "Read notes first" and "Start exam". The notes viewer arrives in Phase 4 and the exam itself in Phase 5,
// so both buttons stay off for now.
export function HomePicker({ subjects }: { subjects: SubjectView[] }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const subject = subjects.find((s) => s.id === subjectId) ?? subjects[0];
  const [examId, setExamId] = useState(subject?.exams[0]?.id ?? "");
  const exam = subject?.exams.find((e) => e.id === examId) ?? subject?.exams[0];
  // The topics the student narrowed the scope to. Empty means all of the exam's topics.
  const [narrowed, setNarrowed] = useState<string[]>([]);

  if (!subject) return <p className="small muted">No subjects yet. The admin adds them in the portal.</p>;

  function pickSubject(id: string) {
    setSubjectId(id);
    setExamId(subjects.find((s) => s.id === id)?.exams[0]?.id ?? "");
    setNarrowed([]);
  }

  function toggleTopic(id: string) {
    setNarrowed((cur) => (cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]));
  }

  const chosen = exam ? exam.topics.filter((t) => narrowed.includes(t.id)) : [];

  return (
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
                <button type="button" className={`pill${chosen.length === 0 ? " pill-active" : ""}`} aria-pressed={chosen.length === 0} onClick={() => setNarrowed([])}>
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
            {exam.liveSets.length === 0 ? (
              <p className="small muted">No sets yet. Sets of {exam.questionCount} questions appear here once questions are imported.</p>
            ) : (
              <div className="wrap">
                {exam.liveSets.map((s) => (
                  <span key={s.id} className="pill">
                    {s.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="between">
            <button type="button" className="btn" disabled title="The note viewer arrives in Phase 4">
              Read notes first
            </button>
            <button type="button" className="btn btn-primary" disabled title="Exams open in Phase 5">
              Start exam
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
