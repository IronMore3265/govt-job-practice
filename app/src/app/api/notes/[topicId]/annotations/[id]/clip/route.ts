import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isUuid } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";

// The picture of one of your own highlights, for the "My marks" lists. Row level security makes it yours alone.
export async function GET(_request: Request, ctx: RouteContext<"/api/notes/[topicId]/annotations/[id]/clip">) {
  const { topicId, id } = await ctx.params;
  if (!isUuid(topicId) || !isUuid(id)) return new NextResponse(null, { status: 400 });
  const session = await getSession();
  if (!session?.profile || session.profile.status !== "active") return new NextResponse(null, { status: 403 });

  const supabase = await createClient();
  const { data } = await supabase.from("note_annotation").select("clip").eq("id", id).eq("topic_id", topicId).eq("user_id", session.user.id).maybeSingle();
  const match = data?.clip?.match(/^data:(image\/(?:webp|jpeg|png));base64,(.+)$/);
  if (!match) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(match[2], "base64"), { headers: { "Content-Type": match[1], "Cache-Control": "private, max-age=86400" } });
}
