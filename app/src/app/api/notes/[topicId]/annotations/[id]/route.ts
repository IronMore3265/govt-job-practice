import { NextResponse } from "next/server";
import { ANNOTATION_COLUMNS, cleanComment, isColor, toAnnotation } from "@/lib/annotations";
import { getSession } from "@/lib/auth";
import { isUuid } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";

async function guard(ctx: RouteContext<"/api/notes/[topicId]/annotations/[id]">) {
  const { topicId, id } = await ctx.params;
  if (!isUuid(topicId) || !isUuid(id)) return { error: NextResponse.json({ error: "Bad request." }, { status: 400 }) } as const;
  const session = await getSession();
  if (!session?.profile || session.profile.status !== "active") return { error: NextResponse.json({ error: "Not allowed." }, { status: 403 }) } as const;
  return { topicId, id, userId: session.user.id } as const;
}

// Changes the comment (an empty one turns it back into a plain highlight) or the colour of one of your own highlights.
export async function PATCH(request: Request, ctx: RouteContext<"/api/notes/[topicId]/annotations/[id]">) {
  const g = await guard(ctx);
  if ("error" in g) return g.error;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const patch: { updated_at: string; kind?: "highlight" | "comment"; comment?: string | null; color?: "yellow" | "green" | "pink" } = { updated_at: new Date().toISOString() };
  if ("comment" in body) {
    const comment = cleanComment(body.comment);
    patch.comment = comment || null;
    patch.kind = comment ? "comment" : "highlight";
  }
  if (isColor(body.color)) patch.color = body.color;

  const supabase = await createClient();
  const { data, error } = await supabase.from("note_annotation").update(patch).eq("id", g.id).eq("topic_id", g.topicId).eq("user_id", g.userId).select(ANNOTATION_COLUMNS);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ annotation: toAnnotation(data[0]) });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/notes/[topicId]/annotations/[id]">) {
  const g = await guard(ctx);
  if ("error" in g) return g.error;
  const supabase = await createClient();
  const { error } = await supabase.from("note_annotation").delete().eq("id", g.id).eq("topic_id", g.topicId).eq("user_id", g.userId);
  if (error) return NextResponse.json({ error: "Could not delete." }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
