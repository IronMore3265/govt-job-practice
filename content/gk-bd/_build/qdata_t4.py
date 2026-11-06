# -*- coding: utf-8 -*-
"""Question data for General Knowledge - Bangladesh, topic 4 "উপমহাদেশে মুসলিম শাসন".

Source: GK BD Pt 3.pdf (George's MP3 বাংলাদেশ, book pages 13 to 28, a scan with no text layer, read page by page).
The book's 236 past-exam MCQs come first, in the book's order, with the book's option order and answer letter. They sit in 8
sets (one per chapter below), kept in t4_mcq.json (hand transcription of the scan). Four new questions follow (written only from
the note), so the total is 240, a multiple of 20.

REASON[(set, n)] = the explanation. META[(set, n)] = optional overrides:
  need   = phrases that must be on the note page that teaches the fact (default: the correct option)
  x      = True when the fact is stated only by the book's answer key (the note's answer-key page teaches it)
  doubt  = True when the book's key is doubtful (a warning is in the explanation)
  opts   = options to use when the book printed none (correct option first)
ch (chapter) = set number: 1 ইসলামের আবির্ভাব, 2 দিল্লি সালতানাত, 3 পানিপথ ও মুগল সাম্রাজ্য, 4 শূর শাসন, 5 বাংলায় তুর্কি শাসন,
6 স্বাধীন সুলতানি শাসন, 7 বারো ভূঁইয়া, 8 বাংলায় মুগল শাসন.
"""
import json
import random
from pathlib import Path

HERE = Path(__file__).parent
RAW = json.load(open(HERE / "t4_mcq.json", encoding="utf-8"))

SRC_D = "বিগত পরীক্ষা (বইয়ের উত্তরমালা, সন্দেহযুক্ত)"
SRC_NO = "বিগত পরীক্ষা (বইয়ে অপশন ছাপা নেই, অপশন যোগ করা হয়েছে)"

CH_TITLES = {
    1: "উপমহাদেশে ইসলামের আবির্ভাব",
    2: "দিল্লি সালতানাত",
    3: "পানিপথের যুদ্ধ ও মুগল সাম্রাজ্য",
    4: "শূর শাসন",
    5: "বাংলায় তুর্কি শাসন",
    6: "বাংলায় স্বাধীন সুলতানি শাসন",
    7: "বারো ভূঁইয়াদের ইতিহাস",
    8: "বাংলায় মুগল শাসন",
}

from t4_reasons import REASON  # noqa: E402
from t4_meta import META  # noqa: E402

LET = "কখগঘঙ"
ELET = "abcd"


def letter_index(a):
    return LET.index(a) if a in LET else ELET.index(a)


def build_past(si, it):
    key = (si, it["n"])
    meta = META.get(key, {})
    reason = REASON[key]
    doubt = meta.get("doubt", False)
    if it.get("no_opts"):
        opts = list(meta["opts"])
        correct = opts[0]
        rnd = random.Random(f"gk-bd-t4-noopt-{si}-{it['n']}")
        rnd.shuffle(opts)
        ans = "ABCDE"[opts.index(correct)]
        base = SRC_NO
    else:
        opts = list(it["opts"])
        ans = "ABCDE"[letter_index(it["ans"])]
        base = SRC_D if doubt else "বিগত পরীক্ষা"
    src = base + (": " + it["tag"] if it["tag"] else "")
    return dict(kind="P", q=it["q"] + meta.get("qsuffix", ""), opts=opts, ans=ans, reason=reason, ch=si, src=src,
                need=meta.get("need"), x=meta.get("x", False))


def N(q, correct, wrong, reason, ch, need=None):
    return dict(kind="N", q=q, correct=correct, wrong=wrong, reason=reason, ch=ch, src="নতুন প্রশ্ন", need=need, x=False)


NEW = {
    1: [N("তরাইনের প্রথম যুদ্ধ কত খ্রিষ্টাব্দে সংঘটিত হয়েছিল?", "১১৯১ খ্রি.", ["১১৯২ খ্রি.", "১২০৬ খ্রি.", "৭১২ খ্রি."],
          "তরাইনের প্রথম যুদ্ধ (১১৯১ খ্রি.) এ মুহম্মদ ঘুরী পৃথ্বীরাজ চৌহানের কাছে শোচনীয়ভাবে পরাজিত ও আহত হয়ে স্বদেশে ফিরে যান। দ্বিতীয় যুদ্ধ হয় ১১৯২ খ্রি.।", 1)],
    2: [N("দিল্লি সালতানাতের সর্বশেষ সুলতান কে ছিলেন?", "ইব্রাহীম লোদী", ["মাহমুদ শাহ", "গিয়াসউদ্দিন বলবন", "আলাউদ্দীন খলজি"],
          "ইব্রাহীম লোদী (১৫১৭-১৫২৬ খ্রি.) ছিলেন দিল্লী সালতানাতের সর্বশেষ সুলতান। পানিপথের প্রথম যুদ্ধে (১৫২৬) বাবর তাঁকে পরাজিত করেন।", 2)],
    3: [N("সম্রাট আকবর কত খ্রিষ্টাব্দে 'দীন-ই-ইলাহী' ধর্মমত প্রবর্তন করেন?", "১৫৮২ খ্রিষ্টাব্দে", ["১৫৫৬ খ্রিষ্টাব্দে", "১৫৭৬ খ্রিষ্টাব্দে", "১৬০৫ খ্রিষ্টাব্দে"],
          "আকবর ১৫৮২ খ্রিষ্টাব্দে সকল ধর্মের সার সম্বলিত 'দীন-ই-ইলাহী' নামক নতুন একেশ্বরবাদী ধর্মমত প্রবর্তন করেন। মাত্র ১৮ জন লোক এই ধর্মমত গ্রহণ করেছিল।", 3)],
    4: [N("শেরশাহ কোন যুদ্ধে হুমায়ুনকে পরাজিত করে দিল্লি অধিকার করেন?", "কনৌজের নিকট বিলগ্রামের যুদ্ধে",
          ["পানিপথের প্রথম যুদ্ধে", "রাজমহলের যুদ্ধে", "বক্সারের যুদ্ধে"],
          "শেরশাহ ১৫৪০ সালে কনৌজের নিকট বিলগ্রামের যুদ্ধে হুমায়ুনকে পরাজিত করে দিল্লি অধিকার করেন। ফলে উপমহাদেশে আফগান সাম্রাজ্য প্রতিষ্ঠিত হয়।", 4,
          need=["১৫৪০ সালে কনৌজের নিকট বিলগ্রামের যুদ্ধে হুমায়ুনকে পরাজিত"])],
}


def build_chapters():
    out = []
    for si, items in enumerate(RAW, start=1):
        data = [build_past(si, it) for it in items]
        data += NEW.get(si, [])
        out.append((si, data))
    return out


CHAPTERS = build_chapters()
