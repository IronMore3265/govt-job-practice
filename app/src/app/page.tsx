import Link from "@/components/NavLink";
import { AdminBell } from "@/components/AdminBell";
import { HomePicker, type SubjectView } from "@/components/HomePicker";
import { InvitePanel } from "@/components/InvitePanel";
import { signOut } from "@/app/actions";
import { requireActive } from "@/lib/auth";
import { toInviteViews } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const { profile } = await requireActive();
  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  const [{ data: subjects }, { data: exams }, { data: invites }] = await Promise.all([
    supabase.from("subject").select("id, name, sort_order").order("sort_order"),
    supabase
      .from("exam")
      .select("id, name, subject_id, question_count, time_seconds, negative_mark, sort_order, exam_topic(topic(id, number, title)), question_set(id, name, status, created_at)")
      .order("sort_order"),
    supabase.from("invite").select("*").eq("created_by", profile.id).order("created_at", { ascending: false }),
  ]);

  const toExamView = (e: NonNullable<typeof exams>[number]) => ({
    id: e.id,
    name: e.name,
    questionCount: e.question_count,
    timeSeconds: e.time_seconds,
    negativeMark: Number(e.negative_mark),
    topics: e.exam_topic.flatMap((et) => (et.topic ? [et.topic] : [])).sort((a, b) => a.number - b.number),
    // Students only ever receive live sets (row level security). The admin sees drafts too, so filter here.
    liveSets: e.question_set
      .filter((s) => s.status === "live")
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((s) => ({ id: s.id, name: s.name })),
  });

  const views: SubjectView[] = (subjects ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    exams: (exams ?? []).filter((e) => e.subject_id === s.id).map(toExamView),
  }));
  const mixed = (exams ?? []).filter((e) => e.subject_id === null);
  if (mixed.length) views.push({ id: "mixed", name: "Mixed", exams: mixed.map(toExamView) });

  return (
    <main className="shell shell-wide">
      <div className="between topbar">
        <h1 className="title">
          Practice <span className="accent">Studio</span>
        </h1>
        <div className="topbar-actions">
          {isAdmin ? <AdminBell /> : null}
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

      <div className="dash-grid">
        <HomePicker subjects={views} />
        <aside className="dash-side stack">
          <InvitePanel invites={toInviteViews(invites ?? [])} limit={isAdmin ? null : profile.invite_limit} />
        </aside>
      </div>
    </main>
  );
}
