-- Admin notifications (PLAN.md sections 3 item 9 and 7). In-app only: the bell in the top bar.
-- Rows are written only by these triggers, never from the browser (no insert grant).
--   new_signup:      a pending account was created (the sign-up route redeems an invite code).
--   question_report: a student reported a question (the Report question button arrives in Phase 5).
-- Every active admin gets one row. The pattern follows the MSc site's notification migration.

-- A new pending account notifies every active admin.
create function private.notify_new_signup() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'admin' or new.status <> 'pending' then
    return null;
  end if;
  insert into public.notification (user_id, kind, ref_profile_id)
  select p.id, 'new_signup', new.id
  from public.profile p
  where p.role = 'admin' and p.status = 'active' and p.id <> new.id;
  return null;
end;
$$;
revoke execute on function private.notify_new_signup() from public, anon, authenticated;

create trigger profile_new_signup_notify
after insert on public.profile
for each row execute function private.notify_new_signup();

-- Once the account is approved or rejected, its signup notification counts as read.
create function private.settle_signup_notification() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification
  set read_at = now()
  where kind = 'new_signup' and ref_profile_id = new.id and read_at is null;
  return null;
end;
$$;
revoke execute on function private.settle_signup_notification() from public, anon, authenticated;

create trigger profile_signup_settled
after update of status on public.profile
for each row
when (old.status = 'pending' and new.status <> 'pending')
execute function private.settle_signup_notification();

-- A reported question notifies every active admin (except an admin who reported it themselves).
create function private.notify_question_report() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification (user_id, kind, ref_report_id)
  select p.id, 'question_report', new.id
  from public.profile p
  where p.role = 'admin' and p.status = 'active' and p.id <> new.user_id;
  return null;
end;
$$;
revoke execute on function private.notify_question_report() from public, anon, authenticated;

create trigger question_report_notify
after insert on public.question_report
for each row execute function private.notify_question_report();

-- Once a report is resolved, its notification counts as read.
create function private.settle_report_notification() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification
  set read_at = now()
  where kind = 'question_report' and ref_report_id = new.id and read_at is null;
  return null;
end;
$$;
revoke execute on function private.settle_report_notification() from public, anon, authenticated;

create trigger question_report_settled
after update of status on public.question_report
for each row
when (old.status = 'open' and new.status = 'resolved')
execute function private.settle_report_notification();
