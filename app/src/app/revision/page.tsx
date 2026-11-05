import Link from "@/components/NavLink";
import { BrandTitle } from "@/components/BrandTitle";
import { MarkDoneButton } from "@/components/MarkDoneButton";
import { MathInlineText, MathText } from "@/components/MathText";
import { Explanation } from "@/components/ReviewView";
import { requireActive } from "@/lib/auth";
import { noteHref } from "@/lib/notes";
import { pickRevisionSubject, revisionSubjects, type RevisionItem } from "@/lib/revision";
import { createClient } from "@/lib/supabase/server";

const dhaka = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short" });

// Revision list: every question you answered wrong in a finished exam, per subject, with the right answer and the reason.
// A question stays until you mark it done. If you get it wrong again later it comes back. Only your own rows are returned.
export default async function RevisionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireActive();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_revision");
  const items = (Array.isArray(data) ? data : []) as unknown as RevisionItem[];

  const subjects = revisionSubjects(items);
  const wanted = Array.isArray(sp.subject) ? sp.subject[0] : sp.subject;
  const subject = pickRevisionSubject(subjects, wanted);
  const list = subject ? items.filter((i) => i.subject_id === subject.id) : [];

  return (
    <main className="shell shell-wide">
      <div className="between topbar">
        <BrandTitle />
        <div className="topbar-actions">
          <Link href="/history" className="pill">
            History
          </Link>
          <Link href="/" className="btn btn-small">
            Home
          </Link>
        </div>
      </div>

      <div className="stack-sm">
        <h2 className="heading">
          Revision <span className="accent">List</span>
        </h2>
        <p className="small muted">
          {items.length === 0
            ? "Nothing to revise. Questions you answer wrong in an exam are collected here."
            : `${items.length} question${items.length === 1 ? "" : "s"} to go over. Mark one done when you are happy with it and it leaves the list.`}
        </p>
      </div>

      {subjects.length ? (
        <div className="wrap" role="navigation" aria-label="Subjects">
          {subjects.map((s) => (
            <Link key={s.id} href={`/revision?subject=${s.id}`} className="pill" aria-current={s.id === subject?.id ? "page" : undefined}>
              {s.name} · {s.count}
            </Link>
          ))}
        </div>
      ) : null}

      {subject && list.length ? (
        <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
          <p className="label">
            {subject.name} · {list.length} to revise
          </p>
          <MarkDoneButton questionIds={list.map((i) => i.question_id)} label="Mark all done" />
        </div>
      ) : null}

      <div className="stack" style={{ gap: 22 }}>
        {list.map((q) => (
          <RevisionCard key={q.question_id} q={q} />
        ))}
      </div>
    </main>
  );
}

function RevisionCard({ q }: { q: RevisionItem }) {
  const pageLink = q.has_note && q.source_page ? noteHref(q.topic_id, { page: q.source_page }) : null;
  return (
    <section className="stack review-item" aria-label={`Question from ${q.topic}`}>
      <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
        <p className="label">
          {q.topic_number}. {q.topic}
        </p>
        <span className="wrap">
          <span className="chip chip-wrong">{q.times_wrong === 1 ? "Wrong once" : `Wrong ${q.times_wrong} times`}</span>
          <span className="chip chip-muted">{dhaka.format(new Date(q.last_wrong))}</span>
        </span>
      </div>

      <div className="card-orange stack-sm">
        <div className={`q-text${q.lang === "bn" ? " bn" : ""}`}>
          <MathText text={q.text} />
        </div>
        {q.figure_id ? (
          // Served through a signed link (/api/figures), so a plain img is used instead of next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/figures/${q.figure_id}`} alt="Figure for this question" className="exam-figure" />
        ) : null}
      </div>

      <div className="stack" style={{ gap: 12 }}>
        {q.options.map((o) => {
          const picked = q.selected_option === o.id;
          const cls = o.is_correct ? "opt-correct" : picked ? "opt-wrong" : "opt-dim";
          return (
            <div key={o.id} className={`opt ${cls}${q.lang === "bn" ? " bn" : ""}`} aria-label={`${o.label}${o.is_correct ? ", correct answer" : picked ? ", your last answer" : ""}`}>
              <span className="opt-letter">{o.label}</span>
              <span className="opt-text">
                <MathInlineText text={o.text} />
                {picked ? <span className="small"> (your answer)</span> : null}
              </span>
            </div>
          );
        })}
      </div>

      {q.explanation ? (
        <div className="dashed stack-sm">
          <p className="label label-orange">
            Why
            {q.source_page ? (
              <>
                {" · "}
                {pageLink ? (
                  <Link href={pageLink} className="link">
                    Notes, page {q.source_page}
                  </Link>
                ) : (
                  <span>Source, page {q.source_page}</span>
                )}
              </>
            ) : null}
          </p>
          <Explanation text={q.explanation} topicId={q.topic_id} hasNote={q.has_note} />
        </div>
      ) : null}

      <div className="between no-print" style={{ flexWrap: "wrap", gap: 8 }}>
        <span className="small muted">Got it? Take it off the list.</span>
        <MarkDoneButton questionIds={[q.question_id]} />
      </div>
    </section>
  );
}
