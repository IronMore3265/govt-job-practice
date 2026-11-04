import Link from "@/components/NavLink";
import { BrandTitle } from "@/components/BrandTitle";
import { requireActive } from "@/lib/auth";
import { formatMark } from "@/lib/exam";
import { formatScore, formatTaken, percent, weakTopics } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const dhaka = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// History (PLAN.md section 3, items 6 and 7): every finished exam with its score and time, accuracy per topic, and the
// weak topics to read again. Only your own rows are ever returned (the database functions read auth.uid()).
export default async function HistoryPage() {
  await requireActive();
  const supabase = await createClient();
  const [{ data: history }, { data: stats }] = await Promise.all([supabase.rpc("my_history"), supabase.rpc("my_topic_stats")]);

  const rows = history ?? [];
  const topics = stats ?? [];
  const full = rows.filter((r) => !r.is_retry);
  const avg = full.length ? Math.round(full.reduce((sum, r) => sum + percent(Number(r.score), Number(r.max_score)), 0) / full.length) : null;
  const weak = weakTopics(topics.map((t) => ({ ...t, asked: Number(t.asked), correct: Number(t.correct) }))).slice(0, 5);

  return (
    <main className="shell shell-wide">
      <div className="between topbar">
        <BrandTitle />
        <div className="topbar-actions">
          <Link href="/notes" className="pill">
            Notes
          </Link>
          <Link href="/" className="btn btn-small">
            Home
          </Link>
        </div>
      </div>

      <div className="stack-sm">
        <h2 className="heading">
          My <span className="accent">History</span>
        </h2>
        <p className="small muted">
          {rows.length === 0
            ? "Nothing yet. Finish an exam and it shows up here."
            : `${rows.length} finished exam${rows.length === 1 ? "" : "s"}${avg !== null ? ` · average ${avg}% on full sets` : ""}.`}
        </p>
      </div>

      {weak.length ? (
        <div className="stack-sm">
          <p className="label label-orange">Weak topics</p>
          <div className="card rows">
            {weak.map((t) => (
              <div key={t.topic_id} className="row" style={{ flexWrap: "wrap" }}>
                <span>
                  <span className="row-name">
                    {t.topic_number}. {t.topic_title}
                  </span>{" "}
                  <span className="small muted">{t.subject_name}</span>
                </span>
                <span className="wrap">
                  <span className="chip">
                    {t.correct}/{t.asked} · {t.pct}%
                  </span>
                  <Link href={`/notes/${t.topic_id}`} className="btn btn-small">
                    Read the note
                  </Link>
                </span>
              </div>
            ))}
          </div>
          <p className="small muted">Topics where you got under 70 percent of at least 3 questions right.</p>
        </div>
      ) : null}

      {topics.length ? (
        <div className="stack-sm">
          <p className="label">Accuracy by topic</p>
          <div className="card stack-sm">
            {topics.map((t) => {
              const pct = percent(Number(t.correct), Number(t.asked));
              return (
                <div key={t.topic_id} className="stack-sm">
                  <div className="between">
                    <span className="small">
                      {t.subject_name} · {t.topic_number}. {t.topic_title}
                    </span>
                    <span className="small muted">
                      {t.correct}/{t.asked} · {pct}%
                    </span>
                  </div>
                  <div className="bar" role="img" aria-label={`${pct} percent`}>
                    <div className="bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {rows.length ? (
        <div className="stack-sm">
          <p className="label">Finished exams</p>
          <div className="card rows">
            {rows.map((r) => (
              <Link key={r.session_id} href={`/exam/${r.session_id}/review`} className="row row-link q-row">
                <span className="q-main">
                  <span className="row-name">{r.exam_name}</span>
                  <span className="small muted">
                    {" "}
                    · {r.is_retry ? "Retry of missed" : (r.set_name ?? "Random set")} · {dhaka.format(new Date(r.finished_at))}
                  </span>
                  <span className="q-meta">
                    <span className="chip chip-muted">
                      {r.correct} right · {r.wrong} wrong · {r.skipped} skipped
                    </span>
                    <span className="chip chip-muted">{formatTaken(r.seconds_used)}</span>
                    {r.timed_out ? <span className="chip chip-now">Time ran out</span> : null}
                  </span>
                </span>
                <span className="wrap">
                  <b>
                    {formatScore(Number(r.score))} <span className="small muted">/ {formatMark(Number(r.max_score))}</span>
                  </b>
                  <span className={percent(Number(r.score), Number(r.max_score)) >= 70 ? "chip chip-done" : "chip"}>{percent(Number(r.score), Number(r.max_score))}%</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}
