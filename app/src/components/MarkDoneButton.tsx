"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markRevised } from "@/app/revision/actions";

// "Mark done" for one question, or for a whole list (label "Mark all done"). Refreshes the page so the list shrinks.
export function MarkDoneButton({ questionIds, label = "Mark done", className = "btn btn-small" }: { questionIds: string[]; label?: string; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <span className="wrap">
      <button
        type="button"
        className={className}
        disabled={pending || questionIds.length === 0}
        onClick={() =>
          startTransition(async () => {
            const ok = await markRevised(questionIds);
            setFailed(!ok);
            if (ok) router.refresh();
          })
        }
      >
        {pending ? "Saving..." : label}
      </button>
      {failed ? (
        <span className="small" role="status">
          Could not save. Try again.
        </span>
      ) : null}
    </span>
  );
}
