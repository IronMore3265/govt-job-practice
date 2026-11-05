import { NextResponse } from "next/server";
import { ANNOTATION_COLUMNS, cleanComment, cleanRects, cleanText, isColor, MAX_QUOTE, toAnnotation } from "@/lib/annotations";
import { getSession } from "@/lib/auth";
import { clampPage } from "@/lib/notes";
import { isUuid } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";

// Saves a highlight or a comment on a note, as the signed-in member. Row level security keeps every row private to its owner.
export async function POST(request: Request, ctx: RouteContext<"/api/notes/[topicId]/annotations">) {
  const { topicId } = await ctx.params;
  if (!isUuid(topicId)) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const session = await getSession();
  if (!session?.profile || session.profile.status !== "active") return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const supabase = await createClient();
  const { data: topic } = await supabase.from("topic").select("note_pages").eq("id", topicId).maybeSingle();
  if (!topic) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const page = clampPage(body.page, topic.note_pages);
  const rects = cleanRects(body.rects);
  const comment = cleanComment(body.comment);
  if (!page || rects.length === 0) return NextResponse.json({ error: "Select some text first." }, { status: 400 });

  const { data, error } = await supabase
    .from("note_annotation")
    .insert({
      user_id: session.user.id,
      topic_id: topicId,
      page,
      kind: comment ? "comment" : "highlight",
      color: isColor(body.color) ? body.color : "yellow",
      quote: cleanText(body.quote, MAX_QUOTE),
      rects,
      comment: comment || null,
    })
    .select(ANNOTATION_COLUMNS)
    .single();
  if (error || !data) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ annotation: toAnnotation(data) }, { status: 201 });
}
