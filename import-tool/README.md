# import-tool

Runs on your laptop, never deployed. Imports questions, note PDFs and figures into the "Govt Jobs Website" Supabase
project. No AI is called. The question file format is in `docs/QUESTION_FORMAT.md`.

## Setup (once)

```bash
cd import-tool
pip install -r requirements.txt
cp .env.example .env     # then fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
```

The service role key bypasses RLS. It stays in `import-tool/.env` (git-ignored) on your own laptop. LaTeX checking uses
the KaTeX that `app/` installs, so run `npm install` in `app/` once and keep Node.js available. Without it the tool
still runs and says LaTeX was not parsed.

Add the topics in Admin > Topics first: a question file points at an existing topic number.

## Commands (run from `import-tool/`)

```bash
# 1. Check files. Offline, writes nothing. Folders are searched for *.md files.
python -m govtimport check my_questions/english_topic3.md

# 2. Preview against the database. Reads only, writes nothing.
python -m govtimport import my_questions/english_topic3.md --dry-run

# 3. Import. Questions arrive as drafts. Add --approve to approve them straight away.
python -m govtimport import my_questions/english_topic3.md
python -m govtimport import my_questions/english_topic3.md --approve

# Note PDF for a topic (checks text, fonts and size, uploads to the private notes bucket, links it to the topic)
python -m govtimport notes notes/english_topic3.pdf --subject English --topic 3

# One figure on its own (figures named in **Figure:** are uploaded automatically during import)
python -m govtimport figure figures/ch3-table.png --subject English --topic 3 --page 14 --caption "Table 3.1"

# Which exams still have a short last set, and how many questions are missing
python -m govtimport report
```

Re-running an import is safe: a question whose text already exists in the topic is skipped, and a figure with the same
content is stored once. If something fails midway the tool stops, removes the half-written question, and tells you
which one. Fix it and run again.

## Tests

```bash
python -m pytest
```

They use an in-memory fake of the database, so they need no key. `samples/` holds example files used by the tests.
Do not import the samples into the live site.
