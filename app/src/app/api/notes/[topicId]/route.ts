import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isUuid } from "@/lib/questions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// A topic's note PDF. The `notes` bucket is private, so the browser never gets a permanent link: this route checks that
// the caller is an approved member, then returns a signed link that stops working after 10 minutes. The viewer asks for
// a fresh one each time a note is opened. There is no download button in the viewer. A member who can read a note can
// still save it by other means, so this only makes casual copying harder (PLAN.md section 6.2).
export async function GET(_request: Request, ctx: RouteContext<"/api/notes/[topicId]">) {
  const { topicId } = await ctx.params;
  if (!isUuid(topicId)) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (session.profile?.status !== "active") return NextResponse.json({ error: "Your account is not approved yet." }, { status: 403 });

  // Read with the caller's own session, so row level security decides whether they may see this topic.
  const supabase = await createClient();
  const { data: topic } = await supabase.from("topic").select("title, note_path, note_pages").eq("id", topicId).maybeSingle();
  if (!topic) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!topic.note_path) return NextResponse.json({ error: "This topic has no note yet." }, { status: 404 });

  const { data, error } = await createAdminClient().storage.from("notes").createSignedUrl(topic.note_path, 600);
  if (error || !data) return NextResponse.json({ error: "The note could not be loaded." }, { status: 502 });

  return NextResponse.json({ url: data.signedUrl, title: topic.title, pages: topic.note_pages }, { headers: { "Cache-Control": "private, no-store" } });
}
