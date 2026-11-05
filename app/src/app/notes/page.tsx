import Link from "@/components/NavLink";
import { BrandTitle } from "@/components/BrandTitle";
import { ANNOTATION_COLUMNS, snippet, toAnnotation, type Annotation } from "@/lib/annotations";
import { requireActive } from "@/lib/auth";
import { noteHref, readingPercent } from "@/lib/notes";
import { createClient } from "@/lib/supabase/server";

// Notes library: every topic's note, grouped by subject, with where you stopped. A topic without a note yet is greyed out.
export default async function NotesLibraryPage() {
  const { user } = await requireActive();
  const supabase = await createClient();
  const [{ data: subjects }, { data: topics }, { data: progress }, { data: markRows }] = await Promise.all([
    supabase.from("subject").select("id, name").order("sort_order"),
    supabase.from("topic").select("id, subject_id, number, title, note_path, note_pages").order("number"),
    supabase.from("note_progress").select("topic_id, last_page").eq("user_id", user.id),
    supabase.from("note_annotation").select(ANNOTATION_COLUMNS).eq("user_id", user.id).order("page").order("created_at"),
  ]);
  const last = new Map((progress ?? []).map((p) => [p.topic_id, p.last_page]));

  // The student's own highlights and comments, grouped by note, so they can all be seen in one place.
  const marksByTopic = new Map<string, Annotation[]>();
  for (const row of markRows ?? []) marksByTopic.set(row.topic_id, [...(marksByTopic.get(row.topic_id) ?? []), toAnnotation(row)]);
  const marked = (topics ?? []).filter((t) => marksByTopic.has(t.id));

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

      {marked.length ? (
        <section className="stack-sm subject-section">
          <p className="label">My highlights and comments</p>
          <div className="card rows">
            {marked.map((t) => {
              const list = marksByTopic.get(t.id) ?? [];
              const comments = list.filter((m) => m.kind === "comment").length;
              return (
                <details key={t.id} className="mk-topic">
                  <summary className="row mk-summary">
                    <span className="row-name">
                      {t.number}. {t.title}
                    </span>
                    <span className="wrap">
                      <span className="chip chip-muted">{list.length} {list.length === 1 ? "mark" : "marks"}</span>
                      {comments ? <span className="chip chip-muted">{comments} {comments === 1 ? "comment" : "comments"}</span> : null}
                    </span>
                  </summary>
                  <ul className="mk-list">
                    {list.map((m) => (
                      <li key={m.id}>
                        <Link href={noteHref(t.id, { page: m.page })} className="mk-item">
                          <span className="nv-mark-meta">
                            <i className={`nv-dot nv-dot-${m.color}`} aria-hidden />
                            Page {m.page}
                          </span>
                          {m.quote ? <span className={`nv-mark-quote nv-q-${m.color}`}>{snippet(m.quote, 220)}</span> : null}
                          {m.comment ? <span className="nv-mark-comment">{m.comment}</span> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        </section>
      ) : null}

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
                      {hasNote && t.note_pages ? <span className="small muted note-pages">{t.note_pages} pages</span> : null}
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
                  <Link key={t.id} href={noteHref(t.id)} className="row row-link note-row">
                    {body}
                  </Link>
                ) : (
                  <div key={t.id} className="row note-row" style={{ opacity: 0.6 }}>
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
