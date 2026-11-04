// Exam recipe helpers (PLAN.md section 2). Pure functions, tested with `npm test`.

// Defaults for a new exam: 20 questions, 1 mark each, 0.25 off per wrong answer, 36 seconds per question.
export const EXAM_DEFAULTS = {
  questionCount: 20,
  marksPerQuestion: 1,
  negativeMark: 0.25,
  secondsPerQuestion: 36,
} as const;

export function totalSeconds(questionCount: number, secondsPerQuestion: number) {
  return Math.round(questionCount * secondsPerQuestion);
}

// Seconds per question for the admin form, rounded to two decimals (720 s for 20 questions is 36).
export function secondsPerQuestion(timeSeconds: number, questionCount: number) {
  if (questionCount <= 0) return EXAM_DEFAULTS.secondsPerQuestion;
  return Math.round((timeSeconds / questionCount) * 100) / 100;
}

// "12 min", "12 min 30 s", "45 s".
export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const min = Math.floor(s / 60);
  const rest = s % 60;
  if (min === 0) return `${rest} s`;
  return rest === 0 ? `${min} min` : `${min} min ${rest} s`;
}

// Marks without trailing zeros: 1, 0.25, 1.5.
export function formatMark(n: number) {
  return String(Math.round(Number(n) * 100) / 100);
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

// The line under an exam card: "3 topics · 20 questions · 12 min".
export function examSummary(exam: { question_count: number; time_seconds: number }, topicCount: number) {
  return [plural(topicCount, "topic"), plural(exam.question_count, "question"), formatDuration(exam.time_seconds)].join(" · ");
}

// Reads a number from a form field. Returns null when it is missing, not a number, or out of range.
export function parseNumber(raw: FormDataEntryValue | null, min: number, max: number, { integer = false } = {}) {
  const text = String(raw ?? "").trim();
  if (text === "" || !/^-?\d+(\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  if (integer && !Number.isInteger(n)) return null;
  return n >= min && n <= max ? n : null;
}
