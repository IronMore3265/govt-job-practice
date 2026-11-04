import { notFound } from "next/navigation";
import Link from "@/components/NavLink";
import { ActionForm } from "@/components/ActionForm";
import { QuestionForm } from "@/components/QuestionForm";
import { isUuid } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import { deleteQuestion, resolveReport, saveQuestion } from "../actions";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

const dhakaTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Edit one question: its text, options, explanation, page and figure, plus the reports about it and the sets it is in.
export default async function EditQuestionPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { created } = await searchParams;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: question } = await supabase.from("question").select("*").eq("id", id).maybeSingle();
  if (!question) notFound();

  const [{ data: options }, { data: subjects }, { data: topics }, { data: figures }, { data: reports }, { data: sets }] = await Promise.all([
    supabase.from("mcq_option").select("label, text, is_correct, explanation").eq("question_id", id),
    supabase.from("subject").select("id, name").order("sort_order"),
    supabase.from("topic").select("id, subject_id, number, title").order("number"),
    supabase.from("figure").select("id, topic_id, label, page, caption").order("page"),
    supabase.from("question_report").select("id, note, status, user_id, created_at").eq("question_id", id).order("created_at", { ascending: false }),
    supabase.from("question_set").select("id, name, status, exam_id").contains("question_ids", [id]),
  ]);

  const examIds = [...new Set((sets ?? []).map((s) => s.exam_id))];
  const { data: exams } = examIds.length ? await supabase.from("exam").select("id, name").in("id", examIds) : { data: [] };
  const examName = new Map((exams ?? []).map((e) => [e.id, e.name]));
  const reporterIds = [...new Set((reports ?? []).map((r) => r.user_id))];
  const { data: people } = reporterIds.length ? await supabase.from("profile").select("id, name").in("id", reporterIds) : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, p.name]));

  const byLabel = new Map((options ?? []).map((o) => [o.label, o]));
  const correct = (options ?? []).find((o) => o.is_correct);

  return (
    <section className="stack" style={{ gap: 22 }}>
      <div className="stack-sm">
        <Link href="/admin/questions" className="small">
          Back to the question bank
        </Link>
        <h2 className="heading">
          Edit <span className="accent">Question</span>
        </h2>
        <div className="q-meta">
          <span className={question.status === "approved" ? "chip chip-done" : "chip chip-now"}>{question.status}</span>
          <span className="chip chip-muted">{question.origin === "import" ? "imported" : "added by hand"}</span>
        </div>
        {created ? <p className="form-msg" data-ok="true" role="status">Question added.</p> : null}
      </div>

      <div className="card-shadow">
        <QuestionForm
          key={question.id}
          action={saveQuestion}
          subjects={subjects ?? []}
          topics={topics ?? []}
          figures={figures ?? []}
          initial={{
            id: question.id,
            topic_id: question.topic_id,
            lang: question.lang,
            text: question.text,
            options: { A: byLabel.get("A")?.text ?? "", B: byLabel.get("B")?.text ?? "", C: byLabel.get("C")?.text ?? "", D: byLabel.get("D")?.text ?? "" },
            correct: correct?.label ?? "",
            explanation: correct?.explanation ?? "",
            source_page: question.source_page,
            figure_id: question.figure_id,
            status: question.status,
          }}
        />
      </div>

      <div className="stack-sm">
        <p className="label">Reports{(reports ?? []).filter((r) => r.status === "open").length ? ` · ${(reports ?? []).filter((r) => r.status === "open").length} open` : ""}</p>
        <div className="card rows">
          {(reports ?? []).length === 0 ? <p className="small muted">Nobody has reported this question.</p> : null}
          {(reports ?? []).map((r) => (
            <div key={r.id} className="row" style={{ flexWrap: "wrap" }}>
              <div>
                <p className="small">{r.note}</p>
                <p className="small muted">
                  {names.get(r.user_id) ?? "A member"} · {dhakaTime.format(new Date(r.created_at))} · {r.status}
                </p>
              </div>
              {r.status === "open" ? (
                <ActionForm action={resolveReport} submitLabel="Mark resolved" buttonClass="btn btn-small">
                  <input type="hidden" name="id" value={r.id} />
                </ActionForm>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="stack-sm">
        <p className="label">Used in sets</p>
        <div className="card rows">
          {(sets ?? []).length === 0 ? <p className="small muted">Not in any set yet.</p> : null}
          {(sets ?? []).map((s) => (
            <Link key={s.id} href={`/admin/sets/${s.id}`} className="row row-link">
              <span className="row-name">
                {examName.get(s.exam_id) ?? "Exam"}, {s.name}
              </span>
              <span className={s.status === "live" ? "chip chip-done" : "chip chip-now"}>{s.status}</span>
            </Link>
          ))}
        </div>
        <p className="small muted">Saving this question as a draft, or moving it to another topic, sends the live sets above back to draft.</p>
      </div>

      <div>
        <ActionForm action={deleteQuestion} submitLabel="Delete question" buttonClass="btn btn-small" confirmText="Delete this question? It is also removed from any set.">
          <input type="hidden" name="id" value={question.id} />
          <input type="hidden" name="then" value="list" />
        </ActionForm>
      </div>
    </section>
  );
}
