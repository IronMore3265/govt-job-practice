import Link from "@/components/NavLink";
import { ActionForm } from "@/components/ActionForm";
import { createClient } from "@/lib/supabase/server";
import { addSubject, addTopic, deleteSubject, deleteTopic, renameSubject, updateTopic } from "../actions";

type SearchParams = Promise<{ subject?: string }>;

// Subjects and topics. One topic is a chapter-sized unit with one note PDF (uploaded by the import tool in Phase 2).
export default async function AdminTopicsPage({ searchParams }: { searchParams: SearchParams }) {
  const { subject: subjectParam } = await searchParams;
  const supabase = await createClient();

  const { data: subjects } = await supabase.from("subject").select("id, name, sort_order").order("sort_order");
  const subject = (subjects ?? []).find((s) => s.id === subjectParam) ?? subjects?.[0];
  const { data: topics } = subject
    ? await supabase.from("topic").select("id, number, title, note_path, note_pages").eq("subject_id", subject.id).order("number")
    : { data: [] };
  const nextNumber = (topics ?? []).reduce((m, t) => Math.max(m, t.number), 0) + 1;

  return (
    <section className="stack" style={{ gap: 22 }}>
      <div className="stack-sm">
        <h2 className="heading">
          Subjects and <span className="accent">Topics</span>
        </h2>
        <p className="small muted">A topic is a chapter-sized unit. Each one gets one note PDF and its own questions, both brought in by the import tool.</p>
      </div>

      <div className="stack-sm">
        <p className="label">Subject</p>
        <div className="wrap">
          {(subjects ?? []).map((s) => (
            <Link key={s.id} href={`/admin/topics?subject=${s.id}`} className="pill" aria-current={s.id === subject?.id ? "page" : undefined}>
              {s.name}
            </Link>
          ))}
        </div>
        <details>
          <summary className="label" style={{ cursor: "pointer" }}>Add subject</summary>
          <ActionForm action={addSubject} submitLabel="Add subject" className="inline-form">
            <div className="field" style={{ width: 220 }}>
              <label className="label" htmlFor="new-subject">Subject name</label>
              <input id="new-subject" name="name" className="input input-sm" maxLength={80} required />
            </div>
          </ActionForm>
        </details>
      </div>

      {subject ? (
        <>
          <div className="stack-sm">
            <p className="label">Topics, {subject.name}</p>
            <div className="card rows">
              {(topics ?? []).length === 0 ? <p className="small muted">No topics yet. Add the first one below.</p> : null}
              {(topics ?? []).map((t) => (
                <div key={t.id} className="row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
                  <ActionForm action={updateTopic} submitLabel="Save" buttonClass="btn btn-small" className="inline-form">
                    <input type="hidden" name="id" value={t.id} />
                    <div className="field" style={{ width: 80 }}>
                      <label className="label" htmlFor={`num-${t.id}`}>No.</label>
                      <input id={`num-${t.id}`} name="number" inputMode="numeric" className="input input-sm" defaultValue={t.number} required />
                    </div>
                    <div className="field" style={{ width: 280 }}>
                      <label className="label" htmlFor={`title-${t.id}`}>Title</label>
                      <input id={`title-${t.id}`} name="title" className="input input-sm" defaultValue={t.title} maxLength={200} required />
                    </div>
                  </ActionForm>
                  <div className="wrap">
                    {t.note_path ? <span className="chip chip-done">Note{t.note_pages ? ` · ${t.note_pages} p` : ""}</span> : <span className="chip chip-muted">No note yet</span>}
                    <ActionForm action={deleteTopic} submitLabel="Delete" buttonClass="btn btn-small" confirmText={`Delete topic ${t.number}, ${t.title}? Its questions go too.`}>
                      <input type="hidden" name="id" value={t.id} />
                    </ActionForm>
                  </div>
                </div>
              ))}
            </div>
            <ActionForm action={addTopic} submitLabel="Add topic" className="inline-form" key={`add-${nextNumber}`}>
              <input type="hidden" name="subject_id" value={subject.id} />
              <div className="field" style={{ width: 80 }}>
                <label className="label" htmlFor="topic-number">No.</label>
                <input id="topic-number" name="number" inputMode="numeric" className="input input-sm" defaultValue={nextNumber} required />
              </div>
              <div className="field" style={{ width: 280 }}>
                <label className="label" htmlFor="topic-title">Title</label>
                <input id="topic-title" name="title" className="input input-sm" maxLength={200} required />
              </div>
            </ActionForm>
          </div>

          <details className="card stack-sm">
            <summary className="label" style={{ cursor: "pointer" }}>Rename or delete {subject.name}</summary>
            <ActionForm action={renameSubject} submitLabel="Rename" className="inline-form" key={`rename-${subject.id}`}>
              <input type="hidden" name="id" value={subject.id} />
              <div className="field" style={{ width: 220 }}>
                <label className="label" htmlFor="rename-subject">Name</label>
                <input id="rename-subject" name="name" className="input input-sm" defaultValue={subject.name} maxLength={80} required />
              </div>
            </ActionForm>
            <ActionForm
              action={deleteSubject}
              submitLabel={`Delete ${subject.name}`}
              buttonClass="btn btn-small"
              confirmText={`Delete ${subject.name}? Its topics and questions go too. Its exams stay, listed as Mixed.`}
            >
              <input type="hidden" name="id" value={subject.id} />
            </ActionForm>
          </details>
        </>
      ) : (
        <p className="small muted">No subjects yet. Add one above.</p>
      )}
    </section>
  );
}
