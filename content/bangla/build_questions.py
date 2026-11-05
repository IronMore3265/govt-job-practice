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
from qdata_mj_a import T6_1, T6_2, T6_3, T6_4, T6_5  # noqa: E402
from qdata_mj_b import T6_6, T6_7, T6_8, T6_9, T6_10, T6_11  # noqa: E402
from qdata_mj_c import T6_12, T6_13, T6_14  # noqa: E402
import qdata_modern_a as _ma, qdata_modern_b as _mb, qdata_modern_c as _mc, qdata_modern_d as _md, qdata_modern_e as _me  # noqa: E402
import qdata_modern_f as _mf, qdata_modern_g as _mg, qdata_modern_h as _mh, qdata_modern_i as _mi, qdata_modern_j as _mj  # noqa: E402
import qdata_modern_k as _mk, qdata_modern_n as _mn  # noqa: E402

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

# note PDF pages of topic 3 (see _build/build_note_moddhojug.py): cover=1, a=2 intro, b=3 dark age, c=4 and d=5 Shrikrishnakirtan,
# e=6 padavali, f=7 and g=8 mangalkavya, h=9 biography and nath, i=10 marsiya, j=11 and k=12 folk, l=13 translation,
# p=14 romantic tales intro and translators table, m=15 the two stories, n=16 Arakan and patrons, o=17 transition age,
# x=18 and y=19 book answer-key notes
_SEC3 = dict(a=2, b=3, c=4, d=5, e=6, f=7, g=8, h=9, i=10, j=11, k=12, l=13, p=14, m=15, n=16, o=17, x=18, y=19)
PAGES3 = {c: _SEC3 for c in range(1, 15)}
CH_TITLES3 = {1: "মধ্যযুগ পরিচিতি", 2: "অন্ধকার যুগ", 3: "শ্রীকৃষ্ণকীর্তন", 4: "বৈষ্ণব পদাবলি", 5: "মঙ্গলকাব্য", 6: "জীবনী সাহিত্য",
              7: "নাথ সাহিত্য", 8: "মর্সিয়া সাহিত্য", 9: "লোকসাহিত্য", 10: "অনুবাদ সাহিত্য", 11: "রোমান্টিক প্রণয়োপাখ্যান",
              12: "আরাকান রাজসভা", 13: "মধ্যযুগে বাংলা সাহিত্যের পৃষ্ঠপোষক", 14: "যুগ সন্ধিক্ষণ"}

# topic 4 (আধুনিক যুগ): see _build/build_note_modern.py. Note pages: cover=1, contents pages 2..44, answer-key pages 45 and 46.
_X = {c: (45 if c <= 13 else 46) for c in range(1, 28)}
PAGES4 = {
    1: {"a": 2}, 2: {"a": 3}, 3: {"a": 4}, 4: {"a": 5}, 5: {"a": 5, "b": 6}, 6: {"a": 6}, 7: {"a": 7},
    8: {"a": 8, "b": 9, "c": 10, "d": 11}, 9: {"a": 12, "b": 13}, 10: {"a": 14, "b": 14, "c": 15}, 11: {"a": 16}, 12: {"a": 17},
    13: {"a": 18, "p": 19, "b": 20, "c": 21}, 14: {"a": 22}, 15: {"a": 23, "b": 24}, 16: {"a": 25}, 17: {"a": 26, "b": 38},
    18: {"a": 27, "b": 28}, 19: {"a": 29, "b": 30}, 20: {"a": 31}, 21: {"a": 32}, 22: {"a": 33, "b": 34, "c": 35},
    23: {"a": 36, "b": 37}, 24: {"a": 38}, 25: {"a": 39}, 26: {"a": 40, "b": 41}, 27: {"a": 42, "b": 43, "c": 44},
}
for _c, _d in PAGES4.items():
    _d["x"] = _X[_c]
CH_TITLES4 = {1: "বাংলা গদ্যসাহিত্য", 2: "ফোর্ট উইলিয়াম কলেজ", 3: "শ্রীরামপুর মিশন ও বাংলা ছাপাখানা", 4: "হিন্দু কলেজ ও ইয়ংবেঙ্গল",
              5: "ঢাকা মুসলিম সাহিত্য সমাজ", 6: "বাংলাদেশ এশিয়াটিক সোসাইটি", 7: "বাংলা একাডেমি", 8: "উপন্যাস", 9: "নাটক", 10: "প্রবন্ধ",
              11: "বাংলা সাহিত্যের ইতিহাস বিষয়ক গ্রন্থ", 12: "ভ্রমণকাহিনি", 13: "বাংলা কাব্য ও কবিতা", 14: "মহাকাব্য", 15: "ছোটগল্প",
              16: "জীবনচরিত: মুহম্মদ (স.)", 17: "ভাষা আন্দোলনভিত্তিক রচনা", 18: "মুক্তিযুদ্ধভিত্তিক গ্রন্থ", 19: "বিখ্যাত চরিত্র",
              20: "বিখ্যাত সাহিত্যিকদের উপাধি", 21: "প্রকৃত নাম ও ছদ্মনাম", 22: "প্রথম প্রকাশিত উপন্যাস, নাটক, গল্প ও কাব্য",
              23: "বাংলা সাহিত্যের প্রথম বিষয়াবলি", 24: "বাজেয়াপ্ত ও উৎসর্গীকৃত সাহিত্যকর্ম", 25: "বিখ্যাত বাংলা গান",
              26: "বিখ্যাত পঙ্ক্তি ও বক্তা", 27: "পত্রিকা / সাময়িকী ও সম্পাদক"}
CH4 = [_ma.T7_1, _ma.T7_2, _ma.T7_3, _ma.T7_4, _ma.T7_5, _ma.T7_6, _ma.T7_7, _mb.T7_8, _mc.T7_9, _md.T7_10, _md.T7_11, _me.T7_12, _me.T7_13,
       _mf.T7_14, _mf.T7_15, _mf.T7_16, _mg.T7_17, _mg.T7_18, _mh.T7_19, _mi.T7_20, _mi.T7_21, _mn.T7_22, _mn.T7_23, _mn.T7_24,
       _mj.T7_25, _mj.T7_26, _mk.T7_27]

TOPICS = [
    dict(num=1, folder="01-bangla-sahitto", title="বাংলা সাহিত্য",
         chapters=[(1, T1), (2, T2), (3, T3), (4, T4)], pages=PAGES1, ch_titles=CH_TITLES1),
    dict(num=2, folder="02-adi-prachin-jug", title="আদি বা প্রাচীন যুগ",
         chapters=[(1, T5)], pages=PAGES2, ch_titles=CH_TITLES2),
    dict(num=3, folder="03-moddhojug", title="মধ্যযুগ",
         chapters=[(1, T6_1), (2, T6_2), (3, T6_3), (4, T6_4), (5, T6_5), (6, T6_6), (7, T6_7), (8, T6_8), (9, T6_9),
                   (10, T6_10), (11, T6_11), (12, T6_12), (13, T6_13), (14, T6_14)], pages=PAGES3, ch_titles=CH_TITLES3),
    dict(num=4, folder="04-adhunik-jug", title="আধুনিক যুগ", resolver=True,
         chapters=[(i + 1, d) for i, d in enumerate(CH4)], pages=PAGES4, ch_titles=CH_TITLES4),
]
TOPIC = TOPICS[0]  # kept for older scripts
LET = "ABCD"


def prepare(topic, resolve=True):
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
            page = 1 if topic.get("resolver") else topic["pages"][ch][q["sec"]]
            out.append(dict(n=n, ch=ch, q=q["q"], opts=opts, ans=ans, reason=q["reason"], src=q["src"], page=page, sec=q["sec"]))
    # The book repeats some stems with different options. The importer skips a question whose text already exists
    # in the topic, so a repeated stem gets a number in brackets: "(২)", "(৩)" and so on.
    seen = {}
    for x in out:
        seen[x["q"]] = seen.get(x["q"], 0) + 1
        if seen[x["q"]] > 1:
            x["q"] = f"{x['q']} ({bn(seen[x['q']])})"
    assert len({x["q"] for x in out}) == len(out), "duplicate question text"
    if topic.get("resolver") and resolve:
        _resolve(topic, out)
    return out


def _resolve(topic, out):
    """Topic 4: the note layout is automatic, so each question's note page is found by searching the built note.html:
    first the pages of its chapter, then any page. Questions marked sec 'x' point to the answer-key pages. Page 0 = not found."""
    import note_pages
    from cover4 import need

    info = note_pages.page_info(topic["folder"])
    for x in out:
        if not info:
            x["page"] = 0
            continue
        if x["sec"] == "x":
            hit = [i + 1 for i, p in enumerate(info) if 28 in p["chs"] and note_pages.norm(x["q"]) in p["text"]]
            x["page"] = hit[0] if hit else 0
            continue
        need_ = [note_pages.norm(t) for t in (need(x["q"]) or [x["opts"][x["ans"]]])]
        pool = [i for i, p in enumerate(info) if 28 not in p["chs"]]
        mine = [i for i in pool if x["ch"] in info[i]["chs"]]
        x["page"] = 0
        for grp in (mine, [i for i in pool if i not in mine]):
            hit = [i + 1 for i in grp if all(t in info[i]["text"] for t in need_)]
            if hit:
                x["page"] = hit[0]
                break




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
