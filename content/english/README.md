# English content

Same rules as the Bangla topics (`docs/BANGLA_CONTENT_RULES.md`): one topic, one note, every past MCQ kept, total a multiple of 20, coverage must be complete.
The note shares its helpers, stylesheet and fonts with `content/bangla/_build/`.

| Topic | Folder | Source | Build files |
|---|---|---|---|
| 1 The Noun (220 questions: 217 past, 3 new; 22 note pages) | `01-the-noun` | `English Pt 1.pdf` (42 scanned pages, "Professor's MCQ Review: English", book pages 03 to 44) | `_build/` |

The book part covers Parts of Speech, Noun, The Determiners, The Gender and The Number (all one topic). Hand transcription of the scan (no OCR):
`_build/src/s01.txt` to `s05.txt` are the note text (format at the top of `build_note.py`; the `*b.txt` files are the "MCQ Hints থেকে অতিরিক্ত তথ্য" sections,
`s05` is the key page), `m01.txt` to `m08.txt` are the book's MCQ blocks (`question | exam tag | options with ~ | key | the book's Hints`).

```
python content/english/_build/build_note.py        # note.html and note.pdf (needs playwright + Chromium)
python content/english/_build/build_questions.py   # question.md, answer.md and the coverage check (stops if a question has no note page)
cd import-tool && python -m govtimport check ../content/english/01-the-noun
```

Files in `_build/`: `qdata.py` (loads the MCQs and the 3 new ones), `reasons.txt` (an explanation for each past question that has no Hints in the book, key = number in
file order of `src/m*.txt`), `need.txt` (phrases that must be on the note page that teaches a fact; default is the target word of the stem, or the answer).
Question "Page" is the page of the note PDF (cover = page 1).

Doubtful questions (the book printed "Note" instead of a key; the option the book marked is used, the explanation carries a warning, and the note's last page shows the book's Note):
Q2 (Frailty), Q18 (not a material noun), Q33 (not an abstract noun), Q39 (advance), Q184 (Nucleus), Q207 (Spectrum).
Repeated stems got a number in brackets, for example `(2)`, because the importer skips a question whose text already exists in the topic.
Book typos kept as printed: "excercise", "Do not eat much bear", "Converted noun" for compound nouns, "Gender 8 প্রকার" (four are listed), "antennus", "dilema".
