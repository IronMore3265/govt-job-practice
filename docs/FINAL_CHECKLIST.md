# Final checklist: test the whole app once

All six phases are built. Use the app like a student and like the admin, and tell me what looks wrong or feels off. This one
list replaces the separate Phase 2 to 6 checklists (`PHASE2_CHECKLIST.md` and `PHASE3_CHECKLIST.md` are still there for detail
on the import tool and the question bank).

## What is already checked (you do not need to repeat it)

- All 7 migrations are applied to the Supabase project. The SQL tests in `supabase/tests/` (`rls.sql`, `integrity.sql`,
  `questions.sql`, `exam.sql`) pass. Re-running them in the SQL Editor is optional, and each ends with a PASSED line.
- `exam.sql` proves the important rule: while an exam runs, the data sent to the browser contains no answer key and no
  explanation. The key arrives only in the review after submit. It also covers scoring with 0.25 negative marking, time-out,
  retry of missed questions, other students being unable to open your session, and the leaderboard rules.
- The note viewer was run in a real browser with a test PDF: it opens at the saved page, scrolls, zooms, jumps, saves the page,
  keeps only nearby pages in memory, and works at phone width.
- The exam screen and the review were run in a real browser with sample data (English, Bangla, Math): the palette, mark for
  review, selecting and clearing an answer, the timer, correct and wrong colouring, "see page 12" links, "Missed only".
- Type-check, lint, 53 unit tests and the production build all pass.

## What I could not check (this is your list)

I cannot sign in as you, I have no note PDF or real questions, and no phone. So these have not been seen working end to end.

### 0. Setup you may still need
- [ ] `import-tool/.env` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (see `import-tool/README.md`).
- [ ] Vercel Authentication is off and sign-up is off in Supabase (Part F of the Phase 1 list).

### 1. Get content in (about 15 minutes)
- [ ] Admin > Topics: add real topics. Note the topic numbers.
- [ ] Write a question file in the format of `docs/QUESTION_FORMAT.md` (or import `import-tool/samples/` first as a trial), run `python -m govtimport check`, then `import`. Include one Bangla file and one Math file.
- [ ] Upload a real note PDF: `python -m govtimport notes your.pdf --subject English --topic 1`. Use a PDF built in the RoboNuggets style with embedded fonts.
- [ ] Admin > Questions: filter, open a question, edit it, approve drafts (single and "Approve all drafts").
- [ ] Admin > Exams: link topics to the exam. Admin > Sets: press "Build sets from unused questions". With fewer than 20 questions, set the exam's questions per set to 5 first.

### 2. Notes (as a student)
- [ ] Home > Notes (library) lists topics, with "Continue, page N" after you read.
- [ ] Open a note. The pages look right: cream background, ink border and hard shadow per page, orange progress bar, `PAGE x / y`. Real text is selectable. Charts and figures look sharp, Bangla letters are not broken.
- [ ] Zoom out, zoom in, Fit width, next and previous, jump to a page, thumbnails on the left (laptop). Close the tab, reopen: it resumes on the same page.
- [ ] The Download button (top right of the note viewer) saves the PDF. The PDF address stops working after about 10 minutes (open `/api/notes/<topic id>` while signed in, copy the link, try it later).
- [ ] Viewer controls: Back is a clear button; the bottom bar has page list toggle, previous, next, page box with "of N", zoom out, zoom level menu (Fit width, 50% to 300%) and zoom in, all the same height. The page list hides and shows, and the pages widen when it is hidden.
- [ ] On your phone: single column, the controls and bottom bar are easy to tap, pinch zoom works, scrolling a long note stays smooth.
- [ ] Home > pick an exam, press "Read notes first": the topic pills at the top switch between notes, and a sticky "Start exam" button stays at the bottom.

### 3. Taking an exam
- [ ] Home: pick subject, exam, topics. "All" is preselected. Narrowing topics turns the set choice to "New random" (a saved set is a fixed list).
- [ ] Start exam opens "Before you start": number of questions, time, marking rules with your exam's numbers. Nothing runs until Begin.
- [ ] Begin: countdown starts. Select an answer (it turns black), tap it again to clear. Mark for review (palette square turns orange). Jump with the palette. Previous and next chevrons work. The "answered" count updates.
- [ ] Refresh the page mid-exam: the answers and the remaining time are still right. Close the tab and reopen Home: an "Exam in progress, Resume" card appears.
- [ ] Switch your phone to airplane mode and tap an answer: a red "not saved yet" note appears, and it saves when the connection returns.
- [ ] Let the timer reach zero (use an exam with a very short time, for example 1 question and 20 seconds): the exam submits by itself and unanswered questions count as missed.
- [ ] Submit with questions left: it asks first.
- [ ] A Bangla question and a Math question look right on the exam screen (font, fractions).
- [ ] A question with a figure shows the image.
- [ ] Report question: the box opens, you send a note, and the admin bell shows it (Admin > Questions > Open reports).

### 4. After the exam
- [ ] Result: the score is right (right answers minus 0.25 per wrong answer, skipped costs nothing). Check one by hand.
- [ ] Review: right answer orange, your wrong pick black, others faded, a dashed explanation box with "Notes, page N" that opens the note at that page. "see page 12" in an explanation is a link too.
- [ ] "Missed only" filter. Time per question is shown.
- [ ] "Retry missed" starts a new exam of only the missed questions, with proportionally less time.
- [ ] "Save report PDF" opens the print dialog with a clean cream A4 layout (no buttons). Try Save as PDF.
- [ ] Redo the same set: Home shows "best x/y" on the set pill.

### 5. History and leaderboard
- [ ] History: finished exams with score, accuracy, time, "Time ran out" flag, accuracy by topic, and weak topics (under 70 percent, at least 3 questions) with a "Read the note" button. Each row opens its review.
- [ ] Admin > Settings > Leaderboard: switch on. As a student, the Leaderboard card appears on Home: Join, finish a full set, and you appear in the top 10 with your average. Leave. A second account sees only name, sets and average.
- [ ] Switch it off: the card disappears for everyone.

### 6. Admin
- [ ] Admin > Settings > Storage: bars for files and database, plus a per-bucket list.
- [ ] Admin > Settings > Export: download Content, People and Activity. Each is one JSON file that opens and has your data.
- [ ] Admin > Sets: Open a set, remove and add questions, Fill, curated set, Go live, demotion when a question goes back to draft.
- [ ] As a student, `/admin` and `/api/admin/export/content` are refused.

### 7. Look and feel (laptop and phone)
- [ ] Compare Home, the exam screen and the review with `docs/design/govt-ui-mockup.html`. Tell me anything that differs or looks off.
- [ ] No emoji, no em dashes, icon buttons have tooltips or labels.

## Choices I made that you may want to change

- **Narrowed topics use a new random set.** A saved set is a fixed list, so narrowing cannot apply to it.
- **A skipped question counts as missed** in topic accuracy and in "Retry missed". A skipped question costs no marks.
- **Weak topics** means under 70 percent over at least 3 asked questions. Easy to change.
- **Time-out grace is 3 seconds** on the server, so a slow connection does not lose the last answer. The clock is the server's, not the phone's.
- **Leaderboard** counts finished sessions of a full set or a full random set. Retries do not count. Only sessions started after joining count.
- **Export is JSON**, one file per group, streamed so large exports work. The note PDFs and figures are not in it.
- **Report PDF** uses the browser's print dialog, as planned. Nothing is generated on the server.
- **Notes can still be saved by a determined student** (a screenshot, for example). The viewer hides the right-click menu on pages and prints blank, and the file link expires after 10 minutes. This only makes casual copying harder, as the plan says.

## If something breaks

Tell me what you did and what you saw (a screenshot helps). For a problem on the live site I can read the Vercel runtime logs and
query the database, so a time and the page name is usually enough.
