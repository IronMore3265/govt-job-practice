import Link from "@/components/NavLink";
import { MathInlineText, MathText } from "@/components/MathText";
import { PrintButton } from "@/components/PrintButton";
import { ReportQuestion } from "@/components/ReportQuestion";
import { StartExamForm } from "@/components/StartExamForm";
import { formatMark } from "@/lib/exam";
import { noteHref } from "@/lib/notes";
import { formatScore, formatTaken, missedCount, percent, splitPageRefs, topicResults, type Review, type ReviewQuestion } from "@/lib/session";

// Result and review (mockup frame 5): the score with negative marking applied, topics, then every question with the right
// answer, the student's pick, time spent and the explanation. A server component with no data access of its own, so the
// page (or a test) hands it a review.
export function ReviewView({ review, sessionId, show, profileName }: { review: Review; sessionId: string; show?: string; profileName: string }) {
  const s = review.session;
  const missedOnly = show === "missed";
  const missed = missedCount(review.questions);
  const list = missedOnly ? review.questions.filter((q) => !q.is_correct) : review.questions;
  const topics = topicResults(review.questions);
  const pct = percent(s.score, s.max_score);

  return (
    <main className="shell shell-practice shell-exam">
      <div className="print-only print-head">
        <b>Practice Studio</b>
        <span>
          {profileName} · {s.exam_name} · {new Date(s.finished_at).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "long", year: "numeric" })}
        </span>
      </div>

      <div className="between no-print" style={{ flexWrap: "wrap", gap: 8 }}>
        <Link href="/" className="btn btn-small">
          Home
        </Link>
        <Link href="/history" className="btn btn-small">
          History
        </Link>
        <Link href="/revision" className="btn btn-small">
          Revision list
        </Link>
      </div>

      <div className="card-shadow stack">
        <p className="label label-orange">
          Your result · {s.exam_name}
          {s.is_retry ? " · Retry" : s.set_name ? ` · ${s.set_name}` : ""}
        </p>
        <div className="between">
          <span className="score-big">{formatScore(s.score)}</span>
          <span className="small muted">out of {formatMark(s.max_score)}</span>
        </div>
        <div className="bar" role="img" aria-label={`${pct} percent`}>
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="small">
          {s.correct} right, {s.wrong} wrong{s.wrong ? ` (-${formatScore(s.negative_applied)})` : ""}, {s.skipped} skipped. Time {formatTaken(s.seconds_used)}.
          {s.timed_out ? " Time ran out, so the exam was submitted for you." : ""}
        </p>
      </div>

      <div className="stack-sm">
        <p className="label">Topics</p>
        <div className="card rows">
          {topics.map((t) => (
            <div key={t.topic_id} className="row">
              <span>
                {t.number}. {t.topic}
              </span>
              <span className={t.pct >= 70 ? "chip chip-done" : "chip"}>
                {t.correct}/{t.asked} · {t.pct}%
              </span>
            </div>
          ))}
        </div>
        <p className="small muted">Topics under 70 percent are the ones to read again.</p>
      </div>

      <div className="between no-print" style={{ flexWrap: "wrap", gap: 10 }}>
        <PrintButton />
        <StartExamForm examId={s.exam_id} retryOf={sessionId} label={`Retry missed${missed ? ` (${missed})` : ""}`} disabled={missed === 0} />
      </div>

      <div className="wrap no-print">
        <Link href={`/exam/${sessionId}/review`} className="pill" aria-current={!missedOnly ? "page" : undefined}>
          All {review.questions.length} questions
        </Link>
        <Link href={`/exam/${sessionId}/review?show=missed`} className="pill" aria-current={missedOnly ? "page" : undefined}>
          Missed only · {missed}
        </Link>
      </div>

      <div className="stack" style={{ gap: 22 }}>
        {list.length === 0 ? <p className="small muted">Nothing missed. Well done.</p> : null}
        {list.map((q) => (
          <ReviewItem key={q.question_id} q={q} />
        ))}
      </div>
    </main>
  );
}

function ReviewItem({ q }: { q: ReviewQuestion }) {
  const skipped = q.selected_option === null;
  const verdict = q.is_correct ? "Right" : skipped ? "Skipped" : "Wrong";
  const pageLink = q.has_note && q.source_page ? noteHref(q.topic_id, { page: q.source_page }) : null;

  return (
    <section className="stack review-item" aria-label={`Question ${q.position + 1}`}>
      <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
        <p className="label">
          Question {q.position + 1} · {q.subject}, {q.topic}
        </p>
        <span className="wrap">
          <span className={q.is_correct ? "chip chip-right" : skipped ? "chip chip-muted" : "chip chip-wrong"}>{verdict}</span>
          <span className="chip chip-muted">{q.seconds_spent} s</span>
          {q.marked ? <span className="chip chip-now">Marked</span> : null}
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
            <div key={o.id} className={`opt ${cls}${q.lang === "bn" ? " bn" : ""}`} aria-label={`${o.label}${o.is_correct ? ", correct answer" : picked ? ", your answer" : ""}`}>
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
        <span className="small muted">Something wrong with this question?</span>
        <ReportQuestion questionId={q.question_id} />
      </div>
    </section>
  );
}

// "see page 12" in an explanation becomes a link to the note at that page. Text with math goes through MathText as it is.
export function Explanation({ text, topicId, hasNote }: { text: string; topicId: string; hasNote: boolean }) {
  const parts = hasNote ? splitPageRefs(text) : [{ type: "text" as const, text }];
  if (parts.length === 1 && parts[0].type === "text") return <MathText text={text} className="small" />;
  return (
    <p className="small" style={{ whiteSpace: "pre-line" }}>
      {parts.map((p, i) =>
        p.type === "page" ? (
          <Link key={i} href={noteHref(topicId, { page: p.page })} className="link">
            {p.text}
          </Link>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  );
}
