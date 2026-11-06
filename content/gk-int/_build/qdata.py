# -*- coding: utf-8 -*-
"""Question data for General Knowledge - International, topic 1 "বিশ্বের সাম্প্রতিক ও চলমান ঘটনাপ্রবাহ - ১".

Source: GK Int Pt 1.pdf (George's MP3 আন্তর্জাতিক, ক-২ to ক-৩২, a scan with no text layer). The book's past-exam MCQs were transcribed by hand
into src/m*.txt (one file per "MCQ Solution" block of the book; the line format is
  number | question | exam tag | opt ~ opt ~ opt ~ opt | key letter(s)   where "-" means "not printed").
The 279 past MCQs come first, in the book's order with the book's option order and key; one new question follows (written only from the
note), so the total is 280, a multiple of 20.

REASON (reasons_a.txt, reasons_b.txt) = the explanation of each past question, key "<file>:<number>".
META[key] = overrides:
  opts  = options to use when the book printed none (correct option first, shuffled by a fixed seed)
  add   = an extra option appended last and used as the correct one (book key missing or lists several answers)
  ans   = key letter to use instead of the printed one (book printed none)
  need  = phrases that must be on the note page that teaches the fact (default: the correct option)
  doubt = True when the book's key is doubtful (a warning is in the explanation)
  x     = True when the fact is stated only by the book's answer key (the note's last page teaches it)
"""
import random
import re
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE / "src"

LET = "কখগঘঙ"
ABC = "ABCDE"

GROUPS = [
    (1, "রাষ্ট্র ও সরকারপ্রধান", ["m01", "m02"]),
    (2, "আন্তর্জাতিক নিরাপত্তা, যুদ্ধ ও কূটনীতি", ["m03"]),
    (3, "জনসংখ্যা ও জনসংখ্যার ঘনত্ব", ["m04", "m05"]),
    (4, "দুর্নীতির ধারণাসূচক", ["m06"]),
    (5, "মানব উন্নয়ন, জীবন প্রত্যাশা ও অন্যান্য সূচক", ["m07"]),
    (6, "বৈশ্বিক রিপোর্ট ও সূচক", ["m08", "m08b"]),
    (7, "ফোর্বস রিপোর্ট", ["m09"]),
    (8, "সংস্থা ও সংগঠনের শীর্ষ পদাধিকারী", ["m10", "m10b"]),
    (9, "শীর্ষ সম্মেলন ও সংস্থার সভাপতি", ["m11", "m11b"]),
    (10, "সংস্থা-সংগঠনের সদস্যপদ", ["m12", "m12b"]),
    (11, "দিবস প্রতিপাদ্য ২০২৬", ["m13"]),
]
GROUP_TITLE = {g: t for g, t, _ in GROUPS}

SRC_PAST = "বিগত পরীক্ষা"
SRC_D = "বিগত পরীক্ষা (বইয়ের উত্তরমালা, সন্দেহযুক্ত)"
SRC_NO = "বিগত পরীক্ষা (বইয়ে অপশন ছাপা নেই, অপশন যোগ করা হয়েছে)"
SRC_ADD = "বিগত পরীক্ষা (বইয়ে উত্তর ছাপা নেই বা একাধিক, উত্তর অপশন যোগ করা হয়েছে, সন্দেহযুক্ত)"


def _meta():
    m = {}
    for k in ("m03:21", "m04:9", "m09:1", "m09:2", "m09:5", "m10b:15", "m11b:28", "m12:5", "m12b:23"):
        m[k] = {}
    m["m03:21"]["opts"] = ["অপারেশন বুনিয়ান-উন-মারসুস", "অপারেশন সিঁদুর", "অপারেশন ট্রু প্রমিজ", "অপারেশন রাইজিং লায়ন"]
    m["m04:9"]["opts"] = ["Brazil", "Argentina", "Colombia", "Peru"]
    m["m04:9"]["need"] = ["ব্রাজিল"]
    m["m09:1"]["opts"] = ["Elon Musk (United States)", "Jeff Bezos (United States)", "Bernard Arnault (France)", "Mark Zuckerberg (United States)"]
    m["m09:2"]["opts"] = ["Tesla ও SpaceX", "Amazon ও Blue Origin", "Meta ও Instagram", "Apple ও Beats"]
    m["m09:5"]["opts"] = ["অ্যালিস ওয়াল্টন (যুক্তরাষ্ট্র)", "ফ্রাঁসোয়াজ বেটেনকোর্ট মায়ার্স (ফ্রান্স)", "জুলিয়া কখ (যুক্তরাষ্ট্র)", "মাকেঞ্জি স্কট (যুক্তরাষ্ট্র)"]
    m["m10b:15"]["opts"] = ["পিয়েরে-অলিভিয়ের গৌরিঞ্চাস (ফ্রান্স)", "অলিভিয়ের ব্লানশার (ফ্রান্স)", "ইন্দরমিত গিল (ভারত)", "ক্রিস্টালিনা জর্জিয়েভা (বুলগেরিয়া)"]
    m["m11b:28"]["opts"] = ["জেনেভা, সুইজারল্যান্ড", "নিউইয়র্ক, যুক্তরাষ্ট্র", "প্যারিস, ফ্রান্স", "ভিয়েনা, অস্ট্রিয়া"]
    m["m12:5"]["opts"] = ["১৯৩টি", "১৮৭টি", "১৯৪টি", "১৮৯টি"]
    m["m12b:23"]["opts"] = ["২৯টি", "২৭টি", "২৬টি", "৩২টি"]
    # answer missing or several answers printed: an extra correct option is added last
    m["m01:14"] = dict(ans="ঘ", doubt=True, x=True, need=["নিক ক্লেগ"])
    m["m04:4"] = dict(add="চাদ", doubt=True, need=["চাদ, সোমালিয়া ও গণতান্ত্রিক কঙ্গো প্রজাতন্ত্র"])
    m["m07:4"] = dict(add="সান ম্যারিনো", doubt=True, need=["সর্বোচ্চ গড় আয়ুর দেশ- সান ম্যারিনো"])
    m["m12b:31"] = dict(add="১৩৪", doubt=True, need=["জি-৭৭ (G-77)", "১৩৪"])
    m["m03:3"] = dict(add="United States, Egypt ও Qatar", doubt=True, need=["মিসর, কাতার ও যুক্তরাষ্ট্রের মধ্যস্থতায়"])
    m["m06:1"] = dict(add="দক্ষিণ সুদান ও সোমালিয়া (দুটিই শীর্ষে)", doubt=True, need=["দক্ষিণ সুদান ও সোমালিয়া"])
    m["m12b:40"] = dict(add="সুইডেন ও ফিনল্যান্ড", doubt=True, x=True, need=["সুইডেন ও ফিনল্যান্ড"])
    # keys that differ from the book's own tables
    for k in ("m01:42", "m01:61", "m04:7", "m12b:43"):
        m.setdefault(k, {})["doubt"] = True
    return m


META = _meta()
X_KEYS = ["m01:14", "m01:28", "m01:42", "m01:61", "m01:62", "m02:76", "m02:83", "m04:15", "m08:4", "m11:1", "m11b:29", "m12b:40", "m12b:42", "m12b:43"]
for _ln in (HERE / "need.txt").read_text(encoding="utf-8").splitlines():
    if _ln.strip():
        _k, _v = _ln.split(" | ", 1)
        META.setdefault(_k, {}).setdefault("need", [s.strip() for s in _v.split(" | ")])
for _k in X_KEYS:
    META.setdefault(_k, {})["x"] = True


def _load_reasons():
    r = {}
    for f in sorted(HERE.glob("reasons_*.txt")):
        for ln in f.read_text(encoding="utf-8").splitlines():
            if ln.strip():
                k, v = ln.split(" | ", 1)
                assert k not in r, k
                r[k] = v.strip()
    return r


REASON = _load_reasons()
BN_STEMS = dict(ln.split(" | ", 1) for ln in (HERE / "bn_stems.txt").read_text(encoding="utf-8").splitlines() if ln.strip())


def sanitize(t):
    return t.replace("—", "-").replace("–", "-").strip()


def load_past():
    out = []
    for g, _title, files in GROUPS:
        for fid in files:
            for ln in (SRC / f"{fid}.txt").read_text(encoding="utf-8").splitlines():
                if not ln.strip():
                    continue
                n, q, tag, opts, key = [x.strip() for x in ln.split(" | ")]
                k = f"{fid}:{n}"
                meta = META.get(k, {})
                if opts == "-":
                    options = list(meta["opts"])
                    corr_text = options[0]
                    rnd = random.Random(f"gk-int-t1-{k}")
                    rnd.shuffle(options)
                    ans = options.index(corr_text)
                    src = SRC_NO
                else:
                    options = [sanitize(o) for o in opts.split(" ~ ")]
                    letters = key.replace(" ", "").split(",")
                    if "add" in meta:
                        options.append(meta["add"])
                        ans = len(options) - 1
                        src = SRC_ADD
                    else:
                        k0 = meta.get("ans", key)
                        assert len(k0) == 1 and k0 in LET, (k, key)
                        ans = LET.index(k0)
                        src = SRC_D if meta.get("doubt") else SRC_PAST
                    assert len(options) <= 5 and len(set(options)) == len(options), (k, options)
                assert k in REASON, f"no explanation for {k}"
                if tag != "-":
                    src += ": " + sanitize(tag)
                q = sanitize(q)
                if not re.search(r"[ঀ-৿]", q):
                    q = q + "/ " + BN_STEMS[k]  # the importer needs Bangla letters in a Bangla-language set: the book's own "English/ Bangla" style
                out.append(dict(key=k, group=g, q=q, opts=options, ans=ans, reason=REASON[k], src=src,
                                need=meta.get("need"), x=meta.get("x", False)))
    return out


NEW = [
    dict(group=1, q="বর্তমান বিশ্বের দীর্ঘতম শাসক কে?", correct="ব্রুনেইয়ের সুলতান হাসানাল বলখিয়া",
         wrong=["সৌদি আরবের বাদশাহ সালমান বিন আব্দুলআজিজ", "থাইল্যান্ডের রাজা মাহা ভাজিরালংকর্ন", "ওমানের সুলতান হাইথাম বিন তারিক আল সাইদ"],
         reason="ব্রুনেইয়ের সুলতান হাসানাল বলখিয়া ৫ অক্টোবর, ১৯৬৭ খ্রি. থেকে বর্তমান পর্যন্ত শাসন করছেন, তাই তিনি বর্তমান বিশ্বের দীর্ঘতম শাসক।",
         need=["বর্তমান বিশ্বের দীর্ঘতম শাসক ব্রুনেইয়ের সুলতান হাসানাল বলখিয়া"]),
]


def all_questions():
    qs = load_past()
    for nq in NEW:
        rnd = random.Random(f"gk-int-t1-new-{nq['q']}")
        opts = [nq["correct"]] + list(nq["wrong"])
        rnd.shuffle(opts)
        qs.append(dict(key="new:" + nq["q"][:10], group=nq["group"], q=nq["q"], opts=opts, ans=opts.index(nq["correct"]), reason=nq["reason"],
                       src="নতুন প্রশ্ন", need=nq["need"], x=False))
    qs.sort(key=lambda x: x["group"])  # stable: past questions keep the book's order, the new one ends its group
    for k, x in enumerate(qs, start=1):
        x["n"] = k
    seen = {}
    for x in qs:
        c = seen.get(x["q"], 0) + 1
        seen[x["q"]] = c
        if c > 1:
            x["q"] += f" ({'০১২৩৪৫৬৭৮৯'[c]})"
    assert all(a["q"] != b["q"] for i, a in enumerate(qs) for b in qs[i + 1:]), "duplicate question text"
    for x in qs:
        assert "—" not in x["q"] + x["reason"] + "".join(x["opts"]), x["n"]
    return qs
