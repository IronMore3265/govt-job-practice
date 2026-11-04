// Question bank helpers (PLAN.md sections 3 and 7). Pure functions, tested with `npm test`.
// The limits mirror the database check constraints and the import tool (docs/QUESTION_FORMAT.md).

export const OPTION_LABELS = ["A", "B", "C", "D"] as const;
export type OptionLabel = (typeof OPTION_LABELS)[number];
export const LIMITS = { text: 4000, option: 1000, explanation: 2000, page: 10000 } as const;
export const PAGE_SIZE = 25;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export type QuestionInput = {
  id: string | null;
  topic_id: string;
  lang: "en" | "bn";
  text: string;
  figure_id: string | null;
  source_page: number | null;
  options: { label: OptionLabel; text: string }[];
  correct: OptionLabel;
  explanation: string;
  status: "draft" | "approved";
};

// True when a line has a `$` that is not closed (the same scan as splitInline in math-text.ts). A literal dollar
// sign is written `\$`. An empty pair such as `$$$$` draws nothing, so it counts too.
export function hasUnclosedDollar(text: string): boolean {
  for (const line of text.split("\n")) {
    let i = 0;
    while (i < line.length) {
      const ch = line[i];
      if (ch === "\\" && line[i + 1] === "$") {
        i += 2;
        continue;
      }
      if (ch === "$") {
        const mark = line[i + 1] === "$" ? "$$" : "$";
        let j = i + mark.length;
        let found = -1;
        while (j < line.length) {
          if (line[j] === "\\") {
            j += 2;
            continue;
          }
          if (line.startsWith(mark, j)) {
            found = j;
            break;
          }
          j++;
        }
        if (found === -1 || line.slice(i + mark.length, found).trim() === "") return true;
        i = found + mark.length;
        continue;
      }
      i++;
    }
  }
  return false;
}

type Parsed = { ok: true; value: QuestionInput } | { ok: false; message: string };

// Reads the question form. `intent` is the button pressed: "draft" saves as it is, "approve" also publishes it, which
// asks for the things a student needs (explanation, source page, closed math).
export function parseQuestionForm(form: FormData, intent: "draft" | "approve"): Parsed {
  const get = (key: string) => String(form.get(key) ?? "");
  const bad = (message: string): Parsed => ({ ok: false, message });

  const idRaw = get("id");
  if (idRaw && !isUuid(idRaw)) return bad("Bad request.");
  const topic = get("topic_id");
  if (!isUuid(topic)) return bad("Pick a topic.");
  const lang = get("lang");
  if (lang !== "en" && lang !== "bn") return bad("Pick English or Bangla.");

  const text = get("text").replace(/\r\n?/g, "\n").trim();
  if (!text) return bad("Write the question.");
  if (text.length > LIMITS.text) return bad(`The question is over ${LIMITS.text} characters.`);

  const options = OPTION_LABELS.map((label) => ({ label, text: get(`option_${label}`).replace(/\s*\n\s*/g, " ").trim() }));
  for (const o of options) {
    if (!o.text) return bad(`Option ${o.label} is empty.`);
    if (o.text.length > LIMITS.option) return bad(`Option ${o.label} is over ${LIMITS.option} characters.`);
  }
  const lowered = options.map((o) => o.text.toLowerCase());
  if (new Set(lowered).size !== lowered.length) return bad("Two options have the same text.");

  const correct = get("correct");
  if (!(OPTION_LABELS as readonly string[]).includes(correct)) return bad("Mark one option as the correct answer.");

  const explanation = get("explanation").replace(/\r\n?/g, "\n").trim();
  if (explanation.length > LIMITS.explanation) return bad(`The explanation is over ${LIMITS.explanation} characters.`);

  const pageRaw = get("source_page").trim();
  let page: number | null = null;
  if (pageRaw) {
    if (!/^\d+$/.test(pageRaw) || Number(pageRaw) < 1 || Number(pageRaw) > LIMITS.page) return bad(`The source page must be a number from 1 to ${LIMITS.page}.`);
    page = Number(pageRaw);
  }

  const figureRaw = get("figure_id");
  if (figureRaw && !isUuid(figureRaw)) return bad("Bad request.");

  if (intent === "approve") {
    if (!explanation) return bad("An approved question needs an explanation.");
    if (page === null) return bad("An approved question needs the source page.");
    const parts = { question: text, explanation, ...Object.fromEntries(options.map((o) => [`option ${o.label}`, o.text])) };
    for (const [name, value] of Object.entries(parts)) {
      if (hasUnclosedDollar(value)) return bad(`The ${name} has a $ that is not closed. Write a real dollar sign as \\$.`);
    }
  }

  return {
    ok: true,
    value: {
      id: idRaw || null,
      topic_id: topic,
      lang,
      text,
      figure_id: figureRaw || null,
      source_page: page,
      options: options as QuestionInput["options"],
      correct: correct as OptionLabel,
      explanation,
      status: intent === "approve" ? "approved" : "draft",
    },
  };
}

// The database raises plain-English messages (errcode P0001) for rule violations. Show those, hide everything else.
export function dbMessage(error: { code?: string; message?: string } | null | undefined, fallback: string): string {
  if (error?.code === "P0001" && error.message) return error.message;
  if (error?.code === "42501") return "Only the admin can do that.";
  return fallback;
}

export type QuestionFilters = {
  subject: string | null;
  topic: string | null;
  status: "all" | "draft" | "approved";
  lang: "all" | "en" | "bn";
  q: string;
  page: number;
};

// Filters come from the page URL, so a list can be bookmarked or shared. Anything unexpected falls back to "all".
export function parseFilters(params: Record<string, string | string[] | undefined>): QuestionFilters {
  const one = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const status = one("status");
  const lang = one("lang");
  const page = Number.parseInt(one("page"), 10);
  return {
    subject: isUuid(one("subject")) ? one("subject") : null,
    topic: isUuid(one("topic")) ? one("topic") : null,
    status: status === "draft" || status === "approved" ? status : "all",
    lang: lang === "en" || lang === "bn" ? lang : "all",
    q: one("q").trim().slice(0, 100),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

// The URL for a filter set, leaving out anything at its default.
export function filterHref(base: string, f: Partial<QuestionFilters>): string {
  const p = new URLSearchParams();
  if (f.subject) p.set("subject", f.subject);
  if (f.topic) p.set("topic", f.topic);
  if (f.status && f.status !== "all") p.set("status", f.status);
  if (f.lang && f.lang !== "all") p.set("lang", f.lang);
  if (f.q) p.set("q", f.q);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

// Makes a search word safe inside an ilike pattern: % and _ are plain letters, not wildcards.
export function escapeLike(word: string): string {
  return word.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function pageCount(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}
