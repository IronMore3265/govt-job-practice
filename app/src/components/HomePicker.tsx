"use client";

import { useState, type ReactNode } from "react";
import Link from "@/components/NavLink";
import { LeaderboardPanel } from "@/components/LeaderboardPanel";
import { StartExamForm } from "@/components/StartExamForm";
import { TopicDropdown } from "@/components/TopicDropdown";
import { examSummary, formatMark } from "@/lib/exam";
import { noteHref } from "@/lib/notes";

export type TopicView = { id: string; number: number; title: string; hasNote: boolean };
export type SetView = { id: string; name: string; best: number | null; max: number | null };
export type TopicSetView = { topicId: string; chunk: number; size: number; best: number | null; max: number | null; tries: number };
export type ExamView = {
  id: string;
  name: string;
  questionCount: number;
  timeSeconds: number;
  negativeMark: number;
  topics: TopicView[];
  liveSets: SetView[];
  // Topic practice exams: the topic's questions in written order, cut into sets of questionCount.
  allTopics: boolean;
  topicSets: TopicSetView[];
};
export type SubjectView = { id: string; name: string; exams: ExamView[] };

// Home (mockup frame 1): subject, exam, topics (all preselected, tap to narrow), set (Set 1, 2, 3, new random), then
// "Read notes first" and "Start exam". Narrowing the topics means a new random set from just those topics, because a saved
// set is a fixed list. The leaderboard sits in the side column next to the invite panel.
export function HomePicker({ subjects, side }: { subjects: SubjectView[]; side?: ReactNode }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const subject = subjects.find((s) => s.id === subjectId) ?? subjects[0];
  // Model tests (exams that are not topic practice) are greyed out as "Coming soon" until all topics have questions.
  const firstOpen = (s?: SubjectView) => (s?.exams.find((e) => e.allTopics) ?? s?.exams[0])?.id ?? "";
  const [examId, setExamId] = useState(firstOpen(subject));
  const exam = subject?.exams.find((e) => e.id === examId) ?? subject?.exams.find((e) => e.allTopics);
  // The topics the student narrowed the scope to. Empty means all of the exam's topics.
  const [narrowed, setNarrowed] = useState<string[]>([]);
  // A saved set id, "random" for a new random set, or "" for the exam's first live set.
  const [setChoice, setSetChoice] = useState("");

  function pickSubject(id: string) {
    setSubjectId(id);
    setExamId(firstOpen(subjects.find((s) => s.id === id)));
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
              style={e.allTopics ? undefined : { opacity: 0.5, filter: "grayscale(1)", cursor: "not-allowed", boxShadow: "none" }}
              disabled={!e.allTopics}
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
              <span className="chip">{e.allTopics ? `-${formatMark(e.negativeMark)}` : "Coming soon"}</span>
            </button>
          ))}
        </div>
      </div>

      {exam && exam.allTopics ? <PracticePicker key={exam.id} exam={exam} /> : null}

      {exam && !exam.allTopics ? (
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

function setLabel(t: TopicSetView) {
  return t.tries > 0 && t.best !== null && t.max ? `Set ${t.chunk}, best ${formatMark(t.best)} of ${formatMark(t.max)}` : `Set ${t.chunk}`;
}

// One line about the selected set, so the set buttons can stay plain numbers.
function setDetail(t: TopicSetView, fullSize: number) {
  const parts: string[] = [];
  if (t.size < fullSize) parts.push(`${t.size} questions`);
  if (t.tries > 0 && t.best !== null && t.max) parts.push(`best ${formatMark(t.best)}/${formatMark(t.max)}`);
  return `Set ${t.chunk}: ${parts.length ? parts.join(", ") : "not tried yet"}`;
}

// Topic practice: pick one topic, then one of its sets. Set 1 is the first questions of the topic as they were written, Set 2 the
// next ones, and so on, so finishing every set means every question of the topic has been asked.
// Only topics with questions are listed, in a dropdown, so the picker stays small however many topics and sets a subject has.
function PracticePicker({ exam }: { exam: ExamView }) {
  const hasSets = new Set(exam.topicSets.map((t) => t.topicId));
  const [topicId, setTopicId] = useState(exam.topics.find((t) => hasSets.has(t.id))?.id ?? "");
  const [picked, setPicked] = useState<number | null>(null);

  const ready = exam.topics.filter((t) => hasSets.has(t.id));
  const topic = exam.topics.find((t) => t.id === topicId);
  const sets = exam.topicSets.filter((t) => t.topicId === topicId).sort((a, b) => a.chunk - b.chunk);
  const firstNew = sets.find((t) => t.tries === 0)?.chunk ?? sets[0]?.chunk ?? null;
  const chunk = picked !== null && sets.some((t) => t.chunk === picked) ? picked : firstNew;
  const current = sets.find((t) => t.chunk === chunk);
  const done = sets.filter((t) => t.tries > 0).length;
  const progress = (id: string) => {
    const all = exam.topicSets.filter((t) => t.topicId === id);
    return `${all.filter((t) => t.tries > 0).length}/${all.length}`;
  };
  const readHref = topic?.hasNote && chunk ? noteHref(topic.id, { topics: [topic.id], exam: exam.id, chunk, narrow: true }) : null;

  if (exam.topics.length === 0 || hasSets.size === 0) {
    return <p className="small muted">No questions in this exam yet. The admin adds them in the portal.</p>;
  }

  return (
    <>
      <div className="stack-sm">
        <p className="label" id="practice-topic">
          Topic
        </p>
        <TopicDropdown
          labelId="practice-topic"
          options={ready.map((t) => ({ id: t.id, title: t.title, progress: progress(t.id) }))}
          value={topicId}
          onChange={(id) => {
            setTopicId(id);
            setPicked(null);
          }}
        />
        {ready.length < exam.topics.length ? (
          <p className="small muted">
            {ready.length} of {exam.topics.length} topics ready. More coming soon.
          </p>
        ) : null}
      </div>

      <div className="stack-sm">
        <p className="label">Set</p>
        <div className="set-grid">
          {sets.map((t) => (
            <button
              key={t.chunk}
              type="button"
              className={`set-num${t.tries > 0 ? " set-num-done" : ""}`}
              aria-pressed={chunk === t.chunk}
              aria-label={setLabel(t)}
              onClick={() => setPicked(t.chunk)}
            >
              {t.chunk}
            </button>
          ))}
        </div>
        {current ? <p className="small">{setDetail(current, exam.questionCount)}</p> : null}
        <p className="small muted">
          {done} of {sets.length} sets done (orange).
        </p>
      </div>

      <div className="between" style={{ flexWrap: "wrap", gap: 12 }}>
        {readHref ? (
          <Link href={readHref} className="btn">
            Read notes first
          </Link>
        ) : (
          <button type="button" className="btn" disabled title="This topic has no note yet">
            Read notes first
          </button>
        )}
        <StartExamForm examId={exam.id} topicIds={topic ? [topic.id] : []} chunk={chunk} disabled={!topic || !chunk} />
      </div>
    </>
  );
}
