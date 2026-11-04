// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { dbMessage, escapeLike, filterHref, hasUnclosedDollar, pageCount, parseFilters, parseQuestionForm } from "./questions.ts";

const TOPIC = "11111111-1111-4111-8111-111111111111";
const FIGURE = "22222222-2222-4222-8222-222222222222";

function form(over: Record<string, string> = {}) {
  const f = new FormData();
  const base: Record<string, string> = {
    topic_id: TOPIC, lang: "en", text: "What is 2 + 2?", option_A: "3", option_B: "4", option_C: "5", option_D: "6",
    correct: "B", explanation: "Because 2 + 2 = 4.", source_page: "12", ...over,
  };
  for (const [k, v] of Object.entries(base)) f.set(k, v);
  return f;
}

test("a good form parses, and the button decides the status", () => {
  const draft = parseQuestionForm(form(), "draft");
  assert.ok(draft.ok);
  assert.equal(draft.value.status, "draft");
  assert.equal(draft.value.correct, "B");
  assert.equal(draft.value.source_page, 12);
  assert.equal(draft.value.id, null);
  assert.deepEqual(draft.value.options.map((o) => o.label), ["A", "B", "C", "D"]);
  const approved = parseQuestionForm(form({ id: FIGURE, figure_id: FIGURE }), "approve");
  assert.ok(approved.ok);
  assert.equal(approved.value.status, "approved");
  assert.equal(approved.value.figure_id, FIGURE);
});

test("required pieces are checked with plain messages", () => {
  const cases: [Record<string, string>, RegExp][] = [
    [{ topic_id: "" }, /topic/i],
    [{ lang: "fr" }, /English or Bangla/],
    [{ text: "  " }, /Write the question/],
    [{ option_C: "" }, /Option C is empty/],
    [{ option_D: "3" }, /same text/],
    [{ correct: "" }, /correct answer/],
    [{ correct: "E" }, /correct answer/],
    [{ source_page: "abc" }, /source page/],
    [{ source_page: "0" }, /source page/],
    [{ text: "x".repeat(4001) }, /4000/],
    [{ option_A: "y".repeat(1001) }, /1000/],
    [{ explanation: "z".repeat(2001) }, /2000/],
  ];
  for (const [over, re] of cases) {
    const r = parseQuestionForm(form(over), "draft");
    assert.ok(!r.ok, JSON.stringify(over));
    assert.match(r.message, re);
  }
});

test("approving also needs an explanation, a page and closed math", () => {
  assert.match(String((parseQuestionForm(form({ explanation: "" }), "approve") as { message: string }).message), /explanation/);
  assert.match(String((parseQuestionForm(form({ source_page: "" }), "approve") as { message: string }).message), /source page/);
  assert.match(String((parseQuestionForm(form({ text: "Costs $5 today" }), "approve") as { message: string }).message), /not closed/);
  assert.ok(parseQuestionForm(form({ explanation: "", source_page: "" }), "draft").ok, "a draft may be unfinished");
  assert.ok(parseQuestionForm(form({ text: String.raw`Costs \$5 and $\frac{1}{2}$` }), "approve").ok);
});

test("options lose line breaks, the question keeps them, and CRLF is normalised", () => {
  const r = parseQuestionForm(form({ text: "line one\r\nline two", option_A: "a\nb" }), "draft");
  assert.ok(r.ok);
  assert.equal(r.value.text, "line one\nline two");
  assert.equal(r.value.options[0].text, "a b");
});

test("unclosed dollar scan matches the site", () => {
  assert.equal(hasUnclosedDollar("$x$ and $$y$$"), false);
  assert.equal(hasUnclosedDollar(String.raw`costs \$5`), false);
  assert.equal(hasUnclosedDollar("costs $5"), true);
  assert.equal(hasUnclosedDollar("a $$$$ b"), true);
  assert.equal(hasUnclosedDollar("line one $x$\nline two $y"), true);
});

test("database messages: ours are shown, others are hidden", () => {
  assert.equal(dbMessage({ code: "P0001", message: "A live set needs exactly 20 approved questions" }, "x"), "A live set needs exactly 20 approved questions");
  assert.equal(dbMessage({ code: "42501" }, "x"), "Only the admin can do that.");
  assert.equal(dbMessage({ code: "23505", message: "duplicate key value violates" }, "Could not save."), "Could not save.");
  assert.equal(dbMessage(null, "Could not save."), "Could not save.");
});

test("filters come from the URL and fall back safely", () => {
  assert.deepEqual(parseFilters({}), { subject: null, topic: null, status: "all", lang: "all", q: "", page: 1 });
  const f = parseFilters({ subject: TOPIC, topic: "nope", status: "draft", lang: "bn", q: "  word ", page: "3" });
  assert.deepEqual(f, { subject: TOPIC, topic: null, status: "draft", lang: "bn", q: "word", page: 3 });
  assert.equal(parseFilters({ status: "weird", lang: "xx", page: "-4" }).page, 1);
  assert.equal(parseFilters({ status: ["draft", "approved"] }).status, "draft");
});

test("filter links leave out defaults", () => {
  assert.equal(filterHref("/admin/questions", {}), "/admin/questions");
  assert.equal(filterHref("/admin/questions", { status: "draft", page: 2, q: "a b" }), "/admin/questions?status=draft&q=a+b&page=2");
  assert.equal(filterHref("/admin/questions", { status: "all", lang: "all", page: 1 }), "/admin/questions");
});

test("search words are escaped for LIKE and pages are counted", () => {
  assert.equal(escapeLike("50%_off\\"), "50\\%\\_off\\\\");
  assert.equal(pageCount(0), 1);
  assert.equal(pageCount(25), 1);
  assert.equal(pageCount(26), 2);
});
