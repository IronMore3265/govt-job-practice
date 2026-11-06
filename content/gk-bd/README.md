# General Knowledge - Bangladesh content

Same rules as the Bangla topics (`docs/BANGLA_CONTENT_RULES.md`): one topic, one note, book-like prose, every past MCQ kept,
total a multiple of 20, coverage must be complete. The note shares its helpers, stylesheet and fonts with `content/bangla/_build/`.

| Topic | Folder | Source | Question data | Note builder |
|---|---|---|---|---|
| 2 বাংলার ইতিহাস (60 questions: 54 past, 6 new) | `02-banglar-itihas` | `GK BD Pt 1.pdf` (4 scanned pages) | `_build/qdata_t2.py` | `_build/build_note_t2.py` |
| 4 উপমহাদেশে মুসলিম শাসন (240 questions: 236 past, 4 new; 14 note pages) | `04-upomohadeshe-muslim-shason` | `GK BD Pt 3.pdf` (16 scanned pages) | `_build/qdata_t4.py`, `t4_mcq.json` (hand transcription of the book's MCQs), `t4_reasons.py`, `t4_meta.py` | `_build/build_note_t4.py` |
| 3 প্রাচীন যুগে বাংলা (120 questions: 116 past, 4 new; 3 past questions keep their 5 options) | `03-prachin-juge-bangla` | `GK BD Pt 2.pdf` (8 scanned pages) | `_build/qdata_t3.py` | `_build/build_note_t3.py` |

```
python content/gk-bd/_build/build_note_t2.py        # note.html and note.pdf (needs playwright + Chromium)
python content/gk-bd/_build/build_questions_t2.py   # question.md, answer.md, and the coverage check (stops if a question has no note page)
cd import-tool && python -m govtimport check ../content/gk-bd/02-banglar-itihas
```

Topic 3 works the same way: `build_note_t3.py`, then `build_questions_t3.py` (it also writes the coverage result), then `python -m govtimport check ../content/gk-bd/03-prachin-juge-bangla`.
Eight past questions have a doubtful book key (two answers printed, or the key disagrees with the text); they carry a "সতর্কতা" sentence and the source line says so (Q20, 31, 32, 35, 43, 76, 107, 110).

Questions marked `x=True` in the data file are facts that only the book's answer key states; the note's last page ("বইয়ের উত্তরমালা থেকে") teaches them.

Topic 4: `python content/gk-bd/_build/build_note_t4.py`, then `python content/gk-bd/_build/build_questions_t4.py`, then `cd import-tool && python -m govtimport check ../content/gk-bd/04-upomohadeshe-muslim-shason`.
The note is paginated automatically (the paginator of the Bangla modern-period note). Four book keys are doubtful (Q97, Q152, Q162, Q191, marked in `answer.md`);
four questions had no printed options (options were added) and eight English-only questions got a Bangla version.
