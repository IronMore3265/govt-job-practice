-- Tests for sequential topic sets, the topic practice trigger and the revision list.
-- Run in the Supabase SQL editor after the migrations. Everything runs in one transaction and rolls back.
-- Success: the last statement returns "ALL SEQUENTIAL TESTS PASSED".

begin;

do $$
declare
  s1 uuid := '00000000-0000-0000-0000-0000000000a1';
  s2 uuid := '00000000-0000-0000-0000-0000000000a2';
  subj uuid; t1 uuid; ex uuid; q uuid;
  qs uuid[] := '{}';
  got uuid[];
  sid uuid; sid2 uuid;
  n integer; denied boolean; rev jsonb; opt_a uuid; opt_b uuid;
begin
  insert into auth.users (id, email) values (s1, 'a1@test.local'), (s2, 'a2@test.local');
  insert into public.profile (id, name, email, role, status) values
    (s1, 'Seq One', 'a1@test.local', 'student', 'active'),
    (s2, 'Seq Two', 'a2@test.local', 'student', 'active');
  select id into subj from public.subject where name = 'English';
  -- A topic practice exam of 4 questions per set. A topic added afterwards is linked by the trigger.
  insert into public.exam (subject_id, name, question_count, time_seconds, all_topics) values (subj, 'S Practice', 4, 144, true) returning id into ex;
  insert into public.topic (subject_id, number, title) values (subj, 971, 'S1') returning id into t1;
  assert exists (select 1 from public.exam_topic where exam_id = ex and topic_id = t1), 'a new topic is linked to the topic practice exam';

  for i in 1..10 loop
    insert into public.question (subject_id, topic_id, text, created_at) values (subj, t1, 'SQ ' || i, now() + (i || ' seconds')::interval) returning id into q;
    insert into public.mcq_option (question_id, label, text, is_correct, explanation)
      select q, l, 'opt ' || l, l = 'B', case when l = 'B' then 'because' end from unnest(array['A','B','C','D']) l;
    update public.question set status = 'approved' where id = q;
    qs := qs || q;
  end loop;

  -- Students cannot read the options table, so pick the option ids before switching role.
  select id into opt_a from public.mcq_option where question_id = qs[1] and label = 'A';
  select id into opt_b from public.mcq_option where question_id = qs[2] and label = 'B';

  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- topic_sets: 10 questions in sets of 4 are sets of 4, 4 and 2.
  assert (select array_agg(size order by chunk) from public.topic_sets(ex) where topic_id = t1) = array[4, 4, 2], 'sets are 4, 4 and 2';

  -- Set 1 is the first four questions in written order, set 3 the last two.
  sid := public.start_session(ex, null, array[t1], null, 1);
  select array_agg(question_id order by position) into got from public.attempt where session_run_id = sid;
  assert got = qs[1:4], 'set 1 is questions 1 to 4 in order';
  sid2 := public.start_session(ex, null, array[t1], null, 3);
  select array_agg(question_id order by position) into got from public.attempt where session_run_id = sid2;
  assert got = qs[9:10], 'set 3 is the last two questions';
  denied := false; begin perform public.start_session(ex, null, array[t1], null, 4); exception when others then denied := true; end;
  assert denied, 'a set past the end does not exist';
  denied := false; begin perform public.start_session(ex, null, '{}', null, 1); exception when others then denied := true; end;
  assert denied, 'a set needs exactly one topic';

  -- Answer wrong on question 1, right on question 2, finish. The set shows its score and the wrong answer reaches the revision list.
  perform public.begin_session(sid);
  perform public.save_answer(sid, qs[1], opt_a, false, 3);
  perform public.save_answer(sid, qs[2], opt_b, false, 3);
  perform public.finish_session(sid, false);
  assert (select tries from public.topic_sets(ex) where topic_id = t1 and chunk = 1) = 1, 'set 1 has one finished try';
  assert (select tries from public.topic_sets(ex) where topic_id = t1 and chunk = 2) = 0, 'set 2 has none';

  rev := public.my_revision();
  assert jsonb_array_length(rev) = 1 and rev -> 0 ->> 'question_id' = qs[1]::text, 'only the wrong answer is on the list (right and skipped are not)';
  assert (rev -> 0 ->> 'selected_option')::uuid = opt_a, 'the list remembers what was picked';
  assert exists (select 1 from jsonb_array_elements(rev -> 0 -> 'options') o where (o ->> 'is_correct')::boolean), 'the right answer is shown on the list';

  -- Another student sees nothing and cannot mark someone else's question.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  assert jsonb_array_length(public.my_revision()) = 0, 'a second student has an empty list';
  assert public.mark_revised(array[qs[1]]) = 0, 'marking a question you did not get wrong does nothing';
  reset role;

  -- Mark done: it leaves the list. A later wrong answer brings it back.
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  assert public.mark_revised(array[qs[1], qs[2]]) = 1, 'only the wrong question is recorded';
  assert jsonb_array_length(public.my_revision()) = 0, 'a question marked done leaves the list';
  reset role;
  update public.revision_done set done_at = now() - interval '1 hour' where user_id = s1;
  set local role authenticated;
  assert jsonb_array_length(public.my_revision()) = 1, 'wrong again after being marked done: it returns';
  reset role;

  select count(*) into n from public.revision_done;
  assert n = 1, 'one revision row';
end;
$$;

select 'ALL SEQUENTIAL TESTS PASSED' as result;
