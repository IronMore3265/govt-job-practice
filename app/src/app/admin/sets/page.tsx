import Link from "@/components/NavLink";
import { ActionForm } from "@/components/ActionForm";
import { examSummary } from "@/lib/exam";
import { fetchAll } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";
import { missingForLastSet, spreadSummary } from "@/lib/sets";
import { addCuratedSet, buildSets, deleteSet, setSetStatus } from "./actions";

type SearchParams = Promise<{ exam?: string }>;

// Sets tab: for each exam, the saved sets of 20 questions (or the exam's own size), how full they are, and the builder.
// Students see live sets only. A short last set stays a draft until its missing questions are imported.
export default async function AdminSetsPage({ searchParams }: { searchParams: SearchParams }) {
  const { exam: examParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: exams }, { data: topics }] = await Promise.all([
    supabase.from("exam").select("id, name, subject_id, question_count, time_seconds, exam_topic(topic_id)").order("sort_order"),
    supabase.from("topic").select("id, number, title"),
  ]);
  const exam = (exams ?? []).find((e) => e.id === examParam) ?? exams?.[0] ?? null;
  const topicIds = exam?.exam_topic.map((t) => t.topic_id) ?? [];
  const topicNumber = new Map((topics ?? []).map((t) => [t.id, t.number]));

  const [{ data: sets }, approved, drafts] = exam
    ? await Promise.all([
        supabase.from("question_set").select("id, name, origin, status, question_ids, created_at").eq("exam_id", exam.id).order("created_at", { ascending: true }),
        topicIds.length
          ? fetchAll<{ id: string; topic_id: string }>((from, to) =>
              supabase.from("question").select("id, topic_id").eq("status", "approved").in("topic_id", topicIds).order("id").range(from, to),
            )
          : Promise.resolve([] as { id: string; topic_id: string }[]),
        topicIds.length
          ? supabase.from("question").select("id", { count: "exact", head: true }).eq("status", "draft").in("topic_id", topicIds)
          : Promise.resolve({ count: 0 }),
      ])
    : [{ data: [] }, [], { count: 0 }];

  const size = exam?.question_count ?? 20;
  const topicOfQuestion = new Map(approved.map((q) => [q.id, q.topic_id]));
  const inSets = new Set((sets ?? []).flatMap((s) => s.question_ids));
  const unused = approved.filter((q) => !inSets.has(q.id)).length;
  const live = (sets ?? []).filter((s) => s.status === "live").length;

  return (
    <section className="stack" style={{ gap: 22 }}>
      <div className="stack-sm">
        <h2 className="heading">
          Question <span className="accent">Sets</span>
        </h2>
        <p className="small muted">
          A set is a saved list of questions for one exam. It goes live only when it has exactly the exam&apos;s question count of approved questions from the exam&apos;s topics.
          Students see live sets only.
        </p>
      </div>

      <div className="stack-sm">
        <p className="label">Exam</p>
        <div className="wrap">
          {(exams ?? []).map((e) => (
            <Link key={e.id} href={`/admin/sets?exam=${e.id}`} className="pill" aria-current={e.id === exam?.id ? "page" : undefined}>
              {e.name}
            </Link>
          ))}
        </div>
      </div>

      {exam ? (
        <>
          <div className="card stack-sm">
            <p className="row-name">{exam.name}</p>
            <p className="small muted">{examSummary(exam, topicIds.length)}</p>
            {topicIds.length === 0 ? (
              <p className="small">
                This exam has no topics yet. Link its topics on the <Link href={`/admin?exam=${exam.id}`}>Exams tab</Link>, then come back to build sets.
              </p>
            ) : (
              <p className="small">
                <b>{approved.length}</b> approved questions · <b>{inSets.size}</b> in sets · <b>{unused}</b> unused
                {drafts.count ? ` · ${drafts.count} drafts not approved yet` : ""}. {live} live set{live === 1 ? "" : "s"}.
                {missingForLastSet(approved.length, size) > 0 ? ` The last set needs ${missingForLastSet(approved.length, size)} more approved questions to be full.` : " Every set can be full."}
              </p>
            )}
            <ActionForm action={buildSets} submitLabel="Build sets from unused questions" buttonClass="btn btn-primary" className="stack-sm">
              <input type="hidden" name="exam_id" value={exam.id} />
            </ActionForm>
            <p className="small muted">
              Tops up short draft sets first, then cuts the rest into sets of {size}, with every topic spread through each set. Full sets go live. Run it again after importing more questions.
            </p>
          </div>

          <div className="stack-sm">
            <p className="label">Sets, {exam.name}</p>
            <div className="card rows">
              {(sets ?? []).length === 0 ? <p className="small muted">No sets yet. Build them above or add a curated set below.</p> : null}
              {(sets ?? []).map((s) => {
                const n = s.question_ids.length;
                const numbers = s.question_ids.map((id) => topicNumber.get(topicOfQuestion.get(id) ?? "")).filter((x): x is number => x !== undefined);
                return (
                  <div key={s.id} className="row q-row">
                    <div className="q-main">
                      <Link href={`/admin/sets/${s.id}`} className="row-name">
                        {s.name}
                      </Link>
                      <div className="q-meta">
                        <span className={s.status === "live" ? "chip chip-done" : "chip chip-now"}>{s.status}</span>
                        <span className="chip chip-muted">{s.origin}</span>
                        <span className={n === size ? "chip" : "chip chip-muted"}>
                          {n} of {size}
                        </span>
                        {numbers.length ? <span className="small muted">{spreadSummary(numbers)}</span> : null}
                      </div>
                    </div>
                    <div className="q-actions">
                      <Link href={`/admin/sets/${s.id}`} className="btn btn-small">
                        Open
                      </Link>
                      {s.status === "draft" && n === size ? (
                        <ActionForm action={setSetStatus} submitLabel="Go live" buttonClass="btn btn-small">
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="status" value="live" />
                        </ActionForm>
                      ) : null}
                      <ActionForm
                        action={deleteSet}
                        submitLabel="Delete"
                        buttonClass="btn btn-small"
                        confirmText={`Delete ${s.name}? Its questions become free to use again. Scores students earned on it stay in their history.`}
                      >
                        <input type="hidden" name="id" value={s.id} />
                      </ActionForm>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <details className="card stack-sm">
            <summary className="label" style={{ cursor: "pointer" }}>Add a curated set</summary>
            <p className="small muted">A curated set is picked by hand, for example a mock paper. It starts empty and goes live once it has {size} questions.</p>
            <ActionForm action={addCuratedSet} submitLabel="Create set" className="inline-form">
              <input type="hidden" name="exam_id" value={exam.id} />
              <div className="field" style={{ width: 260 }}>
                <label className="label" htmlFor="curated-name">Set name</label>
                <input id="curated-name" name="name" className="input input-sm" maxLength={60} required />
              </div>
            </ActionForm>
          </details>
        </>
      ) : (
        <p className="small muted">No exams yet. Add one on the Exams tab.</p>
      )}
    </section>
  );
}
