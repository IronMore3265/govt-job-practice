import katex from "katex";
import "katex/dist/katex.min.css";
import { parseRows, splitInline, type Row } from "@/lib/math-text";

// Display-only math for the Mathematics subject. Same stored format and parsing as the MSc site's MathText
// (lib/math-text.ts), drawn with KaTeX instead of MathLive because nothing here edits math: KaTeX is much lighter
// and renders on the server, so the page arrives with the math already laid out. No editor, no keyboard.

function MathInline({ latex, display = false }: { latex: string; display?: boolean }) {
  let html: string;
  try {
    html = katex.renderToString(latex, { displayMode: display, throwOnError: true, output: "htmlAndMathml", strict: "ignore" });
  } catch {
    // Bad LaTeX shows as its source rather than breaking the page. The importer checks LaTeX before upload.
    return <code className="math-error">{latex}</code>;
  }
  return <span className={display ? "math-display" : "math-inline"} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function MathRowView({ row }: { row: Row }) {
  return row.kind === "equation" ? (
    <div className="math-eq">
      <MathInline latex={row.value} display />
    </div>
  ) : (
    <p className="math-line">
      {splitInline(row.value).map((s, k) => (s.type === "text" ? <span key={k}>{s.text}</span> : <MathInline key={k} latex={s.latex} />))}
    </p>
  );
}

// Text with math between dollar signs, row by row.
export function MathText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`math-text${className ? ` ${className}` : ""}`}>
      {parseRows(text).map((r, i) => (
        <MathRowView key={i} row={r} />
      ))}
    </div>
  );
}

// A short text that may hold math, shown inline (an option, a caption).
export function MathInlineText({ text }: { text: string }) {
  return (
    <span>
      {splitInline(text.replace(/\n/g, " ")).map((s, k) => (s.type === "text" ? <span key={k}>{s.text}</span> : <MathInline key={k} latex={s.latex} />))}
    </span>
  );
}
