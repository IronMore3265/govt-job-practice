import { notFound } from "next/navigation";
import Link from "@/components/NavLink";
import { ActionForm } from "@/components/ActionForm";
import { MathInlineText } from "@/components/MathText";
import { examSummary } from "@/lib/exam";
import { chunk } from "@/lib/paging";
import { escapeLike, filterHref, isUuid } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import { spreadSummary } from "@/lib/sets";
import { addToSet, deleteSet, fillSet, removeFromSet, renameSet, setSetStatus } from "../actions";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ topic?: string; q?: string }> };

const AVAILABLE_LIMIT = 30;

// One set: rename it, put it live or back to draft, see its questions in order, remove some, add more by hand or fill
// it automatically from the exam's unused questions.
export default async function SetEditorPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: set } = await supabase.from("question_set").select("id, exam_id, name, origin, status, question_ids").eq("id", id).maybeSingle();
  if (!set) notFound();

  const [{ data: exam }, { data: allSets }, { data: topics }] = await Promise.all([
    supabase.from("exam").select("id, name, question_count, time_seconds, exam_topic(topic_id)").eq("id", set.exam_id).single(),
    supabase.from("question_set").select("id, name, question_ids").eq("exam_id", set.exam_id),
    supabase.from("topic").select("id, number, title"),
  ]);
  if (!exam) notFound();

  const size = exam.question_count;
  const examTopicIds = exam.exam_topic.map((t) => t.topic_id);
  const examTopics = (topics ?? []).filter((t) => examTopicIds.includes(t.id)).sort((a, b) => a.number - b.number);
  const topicNumber = new Map((topics ?? []).map((t) => [t.id, t.number]));
  const topicFilter = isUuid(sp.topic) && examTopicIds.includes(sp.topic) ? sp.topic : null;
  const search = (sp.q ?? "").trim().slice(0, 100);

  // The questions in this set, kept in the set's own order.
  const rows = (
    await Promise.all(chunk(set.question_ids, 50).map((ids) => supabase.from("question").select("id, topic_id, text, status, source_page").in("id", ids)))
  ).flatMap((r) => r.data ?? []);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = set.question_ids.map((qid) => byId.get(qid)).filter((r): r is NonNullable<typeof r> => Boolean(r));
  const notApproved = ordered.filter((q) => q.status !== "approved").length;

  // Questions that can be added: approved, from the exam's topics, not in this set. Others' set names are shown.
  let available: { id: string; topic_id: string; text: string; source_page: number | null }[] = [];
  if (examTopicIds.length && set.question_ids.length < size) {
    let q = supabase
      .from("question")
      .select("id, topic_id, text, source_page")
      .eq("status", "approved")
      .in("topic_id", topicFilter ? [topicFilter] : examTopicIds)
      .order("source_page", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(AVAILABLE_LIMIT + set.question_ids.length);
    if (search) q = q.ilike("text", `%${escapeLike(search)}%`);
    const inThis = new Set(set.question_ids);
    available = ((await q).data ?? []).filter((r) => !inThis.has(r.id)).slice(0, AVAILABLE_LIMIT);
  }
  const otherSet = new Map<string, string>();
  for (const s of allSets ?? []) if (s.id !== set.id) for (const qid of s.question_ids) otherSet.set(qid, s.name);

  const full = set.question_ids.length === size;
  const base = `/admin/sets/${set.id}`;

  return (
    <section className="stack" style={{ gap: 22 }}>
      <div className="stack-sm">
        <Link href={`/admin/sets?exam=${exam.id}`} className="small">
          Back to the sets of {exam.name}
        </Link>
        <h2 className="heading">
          {exam.name}, <span className="accent">{set.name}</span>
        </h2>
        <div className="q-meta">
          <span className={set.status === "live" ? "chip chip-done" : "chip chip-now"}>{set.status}</span>
          <span className="chip chip-muted">{set.origin}</span>
          <span className={full ? "chip" : "chip chip-muted"}>
            {set.question_ids.length} of {size}
          </span>
          <span className="small muted">{examSummary(exam, examTopicIds.length)}</span>
        </div>
        {notApproved ? <p className="form-msg" data-ok="false">{notApproved} question{notApproved === 1 ? " is" : "s are"} not approved, so this set cannot go live until they are approved or removed.</p> : null}
      </div>

      <div className="card stack-sm">
        <div className="q-actions">
          {set.status === "draft" ? (
            <ActionForm action={setSetStatus} submitLabel="Go live" buttonClass="btn btn-primary">
              <input type="hidden" name="id" value={set.id} />
              <input type="hidden" name="status" value="live" />
            </ActionForm>
          ) : (
            <ActionForm action={setSetStatus} submitLabel="Back to draft" buttonClass="btn">
              <input type="hidden" name="id" value={set.id} />
              <input type="hidden" name="status" value="draft" />
            </ActionForm>
          )}
          {!full ? (
            <ActionForm action={fillSet} submitLabel="Fill from unused questions" buttonClass="btn">
              <input type="hidden" name="id" value={set.id} />
            </ActionForm>
          ) : null}
          <ActionForm
            action={deleteSet}
            submitLabel="Delete set"
            buttonClass="btn btn-small"
            confirmText={`Delete ${set.name}? Its questions become free to use again. Scores students earned on it stay in their history.`}
          >
            <input type="hidden" name="id" value={set.id} />
            <input type="hidden" name="then" value="list" />
          </ActionForm>
        </div>
        <ActionForm action={renameSet} submitLabel="Rename" buttonClass="btn btn-small" className="inline-form" key={`${set.id}-${set.name}`}>
          <input type="hidden" name="id" value={set.id} />
          <div className="field" style={{ width: 260 }}>
            <label className="label" htmlFor="set-name">Set name</label>
            <input id="set-name" name="name" className="input input-sm" defaultValue={set.name} maxLength={60} required />
          </div>
        </ActionForm>
        <p className="small muted">
          Spread: {spreadSummary(ordered.map((q) => topicNumber.get(q.topic_id)).filter((n): n is number => n !== undefined)) || "no questions yet"}.
        </p>
      </div>

      <div className="stack-sm">
        <p className="label">Questions in this set</p>
        <div className="card rows">
          {ordered.length === 0 ? <p className="small muted">Empty. Add questions below, or fill it from the unused questions.</p> : null}
          {ordered.map((q, i) => (
            <div key={q.id} className="row q-row">
              <div className="q-main">
                <Link href={`/admin/questions/${q.id}`} className="q-clamp">
                  {i + 1}. <MathInlineText text={q.text} />
                </Link>
                <div className="q-meta">
                  <span className="chip">T{topicNumber.get(q.topic_id) ?? "?"}</span>
                  <span className="chip chip-muted">{q.source_page ? `page ${q.source_page}` : "no page"}</span>
                  {q.status !== "approved" ? <span className="chip chip-now">not approved</span> : null}
                </div>
              </div>
              <ActionForm action={removeFromSet} submitLabel="Remove" buttonClass="btn btn-small">
                <input type="hidden" name="id" value={set.id} />
                <input type="hidden" name="question_id" value={q.id} />
              </ActionForm>
            </div>
          ))}
        </div>
      </div>

      {!full ? (
        <div className="stack-sm">
          <p className="label">Add questions by hand</p>
          <div className="wrap">
            <Link href={filterHref(base, { q: search })} className="pill" aria-current={!topicFilter ? "page" : undefined}>
              All topics
            </Link>
            {examTopics.map((t) => (
              <Link key={t.id} href={filterHref(base, { topic: t.id, q: search })} className="pill" aria-current={t.id === topicFilter ? "page" : undefined}>
                {t.number}. {t.title}
              </Link>
            ))}
          </div>
          <form method="get" action={base} className="inline-form">
            {topicFilter ? <input type="hidden" name="topic" value={topicFilter} /> : null}
            <div className="field" style={{ width: 280 }}>
              <label className="label" htmlFor="add-search">Search the question text</label>
              <input id="add-search" name="q" className="input input-sm" defaultValue={search} maxLength={100} />
            </div>
            <button type="submit" className="btn btn-small">
              Search
            </button>
          </form>

          <ActionForm action={addToSet} submitLabel="Add ticked questions" buttonClass="btn btn-primary" className="stack-sm">
            <input type="hidden" name="id" value={set.id} />
            <div className="card rows">
              {available.length === 0 ? <p className="small muted">No approved questions to add here. Approve some in the question bank, or change the filter.</p> : null}
              {available.map((q) => (
                <label key={q.id} className="row q-row" style={{ cursor: "pointer" }}>
                  <input type="checkbox" name="q" value={q.id} style={{ marginTop: 4 }} aria-label="Add this question" />
                  <span className="q-main">
                    <span className="q-clamp">
                      <MathInlineText text={q.text} />
                    </span>
                    <span className="q-meta">
                      <span className="chip">T{topicNumber.get(q.topic_id) ?? "?"}</span>
                      <span className="chip chip-muted">{q.source_page ? `page ${q.source_page}` : "no page"}</span>
                      {otherSet.has(q.id) ? <span className="chip chip-muted">also in {otherSet.get(q.id)}</span> : null}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {available.length === AVAILABLE_LIMIT ? <p className="small muted">Showing the first {AVAILABLE_LIMIT}. Pick a topic or search to narrow the list.</p> : null}
          </ActionForm>
        </div>
      ) : null}
    </section>
  );
}
