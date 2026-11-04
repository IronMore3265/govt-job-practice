import { ActionForm } from "@/components/ActionForm";
import { formatBytes, LIMITS_BYTES, usageNote, usagePercent } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { setLeaderboard } from "./actions";

type Usage = { db_bytes: number; buckets: { bucket: string; files: number; bytes: number }[] };

const EXPORTS = [
  { group: "content", title: "Content", detail: "Subjects, topics, exams, questions, options with answers and explanations, sets, figures (file names only)." },
  { group: "people", title: "People", detail: "Profiles, invites and reading progress. Contains names and email addresses." },
  { group: "activity", title: "Activity", detail: "Exam sessions, attempts, question reports and notifications. Private student data." },
] as const;

// Settings tab: the leaderboard switch, storage usage against the free plan limits, and the data export (the free plan has
// no restore points to rely on, so this is the backup).
export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const [{ data: setting }, { data: usageRaw }] = await Promise.all([
    supabase.from("app_setting").select("leaderboard_on").eq("id", 1).maybeSingle(),
    supabase.rpc("admin_storage_usage"),
  ]);
  const usage = usageRaw as unknown as Usage | null;
  const fileBytes = (usage?.buckets ?? []).reduce((sum, b) => sum + Number(b.bytes), 0);
  const on = Boolean(setting?.leaderboard_on);

  const bar = (label: string, used: number, limit: number) => {
    const pct = usagePercent(used, limit);
    return (
      <div className="stack-sm">
        <div className="between">
          <span className="small">{label}</span>
          <span className="small muted">
            {formatBytes(used)} of {formatBytes(limit)} · {pct}%
          </span>
        </div>
        <div className="bar" role="img" aria-label={`${label}: ${pct} percent used`}>
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="small muted">{usageNote(pct)}</p>
      </div>
    );
  };

  return (
    <section className="stack" style={{ gap: 22 }}>
      <div className="stack-sm">
        <h2 className="heading">
          Site <span className="accent">Settings</span>
        </h2>
      </div>

      <div className="card stack-sm">
        <p className="label">Leaderboard</p>
        <p className="small muted">
          Shows the top 10 and your own row on Home, per exam. Students join it themselves, and only sets finished after joining count. It shows a name, a number of sets and an average, never answers.
        </p>
        <ActionForm action={setLeaderboard} submitLabel={on ? "Switch off" : "Switch on"} buttonClass={on ? "btn" : "btn btn-primary"} key={String(on)}>
          <input type="hidden" name="on" value={String(!on)} />
        </ActionForm>
        <p className="small">
          Status: <b>{on ? "on" : "off"}</b>
        </p>
      </div>

      <div className="card stack">
        <p className="label">Storage on the free plan</p>
        {usage ? (
          <>
            {bar("Files (notes and figures)", fileBytes, LIMITS_BYTES.storage)}
            {bar("Database", Number(usage.db_bytes), LIMITS_BYTES.database)}
            <div className="card rows">
              {usage.buckets.map((b) => (
                <div key={b.bucket} className="row">
                  <span className="row-name">{b.bucket}</span>
                  <span className="small">
                    {b.files} file{b.files === 1 ? "" : "s"} · {formatBytes(Number(b.bytes))}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="small muted">Storage numbers are not available right now.</p>
        )}
      </div>

      <div className="card stack">
        <p className="label">Export data</p>
        <p className="small muted">
          The free plan gives no restore points, so download a copy now and then. Each button saves one JSON file. Keep the People and Activity files private.
        </p>
        {EXPORTS.map((e) => (
          <div key={e.group} className="between" style={{ flexWrap: "wrap", gap: 10 }}>
            <div>
              <p className="row-name">{e.title}</p>
              <p className="small muted">{e.detail}</p>
            </div>
            <a href={`/api/admin/export/${e.group}`} download className="btn btn-small">
              Download
            </a>
          </div>
        ))}
        <p className="small muted">The note PDFs and figures are not in the export. They stay in the original files you built them from.</p>
      </div>
    </section>
  );
}
