-- Highlights and comments in the note viewer. Each student sees only their own.
--   rects: the highlighted boxes as fractions of the page (x, y, w, h from 0 to 1), so they stay right at any zoom.
--   A comment is a highlight with text, so kind = 'comment' always carries a comment.

create table public.note_annotation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profile (id) on delete cascade,
  topic_id uuid not null references public.topic (id) on delete cascade,
  page integer not null check (page between 1 and 10000),
  kind text not null default 'highlight' check (kind in ('highlight', 'comment')),
  color text not null default 'yellow' check (color in ('yellow', 'green', 'pink')),
  quote text not null default '' check (char_length(quote) <= 2000),
  rects jsonb not null default '[]'::jsonb check (jsonb_typeof(rects) = 'array' and jsonb_array_length(rects) <= 200),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'highlight' or comment is not null)
);
create index note_annotation_user_topic_idx on public.note_annotation (user_id, topic_id, page);
create index note_annotation_topic_idx on public.note_annotation (topic_id);

revoke all on table public.note_annotation from anon, authenticated;
grant select, delete on table public.note_annotation to authenticated;
grant insert (user_id, topic_id, page, kind, color, quote, rects, comment) on table public.note_annotation to authenticated;
grant update (kind, color, comment, updated_at) on table public.note_annotation to authenticated;

alter table public.note_annotation enable row level security;

create policy "note_annotation: read own" on public.note_annotation
  for select to authenticated using (user_id = (select auth.uid()));
create policy "note_annotation: insert own" on public.note_annotation
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_active()));
create policy "note_annotation: update own" on public.note_annotation
  for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active()))
  with check (user_id = (select auth.uid()));
create policy "note_annotation: delete own" on public.note_annotation
  for delete to authenticated using (user_id = (select auth.uid()));
