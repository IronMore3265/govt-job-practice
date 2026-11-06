import Link from "@/components/NavLink";
import { AdminBell } from "@/components/AdminBell";
import { HomePicker, type SubjectView } from "@/components/HomePicker";
import { InvitePanel } from "@/components/InvitePanel";
import { StreakPanel, type StreakView } from "@/components/StreakPanel";
import { signOut } from "@/app/actions";
import { requireActive } from "@/lib/auth";
import { toInviteViews } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const { profile } = await requireActive();
  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  const [{ data: subjects }, { data: exams }, { data: invites }, { data: open }, { data: streakRaw }] = await Promise.all([
    supabase.from("subject").select("id, name, sort_order").order("sort_order"),
    supabase
      .from("exam")
      .select("id, name, subject_id, question_count, time_seconds, negative_mark, sort_order, all_topics, exam_topic(topic(id, number, title, note_path)), question_set(id, name, status, created_at)")
      .order("sort_order"),
    supabase.from("invite").select("*").eq("created_by", profile.id).order("created_at", { ascending: false }),
    supabase.rpc("my_open_session"),
    supabase.rpc("my_streak"),
  ]);

  // Best score per saved set, so redoing a set shows the earlier result.
  const scored = await Promise.all((exams ?? []).map(async (e) => ({ id: e.id, rows: (await supabase.rpc("my_set_scores", { p_exam_id: e.id })).data ?? [] })));
  // Topic practice exams: every topic cut into sequential sets, with the student's best score per set.
  const sequential = await Promise.all(
    (exams ?? []).filter((e) => e.all_topics).map(async (e) => ({ id: e.id, rows: (await supabase.rpc("topic_sets", { p_exam_id: e.id })).data ?? [] })),
  );
  const setsByExam = new Map(sequential.map((s) => [s.id, s.rows]));
  const best = new Map(scored.flatMap((s) => s.rows.map((r) => [r.set_id, { best: Number(r.best_score), max: Number(r.max_score) }] as const)));

  const toExamView = (e: NonNullable<typeof exams>[number]) => ({
    id: e.id,
    name: e.name,
    questionCount: e.question_count,
    timeSeconds: e.time_seconds,
    negativeMark: Number(e.negative_mark),
    topics: e.exam_topic
      .flatMap((et) => (et.topic ? [{ id: et.topic.id, number: et.topic.number, title: et.topic.title, hasNote: Boolean(et.topic.note_path) }] : []))
      .sort((a, b) => a.number - b.number),
    allTopics: e.all_topics,
    topicSets: (setsByExam.get(e.id) ?? []).map((r) => ({
      topicId: r.topic_id,
      chunk: r.chunk,
      size: r.size,
      best: r.best_score === null ? null : Number(r.best_score),
      max: r.max_score === null ? null : Number(r.max_score),
      tries: r.tries,
    })),
    // Students only ever receive live sets (row level security). The admin sees drafts too, so filter here.
    liveSets: e.question_set
      .filter((s) => s.status === "live")
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((s) => ({ id: s.id, name: s.name, best: best.get(s.id)?.best ?? null, max: best.get(s.id)?.max ?? null })),
  });

  const views: SubjectView[] = (subjects ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    exams: (exams ?? []).filter((e) => e.subject_id === s.id).map(toExamView),
  }));
  const mixed = (exams ?? []).filter((e) => e.subject_id === null);
  if (mixed.length) views.push({ id: "mixed", name: "Mixed", exams: mixed.map(toExamView) });

  const inProgress = open as { session_id: string; exam_name: string } | null;
  const streak = streakRaw as unknown as StreakView | null;

  return (
    <main className="shell shell-wide">
      <div className="between topbar">
        <h1 className="title">
          Practice <span className="accent">Studio</span>
        </h1>
        <div className="topbar-actions">
          {isAdmin ? <AdminBell /> : null}
          <Link href="/notes" className="pill">
            Notes
          </Link>
          <Link href="/revision" className="pill">
            Revision
          </Link>
          <Link href="/history" className="pill">
            History
          </Link>
          {isAdmin ? (
            <Link href="/admin" className="pill">
              Admin
            </Link>
          ) : null}
          <form action={signOut}>
            <button type="submit" className="btn btn-small">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <p className="muted">Hi {profile.name}. Pick a subject and an exam. The answers and explanations show after you submit.</p>

      {inProgress ? (
        <div className="card-orange between" style={{ flexWrap: "wrap", gap: 10 }}>
          <div>
            <p className="label label-orange">Exam in progress</p>
            <p className="small">{inProgress.exam_name} is still running. The clock keeps going until time is up.</p>
          </div>
          <Link href={`/exam/${inProgress.session_id}`} className="btn btn-primary">
            Resume
          </Link>
        </div>
      ) : null}

      <HomePicker
        subjects={views}
        side={
          <>
            {streak ? <StreakPanel streak={streak} /> : null}
            <InvitePanel invites={toInviteViews(invites ?? [])} limit={isAdmin ? null : profile.invite_limit} />
          </>
        }
      />
    </main>
  );
}
