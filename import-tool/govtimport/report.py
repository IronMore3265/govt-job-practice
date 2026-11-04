"""Short-set report: for every exam, how many questions its topics hold and how many the last set is missing.

Sets of exactly `question_count` questions (20 by default) are filled one after another from an exam's topics, so a
pool of 34 gives one full set and a last set of 14 that needs 6 more. A set only goes live with a full count.
"""
from dataclasses import dataclass


@dataclass
class ExamLine:
    name: str
    per_set: int
    topics: int
    approved: int
    drafts: int

    @staticmethod
    def split(n: int, per_set: int) -> tuple[int, int, int]:
        """(full sets, questions in the last partial set, missing from it)."""
        full, rest = divmod(n, per_set)
        return full, rest, (per_set - rest) if rest or n == 0 else 0

    @property
    def missing(self) -> int:
        return self.split(self.approved, self.per_set)[2]

    def describe(self) -> str:
        if not self.topics:
            return f"{self.name}: no topics linked yet (Admin > Exams)"
        full, rest, missing = self.split(self.approved, self.per_set)
        parts = [f"{self.approved} approved", f"{full} full set{'s' if full != 1 else ''}"]
        if missing:
            parts.append(f"last set has {rest} of {self.per_set}, needs {missing} more")
        else:
            parts.append("last set is full")
        if self.drafts:
            _, _, missing_all = self.split(self.approved + self.drafts, self.per_set)
            parts.append(f"{self.drafts} drafts waiting for approval" + (f" (still {missing_all} short if all are approved)" if missing_all else " (enough if all are approved)"))
        return f"{self.name}: " + ", ".join(parts)


def short_sets(db, topic_ids: set | None = None) -> list[ExamLine]:
    """One line per exam. When topic_ids is given, only exams that use one of those topics."""
    exams = db.select("exam", {"select": "id,name,question_count", "order": "sort_order,name"})
    links = db.select("exam_topic", {"select": "exam_id,topic_id"})
    by_exam: dict = {}
    for link in links:
        by_exam.setdefault(link["exam_id"], set()).add(link["topic_id"])
    counts: dict = {}
    for row in db.select("question", {"select": "topic_id,status"}):
        c = counts.setdefault(row["topic_id"], {"approved": 0, "draft": 0})
        c[row["status"]] += 1
    lines = []
    for exam in exams:
        topics = by_exam.get(exam["id"], set())
        if topic_ids is not None and not (topics & topic_ids):
            continue
        lines.append(ExamLine(
            exam["name"], exam["question_count"], len(topics),
            sum(counts.get(t, {}).get("approved", 0) for t in topics),
            sum(counts.get(t, {}).get("draft", 0) for t in topics),
        ))
    return lines
