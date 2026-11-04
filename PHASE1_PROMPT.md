# Prompt for Claude Code: Phase 1

Read CLAUDE.md and PLAN.md. Also read the MSc repo (https://github.com/IronMore3265/MSc-Practice-Website.git) for patterns, as listed at the end of PLAN.md section 14. Build Phase 1 only:

1. Create the Next.js (TypeScript, App Router) app in `app/` and initialise git. Set it up for Vercel.
2. Connect to the existing Supabase project "Govt Jobs Website" (ref `kjeolamvvggqobhlcwhn`, currently empty). I will put the keys in `app/.env.local`; create `.env.example` with the variable names only.
3. Write migrations in `supabase/migrations/` for every table in PLAN.md section 9 (profile, invite, subject, topic, figure, question, mcq_option, exam, question_set, session_run, attempt, note_progress), plus `notification`, `question_report` and `app_setting` (and `profile.leaderboard_since`), with RLS policies for each. Students see only their own attempts, session runs and note progress. Approved question content is readable by active students only. Admin tables and writes are admin only.
4. Create the private Storage buckets `notes` and `figures` with policies: no direct browser reads or writes, writes only with the service role.
5. Login page and create-account page (invite code required). Public sign-up is off. A server route validates the code and creates the user as `pending`.
6. Roles and approval: ADMIN_EMAIL becomes admin on first sign-in. Pending users see a waiting screen.
7. Any active member can create invite codes (max 3 unused, expire in 7 days). Show "invited by" in the admin student list.
8. Admin notification: when a new account signs up, a trigger on `profile` writes a `notification` row for the admin. Show a bell with an unread count and list in the top bar (copy the pattern from the MSc repo's notification migration and `NotificationBell`), and a pending count on the Students tab. Use the Bell icon from `lucide-react`, no emoji. A trigger on `question_report` writes the same kind of notification (kind `question_report`), so reported questions reach the admin's bell too. The Report question button itself is built in Phase 5.
9. Admin portal shell at `/admin`: Subjects and topics, Exams (name, topics, question count default 20, marks per question default 1, negative mark default 0.25, time default 36 seconds per question, so 12 minutes for 20), Students (approve, disable, reset password, invite limits). Seed four subjects (Bangla, English, Mathematics, General Knowledge) and one exam per subject with the defaults. Leave topics blank, I will add them.
10. Fonts with `next/font`: Outfit, Doto, Noto Sans Bengali, with the stack from CLAUDE.md. Add a small test page that shows the same sentence in English and in Bangla (including conjunct letters) and a Math line with a fraction and a square root using the display-only `MathText` copied from the MSc repo, so I can check rendering by eye.
11. Style with the PLAN.md section 10 tokens. Match `docs/design/govt-ui-mockup.html` (home, admin) and the MSc login screen, reusing the MSc `globals.css`. Install `lucide-react` and use ChevronLeft and ChevronRight for any previous and next buttons.
12. Add a daily cron route (protected by CRON_SECRET) that runs one small query to keep Supabase awake.
13. Write RLS tests with two student accounts and one admin.

When done, save a checklist as `docs/PHASE1_CHECKLIST.md`, stop, and give it to me (sign up with a code, shows pending, admin bell shows the signup, approve, sign in, invite someone, RLS check, Bangla test page).
