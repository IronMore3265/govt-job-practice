import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { clampPage } from "@/lib/notes";
import { isUuid } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";

// Saves the last page a member read in a note, so the viewer resumes there. The viewer calls it a moment after the page
// changes and, with keepalive, when the tab is closed. Rows are the member's own (row level security).
export async function POST(request: Request, ctx: RouteContext<"/api/notes/[topicId]/progress">) {
  const { topicId } = await ctx.params;
  if (!isUuid(topicId)) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const session = await getSession();
  if (!session?.profile || session.profile.status !== "active") return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { page?: unknown } | null;
  const supabase = await createClient();
  const { data: topic } = await supabase.from("topic").select("note_pages").eq("id", topicId).maybeSingle();
  if (!topic) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const page = clampPage(body?.page, topic.note_pages);
  if (!page) return NextResponse.json({ error: "Bad page." }, { status: 400 });

  // Students may change only last_page and updated_at of their own row, so this is update first, insert if new
  // (an upsert would also try to rewrite user_id and topic_id, which is not allowed).
  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("note_progress")
    .update({ last_page: page, updated_at: now })
    .eq("user_id", session.user.id)
    .eq("topic_id", topicId)
    .select("topic_id");
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  if (!updated?.length) {
    const { error: e2 } = await supabase.from("note_progress").insert({ user_id: session.user.id, topic_id: topicId, last_page: page, updated_at: now });
    if (e2 && e2.code !== "23505") return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
