"""Write validated questions and figures to Supabase.

Order for every question: figure (if any), question as a draft, its four options, a read-back check that the text came
back unchanged (this is the Bangla round trip), then optionally approval. The database trigger only approves a question
that has four options, one correct, and an explanation on the correct one, so approval is always the last step.
Running the same file again is safe: a question whose text already exists in the topic is skipped.
"""
import hashlib
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

from .checks import FIGURE_EXT
from .parser import ParsedFile, Question


def slugify(name: str) -> str:
    """ASCII lowercase slug for storage paths. Empty when the name has no ASCII letters or digits."""
    ascii_only = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_only.lower()).strip("-")


def norm(text: str) -> str:
    return " ".join(text.split()).casefold()


@dataclass
class Item:
    question: Question
    subject: dict
    topic: dict
    lang: str
    duplicate: bool = False


@dataclass
class Summary:
    items: list = field(default_factory=list)
    imported: int = 0
    approved: int = 0
    skipped: int = 0
    figures_used: int = 0
    errors: list = field(default_factory=list)
    topic_ids: set = field(default_factory=set)


def find_subject(db, name: str) -> dict:
    subjects = db.select("subject", {"select": "id,name"})
    for s in subjects:
        if s["name"].casefold() == name.casefold():
            return s
    raise LookupError(f"subject '{name}' not found. Existing subjects: {', '.join(s['name'] for s in subjects) or 'none'}. Add it in Admin first.")


def find_topic(db, subject: dict, number: int) -> dict:
    rows = db.select("topic", {"select": "id,number,title,note_path", "subject_id": f"eq.{subject['id']}", "number": f"eq.{number}"})
    if not rows:
        have = db.select("topic", {"select": "number", "subject_id": f"eq.{subject['id']}", "order": "number"})
        listing = ", ".join(str(r["number"]) for r in have) or "none yet"
        raise LookupError(f"{subject['name']} has no topic {number} (existing numbers: {listing}). Add it in Admin > Topics first.")
    return rows[0]


def plan(db, files: list[ParsedFile]) -> Summary:
    """Read only. Resolve every subject and topic, and mark questions that already exist."""
    out = Summary()
    subjects: dict = {}
    topics: dict = {}
    existing: dict = {}
    for pf in files:
        subject = subjects.get(pf.subject.casefold())
        if subject is None:
            try:
                subject = subjects[pf.subject.casefold()] = find_subject(db, pf.subject)
            except LookupError as e:
                out.errors.append(f"{Path(pf.path).name}: {e}")
                continue
        for q in pf.questions:
            number = q.topic or pf.topic
            key = (subject["id"], number)
            if key not in topics:
                try:
                    topics[key] = find_topic(db, subject, number)
                except LookupError as e:
                    topics[key] = None
                    out.errors.append(f"{Path(pf.path).name}: {e}")
            topic = topics[key]
            if topic is None:
                continue
            if topic["id"] not in existing:
                rows = db.select("question", {"select": "text", "topic_id": f"eq.{topic['id']}"})
                existing[topic["id"]] = {norm(r["text"]) for r in rows}
            seen = existing[topic["id"]]
            dup = norm(q.text) in seen
            seen.add(norm(q.text))
            out.items.append(Item(q, subject, topic, q.lang or pf.lang, dup))
    return out


def upload_figure(db, subject: dict, topic: dict, path: Path, page: int | None, label: str | None, caption: str | None, cache: dict | None = None) -> str:
    """Store the image in the private figures bucket and return its figure row id. The same file is stored once."""
    data = path.read_bytes()
    mime = FIGURE_EXT[path.suffix.lower()]
    slug = slugify(subject["name"]) or subject["id"][:8]
    blob_path = f"{slug}/{topic['number']:03d}/{hashlib.sha256(data).hexdigest()[:10]}-{slugify(path.stem) or 'figure'}{path.suffix.lower()}"
    if cache is not None and blob_path in cache:
        return cache[blob_path]
    rows = db.select("figure", {"select": "id", "blob_path": f"eq.{blob_path}"})
    if rows:
        fid = rows[0]["id"]
    else:
        db.put_object("figures", blob_path, data, mime)
        row = {"topic_id": topic["id"], "page": page, "label": (label or path.stem)[:80], "caption": caption[:500] if caption else None, "blob_path": blob_path}
        fid = db.insert("figure", [row])[0]["id"]
    if cache is not None:
        cache[blob_path] = fid
    return fid


def _verify(sent: dict, back: dict) -> list[str]:
    return [k for k, v in sent.items() if back.get(k) != v]


def write_question(db, item: Item, figure_id: str | None, approve: bool) -> None:
    q = item.question
    row = db.insert("question", [{
        "subject_id": item.subject["id"], "topic_id": item.topic["id"], "lang": item.lang, "text": q.text,
        "figure_id": figure_id, "source_page": q.page, "origin": "import", "status": "draft",
    }])[0]
    try:
        options = [{"question_id": row["id"], "label": label, "text": q.options[label], "is_correct": label == q.answer,
                    "explanation": q.reason if label == q.answer else None} for label in "ABCD"]
        back = db.insert("mcq_option", options)
        bad = _verify({"text": q.text}, row)
        by_label = {o["label"]: o for o in back}
        for sent in options:
            bad += [f"option {sent['label']} {k}" for k in _verify({"text": sent["text"], "explanation": sent["explanation"], "is_correct": sent["is_correct"]}, by_label.get(sent["label"], {}))]
        if bad:
            raise RuntimeError("the database returned different text than was sent (" + ", ".join(bad) + "). Nothing was kept for this question")
        if approve:
            db.update("question", {"id": f"eq.{row['id']}"}, {"status": "approved"})
    except Exception:
        db.delete("question", {"id": f"eq.{row['id']}"})
        raise


def run(db, files: list[ParsedFile], figures_dir: Path | None = None, approve: bool = False, dry_run: bool = False) -> Summary:
    out = plan(db, files)
    if out.errors:
        return out
    cache: dict = {}
    for item in out.items:
        q = item.question
        if item.duplicate:
            out.skipped += 1
            continue
        out.topic_ids.add(item.topic["id"])
        if dry_run:
            out.imported += 1
            out.approved += approve
            continue
        try:
            fid = None
            if q.figure:
                base = figures_dir or Path(q.file).parent / "figures"
                before = len(cache)
                fid = upload_figure(db, item.subject, item.topic, base / q.figure, q.page, None, q.figure_caption, cache)
                out.figures_used += len(cache) - before
            write_question(db, item, fid, approve)
        except Exception as e:  # stop at the first failure so the problem is obvious
            out.errors.append(f"{q.label}: {e}")
            return out
        out.imported += 1
        out.approved += approve
    return out
