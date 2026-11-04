-- RLS tests: two students (A and B), one admin, one pending user, plus anon. Covers every table and both buckets.
-- Run in the Supabase SQL editor (or psql) after the migrations. Everything runs in one transaction and rolls back.
-- Success: the last statement returns "ALL RLS TESTS PASSED". A failure raises an exception that names the check.

begin;

do $$
declare
  admin_id   uuid := '00000000-0000-0000-0000-0000000000a1';
  stud_a     uuid := '00000000-0000-0000-0000-0000000000b1';
  stud_b     uuid := '00000000-0000-0000-0000-0000000000b2';
  pending_id uuid := '00000000-0000-0000-0000-0000000000c1';
  new_id     uuid := '00000000-0000-0000-0000-0000000000d1';
  subj uuid;
  t1 uuid;
  t2 uuid;
  ex uuid;
  q1 uuid;
  q2 uuid;
  q3 uuid;
  live_set uuid;
  draft_set uuid;
  run_a uuid;
  run_b uuid;
  rep_a uuid;
  inv public.invite;
  n integer;
  denied boolean;
begin
  -- ---------------------------------------------------------------- fixtures (table owner, bypasses RLS)
  insert into auth.users (id, email) values
    (admin_id, 'admin@test.local'), (stud_a, 'a@test.local'), (stud_b, 'b@test.local'),
    (pending_id, 'pending@test.local'), (new_id, 'new@test.local');
  insert into public.profile (id, name, email, role, status) values
    (admin_id, 'Admin', 'admin@test.local', 'admin', 'active');
  insert into public.profile (id, name, email, role, status, invited_by) values
    (stud_a, 'Student A', 'a@test.local', 'student', 'active', admin_id),
    (stud_b, 'Student B', 'b@test.local', 'student', 'active', admin_id),
    (pending_id, 'Pending', 'pending@test.local', 'student', 'pending', stud_a);

  select id into subj from public.subject where name = 'General Knowledge';
  assert subj is not null, 'seeded subject General Knowledge exists';
  insert into public.topic (subject_id, number, title) values (subj, 901, 'RLS topic one') returning id into t1;
  insert into public.topic (subject_id, number, title) values (subj, 902, 'RLS topic two') returning id into t2;
  insert into public.exam (subject_id, name, question_count, time_seconds) values (subj, 'RLS Test Exam', 2, 72) returning id into ex;
  insert into public.exam_topic (exam_id, topic_id) values (ex, t1);

  insert into public.question (subject_id, topic_id, text, source_page) values (subj, t1, 'Q1 text', 3) returning id into q1;
  insert into public.question (subject_id, topic_id, text, source_page) values (subj, t1, 'Q2 text', 4) returning id into q2;
  insert into public.question (subject_id, topic_id, text, source_page) values (subj, t1, 'Q3 draft text', 5) returning id into q3;
  insert into public.mcq_option (question_id, label, text, is_correct, explanation)
  select q.id, l.label, 'Option ' || l.label, l.label = 'B', case when l.label = 'B' then 'Because B.' end
  from (values (q1), (q2), (q3)) as q (id), (values ('A'), ('B'), ('C'), ('D')) as l (label);
  update public.question set status = 'approved' where id in (q1, q2);

  insert into public.question_set (exam_id, name, status, question_ids) values (ex, 'Set 1', 'live', array[q1, q2]) returning id into live_set;
  insert into public.question_set (exam_id, name, status, question_ids) values (ex, 'Set 2', 'draft', array[q1]) returning id into draft_set;

  insert into public.session_run (user_id, exam_id, set_id, started_at) values (stud_a, ex, live_set, now()) returning id into run_a;
  insert into public.session_run (user_id, exam_id, set_id, started_at) values (stud_b, ex, live_set, now()) returning id into run_b;
  insert into public.attempt (session_run_id, user_id, question_id, position) values
    (run_a, stud_a, q1, 0), (run_a, stud_a, q2, 1), (run_b, stud_b, q1, 0);
  insert into public.note_progress (user_id, topic_id, last_page) values (stud_a, t1, 4), (stud_b, t1, 2);
  insert into public.question_report (question_id, user_id, note) values (q1, stud_a, 'Answer key looks wrong') returning id into rep_a;

  insert into storage.objects (bucket_id, name) values ('notes', 'gk/901.pdf'), ('figures', 'gk/901/fig1.png');

  -- ---------------------------------------------------------------- anon: nothing at all
  set local role anon;
  denied := false;
  begin perform 1 from public.profile limit 1; exception when insufficient_privilege then denied := true; end;
  assert denied, 'anon must not read profile';
  denied := false;
  begin perform 1 from public.subject limit 1; exception when insufficient_privilege then denied := true; end;
  assert denied, 'anon must not read subject';
  denied := false;
  begin perform 1 from public.question limit 1; exception when insufficient_privilege then denied := true; end;
  assert denied, 'anon must not read question';
  denied := false;
  begin perform 1 from public.mcq_option limit 1; exception when insufficient_privilege then denied := true; end;
  assert denied, 'anon must not read mcq_option';
  denied := false;
  begin perform 1 from public.notification limit 1; exception when insufficient_privilege then denied := true; end;
  assert denied, 'anon must not read notification';
  denied := false;
  begin perform 1 from public.app_setting limit 1; exception when insufficient_privilege then denied := true; end;
  assert denied, 'anon must not read app_setting';
  denied := false;
  begin perform public.create_invite(); exception when insufficient_privilege then denied := true; end;
  assert denied, 'anon must not call create_invite';
  begin
    select count(*) into n from storage.objects where bucket_id in ('notes', 'figures');
  exception when insufficient_privilege then
    n := 0;
  end;
  assert n = 0, 'anon must not list notes or figures';
  reset role;

  -- ---------------------------------------------------------------- student A
  perform set_config('request.jwt.claims', json_build_object('sub', stud_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.profile;
  assert n = 1, format('student A should see 1 profile, saw %s', n);
  select count(*) into n from public.subject;
  assert n >= 4, 'active student reads subjects';
  select count(*) into n from public.topic where id in (t1, t2);
  assert n = 2, 'active student reads topics';
  select count(*) into n from public.exam;
  assert n >= 5, 'active student reads exams';
  select count(*) into n from public.exam_topic where exam_id = ex;
  assert n = 1, 'active student reads exam topics';

  -- Approved questions only, and never the answer key.
  select count(*) into n from public.question where id in (q1, q2, q3);
  assert n = 2, format('student A should see 2 approved questions, saw %s', n);
  select count(*) into n from public.mcq_option;
  assert n = 0, 'student must not read mcq_option (answer key)';
  select count(*) into n from public.question_set where exam_id = ex;
  assert n = 1, 'student sees live sets only';

  -- Own sessions, attempts and note progress only.
  select count(*) into n from public.session_run;
  assert n = 1, format('student A should see 1 session run, saw %s', n);
  select count(*) into n from public.attempt;
  assert n = 2, format('student A should see 2 attempts, saw %s', n);
  select count(*) into n from public.attempt where is_correct is not null;
  assert n = 0, 'attempt.is_correct stays null before finish';
  select count(*) into n from public.note_progress;
  assert n = 1, 'student A sees only own note progress';
  update public.note_progress set last_page = 7 where topic_id = t1;
  get diagnostics n = row_count;
  assert n = 1, 'student A updates own note progress';
  insert into public.note_progress (user_id, topic_id, last_page) values (stud_a, t2, 1);
  denied := false;
  begin insert into public.note_progress (user_id, topic_id, last_page) values (stud_b, t2, 9); exception when insufficient_privilege then denied := true; end;
  assert denied, 'student A must not write note progress for B';

  -- No writes to sessions, attempts, content, profiles or notifications.
  denied := false;
  begin insert into public.session_run (user_id, exam_id) values (stud_a, ex); exception when insufficient_privilege then denied := true; end;
  assert denied, 'student must not insert session_run directly';
  denied := false;
  begin update public.attempt set is_correct = true; exception when insufficient_privilege then denied := true; end;
  assert denied, 'student must not update attempts directly';
  denied := false;
  begin update public.session_run set score = 20; exception when insufficient_privilege then denied := true; end;
  assert denied, 'student must not update session_run directly';
  denied := false;
  begin insert into public.subject (name) values ('Hacked'); exception when insufficient_privilege then denied := true; end;
  assert denied, 'student must not insert subject';
  update public.exam set negative_mark = 0 where id = ex;
  get diagnostics n = row_count;
  assert n = 0, 'student must not update exam';
  delete from public.topic where id = t1;
  get diagnostics n = row_count;
  assert n = 0, 'student must not delete topic';
  denied := false;
  begin insert into public.mcq_option (question_id, label, text) values (q3, 'A', 'x'); exception when insufficient_privilege or unique_violation then denied := true; end;
  assert denied, 'student must not insert mcq_option';
  update public.question set text = 'Hacked' where id = q1;
  get diagnostics n = row_count;
  assert n = 0, 'student must not update question';
  denied := false;
  begin update public.profile set role = 'admin' where id = stud_a; exception when insufficient_privilege then denied := true; end;
  assert denied, 'student must not edit own profile (no self promotion)';
  denied := false;
  begin update public.profile set status = 'active' where id = pending_id; exception when insufficient_privilege then denied := true; end;
  assert denied, 'student must not approve anyone';
  select count(*) into n from public.notification;
  assert n = 0, 'student A has no notifications';
  denied := false;
  begin insert into public.notification (user_id, kind, ref_profile_id) values (stud_a, 'new_signup', stud_a); exception when insufficient_privilege then denied := true; end;
  assert denied, 'student must not insert notifications';

  -- Reports: own only, approved questions only, as yourself only. Cannot resolve.
  select count(*) into n from public.question_report;
  assert n = 1, 'student A sees own report';
  insert into public.question_report (question_id, user_id, note) values (q2, stud_a, 'Typo in option C');
  denied := false;
  begin insert into public.question_report (question_id, user_id, note) values (q3, stud_a, 'Draft'); exception when insufficient_privilege then denied := true; end;
  assert denied, 'student must not report a draft question';
  denied := false;
  begin insert into public.question_report (question_id, user_id, note) values (q2, stud_b, 'As B'); exception when insufficient_privilege then denied := true; end;
  assert denied, 'student must not report as someone else';
  update public.question_report set status = 'resolved' where id = rep_a;
  get diagnostics n = row_count;
  assert n = 0, 'student must not resolve reports';

  -- Site switches: read, not change.
  select count(*) into n from public.app_setting;
  assert n = 1, 'active student reads app_setting';
  update public.app_setting set leaderboard_on = true;
  get diagnostics n = row_count;
  assert n = 0, 'student must not change app_setting';

  -- Invites: 3 unused at most, the 4th is refused, direct insert is blocked.
  perform public.create_invite();
  perform public.create_invite();
  inv := public.create_invite();
  assert inv.code ~ '^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$', 'invite code format';
  assert inv.expires_at > now() + interval '6 days 23 hours', 'invite expires in 7 days';
  denied := false;
  begin perform public.create_invite(); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, '4th unused invite must be refused';
  select count(*) into n from public.invite;
  assert n = 3, 'student A sees own 3 invites';
  denied := false;
  begin insert into public.invite (code, created_by) values ('FORGED', stud_a); exception when insufficient_privilege then denied := true; end;
  assert denied, 'student must not insert invites directly';
  denied := false;
  begin perform public.redeem_invite('X', new_id, 'X', 'x@test.local'); exception when insufficient_privilege then denied := true; end;
  assert denied, 'student must not call redeem_invite';

  -- Storage: no direct reads or writes in the private buckets.
  select count(*) into n from storage.objects where bucket_id in ('notes', 'figures');
  assert n = 0, 'student must not list notes or figures';
  denied := false;
  begin insert into storage.objects (bucket_id, name, owner) values ('notes', 'gk/evil.pdf', stud_a); exception when insufficient_privilege then denied := true; end;
  assert denied, 'student must not upload notes';
  denied := false;
  begin insert into storage.objects (bucket_id, name, owner) values ('figures', 'gk/evil.png', stud_a); exception when insufficient_privilege then denied := true; end;
  assert denied, 'student must not upload figures';
  reset role;

  -- ---------------------------------------------------------------- student B: none of A's private rows
  perform set_config('request.jwt.claims', json_build_object('sub', stud_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.profile where id = stud_a;
  assert n = 0, 'student B must not see A profile';
  select count(*) into n from public.invite;
  assert n = 0, 'student B must not see A invites';
  select count(*) into n from public.session_run where user_id = stud_a;
  assert n = 0, 'student B must not see A session runs';
  select count(*) into n from public.session_run;
  assert n = 1, 'student B sees own session run';
  select count(*) into n from public.attempt where user_id = stud_a;
  assert n = 0, 'student B must not see A attempts';
  select count(*) into n from public.note_progress where user_id = stud_a;
  assert n = 0, 'student B must not see A note progress';
  update public.note_progress set last_page = 99 where user_id = stud_a;
  get diagnostics n = row_count;
  assert n = 0, 'student B must not change A note progress';
  select count(*) into n from public.question_report;
  assert n = 0, 'student B must not see A reports';
  delete from public.invite;
  get diagnostics n = row_count;
  assert n = 0, 'student B must not delete invites';
  reset role;

  -- ---------------------------------------------------------------- pending user: own profile only
  perform set_config('request.jwt.claims', json_build_object('sub', pending_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.profile;
  assert n = 1, 'pending user sees only own profile';
  select count(*) into n from public.subject;
  assert n = 0, 'pending user must not read subjects';
  select count(*) into n from public.exam;
  assert n = 0, 'pending user must not read exams';
  select count(*) into n from public.question;
  assert n = 0, 'pending user must not read questions';
  select count(*) into n from public.question_set;
  assert n = 0, 'pending user must not read sets';
  select count(*) into n from public.app_setting;
  assert n = 0, 'pending user must not read app_setting';
  denied := false;
  begin perform public.create_invite(); exception when insufficient_privilege then denied := true; end;
  assert denied, 'pending user must not create invites';
  denied := false;
  begin insert into public.note_progress (user_id, topic_id, last_page) values (pending_id, t1, 1); exception when insufficient_privilege then denied := true; end;
  assert denied, 'pending user must not write note progress';
  reset role;

  -- ---------------------------------------------------------------- admin
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.profile where email like '%@test.local';
  assert n = 4, format('admin sees all test profiles, saw %s', n);
  select count(*) into n from public.invite where created_by = stud_a;
  assert n = 3, 'admin sees invites made by others';
  select count(*) into n from public.mcq_option where question_id in (q1, q2, q3);
  assert n = 12, 'admin reads the answer key';
  select count(*) into n from public.question where id = q3;
  assert n = 1, 'admin sees draft questions';
  select count(*) into n from public.question_set where exam_id = ex;
  assert n = 2, 'admin sees draft and live sets';
  select count(*) into n from public.session_run where user_id <> admin_id;
  assert n = 0, 'admin does not read other people''s session runs';
  select count(*) into n from public.attempt where user_id <> admin_id;
  assert n = 0, 'admin does not read other people''s attempts';
  select count(*) into n from public.note_progress where user_id <> admin_id;
  assert n = 0, 'admin does not read other people''s note progress';

  -- Content writes.
  insert into public.subject (name, sort_order) values ('RLS Subject', 99);
  update public.exam set negative_mark = 0.5 where id = ex;
  get diagnostics n = row_count;
  assert n = 1, 'admin updates exam';
  insert into public.topic (subject_id, number, title) values (subj, 903, 'Admin topic');
  update public.app_setting set leaderboard_on = true, updated_at = now() where id = 1;
  get diagnostics n = row_count;
  assert n = 1, 'admin changes app_setting';
  for i in 1..5 loop perform public.create_invite(); end loop;
  select count(*) into n from public.invite where created_by = admin_id;
  assert n = 5, 'admin has no invite limit';
  denied := false;
  begin update public.profile set status = 'active' where id = pending_id; exception when insufficient_privilege then denied := true; end;
  assert denied, 'even the admin edits profiles only through the service role';

  -- Notifications: the pending signup and A's two reports reached the admin's bell.
  select count(*) into n from public.notification where kind = 'new_signup' and ref_profile_id = pending_id and read_at is null;
  assert n = 1, 'a pending signup notifies the admin';
  select count(*) into n from public.notification where kind = 'question_report';
  assert n = 2, format('each report notifies the admin, saw %s', n);
  select count(*) into n from public.notification where kind = 'new_signup' and ref_profile_id in (stud_a, stud_b);
  assert n = 0, 'accounts created active do not notify';
  update public.question_report set status = 'resolved', resolved_at = now(), resolved_by = admin_id where id = rep_a;
  select count(*) into n from public.notification where ref_report_id = rep_a and read_at is not null;
  assert n = 1, 'resolving a report settles its notification';
  update public.notification set read_at = now() where read_at is null;
  get diagnostics n = row_count;
  assert n >= 1, 'admin marks own notifications read';
  denied := false;
  begin update public.notification set kind = 'new_signup'; exception when insufficient_privilege then denied := true; end;
  assert denied, 'only read_at may change on a notification';
  denied := false;
  begin insert into public.notification (user_id, kind, ref_profile_id) values (admin_id, 'new_signup', admin_id); exception when insufficient_privilege then denied := true; end;
  assert denied, 'even the admin cannot insert notifications';

  -- Storage stays closed to the admin's browser session too: only the service role touches these buckets.
  select count(*) into n from storage.objects where bucket_id in ('notes', 'figures');
  assert n = 0, 'admin browser session must not list notes or figures';
  reset role;

  -- Student A cannot read the admin's notifications.
  perform set_config('request.jwt.claims', json_build_object('sub', stud_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.notification;
  assert n = 0, 'student must not see admin notifications';
  update public.notification set read_at = null;
  get diagnostics n = row_count;
  assert n = 0, 'student must not change admin notifications';
  reset role;

  -- ---------------------------------------------------------------- sign-up path (service role)
  select * into inv from public.invite where created_by = stud_a and used_at is null limit 1;
  set local role service_role;
  perform public.redeem_invite(lower(inv.code), new_id, 'Newcomer', 'NEW@test.local');
  reset role;
  select count(*) into n from public.profile
  where id = new_id and status = 'pending' and invited_by = stud_a and role = 'student' and email = 'new@test.local';
  assert n = 1, 'redeemed account is pending and invited by A';
  select count(*) into n from public.invite where id = inv.id and used_at is not null and used_by = new_id;
  assert n = 1, 'invite marked used';
  select count(*) into n from public.notification where user_id = admin_id and kind = 'new_signup' and ref_profile_id = new_id and read_at is null;
  assert n = 1, 'the new signup reaches the admin bell';

  -- Approving the account settles its notification.
  update public.profile set status = 'active', approved_by = admin_id, approved_at = now() where id = new_id;
  select count(*) into n from public.notification where ref_profile_id = new_id and read_at is not null;
  assert n = 1, 'approving settles the signup notification';

  set local role service_role;
  denied := false;
  begin perform public.redeem_invite(inv.code, pending_id, 'Again', 'again@test.local'); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'a used code cannot be redeemed twice';
  denied := false;
  begin perform public.redeem_invite('NOPE-NOPE-NOPE', pending_id, 'X', 'x@test.local'); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'an unknown code is rejected';
  reset role;
  update public.invite set expires_at = now() - interval '1 minute' where created_by = stud_a and used_at is null;
  select * into inv from public.invite where created_by = stud_a and used_at is null limit 1;
  set local role service_role;
  denied := false;
  begin perform public.redeem_invite(inv.code, pending_id, 'X', 'x2@test.local'); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'an expired code is rejected';
  reset role;

  -- Expired codes stop counting toward A's limit.
  perform set_config('request.jwt.claims', json_build_object('sub', stud_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.create_invite();
  reset role;

  -- A disabled member loses content access at once.
  update public.profile set status = 'disabled' where id = stud_b;
  perform set_config('request.jwt.claims', json_build_object('sub', stud_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.subject;
  assert n = 0, 'a disabled member must not read subjects';
  denied := false;
  begin perform public.create_invite(); exception when insufficient_privilege then denied := true; end;
  assert denied, 'a disabled member must not create invites';
  reset role;

  -- Buckets exist and are private.
  select count(*) into n from storage.buckets where id in ('notes', 'figures') and public = false;
  assert n = 2, 'both buckets exist and are private';
end;
$$;

select 'ALL RLS TESTS PASSED' as result;

rollback;
