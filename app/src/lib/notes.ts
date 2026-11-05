// Note viewer helpers (PLAN.md section 6). Pure functions, tested with `npm test`.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The viewer is opened from Home with the topics the student picked: `?topics=id1,id2`. Keeps valid, distinct ids in order.
export function parseTopicList(raw: string | string[] | undefined, max = 30): string[] {
  const text = Array.isArray(raw) ? raw[0] : raw;
  if (!text) return [];
  const out: string[] = [];
  for (const part of text.split(",")) {
    const id = part.trim();
    if (UUID.test(id) && !out.includes(id)) out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

// A page number from a URL or a request: a whole number from 1 to the page count (or 10000 when the count is unknown).
export function clampPage(raw: unknown, pages: number | null | undefined): number | null {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return Math.min(n, pages && pages > 0 ? pages : 10000);
}

// The page to open: an explicit `?page=` (a link from an explanation) wins, then where the student stopped last time.
export function startPage(opts: { requested: unknown; saved: number | null | undefined; pages: number | null | undefined }): number {
  return clampPage(opts.requested, opts.pages) ?? clampPage(opts.saved, opts.pages) ?? 1;
}

// Reading progress as a share of the note, 0 to 100.
export function readingPercent(page: number, pages: number): number {
  if (pages <= 0) return 0;
  return Math.round((Math.min(Math.max(page, 1), pages) / pages) * 100);
}

// The link to the viewer, used by the notes library, Home and the explanation links in the review.
export function noteHref(topicId: string, opts: { page?: number | null; topics?: readonly string[]; exam?: string | null; set?: string | null; chunk?: number | null; narrow?: boolean } = {}): string {
  const p = new URLSearchParams();
  if (opts.page && opts.page > 1) p.set("page", String(opts.page));
  if (opts.topics?.length) p.set("topics", opts.topics.join(","));
  if (opts.exam) p.set("exam", opts.exam);
  if (opts.set) p.set("set", opts.set);
  if (opts.chunk) p.set("chunk", String(opts.chunk));
  if (opts.narrow) p.set("narrow", "1");
  const q = p.toString();
  return q ? `/notes/${topicId}?${q}` : `/notes/${topicId}`;
}
