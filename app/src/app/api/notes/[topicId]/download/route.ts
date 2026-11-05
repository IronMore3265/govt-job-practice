import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isUuid } from "@/lib/questions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// The Download button in the note viewer. Same checks as the viewer route (approved member, topic visible under row level
// security), then a redirect to a short-lived signed link that tells the browser to save the file instead of showing it.
export async function GET(_request: Request, ctx: RouteContext<"/api/notes/[topicId]/download">) {
  const { topicId } = await ctx.params;
  if (!isUuid(topicId)) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (session.profile?.status !== "active") return NextResponse.json({ error: "Your account is not approved yet." }, { status: 403 });

  const supabase = await createClient();
  const { data: topic } = await supabase.from("topic").select("note_path").eq("id", topicId).maybeSingle();
  if (!topic) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!topic.note_path) return NextResponse.json({ error: "This topic has no note yet." }, { status: 404 });

  const { data, error } = await createAdminClient().storage.from("notes").createSignedUrl(topic.note_path, 120, { download: true });
  if (error || !data) return NextResponse.json({ error: "The note could not be loaded." }, { status: 502 });

  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
}
