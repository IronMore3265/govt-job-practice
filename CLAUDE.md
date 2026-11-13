# CLAUDE.md

Govt job exam practice website for Nabil and friends. MCQ only. Read `PLAN.md` first. It is the source of truth. The UI reference is `docs/design/gamut-ui-mockup.html` (Gamut style, PLAN.md section 10).

## References
- Previous site this one grows from: https://github.com/IronMore3265/MSc-Practice-Website.git (live: https://ipe-studio.vercel.app/). Read it for patterns and reuse what fits (list at the end of PLAN.md section 14). Do not bring over AI, CQ, photo, math editor or router code. The one exception is the display-only `MathText` for the Math subject (LaTeX between dollar signs, no editor).
- Visuals: `docs/design/gamut-ui-mockup.html` is the current look. `docs/design/govt-ui-mockup.html` (with its PNG) is the older RoboNuggets mockup, kept for screen layout only.
- Building or changing a Bangla note or question set: read `docs/BANGLA_CONTENT_RULES.md` first and follow it (one topic, one note, book-like prose, diagrams rebuilt 1:1 as vector, every past MCQ kept, total a multiple of 20, coverage check must pass). For diagrams inside a note its rebuild rule applies, not the figures rule in the Rules section.

## Stack
- Next.js (App Router, TypeScript) on Vercel
- Supabase project "Govt Jobs Website" (ref `kjeolamvvggqobhlcwhn`): Auth (email and password, public sign-up OFF), Postgres with RLS, private Storage buckets `notes` and `figures`
- `pdfjs-dist` for the themed note viewer
- `lucide-react` for icons: Bell for notifications, ChevronLeft and ChevronRight for previous and next. No emoji, and icon-only buttons get an aria-label
- `import-tool/`: Python, run on the laptop, not deployed
- Fonts through `next/font`: Hanken Grotesk, Courier Prime, Noto Sans Bengali. The note PDFs keep Outfit as their Latin face (PLAN.md section 6.1)

## Rules
- No AI anywhere in the app. MCQ answering, set building and grading never call an AI. Questions and explanations are written offline and imported.
- Never commit secrets, `.env*` files, note PDFs, reference books or student data. Keep `.env.local` git-ignored.
- Every table has RLS with tested policies. Browser code uses only the anon key. The service role key is used only in server routes (invite sign-up, admin actions, signed URLs, cron) and the import tool.
- Storage buckets are private. The browser gets notes and figures only through short-lived signed URLs issued by a server route after an active-student check. The viewer has a Download button (Nabil allows downloads), served by a route that makes the same active-student check.
- Figures are 1:1 copies from the reference book, never redrawn.
- Exam mode only. No feedback while answering. Review after submit. The browser never receives the correct option or an explanation before the session is finished (database functions withhold the key). Sets have exactly 20 questions, 1 mark each, 0.25 negative marking per wrong answer, and a timer of 36 seconds per question (12 minutes for 20), all per-exam settings. A set is `live` only when it has 20 questions.
- Text is English or Bangla. Font stack `"Hanken Grotesk", "Noto Sans Bengali", sans-serif`. Courier Prime (labels, numbers, the accent word) has no Bengali letters, so Bangla titles use Noto Sans Bengali bold with the accent word on yellow.
- Schema changes are SQL migrations in `supabase/migrations/`, committed to the repo.
- UI follows PLAN.md section 10 (Gamut style, light mode only: white background, navy ink and 1px borders, purple for actions and selection, yellow for emphasis, green and red for right and wrong, hard shadows to the lower left). No em dashes in any UI text.
- Restyling a note must not move text between pages: questions store a note page and saved highlights store positions. After any change to `content/bangla/_build/guide.css`, rebuild and compare the page count and per-page text of each note with the previous PDF.
- Single branch: `main` is the only branch. Commit and push to it directly. No feature branches or pull requests unless Nabil asks for one.
- Never add Claude as a co-author or add attribution lines to commits or pull requests. Commits carry Nabil's name only.
- Build the remaining phases one after another without stopping between them. Each phase still writes its `docs/PHASE<n>_CHECKLIST.md`, but Nabil gets one combined list at the end and tests the whole app then, fixing what he finds afterwards. Stop early only when something cannot go on without him (a key or account only he has) or when an action could break or destroy live data. Do not ask him to check things in between.

## Environment variables
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `CRON_SECRET`, `ADMIN_EMAIL`.

## Phases
See PLAN.md section 11. Work on one phase at a time.
