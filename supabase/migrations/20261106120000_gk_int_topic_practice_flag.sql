-- The GK International Topic Practice exam was created without the all_topics flag, so the home page treated it as a model test.
update public.exam set all_topics = true where name = 'General Knowledge - International Topic Practice';
