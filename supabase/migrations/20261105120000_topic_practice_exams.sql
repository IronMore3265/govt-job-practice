-- Topic practice: one extra exam per subject ("Bangla Topic Practice") that covers every topic of the subject, so students can
-- practise topic by topic while the Model Test (the full course) is still being filled. Topics are linked automatically:
-- existing ones now, new ones by a trigger. Safe to run twice.

alter table public.exam add column if not exists all_topics boolean not null default false;

insert into public.exam (subject_id, name, question_count, marks_per_question, negative_mark, time_seconds, sort_order, all_topics)
select s.id, s.name || ' Topic Practice', 20, 1, 0.25, 20 * 36, s.sort_order + 100, true
from public.subject s
where s.name in ('Bangla', 'English', 'Mathematics', 'General Knowledge')
on conflict (name) do nothing;

insert into public.exam_topic (exam_id, topic_id)
select e.id, t.id
from public.exam e
join public.topic t on t.subject_id = e.subject_id
where e.all_topics
on conflict do nothing;

create function private.link_topic_to_practice_exams() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.exam_topic (exam_id, topic_id)
  select e.id, new.id from public.exam e where e.all_topics and e.subject_id = new.subject_id
  on conflict do nothing;
  return new;
end;
$$;

create trigger topic_link_to_practice_exams
after insert on public.topic
for each row execute function private.link_topic_to_practice_exams();
