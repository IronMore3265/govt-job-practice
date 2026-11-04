import Link from "@/components/NavLink";
import { BrandTitle } from "@/components/BrandTitle";
import { requireActive } from "@/lib/auth";
import { noteHref, readingPercent } from "@/lib/notes";
import { createClient } from "@/lib/supabase/server";

// Notes library: every topic's note, grouped by subject, with where you stopped. A topic without a note yet is greyed out.
export default async function NotesLibraryPage() {
  const { user } = await requireActive();
  const supabase = await createClient();
  const [{ data: subjects }, { data: topics }, { data: progress }] = await Promise.all([
    supabase.from("subject").select("id, name").order("sort_order"),
    supabase.from("topic").select("id, subject_id, number, title, note_path, note_pages").order("number"),
    supabase.from("note_progress").select("topic_id, last_page").eq("user_id", user.id),
  ]);
  const last = new Map((progress ?? []).map((p) => [p.topic_id, p.last_page]));

  return (
    <main className="shell shell-wide">
      <div className="between topbar">
        <BrandTitle />
        <div className="topbar-actions">
          <Link href="/" className="btn btn-small">
            Home
          </Link>
        </div>
      </div>

      <div className="stack-sm">
        <h2 className="heading">
          Notes <span className="accent">Library</span>
        </h2>
        <p className="small muted">Read the notes before you practise. The page you stopped on is remembered.</p>
      </div>

      {(subjects ?? []).map((s) => {
        const list = (topics ?? []).filter((t) => t.subject_id === s.id);
        if (!list.length) return null;
        return (
          <section key={s.id} className="stack-sm subject-section">
            <p className="label">{s.name}</p>
            <div className="card rows">
              {list.map((t) => {
                const hasNote = Boolean(t.note_path);
                const page = last.get(t.id);
                const body = (
                  <>
                    <span>
                      <span className="row-name">
                        {t.number}. {t.title}
                      </span>
                      {hasNote && t.note_pages ? <span className="small muted"> · {t.note_pages} pages</span> : null}
                    </span>
                    {hasNote ? (
                      <span className="wrap">
                        {page && t.note_pages ? <span className="chip chip-muted">{readingPercent(page, t.note_pages)}% read</span> : null}
                        <span className="chip chip-now">{page ? `Continue, page ${page}` : "Open"}</span>
                      </span>
                    ) : (
                      <span className="chip chip-muted">No note yet</span>
                    )}
                  </>
                );
                return hasNote ? (
                  <Link key={t.id} href={noteHref(t.id)} className="row row-link">
                    {body}
                  </Link>
                ) : (
                  <div key={t.id} className="row" style={{ opacity: 0.6 }}>
                    {body}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {(topics ?? []).length === 0 ? <p className="small muted">No topics yet. The admin adds them in the portal.</p> : null}
    </main>
  );
}
