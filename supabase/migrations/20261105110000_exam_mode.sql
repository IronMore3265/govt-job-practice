-- Phase 5 and 6: exam mode, history, weak topics, leaderboard, admin storage usage.
--
-- The rule (PLAN.md section 2.1): until a session is finished the browser never receives which option is correct or any
-- explanation. Students cannot read mcq_option and cannot write session_run or attempt (Phase 1 grants). Everything goes
-- through the security definer functions below, which check that the session is the caller's own, withhold the key, and
-- only reveal it after submit. All of them use an empty search_path and qualified names, and none is callable by anon.

-- ---------------------------------------------------------------------------------------------
-- Helpers (private schema, not callable through the API)
-- ---------------------------------------------------------------------------------------------

-- Marks a session finished: judges every attempt, applies the marking rules of the exam, stores the score.
-- A skipped question is stored as is_correct = false, so "missed" is simply is_correct is not true.
create function private.finalize_session(p_session uuid, p_timed_out boolean) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.session_run;
  ex public.exam;
  c integer;
  w integer;
  total integer;
begin
  select * into s from public.session_run where id = p_session for update;
  if not found or s.finished_at is not null then
    return;
  end if;
  select * into ex from public.exam where id = s.exam_id;

  update public.attempt a
  set is_correct = case
    when a.selected_option is null then false
    else coalesce((select o.is_correct from public.mcq_option o where o.id = a.selected_option), false)
  end
  where a.session_run_id = s.id;

  select count(*) filter (where is_correct),
         count(*) filter (where selected_option is not null and not is_correct),
         count(*)
    into c, w, total
  from public.attempt where session_run_id = s.id;

  update public.session_run
  set finished_at = now(),
      timed_out = p_timed_out or (deadline_at is not null and now() > deadline_at),
      score = c * ex.marks_per_question - w * ex.negative_mark,
      negative_applied = w * ex.negative_mark,
      max_score = total * ex.marks_per_question
  where id = s.id;
end;
$$;

-- Finishes every started session of a member whose time has run out (abandoned tabs).
create function private.sweep_sessions(p_user uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select id from public.session_run
    where user_id = p_user and finished_at is null and deadline_at is not null and now() > deadline_at + interval '3 seconds'
  loop
    perform private.finalize_session(r.id, true);
  end loop;
end;
$$;

-- The caller's own session, locked for the rest of the transaction. Raises when it is not theirs.
create function private.own_session(p_session uuid) returns public.session_run
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.session_run;
begin
  if not (select private.is_active()) then
    raise exception 'Your account is not approved' using errcode = '42501';
  end if;
  select * into s from public.session_run where id = p_session and user_id = (select auth.uid()) for update;
  if not found then
    raise exception 'Exam session not found' using errcode = 'P0001';
  end if;
  return s;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Starting
-- ---------------------------------------------------------------------------------------------

-- Creates a session that is not running yet (the clock starts at begin_session). Three kinds:
--   * a live set of the exam (p_set_id),
--   * a new random set from the exam's topics, optionally narrowed to p_topic_ids, spread across the topics,
--   * a retry of the questions missed in one of the caller's finished sessions (p_retry_of).
create function public.start_session(p_exam_id uuid, p_set_id uuid, p_topic_ids uuid[], p_retry_of uuid) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  ex public.exam;
  prev public.session_run;
  qids uuid[];
  topics uuid[] := '{}';
  sid uuid;
  have integer;
begin
  if not (select private.is_active()) then
    raise exception 'Your account is not approved' using errcode = '42501';
  end if;
  select * into ex from public.exam where id = p_exam_id;
  if not found then
    raise exception 'Exam not found' using errcode = 'P0001';
  end if;

  if p_retry_of is not null then
    select * into prev from public.session_run where id = p_retry_of and user_id = me and finished_at is not null;
    if not found or prev.exam_id <> ex.id then
      raise exception 'You can only retry the missed questions of an exam you have finished' using errcode = 'P0001';
    end if;
    select array_agg(a.question_id order by a.position) into qids
    from public.attempt a join public.question q on q.id = a.question_id and q.status = 'approved'
    where a.session_run_id = prev.id and a.is_correct is not true;
    if qids is null then
      raise exception 'There are no missed questions to retry' using errcode = 'P0001';
    end if;
    topics := prev.topic_ids;
  elsif p_set_id is not null then
    select question_ids into qids from public.question_set where id = p_set_id and exam_id = ex.id and status = 'live';
    if qids is null then
      raise exception 'That set is not available' using errcode = 'P0001';
    end if;
  else
    topics := coalesce(p_topic_ids, '{}');
    select array_agg(id order by k, rnd) into qids
    from (
      select q.id,
             (row_number() over (partition by q.topic_id order by random()) - 0.5) / count(*) over (partition by q.topic_id) as k,
             random() as rnd
      from public.question q
      where q.status = 'approved'
        and q.topic_id in (
          select et.topic_id from public.exam_topic et
          where et.exam_id = ex.id and (cardinality(topics) = 0 or et.topic_id = any (topics))
        )
      order by k, rnd
      limit ex.question_count
    ) picked;
    have := coalesce(cardinality(qids), 0);
    if have < ex.question_count then
      raise exception 'This exam does not have enough approved questions yet (it needs %, there are %)', ex.question_count, have using errcode = 'P0001';
    end if;
  end if;

  insert into public.session_run (user_id, exam_id, set_id, retry_of, topic_ids)
  values (me, ex.id, case when p_retry_of is null then p_set_id end, p_retry_of, topics)
  returning id into sid;
  insert into public.attempt (session_run_id, user_id, question_id, position)
  select sid, me, t.q, t.ord - 1 from unnest(qids) with ordinality as t (q, ord);
  return sid;
end;
$$;

-- Starts the clock. The deadline is the exam's time, scaled down for a retry of fewer questions. Pressing Begin twice
-- (or reloading) keeps the first start.
create function public.begin_session(p_session_id uuid) returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.session_run;
  ex public.exam;
  n integer;
  secs integer;
begin
  s := private.own_session(p_session_id);
  if s.finished_at is not null then
    raise exception 'This exam is already finished' using errcode = 'P0001';
  end if;
  if s.started_at is null then
    select * into ex from public.exam where id = s.exam_id;
    select count(*) into n from public.attempt where session_run_id = s.id;
    secs := greatest(1, ceil(ex.time_seconds::numeric * n / ex.question_count)::integer);
    update public.session_run set started_at = now(), deadline_at = now() + make_interval(secs => secs) where id = s.id
    returning * into s;
  end if;
  return s.deadline_at;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Taking the exam: questions without the key
-- ---------------------------------------------------------------------------------------------

-- Everything the exam screen needs, and nothing that gives the answer away: no is_correct, no explanation.
-- Before Begin it returns only the briefing numbers. After the deadline it finishes the session first.
create function public.session_state(p_session_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.session_run;
  ex public.exam;
  n integer;
  status text;
  qs jsonb := '[]';
begin
  s := private.own_session(p_session_id);
  if s.finished_at is null and s.deadline_at is not null and now() > s.deadline_at + interval '3 seconds' then
    perform private.finalize_session(s.id, true);
    select * into s from public.session_run where id = s.id;
  end if;
  select * into ex from public.exam where id = s.exam_id;
  select count(*) into n from public.attempt where session_run_id = s.id;
  status := case when s.finished_at is not null then 'finished' when s.started_at is null then 'ready' else 'running' end;

  if status = 'running' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'position', a.position,
      'question_id', q.id,
      'text', q.text,
      'lang', q.lang,
      'figure_id', q.figure_id,
      'subject', sj.name,
      'topic', t.title,
      'selected_option', a.selected_option,
      'marked', a.marked_for_review,
      'seconds_spent', a.seconds_spent,
      'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'text', o.text) order by o.label)
                  from public.mcq_option o where o.question_id = q.id)
    ) order by a.position), '[]')
    into qs
    from public.attempt a
    join public.question q on q.id = a.question_id
    join public.topic t on t.id = q.topic_id
    join public.subject sj on sj.id = q.subject_id
    where a.session_run_id = s.id;
  end if;

  return jsonb_build_object(
    'status', status,
    'session_id', s.id,
    'exam', jsonb_build_object('id', ex.id, 'name', ex.name, 'marks_per_question', ex.marks_per_question, 'negative_mark', ex.negative_mark),
    'is_retry', s.retry_of is not null,
    'set_name', (select qs2.name from public.question_set qs2 where qs2.id = s.set_id),
    'total', n,
    'seconds', greatest(1, ceil(ex.time_seconds::numeric * n / ex.question_count)::integer),
    'deadline', s.deadline_at,
    'now', now(),
    'questions', qs
  );
end;
$$;

-- Saves one answer (or clears it) and the mark-for-review flag. Refused once the session is finished. A late save
-- after the deadline finishes the session as timed out instead.
create function public.save_answer(p_session_id uuid, p_question_id uuid, p_option_id uuid, p_marked boolean, p_seconds integer) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.session_run;
begin
  s := private.own_session(p_session_id);
  if s.finished_at is not null then
    return 'finished';
  end if;
  if s.started_at is null then
    raise exception 'The exam has not begun' using errcode = 'P0001';
  end if;
  if now() > s.deadline_at + interval '3 seconds' then
    perform private.finalize_session(s.id, true);
    return 'expired';
  end if;
  if p_option_id is not null and not exists (select 1 from public.mcq_option o where o.id = p_option_id and o.question_id = p_question_id) then
    raise exception 'That option does not belong to the question' using errcode = 'P0001';
  end if;

  update public.attempt
  set selected_option = p_option_id,
      marked_for_review = coalesce(p_marked, false),
      seconds_spent = greatest(seconds_spent, least(greatest(coalesce(p_seconds, 0), 0), 86400)),
      answered_at = case when p_option_id is null then null else now() end
  where session_run_id = s.id and question_id = p_question_id;
  if not found then
    raise exception 'That question is not in this exam' using errcode = 'P0001';
  end if;
  return 'ok';
end;
$$;

-- Submit (or time out). Returns the result summary. Safe to call twice.
create function public.finish_session(p_session_id uuid, p_timed_out boolean) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.session_run;
begin
  s := private.own_session(p_session_id);
  if s.started_at is null then
    raise exception 'The exam has not begun' using errcode = 'P0001';
  end if;
  perform private.finalize_session(s.id, coalesce(p_timed_out, false));
  select * into s from public.session_run where id = s.id;
  return jsonb_build_object('score', s.score, 'max_score', s.max_score, 'negative_applied', s.negative_applied, 'timed_out', s.timed_out);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- After the exam: the review (the only place the key and the explanations are sent)
-- ---------------------------------------------------------------------------------------------

create function public.get_review(p_session_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.session_run;
  ex public.exam;
  qs jsonb;
  c integer;
  w integer;
  sk integer;
begin
  s := private.own_session(p_session_id);
  if s.finished_at is null and s.deadline_at is not null and now() > s.deadline_at + interval '3 seconds' then
    perform private.finalize_session(s.id, true);
    select * into s from public.session_run where id = s.id;
  end if;
  if s.finished_at is null then
    raise exception 'The review opens after you submit' using errcode = 'P0001';
  end if;
  select * into ex from public.exam where id = s.exam_id;

  select count(*) filter (where is_correct), count(*) filter (where selected_option is not null and not is_correct), count(*) filter (where selected_option is null)
    into c, w, sk
  from public.attempt where session_run_id = s.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'position', a.position,
    'question_id', q.id,
    'text', q.text,
    'lang', q.lang,
    'figure_id', q.figure_id,
    'source_page', q.source_page,
    'topic_id', t.id,
    'topic', t.title,
    'topic_number', t.number,
    'subject', sj.name,
    'has_note', t.note_path is not null,
    'selected_option', a.selected_option,
    'is_correct', a.is_correct,
    'marked', a.marked_for_review,
    'seconds_spent', a.seconds_spent,
    'explanation', (select o.explanation from public.mcq_option o where o.question_id = q.id and o.is_correct),
    'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'text', o.text, 'is_correct', o.is_correct) order by o.label)
                from public.mcq_option o where o.question_id = q.id)
  ) order by a.position), '[]')
  into qs
  from public.attempt a
  join public.question q on q.id = a.question_id
  join public.topic t on t.id = q.topic_id
  join public.subject sj on sj.id = q.subject_id
  where a.session_run_id = s.id;

  return jsonb_build_object(
    'session', jsonb_build_object(
      'id', s.id,
      'exam_id', ex.id,
      'exam_name', ex.name,
      'set_name', (select qs2.name from public.question_set qs2 where qs2.id = s.set_id),
      'is_retry', s.retry_of is not null,
      'started_at', s.started_at,
      'finished_at', s.finished_at,
      'timed_out', s.timed_out,
      'seconds_used', greatest(0, least(extract(epoch from (s.finished_at - s.started_at))::integer, ceil(ex.time_seconds::numeric * (c + w + sk) / ex.question_count)::integer)),
      'score', s.score,
      'max_score', s.max_score,
      'negative_applied', s.negative_applied,
      'marks_per_question', ex.marks_per_question,
      'negative_mark', ex.negative_mark,
      'correct', c, 'wrong', w, 'skipped', sk, 'total', c + w + sk,
      'topic_ids', s.topic_ids
    ),
    'questions', qs
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- History and weak topics (the caller's own rows only)
-- ---------------------------------------------------------------------------------------------

create function public.my_history() returns table (
  session_id uuid, exam_id uuid, exam_name text, set_name text, is_retry boolean, finished_at timestamptz, timed_out boolean,
  score numeric, max_score numeric, negative_applied numeric, correct integer, wrong integer, skipped integer, total integer, seconds_used integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if not (select private.is_active()) then
    raise exception 'Your account is not approved' using errcode = '42501';
  end if;
  perform private.sweep_sessions(me);
  return query
  select s.id, s.exam_id, e.name, (select q.name from public.question_set q where q.id = s.set_id), s.retry_of is not null,
         s.finished_at, s.timed_out, s.score, s.max_score, s.negative_applied,
         (select count(*) filter (where a.is_correct)::integer from public.attempt a where a.session_run_id = s.id),
         (select count(*) filter (where a.selected_option is not null and not a.is_correct)::integer from public.attempt a where a.session_run_id = s.id),
         (select count(*) filter (where a.selected_option is null)::integer from public.attempt a where a.session_run_id = s.id),
         (select count(*)::integer from public.attempt a where a.session_run_id = s.id),
         greatest(0, extract(epoch from (s.finished_at - s.started_at))::integer)
  from public.session_run s join public.exam e on e.id = s.exam_id
  where s.user_id = me and s.finished_at is not null
  order by s.finished_at desc
  limit 200;
end;
$$;

-- Accuracy per topic over every finished session: right answers out of all questions asked (a skipped question counts as missed).
create function public.my_topic_stats() returns table (topic_id uuid, topic_number integer, topic_title text, subject_name text, asked integer, correct integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if not (select private.is_active()) then
    raise exception 'Your account is not approved' using errcode = '42501';
  end if;
  perform private.sweep_sessions(me);
  return query
  select t.id, t.number, t.title, sj.name, count(*)::integer, (count(*) filter (where a.is_correct))::integer
  from public.attempt a
  join public.session_run s on s.id = a.session_run_id and s.finished_at is not null
  join public.question q on q.id = a.question_id
  join public.topic t on t.id = q.topic_id
  join public.subject sj on sj.id = t.subject_id
  where a.user_id = me
  group by t.id, t.number, t.title, sj.name, sj.sort_order
  order by sj.sort_order, t.number;
end;
$$;

-- The latest finished score per live set of an exam, for the set pills on Home ("redoing shows earlier scores").
create function public.my_set_scores(p_exam_id uuid) returns table (set_id uuid, best_score numeric, last_score numeric, max_score numeric, tries integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if not (select private.is_active()) then
    raise exception 'Your account is not approved' using errcode = '42501';
  end if;
  return query
  select s.set_id, max(s.score), (array_agg(s.score order by s.finished_at desc))[1], max(s.max_score), count(*)::integer
  from public.session_run s
  where s.user_id = me and s.exam_id = p_exam_id and s.set_id is not null and s.finished_at is not null
  group by s.set_id;
end;
$$;

-- A started exam that has not finished and still has time, so Home can offer "Resume".
create function public.my_open_session() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  r record;
begin
  if not (select private.is_active()) then
    return null;
  end if;
  perform private.sweep_sessions(me);
  select s.id, e.name, s.deadline_at, s.started_at into r
  from public.session_run s join public.exam e on e.id = s.exam_id
  where s.user_id = me and s.finished_at is null and s.started_at is not null and s.deadline_at > now()
  order by s.started_at desc limit 1;
  if not found then
    return null;
  end if;
  return jsonb_build_object('session_id', r.id, 'exam_name', r.name, 'deadline', r.deadline_at);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Leaderboard (opt-in, switched on by the admin). Shares only a name, an average and a session count.
-- ---------------------------------------------------------------------------------------------

create function public.join_leaderboard() returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_active()) then
    raise exception 'Your account is not approved' using errcode = '42501';
  end if;
  update public.profile set leaderboard_since = now() where id = (select auth.uid()) and leaderboard_since is null;
end;
$$;

create function public.leave_leaderboard() returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_active()) then
    raise exception 'Your account is not approved' using errcode = '42501';
  end if;
  update public.profile set leaderboard_since = null where id = (select auth.uid());
end;
$$;

-- Average score percentage per member over finished sessions of a full set (not retries) that started after the member
-- joined. Top 10 plus the caller's own row.
create function public.leaderboard(p_exam_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  ex public.exam;
  on_ boolean;
  joined boolean;
  top jsonb;
  mine jsonb;
begin
  if not (select private.is_active()) then
    raise exception 'Your account is not approved' using errcode = '42501';
  end if;
  select leaderboard_on into on_ from public.app_setting where id = 1;
  select leaderboard_since is not null into joined from public.profile where id = me;
  if not coalesce(on_, false) then
    return jsonb_build_object('on', false, 'joined', coalesce(joined, false), 'top', '[]'::jsonb, 'me', null);
  end if;
  select * into ex from public.exam where id = p_exam_id;
  if not found then
    raise exception 'Exam not found' using errcode = 'P0001';
  end if;

  with ranked as (
    select rank() over (order by x.avg desc, x.sessions desc)::integer as rank, x.user_id, x.name, x.sessions, x.avg
    from (
      select p.id as user_id, p.name, count(*)::integer as sessions, round(avg(s.score / nullif(s.max_score, 0) * 100), 1) as avg
      from public.profile p
      join public.session_run s on s.user_id = p.id
      where p.status = 'active' and p.leaderboard_since is not null
        and s.exam_id = ex.id and s.finished_at is not null and s.retry_of is null and s.started_at >= p.leaderboard_since
        and (select count(*) from public.attempt a where a.session_run_id = s.id) = ex.question_count
      group by p.id, p.name
    ) x
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object('rank', r.rank, 'name', r.name, 'sessions', r.sessions, 'avg', r.avg, 'me', r.user_id = me) order by r.rank, r.name)
              from (select * from ranked order by rank, name limit 10) r), '[]'),
    (select jsonb_build_object('rank', r.rank, 'name', r.name, 'sessions', r.sessions, 'avg', r.avg, 'me', true) from ranked r where r.user_id = me)
  into top, mine;
  return jsonb_build_object('on', true, 'joined', coalesce(joined, false), 'top', top, 'me', mine);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Admin: storage usage for the free plan limits (1 GB storage, 500 MB database)
-- ---------------------------------------------------------------------------------------------

create function public.admin_storage_usage() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Only the admin can see storage usage' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'buckets', coalesce((
      select jsonb_agg(jsonb_build_object('bucket', b.id, 'files', coalesce(u.files, 0), 'bytes', coalesce(u.bytes, 0)) order by b.id)
      from storage.buckets b
      left join (
        select bucket_id, count(*) as files, sum(coalesce((metadata ->> 'size')::bigint, 0)) as bytes
        from storage.objects group by bucket_id
      ) u on u.bucket_id = b.id
    ), '[]')
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants: members only. The private helpers stay uncallable through the API.
-- ---------------------------------------------------------------------------------------------

revoke execute on function private.finalize_session(uuid, boolean) from public, anon, authenticated;
revoke execute on function private.sweep_sessions(uuid) from public, anon, authenticated;
revoke execute on function private.own_session(uuid) from public, anon, authenticated;

revoke execute on function public.start_session(uuid, uuid, uuid[], uuid) from public, anon;
revoke execute on function public.begin_session(uuid) from public, anon;
revoke execute on function public.session_state(uuid) from public, anon;
revoke execute on function public.save_answer(uuid, uuid, uuid, boolean, integer) from public, anon;
revoke execute on function public.finish_session(uuid, boolean) from public, anon;
revoke execute on function public.get_review(uuid) from public, anon;
revoke execute on function public.my_history() from public, anon;
revoke execute on function public.my_topic_stats() from public, anon;
revoke execute on function public.my_set_scores(uuid) from public, anon;
revoke execute on function public.my_open_session() from public, anon;
revoke execute on function public.join_leaderboard() from public, anon;
revoke execute on function public.leave_leaderboard() from public, anon;
revoke execute on function public.leaderboard(uuid) from public, anon;
revoke execute on function public.admin_storage_usage() from public, anon;

grant execute on function public.start_session(uuid, uuid, uuid[], uuid) to authenticated;
grant execute on function public.begin_session(uuid) to authenticated;
grant execute on function public.session_state(uuid) to authenticated;
grant execute on function public.save_answer(uuid, uuid, uuid, boolean, integer) to authenticated;
grant execute on function public.finish_session(uuid, boolean) to authenticated;
grant execute on function public.get_review(uuid) to authenticated;
grant execute on function public.my_history() to authenticated;
grant execute on function public.my_topic_stats() to authenticated;
grant execute on function public.my_set_scores(uuid) to authenticated;
grant execute on function public.my_open_session() to authenticated;
grant execute on function public.join_leaderboard() to authenticated;
grant execute on function public.leave_leaderboard() to authenticated;
grant execute on function public.leaderboard(uuid) to authenticated;
grant execute on function public.admin_storage_usage() to authenticated;
