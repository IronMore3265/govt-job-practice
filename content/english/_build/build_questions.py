# -*- coding: utf-8 -*-
"""Generate question.md and answer.md for English, topic 1 "The Noun", and check coverage.

Run:  python content/english/_build/build_questions.py      (run build_note.py first)
Each question's "Page" is the page of the built note PDF that teaches the fact: among the pages that hold every phrase of the question's
`need` list, the one that shares the most rare words with the question. Questions in the key part (the "Note" questions) are searched on the
key page too. A question with no page stops the build ("not covered").
need = need.txt / NEW entry, else automatic: the target word(s) of the stem (quoted, underlined, or the first word) when the answer is generic
(noun, article, abstract ...), else the correct option itself.
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
from qdata import ABC, GROUP_TITLE, all_questions  # noqa: E402

FOLDER = HERE.parent / "01-the-noun"
TITLE = "English: The Noun"
GROUP_CH = {1: "1", 2: "2", 3: "3", 4: "4"}
GENERIC = {"noun", "a noun", "an adjective", "adjective", "verb", "a verb", "adverb", "pronoun", "abstract", "common", "proper", "collective",
           "material", "a", "an", "the", "no article", "abstract noun", "common noun", "collective noun", "material noun", "proper noun",
           "an abstract noun", "a common noun", "a pronoun", "none", "none of the above", "none of these", "a, the", "an, a", "the, a", "x"}


def norm(t):
    t = re.sub(r"<[^>]+>", "", t)
    t = t.replace("&amp;", "&")
    return re.sub(r"[\s​‌‍]+", "", t).casefold()


def note_pages():
    html = (FOLDER / "note.html").read_text(encoding="utf-8")
    out = []
    # every page, the cover (no data-ch) included, so that list index + 1 is the PDF page number
    for m in re.finditer(r'<section class="page[^"]*?"(?: data-ch="([^"]*)")?>(.*?)</section>', html, re.S):
        raw = re.sub(r"<[^>]+>", " ", m.group(2)).replace("&amp;", "&")
        out.append(dict(ch=m.group(1) or "cover", text=norm(m.group(2)), words=set(re.findall(r"[ঀ-৿A-Za-z0-9]{3,}", raw.casefold()))))
    return out


def auto_need(x):
    correct = x["opts"][x["ans"]]
    if norm(correct) not in {norm(g) for g in GENERIC}:
        return [correct]
    q = x["q"]
    m = re.findall(r"['\"]([A-Za-z][A-Za-z\- ]*)['\"]", q)
    if m:
        return [m[0]]
    m = re.search(r"__(.+?)__", q)
    if m:
        return [m.group(1)]
    return [re.findall(r"[A-Za-z][A-Za-z\-]+", q)[0]]


def resolve(qs):
    pages = note_pages()
    key_pages = [i for i, p in enumerate(pages) if p["ch"] == "0"]
    body_pages = [i for i, p in enumerate(pages) if p["ch"] not in ("0", "cover")]
    df = {}
    for p in pages:
        for w in p["words"]:
            df[w] = df.get(w, 0) + 1
    missing = []
    for x in qs:
        need = [norm(t) for t in (x["need"] or auto_need(x))]
        stem = set(re.findall(r"[ঀ-৿A-Za-z0-9]{3,}", x["q"].casefold()))
        own = [i for i in body_pages if pages[i]["ch"] == GROUP_CH[x["group"]]]
        cands = [key_pages] if x["doubt"] else [own, body_pages]
        hits = []
        for cand in cands:
            hits = [i for i in cand if all(t in pages[i]["text"] for t in need)]
            if hits:
                break
        if hits:
            x["page"] = max(hits, key=lambda i: (sum(1 / df[w] for w in stem & pages[i]["words"]), -i)) + 1
        else:
            x["page"] = 0
            missing.append(x["n"])
    return missing


def write(qs):
    n = len(qs)
    assert n % 20 == 0, f"{n} questions, not a multiple of 20"

    def heading(x):
        first = x["n"] == 1 or qs[x["n"] - 2]["group"] != x["group"]
        return [f"## {GROUP_TITLE[x['group']]}", ""] if first else []

    L = ["---", "subject: English", "topic: 1", "lang: en", "---", "",
         f"# {TITLE}: Questions", "", f"Total {n} questions. Four options each, one correct. Answers and explanations are in `answer.md`.", ""]
    for x in qs:
        L += heading(x)
        L += [f"### Q{x['n']}. {x['q']}", ""]
        L += [f"- {ABC[k]}. {o}" for k, o in enumerate(x["opts"])]
        L += ["", "---", ""]
    (FOLDER / "question.md").write_text("\n".join(L), encoding="utf-8", newline="\n")

    new_count = sum(1 for x in qs if x["src"] == "নতুন প্রশ্ন")
    key = "  ".join(f"Q{x['n']}: {ABC[x['ans']]}" for x in qs)
    L = [f"# {TITLE}: Answers and explanations", "",
         f"Total {n} questions: {n - new_count} past-exam questions from the book and {new_count} new questions written from the note (the source line says 'নতুন প্রশ্ন').",
         "", "## Quick answer key", "", key, "", "---", ""]
    for x in qs:
        L += heading(x)
        L += [f"### Q{x['n']}. {x['q']}", "",
              f"**Answer:** {ABC[x['ans']]}. {x['opts'][x['ans']]}", "",
              f"**Reason:** {x['reason']}", "",
              f"**Page:** {x['page']}", ""]
        if re.search(r"[ঀ-৿]", x["q"]):
            L += ["**Lang:** bn", ""]
        L += [f"**Source:** {x['src']}", "", "---", ""]
    (FOLDER / "answer.md").write_text("\n".join(L), encoding="utf-8", newline="\n")
    return new_count


if __name__ == "__main__":
    qs = all_questions()
    missing = resolve(qs)
    if missing:
        for x in qs:
            if x["n"] in missing:
                print("NOT COVERED: Q%d %s | need=%s" % (x["n"], x["q"][:60], x["need"] or auto_need(x)))
        print(f"{len(missing)} not covered")
        sys.exit(1)
    nw = write(qs)
    dist = {}
    for x in qs:
        dist[ABC[x["ans"]]] = dist.get(ABC[x["ans"]], 0) + 1
    doubtful = [x["n"] for x in qs if x["doubt"]]
    print(f"{len(qs)} questions ({nw} new, {len(qs) - nw} past-exam), 0 not covered. Answer spread: {dict(sorted(dist.items()))}. Doubtful: {doubtful}")
