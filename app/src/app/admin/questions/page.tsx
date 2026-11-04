import { ActionForm } from "@/components/ActionForm";
import { createClient } from "@/lib/supabase/server";
import { resolveReport } from "./actions";

const dhakaTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

// The question bank itself arrives in Phase 3. For now this tab lists open reports, so the bell has somewhere to go.
export default async function AdminQuestionsPage() {
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("question_report")
    .select("id, note, user_id, created_at, question(text)")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  const reporterIds = [...new Set((reports ?? []).map((r) => r.user_id))];
  const { data: people } = reporterIds.length ? await supabase.from("profile").select("id, name").in("id", reporterIds) : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, p.name]));

  return (
    <section className="stack" style={{ gap: 22 }}>
      <div className="stack-sm">
        <h2 className="heading">
          Question <span className="accent">Bank</span>
        </h2>
        <p className="small muted">The bank screens (filter, edit, add) arrive in Phase 3. Reported questions show here until then.</p>
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
              <ActionForm action={resolveReport} submitLabel="Mark resolved" buttonClass="btn btn-small">
                <input type="hidden" name="id" value={r.id} />
              </ActionForm>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
