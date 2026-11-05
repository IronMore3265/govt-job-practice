# Govt Job Exam Practice Website: Project Plan (v0.1)

Status: brainstorming is finished, the plan is build-ready except for the items in section 12. The app will be built with Claude Code and kept on GitHub. This site is a sibling of the MSc practice website and reuses its stack, look and rules, but it is a separate app with its own database and its own accounts.

## 0. Decisions locked

- Purpose: practice for government job exams.
- Question type: MCQ only. No CQ, no numerical problems, no handwriting upload, no math editor.
- No AI at runtime. MCQ answering never calls an AI, and there is no Gemini key, router or job queue in this app. Questions and explanations are prepared ahead of time and imported (section 5).
- Mode: exam mode only. There is no practice mode. Feedback comes in the review after submit.
- Sets: 20 questions per set, 1 mark each, 0.25 negative marking per wrong answer. If the last set of an exam is short, the missing questions are written from the notes ahead of time (section 2).
- Language: English and Bangla, in questions, explanations, notes and UI text. Noto Sans Bengali is the Bangla font (section 10).
- Subjects at launch: Bangla, English, Mathematics, General Knowledge. The admin can add more.
- Timer: 60% of the number of questions in minutes, which is 36 seconds per question, so 12 minutes for a 20 question set. Editable per exam.
- Content source: questions, explanations and notes are written offline with Claude and imported. No AI at runtime.
- Accounts: invite codes and admin approval work as on the MSc site.
- Admin notification: the admin gets a notification when a new account signs up, in-app only through the bell on the website. No email or Telegram (section 7).
- Leaderboard: yes, as on the MSc site. Opt-in per student, and the admin can switch it on or off for everyone (section 3, item 11).
- Notes: every topic has a note PDF. Before starting an exam, the student can read it in an in-site viewer that matches the site theme (section 6).
- Note PDFs follow the RoboNuggets guide style (cream paper, Outfit type, orange Doto pixel accents, hard-shadow boxes). They are real text PDFs, not OCR scans, and they carry the graphs, charts and other visuals from the reference book.
- Platform: Next.js (App Router, TypeScript) on Vercel, with the existing Supabase project **Govt Jobs Website** (ref `kjeolamvvggqobhlcwhn`, region ap-south-1). It is empty today (no tables). Auth, Postgres with RLS, private Storage buckets.
- Accounts: this site has its own accounts, because it uses its own Supabase project. Friends sign up again here. Nothing is shared with the MSc site, on the frontend or in credentials.
- Look: RoboNuggets style, same tokens as the MSc site (section 10).
- Devices: laptop and phone.
- Build workflow: Claude Code, single branch `main`, GitHub, Vercel (section 14).

## 1. Goal

A web app where you and your friends practice MCQs for government job exams. Each subject has notes you can read first, then timed MCQ sets in exam mode, a review with explanations that point to the source page after submit, and a history that shows weak topics.

## 2. Structure: subjects, exams and sets

- Subject: Bangla, English, Mathematics and General Knowledge at launch. The admin can add more.
- Topic: a chapter-sized unit inside a subject. One topic has one note PDF and its own questions.
- Exam: a saved recipe, defined by the admin: name, subjects and topics included, number of questions, marks per question, negative marking per wrong answer (default 0.25), timer (default 36 seconds per question).
- Set: a saved list of exactly 20 questions from an exam's topics. Sets are built automatically and spread across the topics. The student can redo a set or make a new random one (also 20 questions). Redoing shows earlier scores.
- Short last set: when an exam's question bank does not divide into full sets of 20, the last set is short. The import tool flags it (for example "Set 4 has 14 of 20, 6 more needed") and keeps that set as a draft. The missing questions are written offline from the notes, with Claude, like all other questions, and imported. The set goes live once it has 20. Nothing is generated while a student is using the site.
- Defaults, editable per exam: 20 questions per set, 1 mark each, 0.25 negative marking per wrong answer, and a countdown of 60% of the number of questions in minutes (36 seconds per question, so 12 minutes for 20 questions). The seeded exams for the four subjects use these defaults: one exam per subject, and the admin can add mixed exams in the portal.
- Practice scope: the exam's topics by default, narrowed to fewer topics if the student wants.

### 2.1 Exam mode (the only mode)

- No feedback while answering. A question palette shows answered, unanswered and marked-for-review questions.
- Score is the marks for correct answers minus 0.25 per wrong answer. Unanswered questions cost nothing (standard rule, change it if the real exam differs).
- At timer zero the set is submitted and unanswered questions count as missed.
- Before the exam, a briefing screen ("Before you start") lists the questions, time, marking rules and colour key, as on the MSc site. The clock starts when the student presses Begin.
- The answer key stays in the database until the exam is submitted. While the exam runs, the browser never receives which option is correct or any explanation. Questions are read and answers saved through database functions that withhold the key until the session is finished (the MSc site does the same for its MCQ answers).
- After submit, a review shows every question: a wrong pick fills black, the correct option fills orange, and a dashed explanation box shows the reason and source page. It also shows time per question.

## 3. Core features (MVP)

1. Login, invites, approval and roles (section 7).
2. Admin portal: subjects, topics, exams, sets, question bank review, note PDFs, students and invites, storage usage.
3. Note PDFs in private Storage with a themed viewer, opened from the start screen and from a Notes library.
4. Question import from Markdown files (section 5), plus manual add and edit in the admin portal.
5. MCQ exam mode: countdown, question palette, mark for review, submit, then a review of every answer.
6. Results with score, negative marking applied, accuracy by topic and weak topics.
7. History per student: attempts, scores, time, topic accuracy.
8. Optional "Save report PDF" through the browser print stylesheet. Never forced.
9. Report a question: a "Report question" button sits on the exam screen (next to Mark for review) and in the review after submit. The student adds a short note. It saves a `question_report` and a trigger writes a `notification` for the admin, so the report shows up in the admin's bell right away, with the question, who reported it and the note. The admin sees all open reports in the question bank, fixes the question and marks the report resolved. Govt exam answers must be right, so this matters.
10. Retry missed: start a new session made only of the questions missed in a finished session.
11. Leaderboard, copied from the MSc site: per exam, each student's average score percentage over finished full-set sessions. The admin switches it on or off for everyone. Students join it themselves (opt-in), and only sessions started after joining count. Leaving and joining again restarts the count. It shows the top 10 plus your own row, and shares only a name, an average and a session count. Retries of missed questions do not count. Answers stay private.

## 4. Later features

- Past-paper sets (year-wise official papers) as their own exam type.
- Bookmark questions and review only the missed ones (spaced repetition).
- Search inside notes.
- Admin upload of notes and questions from the browser.
- Password reset by email.

## 5. Content pipeline (offline, no AI at runtime)

Questions and notes are prepared on your laptop with Claude, then imported once.

- Questions are written as Markdown files, one file per topic or topic group (the MSc project already uses this habit with its `*_MCQ.md` files). Each question has: text, four options, the correct option, an explanation, and the source page. The exact file format is fixed in Phase 2 after checking the MSc files, so the same authoring habit works.
- `import-tool/` (Python) parses the Markdown, validates it (exactly one correct option, no empty explanation, page numbers present) and writes to Postgres. A dry-run mode prints errors without writing.
- Questions that depend on a visual reference a figure file. Figures are 1:1 copies extracted from the reference book, never redrawn. They go to a private `figures` bucket.
- Note PDFs are uploaded to the private `notes` bucket by the same tool and linked to their topic.
- The service role key is used only by this tool and by server routes.
- Questions, options and explanations can be English or Bangla. Each question has a `lang` field. The importer checks that the file is UTF-8 and that Bangla text survives the round trip.
- Math: Mathematics questions, options and explanations are written as text with LaTeX between dollar signs, for example `$\frac{a+b}{2}$`, the same stored format as the MSc site. The site only displays it (no editor). The importer checks that every `$` is closed and the LaTeX parses.
- Set filling: after import the tool lists every exam whose last set has fewer than 20 questions and how many are missing, so the missing questions can be written from the notes and imported.

## 6. Note PDFs and the themed viewer

### 6.1 The PDFs

- Built outside the app, in the RoboNuggets guide style, using the existing RoboNuggets PDF skill. Real text PDFs (selectable, searchable, small), never scanned images of text.
- Visuals come from the reference book: graphs, charts, tables and diagrams as 1:1 copies.
- Equations in the Math notes are typeset as real text and symbols, not images.
- Fonts: Outfit for English and Noto Sans Bengali for Bangla, both embedded in the PDF. Bengali needs correct text shaping (conjunct letters), so Phase 2 starts with a test page that is checked by eye before any real notes are built.
- Size target: under 10 MB per PDF, so the 1 GB free storage holds a large library.
- Reference books may be copyrighted. The site is private (login plus approval). Only the study notes and the figures used in them are stored online, never the full reference books.

### 6.2 The viewer

- Library: pdf.js (`pdfjs-dist`) renders each page to a canvas with a text layer, inside our own interface. The browser's default PDF viewer is not used, because it cannot be themed.
- Layout: cream background, each page shown as a card with an ink border and a hard black shadow. Top bar with the topic title (one Doto accent word), page x of y, zoom out and in, fit width. Orange reading progress bar. Thumbnail drawer on laptop, bottom page jump on phone.
- Phone: single column, pinch zoom, large tap targets.
- Performance: render only the pages near the screen, free the canvases of pages that scroll away.
- Resume: the last page read per student and note is saved, so reopening continues there.
- Entry points: on the start screen, after picking the exam and topics, a "Read notes first" button opens the viewer on the selected topics' PDFs, with a sticky "Start exam" button. There is also a Notes library in the main menu.
- Delivery: the browser never gets a permanent link. A server route checks that the student is active, then returns a signed URL that expires in about 10 minutes. The viewer has a Download button (allowed by Nabil), which goes through `/api/notes/<id>/download`: the same active-student check, then a redirect to a signed link that saves the file.
- Same dashed explanation style: when an MCQ explanation says "see page 12", the page number is a link that opens the viewer at that page.

## 7. Accounts, invites and admin

Roles: student (practice, notes, history, invite friends) and admin (you, plus the admin portal at `/admin`).

- Supabase Auth with email and password. Public sign-up is OFF in the new project. No email service in v1. The admin resets passwords in the portal.
- Any active member can create invite codes: up to 3 unused at a time (editable), one use each, valid 7 days.
- Sign-up goes through a server route that checks the code, then creates the user. The account starts as `pending` and cannot practice until the admin approves it. The admin sees who invited whom.
- Admin notification: when someone signs up, a database trigger writes a row to `notification` for the admin, the same pattern as the notification bell on the MSc site. The bell in the top bar shows an unread count and a list (name, who invited them, time) that links to the pending approvals. The Students tab also shows the pending count. A reported question creates the same kind of notification (section 3, item 9). Notifications are in-app only by decision, so the admin sees them on the next page load.
- `ADMIN_EMAIL` seeds the first admin.
- Students' attempts are private to them (enforced by RLS).
- Because this is a fresh project, every student creates a new account here, even if they already use the MSc site.

Admin portal screens: exams and set settings, subjects and topics, note PDFs, question bank (filter, edit, delete, add), sets, students and invites (approve, disable, reset password, invite limits), storage usage and data export.

## 8. Architecture and Supabase setup

```
Phone / laptop browser
   |  HTTPS
Vercel: Next.js app (UI + server routes)
   |-- Supabase Auth: email and password login
   |-- Supabase Postgres: app data, protected by RLS
   |-- Supabase Storage (private): notes bucket, figures bucket

Your laptop, per batch of content: Python import tool
   Markdown questions, note PDFs, figures --> Postgres and Storage
```

Stack: Next.js, Supabase, `pdfjs-dist` for the viewer, `lucide-react` for icons, display-only math rendering for the Math subject (the MSc `MathText` component, no math editor, no on-screen math keyboard), Python import tool. No Gemini SDK.

- Free plan limits (as of the MSc plan, October 2026): 500 MB database, 1 GB storage, project pauses after one week without activity. Keep it awake with a daily Vercel cron that makes one small query (`CRON_SECRET` protects the route). A paused project can be restored from the dashboard.
- Backups: the free plan gives no restore points to rely on. The admin portal gets an "Export data" button and the repo keeps all migrations as SQL files.
- Buckets: `notes` and `figures`, both private. Writes only with the service role (import tool, server routes). Reads only through signed URLs issued after an active-student check, plus storage policies as a second layer.
- RLS on every table, written as migrations and tested with two student accounts. Browser code uses only the anon key.
- Public sign-up OFF. The service role key lives only in Vercel environment variables and the local `.env`, never in browser code.
- Region note: ap-south-1 is Mumbai, which is close enough to Bangladesh for this app.

## 9. Data model (draft)

- `auth.users` (managed by Supabase Auth)
- `profile(id, user_id, name, role[student|admin], status[pending|active|disabled], invite_limit, invited_by, approved_by, approved_at, leaderboard_since)` (`leaderboard_since` is null until the student joins)
- `invite(id, code, created_by, used_by, expires_at, created_at)`
- `subject(id, name, sort_order)`
- `topic(id, subject_id, number, title, note_path, note_pages)`
- `figure(id, topic_id, page, label, caption, blob_path)`
- `question(id, subject_id, topic_id, lang[en|bn], text, figure_id, source_page, origin[manual|import], status[draft|approved])`
- `mcq_option(id, question_id, label, text, is_correct, explanation)`
- `exam(id, name, topic_ids, question_count, marks_per_question, negative_mark, time_seconds, sort_order)` (`time_seconds` defaults to 36 times `question_count`)
- `question_set(id, exam_id, name, origin[auto|curated], status[draft|live], question_ids, created_by, created_at)` (a set is `live` only when it has 20 questions)
- `session_run(id, user_id, set_id, topic_ids, started_at, finished_at, score, negative_applied)`
- `attempt(id, session_run_id, question_id, user_id, selected_option, is_correct, marked_for_review, seconds_spent)`
- `note_progress(user_id, topic_id, last_page, updated_at)`
- `notification(id, user_id, kind[new_signup|question_report], ref_profile_id, ref_report_id, created_at, read_at)` (written by triggers on `profile` and `question_report`, students cannot write it)
- `question_report(id, question_id, user_id, note, status[open|resolved], created_at)`
- `app_setting(id, leaderboard_on, updated_at)` (one row of site-wide switches)

## 10. UI specification (RoboNuggets style)

Same tokens as the MSc site: background cream `#F2EFE8`, ink `#1C1A16`, muted `#6F6A5C`, orange `#FF6B1A`, card `#FAF8F2`. Outfit 400/500/600 for English text, Doto 900 for one accent word per English title. Bangla text uses Noto Sans Bengali (400/500/700). Set the font stack to `Outfit, "Noto Sans Bengali", sans-serif` so Bangla letters fall back automatically inside mixed text. Doto has no Bengali letters, so a Bangla title uses Noto Sans Bengali bold with the accent word in orange instead of pixel type. Load fonts with `next/font` and embed them in the note PDFs. No em dashes in any UI text.

| Component | Style |
|---|---|
| Question card | 2px orange border, 8px radius, card background, hard orange shadow (8px 8px 0) |
| MCQ option card | 2px ink border, 8px radius, hard black shadow (6px 6px 0) |
| Option, correct (review after submit) | Orange fill, pressed toward its shadow |
| Option, wrong (review after submit) | Black fill with cream text, pressed |
| Explanation box (review) | 2px dashed ink border, 8px radius, orange label with source page (a link to the viewer), short text |
| Timer | Small black pill in the top bar with orange digits |
| Question palette (exam mode) | Small bordered squares, answered black, marked orange, unanswered card color |
| Pickers (subject, exam, topics, set) | Pill buttons, selected pill is black |
| Exam cards | Ink border and black shadow, selected card orange and pressed |
| Note viewer pages | Page cards with ink border and hard black shadow on cream, orange progress bar, toolbar as black pills |
| Admin tabs | Small pill tabs, active tab black |
| Icons | `lucide-react`, 2px stroke in ink color. ChevronLeft and ChevronRight for previous and next (exam screen and note viewer), Bell for notifications. No emoji. Icon-only buttons need an aria-label. |
| Report question button | Small bordered button, text "Report question", next to Mark for review. Opens a short note box, then confirms. |
| Notification bell | Bell icon button with an orange count badge. The panel lists new signups and reported questions, newest first, unread marked with a chip. |
| Leaderboard | Ink-bordered card in the Home side column, rank, name, session count and average per row, your own row highlighted (same classes as the MSc `lb-*` styles) |

Screens:

1. Home: subject, exam, topics (preselected, tap to narrow), set (Set 1, 2, 3, new random, 20 questions each), then "Read notes first" and "Start exam".
2. Note viewer.
3. Before you start (briefing: questions, time, marking rules, colour key, palette key; the clock starts on Begin), then the exam screen: countdown, question palette, mark for review, submit.
4. Review after submit: every question with the correct answer, explanation and time.
5. Results (score with 0.25 negative marking applied) and weak topics, with optional "Save report PDF".
6. History.
7. Notes library.
8. Login and sign-up with invite code.
9. Admin portal, with the notification bell.
10. Leaderboard panel in the Home side column (top 10 plus your row, opt-in).

Visual references, all in `docs/design/` or linked: `exam-ui-mockup-v5.png` (the MSc mockup, base style), `govt-ui-mockup.html` and its PNG (this site's new screens: home, note viewer, briefing, exam screen with palette and a Bangla question, result and review, admin notification), the MSc live site (ipe-studio.vercel.app, login page only without an account) and the MSc repo (github.com/IronMore3265/MSc-Practice-Website), whose `globals.css` holds the exact component styles. Still to mock up before Phase 6: Notes library and History.

## 11. Build phases

1. Phase 1: Next.js app on Vercel, schema migrations and RLS in the existing Supabase project, private buckets, roles, invite codes and approval, admin shell, subjects, topics and exams.
2. Phase 2: Bangla font and PDF shaping test page first, then the import tool: Markdown question parser (English and Bangla) with dry run, short-set report, note PDF upload, figure upload.
3. Phase 3: Question bank screens and the set builder.
4. Phase 4: Note viewer (pdf.js, themed, signed URLs, resume), Notes library and the "Read notes first" step.
5. Phase 5: MCQ exam mode, countdown, 0.25 negative marking, palette, review after submit with explanation links to the viewer.
6. Phase 6: History, weak topics, leaderboard, optional report PDF, admin storage usage and export, polish.

Status (November 2026): Phases 1 to 6 are built. The combined hand-check list is `docs/FINAL_CHECKLIST.md`.

Each phase writes a short checklist of things to verify by hand, saved as `docs/PHASE<n>_CHECKLIST.md` like on the MSc site. Phases are built back to back with no hand checks in between (decided after Phase 3). Claude verifies what it can itself (unit tests, build, lint, database tests that roll back), and Nabil gets one combined list when the last phase is done, tests the whole app then, and reports problems to be fixed.

## 12. Open questions

All earlier questions are answered and moved into section 0 (subjects, content source, accounts, timer). One small item is left, and it does not block Phase 1:

1. Exam names: the plan seeds one exam per subject (Bangla, English, Mathematics, General Knowledge) with the default recipe. If you want named mixed exams (for example a BCS style model test with all four subjects), give the names and the mix, or add them yourself in the admin portal later. It will be decided based on Developers wish in future.

## 13. Risks

- Supabase free project pausing after a week of inactivity (mitigated by the daily cron and a reminder to restore from the dashboard).
- Free storage (1 GB) filling up (mitigated by the 10 MB PDF target, figure compression and a usage view in admin).
- Wrong or missing RLS policies leaking data (mitigated by migrations, tests with two accounts, no public sign-up).
- Wrong explanations or source pages in imported questions (mitigated by importer validation and admin review before a question is approved).
- pdf.js slow on old phones with large PDFs (mitigated by rendering only nearby pages and the size target).
- Copyright on reference book material (mitigated by a private site and storing only notes and figures, not whole books).
- Viewers can still save a PDF they can see (accepted, section 6.2).
- Bangla conjunct letters rendering wrongly in the note PDFs or in pdf.js (mitigated by the Phase 2 test page, embedded Noto Sans Bengali, and checking a real note page by eye before building the rest).
- A short last set staying as a draft because its missing questions were never written (mitigated by the importer's short-set report).

## 14. Build workflow

Repository (private, one repo): `app/` (Next.js), `import-tool/` (Python), `docs/PLAN.md`, `docs/design/`, `supabase/migrations/`, `CLAUDE.md`.

Rules carried over from the MSc site:

- Follow this plan and the design tokens in section 10.
- Never commit secrets, `.env*` files, note PDFs, reference books or student data.
- Every table has RLS with tested policies. Browser code uses only the anon key. The service role key is used only in server routes (invite sign-up, admin actions, signed URLs, import tool).
- MCQ answering never calls an AI.
- Schema changes are SQL migrations committed to the repo.
- Single branch: `main` only, commit and push directly, no feature branches or pull requests unless asked.
- Commits carry Nabil's name only, no co-author or attribution lines.
- No em dashes in UI text.
- Each phase writes its hand-check list, and all lists are given to Nabil together after the last phase (section 11).

Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `CRON_SECRET`, `ADMIN_EMAIL`. The import tool uses its own git-ignored `.env` with the Supabase URL and service role key.

Reuse from the MSc repo (github.com/IronMore3265/MSc-Practice-Website). Claude Code reads it for patterns and copies what fits, and leaves out everything about AI, CQs, photos, the math editor and the router:

- Auth and sessions: `proxy.ts` (session refresh with `getClaims`, redirect to `/login`), `lib/supabase/server.ts` and `admin.ts`, `lib/auth.ts`, the login and signup pages, `api/signup`, `lib/invites.ts`, `InvitePanel`, the waiting page.
- Database patterns: the `private` schema helpers `is_admin()` and `is_active()` used in RLS policies, security definer functions with a fixed `search_path`, revoked default grants, the keep-alive cron route.
- Notifications: the `notification` table, trigger functions and `NotificationBell`, changed to write `new_signup` rows for the admin.
- Exam flow: `ExamBriefing`, `McqPlayer` (timer, segments, option cards), `SessionResult`, the retry-missed flow, the question report route. Change them to exam mode: no answer key before submit, 20 questions, negative marking.
- Math display: `MathText` and `lib/math-text.ts` (display only, no editor). Claude Code may use KaTeX instead if it is lighter.
- Styling: `globals.css` and the layout and font setup, plus Noto Sans Bengali. Replace the MSc repo's hand-made `Icons.tsx` with `lucide-react`.
- Leaderboard: the leaderboard migration (`app_setting`, `leaderboard_since`, `set_leaderboard_opt_in`, `exam_leaderboard`) and the `Leaderboard` component.
- Tests and checklists: `node --test` for the pure logic in `lib/`, and one checklist file per phase.

First instruction to give Claude Code: build Phase 1 following `PLAN.md`, then stop and list what to verify.
