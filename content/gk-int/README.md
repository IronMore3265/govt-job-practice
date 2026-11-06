# General Knowledge - International content

Same rules as the Bangla topics (`docs/BANGLA_CONTENT_RULES.md`): one topic, one note, every past MCQ kept, total a multiple of 20, coverage must be complete.
The note shares its helpers, stylesheet and fonts with `content/bangla/_build/`.

| Topic | Folder | Source | Build files |
|---|---|---|---|
| 1 বিশ্বের সাম্প্রতিক ও চলমান ঘটনাপ্রবাহ - ১ (280 questions: 279 past, 1 new; 28 note pages) | `01-bishwer-samprotik-cholman-ghotonaprobah-1` | `GK Int Pt 1.pdf` (32 scanned pages, book pages ক-২ to ক-৩২) | `_build/` |

Hand transcription of the scan (no OCR): `_build/src/s01.txt` to `s10.txt` are the note text (format at the top of `build_note.py`; `s10` is the answer-key page),
`m01.txt` to `m13.txt` are the book's MCQ blocks (`number | question | exam tag | options | key`).

```
python content/gk-int/_build/build_note.py        # note.html and note.pdf (needs playwright + Chromium)
python content/gk-int/_build/build_questions.py   # question.md, answer.md and the coverage check (stops if a question has no note page)
cd import-tool && python -m govtimport check ../content/gk-int/01-bishwer-samprotik-cholman-ghotonaprobah-1
```

Files in `_build/`: `qdata.py` (loads the MCQs, META overrides), `reasons_a.txt` and `reasons_b.txt` (one explanation per past question),
`need.txt` (phrases that must be on the note page that teaches each fact, used for the coverage check), `bn_stems.txt` (Bangla version added to
English-only questions, because the importer needs Bangla letters in a Bangla set).

Doubtful or unusual questions (all marked in `answer.md`, and explained on the note's last page "বইয়ের উত্তরমালা থেকে"):
- Book key lists several answers: Q87 (2024 ceasefire mediators), Q130 (top corrupt country), Q268 (NATO members). A combined option was added as the correct one.
- Book printed no key: Q14 (UK deputy PM), Q113 (highest population growth), Q136 (highest life expectancy), Q259 (G-77 members). The answer comes from the book's own explanation, or (Q14) is a guess flagged as doubtful; Q113, Q136 and Q259 got a fifth option.
- Book key disagrees with the book's own table: Q42 (Iraq president), Q61 (Lebanon PM), Q116 (smallest Asian country), Q271 (NDB members).
- The scan of the last page (book page ক-৩২) is cut off on the right: only the MCQs on its left side are readable, so the column on its right is missing.
- Options were added where the book printed none: Q105, Q118, Q167, Q168, Q171, Q186, Q225, Q233, Q251 (see "বইয়ে অপশন ছাপা নেই" in the source line).
