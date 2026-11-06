# -*- coding: utf-8 -*-
"""Generate question.md and answer.md for General Knowledge - Bangladesh, topic 2 "বাংলার ইতিহাস", and check coverage.

Run from anywhere:  python content/gk-bd/_build/build_questions_t2.py      (run build_note_t2.py first)
Each question's "পৃষ্ঠা" is the page of the built note PDF that teaches the fact: the page whose text holds every phrase in the
question's `need` list (default: the correct option). Questions marked x=True are searched only on the answer-key page,
the others only on the other pages (their own chapter first). A question with no page stops the build ("not covered").
"""
import random
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
from qdata_t2 import CHAPTERS, CH_TITLES  # noqa: E402

FOLDER = HERE.parent / "02-banglar-itihas"
BN = "০১২৩৪৫৬৭৮৯"
LET = "ABCDE"


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
        out.append(dict(chs={int(c) for c in m.group(1).split(",")}, text=norm(m.group(2))))
    return out


def prepare():
    qs, n = [], 0
    for ch, data in CHAPTERS:
        for k, q in enumerate(data, start=1):
            n += 1
            if q["kind"] == "P":
                opts, ans = list(q["opts"]), LET.index(q["ans"])
            else:
                rnd = random.Random(f"gk-bd-t2-{ch}-{k}")
                opts = [q["correct"]] + list(q["wrong"])
                rnd.shuffle(opts)
                ans = opts.index(q["correct"])
            assert 2 <= len(opts) <= 5 and len(set(opts)) == len(opts), (n, opts)
            assert "—" not in q["q"] + q["reason"] + "".join(opts), n
            qs.append(dict(n=n, sec=ch, q=q["q"], opts=opts, ans=ans, reason=q["reason"], src=q["src"], ch=q["ch"], need=q["need"], x=q["x"]))
    assert len({x["q"] for x in qs}) == len(qs), "duplicate question text"
    return qs


def resolve(qs):
    pages = note_pages()
    missing = []
    for x in qs:
        need = [norm(t) for t in (x["need"] or [x["opts"][x["ans"]]])]
        key_pages = [i for i, p in enumerate(pages) if 0 in p["chs"]]
        body_pages = [i for i, p in enumerate(pages) if 0 not in p["chs"]]
        if x["x"]:
            groups = [key_pages]
        else:
            mine = [i for i in body_pages if x["ch"] in pages[i]["chs"]]
            groups = [mine, [i for i in body_pages if i not in mine]]
        x["page"] = 0
        for g in groups:
            hit = [i + 1 for i in g if all(t in pages[i]["text"] for t in need)]
            if hit:
                x["page"] = hit[0]
                break
        if not x["page"]:
            missing.append(x["n"])
    return missing


def write(qs):
    t = "বাংলার ইতিহাস"
    n = len(qs)
    assert n % 20 == 0, f"{n} questions, not a multiple of 20"

    def heading(x):
        first = x["n"] == 1 or qs[x["n"] - 2]["sec"] != x["sec"]
        return [f"## অধ্যায় {bn(x['sec'])}: {CH_TITLES[x['sec']]}", ""] if first else []

    L = ["---", "subject: General Knowledge - Bangladesh", "topic: 2", "lang: bn", "---", "",
         f"# {t}: প্রশ্ন", "", f"মোট প্রশ্ন {bn(n)}টি। প্রতিটির দুই থেকে পাঁচটি অপশন, একটি সঠিক। উত্তর ও ব্যাখ্যা `answer.md` ফাইলে।", ""]
    for x in qs:
        L += heading(x)
        L += [f"### Q{x['n']}. {x['q']}", ""]
        L += [f"- {LET[k]}. {o}" for k, o in enumerate(x["opts"])]
        L += ["", "---", ""]
    (FOLDER / "question.md").write_text("\n".join(L), encoding="utf-8", newline="\n")

    new_count = sum(1 for x in qs if x["src"] == "নতুন প্রশ্ন")
    key = "  ".join(f"Q{x['n']}: {LET[x['ans']]}" for x in qs)
    L = [f"# {t}: উত্তর ও ব্যাখ্যা", "",
         f"মোট প্রশ্ন {bn(n)}টি, এর মধ্যে বইয়ের বিগত পরীক্ষার প্রশ্ন {bn(n - new_count)}টি এবং নতুন লেখা প্রশ্ন {bn(new_count)}টি (উৎস লাইনে 'নতুন প্রশ্ন' লেখা)।",
         "", "## দ্রুত উত্তরমালা", "", key, "", "---", ""]
    for x in qs:
        L += heading(x)
        L += [f"### Q{x['n']}. {x['q']}", "",
              f"**উত্তর:** {LET[x['ans']]}. {x['opts'][x['ans']]}", "",
              f"**ব্যাখ্যা:** {x['reason']}", "",
              f"**পৃষ্ঠা:** {x['page']}", "",
              f"**উৎস:** {x['src']}", "", "---", ""]
    (FOLDER / "answer.md").write_text("\n".join(L), encoding="utf-8", newline="\n")
    return new_count


if __name__ == "__main__":
    qs = prepare()
    missing = resolve(qs)
    if missing:
        for x in qs:
            if x["n"] in missing:
                print("NOT COVERED: Q%d %s | need=%s | x=%s" % (x["n"], x["q"][:50], x["need"] or x["opts"][x["ans"]], x["x"]))
        print(f"{len(missing)} not covered")
        sys.exit(1)
    nw = write(qs)
    dist = {}
    for x in qs:
        dist[LET[x["ans"]]] = dist.get(LET[x["ans"]], 0) + 1
    doubtful = [x["n"] for x in qs if "সন্দেহযুক্ত" in x["src"]]
    print(f"{len(qs)} questions ({nw} new, {len(qs) - nw} past-exam), 0 not covered. Answer spread: {dict(sorted(dist.items()))}. Doubtful: {doubtful}")
