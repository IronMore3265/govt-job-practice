// A title with one accent word (PLAN.md section 10): the last word, in orange Doto pixel type for English. Doto has no
// Bengali letters, so a Bangla title uses Noto Sans Bengali bold with the accent word in orange instead.
const BENGALI = /[ঀ-৿]/;

export function AccentTitle({ title, className = "heading" }: { title: string; className?: string }) {
  const words = title.trim().split(/\s+/);
  const last = words.pop() ?? "";
  const head = words.join(" ");
  if (BENGALI.test(title)) {
    return (
      <h1 className={`${className} bn-title`}>
        {head ? `${head} ` : ""}
        <span className="bn-accent">{last}</span>
      </h1>
    );
  }
  return (
    <h1 className={className}>
      {head ? `${head} ` : ""}
      <span className="accent">{last}</span>
    </h1>
  );
}
