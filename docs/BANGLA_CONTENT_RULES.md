# Bangla content rules (notes and questions)

Read this before building or changing any Bangla note or question set. It records what Nabil asked for while building
the first Bangla topic ("বাংলা সাহিত্য"). The same rules fit the other Bangla topics and, where they make sense, other
subjects.

Source book for the first topic: `docs/Bangla/অগ্রদূত_বাংলা_compressed.pdf` (scanned photos of book pages, no real text,
no OCR). Book page N is PDF page N + 2. Read pages by rendering them (see "Reading the book").

## 1. Structure: one topic, one note, one question set

- Nabil names the topic (for example "বাংলা সাহিত্য"). That name is the topic on the website. Several book chapters
  that he lists under one topic go into **one** note PDF and **one** question set. Never make one topic per chapter.
- Folder: `content/bangla/<NN>-<topic-slug>/` with `note.pdf` (git-ignored), `note.html`, `question.md`, `answer.md`. Shared: `content/bangla/_build/` (stylesheet, fonts, `build_notes.py`, `coverage_check.py`),
  `build_questions.py`, `qdata_*.py` (the question source of truth).
- The note starts with a contents page (chapter list with page numbers), then the chapters in book order. Page numbers
  are continuous, the cover page is page 1.

## 2. The note

- **Readable like a book, not question and answer.** The book is written as "প্র./উ." pairs and a list of past-exam
  MCQs. Turn each pair into prose, tables, short lists, callouts. Never copy the Q&A layout.
- Style: RoboNuggets guide style (cream paper, ink borders, hard orange or black shadow boxes, orange square before each
  heading). Bangla text in Noto Sans Bengali, numbers and the English footer in Outfit. No Doto for Bangla (Doto has no
  Bengali letters). The accent word in a title is orange Noto Sans Bengali bold.
- Bangla text must never get `letter-spacing` (it breaks conjunct letters). English labels only in the footer.
- No em dashes anywhere. Use commas, colons or parentheses.
- Real text PDF (selectable), fonts embedded (only Outfit and Noto Sans Bengali), well under 10 MB. Page content must end
  above y = 1070 px (the build script prints each page's bottom).
- Facts come from the book. Keep the book's own numbers, names and wording of definitions. Where scholars disagree
  (Shahidullah, Grierson, Sunitikumar and so on) show every view side by side in a table.
- Where the book's answer key is doubtful, say so inside the note in a clearly labelled box (see section 4).

## 3. Diagrams and charts in the note

- **Rebuild every diagram from the book as a clean vector diagram (inline SVG or HTML) in the note style.** Do not paste
  a photo crop of the book page, and do not replace a diagram with a simplified flow chart.
- The rebuild is **1:1 in content and layout**: every node, label, date, mark (`*`, `+`), number, arrow direction, caption
  and legend of the book's figure, in the same arrangement, with the book's spelling. Text stays real text.
- Only styling changes (fonts, line weight, colours). Orange is allowed on the one node that is the topic of the figure
  (for example বাংলা in the family tree).
- Worked example: `family_tree_svg()` in `_build/build_notes.py` (Shahidullah's "বাংলা ভাষার কুলজী").
- Note for `CLAUDE.md`: its rule "Figures are 1:1 copies from the reference book, never redrawn" is about question figures
  (`**Figure:**` images in the importer). For diagrams inside the **note**, this file's rule (rebuild) applies, because
  Nabil asked for it.

## 4. Questions

- **Include every past-exam MCQ from the book**, including doubtful ones, in the book's own option order and with the
  book's answer. Never silently skip one. If the book's key looks wrong or two options fit, keep the question and add a
  "সতর্কতা" sentence to the explanation, and mark the source line `বিগত পরীক্ষা (বইয়ের উত্তরমালা, সন্দেহযুক্ত)`.
  Tell Nabil which ones are doubtful.
- **Total per topic must be a multiple of 20.** Fill the gap with new questions written from the note (never from
  outside facts the note lacks). New questions are marked `নতুন প্রশ্ন` in `answer.md`. Their options are shuffled with
  a fixed seed so answers are spread over A to D.
- Each question has exactly four different options, one answer, a short explanation (why it is right), and a **Page**
  that is the page of the **note PDF** where the fact is taught (the site turns "page N" into a link to the viewer),
  not the book page.
- Files from one source (`qdata_*.py` -> `build_questions.py`):
  - `question.md`: header (`subject: Bangla`, `topic: <number>`, `lang: bn`), chapter headings, questions and options, no
    answers.
  - `answer.md`: quick key, then for every question the answer (`উত্তর`), explanation (`ব্যাখ্যা`), note page (`পৃষ্ঠা`) and
    source (`উৎস`).
  - There is no separate import file. **The importer reads the question.md + answer.md pair** (format in
    `docs/QUESTION_FORMAT.md`). The `topic` number must match Admin > Topics, so check it.
- Check, then upload (from `import-tool/`):
  ```
  python -m govtimport check ../content/bangla/<folder>             # offline
  python -m govtimport import ../content/bangla/<folder> --dry-run  # reads the database, writes nothing
  python -m govtimport import ../content/bangla/<folder>            # writes the questions as drafts
  ```
  Questions arrive as **drafts**; add `--approve` or approve them in the admin question bank. Re-running is safe (a
  question whose text already exists in the topic is skipped). After a change to an existing question, edit it in the
  admin question bank instead of re-importing.

## 5. Coverage rule (most important)

**Reading the note must be enough to answer every question.** The note is restructured from the book, so check it.

- After every build run `python content/bangla/_build/coverage_check.py`. It checks, for all questions, that the
  correct answer (or the phrase listed in its `COVER` table) appears on the note page that the question's **Page** points
  to. It must report `0 not covered`.
- If a question is not covered, **fix the note** (add the sentence, row or box that teaches it) and keep the question.
  Do not delete or weaken the question to make the check pass.
- Typical gaps: a different spelling in the note than in the question (গৌড়ী/গৌড়ীয়), a number written another way
  (এক হাজার / ১০০০), a fact that only the book's answer key states (put it in a labelled box such as
  "বইয়ের উত্তরমালা থেকে"), a past MCQ whose topic the book text does not explain.
- The check is literal text matching, so also read the explanation against the page once when a question is added.

## 6. Reading the book

1. Render the pages at 200 dpi with PyMuPDF (`page.get_pixmap(dpi=200)`), crop into top and bottom halves, and read each
   crop. A chapter's text, its "বিগত পরীক্ষায় আসা প্রশ্নসমূহ" MCQs and its diagrams are on neighbouring pages.
2. For a figure, extract the page's embedded image at its native size to read small labels (`doc.extract_image`), then
   zoom into parts. Transcribe every label before drawing.
3. Pages are photos, so some are rotated. Rotated figures are read by turning the crop 90 degrees.
4. The book's printed answer key is the source for past-exam answers. When a printed answer disagrees with the text, see
   section 4.

## 7. Build and verify

```
python content/bangla/build_questions.py        # question.md and answer.md (asserts multiple of 20)
python content/bangla/_build/build_notes.py     # note.html and note.pdf (needs: pip install playwright, Chromium)
python content/bangla/_build/coverage_check.py  # must say 0 not covered
python -m govtimport check ../content/bangla/<folder>   # from import-tool/
```

Topics so far (each has its own question data file, note builder and entry in `TOPICS` in `build_questions.py`):

| Topic | Folder | Question data | Note builder |
|---|---|---|---|
| 1 বাংলা সাহিত্য (120 questions) | `01-bangla-sahitto` | `qdata_t1_t3.py`, `qdata_t2_t4.py` | `_build/build_notes.py` |
| 2 আদি বা প্রাচীন যুগ: চর্যাপদ (80 questions, book pages 18 to 25) | `02-adi-prachin-jug` | `qdata_charyapad.py` | `_build/build_note_charyapad.py` |

`build_questions.py` and `coverage_check.py` take an optional topic number (`python content/bangla/build_questions.py 2`).
A new topic needs: a `qdata_*.py` (P = past MCQ, D = past MCQ with a doubtful key, N = new), a note builder that reuses the
helpers in `build_notes.py`, a page map (`PAGES`) and a `COVER` table for the coverage check. A question's `sec` key points to
the note page that teaches it, so keep the page map in step with the note layout.

- Open or rasterize every note page and look at it: conjunct letters correct, nothing clipped, nothing overlapping,
  diagram labels readable.
- Do not commit note PDFs or the book. The folder, scripts, `.md` files and `note.html` can be committed when Nabil says
  so (see `CLAUDE.md`).
