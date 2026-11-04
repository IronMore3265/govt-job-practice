// Exam session helpers (PLAN.md sections 2.1 and 3). Pure functions, tested with `npm test`.
// The shapes below are what the database functions return (supabase/migrations/20261105110000_exam_mode.sql).

export type ExamOption = { id: string; label: "A" | "B" | "C" | "D"; text: string };
export type ExamQuestion = {
  position: number;
  question_id: string;
  text: string;
  lang: "en" | "bn";
  figure_id: string | null;
  subject: string;
  topic: string;
  selected_option: string | null;
  marked: boolean;
  seconds_spent: number;
  options: ExamOption[];
};
export type SessionState = {
  status: "ready" | "running" | "finished";
  session_id: string;
  exam: { id: string; name: string; marks_per_question: number; negative_mark: number };
  is_retry: boolean;
  set_name: string | null;
  total: number;
  seconds: number;
  deadline: string | null;
  now: string;
  questions: ExamQuestion[];
};

export type ReviewOption = ExamOption & { is_correct: boolean };
export type ReviewQuestion = {
  position: number;
  question_id: string;
  text: string;
  lang: "en" | "bn";
  figure_id: string | null;
  source_page: number | null;
  topic_id: string;
  topic: string;
  topic_number: number;
  subject: string;
  has_note: boolean;
  selected_option: string | null;
  is_correct: boolean;
  marked: boolean;
  seconds_spent: number;
  explanation: string | null;
  options: ReviewOption[];
};
export type Review = {
  session: {
    id: string;
    exam_id: string;
    exam_name: string;
    set_name: string | null;
    is_retry: boolean;
    started_at: string | null;
    finished_at: string;
    timed_out: boolean;
    seconds_used: number;
    score: number;
    max_score: number;
    negative_applied: number;
    marks_per_question: number;
    negative_mark: number;
    correct: number;
    wrong: number;
    skipped: number;
    total: number;
  };
  questions: ReviewQuestion[];
};

// ---------------------------------------------------------------- the clock

// Whole seconds left. The server's clock is the authority, so the browser works out how far its own clock is off at the
// moment the page arrived and applies that offset.
export function clockOffset(serverNowIso: string, clientNowMs: number): number {
  return Date.parse(serverNowIso) - clientNowMs;
}

export function secondsLeft(deadlineIso: string, clientNowMs: number, offsetMs: number): number {
  return Math.max(0, Math.ceil((Date.parse(deadlineIso) - (clientNowMs + offsetMs)) / 1000));
}

// "08:42", "12:00", "1:05:30" when an hour or more.
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${two(m)}:${two(sec)}`;
}

// The timer turns orange for the last minute (or the last tenth of a short exam).
export function isLowTime(left: number, total: number): boolean {
  return left <= Math.min(60, Math.max(10, Math.floor(total / 10)));
}

// ---------------------------------------------------------------- the palette

export type PaletteState = "answered" | "marked" | "open";

// Orange wins over black: a marked question shows as marked even when it has an answer.
export function paletteState(q: { selected_option: string | null; marked: boolean }): PaletteState {
  if (q.marked) return "marked";
  return q.selected_option ? "answered" : "open";
}

export function paletteCounts(qs: readonly { selected_option: string | null; marked: boolean }[]) {
  return {
    answered: qs.filter((q) => q.selected_option).length,
    marked: qs.filter((q) => q.marked).length,
    open: qs.filter((q) => !q.selected_option).length,
  };
}

// ---------------------------------------------------------------- results

export function percent(score: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((score / max) * 100)));
}

// Marks to two decimals without trailing noise: 14, 13.75, -0.25.
export function formatScore(n: number): string {
  return (Math.round(Number(n) * 100) / 100).toFixed(2);
}

export type TopicResult = { topic_id: string; topic: string; number: number; subject: string; asked: number; correct: number; pct: number };

// Accuracy per topic inside one review, weakest first. A skipped question counts as missed.
export function topicResults(questions: readonly Pick<ReviewQuestion, "topic_id" | "topic" | "topic_number" | "subject" | "is_correct">[]): TopicResult[] {
  const map = new Map<string, TopicResult>();
  for (const q of questions) {
    const r = map.get(q.topic_id) ?? { topic_id: q.topic_id, topic: q.topic, number: q.topic_number, subject: q.subject, asked: 0, correct: 0, pct: 0 };
    r.asked += 1;
    if (q.is_correct) r.correct += 1;
    map.set(q.topic_id, r);
  }
  return [...map.values()].map((r) => ({ ...r, pct: percent(r.correct, r.asked) })).sort((a, b) => a.pct - b.pct || a.number - b.number);
}

// Weak topics over the whole history: asked at least `minAsked` questions and under `below` percent right, weakest first.
export function weakTopics<T extends { asked: number; correct: number }>(stats: readonly T[], minAsked = 3, below = 70): (T & { pct: number })[] {
  return stats
    .map((s) => ({ ...s, pct: percent(s.correct, s.asked) }))
    .filter((s) => s.asked >= minAsked && s.pct < below)
    .sort((a, b) => a.pct - b.pct || b.asked - a.asked);
}

export function missedCount(q: readonly { is_correct: boolean }[]): number {
  return q.filter((x) => !x.is_correct).length;
}

// "11 min 05 s", "45 s".
export function formatTaken(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return m === 0 ? `${s} s` : `${m} min ${String(s % 60).padStart(2, "0")} s`;
}

// ---------------------------------------------------------------- explanation links

export type ExplainPart = { type: "text"; text: string } | { type: "page"; text: string; page: number };

// Turns "see page 12" in an explanation into a link part: the words stay, the number is a link to the viewer at that page.
// Only plain text is split. Text with math is left to MathText, so a `$` never ends up inside a link.
export function splitPageRefs(text: string, maxPage = 10000): ExplainPart[] {
  if (text.includes("$")) return [{ type: "text", text }];
  const parts: ExplainPart[] = [];
  const re = /\b(pages?|pp?\.)\s*(\d{1,4})\b/gi;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const page = Number(m[2]);
    if (page < 1 || page > maxPage) continue;
    const start = m.index ?? 0;
    const numStart = start + m[0].length - m[2].length;
    if (numStart > last) parts.push({ type: "text", text: text.slice(last, numStart) });
    parts.push({ type: "page", text: m[2], page });
    last = numStart + m[2].length;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts.length ? parts : [{ type: "text", text }];
}
