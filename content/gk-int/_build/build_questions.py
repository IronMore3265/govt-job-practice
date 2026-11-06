# -*- coding: utf-8 -*-
"""Generate question.md and answer.md for General Knowledge - International, topic 1, and check coverage.

Run:  python content/gk-int/_build/build_questions.py      (run build_note.py first)
Each question's "পৃষ্ঠা" is the page of the built note PDF that teaches the fact: among the pages that hold every phrase of the question's
`need` list (default: the correct option), the one that shares the most words with the question. Questions marked x=True are searched only on
the answer-key page. A question with no page stops the build ("not covered").
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
from qdata import ABC, GROUP_TITLE, all_questions  # noqa: E402

FOLDER = HERE.parent / "01-bishwer-samprotik-cholman-ghotonaprobah-1"
BN = "০১২৩৪৫৬৭৮৯"
TITLE = "বিশ্বের সাম্প্রতিক ও চলমান ঘটনাপ্রবাহ - ১"


def bn(n):
    return "".join(BN[int(c)] for c in str(n))


def norm(t):
    t = re.sub(r"<[^>]+>", "", t)
    t = t.replace("&amp;", "&")
    return re.sub(r"[\s​‌‍]+", "", t).casefold()


def note_pages():
    html = (FOLDER / "note.html").read_text(encoding="utf-8")
    out = []
    for m in re.finditer(r'<section class="page[^"]*" data-ch="([^"]*)">(.*?)</section>', html, re.S):
        raw = re.sub(r"<[^>]+>", " ", m.group(2)).replace("&amp;", "&")
        out.append(dict(ch=m.group(1), text=norm(m.group(2)), words=set(re.findall(r"[ঀ-৿A-Za-z0-9]{3,}", raw.casefold()))))
    return out


GROUP_CH = {1: "1", 2: "2", 3: "3", 4: "3", 5: "3", 6: "3", 7: "3", 8: "4", 9: "4", 10: "5", 11: "6"}


def resolve(qs):
    """Page choice: only pages of the question's chapter first; among them the page whose rare words match the question best."""
    pages = note_pages()
    key_pages = [i for i, p in enumerate(pages) if p["ch"] == "0"]
    body_pages = [i for i, p in enumerate(pages) if p["ch"] != "0"]
    df = {}
    for p in pages:
        for w in p["words"]:
            df[w] = df.get(w, 0) + 1
    missing = []
    for x in qs:
        need = [norm(t) for t in (x["need"] or [x["opts"][x["ans"]]])]
        stem = set(re.findall(r"[ঀ-৿A-Za-z0-9]{3,}", x["q"].casefold()))
        own = [i for i in body_pages if pages[i]["ch"] == GROUP_CH[x["group"]]]
        for cand in ([key_pages] if x["x"] else [own, body_pages, key_pages]):
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
        return [f"## অধ্যায় {bn(x['group'])}: {GROUP_TITLE[x['group']]}", ""] if first else []

    L = ["---", "subject: General Knowledge - International", "topic: 1", "lang: bn", "---", "",
         f"# {TITLE}: প্রশ্ন", "", f"মোট প্রশ্ন {bn(n)}টি। প্রতিটির দুই থেকে পাঁচটি অপশন, একটি সঠিক। উত্তর ও ব্যাখ্যা `answer.md` ফাইলে।", ""]
    for x in qs:
        L += heading(x)
        L += [f"### Q{x['n']}. {x['q']}", ""]
        L += [f"- {ABC[k]}. {o}" for k, o in enumerate(x["opts"])]
        L += ["", "---", ""]
    (FOLDER / "question.md").write_text("\n".join(L), encoding="utf-8", newline="\n")

    new_count = sum(1 for x in qs if x["src"] == "নতুন প্রশ্ন")
    key = "  ".join(f"Q{x['n']}: {ABC[x['ans']]}" for x in qs)
    L = [f"# {TITLE}: উত্তর ও ব্যাখ্যা", "",
         f"মোট প্রশ্ন {bn(n)}টি, এর মধ্যে বইয়ের বিগত পরীক্ষার প্রশ্ন {bn(n - new_count)}টি এবং নতুন লেখা প্রশ্ন {bn(new_count)}টি (উৎস লাইনে 'নতুন প্রশ্ন' লেখা)।",
         "", "## দ্রুত উত্তরমালা", "", key, "", "---", ""]
    for x in qs:
        L += heading(x)
        L += [f"### Q{x['n']}. {x['q']}", "",
              f"**উত্তর:** {ABC[x['ans']]}. {x['opts'][x['ans']]}", "",
              f"**ব্যাখ্যা:** {x['reason']}", "",
              f"**পৃষ্ঠা:** {x['page']}", "",
              f"**উৎস:** {x['src']}", "", "---", ""]
    (FOLDER / "answer.md").write_text("\n".join(L), encoding="utf-8", newline="\n")
    return new_count


if __name__ == "__main__":
    qs = all_questions()
    missing = resolve(qs)
    if missing:
        for x in qs:
            if x["n"] in missing:
                print("NOT COVERED: Q%d [%s] %s | need=%s | x=%s" % (x["n"], x["key"], x["q"][:60], x["need"] or x["opts"][x["ans"]], x["x"]))
        print(f"{len(missing)} not covered")
        sys.exit(1)
    nw = write(qs)
    dist = {}
    for x in qs:
        dist[ABC[x["ans"]]] = dist.get(ABC[x["ans"]], 0) + 1
    doubtful = [x["n"] for x in qs if "সন্দেহযুক্ত" in x["src"]]
    print(f"{len(qs)} questions ({nw} new, {len(qs) - nw} past-exam), 0 not covered. Answer spread: {dict(sorted(dist.items()))}. Doubtful: {doubtful}")
