import { notFound } from "next/navigation";
import Link from "@/components/NavLink";
import { NoteViewer } from "@/components/NoteViewer";
import { ANNOTATION_COLUMNS, toAnnotation } from "@/lib/annotations";
import { requireActive } from "@/lib/auth";
import { parseTopicList, startPage } from "@/lib/notes";
import { isUuid } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// The themed note viewer for one topic. Opened from the Notes library, from Home ("Read notes first", with the topics the
// student picked and a sticky Start exam button) or from an explanation that says "see page 12" (`?page=12`).
export default async function NotePage({ params, searchParams }: Props) {
  const { topicId } = await params;
  const sp = await searchParams;
  if (!isUuid(topicId)) notFound();
  const { user } = await requireActive();
  const supabase = await createClient();

  const { data: topic } = await supabase.from("topic").select("id, subject_id, number, title, note_path, note_pages").eq("id", topicId).maybeSingle();
  if (!topic) notFound();

  const listed = parseTopicList(sp.topics);
  const ids = listed.includes(topicId) ? listed : [topicId, ...listed];
  const examParam = one(sp.exam);
  const setParam = one(sp.set);
  const chunkNum = Number(one(sp.chunk));
  const chunk = Number.isInteger(chunkNum) && chunkNum >= 1 && chunkNum <= 1000 ? chunkNum : null;

  const [{ data: subject }, { data: progress }, { data: marks }, { data: related }, { data: exam }] = await Promise.all([
    supabase.from("subject").select("name").eq("id", topic.subject_id).maybeSingle(),
    supabase.from("note_progress").select("last_page").eq("user_id", user.id).eq("topic_id", topicId).maybeSingle(),
    supabase.from("note_annotation").select(ANNOTATION_COLUMNS).eq("user_id", user.id).eq("topic_id", topicId).order("page").order("created_at"),
    ids.length > 1 ? supabase.from("topic").select("id, number, title, note_path").in("id", ids) : Promise.resolve({ data: [] }),
    isUuid(examParam) ? supabase.from("exam").select("id").eq("id", examParam).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  if (!topic.note_path) {
    return (
      <main className="shell">
        <div className="card stack-sm">
          <p className="row-name">{topic.title}</p>
          <p className="small muted">This topic has no note yet.</p>
          <Link href={exam ? "/" : "/notes"} className="btn btn-small">
            Back
          </Link>
        </div>
      </main>
    );
  }

  // Only topics that have a note become tabs, in the order the student's list gave.
  const withNotes = new Map((related ?? []).filter((t) => t.note_path).map((t) => [t.id, t]));
  const tabs = ids.map((id) => (id === topicId ? topic : withNotes.get(id))).filter((t): t is NonNullable<typeof t> => Boolean(t)).map((t) => ({ id: t.id, number: t.number, title: t.title }));

  return (
    <NoteViewer
      key={topic.id}
      topicId={topic.id}
      title={topic.title}
      subject={`${subject?.name ?? ""} · Topic ${topic.number}`}
      initialPage={startPage({ requested: one(sp.page), saved: progress?.last_page, pages: topic.note_pages })}
      initialMarks={(marks ?? []).map(toAnnotation)}
      related={tabs}
      topicsParam={ids.length > 1 || listed.length ? ids : []}
      exam={exam ? exam.id : null}
      setId={exam && isUuid(setParam) ? setParam : null}
      start={exam ? { examId: exam.id, setId: isUuid(setParam) ? setParam : "random", topicIds: one(sp.narrow) === "1" ? ids : [], chunk } : null}
      backHref={exam ? "/" : "/notes"}
    />
  );
}
