# Question file format

One Markdown file per topic (or part of a topic). Same habit as the MSc `*_MCQ.md` files, with a small header so the
importer knows where the questions belong. `import-tool/samples/` has working examples in English, Bangla and Math.

## Two-file format: question.md + answer.md (preferred)

Keep the questions and their answers in two files in the same folder. The importer reads the pair, matches questions by
number and cross-checks them, so a typo or a shuffled file is caught before anything is written.

```markdown
<!-- question.md -->
---
subject: Bangla
topic: 1
lang: bn
---

# Any title (ignored)

## Chapter heading (ignored)

### Q1. বাংলা লিপির উৎস কী?

- A. সংস্কৃত
- B. ব্রাহ্মী লিপি
- C. আরবি লিপি
- D. চীনা লিপি
```

```markdown
<!-- answer.md (no header needed) -->
### Q1. বাংলা লিপির উৎস কী?

**উত্তর:** B. ব্রাহ্মী লিপি

**ব্যাখ্যা:** বাংলা লিপি ব্রাহ্মী থেকে এসেছে।

**পৃষ্ঠা:** 7

**উৎস:** বিগত পরীক্ষা
```

- `question.md` has the header (`subject`, `topic`, `lang`) and, for each question, the `### Qn.` heading and options A to D.
- `answer.md` has, for each question, the same heading, `**উত্তর:**` (a letter, or letter plus the option text), `**ব্যাখ্যা:**`
  and `**পৃষ্ঠা:**` (the page of the note PDF). `**উৎস:**` is a note for people and is ignored. The English names
  `**Answer:**`, `**Reason:**`, `**Page:**` also work, and so do `**Figure:**`, `**Topic:**` and `**Lang:**`.
- Checked: every question has an answer, no answer without a question, the question text is identical in both files, and
  the option text written after the answer letter equals that option in `question.md`.
- Run it on the folder: `python -m govtimport check <folder>` and `python -m govtimport import <folder>`. Naming either file
  also means the pair. In a folder that holds both files, other `.md` files are ignored.
- `question.md` can also be used on its own for the old single-file format below, which still works.

## Single-file format (still supported)

## Example

```markdown
---
subject: English
topic: 3
lang: en
---

# English: Tenses (any title and intro text is ignored)

## Part A: Present tense (section headings are ignored)

### Q1. Choose the correct sentence.

- A. She don't like tea.
- B. She doesn't like tea.
- C. She not like tea.
- D. She doesn't likes tea.

**Answer:** B

**Reason:** With a third person singular subject the negative uses "doesn't" and the verb stays in its base form.

**Page:** 12

---

### Q2. Refer to the table. Which year had the highest value?
...
**Page:** 14

**Figure:** ch3-table.png | Table 3.1, Exports by year
```

## Header (required, at the very top between two `---` lines)

| Line | Meaning |
|---|---|
| `subject:` | Subject name exactly as in Admin (Bangla, English, Mathematics, General Knowledge). Case does not matter. |
| `topic:` | Topic **number** inside that subject (the number you gave the topic in Admin > Topics). The topic must already exist. |
| `lang:` | `en` or `bn`. The default for every question in the file. Optional, defaults to `en`. |

## One question

| Part | Rule |
|---|---|
| `### Q1. text` | Heading with the question number and the question text. The text may continue on following lines until the first option. Numbers must be unique inside a file. |
| `- A.` to `- D.` | Exactly four options, labelled A, B, C, D, each different. An option may continue on the next line. |
| `**Answer:** B` | One letter A to D. |
| `**Reason:** ...` | Required. The explanation shown after the exam. It may span several lines. If it says "see page 12", the site turns that into a link to the note (Phase 4). |
| `**Page:** 12` | Required. The page of the book or note the question comes from. |
| `**Figure:** file.png \| caption` | Optional. An image file (`.png`, `.jpg`, `.webp`, up to 5 MB) from the `figures/` folder next to the Markdown file. The caption after `\|` is optional. Questions that name the same file share one stored figure. Figures are 1:1 copies from the reference book, never redrawn. |
| `**Topic:** 4` | Optional. Overrides the header topic for this question. |
| `**Lang:** bn` | Optional. Overrides the header language for this question. |

Everything else (the `# title`, `## Part` headings, `---` rules, intro text) is ignored. `**Marking points:**` is for
written questions and is ignored with a warning.

## Text rules

- Save the file as **UTF-8**. The importer refuses anything else, and refuses text that was already garbled.
- **Bangla:** write it directly (no escapes). A question with `lang: bn` must contain Bangla letters in its text. After
  each question is written, the importer reads it back and compares it letter by letter, so lost conjuncts are caught.
- **Math:** write LaTeX between dollar signs, `$\frac{a+b}{2}$` inline, or `$$...$$` alone on a line for an equation row.
  The importer parses every piece with the site's own KaTeX. Write a real dollar sign as `\$` (for example `\$40`).
  Every `$` must be closed.
- Limits: question text 4000 characters, each option 1000, the reason 2000.
- No em dashes in text shown to students.

## What the importer checks

Exactly four options and one valid answer, a non-empty reason, a page number, the topic exists, UTF-8 and Bangla
survive, every `$` closes and parses, figure files exist, no duplicate questions (same text in the same topic is
skipped on re-import). Any error stops the whole import before anything is written.

## Asking Claude to write a file

> Write MCQs for the note "<topic title>" in the format of `docs/QUESTION_FORMAT.md`. Subject <subject>, topic <number>,
> language <en or bn>. Four options, one correct, a short reason that explains why, and the source page for each.
> Use `\$` for real dollar signs and `$...$` for math. Output only the Markdown file.
