-- Seed the four launch subjects and one exam per subject with the default recipe (PLAN.md sections 2 and 11):
-- 20 questions, 1 mark each, 0.25 off per wrong answer, 36 seconds per question (12 minutes for 20).
-- Topics are left blank on purpose: the admin adds them in the portal. Safe to run twice.

insert into public.subject (name, sort_order) values
  ('Bangla', 1),
  ('English', 2),
  ('Mathematics', 3),
  ('General Knowledge', 4)
on conflict (name) do nothing;

insert into public.exam (subject_id, name, question_count, marks_per_question, negative_mark, time_seconds, sort_order)
select s.id, s.name || ' Model Test', 20, 1, 0.25, 20 * 36, s.sort_order
from public.subject s
where s.name in ('Bangla', 'English', 'Mathematics', 'General Knowledge')
on conflict (name) do nothing;
