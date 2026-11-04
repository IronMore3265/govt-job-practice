# -*- coding: utf-8 -*-
"""Generate question.md and answer.md for the Bangla topics (the importer reads this pair).

Run from this folder:  python build_questions.py          (all topics)   or   python build_questions.py 2   (one topic)
The "পৃষ্ঠা" line in answer.md is a NOTE PDF page (the site links "see page N" to the note viewer),
set in PAGES below after the note layout is final.
"""
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from qdata_t1_t3 import T1, T3  # noqa: E402
from qdata_t2_t4 import T2, T4  # noqa: E402
from qdata_charyapad import T5  # noqa: E402

HERE = Path(__file__).parent
BN = "০১২৩৪৫৬৭৮৯"


def bn(n):
    return "".join(BN[int(c)] for c in str(n))


# note PDF pages: cover=1, ch1=2, ch2=3-6 (6 = family tree figure), ch3=7-8, ch4=9-10
PAGES1 = {
    1: {"a": 2},
    2: {"intro": 3, "ie": 3, "aus": 4, "chain": 4, "sans": 4, "theory": 5, "tree": 5, "fig": 6},
    3: {"l1": 7, "l2": 8},
    4: {"s1": 9, "s2": 10},
}
CH_TITLES1 = {1: "বাঙালি জাতি", 2: "বাংলা ভাষার উদ্ভব ও বিকাশ", 3: "বাংলা লিপি", 4: "বাংলা সাহিত্যের ইতিহাসের যুগবিভাগ"}

# note PDF pages of topic 2 (see _build/build_note_charyapad.py): cover=1, a=2 intro, b=3 discovery, c=4 poets and pads,
# p=5 poet profiles and the first pad, d=6 language and religion, e=7 society and proverbs, f=8 translations,
# g=9 nabacharyapad and notun charyapad, x=10 book answer-key notes
PAGES2 = {1: {"a": 2, "b": 3, "c": 4, "p": 5, "d": 6, "e": 7, "f": 8, "g": 9, "x": 10}}
CH_TITLES2 = {1: "চর্যাপদ"}

TOPICS = [
    dict(num=1, folder="01-bangla-sahitto", title="বাংলা সাহিত্য",
         chapters=[(1, T1), (2, T2), (3, T3), (4, T4)], pages=PAGES1, ch_titles=CH_TITLES1),
    dict(num=2, folder="02-adi-prachin-jug", title="আদি বা প্রাচীন যুগ",
         chapters=[(1, T5)], pages=PAGES2, ch_titles=CH_TITLES2),
]
TOPIC = TOPICS[0]  # kept for older scripts
LET = "ABCD"


def prepare(topic):
    out = []
    n = 0
    for ch, data in topic["chapters"]:
        for k, q in enumerate(data, start=1):
            n += 1
            if q["kind"] == "P":
                opts, ans = list(q["opts"]), LET.index(q["ans"])
            else:
                rnd = random.Random(f"{ch}-{k}" if topic["num"] == 1 else f"t{topic['num']}-{ch}-{k}")
                opts = [q["correct"]] + list(q["wrong"])
                rnd.shuffle(opts)
                ans = opts.index(q["correct"])
            assert len(opts) == 4 and len(set(opts)) == 4, (ch, k)
            assert "—" not in q["q"] + q["reason"] + "".join(opts), (ch, k)
            out.append(dict(n=n, ch=ch, q=q["q"], opts=opts, ans=ans, reason=q["reason"], src=q["src"], page=topic["pages"][ch][q["sec"]]))
    assert len({x["q"] for x in out}) == len(out), "duplicate question text"
    return out




def heading(x, qs, topic):
    first = x["n"] == 1 or qs[x["n"] - 2]["ch"] != x["ch"]
    return [f"## অধ্যায় {bn(x['ch'])}: {topic['ch_titles'][x['ch']]}", ""] if first else []


def write(topic):
    qs = prepare(topic)
    assert len(qs) % 20 == 0, f"topic {topic['num']} has {len(qs)} questions"
    d = HERE / topic["folder"]
    d.mkdir(exist_ok=True)
    t = topic["title"]
    n = len(qs)

    # question.md
    L = ["---", "subject: Bangla", f"topic: {topic['num']}", "lang: bn", "---", "",
         f"# {t}: প্রশ্ন", "", f"মোট প্রশ্ন {bn(n)}টি। প্রতিটির চারটি অপশন, একটি সঠিক। উত্তর ও ব্যাখ্যা `answer.md` ফাইলে।", ""]
    for x in qs:
        L += heading(x, qs, topic)
        L += [f"### Q{x['n']}. {x['q']}", ""]
        L += [f"- {LET[k]}. {o}" for k, o in enumerate(x["opts"])]
        L += ["", "---", ""]
    (d / "question.md").write_text("\n".join(L), encoding="utf-8", newline="\n")

    # answer.md
    key = "  ".join(f"{x['n']}-{LET[x['ans']]}" for x in qs)
    new_count = sum(1 for x in qs if x["src"] == "নতুন প্রশ্ন")
    L = [f"# {t}: উত্তর ও ব্যাখ্যা", "",
         f"মোট প্রশ্ন {bn(n)}টি, এর মধ্যে বইয়ের বিগত পরীক্ষার প্রশ্ন {bn(n - new_count)}টি এবং নতুন লেখা প্রশ্ন {bn(new_count)}টি (উৎস লাইনে 'নতুন প্রশ্ন' লেখা)।",
         "", "**দ্রুত উত্তরমালা**", "", key, "", "---", ""]
    for x in qs:
        L += heading(x, qs, topic)
        L += [f"### Q{x['n']}. {x['q']}", "",
              f"**উত্তর:** {LET[x['ans']]}. {x['opts'][x['ans']]}", "",
              f"**ব্যাখ্যা:** {x['reason']}", "",
              f"**পৃষ্ঠা:** {x['page']}", "",
              f"**উৎস:** {x['src']}", "", "---", ""]
    (d / "answer.md").write_text("\n".join(L), encoding="utf-8", newline="\n")

    return n, new_count


if __name__ == "__main__":
    want = {int(a) for a in sys.argv[1:]}
    for t in TOPICS:
        if want and t["num"] not in want:
            continue
        n, nw = write(t)
        print(f"{t['folder']}: {n} questions ({nw} new, {n - nw} past-exam)")
