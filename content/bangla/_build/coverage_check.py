# -*- coding: utf-8 -*-
"""Coverage audit: does the note actually teach every question?

For each question, the correct option text (or a manual phrase in COVER) must appear on the note page that the
question's **Page:** points to. Run after building the note and the questions:

    python build_notes.py ; python ../build_questions.py ; python coverage_check.py

Exit code 1 if any question is not covered. Rule: fix the NOTE (add the theory), never drop the question.
"""
import html as htmllib
import pathlib
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent))
import build_questions as bq  # noqa: E402

# Questions whose correct option is a label like "ক ও খ", or whose fact is worded differently in the note:
# question text prefix -> phrase(s) that must appear on the question's note page.
COVER = {
    "নিচের কোন প্রাচীন গ্রন্থে 'বঙ্গ'": ["ঋগ্বেদ ও মৎস্যপুরাণ"],
    "বাঙালি জাতি কোন ধরনের জাতি": ["সংকর জাতি"],
    "বাঙালি জনগোষ্ঠীকে প্রধানত কয় ভাগে": ["দুই ভাগে"],
    "আর্যপূর্ব জনগোষ্ঠী মূলত কয়টি": ["চার শাখা"],
    "নিচের কোনটি আর্যপূর্ব জনগোষ্ঠীর চার শাখার": ["নেগ্রিটো", "ভোটচীনীয়"],
    "ইন্দো-ইউরোপীয় মূল ভাষাগোষ্ঠীর অন্তর্গত": ["বাংলাও এই ভাষা পরিবারের সদস্য"],
    "ইন্দো-ইউরোপীয় ভাষার কয়টা শাখা": ["শাখা দুইটি"],
    "ভারতীয় আর্য ভাষার স্তর কয়টি": ["তিন স্তর"],
    "বাংলা ভাষার প্রাচীন নমুনা": ["চর্যাপদ"],
    "ভারতীয় লিপির মূল রূপ কয়টি": ["দুই রূপ"],
    "ব্রাহ্মী লিপির কয়টি রূপ": ["তিনটি রূপ"],
    "ব্রাহ্মী লিপির তিনটি রূপের মধ্যে কোনটি কাশ্মির": ["সারদা", "কাশ্মির ও পাঞ্জাবে"],
    "বাংলা সাহিত্যের যুগকে কয়ভাগে": ["তিন ভাগে"],
    "বাংলা সাহিত্যের ইতিহাসকে তিনটি যুগে": ["৬৫০ থেকে ১২০০"],
    "মধ্যযুগের কাব্যের প্রধান ধারা কয়টি": ["চার ধারা"],
    "নিচের কোনটি মধ্যযুগের কাব্যের প্রধান ধারা নয়": ["মঙ্গলকাব্য", "চর্যাপদ"],
    "বাংলা ভাষার কালক্রম বিভাজন": ["প্রাচীন, মধ্য ও আধুনিক"],
    "কোনটি ভাষাবংশের নাম নয়": ["দ্রাবিড়ীয়", "আফ্রিকীয়"],
    "'র' বর্ণটির ব্যবহারে": ["রেফ"],
    "কোন ভাষার নিজস্ব লিপি নেই": ["চীনা"],
    "কোনটি লিপি বিবর্তনের ধাপ নয়": ["বানমুখ"],
}

COVER.update({
    "বাংলা ভাষার উদ্ভব হয়-": ["সপ্তম শতাব্দী", "সপ্তম খ্রিষ্টাব্দ"],
    "আর্যরা বাংলায় অস্ট্রিকদের ওপর": ["সভ্যতায় অনেক উন্নততর ছিল বলে"],
    "গৌড়ী প্রাকৃত বলতে বোঝায়": ["সাধারণ মানুষের মুখে যে ভাষা প্রচলিত ছিল, তাই গৌড়ী প্রাকৃত"],
    "কোন ভাষা থেকে বাংলা ভাষার জন্ম হয়েছে বলে মনে করা হয়": ["বঙ্গ-কামরূপী"],
    "বাংলা ভাষার বয়স কত": ["এক হাজার বছর"],
    "অস্ট্রো-এশীয় ভাষা প্রধানত কয় ভাগে": ["মোন-খমের", "মুণ্ডা", "দুই ভাগে"],
    "বাংলা সাহিত্যের ইতিহাসে আদিযুগ": ["৬৫০ থেকে ১২০০"],
    "কোন ঘটনাকে কেন্দ্র করে বাংলা সাহিত্যের প্রাচীন": ["বখতিয়ার খলজির বঙ্গবিজয়"],
    "বাংলা সাহিত্যে আধুনিক যুগের প্রারম্ভকাল": ["ফোর্ট উইলিয়াম কলেজের প্রতিষ্ঠা"],
    "বাংলা সাহিত্যে আধুনিক যুগ প্রকৃতপক্ষে কার": ["মাইকেল মধুসূদনের সদর্প আবির্ভাব"],
    "ড. সুনীতিকুমার চট্টোপাধ্যায়ের মতে প্রাচীন যুগ বা": ["৯৫০-১২০০"],
}
)


def page_texts():
    raw = (HERE.parent / "01-bangla-sahitto" / "note.html").read_text(encoding="utf-8")
    parts = raw.split('<section class="page')[1:]
    out = []
    for p in parts:
        t = re.sub(r"<[^>]+>", " ", p)
        t = htmllib.unescape(t)
        out.append(re.sub(r"\s+", " ", t))
    return out


def norm(s):
    return re.sub(r"\s+", " ", s.replace("‌", "").replace("‍", "")).strip(" ।.")


def main():
    pages = page_texts()
    qs = bq.prepare(bq.TOPIC)
    bad = []
    for x in qs:
        need = None
        for k, v in COVER.items():
            if x["q"].startswith(k):
                need = v
                break
        if need is None:
            need = [x["opts"][x["ans"]]]
        txt = norm(pages[x["page"] - 1])
        miss = [n for n in need if norm(n) not in txt]
        if miss:
            bad.append((x["n"], x["page"], x["q"], x["opts"][x["ans"]], miss))
    print(f"{len(qs)} questions checked, {len(bad)} not covered on their note page")
    for n, pg, q, a, miss in bad:
        print(f"  Q{n} (page {pg}): {q[:60]} | answer: {a} | missing: {miss}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
