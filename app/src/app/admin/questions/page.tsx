import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "@/components/NavLink";
import { ActionForm } from "@/components/ActionForm";
import { MathInlineText } from "@/components/MathText";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, filterHref, pageCount, PAGE_SIZE, parseFilters, type QuestionFilters } from "@/lib/questions";
import { approveDrafts, deleteQuestion, resolveReport, setQuestionStatus } from "./actions";

const dhakaTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Question bank: filter by subject, topic, status, language and words; approve, edit, delete, add. Open reports stay at
// the top because the bell links here.
export default async function AdminQuestionsPage({ searchParams }: { searchParams: SearchParams }) {
  const f = parseFilters(await searchParams);
  const supabase = await createClient();

  const [{ data: subjects }, { data: topics }, { data: reports }] = await Promise.all([
    supabase.from("subject").select("id, name").order("sort_order"),
    supabase.from("topic").select("id, subject_id, number, title").order("number"),
    supabase
      .from("question_report")
      .select("id, note, user_id, question_id, created_at, question(text)")
      .eq("status", "open")
      .order("created_at", { ascending: false }),
  ]);

  const subject = (subjects ?? []).find((s) => s.id === f.subject) ?? null;
  const topicRows = (topics ?? []).filter((t) => !subject || t.subject_id === subject.id);
  const topicNumber = new Map((topics ?? []).map((t) => [t.id, t.number]));

  // The same filters feed the list and the two counts above it (the status filter is left out of the counts).
  const base = () => {
    let q = supabase.from("question").select("id", { count: "exact", head: true });
    if (f.subject) q = q.eq("subject_id", f.subject);
    if (f.topic) q = q.eq("topic_id", f.topic);
    if (f.lang !== "all") q = q.eq("lang", f.lang);
    if (f.q) q = q.ilike("text", `%${escapeLike(f.q)}%`);
    return q;
  };
  let list = supabase
    .from("question")
    .select("id, topic_id, lang, text, status, source_page, origin, figure_id", { count: "exact" })
    .order("source_page", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .range((f.page - 1) * PAGE_SIZE, f.page * PAGE_SIZE - 1);
  if (f.subject) list = list.eq("subject_id", f.subject);
  if (f.topic) list = list.eq("topic_id", f.topic);
  if (f.status !== "all") list = list.eq("status", f.status);
  if (f.lang !== "all") list = list.eq("lang", f.lang);
  if (f.q) list = list.ilike("text", `%${escapeLike(f.q)}%`);

  const [{ data: questions, count }, { count: draftCount }, { count: approvedCount }] = await Promise.all([
    list,
    base().eq("status", "draft"),
    base().eq("status", "approved"),
  ]);

  const total = count ?? 0;
  const pages = pageCount(total);
  const reporterIds = [...new Set((reports ?? []).map((r) => r.user_id))];
  const { data: people } = reporterIds.length ? await supabase.from("profile").select("id, name").in("id", reporterIds) : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, p.name]));

  const link = (over: Partial<QuestionFilters>) => filterHref("/admin/questions", { ...f, page: 1, ...over });

  return (
    <section className="stack" style={{ gap: 22 }}>
      <div className="between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="stack-sm">
          <h2 className="heading">
            Question <span className="accent">Bank</span>
          </h2>
          <p className="small muted">
            {approvedCount ?? 0} approved · {draftCount ?? 0} draft. Only approved questions reach students.
          </p>
        </div>
        <Link href="/admin/questions/new" className="btn btn-primary">
          Add question
        </Link>
      </div>

      <div className="stack-sm" id="reports">
        <p className="label">Open reports{reports?.length ? ` · ${reports.length}` : ""}</p>
        <div className="card rows">
          {(reports ?? []).length === 0 ? <p className="small muted">No open reports.</p> : null}
          {(reports ?? []).map((r) => (
            <div key={r.id} className="row" style={{ flexWrap: "wrap" }}>
              <div>
                <p className="row-name">{r.question?.text}</p>
                <p className="small">{r.note}</p>
                <p className="small muted">
                  {names.get(r.user_id) ?? "A member"} · {dhakaTime.format(new Date(r.created_at))}
                </p>
              </div>
              <div className="q-actions">
                <Link href={`/admin/questions/${r.question_id}`} className="btn btn-small">
                  Open question
                </Link>
                <ActionForm action={resolveReport} submitLabel="Mark resolved" buttonClass="btn btn-small">
                  <input type="hidden" name="id" value={r.id} />
                </ActionForm>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="stack-sm">
        <p className="label">Filter</p>
        <div className="wrap">
          <Link href={link({ subject: null, topic: null })} className="pill" aria-current={!f.subject ? "page" : undefined}>
            All subjects
          </Link>
          {(subjects ?? []).map((s) => (
            <Link key={s.id} href={link({ subject: s.id, topic: null })} className="pill" aria-current={s.id === f.subject ? "page" : undefined}>
              {s.name}
            </Link>
          ))}
        </div>
        {topicRows.length ? (
          <div className="wrap">
            <Link href={link({ topic: null })} className="pill" aria-current={!f.topic ? "page" : undefined}>
              All topics
            </Link>
            {topicRows.map((t) => (
              <Link key={t.id} href={link({ subject: t.subject_id, topic: t.id })} className="pill" aria-current={t.id === f.topic ? "page" : undefined}>
                {t.number}. {t.title}
              </Link>
            ))}
          </div>
        ) : null}
        <div className="wrap">
          {(["all", "draft", "approved"] as const).map((s) => (
            <Link key={s} href={link({ status: s })} className="pill" aria-current={f.status === s ? "page" : undefined}>
              {s === "all" ? "Any status" : s === "draft" ? `Draft · ${draftCount ?? 0}` : `Approved · ${approvedCount ?? 0}`}
            </Link>
          ))}
          {(["all", "en", "bn"] as const).map((l) => (
            <Link key={l} href={link({ lang: l })} className="pill" aria-current={f.lang === l ? "page" : undefined}>
              {l === "all" ? "Any language" : l === "en" ? "English" : "Bangla"}
            </Link>
          ))}
        </div>
        <form method="get" action="/admin/questions" className="inline-form">
          {f.subject ? <input type="hidden" name="subject" value={f.subject} /> : null}
          {f.topic ? <input type="hidden" name="topic" value={f.topic} /> : null}
          {f.status !== "all" ? <input type="hidden" name="status" value={f.status} /> : null}
          {f.lang !== "all" ? <input type="hidden" name="lang" value={f.lang} /> : null}
          <div className="field" style={{ width: 280 }}>
            <label className="label" htmlFor="q-search">Search the question text</label>
            <input id="q-search" name="q" className="input input-sm" defaultValue={f.q} maxLength={100} />
          </div>
          <button type="submit" className="btn btn-small">
            Search
          </button>
        </form>
      </div>

      <div className="stack-sm">
        <div className="between" style={{ flexWrap: "wrap", gap: 12 }}>
          <p className="label">
            {total} question{total === 1 ? "" : "s"}
            {pages > 1 ? ` · page ${Math.min(f.page, pages)} of ${pages}` : ""}
          </p>
          {draftCount ? (
            <ActionForm
              action={approveDrafts}
              submitLabel={`Approve all ${draftCount} drafts`}
              buttonClass="btn btn-small"
              confirmText={`Approve all ${draftCount} drafts that match this filter? Check them first: approved questions are visible to students.`}
            >
              <input type="hidden" name="subject" value={f.subject ?? ""} />
              <input type="hidden" name="topic" value={f.topic ?? ""} />
              <input type="hidden" name="lang" value={f.lang} />
              <input type="hidden" name="q" value={f.q} />
            </ActionForm>
          ) : null}
        </div>

        <div className="card rows">
          {(questions ?? []).length === 0 ? <p className="small muted">No questions match. Import some with the import tool, or add one by hand.</p> : null}
          {(questions ?? []).map((q) => (
            <div key={q.id} className="row q-row">
              <div className="q-main">
                <Link href={`/admin/questions/${q.id}`} className="q-clamp">
                  <MathInlineText text={q.text} />
                </Link>
                <div className="q-meta">
                  <span className={q.status === "approved" ? "chip chip-done" : "chip chip-now"}>{q.status}</span>
                  <span className="chip">T{topicNumber.get(q.topic_id) ?? "?"}</span>
                  <span className="chip chip-muted">{q.lang === "bn" ? "Bangla" : "English"}</span>
                  <span className="chip chip-muted">{q.source_page ? `page ${q.source_page}` : "no page"}</span>
                  {q.figure_id ? <span className="chip chip-muted">figure</span> : null}
                  {q.origin === "import" ? <span className="chip chip-muted">imported</span> : null}
                </div>
              </div>
              <div className="q-actions">
                <Link href={`/admin/questions/${q.id}`} className="btn btn-small">
                  Edit
                </Link>
                <ActionForm action={setQuestionStatus} submitLabel={q.status === "approved" ? "To draft" : "Approve"} buttonClass="btn btn-small">
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="status" value={q.status === "approved" ? "draft" : "approved"} />
                </ActionForm>
                <ActionForm action={deleteQuestion} submitLabel="Delete" buttonClass="btn btn-small" confirmText="Delete this question? It is also removed from any set.">
                  <input type="hidden" name="id" value={q.id} />
                </ActionForm>
              </div>
            </div>
          ))}
        </div>

        {pages > 1 ? (
          <div className="pager">
            {f.page > 1 ? (
              <Link href={filterHref("/admin/questions", { ...f, page: f.page - 1 })} className="btn btn-small" aria-label="Previous page">
                <ChevronLeft size={16} strokeWidth={2} aria-hidden />
              </Link>
            ) : null}
            {f.page < pages ? (
              <Link href={filterHref("/admin/questions", { ...f, page: f.page + 1 })} className="btn btn-small" aria-label="Next page">
                <ChevronRight size={16} strokeWidth={2} aria-hidden />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
