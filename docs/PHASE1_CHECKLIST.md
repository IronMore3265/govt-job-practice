# Phase 1 checklist

Things for Nabil to do and verify by hand. Do Part A first, because nothing signs in until the database exists.

## Part A: one-time setup

1. **Apply the migrations.** In the Supabase dashboard for "Govt Jobs Website", open SQL Editor and run these files from `supabase/migrations/`, one at a time, in this order:
   1. `20261104120000_core_schema.sql`
   2. `20261104120100_rls_and_invites.sql`
   3. `20261104120200_admin_notifications.sql`
   4. `20261104120300_storage_buckets.sql`
   5. `20261104120400_seed_subjects_and_exams.sql`
2. **Turn public sign-up off.** Authentication > Sign In / Providers > switch off "Allow new users to sign up". The invite route still works, because it creates users with the service role.
3. **Fill in `app/.env.local`** from `app/.env.example`: the project URL, anon key, service role key, a long random `CRON_SECRET`, and your `ADMIN_EMAIL`.
4. **Start the app.** In `app/`, run `npm install`, then `npm run dev`, and open http://localhost:3000.

## Part B: RLS check

- [ ] Paste `supabase/tests/rls.sql` into the SQL Editor and run it. The result must be `ALL RLS TESTS PASSED`.
- [ ] Do the same with `supabase/tests/integrity.sql`. The result must be `ALL INTEGRITY TESTS PASSED`.
- [ ] Table Editor: every table shows RLS enabled, and no test rows are left behind (both files roll back).
- [ ] Storage: buckets `notes` and `figures` exist and are marked private.

If a test stops with an error, send me the message. It names the check that failed.

## Part C: accounts

- [ ] **First admin.** Open `/signup`, use your `ADMIN_EMAIL`, and leave the invite code empty (this works only while no admin exists). Sign in. You land on Home with the bell and an Admin pill.
- [ ] **Seeds.** Home shows Bangla, English, Mathematics and General Knowledge, each with one Model Test: 0 topics, 20 questions, 12 min, -0.25.
- [ ] **Sign up with a code.** On Home, press New code, then Copy link. Open the link in a private window and create a test account. A wrong or blank code must be refused.
- [ ] **Shows pending.** Sign in as the new account. You see the "Almost there" waiting screen, and opening `/` or `/admin` does not get past it.
- [ ] **Admin bell shows the signup.** Back as admin, reload. The bell has an orange count, and the panel shows "New signup" with the name and "invited by". The Students tab shows a pending count.
- [ ] **Bell link.** Click the notification. It opens the Students tab at Pending approval and the count drops.
- [ ] **Approve.** Press Approve. The person moves to the list below and the pending count goes.
- [ ] **Sign in.** In the private window, sign in again. Home opens as a student, with no bell and no Admin pill, and `/admin` sends you back to Home.
- [ ] **Invite someone.** As the student, create codes until you have 3 unused. New code then turns off. Each code shows an expiry 7 days out. A used code cannot be used again.
- [ ] **Invited by.** In the Students tab, the new account shows who invited it.
- [ ] **Limits and access.** Change a student's invite limit and check that it takes effect. Set a new password and sign in with it. Disable the account and check that it lands on the waiting screen, then Enable it again.

## Part D: admin portal

- [ ] **Topics.** Add a topic to a subject, rename it, and delete it. Add and delete a test subject.
- [ ] **Exams.** Open a seeded exam, tick topics, save, and see them on Home. Change seconds each or questions, and check the timer line updates (36 s x 20 = 12 min). Add a mixed exam and see the Mixed pill on Home.
- [ ] **Reported question bell.** There is no Report button until Phase 5, so test this by hand then. The trigger itself is covered by `rls.sql`.

## Part E: fonts and look

- [ ] Open `/font-test` on laptop and phone. It opens without signing in.
- [ ] English is in Outfit. The Bangla sentence is in Noto Sans Bengali.
- [ ] Every conjunct letter joins into one shape, with no dotted circles or loose hasanta signs.
- [ ] Mixed English and Bangla sit well in one line.
- [ ] The fraction and square root draw as real math, in the English line and the Bangla line.
- [ ] Login, Home and Admin look like `docs/design/govt-ui-mockup.html` and the MSc login.

## Part F: Vercel

- [ ] Create the Vercel project from the GitHub repo with **Root Directory `app`**.
- [ ] Add the five environment variables. Keep `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` out of anything public.
- [ ] After deploying, Settings > Cron Jobs shows `/api/cron/keepalive` daily. Run it once from there and check that it succeeds.
- [ ] Opening `/api/cron/keepalive` in a browser without the secret returns 401.
- [ ] Repeat a sign-in on the live site, on your phone.

## Choices to review

- **Data model.** `exam_topic` is a join table instead of `exam.topic_ids`, and `exam.subject_id` was added so seeded exams with no topics still sit under a subject on Home (empty means Mixed). `profile.id` is the auth user id, so there is no separate `user_id`.
- **Math.** `MathText` uses KaTeX rather than MathLive, as PLAN.md section 14 allows. It is lighter and renders on the server. The stored format is the same.
- **Approval rule.** An approved question must have four options, one correct, and an explanation on the correct option. The import in Phase 2 has to save drafts first, then approve.
- **Bucket size limits.** `notes` allows 15 MB per file (the target stays under 10 MB) and `figures` 5 MB.
- **Questions tab.** It only lists open reports for now, so the bell has somewhere to go. The bank arrives in Phase 3.
- **Vercel region.** `bom1` (Mumbai), next to the database in ap-south-1. The MSc site used `dub1`.
