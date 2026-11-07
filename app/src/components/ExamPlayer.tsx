"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { finishExam, saveAnswer } from "@/app/exam/actions";
import { MathInlineText, MathText } from "@/components/MathText";
import { ReportQuestion } from "@/components/ReportQuestion";
import { clockOffset, formatClock, isLowTime, paletteCounts, paletteState, secondsLeft, type ExamQuestion } from "@/lib/session";

type Props = {
  sessionId: string;
  examName: string;
  total: number;
  seconds: number;
  deadline: string;
  serverNow: string;
  questions: ExamQuestion[];
};

type Answer = { option: string | null; marked: boolean };

// The exam screen (mockup frames 4 and 4b): countdown, question palette, one question at a time, mark for review,
// report question, submit. Nothing here knows which option is right: the server never sends it before submit. Answers are
// saved as they are chosen, through a small queue that retries if the connection drops. The server's clock decides when
// time is up; at zero the exam is submitted and unanswered questions count as missed.
export function ExamPlayer({ sessionId, examName, total, seconds, deadline, serverNow, questions }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    Object.fromEntries(questions.map((q) => [q.question_id, { option: q.selected_option, marked: q.marked }])),
  );
  // How far this browser's clock is from the server's, worked out once when the page arrives.
  const [offset] = useState(() => clockOffset(serverNow, Date.now()));
  const [left, setLeft] = useState(() => secondsLeft(deadline, Date.now(), offset));
  const [saveProblem, setSaveProblem] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const spent = useRef<Record<string, number>>(Object.fromEntries(questions.map((q) => [q.question_id, q.seconds_spent])));
  const queue = useRef(new Map<string, Answer>());
  const flushing = useRef(false);
  const finished = useRef(false);
  const indexRef = useRef(0);
  const retryTimer = useRef<number | null>(null);

  const q = questions[index];
  const toReview = useCallback(() => router.replace(`/exam/${sessionId}/review`), [router, sessionId]);

  // ---- saving: one answer at a time, the latest choice per question, retried when it fails
  const flush = useCallback(async () => {
    if (flushing.current || finished.current) return;
    flushing.current = true;
    try {
      while (queue.current.size > 0 && !finished.current) {
        const [qid, a] = queue.current.entries().next().value as [string, Answer];
        const result = await saveAnswer(sessionId, qid, a.option, a.marked, Math.round(spent.current[qid] ?? 0));
        if (result === "finished" || result === "expired") {
          finished.current = true;
          toReview();
          return;
        }
        if (result === "error") {
          setSaveProblem(true);
          if (retryTimer.current) window.clearTimeout(retryTimer.current);
          retryTimer.current = window.setTimeout(() => void flush(), 3000);
          return;
        }
        if (queue.current.get(qid) === a) queue.current.delete(qid);
        setSaveProblem(false);
      }
    } finally {
      flushing.current = false;
    }
  }, [sessionId, toReview]);

  const change = useCallback(
    (qid: string, next: Answer) => {
      setAnswers((cur) => ({ ...cur, [qid]: next }));
      queue.current.set(qid, next);
      void flush();
    },
    [flush],
  );

  // ---- submit (by the student or by the clock)
  const submit = useCallback(
    async (timedOut: boolean) => {
      if (finished.current || submitting) return;
      setSubmitting(true);
      // Let the last answers reach the server first. If the connection is down this gives up after a few tries.
      for (let i = 0; i < 6 && queue.current.size > 0; i++) {
        await flush();
        if (queue.current.size > 0) await new Promise((r) => setTimeout(r, 700));
      }
      const ok = await finishExam(sessionId, timedOut);
      if (ok) {
        finished.current = true;
        toReview();
      } else {
        setSubmitting(false);
        setSaveProblem(true);
      }
    },
    [flush, sessionId, submitting, toReview],
  );

  // ---- the clock, and the time spent on the question in view
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const remaining = secondsLeft(deadline, now, offset);
      setLeft(remaining);
      const cur = questions[indexRef.current];
      if (cur) spent.current[cur.question_id] = (spent.current[cur.question_id] ?? 0) + 0.25;
      if (remaining <= 0 && !finished.current) void submit(true);
    }, 250);
    return () => window.clearInterval(timer);
  }, [deadline, offset, questions, submit]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (queue.current.size > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  useEffect(
    () => () => {
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
    },
    [],
  );

  const counts = useMemo(() => paletteCounts(questions.map((x) => ({ selected_option: answers[x.question_id]?.option ?? null, marked: answers[x.question_id]?.marked ?? false }))), [answers, questions]);
  const current = answers[q.question_id] ?? { option: null, marked: false };
  const go = (n: number) => setIndex(Math.min(Math.max(0, n), questions.length - 1));

  function confirmSubmit() {
    const open = counts.open;
    const message = open > 0 ? `You have ${open} unanswered question${open === 1 ? "" : "s"}. Submit the exam now?` : "Submit the exam now?";
    if (window.confirm(message)) void submit(false);
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
        <p className="label">
          {examName} · Question {index + 1} of {total}
        </p>
        <span className={`timer-pill${isLowTime(left, seconds) ? " timer-low" : ""}`} role="timer" aria-label={`Time left ${formatClock(left)}`}>
          TIME <b>{formatClock(left)}</b>
        </span>
      </div>

      <div className="segments" role="group" aria-label="Question palette">
        {questions.map((x, i) => {
          const state = paletteState({ selected_option: answers[x.question_id]?.option ?? null, marked: answers[x.question_id]?.marked ?? false });
          return (
            <button
              key={x.question_id}
              type="button"
              className={`segment segment-${state}${i === index ? " segment-current" : ""}`}
              onClick={() => go(i)}
              aria-label={`Question ${i + 1}, ${state === "open" ? "not answered" : state === "marked" ? "marked for review" : "answered"}`}
              aria-current={i === index ? "step" : undefined}
            />
          );
        })}
      </div>

      <div className="practice-grid">
        <div className="card-orange stack-sm">
          <p className="label label-orange">
            {q.subject}, {q.topic}
          </p>
          <div className={`q-text${q.lang === "bn" ? " bn" : ""}`}>
            <MathText text={q.text} />
          </div>
          {q.figure_id ? (
            // Served through a signed link (/api/figures), so a plain img is used instead of next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/figures/${q.figure_id}`} alt="Figure for this question" className="exam-figure" />
          ) : null}
        </div>

        <div className="stack" style={{ gap: 14 }}>
          {q.options.map((o) => {
            const on = current.option === o.id;
            return (
              <button
                key={o.id}
                type="button"
                className={`opt${on ? " opt-sel" : ""}${q.lang === "bn" ? " bn" : ""}`}
                aria-pressed={on}
                onClick={() => change(q.question_id, { ...current, option: on ? null : o.id })}
              >
                <span className="opt-letter">{o.label}</span>
                <span className="opt-text">
                  <MathInlineText text={o.text} />
                </span>
              </button>
            );
          })}

          <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
            <div className="wrap">
              <ReportQuestion questionId={q.question_id} />
              <button type="button" className="btn btn-small" aria-pressed={current.marked} onClick={() => change(q.question_id, { ...current, marked: !current.marked })}>
                {current.marked ? "Unmark review" : "Mark for review"}
              </button>
            </div>
            <div className="nav-buttons">
              <button type="button" className="btn btn-icon" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous question">
                <ChevronLeft size={20} strokeWidth={2} aria-hidden />
              </button>
              <button type="button" className="btn btn-icon" onClick={() => go(index + 1)} disabled={index === questions.length - 1} aria-label="Next question">
                <ChevronRight size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>
          </div>

          {/* Submit sits on the left, below a divider, so it is never mistaken for the Next button on the right. */}
          <div className="exam-submit-row">
            <button type="button" className="btn btn-ink" onClick={confirmSubmit} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit exam"}
            </button>
            <span className="small muted" aria-live="polite">
              {counts.answered} of {total} answered · {counts.marked} marked
            </span>
          </div>
          {saveProblem ? (
            <p className="form-msg" data-ok="false" role="alert">
              Your last answer has not been saved yet. Check your connection. It will keep trying.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
