"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";
import Link from "@/components/NavLink";
import { AccentTitle } from "@/components/AccentTitle";
import { StartExamForm } from "@/components/StartExamForm";
import { noteHref, readingPercent } from "@/lib/notes";

type Pdfjs = typeof import("pdfjs-dist");

export type ViewerTopic = { id: string; number: number; title: string };
type Props = {
  topicId: string;
  title: string;
  subject: string;
  initialPage: number;
  related: ViewerTopic[];
  topicsParam: string[];
  exam: string | null;
  setId: string | null;
  start: { examId: string; setId: string; topicIds: string[] } | null;
  backHref: string;
};

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const MAX_FIT = 2.2;

// The themed note viewer (PLAN.md section 6.2). pdf.js draws each page onto a canvas inside our own cards, with a text
// layer on top so the text stays selectable. Only the pages near the screen are drawn: pages that scroll away are freed.
// The PDF comes from a short-lived signed link (/api/notes/<id>), and there is no download button.
export function NoteViewer({ topicId, title, subject, initialPage, related, topicsParam, exam, setId, start, backHref }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<{ w: number; h: number }[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [page, setPage] = useState(initialPage);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [width, setWidth] = useState(0);
  const [jump, setJump] = useState(String(initialPage));

  const lib = useRef<Pdfjs | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef<(HTMLDivElement | null)[]>([]);
  const jobs = useRef(new Map<number, () => void>());
  const pageRef = useRef(initialPage);
  const placed = useRef(false);
  const lastSaved = useRef(0);

  const numPages = sizes.length;

  // ---- load the PDF through a signed link
  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => unknown } | null = null;
    (async () => {
      try {
        const res = await fetch(`/api/notes/${topicId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "The note could not be loaded.");
        const { url } = (await res.json()) as { url: string };
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        lib.current = pdfjs;
        const loading = pdfjs.getDocument({ url });
        task = loading;
        const loaded = await loading.promise;
        if (cancelled) return;
        const measured: { w: number; h: number }[] = [];
        for (let i = 1; i <= loaded.numPages; i++) {
          const v = (await loaded.getPage(i)).getViewport({ scale: 1 });
          measured.push({ w: v.width, h: v.height });
        }
        if (cancelled) return;
        setDoc(loaded);
        setSizes(measured);
        setState("ready");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "The note could not be loaded.");
          setState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [topicId]);

  // ---- available width, for "fit width"
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [state]);

  const widest = useMemo(() => Math.max(1, ...sizes.map((s) => s.w)), [sizes]);
  const scale = zoom === "fit" ? Math.min(MAX_FIT, Math.max(0.3, (width - 6) / widest)) : zoom;

  // ---- draw and free pages as they come near the screen
  const draw = useCallback(
    async (n: number) => {
      const el = pageEls.current[n - 1];
      const pdfjs = lib.current;
      if (!doc || !el || !pdfjs) return;
      const canvas = el.querySelector("canvas");
      const text = el.querySelector<HTMLDivElement>(".textLayer");
      if (!canvas || !text) return;
      jobs.current.get(n)?.();
      let cancelled = false;
      let cancelPdf: () => void = () => {};
      jobs.current.set(n, () => {
        cancelled = true;
        cancelPdf();
      });
      try {
        const p = await doc.getPage(n);
        if (cancelled) return;
        const viewport = p.getViewport({ scale });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const task = p.render({ canvas, viewport, transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0] });
        cancelPdf = () => task.cancel();
        await task.promise;
        if (cancelled) return;
        text.replaceChildren();
        text.style.setProperty("--total-scale-factor", String(scale));
        const layer = new pdfjs.TextLayer({ textContentSource: p.streamTextContent(), container: text, viewport });
        cancelPdf = () => layer.cancel();
        await layer.render();
      } catch (e) {
        if ((e as Error)?.name !== "RenderingCancelledException") console.error("Page render failed", e);
      }
    },
    [doc, scale],
  );

  useEffect(() => {
    if (!doc || numPages === 0) return;
    const jobsMap = jobs.current;
    const free = (n: number) => {
      jobsMap.get(n)?.();
      jobsMap.delete(n);
      const el = pageEls.current[n - 1];
      const canvas = el?.querySelector("canvas");
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      el?.querySelector(".textLayer")?.replaceChildren();
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.page);
          if (e.isIntersecting) void draw(n);
          else free(n);
        }
      },
      { rootMargin: "100% 0px 100% 0px" },
    );
    pageEls.current.forEach((el) => el && io.observe(el));
    return () => {
      io.disconnect();
      for (let n = 1; n <= numPages; n++) free(n);
    };
  }, [doc, numPages, draw]);

  // ---- which page is in view, and jumping to one
  const goTo = useCallback(
    (n: number, smooth = false) => {
      const target = Math.min(Math.max(1, n), Math.max(1, numPages));
      pageEls.current[target - 1]?.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
      pageRef.current = target;
      setPage(target);
      setJump(String(target));
    },
    [numPages],
  );

  useEffect(() => {
    if (state !== "ready" || width === 0) return;
    if (!placed.current) {
      placed.current = true;
      requestAnimationFrame(() => goTo(initialPage));
    }
  }, [state, width, goTo, initialPage]);

  // After a zoom the heights change, so keep the current page at the top.
  const lastScale = useRef(scale);
  useEffect(() => {
    if (!placed.current || lastScale.current === scale) return;
    lastScale.current = scale;
    requestAnimationFrame(() => goTo(pageRef.current));
  }, [scale, goTo]);

  useEffect(() => {
    if (state !== "ready") return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const line = 120 + window.innerHeight * 0.25;
        let current = 1;
        pageEls.current.forEach((el, i) => {
          if (el && el.getBoundingClientRect().top <= line) current = i + 1;
        });
        if (current !== pageRef.current) {
          pageRef.current = current;
          setPage(current);
          setJump(String(current));
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [state]);

  // ---- remember the page (resume next time)
  useEffect(() => {
    if (state !== "ready" || !placed.current || page === lastSaved.current) return;
    const send = (keepalive: boolean) => {
      lastSaved.current = page;
      void fetch(`/api/notes/${topicId}/progress`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page }), keepalive }).catch(() => {});
    };
    const timer = window.setTimeout(() => send(false), 1500);
    const flush = () => document.visibilityState === "hidden" && send(true);
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [page, state, topicId]);

  // ---- keys: left and right arrows turn the page when no field has focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select, button")) return;
      if (e.key === "ArrowRight") goTo(pageRef.current + 1, true);
      if (e.key === "ArrowLeft") goTo(pageRef.current - 1, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo]);

  const zoomBy = (dir: 1 | -1) => {
    const now = scale;
    const next = dir === 1 ? ZOOMS.find((z) => z > now + 0.01) : [...ZOOMS].reverse().find((z) => z < now - 0.01);
    if (next) setZoom(next);
  };

  const percent = readingPercent(page, numPages);

  return (
    <div className="nv">
      <header className="nv-top">
        <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
          <div className="stack-sm">
            <div className="nv-head">
              <Link href={backHref} className="small">
                Back
              </Link>
              <AccentTitle title={title} />
            </div>
            <p className="small muted nv-sub">{subject}</p>
          </div>
          <div className="wrap">
            <span className="timer-pill" aria-live="polite">
              PAGE{" "}
              <b>
                {page} / {numPages || "..."}
              </b>
            </span>
            <div className="zoom" role="group" aria-label="Zoom">
              <button type="button" className="btn btn-small btn-icon" onClick={() => zoomBy(-1)} aria-label="Zoom out" disabled={state !== "ready"}>
                <Minus size={16} strokeWidth={2} aria-hidden />
              </button>
              <button type="button" className="btn btn-small btn-icon" onClick={() => zoomBy(1)} aria-label="Zoom in" disabled={state !== "ready"}>
                <Plus size={16} strokeWidth={2} aria-hidden />
              </button>
              <button type="button" className="btn btn-small" onClick={() => setZoom("fit")} disabled={state !== "ready"}>
                <Maximize2 size={14} strokeWidth={2} aria-hidden /> Fit width
              </button>
            </div>
          </div>
        </div>
        {related.length > 1 ? (
          <nav className="wrap" aria-label="Notes in this exam">
            {related.map((t) => (
              <Link key={t.id} href={noteHref(t.id, { topics: topicsParam, exam, set: setId })} className="pill" aria-current={t.id === topicId ? "page" : undefined}>
                {t.number}. {t.title}
              </Link>
            ))}
          </nav>
        ) : null}
        <div className="nv-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Reading progress">
          <i style={{ width: `${percent}%` }} />
        </div>
      </header>

      <div className="nv-body">
        <aside className="nv-thumbs" aria-label="Pages">
          {sizes.map((s, i) => (
            <Thumb key={i} doc={doc} n={i + 1} ratio={s.h / s.w} active={page === i + 1} onClick={() => goTo(i + 1, true)} />
          ))}
        </aside>

        <div className="nv-main" ref={mainRef} onContextMenu={(e) => e.preventDefault()}>
          {state === "loading" ? <p className="small muted">Loading the note...</p> : null}
          {state === "error" ? (
            <div className="card stack-sm" role="alert">
              <p className="row-name">The note could not be opened</p>
              <p className="small">{error}</p>
            </div>
          ) : null}
          {sizes.map((s, i) => (
            <div
              key={i}
              ref={(el) => {
                pageEls.current[i] = el;
              }}
              data-page={i + 1}
              className="nv-page"
              style={{ width: Math.floor(s.w * scale), height: Math.floor(s.h * scale) }}
              aria-label={`Page ${i + 1} of ${numPages}`}
            >
              <canvas />
              <div className="textLayer" />
            </div>
          ))}
        </div>
      </div>

      <footer className="nv-bottom">
        <div className="wrap">
          <button type="button" className="btn btn-small btn-icon" onClick={() => goTo(page - 1, true)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft size={16} strokeWidth={2} aria-hidden />
          </button>
          <button type="button" className="btn btn-small btn-icon" onClick={() => goTo(page + 1, true)} disabled={page >= numPages} aria-label="Next page">
            <ChevronRight size={16} strokeWidth={2} aria-hidden />
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number.parseInt(jump, 10);
              if (Number.isInteger(n)) goTo(n, true);
            }}
          >
            <label className="sr-only" htmlFor="nv-jump">Go to page</label>
            <input id="nv-jump" className="input input-sm nv-jump" inputMode="numeric" value={jump} onChange={(e) => setJump(e.target.value)} onBlur={() => setJump(String(page))} />
          </form>
        </div>
        <div className="wrap">
          <span className="small muted nv-resume">Resumes on page {page} next time</span>
          {start ? <StartExamForm examId={start.examId} setId={start.setId} topicIds={start.topicIds} /> : null}
        </div>
      </footer>
    </div>
  );
}

// A small picture of a page for the drawer on the left, drawn once when it first comes into view.
function Thumb({ doc, n, ratio, active, onClick }: { doc: PDFDocumentProxy | null; n: number; ratio: number; active: boolean; onClick: () => void }) {
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
        const viewport = p.getViewport({ scale: (96 * Math.min(window.devicePixelRatio || 1, 2)) / v1.width });
        canvas.current.width = Math.floor(viewport.width);
        canvas.current.height = Math.floor(viewport.height);
        await p.render({ canvas: canvas.current, viewport }).promise.catch(() => {});
      },
      { rootMargin: "200px" },
    );
    io.observe(box.current);
    return () => io.disconnect();
  }, [doc, n]);
  return (
    <button type="button" ref={box} className={`nv-thumb${active ? " nv-thumb-on" : ""}`} onClick={onClick} aria-label={`Go to page ${n}`} aria-current={active ? "page" : undefined} style={{ aspectRatio: `1 / ${ratio}` }}>
      <canvas ref={canvas} />
      <span>{n}</span>
    </button>
  );
}
