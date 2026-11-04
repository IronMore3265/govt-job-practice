import Link from "@/components/NavLink";
import { QuestionForm } from "@/components/QuestionForm";
import { isUuid } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import { saveQuestion } from "../actions";

type SearchParams = Promise<{ topic?: string }>;

// Add a question by hand. It starts as a draft unless "Save and approve" is pressed.
export default async function NewQuestionPage({ searchParams }: { searchParams: SearchParams }) {
  const { topic } = await searchParams;
  const supabase = await createClient();
  const [{ data: subjects }, { data: topics }, { data: figures }] = await Promise.all([
    supabase.from("subject").select("id, name").order("sort_order"),
    supabase.from("topic").select("id, subject_id, number, title").order("number"),
    supabase.from("figure").select("id, topic_id, label, page, caption").order("page"),
  ]);

  return (
    <section className="stack" style={{ gap: 22 }}>
      <div className="stack-sm">
        <Link href="/admin/questions" className="small">
          Back to the question bank
        </Link>
        <h2 className="heading">
          Add a <span className="accent">Question</span>
        </h2>
        <p className="small muted">Four options, one correct, an explanation and the source page. Most questions come in through the import tool.</p>
      </div>
      {(topics ?? []).length === 0 ? (
        <p className="small muted">Add a topic first (Topics tab).</p>
      ) : (
        <div className="card-shadow">
          <QuestionForm
            action={saveQuestion}
            subjects={subjects ?? []}
            topics={topics ?? []}
            figures={figures ?? []}
            initial={{
              id: null,
              topic_id: isUuid(topic) && (topics ?? []).some((t) => t.id === topic) ? topic : "",
              lang: "en",
              text: "",
              options: { A: "", B: "", C: "", D: "" },
              correct: "",
              explanation: "",
              source_page: null,
              figure_id: null,
              status: "draft",
            }}
          />
        </div>
      )}
    </section>
  );
}
