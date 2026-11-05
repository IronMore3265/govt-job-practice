"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Download, MessageSquare, Minus, PanelLeft, Plus, Trash2, X } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";
import Link from "@/components/NavLink";
import { AccentTitle } from "@/components/AccentTitle";
import { NoteSidebar, type SideTab } from "@/components/NoteSidebar";
import { StartExamForm } from "@/components/StartExamForm";
import { cleanRects, cleanText, clipHref, HIGHLIGHT_COLORS, MAX_COMMENT, MAX_QUOTE, mergeLineRects, type Annotation, type HighlightColor, type Rect } from "@/lib/annotations";
import { noteHref, readingPercent } from "@/lib/notes";

type Pdfjs = typeof import("pdfjs-dist");

export type ViewerTopic = { id: string; number: number; title: string };
type Props = {
  topicId: string;
  title: string;
  subject: string;
  initialPage: number;
  initialMarks: Annotation[];
  related: ViewerTopic[];
  topicsParam: string[];
  exam: string | null;
  setId: string | null;
  start: { examId: string; setId: string; topicIds: string[]; chunk: number | null } | null;
  backHref: string;
};

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 4;
const MAX_FIT = 2.2;
const PHONE = 860;

// A part of the student's text selection that lies on one page.
type Part = { page: number; rects: Rect[]; quote: string; clip?: string | null };
// The point of the note under the centre of a zoom, kept in place when the page sizes change.
type Anchor = { page: number; fx: number; fy: number; cx: number; cy: number };
type Editor = { id: string | null; text: string; clipSrc: string | null; color: HighlightColor; parts: Part[] };

const pct = (n: number) => `${(n * 100).toFixed(3)}%`;
const byPageThenTime = (a: Annotation, b: Annotation) => a.page - b.page || a.created_at.localeCompare(b.created_at);

// The selected text as boxes on each page, in fractions of the page so they stay right at any zoom.
function readSelection(main: HTMLElement, pages: (HTMLDivElement | null)[]): Part[] {
  const s = window.getSelection();
  if (!s || s.isCollapsed || s.rangeCount === 0) return [];
  const range = s.getRangeAt(0);
  if (!main.contains(range.commonAncestorContainer)) return [];
  const client = Array.from(range.getClientRects());
  const parts: Part[] = [];
  pages.forEach((el, i) => {
    const layer = el?.querySelector<HTMLElement>(".textLayer");
    if (!layer || !range.intersectsNode(layer)) return;
    const box = layer.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return;
    const rects: Rect[] = [];
    for (const r of client) {
      // Tall boxes are wrappers around a whole block, not a line of text.
      if (r.width < 1 || r.height < 1 || r.height > box.height * 0.08) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cx < box.left || cx > box.right || cy < box.top || cy > box.bottom) continue;
      rects.push({ x: (r.left - box.left) / box.width, y: (r.top - box.top) / box.height, w: r.width / box.width, h: r.height / box.height });
    }
    const clean = cleanRects(mergeLineRects(rects));
    if (!clean.length) return;
    // The words of this page only, when the selection runs over several pages.
    const mine = document.createRange();
    mine.selectNodeContents(layer);
    if (mine.compareBoundaryPoints(Range.START_TO_START, range) < 0) mine.setStart(range.startContainer, range.startOffset);
    if (mine.compareBoundaryPoints(Range.END_TO_END, range) > 0) mine.setEnd(range.endContainer, range.endOffset);
    parts.push({ page: i + 1, rects: clean, quote: cleanText(mine.toString(), MAX_QUOTE) });
  });
  return parts;
}

// A picture of the highlighted area: the page drawn through a window around the highlighted boxes. The words come out exactly
// as printed, which the text copied from the PDF does not for Bangla. The colour is added when it is shown, so it can change.
async function makeClip(doc: PDFDocumentProxy, page: number, rects: Rect[]): Promise<string | null> {
  try {
    const p = await doc.getPage(page);
    const v1 = p.getViewport({ scale: 1 });
    const pad = 0.006;
    const x0 = Math.max(0, Math.min(...rects.map((r) => r.x)) - pad);
    const y0 = Math.max(0, Math.min(...rects.map((r) => r.y)) - pad);
    const x1 = Math.min(1, Math.max(...rects.map((r) => r.x + r.w)) + pad);
    const y1 = Math.min(1, Math.max(...rects.map((r) => r.y + r.h)) + pad);
    const wPt = (x1 - x0) * v1.width;
    const scale = Math.min(6, Math.max(0.8, 640 / wPt));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(wPt * scale));
    canvas.height = Math.max(1, Math.min(420, Math.ceil((y1 - y0) * v1.height * scale)));
    const viewport = p.getViewport({ scale, offsetX: -x0 * v1.width * scale, offsetY: -y0 * v1.height * scale });
    await p.render({ canvas, viewport }).promise;
    for (const type of ["image/webp", "image/jpeg"]) {
      const url = canvas.toDataURL(type, 0.72);
      if (url.startsWith(`data:${type}`) && url.length <= 150000) return url;
    }
    return null;
  } catch {
    return null;
  }
}

// The themed note viewer (PLAN.md section 6.2). pdf.js draws each page onto a canvas inside our own cards, with a text
// layer on top so the text stays selectable. Only the pages near the screen are drawn: pages that scroll away are freed.
// The PDF comes from a short-lived signed link (/api/notes/<id>). The Download button goes through /api/notes/<id>/download.
//
// The viewer is a fixed shell: the notes scroll inside their own box and the top and bottom bars never move, so zooming
// the note (buttons, menu or two-finger pinch) cannot drag the bars with it. On a phone the bars slide away while reading.
export function NoteViewer({ topicId, title, subject, initialPage, initialMarks, related, topicsParam, exam, setId, start, backHref }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<{ w: number; h: number }[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [page, setPage] = useState(initialPage);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [width, setWidth] = useState(0);
  const [jump, setJump] = useState(String(initialPage));
  const [side, setSide] = useState(false);
  const [tab, setTab] = useState<SideTab>("pages");
  const [topH, setTopH] = useState(64);
  const [botH, setBotH] = useState(60);
  const [slid, setSlid] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [marks, setMarks] = useState<Annotation[]>(initialMarks);
  const [sel, setSel] = useState<Part[] | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [lastColor, setLastColor] = useState<HighlightColor>("yellow");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const lib = useRef<Pdfjs | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLElement>(null);
  const botRef = useRef<HTMLElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef<(HTMLDivElement | null)[]>([]);
  const jobs = useRef(new Map<number, () => void>());
  const pageRef = useRef(initialPage);
  const placed = useRef(false);
  const lastSaved = useRef(0);
  const topHRef = useRef(topH);
  const suppressUntil = useRef(0);
  const holdSel = useRef(0);
  const anchor = useRef<Anchor | null>(null);
  const lock = useRef(false);

  const numPages = sizes.length;
  // The bars stay while something is open that the student is working in.
  const active = marks.find((m) => m.id === activeId) ?? null;
  const locked = side || Boolean(sel) || Boolean(editor) || Boolean(active) || zoomOpen;
  const barsAway = slid && !locked;

  useEffect(() => {
    lock.current = locked;
  }, [locked]);

  const flash = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice((n) => (n === text ? "" : n)), 4000);
  }, []);

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
  }, []);

  // ---- the bars sit over the note, so the note is padded by their real heights. The page drawer starts open on a wide screen only.
  useEffect(() => {
    const top = topRef.current;
    const bot = botRef.current;
    if (!top || !bot) return;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        setSide(window.innerWidth > PHONE);
      }
      topHRef.current = top.offsetHeight;
      setTopH(top.offsetHeight);
      setBotH(bot.offsetHeight);
    });
    ro.observe(top);
    ro.observe(bot);
    return () => ro.disconnect();
  }, []);

  const widest = useMemo(() => Math.max(1, ...sizes.map((s) => s.w)), [sizes]);
  const scale = zoom === "fit" ? Math.min(MAX_FIT, Math.max(MIN_ZOOM, (width - 6) / widest)) : zoom;
  const scaleRef = useRef(scale);

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
      { root: mainRef.current, rootMargin: "100% 0px 100% 0px" },
    );
    pageEls.current.forEach((el) => el && io.observe(el));
    return () => {
      io.disconnect();
      for (let n = 1; n <= numPages; n++) free(n);
    };
  }, [doc, numPages, draw]);

  // ---- which page is in view, and jumping to one
  // `fy` is how far down the page (0 to 1) to land, for a jump to a highlight.
  const goTo = useCallback(
    (n: number, smooth = false, fy = 0) => {
      const target = Math.min(Math.max(1, n), Math.max(1, numPages));
      pageRef.current = target;
      setPage(target);
      setJump(String(target));
      const el = pageEls.current[target - 1];
      const main = mainRef.current;
      if (!el || !main) return;
      suppressUntil.current = Date.now() + (smooth ? 900 : 300);
      setSlid(false);
      const down = fy > 0 ? el.offsetHeight * fy - 70 : 0;
      // The top padding is 14px with the bars showing and taller while they are away; either way the page lands 8px below the top bar.
      const padTop = parseFloat(getComputedStyle(main).paddingTop) || 0;
      main.scrollTo({ top: Math.max(0, el.offsetTop - padTop + 6 + down), behavior: smooth ? "smooth" : "auto" });
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

  // After a zoom the heights change, so keep the same spot of the note under the same spot of the screen.
  const lastScale = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
    if (!placed.current || lastScale.current === scale) return;
    lastScale.current = scale;
    const a = anchor.current;
    anchor.current = null;
    suppressUntil.current = Date.now() + 500;
    requestAnimationFrame(() => {
      const main = mainRef.current;
      const el = pageEls.current[a ? a.page : pageRef.current - 1];
      if (!main || !el) return;
      if (a) main.scrollTo({ left: el.offsetLeft + a.fx * el.offsetWidth - a.cx, top: el.offsetTop + a.fy * el.offsetHeight - a.cy });
      else goTo(pageRef.current);
    });
  }, [scale, goTo]);

  // Where in the note a point of the notes box is, as a page and fractions of it.
  const captureAnchor = useCallback((cx: number, cy: number): Anchor | null => {
    const main = mainRef.current;
    if (!main) return null;
    const r = main.getBoundingClientRect();
    const x = r.left + cx;
    const y = r.top + cy;
    let best = -1;
    let bestGap = Infinity;
    pageEls.current.forEach((el, i) => {
      if (!el) return;
      const b = el.getBoundingClientRect();
      const gap = y < b.top ? b.top - y : y > b.bottom ? y - b.bottom : 0;
      if (gap < bestGap) {
        bestGap = gap;
        best = i;
      }
    });
    const el = pageEls.current[best];
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { page: best, fx: (x - b.left) / b.width, fy: (y - b.top) / b.height, cx, cy };
  }, []);

  const applyZoom = useCallback(
    (next: number | "fit") => {
      const main = mainRef.current;
      anchor.current = main ? captureAnchor(main.clientWidth / 2, main.clientHeight / 2) : null;
      setZoom(typeof next === "number" ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)) : next);
    },
    [captureAnchor],
  );

  const zoomBy = (dir: 1 | -1) => {
    const next = dir === 1 ? ZOOMS.find((z) => z > scale + 0.01) : [...ZOOMS].reverse().find((z) => z < scale - 0.01);
    if (next) applyZoom(next);
  };

  // ---- two-finger pinch zooms the note itself (the browser's own page zoom is switched off in the viewer, so the bars cannot break)
  useEffect(() => {
    const main = mainRef.current;
    const wrap = pagesRef.current;
    if (!main || !wrap) return;
    let g: { d: number; s: number; f: number; a: Anchor | null } | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const r = main.getBoundingClientRect();
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
      g = { d: dist(e.touches) || 1, s: scaleRef.current, f: 1, a: captureAnchor(cx, cy) };
      wrap.style.transformOrigin = `${cx + main.scrollLeft - wrap.offsetLeft}px ${cy + main.scrollTop - wrap.offsetTop}px`;
    };
    const onMove = (e: TouchEvent) => {
      if (!g || e.touches.length !== 2) return;
      e.preventDefault();
      g.f = Math.min(MAX_ZOOM / g.s, Math.max(MIN_ZOOM / g.s, dist(e.touches) / g.d));
      wrap.style.transform = `scale(${g.f})`;
    };
    const onEnd = (e: TouchEvent) => {
      if (!g || e.touches.length >= 2) return;
      const done = g;
      g = null;
      wrap.style.transform = "";
      wrap.style.transformOrigin = "";
      if (Math.abs(done.f - 1) < 0.03) return;
      anchor.current = done.a;
      setZoom(Math.round(done.s * done.f * 100) / 100);
    };
    main.addEventListener("touchstart", onStart, { passive: true });
    main.addEventListener("touchmove", onMove, { passive: false });
    main.addEventListener("touchend", onEnd, { passive: true });
    main.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      main.removeEventListener("touchstart", onStart);
      main.removeEventListener("touchmove", onMove);
      main.removeEventListener("touchend", onEnd);
      main.removeEventListener("touchcancel", onEnd);
    };
  }, [captureAnchor]);

  // ---- the current page follows the scroll; on a phone the bars slide away going down and come back going up
  useEffect(() => {
    const main = mainRef.current;
    if (state !== "ready" || !main) return;
    let frame = 0;
    let lastTop = main.scrollTop;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const line = topHRef.current + window.innerHeight * 0.25;
        let current = 1;
        pageEls.current.forEach((el, i) => {
          if (el && el.getBoundingClientRect().top <= line) current = i + 1;
        });
        if (current !== pageRef.current) {
          pageRef.current = current;
          setPage(current);
          setJump(String(current));
        }
        const dy = main.scrollTop - lastTop;
        lastTop = main.scrollTop;
        if (Date.now() <= suppressUntil.current) {
          // A jump we started is still scrolling (a long smooth scroll): keep waiting until it settles.
          suppressUntil.current = Date.now() + 250;
        } else if (window.innerWidth <= PHONE && !lock.current) {
          if (dy > 8 && main.scrollTop > 120) setSlid(true);
          else if (dy < -8) setSlid(false);
        }
      });
    };
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      main.removeEventListener("scroll", onScroll);
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

  // ---- keys: left and right arrows turn the page when no field has focus, Escape closes what is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setZoomOpen(false);
        setEditor(null);
        return;
      }
      if ((e.target as HTMLElement)?.closest("input, textarea, select, button")) return;
      if (e.key === "ArrowRight") goTo(pageRef.current + 1, true);
      if (e.key === "ArrowLeft") goTo(pageRef.current - 1, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo]);

  // ---- the zoom menu closes when something else is tapped
  useEffect(() => {
    if (!zoomOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!zoomRef.current?.contains(e.target as Node)) setZoomOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [zoomOpen]);

  // ---- selected text: a bar offers to highlight it or comment on it
  useEffect(() => {
    let timer = 0;
    const onChange = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const main = mainRef.current;
        // Tapping the bar itself can clear the selection first; the bar keeps its copy meanwhile.
        if (!main || Date.now() < holdSel.current) return;
        const parts = readSelection(main, pageEls.current);
        setSel(parts.length ? parts : null);
        if (parts.length) setActiveId(null);
      }, 220);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
    };
  }, []);

  const clearSelection = () => {
    window.getSelection()?.removeAllRanges();
    setSel(null);
  };

  const saveMarks = async (parts: Part[], color: HighlightColor, comment: string) => {
    const made: Annotation[] = [];
    for (const [i, p] of parts.entries()) {
      const clip = p.clip ?? (doc ? await makeClip(doc, p.page, p.rects) : null);
      const res = await fetch(`/api/notes/${topicId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: p.page, rects: p.rects, quote: p.quote, color, comment: i === 0 ? comment : "", clip }),
      }).catch(() => null);
      if (!res?.ok) {
        flash("Could not save that. Check your connection and try again.");
        break;
      }
      made.push(((await res.json()) as { annotation: Annotation }).annotation);
    }
    if (made.length) setMarks((prev) => [...prev, ...made].sort(byPageThenTime));
    return made.length === parts.length;
  };

  const highlight = async (color: HighlightColor) => {
    const parts = sel;
    if (!parts || busy) return;
    setLastColor(color);
    setBusy(true);
    clearSelection();
    await saveMarks(parts, color, "");
    setBusy(false);
  };

  const startComment = () => {
    if (!sel) return;
    const parts = sel;
    setEditor({ id: null, text: "", clipSrc: null, color: lastColor, parts });
    clearSelection();
    // The picture of the highlighted part, for the sheet and for saving.
    if (doc) {
      void Promise.all(parts.map(async (p) => ({ ...p, clip: await makeClip(doc, p.page, p.rects) }))).then((withClips) =>
        setEditor((e) => (e && !e.id && e.parts === parts ? { ...e, parts: withClips, clipSrc: withClips[0]?.clip ?? null } : e)),
      );
    }
  };

  const editMark = (m: Annotation) => {
    setActiveId(null);
    setEditor({ id: m.id, text: m.comment ?? "", clipSrc: m.has_clip ? clipHref(topicId, m.id) : null, color: m.color, parts: [] });
    if (window.innerWidth <= PHONE) setSide(false);
  };

  const saveEditor = async () => {
    if (!editor || busy) return;
    setBusy(true);
    const text = editor.text.trim();
    if (editor.id) {
      const res = await fetch(`/api/notes/${topicId}/annotations/${editor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: text, color: editor.color }),
      }).catch(() => null);
      if (res?.ok) {
        const { annotation } = (await res.json()) as { annotation: Annotation };
        setMarks((prev) => prev.map((m) => (m.id === annotation.id ? annotation : m)));
        setEditor(null);
      } else flash("Could not save that. Try again.");
    } else if (await saveMarks(editor.parts, editor.color, text)) {
      setLastColor(editor.color);
      setEditor(null);
    }
    setBusy(false);
  };

  const deleteMark = async (m: Annotation) => {
    if (m.comment && !window.confirm("Delete this comment?")) return;
    setMarks((prev) => prev.filter((x) => x.id !== m.id));
    setEditor(null);
    const res = await fetch(`/api/notes/${topicId}/annotations/${m.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setMarks((prev) => [...prev, m].sort(byPageThenTime));
      flash("Could not delete that. Try again.");
    }
  };

  const marksByPage = useMemo(() => {
    const map = new Map<number, Annotation[]>();
    for (const m of marks) map.set(m.page, [...(map.get(m.page) ?? []), m]);
    return map;
  }, [marks]);

  // Another colour for a mark you tapped.
  const recolor = async (m: Annotation, color: HighlightColor) => {
    if (m.color === color) return;
    setMarks((prev) => prev.map((x) => (x.id === m.id ? { ...x, color } : x)));
    setLastColor(color);
    const res = await fetch(`/api/notes/${topicId}/annotations/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ color }) }).catch(() => null);
    if (!res?.ok) {
      setMarks((prev) => prev.map((x) => (x.id === m.id ? { ...x, color: m.color } : x)));
      flash("Could not change the colour. Try again.");
    }
  };

  // Tapping a highlight (or its comment pin) brings its edit bar back.
  const onPagesClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    const s = window.getSelection();
    if (s && !s.isCollapsed) return;
    const pageEl = target.closest<HTMLElement>(".nv-page");
    const layer = pageEl?.querySelector<HTMLElement>(".textLayer");
    if (!pageEl || !layer) {
      setActiveId(null);
      return;
    }
    const box = layer.getBoundingClientRect();
    const fx = (e.clientX - box.left) / box.width;
    const fy = (e.clientY - box.top) / box.height;
    const slack = 0.004;
    const hit = [...(marksByPage.get(Number(pageEl.dataset.page)) ?? [])].reverse().find((m) => m.rects.some((r) => fx >= r.x - slack && fx <= r.x + r.w + slack && fy >= r.y - slack && fy <= r.y + r.h + slack));
    setActiveId(hit ? hit.id : null);
  };

  const showMark = (m: Annotation) => {
    goTo(m.page, true, m.rects[0]?.y ?? 0);
    if (window.innerWidth <= PHONE) setSide(false);
  };

  // Marks saved before pictures existed get theirs the first time the note is open.
  const backfilled = useRef(new Set<string>());
  useEffect(() => {
    if (!doc) return;
    const todo = marks.filter((m) => !m.has_clip && m.rects.length && !backfilled.current.has(m.id));
    if (!todo.length) return;
    todo.forEach((m) => backfilled.current.add(m.id));
    (async () => {
      for (const m of todo) {
        const clip = await makeClip(doc, m.page, m.rects);
        if (!clip) continue;
        const res = await fetch(`/api/notes/${topicId}/annotations/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clip }) }).catch(() => null);
        if (res?.ok) setMarks((prev) => prev.map((x) => (x.id === m.id ? { ...x, has_clip: true } : x)));
      }
    })();
  }, [doc, marks, topicId]);

  const percent = readingPercent(page, numPages);
  const zoomLabel = zoom === "fit" ? "Fit" : `${Math.round(scale * 100)}%`;
  const ready = state === "ready";

  return (
    <div className={`nv${barsAway ? " nv-away" : ""}`} style={{ "--nv-top": `${topH}px`, "--nv-bot": `${botH}px` } as CSSProperties}>
      <header className="nv-top" ref={topRef}>
        <div className="nv-top-row">
          <Link href={backHref} className="btn nv-btn nv-back" aria-label="Back">
            <ChevronLeft aria-hidden />
            <span className="nv-back-label">Back</span>
          </Link>
          <div className="nv-titles">
            <AccentTitle title={title} />
            <p className="small muted nv-sub">{subject}</p>
          </div>
          <a href={`/api/notes/${topicId}/download`} className="btn nv-btn nv-download" aria-label="Download this note as a PDF" aria-disabled={!ready}>
            <Download aria-hidden />
            <span>Download</span>
          </a>
        </div>
        {related.length > 1 ? (
          <nav className="nv-notes" aria-label="Notes in this exam">
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

      <NoteSidebar
        topicId={topicId}
        open={side}
        tab={tab}
        onTab={setTab}
        doc={doc}
        sizes={sizes}
        page={page}
        marks={marks}
        onPage={(n) => {
          goTo(n, true);
          if (window.innerWidth <= PHONE) setSide(false);
        }}
        onMark={showMark}
        onEdit={editMark}
        onDelete={(m) => void deleteMark(m)}
      />

      <div className={`nv-main${side ? " nv-main-shift" : ""}`} ref={mainRef}>
        <div className="nv-pages" ref={pagesRef} onClick={onPagesClick}>
          {state === "loading" ? <p className="small muted">Loading the note...</p> : null}
          {state === "error" ? (
            <div className="card stack-sm" role="alert">
              <p className="row-name">The note could not be opened</p>
              <p className="small">{error}</p>
            </div>
          ) : null}
          {sizes.map((s, i) => {
            const here = marksByPage.get(i + 1) ?? [];
            return (
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
                <div className="nv-hls" aria-hidden>
                  {here.flatMap((m) => m.rects.map((r, k) => <i key={`${m.id}-${k}`} className={`nv-hl nv-hl-${m.color}${m.id === activeId ? " nv-hl-on" : ""}`} style={{ left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h) }} />))}
                </div>
                <div className="textLayer" />
                {here
                  .filter((m) => m.kind === "comment" && m.rects[0])
                  .map((m) => (
                    <button key={m.id} type="button" className="nv-pin" style={{ top: pct(m.rects[0].y) }} onClick={() => setActiveId(m.id)} aria-label="Open your comment">
                      <MessageSquare aria-hidden />
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      </div>

      {(sel || active) && !editor ? (
        <div
          className="nv-selbar"
          role="toolbar"
          aria-label={sel ? "Mark the selected text" : "Edit this highlight"}
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={() => {
            holdSel.current = Date.now() + 1500;
          }}
        >
          {!sel && active?.comment ? <p className="nv-selbar-note">{active.comment}</p> : null}
          <div className="nv-selbar-row">
            <span className="nv-swatches" role="group" aria-label={sel ? "Highlight in a colour" : "Highlight colour"}>
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`nv-swatch nv-hl-${c}`}
                  aria-pressed={!sel && active?.color === c}
                  aria-label={sel ? `Highlight in ${c}` : `Change to ${c}`}
                  onClick={() => (sel ? void highlight(c) : active && void recolor(active, c))}
                  disabled={busy}
                />
              ))}
            </span>
            <span className="nv-group">
              {!sel && active ? (
                <button type="button" className="btn nv-btn" onClick={() => void deleteMark(active)} aria-label="Delete this highlight">
                  <Trash2 aria-hidden />
                </button>
              ) : null}
              <button type="button" className="btn nv-btn" onClick={sel ? clearSelection : () => setActiveId(null)} aria-label="Close">
                <X aria-hidden />
              </button>
            </span>
          </div>
          <button type="button" className="btn nv-btn nv-selbar-main" onClick={sel ? startComment : () => active && editMark(active)}>
            <MessageSquare aria-hidden />
            <span>{sel ? "Highlight + comment" : active?.comment ? "Edit comment" : "Add comment"}</span>
          </button>
        </div>
      ) : null}

      {notice ? (
        <p className="nv-toast" role="status">
          {notice}
        </p>
      ) : null}

      <footer className="nv-bottom" ref={botRef}>
        <div className="nv-group">
          <button type="button" className={`btn nv-btn${side ? " nv-btn-on" : ""}`} onClick={() => setSide((v) => !v)} aria-label={side ? "Hide pages and marks" : "Show pages and marks"} aria-pressed={side} title={side ? "Hide pages and marks" : "Show pages and marks"}>
            <PanelLeft aria-hidden />
          </button>
          <button type="button" className="btn nv-btn" onClick={() => goTo(page - 1, true)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft aria-hidden />
          </button>
          <button type="button" className="btn nv-btn" onClick={() => goTo(page + 1, true)} disabled={page >= numPages} aria-label="Next page">
            <ChevronRight aria-hidden />
          </button>
          <form
            className="nv-pageof"
            aria-live="polite"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number.parseInt(jump, 10);
              if (Number.isInteger(n)) goTo(n, true);
            }}
          >
            <label className="sr-only" htmlFor="nv-jump">Go to page</label>
            <input id="nv-jump" className="nv-field nv-jump" inputMode="numeric" value={jump} onChange={(e) => setJump(e.target.value)} onBlur={() => setJump(String(page))} />
            <span>of {numPages || "..."}</span>
          </form>
        </div>

        <div className="nv-group nv-zoomwrap" role="group" aria-label="Zoom" ref={zoomRef}>
          <button type="button" className="btn nv-btn nv-zoom-step" onClick={() => zoomBy(-1)} aria-label="Zoom out" disabled={!ready}>
            <Minus aria-hidden />
          </button>
          <button type="button" className="btn nv-btn nv-zoombtn" onClick={() => setZoomOpen((v) => !v)} aria-haspopup="menu" aria-expanded={zoomOpen} aria-label={`Zoom level, now ${zoom === "fit" ? "fit width" : zoomLabel}`} disabled={!ready}>
            <span>{zoomLabel}</span>
            <ChevronDown aria-hidden />
          </button>
          <button type="button" className="btn nv-btn nv-zoom-step" onClick={() => zoomBy(1)} aria-label="Zoom in" disabled={!ready}>
            <Plus aria-hidden />
          </button>
          {zoomOpen ? (
            <div className="nv-pop" role="menu" aria-label="Zoom level">
              <div className="nv-pop-steps">
                <button type="button" className="btn nv-btn" onClick={() => zoomBy(-1)} aria-label="Zoom out">
                  <Minus aria-hidden />
                </button>
                <button type="button" className="btn nv-btn" onClick={() => zoomBy(1)} aria-label="Zoom in">
                  <Plus aria-hidden />
                </button>
              </div>
              <button type="button" role="menuitemradio" aria-checked={zoom === "fit"} className="nv-pop-item" onClick={() => { applyZoom("fit"); setZoomOpen(false); }}>
                Fit width
              </button>
              {ZOOMS.map((z) => (
                <button key={z} type="button" role="menuitemradio" aria-checked={zoom === z} className="nv-pop-item" onClick={() => { applyZoom(z); setZoomOpen(false); }}>
                  {Math.round(z * 100)}%
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {start ? (
          <div className="nv-group nv-end">
            <span className="small muted nv-resume">Resumes on page {page} next time</span>
            <StartExamForm examId={start.examId} setId={start.setId} topicIds={start.topicIds} chunk={start.chunk} />
          </div>
        ) : (
          <span className="small muted nv-resume">Resumes on page {page} next time</span>
        )}
      </footer>

      {editor ? (
        <div className="nv-shade" onPointerDown={(e) => e.target === e.currentTarget && setEditor(null)}>
          <div className="nv-sheet" role="dialog" aria-modal="true" aria-label={editor.id ? "Edit your comment" : "Highlight and comment"}>
            {editor.clipSrc ? (
              <span className={`nv-clip nv-clip-${editor.color}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={editor.clipSrc} alt="The highlighted part of the note" />
              </span>
            ) : null}
            <label className="sr-only" htmlFor="nv-comment">Your comment</label>
            <textarea id="nv-comment" className="nv-text" value={editor.text} maxLength={MAX_COMMENT} autoFocus placeholder="Write your comment" onChange={(e) => setEditor({ ...editor, text: e.target.value })} />
            <div className="nv-sheet-row">
              <span className="nv-swatches" role="group" aria-label="Highlight colour">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button key={c} type="button" className={`nv-swatch nv-hl-${c}`} aria-pressed={editor.color === c} aria-label={`Use ${c}`} onClick={() => setEditor({ ...editor, color: c })} />
                ))}
              </span>
              <span className="small muted">{editor.text.length}/{MAX_COMMENT}</span>
            </div>
            <div className="nv-sheet-row">
              {editor.id ? (
                <button type="button" className="btn nv-btn" onClick={() => { const m = marks.find((x) => x.id === editor.id); if (m) void deleteMark(m); }}>
                  Delete
                </button>
              ) : (
                <span />
              )}
              <span className="nv-group">
                <button type="button" className="btn nv-btn" onClick={() => setEditor(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary nv-btn" onClick={() => void saveEditor()} disabled={busy || (!editor.id && !editor.text.trim())}>
                  {busy ? "Saving..." : "Save"}
                </button>
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
