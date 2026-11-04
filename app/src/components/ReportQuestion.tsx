"use client";

import { useActionState, useId, useState } from "react";
import { reportQuestion } from "@/app/exam/actions";

// The "Report question" button: opens a short note box, then confirms. Used on the exam screen and in the review.
export function ReportQuestion({ questionId, className = "btn btn-small" }: { questionId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(reportQuestion, null);
  const id = useId();
  return (
    <div className="report-q">
      <button type="button" className={className} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id}>
        Report question
      </button>
      {open ? (
        <form action={formAction} id={id} className="dashed stack-sm report-box">
          <input type="hidden" name="question_id" value={questionId} />
          <label className="label" htmlFor={`${id}-note`}>What looks wrong?</label>
          <textarea id={`${id}-note`} name="note" className="input textarea" rows={3} maxLength={500} required />
          <div className="wrap">
            <button type="submit" className="btn btn-small btn-primary" disabled={pending}>
              {pending ? "Sending..." : "Send report"}
            </button>
            <button type="button" className="btn btn-small" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
          {state?.message ? (
            <p className="form-msg" data-ok={state.ok} role="status">
              {state.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
