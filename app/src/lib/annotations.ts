// Highlights and comments in the note viewer. Pure helpers, tested with `npm test`.

export const HIGHLIGHT_COLORS = ["yellow", "green", "pink"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

// A box on a page as fractions of the page size, so it stays right at every zoom level.
export type Rect = { x: number; y: number; w: number; h: number };

export type Annotation = {
  id: string;
  page: number;
  kind: "highlight" | "comment";
  color: HighlightColor;
  quote: string;
  rects: Rect[];
  comment: string | null;
  // A picture of the highlighted area exists (loaded from /api/notes/<topic>/annotations/<id>/clip).
  has_clip: boolean;
  created_at: string;
};

// The columns the viewer and the notes library read.
export const ANNOTATION_COLUMNS = "id, topic_id, page, kind, color, quote, rects, comment, has_clip, created_at";

type AnnotationRowLike = { id: string; page: number; kind: string; color: string; quote: string; rects: unknown; comment: string | null; has_clip: boolean; created_at: string };

export function toAnnotation(row: AnnotationRowLike): Annotation {
  return {
    id: row.id,
    page: row.page,
    kind: row.kind === "comment" ? "comment" : "highlight",
    color: isColor(row.color) ? row.color : "yellow",
    quote: row.quote,
    rects: cleanRects(row.rects),
    comment: row.comment,
    has_clip: row.has_clip,
    created_at: row.created_at,
  };
}

export const MAX_RECTS = 200;
export const MAX_QUOTE = 2000;
export const MAX_COMMENT = 1000;
export const MAX_CLIP = 150000;

// The picture of a highlight from a request: an image data URL of a sane size, or null.
export function cleanClip(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > MAX_CLIP) return null;
  return /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(raw) ? raw : null;
}

export function clipHref(topicId: string, id: string): string {
  return `/api/notes/${topicId}/annotations/${id}/clip`;
}

export function isColor(v: unknown): v is HighlightColor {
  return typeof v === "string" && (HIGHLIGHT_COLORS as readonly string[]).includes(v);
}

const fraction = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null);

// Rects from a request: keeps the well formed ones, clamps them to the page and rounds to 5 places.
export function cleanRects(raw: unknown): Rect[] {
  if (!Array.isArray(raw)) return [];
  const out: Rect[] = [];
  for (const r of raw.slice(0, MAX_RECTS)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const x = fraction(o.x);
    const y = fraction(o.y);
    const w = fraction(o.w);
    const h = fraction(o.h);
    if (x === null || y === null || w === null || h === null || w <= 0 || h <= 0) continue;
    const round = (n: number) => Math.round(n * 100000) / 100000;
    out.push({ x: round(x), y: round(y), w: round(Math.min(w, 1 - x)), h: round(Math.min(h, 1 - y)) });
  }
  return out;
}

export function cleanText(raw: unknown, max: number): string {
  // Some note fonts give a NUL character inside words when copied; the database cannot store it.
  return typeof raw === "string" ? raw.replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

// A comment keeps its line breaks, but not runs of blank lines.
export function cleanComment(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_COMMENT) : "";
}

// The text layer gives one box per word or phrase. Boxes on the same line that touch are joined into one, so a highlight
// is a few bars instead of dozens of slivers.
export function mergeLineRects(rects: Rect[]): Rect[] {
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const out: Rect[] = [];
  for (const r of sorted) {
    const prev = out[out.length - 1];
    if (prev) {
      const overlap = Math.min(prev.y + prev.h, r.y + r.h) - Math.max(prev.y, r.y);
      const sameLine = overlap > Math.min(prev.h, r.h) * 0.6;
      const gap = r.x - (prev.x + prev.w);
      if (sameLine && gap < 0.02 && gap > -1) {
        const top = Math.min(prev.y, r.y);
        const bottom = Math.max(prev.y + prev.h, r.y + r.h);
        const right = Math.max(prev.x + prev.w, r.x + r.w);
        prev.y = top;
        prev.h = bottom - top;
        prev.w = right - prev.x;
        continue;
      }
    }
    out.push({ ...r });
  }
  return out;
}

// A short line for lists: the highlighted words, cut at a word edge.
export function snippet(text: string, max = 110): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).trimEnd()}...`;
}
