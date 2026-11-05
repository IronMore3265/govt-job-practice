"use client";

import { useEffect, useMemo, useRef } from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { snippet, type Annotation } from "@/lib/annotations";

export type SideTab = "pages" | "marks";

type Props = {
  open: boolean;
  tab: SideTab;
  onTab: (tab: SideTab) => void;
  doc: PDFDocumentProxy | null;
  sizes: { w: number; h: number }[];
  page: number;
  marks: Annotation[];
  onPage: (n: number) => void;
  onMark: (m: Annotation) => void;
  onEdit: (m: Annotation) => void;
  onDelete: (m: Annotation) => void;
};

// The drawer beside (on a phone: over) the note. "Pages" is a grid of page pictures with the number under each, "Marks" is
// the student's own highlights and comments for this note. The list scrolls on its own and only follows the current page
// when the student is not scrolling it themselves.
export function NoteSidebar({ open, tab, onTab, doc, sizes, page, marks, onPage, onMark, onEdit, onDelete }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const touched = useRef(0);
  const marked = useMemo(() => new Set(marks.map((m) => m.page)), [marks]);

  useEffect(() => {
    if (!open || tab !== "pages" || Date.now() - touched.current < 4000) return;
    panel.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "center" });
  }, [open, tab, page]);

  const touch = () => {
    touched.current = Date.now();
  };

  return (
    <aside className="nv-side" aria-label="Pages and marks" hidden={!open}>
      <div className="nv-tabs" role="tablist">
        <button type="button" role="tab" className="nv-tab" aria-selected={tab === "pages"} onClick={() => onTab("pages")}>
          Pages
        </button>
        <button type="button" role="tab" className="nv-tab" aria-selected={tab === "marks"} onClick={() => onTab("marks")}>
          My marks{marks.length ? ` (${marks.length})` : ""}
        </button>
      </div>

      <div className="nv-panel" ref={panel} onPointerDown={touch} onWheel={touch} onTouchMove={touch}>
        {tab === "pages" ? (
          <div className="nv-grid">
            {sizes.map((s, i) => (
              <Thumb key={i} doc={doc} n={i + 1} ratio={s.h / s.w} active={page === i + 1} marked={marked.has(i + 1)} onClick={() => onPage(i + 1)} />
            ))}
          </div>
        ) : marks.length === 0 ? (
          <p className="small muted nv-empty">Select some text in the note, then choose a colour to highlight it or Comment to add a note. Only you can see your marks, and they stay saved.</p>
        ) : (
          <ul className="nv-marks-list">
            {marks.map((m) => (
              <li key={m.id} className="nv-mark">
                <button type="button" className="nv-mark-go" onClick={() => onMark(m)}>
                  <span className="nv-mark-meta">
                    <i className={`nv-dot nv-dot-${m.color}`} aria-hidden />
                    Page {m.page}
                  </span>
                  {m.quote ? <span className={`nv-mark-quote nv-q-${m.color}`}>{snippet(m.quote)}</span> : null}
                  {m.comment ? <span className="nv-mark-comment">{m.comment}</span> : null}
                </button>
                <span className="nv-mark-acts">
                  <button type="button" className="nv-mark-act" onClick={() => onEdit(m)} aria-label={m.comment ? "Edit comment" : "Add a comment"}>
                    <MessageSquare aria-hidden />
                  </button>
                  <button type="button" className="nv-mark-act" onClick={() => onDelete(m)} aria-label="Delete this mark">
                    <Trash2 aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

// A picture of one page, drawn once when it first scrolls into view, with its number underneath.
function Thumb({ doc, n, ratio, active, marked, onClick }: { doc: PDFDocumentProxy | null; n: number; ratio: number; active: boolean; marked: boolean; onClick: () => void }) {
  const box = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawn = useRef(false);
  useEffect(() => {
    if (!doc || !box.current) return;
    const io = new IntersectionObserver(
      async ([e]) => {
        if (!e.isIntersecting || drawn.current || !canvas.current) return;
        drawn.current = true;
        const p = await doc.getPage(n);
        const v1 = p.getViewport({ scale: 1 });
        const viewport = p.getViewport({ scale: (180 * Math.min(window.devicePixelRatio || 1, 2)) / v1.width });
        const c = canvas.current;
        if (!c) return;
        c.width = Math.floor(viewport.width);
        c.height = Math.floor(viewport.height);
        await p.render({ canvas: c, viewport }).promise.catch(() => {});
      },
      { rootMargin: "300px" },
    );
    io.observe(box.current);
    return () => io.disconnect();
  }, [doc, n]);
  return (
    <button type="button" ref={box} className={`nv-thumb${active ? " nv-thumb-on" : ""}`} onClick={onClick} aria-label={`Go to page ${n}`} aria-current={active ? "page" : undefined}>
      <span className="nv-thumb-img" style={{ aspectRatio: `1 / ${ratio}` }}>
        <canvas ref={canvas} />
        {marked ? <i className="nv-thumb-dot" aria-label="Has a mark" /> : null}
      </span>
      <span className="nv-thumb-n">{n}</span>
    </button>
  );
}
