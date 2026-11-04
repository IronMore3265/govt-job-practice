-- Phase 1 core schema (PLAN.md section 9). Row level security is in the next migration.
--
-- Changes from the draft data model, all for foreign-key integrity:
--   * profile.id is the auth user id (no separate user_id column), as on the MSc site.
--   * exam topics live in a join table exam_topic instead of an exam.topic_ids array, so deleting a topic
--     unlinks it cleanly. exam.subject_id is the subject the exam is listed under on Home (null = mixed exam).
--   * question has a composite foreign key so its topic always belongs to its subject.

create type public.user_role as enum ('student', 'admin');
create type public.user_status as enum ('pending', 'active', 'disabled');
create type public.question_lang as enum ('en', 'bn');
create type public.question_origin as enum ('manual', 'import');
create type public.question_status as enum ('draft', 'approved');
create type public.set_origin as enum ('auto', 'curated');
create type public.set_status as enum ('draft', 'live');
create type public.report_status as enum ('open', 'resolved');
create type public.notification_kind as enum ('new_signup', 'question_report');

-- profile: one row per auth user. leaderboard_since stays null until the student joins the leaderboard.
create table public.profile (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  email text not null,
  role public.user_role not null default 'student',
  status public.user_status not null default 'pending',
  invite_limit integer not null default 3 check (invite_limit between 0 and 100),
  invited_by uuid references public.profile (id) on delete set null,
  approved_by uuid references public.profile (id) on delete set null,
  approved_at timestamptz,
  leaderboard_since timestamptz,
  created_at timestamptz not null default now()
);
create unique index profile_email_key on public.profile (lower(email));
create index profile_invited_by_idx on public.profile (invited_by);
create index profile_approved_by_idx on public.profile (approved_by);
create index profile_status_idx on public.profile (status);

-- invite: one-time codes that expire after 7 days. A code is used once used_at is set.
create table public.invite (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by uuid not null references public.profile (id) on delete cascade,
  used_by uuid references public.profile (id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);
create index invite_created_by_idx on public.invite (created_by);
create index invite_used_by_idx on public.invite (used_by);

create table public.subject (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- topic: a chapter-sized unit with one note PDF (note_path is the object path in the private notes bucket).
create table public.topic (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subject (id) on delete cascade,
  number integer not null check (number between 1 and 999),
  title text not null check (char_length(title) between 1 and 200),
  note_path text check (char_length(note_path) <= 500),
  note_pages integer check (note_pages > 0),
  created_at timestamptz not null default now(),
  unique (subject_id, number),
  unique (id, subject_id)
);

-- figure: a 1:1 copy from the reference book, stored in the private figures bucket.
create table public.figure (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topic (id) on delete cascade,
  page integer check (page > 0),
  label text check (char_length(label) <= 80),
  caption text check (char_length(caption) <= 500),
  blob_path text not null unique check (char_length(blob_path) between 1 and 500),
  created_at timestamptz not null default now()
);
create index figure_topic_idx on public.figure (topic_id);

create table public.question (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null,
  topic_id uuid not null,
  lang public.question_lang not null default 'en',
  text text not null check (char_length(text) between 1 and 4000),
  figure_id uuid references public.figure (id) on delete set null,
  source_page integer check (source_page > 0),
  origin public.question_origin not null default 'manual',
  status public.question_status not null default 'draft',
  created_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (topic_id, subject_id) references public.topic (id, subject_id) on delete cascade
);
create index question_subject_idx on public.question (subject_id);
create index question_topic_idx on public.question (topic_id, status);
create index question_figure_idx on public.question (figure_id);
create index question_created_by_idx on public.question (created_by);

-- mcq_option holds the answer key (is_correct) and the explanation. Students never read this table
-- directly: the exam functions (Phase 5) serve options without the key and reveal it only after submit.
create table public.mcq_option (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question (id) on delete cascade,
  label text not null check (label in ('A', 'B', 'C', 'D')),
  text text not null check (char_length(text) between 1 and 1000),
  is_correct boolean not null default false,
  explanation text check (char_length(explanation) <= 2000),
  unique (question_id, label)
);
create unique index mcq_option_one_correct on public.mcq_option (question_id) where is_correct;

-- exam: a saved recipe. Defaults: 20 questions, 1 mark each, 0.25 off per wrong answer,
-- 36 seconds per question (720 seconds for 20).
create table public.exam (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subject (id) on delete set null,
  name text not null unique check (char_length(name) between 1 and 120),
  question_count integer not null default 20 check (question_count between 1 and 200),
  marks_per_question numeric(6, 2) not null default 1 check (marks_per_question > 0),
  negative_mark numeric(6, 2) not null default 0.25 check (negative_mark >= 0),
  time_seconds integer not null default 720 check (time_seconds between 1 and 86400),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index exam_subject_idx on public.exam (subject_id);

create table public.exam_topic (
  exam_id uuid not null references public.exam (id) on delete cascade,
  topic_id uuid not null references public.topic (id) on delete cascade,
  primary key (exam_id, topic_id)
);
create index exam_topic_topic_idx on public.exam_topic (topic_id);

-- question_set: a saved, ordered list of questions for one exam. Live only with exactly
-- exam.question_count approved questions (20 by default). The checks are in triggers below.
create table public.question_set (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exam (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  origin public.set_origin not null default 'auto',
  status public.set_status not null default 'draft',
  question_ids uuid[] not null default '{}',
  created_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (exam_id, name)
);
create index question_set_exam_idx on public.question_set (exam_id, status);
create index question_set_created_by_idx on public.question_set (created_by);
create index question_set_question_ids_idx on public.question_set using gin (question_ids);

-- session_run: one sitting of a set (or a retry of missed questions). Written only by the exam functions (Phase 5).
-- started_at is set when the student presses Begin; deadline_at is started_at plus the exam's time.
create table public.session_run (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profile (id) on delete cascade,
  exam_id uuid not null references public.exam (id) on delete cascade,
  set_id uuid references public.question_set (id) on delete set null,
  retry_of uuid references public.session_run (id) on delete set null,
  topic_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  deadline_at timestamptz,
  finished_at timestamptz,
  timed_out boolean not null default false,
  score numeric(7, 2),
  negative_applied numeric(7, 2) check (negative_applied >= 0),
  max_score numeric(7, 2) check (max_score >= 0),
  unique (id, user_id)
);
create index session_run_user_idx on public.session_run (user_id, created_at desc);
create index session_run_exam_idx on public.session_run (exam_id);
create index session_run_set_idx on public.session_run (set_id);
create index session_run_retry_idx on public.session_run (retry_of);

-- attempt: one question inside a session. is_correct stays null until the session is finished,
-- so a student reading their own attempts mid-exam learns nothing about the key.
create table public.attempt (
  id uuid primary key default gen_random_uuid(),
  session_run_id uuid not null,
  question_id uuid not null references public.question (id) on delete cascade,
  user_id uuid not null,
  position integer not null check (position >= 0),
  selected_option uuid references public.mcq_option (id) on delete set null,
  is_correct boolean,
  marked_for_review boolean not null default false,
  seconds_spent integer not null default 0 check (seconds_spent >= 0),
  answered_at timestamptz,
  unique (session_run_id, question_id),
  unique (session_run_id, position),
  foreign key (session_run_id, user_id) references public.session_run (id, user_id) on delete cascade
);
create index attempt_user_idx on public.attempt (user_id);
create index attempt_question_idx on public.attempt (question_id);
create index attempt_option_idx on public.attempt (selected_option);

-- note_progress: the last page read per student and note, for resume in the viewer (Phase 4).
create table public.note_progress (
  user_id uuid not null references public.profile (id) on delete cascade,
  topic_id uuid not null references public.topic (id) on delete cascade,
  last_page integer not null default 1 check (last_page between 1 and 10000),
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
create index note_progress_topic_idx on public.note_progress (topic_id);

-- question_report: the "Report question" button (Phase 5). One open report per student per question.
create table public.question_report (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question (id) on delete cascade,
  user_id uuid not null references public.profile (id) on delete cascade,
  note text not null check (char_length(note) between 1 and 500),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profile (id) on delete set null
);
create unique index question_report_one_open on public.question_report (question_id, user_id) where status = 'open';
create index question_report_user_idx on public.question_report (user_id);
create index question_report_status_idx on public.question_report (status, created_at desc);
create index question_report_resolved_by_idx on public.question_report (resolved_by);

-- notification: in-app only, shown in the admin's bell. Written only by triggers (next migrations).
create table public.notification (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profile (id) on delete cascade,
  kind public.notification_kind not null,
  ref_profile_id uuid references public.profile (id) on delete cascade,
  ref_report_id uuid references public.question_report (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (
    (kind = 'new_signup' and ref_profile_id is not null)
    or (kind = 'question_report' and ref_report_id is not null)
  )
);
create index notification_user_idx on public.notification (user_id, created_at desc);
create index notification_ref_profile_idx on public.notification (ref_profile_id);
create index notification_ref_report_idx on public.notification (ref_report_id);

-- app_setting: one row of site-wide switches.
create table public.app_setting (
  id smallint primary key default 1 check (id = 1),
  leaderboard_on boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.app_setting (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;

create function private.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger question_touch
before update on public.question
for each row execute function private.touch_updated_at();

-- An approved question has four options, exactly one correct, and an explanation on the correct one.
create function private.check_question_ready() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  n integer;
  c integer;
  e integer;
begin
  if new.status = 'approved' then
    select count(*),
           count(*) filter (where is_correct),
           count(*) filter (where is_correct and coalesce(btrim(explanation), '') <> '')
      into n, c, e
    from public.mcq_option where question_id = new.id;
    if n <> 4 or c <> 1 or e <> 1 then
      raise exception 'An approved question needs four options, exactly one correct, and an explanation on the correct option'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger question_ready
before insert or update of status on public.question
for each row execute function private.check_question_ready();

-- Every set: no duplicates, only existing questions.
-- A live set: exactly exam.question_count questions, all approved and all from the exam's topics.
-- A draft set is not held to the live rules, so sending a set back to draft always works.
create function private.check_question_set() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  n integer := coalesce(cardinality(new.question_ids), 0);
  wanted integer;
  ok_n integer;
begin
  if n <> (select count(distinct q) from unnest(new.question_ids) as q) then
    raise exception 'A set cannot list the same question twice' using errcode = 'P0001';
  end if;

  if (tg_op = 'INSERT' or new.question_ids is distinct from old.question_ids)
     and n <> (select count(*) from public.question q where q.id = any (new.question_ids)) then
    raise exception 'Every question in a set must exist' using errcode = 'P0001';
  end if;

  if new.status = 'live' then
    select e.question_count into wanted from public.exam e where e.id = new.exam_id;
    select count(*) into ok_n
    from public.question q
    where q.id = any (new.question_ids)
      and q.status = 'approved'
      and q.topic_id in (select et.topic_id from public.exam_topic et where et.exam_id = new.exam_id);
    if n <> wanted or ok_n <> n then
      raise exception 'A live set needs exactly % approved questions from the exam''s topics (it has %, % qualify)', wanted, n, ok_n
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger question_set_check
before insert or update of question_ids, status, exam_id on public.question_set
for each row execute function private.check_question_set();

-- When a question is deleted or moved back to draft, every set that lists it goes back to draft
-- (a deleted question is also removed from the list). Security definer: it must reach every set.
create function private.release_question_from_sets() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.question_set
    set question_ids = array_remove(question_ids, old.id), status = 'draft'
    where question_ids @> array[old.id];
    return old;
  end if;
  update public.question_set
  set status = 'draft'
  where status = 'live' and question_ids @> array[new.id];
  return new;
end;
$$;
revoke execute on function private.release_question_from_sets() from public;

create trigger question_release_on_delete
before delete on public.question
for each row execute function private.release_question_from_sets();

create trigger question_release_on_draft
after update of status, topic_id on public.question
for each row
when (new.status <> 'approved' or new.topic_id is distinct from old.topic_id)
execute function private.release_question_from_sets();

-- When an exam's question count changes, or a topic leaves the exam, its live sets go back to draft.
create function private.release_exam_sets() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'exam' then
    update public.question_set set status = 'draft' where exam_id = new.id and status = 'live';
    return new;
  end if;
  update public.question_set qs
  set status = 'draft'
  where qs.exam_id = old.exam_id
    and qs.status = 'live'
    and exists (
      select 1 from public.question q where q.id = any (qs.question_ids) and q.topic_id = old.topic_id
    );
  return old;
end;
$$;
revoke execute on function private.release_exam_sets() from public;

create trigger exam_release_on_count
after update of question_count on public.exam
for each row
when (new.question_count is distinct from old.question_count)
execute function private.release_exam_sets();

create trigger exam_topic_release_on_unlink
after delete on public.exam_topic
for each row execute function private.release_exam_sets();
