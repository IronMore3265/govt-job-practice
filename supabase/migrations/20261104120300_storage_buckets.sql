-- Private Storage buckets (PLAN.md sections 6.2 and 8).
--   notes:   one note PDF per topic, written by the import tool.
--   figures: 1:1 figure images from the reference books, written by the import tool.
-- No direct browser reads or writes. The service role (import tool, server routes) bypasses RLS and is the only
-- writer. The browser gets a file only through a short-lived signed URL that a server route issues after an
-- active-student check.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('notes', 'notes', false, 15728640, array['application/pdf']),
  ('figures', 'figures', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Second layer: a restrictive policy. Even if a permissive policy on storage.objects is added later by mistake,
-- signed-in users and anon still cannot list, read, upload, change or delete anything in these two buckets.
create policy "notes and figures: no direct browser access" on storage.objects
  as restrictive
  for all
  to anon, authenticated
  using (bucket_id not in ('notes', 'figures'))
  with check (bucket_id not in ('notes', 'figures'));
