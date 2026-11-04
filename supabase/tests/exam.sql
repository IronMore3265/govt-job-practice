-- Tests for exam mode (Phase 5) and history, leaderboard and storage usage (Phase 6).
-- Run in the Supabase SQL editor after the migrations. Everything runs in one transaction and rolls back.
-- Success: the last statement returns "ALL EXAM TESTS PASSED".
-- Note: now() does not move inside one transaction, so expiry is tested by moving deadline_at into the past.

begin;

do $$
declare
  admin_id uuid := '00000000-0000-0000-0000-0000000000f0';
  s1 uuid := '00000000-0000-0000-0000-0000000000f1';
  s2 uuid := '00000000-0000-0000-0000-0000000000f2';
  pend uuid := '00000000-0000-0000-0000-0000000000f3';
  subj uuid; t1 uuid; t2 uuid; ex uuid; ex_big uuid; q uuid; set1 uuid;
  qs uuid[] := '{}';
  sid uuid; sid2 uuid; sid3 uuid; sid4 uuid;
  st jsonb; rv jsonb; res jsonb; lb jsonb;
  n integer; txt text; denied boolean;
  opt_b uuid; opt_a uuid; other_opt uuid;
  d1 timestamptz; d2 timestamptz;
begin
  insert into auth.users (id, email) values (admin_id, 'xadmin@test.local'), (s1, 'x1@test.local'), (s2, 'x2@test.local'), (pend, 'xp@test.local');
  insert into public.profile (id, name, email, role, status) values
    (admin_id, 'XAdmin', 'xadmin@test.local', 'admin', 'active'),
    (s1, 'Student One', 'x1@test.local', 'student', 'active'),
    (s2, 'Student Two', 'x2@test.local', 'student', 'active'),
    (pend, 'Pending', 'xp@test.local', 'student', 'pending');
  select id into subj from public.subject where name = 'English';
  insert into public.topic (subject_id, number, title, note_path) values (subj, 981, 'X1', 'english/981.pdf') returning id into t1;
  insert into public.topic (subject_id, number, title) values (subj, 982, 'X2') returning id into t2;
  insert into public.exam (subject_id, name, question_count, marks_per_question, negative_mark, time_seconds) values (subj, 'X Exam', 4, 1, 0.25, 144) returning id into ex;
  insert into public.exam (subject_id, name, question_count, time_seconds) values (subj, 'X Big Exam', 20, 720) returning id into ex_big;
  insert into public.exam_topic (exam_id, topic_id) values (ex, t1), (ex, t2), (ex_big, t1);
  for i in 1..10 loop
    insert into public.question (subject_id, topic_id, text, source_page) values (subj, case when i <= 5 then t1 else t2 end, 'XQ ' || i, i) returning id into q;
    insert into public.mcq_option (question_id, label, text, is_correct, explanation)
      select q, l, 'opt ' || l, l = 'B', case when l = 'B' then 'because secret explanation' end from unnest(array['A','B','C','D']) l;
    update public.question set status = 'approved' where id = q;
    qs := qs || q;
  end loop;
  insert into public.question_set (exam_id, name, status, question_ids) values (ex, 'Set 1', 'live', qs[1:4]) returning id into set1;

  -- ------------------------------------------------------------ student one takes the set
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  set local role authenticated;

  sid := public.start_session(ex, set1, null, null);
  st := public.session_state(sid);
  assert st ->> 'status' = 'ready' and (st ->> 'total')::int = 4 and (st ->> 'seconds')::int = 144, 'a new session is ready with the exam time';
  assert jsonb_array_length(st -> 'questions') = 0, 'no questions before Begin';

  select count(*) into n from public.mcq_option;
  assert n = 0, 'a student cannot read the answer key table';
  select count(*) into n from public.attempt where is_correct is not null;
  assert n = 0, 'attempts carry no verdict before finish';

  d1 := public.begin_session(sid);
  d2 := public.begin_session(sid);
  assert d1 = d2, 'pressing Begin twice keeps the first deadline';
  st := public.session_state(sid);
  assert st ->> 'status' = 'running' and jsonb_array_length(st -> 'questions') = 4, 'four questions are served once the exam runs';
  txt := st::text;
  assert txt not like '%is_correct%' and txt not like '%explanation%' and txt not like '%secret%', 'the exam payload carries no key and no explanation';

  denied := false; begin perform public.get_review(sid); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'the review is closed until submit';

  -- answers: Q1 right (B), Q2 wrong (A), Q3 skipped, Q4 right and marked
  select (o ->> 'id')::uuid into opt_b from jsonb_array_elements(st -> 'questions' -> 0 -> 'options') o where o ->> 'label' = 'B';
  assert public.save_answer(sid, (st -> 'questions' -> 0 ->> 'question_id')::uuid, opt_b, false, 20) = 'ok', 'answer saved';
  select (o ->> 'id')::uuid into opt_a from jsonb_array_elements(st -> 'questions' -> 1 -> 'options') o where o ->> 'label' = 'A';
  perform public.save_answer(sid, (st -> 'questions' -> 1 ->> 'question_id')::uuid, opt_a, false, 15);
  select (o ->> 'id')::uuid into opt_b from jsonb_array_elements(st -> 'questions' -> 3 -> 'options') o where o ->> 'label' = 'B';
  perform public.save_answer(sid, (st -> 'questions' -> 3 ->> 'question_id')::uuid, opt_b, true, 30);
  select (o ->> 'id')::uuid into other_opt from jsonb_array_elements(st -> 'questions' -> 0 -> 'options') o where o ->> 'label' = 'C';
  denied := false; begin perform public.save_answer(sid, (st -> 'questions' -> 1 ->> 'question_id')::uuid, other_opt, false, 1); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'an option from another question is refused';
  perform public.save_answer(sid, (st -> 'questions' -> 1 ->> 'question_id')::uuid, opt_a, false, 40);
  select seconds_spent into n from public.attempt where session_run_id = sid and position = 1;
  assert n = 40, 'seconds spent only grows';
  select count(*) into n from public.attempt where session_run_id = sid and marked_for_review;
  assert n = 1, 'the mark for review is saved';
  select count(*) into n from public.attempt where is_correct is not null;
  assert n = 0, 'still no verdict while the exam runs';

  res := public.finish_session(sid, false);
  assert (res ->> 'score')::numeric = 1.75 and (res ->> 'max_score')::numeric = 4 and (res ->> 'negative_applied')::numeric = 0.25, 'score is 2 right minus 0.25 for 1 wrong';
  assert public.save_answer(sid, (st -> 'questions' -> 2 ->> 'question_id')::uuid, null, false, 5) = 'finished', 'no answers after submit';
  st := public.session_state(sid);
  assert st ->> 'status' = 'finished' and jsonb_array_length(st -> 'questions') = 0, 'a finished session serves no questions';

  rv := public.get_review(sid);
  assert (rv -> 'session' ->> 'correct')::int = 2 and (rv -> 'session' ->> 'wrong')::int = 1 and (rv -> 'session' ->> 'skipped')::int = 1, 'review counts: 2 right, 1 wrong, 1 skipped';
  assert rv -> 'questions' -> 0 ->> 'explanation' = 'because secret explanation', 'the review includes the explanation';
  assert (rv -> 'questions' -> 0 ->> 'is_correct')::boolean and not (rv -> 'questions' -> 1 ->> 'is_correct')::boolean and not (rv -> 'questions' -> 2 ->> 'is_correct')::boolean, 'verdicts per question';
  assert (rv -> 'questions' -> 0 ->> 'has_note')::boolean and (rv -> 'questions' -> 0 ->> 'source_page')::int = 1, 'review carries the source page and note flag';
  assert (res ->> 'timed_out')::boolean = false, 'a normal submit is not a timeout';

  select count(*) into n from public.attempt where session_run_id = sid and is_correct is not null;
  assert n = 4, 'every attempt has a verdict after submit';

  -- retry the missed questions (the wrong one and the skipped one)
  sid2 := public.start_session(ex, null, null, sid);
  select count(*) into n from public.attempt where session_run_id = sid2;
  assert n = 2, 'a retry holds the two missed questions';
  d1 := public.begin_session(sid2);
  select extract(epoch from (deadline_at - started_at))::int into n from public.session_run where id = sid2;
  assert n = 72, 'a retry of 2 of 4 questions gets half the time';
  denied := false; begin perform public.start_session(ex, null, null, sid2); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'only a finished session can be retried';

  -- random sessions are spread across the topics, and can be narrowed
  sid3 := public.start_session(ex, null, null, null);
  select count(distinct q2.topic_id) into n from public.attempt a join public.question q2 on q2.id = a.question_id where a.session_run_id = sid3;
  assert n = 2, 'a random set spreads across both topics';
  sid4 := public.start_session(ex, null, array[t1], null);
  select count(distinct q2.topic_id) into n from public.attempt a join public.question q2 on q2.id = a.question_id where a.session_run_id = sid4;
  assert n = 1, 'a narrowed random set uses only the chosen topic';
  denied := false; begin perform public.start_session(ex_big, null, null, null); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'a random set needs enough approved questions';
  denied := false; begin perform public.start_session(ex, gen_random_uuid(), null, null); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'an unknown set is refused';

  -- history, stats, set scores, resume
  select count(*) into n from public.my_history();
  assert n = 1, 'history lists the one finished session';
  select count(*) into n from public.my_history() where score = 1.75 and correct = 2 and wrong = 1 and skipped = 1 and total = 4 and set_name = 'Set 1';
  assert n = 1, 'history row has the score and counts';
  select count(*) into n from public.my_topic_stats() where asked > 0;
  assert n >= 1, 'topic stats exist';
  select sum(asked) into n from public.my_topic_stats();
  assert n = 4, 'topic stats count every asked question';
  select count(*) into n from public.my_set_scores(ex) where set_id = set1 and best_score = 1.75 and tries = 1;
  assert n = 1, 'set scores show the earlier result';
  assert (public.my_open_session() ->> 'session_id')::uuid = sid2, 'the started retry shows up as the exam in progress';
  reset role;

  -- ------------------------------------------------------------ expiry (deadline moved into the past)
  update public.session_run set deadline_at = now() - interval '1 minute' where id = sid2;
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  assert public.save_answer(sid2, (select question_id from public.attempt where session_run_id = sid2 limit 1), null, false, 1) = 'expired', 'a late save finishes the exam';
  reset role;
  select count(*) into n from public.session_run where id = sid2 and finished_at is not null and timed_out and score = 0;
  assert n = 1, 'a timed out exam is submitted with unanswered questions counted as missed';

  -- ------------------------------------------------------------ other members
  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.session_state(sid); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'a member cannot open someone else''s session';
  denied := false; begin perform public.get_review(sid); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'a member cannot read someone else''s review';
  denied := false; begin perform public.save_answer(sid, qs[1], null, false, 1); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'a member cannot save into someone else''s session';
  select count(*) into n from public.my_history();
  assert n = 0, 'history is private';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', pend, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.start_session(ex, set1, null, null); exception when insufficient_privilege then denied := true; end;
  assert denied, 'a pending member cannot start an exam';
  reset role;

  set local role anon;
  denied := false; begin perform public.start_session(ex, set1, null, null); exception when insufficient_privilege then denied := true; end;
  assert denied, 'anon cannot start an exam';
  denied := false; begin perform public.get_review(sid); exception when insufficient_privilege then denied := true; end;
  assert denied, 'anon cannot read a review';
  reset role;

  -- ------------------------------------------------------------ leaderboard
  update public.app_setting set leaderboard_on = false where id = 1;
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  lb := public.leaderboard(ex);
  assert (lb ->> 'on')::boolean = false, 'the leaderboard is off until the admin switches it on';
  reset role;
  update public.app_setting set leaderboard_on = true where id = 1;
  update public.profile set leaderboard_since = '2000-01-01' where id = s1;
  update public.profile set leaderboard_since = now() + interval '1 day' where id = s2;
  -- a second finished full-set session for student one, and one for student two that started before joining
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  sid3 := public.start_session(ex, set1, null, null);
  perform public.begin_session(sid3);
  perform public.finish_session(sid3, false);
  lb := public.leaderboard(ex);
  assert (lb ->> 'on')::boolean and (lb ->> 'joined')::boolean, 'joined and on';
  assert jsonb_array_length(lb -> 'top') = 1 and (lb -> 'top' -> 0 ->> 'sessions')::int = 2, 'two full-set sessions count, the retry does not';
  assert (lb -> 'top' -> 0 ->> 'avg')::numeric = round((1.75 / 4 * 100 + 0) / 2, 1), 'average score percentage (1.75 of 4 and 0 of 4)';
  assert (lb -> 'me' ->> 'rank')::int = 1, 'my row is returned';
  assert lb::text not like '%x1@test.local%', 'only names are shared, never emails';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  sid4 := public.start_session(ex, set1, null, null);
  perform public.begin_session(sid4);
  perform public.finish_session(sid4, false);
  lb := public.leaderboard(ex);
  assert jsonb_array_length(lb -> 'top') = 1, 'a session that started before joining does not count';
  perform public.leave_leaderboard();
  perform public.join_leaderboard();
  select (leaderboard_since is not null) into denied from public.profile where id = s2;
  assert denied, 'joining sets the join time';
  reset role;

  -- ------------------------------------------------------------ admin storage usage
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.admin_storage_usage(); exception when insufficient_privilege then denied := true; end;
  assert denied, 'a student cannot see storage usage';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  res := public.admin_storage_usage();
  assert (res ->> 'db_bytes')::bigint > 0 and jsonb_array_length(res -> 'buckets') >= 2, 'the admin sees database size and the two buckets';
  reset role;
end;
$$;

select 'ALL EXAM TESTS PASSED' as result;

rollback;
