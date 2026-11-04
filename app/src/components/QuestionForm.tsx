"use client";

import { useActionState, useState } from "react";
import { MathText } from "@/components/MathText";
import type { ActionState } from "@/lib/action-state";
import { LIMITS, OPTION_LABELS, type OptionLabel } from "@/lib/questions";

export type FormSubject = { id: string; name: string };
export type FormTopic = { id: string; subject_id: string; number: number; title: string };
export type FormFigure = { id: string; topic_id: string; label: string | null; page: number | null; caption: string | null };

export type QuestionDraft = {
  id: string | null;
  topic_id: string;
  lang: "en" | "bn";
  text: string;
  options: Record<OptionLabel, string>;
  correct: OptionLabel | "";
  explanation: string;
  source_page: number | null;
  figure_id: string | null;
  status: "draft" | "approved";
};

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  subjects: FormSubject[];
  topics: FormTopic[];
  figures: FormFigure[];
  initial: QuestionDraft;
};

// One form for adding and editing a question. The two buttons say what happens to the status: a draft can be saved or
// saved and approved, an approved question can be saved or moved back to draft.
export function QuestionForm({ action, subjects, topics, figures, initial }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [topicId, setTopicId] = useState(initial.topic_id);
  const [text, setText] = useState(initial.text);
  const [explanation, setExplanation] = useState(initial.explanation);
  const [figureId, setFigureId] = useState(initial.figure_id ?? "");

  const topicFigures = figures.filter((f) => f.topic_id === topicId);
  const figureOk = !figureId || topicFigures.some((f) => f.id === figureId);
  const approved = initial.status === "approved";

  return (
    <form action={formAction} className="stack">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="inline-form">
        <div className="field" style={{ width: 340 }}>
          <label className="label" htmlFor="q-topic">Topic</label>
          <select id="q-topic" name="topic_id" className="select input-sm" value={topicId} onChange={(e) => setTopicId(e.target.value)} required>
            <option value="" disabled>Pick a topic</option>
            {subjects.map((s) => (
              <optgroup key={s.id} label={s.name}>
                {topics
                  .filter((t) => t.subject_id === s.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.number}. {t.title}</option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="field" style={{ width: 150 }}>
          <label className="label" htmlFor="q-lang">Language</label>
          <select id="q-lang" name="lang" className="select input-sm" defaultValue={initial.lang}>
            <option value="en">English</option>
            <option value="bn">Bangla</option>
          </select>
        </div>
        <div className="field" style={{ width: 110 }}>
          <label className="label" htmlFor="q-page">Source page</label>
          <input id="q-page" name="source_page" inputMode="numeric" className="input input-sm" defaultValue={initial.source_page ?? ""} />
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="q-text">Question</label>
        <textarea
          id="q-text"
          name="text"
          className="input textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={LIMITS.text}
          rows={4}
          required
        />
        <p className="small muted">Math goes between dollar signs, like $\frac{"{a}{b}"}$. Write a real dollar sign as \$.</p>
      </div>

      <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">Options (mark the correct one)</legend>
        {OPTION_LABELS.map((label) => (
          <div key={label} className="opt-row">
            <label className="check">
              <input type="radio" name="correct" value={label} defaultChecked={initial.correct === label} required aria-label={`Option ${label} is correct`} />
              {label}
            </label>
            <input
              name={`option_${label}`}
              className="input input-sm grow"
              defaultValue={initial.options[label]}
              maxLength={LIMITS.option}
              aria-label={`Option ${label} text`}
              required
            />
          </div>
        ))}
      </fieldset>

      <div className="field">
        <label className="label" htmlFor="q-explanation">Explanation (shown after the exam, with the source page)</label>
        <textarea
          id="q-explanation"
          name="explanation"
          className="input textarea"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          maxLength={LIMITS.explanation}
          rows={3}
        />
      </div>

      <div className="field" style={{ maxWidth: 420 }}>
        <label className="label" htmlFor="q-figure">Figure</label>
        <select id="q-figure" name="figure_id" className="select input-sm" value={figureOk ? figureId : ""} onChange={(e) => setFigureId(e.target.value)}>
          <option value="">No figure</option>
          {topicFigures.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label || "Figure"}
              {f.page ? `, page ${f.page}` : ""}
            </option>
          ))}
        </select>
        <p className="small muted">
          {topicFigures.length ? "Figures are uploaded with the import tool, one copy from the book." : "This topic has no figures yet. Upload them with the import tool."}
        </p>
        {figureId && figureOk ? (
          // The figure comes through a signed link, so a plain img is used instead of next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/figures/${figureId}`} alt="The figure for this question" style={{ maxWidth: "100%", maxHeight: 260, background: "#fff", border: "1px solid var(--muted)" }} />
        ) : null}
      </div>

      <details className="card stack-sm" open={Boolean(text.trim())}>
        <summary className="label" style={{ cursor: "pointer" }}>Preview</summary>
        {text.trim() ? <MathText text={text} className="q-text" /> : <p className="small muted">The question appears here as you type.</p>}
        {explanation.trim() ? (
          <div className="dashed">
            <p className="label label-orange">Explanation</p>
            <MathText text={explanation} />
          </div>
        ) : null}
      </details>

      <div className="wrap">
        {approved ? (
          <>
            <button type="submit" name="intent" value="approve" className="btn btn-primary" disabled={pending}>
              {pending ? "Working..." : "Save changes"}
            </button>
            <button type="submit" name="intent" value="draft" className="btn" disabled={pending}>
              Move to draft
            </button>
          </>
        ) : (
          <>
            <button type="submit" name="intent" value="approve" className="btn btn-primary" disabled={pending}>
              {pending ? "Working..." : "Save and approve"}
            </button>
            <button type="submit" name="intent" value="draft" className="btn" disabled={pending}>
              Save draft
            </button>
          </>
        )}
      </div>
      {state?.message ? (
        <p className="form-msg" data-ok={state.ok} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
