-- A small picture of the highlighted area, shown in the "My marks" lists instead of the text copied from the PDF
-- (the note fonts scramble Bangla conjuncts when copied, a picture is always right).
--   clip: a data URL (webp, jpeg or png) made in the browser. The lists load it from a route, so pages stay light.
--   has_clip: lets the lists know a picture exists without reading it.

alter table public.note_annotation
  add column clip text check (clip is null or (char_length(clip) <= 150000 and clip ~ '^data:image/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$')),
  add column has_clip boolean generated always as (clip is not null) stored;

grant insert (clip) on table public.note_annotation to authenticated;
grant update (clip) on table public.note_annotation to authenticated;
