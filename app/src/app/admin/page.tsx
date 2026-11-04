import Link from "@/components/NavLink";
import { ActionForm } from "@/components/ActionForm";
import { createClient } from "@/lib/supabase/server";
import { EXAM_DEFAULTS, examSummary, formatDuration, formatMark, secondsPerQuestion } from "@/lib/exam";
import { addExam, deleteExam, updateExam } from "./actions";

type SearchParams = Promise<{ exam?: string }>;

// Exams tab: the saved recipes. Name, subject, topics, questions per set, marks, negative mark, time.
export default async function AdminExamsPage({ searchParams }: { searchParams: SearchParams }) {
  const { exam: examParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: subjects }, { data: topics }, { data: exams }] = await Promise.all([
    supabase.from("subject").select("id, name").order("sort_order"),
    supabase.from("topic").select("id, subject_id, number, title").order("number"),
    supabase.from("exam").select("*, exam_topic(topic_id)").order("sort_order"),
  ]);

  const subjectName = new Map((subjects ?? []).map((s) => [s.id, s.name]));
  const selected = (exams ?? []).find((e) => e.id === examParam);
  const selectedTopics = new Set(selected?.exam_topic.map((et) => et.topic_id) ?? []);
  // A subject exam picks from that subject's topics. A mixed exam picks from all, grouped by subject.
  const topicGroups = (subjects ?? [])
    .filter((s) => !selected?.subject_id || s.id === selected.subject_id)
    .map((s) => ({ subject: s, topics: (topics ?? []).filter((t) => t.subject_id === s.id) }));

  return (
    <section className="stack" style={{ gap: 22 }}>
      <div className="stack-sm">
        <h2 className="heading">
          Exams <span className="accent">{(exams ?? []).length}</span>
        </h2>
        <p className="small muted">
          Each exam is a recipe: its topics, how many questions per set, marks, negative marking and time. Defaults are{" "}
          {EXAM_DEFAULTS.questionCount} questions, {EXAM_DEFAULTS.marksPerQuestion} mark each, {EXAM_DEFAULTS.negativeMark} off per wrong answer and{" "}
          {EXAM_DEFAULTS.secondsPerQuestion} seconds per question.
        </p>
      </div>

      <div className="card rows">
        {(exams ?? []).length === 0 ? <p className="small muted">No exams yet.</p> : null}
        {(exams ?? []).map((e) => (
          <Link key={e.id} href={`/admin?exam=${e.id}`} className={`row row-link${e.id === selected?.id ? " exam-selected" : ""}`}>
            <span>
              <span className="row-name">{e.name}</span>{" "}
              <span className="small muted">{e.subject_id ? subjectName.get(e.subject_id) : "Mixed"}</span>
            </span>
            <span className="small">
              {examSummary(e, e.exam_topic.length)} · -{formatMark(e.negative_mark)}
            </span>
          </Link>
        ))}
      </div>

      {selected ? (
        <div className="card-shadow stack">
          <p className="label label-orange">Edit {selected.name}</p>
          <ActionForm action={updateExam} submitLabel="Save exam" buttonClass="btn btn-primary" className="stack" key={selected.id}>
            <input type="hidden" name="id" value={selected.id} />
            <div className="inline-form">
              <div className="field" style={{ width: 260 }}>
                <label className="label" htmlFor="exam-name">Name</label>
                <input id="exam-name" name="name" className="input input-sm" defaultValue={selected.name} maxLength={120} required />
              </div>
              <div className="field" style={{ width: 200 }}>
                <label className="label" htmlFor="exam-subject">Subject</label>
                <select id="exam-subject" name="subject_id" className="select input-sm" defaultValue={selected.subject_id ?? "mixed"}>
                  {(subjects ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                  <option value="mixed">Mixed (several subjects)</option>
                </select>
              </div>
            </div>
            <div className="inline-form">
              <div className="field">
                <label className="label" htmlFor="exam-count">Questions</label>
                <input id="exam-count" name="question_count" inputMode="numeric" className="input input-sm" defaultValue={selected.question_count} required />
              </div>
              <div className="field">
                <label className="label" htmlFor="exam-marks">Marks each</label>
                <input id="exam-marks" name="marks_per_question" inputMode="decimal" className="input input-sm" defaultValue={formatMark(selected.marks_per_question)} required />
              </div>
              <div className="field">
                <label className="label" htmlFor="exam-negative">Off per wrong</label>
                <input id="exam-negative" name="negative_mark" inputMode="decimal" className="input input-sm" defaultValue={formatMark(selected.negative_mark)} required />
              </div>
              <div className="field">
                <label className="label" htmlFor="exam-seconds">Seconds each</label>
                <input
                  id="exam-seconds"
                  name="seconds_per_question"
                  inputMode="decimal"
                  className="input input-sm"
                  defaultValue={secondsPerQuestion(selected.time_seconds, selected.question_count)}
                  required
                />
              </div>
            </div>
            <p className="small muted">
              Timer now: {formatDuration(selected.time_seconds)} for {selected.question_count} questions. The timer is seconds each times questions per set.
              Changing the number of questions sends this exam&apos;s live sets back to draft.
            </p>
            <div className="stack-sm">
              <p className="label">Topics in this exam</p>
              <p className="small muted">After changing the subject, save once to see that subject&apos;s topics here.</p>
              {topicGroups.map(({ subject, topics: list }) => (
                <div key={subject.id} className="stack-sm subject-section">
                  {selected.subject_id ? null : <p className="small muted">{subject.name}</p>}
                  <div className="checks">
                    {list.map((t) => (
                      <label key={t.id} className="check">
                        <input type="checkbox" name="topics" value={t.id} defaultChecked={selectedTopics.has(t.id)} />
                        {t.number}. {t.title}
                      </label>
                    ))}
                    {list.length === 0 ? (
                      <span className="small muted">
                        No topics in {subject.name} yet. Add them on the <Link href={`/admin/topics?subject=${subject.id}`}>Topics</Link> tab.
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </ActionForm>
          <ActionForm action={deleteExam} submitLabel="Delete exam" buttonClass="btn btn-small" confirmText={`Delete ${selected.name}? Its sets go too.`}>
            <input type="hidden" name="id" value={selected.id} />
          </ActionForm>
        </div>
      ) : (
        <p className="small muted">Pick an exam above to edit its topics and recipe.</p>
      )}

      <details className="card stack-sm">
        <summary className="label" style={{ cursor: "pointer" }}>Add exam</summary>
        <ActionForm action={addExam} submitLabel="Add exam" className="inline-form">
          <div className="field" style={{ width: 260 }}>
            <label className="label" htmlFor="add-exam-name">Name</label>
            <input id="add-exam-name" name="name" className="input input-sm" maxLength={120} placeholder="For example: BCS Preliminary Model" required />
          </div>
          <div className="field" style={{ width: 200 }}>
            <label className="label" htmlFor="add-exam-subject">Subject</label>
            <select id="add-exam-subject" name="subject_id" className="select input-sm" defaultValue={subjects?.[0]?.id ?? "mixed"}>
              {(subjects ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value="mixed">Mixed (several subjects)</option>
            </select>
          </div>
        </ActionForm>
      </details>
    </section>
  );
}
