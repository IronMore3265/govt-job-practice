# Phase 2 checklist

Phase 2 is the import tool (`import-tool/`) and the question file format (`docs/QUESTION_FORMAT.md`). The Bangla font
test page came in Phase 1 (`/font-test`) and you already checked it. Nothing in the website changed.

Do Part A first. Nothing below works until the tool has the service role key.

## Part A: set up the tool

1. In `import-tool/`, run `pip install -r requirements.txt`.
2. Copy `import-tool/.env.example` to `import-tool/.env` and fill in `SUPABASE_URL` (`https://kjeolamvvggqobhlcwhn.supabase.co`) and `SUPABASE_SERVICE_ROLE_KEY`. Check that `git status` does not list `.env`.
3. Run `python -m pytest` in `import-tool/`. Expect `33 passed` (no key needed).

## Part B: check and dry run (nothing is written)

- [ ] `python -m govtimport check samples` prints `3 file(s), 12 question(s), 0 error(s).`
- [ ] Make a copy of a sample, break it on purpose (delete an option, set `**Answer:** F`, remove `**Page:**`, leave a `$` open). `check` lists every problem with the question number and line, and exits with an error.
- [ ] Save a copy of a sample as ANSI/Windows-1252 and run `check`. It must say the file is not valid UTF-8.
- [ ] Add a topic in Admin > Topics (for example English, number 1), then run `python -m govtimport import samples/english_sample.md --dry-run`. It says `Would import 4 question(s) as drafts` and `Dry run: nothing was written`. Check in Supabase that no question rows exist.
- [ ] Point a copy of the sample at a topic number that does not exist. The dry run refuses and says to add it in Admin > Topics first.

## Part C: a real import (use throwaway topics, then delete them)

Add topics 1 in English, Bangla and Mathematics in Admin first. The samples are test content: delete those topics
afterwards (this removes the sample questions with them) so the question bank starts clean.

- [ ] `python -m govtimport import samples/english_sample.md` imports 4 drafts. Run it again: `skipped 4 that already exist`.
- [ ] Table Editor > `question`: 4 rows, `status` draft, `origin` import, `source_page` 12, 14, 20, 21. `mcq_option`: 16 rows, one `is_correct` per question, the explanation only on the correct one.
- [ ] `python -m govtimport import samples/bangla_sample.md`. In the Table Editor the Bangla text reads correctly, with conjuncts such as স্ব and জ্ঞ intact. Question 3 has `lang` en, the others bn.
- [ ] `python -m govtimport import samples/math_sample.md --approve`. The four questions are `approved`. The text keeps `$\frac{3}{4}...$` and `\$40` exactly.
- [ ] Short-set report: the output ends with a list per exam. After the Math import, "Mathematics Model Test" is not listed unless you linked topic 1 to it in Admin > Exams. Link it, run `python -m govtimport report`, and check it says `4 approved, 0 full sets, last set has 4 of 20, needs 16 more`.

## Part D: figures

- [ ] Put a small PNG in `import-tool/samples/figures/` and add `**Figure:** yourfile.png | Test caption` to two questions of a copy of a sample. Import it. Storage > `figures` shows one file under `english/001/`, and the `figure` table has one row linked from both questions. Delete the test data afterwards.
- [ ] A `**Figure:**` that names a missing file is an error at `check` time.

## Part E: note PDFs

- [ ] `python -m govtimport notes some.pdf --subject English --topic 1 --dry-run` reports pages and size without uploading.
- [ ] Run it for real. Storage > `notes` shows `english/001.pdf`, and Admin > Topics (or the `topic` table) shows `note_path` and `note_pages` filled in.
- [ ] A PDF over 10 MB gives a warning, a scanned PDF with no text gives a warning, and a non-PDF is refused.
- [ ] Try opening the file from the browser with the plain object URL. It must not work (the bucket is private). Signed URLs and the viewer arrive in Phase 4.

## Choices to review

- **Format.** MSc's `### Q1.` layout plus a header with `subject`, `topic` (the topic **number**) and `lang`. Fields are `**Answer:**`, `**Reason:**`, `**Page:**` and the optional `**Figure:**`, `**Topic:**`, `**Lang:**`.
- **Drafts first.** Imports are drafts unless you pass `--approve`, so you can review in Phase 3. The database only approves a question that has four options, one correct, and an explanation, which is why approval is the last write.
- **All or nothing validation.** One error stops the whole run before anything is written. Writing stops at the first database failure, and the half-written question is removed.
- **Duplicates.** A question is a duplicate when its text (ignoring spacing and case) already exists in the same topic. Edited questions are therefore imported as new ones: fix an existing question in the admin question bank (Phase 3), not by re-importing.
- **Figures.** Stored once per file content under `<subject>/<topic>/<hash>-<name>`. The figure row records the source page of the first question that used it.
- **Short-set report.** Sets are counted from approved questions in the exam's topics. Real set building arrives in Phase 3.
- **LaTeX check** needs Node and `app/node_modules`. The importer uses the site's own KaTeX, so it accepts what the site can draw.
- **Not in this phase.** Extracting figures from reference book PDFs, and editing questions. Figures are copied by hand or by your own tool and placed in `figures/`.
