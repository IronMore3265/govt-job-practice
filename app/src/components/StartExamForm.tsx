"use client";

import { useActionState } from "react";
import { startExam } from "@/app/exam/actions";

type Props = {
  examId: string;
  // A set id, or "random" for a new random set. A retry of missed questions uses `retryOf` instead.
  setId?: string | null;
  topicIds?: string[];
  // The set number of a sequential topic set (Set 1, Set 2 ...). Needs exactly one topic id.
  chunk?: number | null;
  retryOf?: string | null;
  label?: string;
  className?: string;
  disabled?: boolean;
};

// Creates a session and opens its briefing. The questions are chosen on the server (start_session), and the clock only
// starts when the student presses Begin on the next screen.
export function StartExamForm({ examId, setId, topicIds = [], chunk, retryOf, label = "Start exam", className = "btn btn-primary", disabled }: Props) {
  const [state, formAction, pending] = useActionState(startExam, null);
  return (
    <form action={formAction} className="start-form">
      <input type="hidden" name="exam_id" value={examId} />
      <input type="hidden" name="set_id" value={setId ?? ""} />
      <input type="hidden" name="topic_ids" value={topicIds.join(",")} />
      <input type="hidden" name="chunk" value={chunk ?? ""} />
      <input type="hidden" name="retry_of" value={retryOf ?? ""} />
      <button type="submit" className={className} disabled={disabled || pending}>
        {pending ? "Starting..." : label}
      </button>
      {state?.message ? (
        <p className="form-msg" data-ok={state.ok} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
