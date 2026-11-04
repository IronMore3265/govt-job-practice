-- Row level security for every table, plus the invite functions.
-- Browser code uses the anon key with the signed-in user's JWT, so these grants and policies are the real gate.
-- The service role (server routes and the import tool) bypasses RLS and is the only writer of profile rows.
--
-- Rules (CLAUDE.md, PLAN.md sections 7 and 8):
--   * anon gets nothing.
--   * Students see only their own profile, invites, session runs, attempts, note progress and reports.
--   * Approved question content (subjects, topics, figures, approved questions, live sets) is readable by active members only.
--   * The answer key (mcq_option) is never readable by students. The exam functions (Phase 5) withhold it until submit.
--   * Admin tables and all content writes are admin only.

-- New tables and functions in public start with no access for the API roles. Each one is granted below on purpose.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

grant usage on schema private to authenticated, service_role;
revoke execute on all functions in schema private from public, anon, authenticated;

-- Role helpers. Security definer so they read profile without recursing into its own policies.
create function private.is_admin() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profile
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
  );
$$;

create function private.is_active() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profile
    where id = (select auth.uid()) and status = 'active'
  );
$$;

revoke execute on function private.is_admin() from public, anon;
revoke execute on function private.is_active() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.is_active() to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Table privileges. Policies below decide which rows.
-- ---------------------------------------------------------------------------------------------

revoke all on table
  public.profile, public.invite, public.subject, public.topic, public.figure, public.question,
  public.mcq_option, public.exam, public.exam_topic, public.question_set, public.session_run,
  public.attempt, public.note_progress, public.question_report, public.notification, public.app_setting
from anon, authenticated;

grant select on table
  public.profile, public.invite, public.subject, public.topic, public.figure, public.question,
  public.mcq_option, public.exam, public.exam_topic, public.question_set, public.session_run,
  public.attempt, public.note_progress, public.question_report, public.notification, public.app_setting
to authenticated;

-- Content the admin edits in the portal (the policies make these admin only).
grant insert, update, delete on table
  public.subject, public.topic, public.figure, public.question, public.mcq_option,
  public.exam, public.exam_topic, public.question_set
to authenticated;

-- Admins may delete invites. Nobody edits profile rows from the browser: approvals, limits and password resets
-- go through server actions that check the admin role and then use the service role.
grant delete on table public.invite to authenticated;

-- Resume position in the note viewer: students write their own rows.
grant insert (user_id, topic_id, last_page, updated_at), update (last_page, updated_at) on table public.note_progress to authenticated;

-- Report a question as yourself; the admin resolves or deletes reports.
grant insert (question_id, user_id, note) on table public.question_report to authenticated;
grant update (status, resolved_at, resolved_by) on table public.question_report to authenticated;
grant delete on table public.question_report to authenticated;

-- Only the read mark of your own notifications may change.
grant update (read_at) on table public.notification to authenticated;

grant update (leaderboard_on, updated_at) on table public.app_setting to authenticated;

-- session_run and attempt get no write grants: Phase 5 writes them through security definer functions only.

alter table public.profile enable row level security;
alter table public.invite enable row level security;
alter table public.subject enable row level security;
alter table public.topic enable row level security;
alter table public.figure enable row level security;
alter table public.question enable row level security;
alter table public.mcq_option enable row level security;
alter table public.exam enable row level security;
alter table public.exam_topic enable row level security;
alter table public.question_set enable row level security;
alter table public.session_run enable row level security;
alter table public.attempt enable row level security;
alter table public.note_progress enable row level security;
alter table public.question_report enable row level security;
alter table public.notification enable row level security;
alter table public.app_setting enable row level security;

-- profile: your own row; the admin sees everyone.
create policy "profile: read own or admin" on public.profile
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

-- invite: your own codes; the admin sees all and may delete.
create policy "invite: read own or admin" on public.invite
  for select to authenticated
  using (created_by = (select auth.uid()) or (select private.is_admin()));
create policy "invite: admin delete" on public.invite
  for delete to authenticated
  using ((select private.is_admin()));

-- Subjects, topics, figures, exams: active members read, the admin writes.
create policy "subject: active read" on public.subject
  for select to authenticated using ((select private.is_active()));
create policy "subject: admin insert" on public.subject
  for insert to authenticated with check ((select private.is_admin()));
create policy "subject: admin update" on public.subject
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "subject: admin delete" on public.subject
  for delete to authenticated using ((select private.is_admin()));

create policy "topic: active read" on public.topic
  for select to authenticated using ((select private.is_active()));
create policy "topic: admin insert" on public.topic
  for insert to authenticated with check ((select private.is_admin()));
create policy "topic: admin update" on public.topic
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "topic: admin delete" on public.topic
  for delete to authenticated using ((select private.is_admin()));

create policy "figure: active read" on public.figure
  for select to authenticated using ((select private.is_active()));
create policy "figure: admin insert" on public.figure
  for insert to authenticated with check ((select private.is_admin()));
create policy "figure: admin update" on public.figure
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "figure: admin delete" on public.figure
  for delete to authenticated using ((select private.is_admin()));

create policy "exam: active read" on public.exam
  for select to authenticated using ((select private.is_active()));
create policy "exam: admin insert" on public.exam
  for insert to authenticated with check ((select private.is_admin()));
create policy "exam: admin update" on public.exam
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "exam: admin delete" on public.exam
  for delete to authenticated using ((select private.is_admin()));

create policy "exam_topic: active read" on public.exam_topic
  for select to authenticated using ((select private.is_active()));
create policy "exam_topic: admin insert" on public.exam_topic
  for insert to authenticated with check ((select private.is_admin()));
create policy "exam_topic: admin update" on public.exam_topic
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "exam_topic: admin delete" on public.exam_topic
  for delete to authenticated using ((select private.is_admin()));

-- Questions: the admin sees and edits everything; active students see approved questions only.
create policy "question: admin or approved read" on public.question
  for select to authenticated
  using ((select private.is_admin()) or (status = 'approved' and (select private.is_active())));
create policy "question: admin insert" on public.question
  for insert to authenticated with check ((select private.is_admin()));
create policy "question: admin update" on public.question
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "question: admin delete" on public.question
  for delete to authenticated using ((select private.is_admin()));

-- The answer key: admin only, for reading too.
create policy "mcq_option: admin read" on public.mcq_option
  for select to authenticated using ((select private.is_admin()));
create policy "mcq_option: admin insert" on public.mcq_option
  for insert to authenticated with check ((select private.is_admin()));
create policy "mcq_option: admin update" on public.mcq_option
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "mcq_option: admin delete" on public.mcq_option
  for delete to authenticated using ((select private.is_admin()));

-- Sets: the admin sees all; active students see live sets only.
create policy "question_set: admin or live read" on public.question_set
  for select to authenticated
  using ((select private.is_admin()) or (status = 'live' and (select private.is_active())));
create policy "question_set: admin insert" on public.question_set
  for insert to authenticated with check ((select private.is_admin()));
create policy "question_set: admin update" on public.question_set
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "question_set: admin delete" on public.question_set
  for delete to authenticated using ((select private.is_admin()));

-- Sessions and attempts: your own only. The admin does not read other people's answers either.
create policy "session_run: read own" on public.session_run
  for select to authenticated using (user_id = (select auth.uid()));
create policy "attempt: read own" on public.attempt
  for select to authenticated using (user_id = (select auth.uid()));

-- Note progress: your own only, and only while your account is active.
create policy "note_progress: read own" on public.note_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy "note_progress: insert own" on public.note_progress
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_active()));
create policy "note_progress: update own" on public.note_progress
  for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active()))
  with check (user_id = (select auth.uid()));

-- Reports: an active member reports an approved question as themselves. The admin reads, resolves and deletes.
create policy "question_report: read own or admin" on public.question_report
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "question_report: report as yourself" on public.question_report
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_active())
    and exists (select 1 from public.question q where q.id = question_id and q.status = 'approved')
  );
create policy "question_report: admin update" on public.question_report
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "question_report: admin delete" on public.question_report
  for delete to authenticated using ((select private.is_admin()));

-- Notifications: read and mark read your own. Rows are written only by triggers.
create policy "notification: read own" on public.notification
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notification: mark own read" on public.notification
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Site switches: active members read, the admin changes them.
create policy "app_setting: active read" on public.app_setting
  for select to authenticated using ((select private.is_active()));
create policy "app_setting: admin update" on public.app_setting
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------------------------
-- Invite functions (copied from the MSc site)
-- ---------------------------------------------------------------------------------------------

-- create_invite(): any active member makes a code. At most invite_limit unused codes at a time (default 3,
-- the admin has no limit). Locking the caller's profile row keeps two clicks from racing past the limit.
create function public.create_invite() returns public.invite
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.profile;
  unused integer;
  inv public.invite;
  candidate text;
begin
  select * into me from public.profile where id = (select auth.uid()) for update;
  if not found or me.status <> 'active' then
    raise exception 'Only active members can create invite codes' using errcode = '42501';
  end if;

  if me.role <> 'admin' then
    select count(*) into unused from public.invite
    where created_by = me.id and used_at is null and expires_at > now();
    if unused >= me.invite_limit then
      raise exception 'You already have % unused invite codes', unused using errcode = 'P0001';
    end if;
  end if;

  loop
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    candidate := substr(candidate, 1, 4) || '-' || substr(candidate, 5, 4) || '-' || substr(candidate, 9, 4);
    begin
      insert into public.invite (code, created_by) values (candidate, me.id) returning * into inv;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  return inv;
end;
$$;
revoke execute on function public.create_invite() from public, anon;
grant execute on function public.create_invite() to authenticated;

-- redeem_invite(): called only by the sign-up server route (service role) right after it creates the auth user.
-- Re-checks the code under a row lock, creates the pending profile and marks the code used.
create function public.redeem_invite(p_code text, p_user_id uuid, p_name text, p_email text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invite;
begin
  select * into inv from public.invite where code = upper(btrim(p_code)) for update;
  if not found or inv.used_at is not null or inv.expires_at <= now() then
    raise exception 'invalid_invite' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profile where id = inv.created_by and status = 'active') then
    raise exception 'invalid_invite' using errcode = 'P0001';
  end if;

  insert into public.profile (id, name, email, invited_by)
  values (p_user_id, p_name, lower(p_email), inv.created_by);

  update public.invite set used_by = p_user_id, used_at = now() where id = inv.id;
end;
$$;
revoke execute on function public.redeem_invite(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.redeem_invite(text, uuid, text, text) to service_role;

-- rls_auto_enable() is a Supabase platform event-trigger helper that exists in some projects.
-- Event triggers run as the owner, so nobody needs EXECUTE on it through the API.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
