# -*- coding: utf-8 -*-
"""Question data for English, topic 1 "The Noun".

Source: English Pt 1.pdf ("Professor's MCQ Review: English", book pages 03 to 44, a scan with no text layer). The book's past-exam MCQs were
transcribed by hand into src/m01.txt ... m08.txt. Line format (fields split by "|", options split by "~"):
    question | exam tag | opt ~ opt ~ opt ~ opt | key letter (ক খ গ ঘ, a trailing * = the book printed "Note" instead of a key) | the book's Hints
A line "# Part" starts a part of the topic (The Determiners, The Gender, The Number; the first part is The Noun), "@ Section" names the exam
block (BCS, PSC and Other Exams, Bank, University Admission).
The book's 217 past MCQs come first in the book's order with the book's option order and key; 3 new questions follow (written only from the
note), so the total is 220, a multiple of 20.

reasons.txt   "n: explanation" for the past MCQs that have no Hints in the book (n = number in the file order of src/m*.txt)
need.txt      "n: phrase | phrase" phrases that must be on the note page that teaches the fact (default: the target word of the stem or the answer)
"""
import random
import re
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE / "src"

LET = "কখগঘ"
ABC = "ABCD"
GROUP_TITLE = {1: "The Noun", 2: "The Determiners", 3: "The Gender", 4: "The Number"}
SRC_PAST = "বিগত পরীক্ষা"
SRC_D = "বিগত পরীক্ষা (বইয়ের উত্তরমালা, সন্দেহযুক্ত)"
WARN = (" সতর্কতা: বইয়ের উত্তরমালায় এই প্রশ্নের পাশে অপশনের বদলে 'Note' লেখা আছে। এখানে বইয়ে দাগ দেওয়া অপশনটি সঠিক ধরা হয়েছে, "
        "নোটের শেষ পৃষ্ঠায় বইয়ের Note দেওয়া আছে।")


def sanitize(t):
    return t.replace("—", "-").replace("–", "-").strip()


def _num_file(path):
    out = {}
    if path.exists():
        for ln in path.read_text(encoding="utf-8").splitlines():
            if ln.strip():
                k, v = ln.split(":", 1)
                out[int(k)] = v.strip()
    return out


REASON = _num_file(HERE / "reasons.txt")
NEED = {k: [s.strip() for s in v.split(" | ")] for k, v in _num_file(HERE / "need.txt").items()}


def load_past():
    out, group, n = [], 1, 0
    for f in sorted(SRC.glob("m*.txt")):
        sec = ""
        for ln in f.read_text(encoding="utf-8").splitlines():
            if not ln.strip():
                continue
            if ln.startswith("# "):
                group = {v: k for k, v in GROUP_TITLE.items()}[ln[2:].strip()]
                continue
            if ln.startswith("@ "):
                sec = ln[2:].strip()
                continue
            p = [x.strip() for x in ln.split("|")]
            while len(p) < 5:
                p.append("")
            q, tag, opts, key, hint = p
            n += 1
            options = [sanitize(o) for o in opts.split("~")]
            assert len(options) == 4 and len(set(options)) == 4, (n, options)
            note = key.endswith("*")
            key = key.rstrip("*")
            assert key in LET, (n, key)
            hint = re.sub(r"\s*\(বইয়ের উত্তরমালায় লেখা আছে.*\)\s*$", "", hint).strip()
            reason = hint or REASON.get(n)
            assert reason, f"no explanation for Q{n}: {q}"
            if note:
                reason += WARN
            src = (SRC_D if note else SRC_PAST) + (": " + sanitize(tag) if tag else "")
            out.append(dict(key=n, group=group, sec=sec, q=sanitize(q), opts=options, ans=LET.index(key), reason=sanitize(reason),
                            src=src, need=NEED.get(n), doubt=note))
    return out


NEW = [
    dict(group=1, q="Swimming is a good exercise. Here 'swimming' is a:", correct="Gerund", wrong=["Verbal noun", "Collective noun", "Material noun"],
         reason="Verb + ing যখন sentence-এ noun-এর কাজ করে তখন তাকে Gerund বলে। এখানে swimming বাক্যের subject, তাই এটি Gerund। Verbal noun হতে হলে ing-এর আগে the এবং পরে of থাকতে হয়।",
         need=["Verb + ing যখন sentence-এ noun-এর কাজ করে তখন তাকে Gerund বলে"]),
    dict(group=2, q="Which of the following is a predeterminer?", correct="both", wrong=["first", "few", "my"],
         reason="যে determiner গুলো central determiner-এর পূর্বে বসে তাদেরকে predeterminer বলে, যেমন both, all, half, double, one-third, such, what। First হলো ordinal number এবং few হলো closed-class quantifier (দুটিই postdeterminer)। My হলো possessive (central determiner)।",
         need=["both, all, half, double"]),
    dict(group=3, q="Which one is the feminine gender of 'Poet'?", correct="Poetess", wrong=["Poetor", "Poetrix", "Poetress"],
         reason="Masculine noun-এর শেষে 'ess' যোগ করে feminine gender হয়। যেমন: Poet-Poetess, Author-Authoress, God-Goddess।",
         need=["Poetess (মহিলা কবি)"]),
]


def all_questions():
    qs = load_past()
    for nq in NEW:
        rnd = random.Random(f"english-t1-new-{nq['q']}")
        opts = [nq["correct"]] + list(nq["wrong"])
        rnd.shuffle(opts)
        qs.append(dict(key="new", group=nq["group"], sec="", q=nq["q"], opts=opts, ans=opts.index(nq["correct"]), reason=nq["reason"],
                       src="নতুন প্রশ্ন", need=nq["need"], doubt=False))
    qs.sort(key=lambda x: x["group"])  # stable: past questions keep the book's order, new ones end their group
    for k, x in enumerate(qs, start=1):
        x["n"] = k
    seen = {}
    for x in qs:
        norm = " ".join(x["q"].split()).casefold()
        c = seen.get(norm, 0) + 1
        seen[norm] = c
        if c > 1:
            x["q"] += f" ({c})"  # the importer skips a question whose text already exists in the topic
    assert len({" ".join(x["q"].split()).casefold() for x in qs}) == len(qs), "duplicate question text"
    for x in qs:
        assert "—" not in x["q"] + x["reason"] + "".join(x["opts"]), x["n"]
    return qs
