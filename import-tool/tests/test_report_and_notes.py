import pytest

from govtimport import notes, report
from govtimport.report import ExamLine
from tests.fakes import FakeDB


def test_split_the_pool_into_sets():
    assert ExamLine.split(34, 20) == (1, 14, 6)
    assert ExamLine.split(40, 20) == (2, 0, 0)
    assert ExamLine.split(0, 20) == (0, 0, 20)
    assert ExamLine.split(19, 20) == (0, 19, 1)


def question(db, topic, status, n=1):
    for _ in range(n):
        db.tables["question"].append({"id": f"q{len(db.tables['question'])}", "topic_id": topic["id"], "status": status})


def test_short_set_report():
    db = FakeDB()
    s = db.add_subject("English")
    t1, t2, t3 = db.add_topic(s, 1), db.add_topic(s, 2), db.add_topic(s, 3)
    db.add_exam("English Model Test", [t1, t2])
    db.add_exam("Full Test", [t3])
    db.add_exam("Empty Test", [])
    question(db, t1, "approved", 20)
    question(db, t2, "approved", 14)
    question(db, t2, "draft", 6)
    question(db, t3, "approved", 40)
    lines = {line.name: line for line in report.short_sets(db)}
    short = lines["English Model Test"]
    assert (short.approved, short.drafts, short.missing) == (34, 6, 6)
    assert "last set has 14 of 20, needs 6 more" in short.describe()
    assert "enough if all are approved" in short.describe()
    assert lines["Full Test"].missing == 0 and "last set is full" in lines["Full Test"].describe()
    assert "no topics linked" in lines["Empty Test"].describe()
    only = report.short_sets(db, {t3["id"]})
    assert [line.name for line in only] == ["Full Test"]


def make_pdf(pages=2, text="Hello notes page with enough words to count as text"):
    """A tiny valid text PDF (standard Helvetica, so no embedding is needed)."""
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", f"<< /Type /Pages /Kids [{' '.join(f'{3 + 2 * i} 0 R' for i in range(pages))}] /Count {pages} >>"]
    font = 3 + 2 * pages
    for i in range(pages):
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents {4 + 2 * i} 0 R /Resources << /Font << /F1 {font} 0 R >> >> >>")
        stream = f"BT /F1 12 Tf 20 200 Td ({text} {i}) Tj ET"
        objs.append(f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream")
    objs.append("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    out, offsets = b"%PDF-1.4\n", []
    for n, body in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{n} 0 obj\n{body}\nendobj\n".encode()
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode() + b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    return out + f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()


def test_pdf_checks(tmp_path):
    ok = tmp_path / "ok.pdf"
    ok.write_bytes(make_pdf(3))
    rep = notes.check_pdf(ok)
    assert not rep.errors and not rep.warnings and rep.pages == 3
    fake = tmp_path / "fake.pdf"
    fake.write_text("hello")
    assert notes.check_pdf(fake).errors
    blank = tmp_path / "blank.pdf"
    blank.write_bytes(make_pdf(1, text=" "))
    assert any("selectable text" in w for w in notes.check_pdf(blank).warnings)
    assert notes.check_pdf(tmp_path / "missing.pdf").errors


def test_pdf_size_limits(tmp_path, monkeypatch):
    f = tmp_path / "ok.pdf"
    f.write_bytes(make_pdf(1))
    monkeypatch.setattr(notes, "WARN_BYTES", 100)
    assert any("10 MB target" in w for w in notes.check_pdf(f).warnings)
    monkeypatch.setattr(notes, "MAX_BYTES", 100)
    assert any("15 MB" in e for e in notes.check_pdf(f).errors)


def test_upload_note_links_the_topic(tmp_path):
    db = FakeDB()
    topic = db.add_topic(db.add_subject("General Knowledge"), 4)
    f = tmp_path / "n.pdf"
    f.write_bytes(make_pdf(5))
    rep, path = notes.upload_note(db, "general knowledge", 4, f)
    assert path == "general-knowledge/004.pdf" and rep.pages == 5
    assert ("notes", path) in db.objects
    row = db.tables["topic"][0]
    assert row["id"] == topic["id"] and row["note_path"] == path and row["note_pages"] == 5
    _, dry = notes.upload_note(db, "General Knowledge", 4, f, dry_run=True)
    assert dry == path
    with pytest.raises(LookupError):
        notes.upload_note(db, "General Knowledge", 9, f)


def test_bangla_subject_gets_an_ascii_path(tmp_path):
    db = FakeDB()
    subject = db.add_subject("বাংলা")
    db.add_topic(subject, 1)
    f = tmp_path / "n.pdf"
    f.write_bytes(make_pdf(1))
    _, path = notes.upload_note(db, "বাংলা", 1, f)
    assert path == f"{subject['id'][:8]}/001.pdf"
