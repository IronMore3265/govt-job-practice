import { notFound, redirect } from "next/navigation";
import Link from "@/components/NavLink";
import { ActionForm } from "@/components/ActionForm";
import { ExamPlayer } from "@/components/ExamPlayer";
import { requireActive } from "@/lib/auth";
import { formatDuration, formatMark } from "@/lib/exam";
import { isUuid } from "@/lib/questions";
import type { SessionState } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { beginExam } from "../actions";

type Props = { params: Promise<{ sessionId: string }> };

// One exam session: the briefing ("Before you start") until Begin is pressed, then the exam screen. The questions come
// from session_state, which never includes the answer key. A finished session goes to its review.
export default async function ExamPage({ params }: Props) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) notFound();
  await requireActive();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("session_state", { p_session_id: sessionId });
  if (error || !data) notFound();
  const state = data as unknown as SessionState;
  if (state.status === "finished") redirect(`/exam/${sessionId}/review`);

  const marks = Number(state.exam.marks_per_question);
  const negative = Number(state.exam.negative_mark);

  if (state.status === "running" && state.deadline) {
    return (
      <main className="shell shell-practice shell-exam">
        <ExamPlayer
          sessionId={sessionId}
          examName={state.exam.name}
          total={state.total}
          seconds={state.seconds}
          deadline={state.deadline}
          serverNow={state.now}
          questions={state.questions}
        />
      </main>
    );
  }

  return (
    <main className="shell shell-practice shell-exam">
      <div className="card-shadow stack brief">
        <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
          <p className="label label-orange">Before you start</p>
          <p className="label">
            {state.exam.name}
            {state.is_retry ? " · Retry of missed questions" : state.set_name ? ` · ${state.set_name}` : " · New random set"}
          </p>
        </div>
        <div className="stack-sm">
          <p className="label">Questions</p>
          <p className="small">
            {state.total} MCQs, {formatMark(marks * state.total)} marks in total.
          </p>
        </div>
        <div className="stack-sm">
          <p className="label">Time</p>
          <p className="small">{formatDuration(state.seconds)}. The clock starts when you press Begin. At zero the exam is submitted and unanswered questions count as missed.</p>
        </div>
        <div className="stack-sm">
          <p className="label">How it is marked</p>
          <ul className="brief-list small">
            <li>A right answer earns {formatMark(marks)} {marks === 1 ? "mark" : "marks"}.</li>
            <li>A wrong answer loses {formatMark(negative)} mark.</li>
            <li>A skipped question earns 0 and costs nothing.</li>
            <li>The answers and explanations show after you submit.</li>
          </ul>
        </div>
        <div className="stack-sm">
          <p className="label">Question palette</p>
          <div className="segments" aria-hidden>
            <span className="segment segment-key segment-answered" />
            <span className="segment segment-key segment-marked" />
            <span className="segment segment-key" />
            <span className="segment segment-key segment-current" />
          </div>
          <p className="small">Navy: answered. Yellow: marked for review. Empty: not answered. Outlined: the question you are on.</p>
        </div>
        <div className="between">
          <Link href="/" className="btn">
            Back
          </Link>
          <ActionForm action={beginExam} submitLabel="Begin" buttonClass="btn btn-primary">
            <input type="hidden" name="session_id" value={sessionId} />
          </ActionForm>
        </div>
      </div>
    </main>
  );
}
