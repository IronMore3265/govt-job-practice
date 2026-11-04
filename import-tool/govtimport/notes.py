"""Check a note PDF and upload it to the private `notes` bucket, then link it to its topic.

Notes are real text PDFs built outside the app (PLAN.md section 6.1): selectable text, fonts embedded, under 10 MB.
The bucket allows 15 MB per file, so 10 to 15 MB is a warning and over 15 MB is an error.
"""
from dataclasses import dataclass, field
from pathlib import Path

from pypdf import PdfReader

from .importer import find_subject, find_topic, slugify

WARN_BYTES = 10 * 1024 * 1024
MAX_BYTES = 15 * 1024 * 1024


@dataclass
class PdfReport:
    pages: int = 0
    size: int = 0
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)


def _unembedded_fonts(reader: PdfReader, limit: int = 5) -> set:
    bad = set()
    for page in list(reader.pages)[:limit]:
        fonts = (page.get("/Resources") or {}).get("/Font") or {}
        for ref in fonts.values():
            font = ref.get_object()
            if font.get("/Subtype") == "/Type0":
                font = font["/DescendantFonts"][0].get_object()
            desc = font.get("/FontDescriptor")
            if desc is None:
                continue  # one of the 14 standard fonts, readable everywhere
            desc = desc.get_object()
            if not any(k in desc for k in ("/FontFile", "/FontFile2", "/FontFile3")):
                bad.add(str(font.get("/BaseFont", "?")).lstrip("/"))
    return bad


def check_pdf(path: Path) -> PdfReport:
    rep = PdfReport()
    if not path.is_file():
        rep.errors.append(f"file not found: {path}")
        return rep
    rep.size = path.stat().st_size
    if path.suffix.lower() != ".pdf" or not path.read_bytes()[:5] == b"%PDF-":
        rep.errors.append("this is not a PDF file")
        return rep
    if rep.size > MAX_BYTES:
        rep.errors.append(f"{rep.size / 1048576:.1f} MB is over the 15 MB limit of the notes bucket")
    elif rep.size > WARN_BYTES:
        rep.warnings.append(f"{rep.size / 1048576:.1f} MB is over the 10 MB target. Compress it to save free storage")
    try:
        reader = PdfReader(str(path))
        if reader.is_encrypted:
            rep.errors.append("the PDF is encrypted, so the viewer cannot open it")
            return rep
        rep.pages = len(reader.pages)
        sample = "".join((p.extract_text() or "") for p in list(reader.pages)[:3]).strip()
        if len(sample) < 20:
            rep.warnings.append("no selectable text on the first pages. Notes must be real text PDFs, not scans")
        bad = _unembedded_fonts(reader)
        if bad:
            rep.warnings.append(f"fonts not embedded: {', '.join(sorted(bad))}. Bangla and Outfit text can break on other devices")
    except Exception as e:
        rep.errors.append(f"the PDF could not be read: {e}")
    if rep.pages == 0 and not rep.errors:
        rep.errors.append("the PDF has no pages")
    return rep


def upload_note(db, subject_name: str, topic_number: int, path: Path, dry_run: bool = False) -> tuple[PdfReport, str | None]:
    rep = check_pdf(path)
    if rep.errors:
        return rep, None
    subject = find_subject(db, subject_name)
    topic = find_topic(db, subject, topic_number)
    slug = slugify(subject["name"]) or subject["id"][:8]
    blob_path = f"{slug}/{topic_number:03d}.pdf"
    if dry_run:
        return rep, blob_path
    db.put_object("notes", blob_path, path.read_bytes(), "application/pdf")
    db.update("topic", {"id": f"eq.{topic['id']}"}, {"note_path": blob_path, "note_pages": rep.pages})
    return rep, blob_path
