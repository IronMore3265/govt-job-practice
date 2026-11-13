-- Tests for the daily streak. Needs at least one subject with approved questions, so run it on the live content.
-- Run in the Supabase SQL editor after the migrations. Everything runs in one transaction and rolls back.
-- Success: the last statement returns "ALL STREAK TESTS PASSED".

begin;

-- One finished set in the subject at the given moment. Blank means no question was answered. A set counts when at least half of it was answered.
create function pg_temp.practise(p_user uuid, p_subject uuid, p_at timestamptz, p_blank boolean default false, p_retry_of uuid default null) returns uuid
language plpgsql
as $$
declare
  ex uuid;
  q uuid;
  sid uuid;
begin
  select e.id, qq.id into ex, q
  from public.exam e
  join public.exam_topic et on et.exam_id = e.id
  join public.question qq on qq.topic_id = et.topic_id and qq.status = 'approved'
  where e.subject_id = p_subject
  limit 1;
  insert into public.session_run (user_id, exam_id, retry_of, started_at, finished_at, score, max_score)
  values (p_user, ex, p_retry_of, p_at - interval '5 minutes', p_at, 1, 1) returning id into sid;
  insert into public.attempt (session_run_id, question_id, user_id, position, answered_at)
  values (sid, q, p_user, 0, case when p_blank then null else p_at end);
  return sid;
end;
$$;

-- A whole day: one set in every subject, leaving out p_skip.
create function pg_temp.full_day(p_user uuid, p_at timestamptz, p_skip uuid default null) returns void
language plpgsql
as $$
declare
  s uuid;
begin
  for s in select * from private.streak_subjects() loop
    if s is distinct from p_skip then
      perform pg_temp.practise(p_user, s, p_at);
    end if;
  end loop;
end;
$$;

do $$
declare
  s1 uuid := '00000000-0000-0000-0000-0000000000e1';
  s2 uuid := '00000000-0000-0000-0000-0000000000e2';
  s3 uuid := '00000000-0000-0000-0000-0000000000e3';
  s4 uuid := '00000000-0000-0000-0000-0000000000e4';
  s5 uuid := '00000000-0000-0000-0000-0000000000e5';
  s6 uuid := '00000000-0000-0000-0000-0000000000e6';
  pend uuid := '00000000-0000-0000-0000-0000000000e7';
  adm uuid := '00000000-0000-0000-0000-0000000000e8';
  real_exam uuid;
  real_topic uuid;
  sid uuid;
  st jsonb;
  noon timestamptz := ((now() at time zone 'Asia/Dhaka')::date + time '12:00') at time zone 'Asia/Dhaka';
  midnight timestamptz := ((now() at time zone 'Asia/Dhaka')::date + time '00:00') at time zone 'Asia/Dhaka';
  first_subject uuid;
  need integer;
  prev uuid;
  r jsonb;
  n integer;
  denied boolean;
begin
  select count(*) into need from private.streak_subjects();
  assert need > 0, 'this test needs subjects with approved questions';
  select * into first_subject from private.streak_subjects() limit 1;

  insert into auth.users (id, email) values (s1, 'e1@test.local'), (s2, 'e2@test.local'), (s3, 'e3@test.local'), (s4, 'e4@test.local'), (s5, 'e5@test.local'), (s6, 'e6@test.local'), (pend, 'e7@test.local'), (adm, 'e8@test.local');
  insert into public.profile (id, name, email, role, status) values
    (s1, 'Streak One', 'e1@test.local', 'student', 'active'),
    (s2, 'Streak Two', 'e2@test.local', 'student', 'active'),
    (s3, 'Streak Three', 'e3@test.local', 'student', 'active'),
    (s4, 'Streak Four', 'e4@test.local', 'student', 'active'),
    (s5, 'Streak Five', 'e5@test.local', 'student', 'active'),
    (s6, 'Streak Six', 'e6@test.local', 'student', 'active'),
    (pend, 'Streak Pending', 'e7@test.local', 'student', 'pending'),
    (adm, 'Streak Admin', 'e8@test.local', 'admin', 'active');

  -- no sets at all
  assert private.streak_count(s1) = 0, 'nothing done is a streak of 0';

  -- three days in a row ending today
  perform pg_temp.full_day(s1, noon - interval '2 days');
  perform pg_temp.full_day(s1, noon - interval '1 day');
  perform pg_temp.full_day(s1, noon);
  assert private.streak_count(s1) = 3, 'three days in a row count 3';

  -- today still open keeps yesterday's streak
  perform pg_temp.full_day(s2, noon - interval '2 days');
  perform pg_temp.full_day(s2, noon - interval '1 day');
  assert private.streak_count(s2) = 2, 'an unfinished today keeps the streak alive';

  -- a missed day resets
  perform pg_temp.full_day(s3, noon - interval '5 days');
  perform pg_temp.full_day(s3, noon - interval '4 days');
  perform pg_temp.full_day(s3, noon - interval '2 days');
  assert private.streak_count(s3) = 0, 'two days without a full day is a reset';
  perform pg_temp.full_day(s3, noon);
  assert private.streak_count(s3) = 1, 'a gap splits the streak, only the latest run counts';

  -- one subject short is not a full day, and a retry or a blank submit does not fill the gap
  perform pg_temp.full_day(s4, noon, first_subject);
  if need > 1 then
    assert private.streak_count(s4) = 0, 'a day with a subject missing does not count';
  end if;
  perform pg_temp.practise(s4, first_subject, noon, true);
  assert private.streak_count(s4) = 0 or need = 1, 'a blank submit does not count';
  prev := pg_temp.practise(s6, first_subject, noon - interval '3 days');
  perform pg_temp.practise(s4, first_subject, noon, false, prev);
  assert private.streak_count(s4) = 0 or need = 1, 'a retry does not count';
  perform pg_temp.practise(s4, first_subject, noon);
  assert private.streak_count(s4) = 1, 'a real set completes the day';

  -- the day turns at midnight in Bangladesh, which is 18:00 UTC
  perform pg_temp.full_day(s5, midnight - interval '1 minute', first_subject);
  perform pg_temp.practise(s5, first_subject, midnight + interval '1 minute');
  if need > 1 then
    assert private.streak_count(s5) = 0, 'sets either side of Bangladesh midnight are two different days';
  end if;

  -- my_streak as student one, friends off
  update public.app_setting set streaks_public = false where id = 1;
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := public.my_streak();
  assert (r ->> 'days')::int = 3 and (r ->> 'today_done')::boolean, 'my_streak returns the caller''s streak';
  assert jsonb_array_length(r -> 'subjects') = need, 'my_streak lists every required subject';
  assert (select bool_and((x ->> 'done')::boolean) from jsonb_array_elements(r -> 'subjects') x), 'every subject is done today';
  assert not (r ->> 'shared')::boolean and jsonb_array_length(r -> 'friends') = 0, 'friends stay hidden while the switch is off';
  assert r::text not like '%Streak Two%', 'no other name leaves the database while off';

  -- a student cannot flip the switch or call the private functions
  update public.app_setting set streaks_public = true where id = 1;
  get diagnostics n = row_count;
  assert n = 0, 'a student must not change streaks_public';
  denied := false; begin perform private.streak_count(s2); exception when insufficient_privilege then denied := true; end;
  assert denied, 'a student cannot call the private streak functions';
  reset role;

  -- friends on
  update public.app_setting set streaks_public = true where id = 1;
  set local role authenticated;
  r := public.my_streak();
  assert (r ->> 'shared')::boolean, 'shared is on';
  assert exists (select 1 from jsonb_array_elements(r -> 'friends') x where x ->> 'name' = 'Streak Two' and (x ->> 'days')::int = 2 and not (x ->> 'today_done')::boolean), 'friends carry name and days';
  assert not exists (select 1 from jsonb_array_elements(r -> 'friends') x where x ->> 'name' in ('Streak One', 'Streak Pending')), 'friends leave out the caller and pending students';
  assert not exists (select 1 from jsonb_array_elements(r -> 'friends') x where x ? 'email' or x ? 'id'), 'friends carry nothing but name and days';
  reset role;

  -- pending and anon are refused
  perform set_config('request.jwt.claims', json_build_object('sub', pend, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.my_streak(); exception when insufficient_privilege then denied := true; end;
  assert denied, 'a pending student is refused';
  reset role;
  set local role anon;
  denied := false; begin perform public.my_streak(); exception when insufficient_privilege then denied := true; end;
  assert denied, 'anon is refused';
  denied := false; begin perform 1 from public.app_setting; exception when insufficient_privilege then denied := true; end;
  assert denied, 'anon cannot read the switches';
  reset role;

  -- the admin can flip both switches
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.app_setting set streaks_public = false, leaderboard_on = false, updated_at = now() where id = 1;
  get diagnostics n = row_count;
  assert n = 1, 'the admin changes the switches';
  reset role;

  -- the real exam path: start, begin, answer, finish. A blank finish changes nothing.
  select e.id, et.topic_id into real_exam, real_topic
  from public.exam e
  join public.exam_topic et on et.exam_id = e.id
  join public.question qq on qq.topic_id = et.topic_id and qq.status = 'approved'
  where e.subject_id = first_subject and e.all_topics
  limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  sid := public.start_session(real_exam, null, array[real_topic], null, 1);
  perform public.begin_session(sid);
  perform public.finish_session(sid, false);
  r := public.my_streak();
  assert not (select (x ->> 'done')::boolean from jsonb_array_elements(r -> 'subjects') x where (x ->> 'id')::uuid = first_subject), 'a blank finish through the exam functions does not count';
  sid := public.start_session(real_exam, null, array[real_topic], null, 1);
  perform public.begin_session(sid);
  st := public.session_state(sid);
  perform public.save_answer(sid, (st -> 'questions' -> 0 ->> 'question_id')::uuid, (st -> 'questions' -> 0 -> 'options' -> 0 ->> 'id')::uuid, false, 5);
  perform public.finish_session(sid, false);
  r := public.my_streak();
  assert (select (x ->> 'done')::boolean from jsonb_array_elements(r -> 'subjects') x where (x ->> 'id')::uuid = first_subject), 'a finished set with an answer ticks the subject';
  assert (r ->> 'days')::int = 2, 'one subject alone does not add a day';
  reset role;
end;
$$;

select 'ALL STREAK TESTS PASSED' as result;

rollback;
