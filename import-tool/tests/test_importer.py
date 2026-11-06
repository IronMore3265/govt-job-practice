from pathlib import Path

import pytest

from govtimport import importer
from govtimport.checks import check_files
from govtimport.parser import parse_file, parse_text
from tests.fakes import FakeDB

SAMPLES = Path(__file__).resolve().parents[1] / "samples"


@pytest.fixture
def db():
    d = FakeDB()
    for name in ("English", "Bangla", "Mathematics"):
        d.add_topic(d.add_subject(name), 1)
    return d


def load(*names):
    files = [parse_file(SAMPLES / n) for n in names]
    check_files(files)
    assert not [e for f in files for q in f.questions for e in q.errors]
    return files


def test_import_writes_drafts_with_options(db):
    out = importer.run(db, load("english_sample.md"))
    assert (out.imported, out.skipped, out.errors) == (4, 0, [])
    qs = db.tables["question"]
    assert len(qs) == 4 and {q["status"] for q in qs} == {"draft"} and {q["origin"] for q in qs} == {"import"}
    opts = [o for o in db.tables["mcq_option"] if o["question_id"] == qs[0]["id"]]
    assert [o["label"] for o in opts] == list("ABCD")
    correct = [o for o in opts if o["is_correct"]]
    assert len(correct) == 1 and correct[0]["label"] == "B" and correct[0]["explanation"]
    assert all(o["explanation"] is None for o in opts if not o["is_correct"])
    assert qs[0]["source_page"] == 12 and qs[0]["lang"] == "en"


def test_running_twice_skips_existing(db):
    importer.run(db, load("english_sample.md"))
    out = importer.run(db, load("english_sample.md"))
    assert (out.imported, out.skipped) == (0, 4)
    assert len(db.tables["question"]) == 4


def test_approve_flag(db):
    out = importer.run(db, load("math_sample.md"), approve=True)
    assert out.approved == 4 and {q["status"] for q in db.tables["question"]} == {"approved"}


def test_dry_run_writes_nothing(db):
    out = importer.run(db, load("english_sample.md"), dry_run=True)
    assert out.imported == 4 and db.tables["question"] == [] and db.tables["mcq_option"] == []


def test_bangla_survives_the_round_trip(db):
    files = load("bangla_sample.md")
    importer.run(db, files)
    sent = {q.text for q in files[0].questions}
    assert {q["text"] for q in db.tables["question"]} == sent  # byte for byte, conjuncts and all
    assert any("জ্ঞ" in q["text"] or "স্ব" in q["text"] for q in db.tables["question"])
    assert {q["lang"] for q in db.tables["question"]} == {"bn", "en"}


def test_lost_characters_roll_the_question_back(db):
    db.mangle = lambda s: "".join("?" if ord(c) > 0x900 else c for c in s)
    out = importer.run(db, load("bangla_sample.md"))
    assert out.errors and "different text" in out.errors[0]
    assert db.tables["question"] == [] and db.tables["mcq_option"] == []


def test_a_failed_option_insert_leaves_no_question(db):
    db.fail_options = True
    out = importer.run(db, load("english_sample.md"))
    assert out.errors and db.tables["question"] == []


def test_unknown_subject_or_topic_blocks_everything(db):
    pf = parse_text(Path(SAMPLES / "english_sample.md").read_text(encoding="utf-8").replace("topic: 1", "topic: 7"), str(SAMPLES / "english_sample.md"))
    out = importer.run(db, [pf])
    assert out.errors and "no topic 7" in out.errors[0] and "Add it in Admin" in out.errors[0]
    assert db.tables["question"] == []
    pf = parse_text(Path(SAMPLES / "english_sample.md").read_text(encoding="utf-8").replace("subject: English", "subject: Physics"), "x.md")
    assert "subject 'Physics' not found" in importer.run(db, [pf]).errors[0]


def test_figure_is_stored_once_and_linked(db, tmp_path):
    (tmp_path / "figures").mkdir()
    (tmp_path / "figures" / "table 1.png").write_bytes(b"\x89PNG-data")
    text = Path(SAMPLES / "english_sample.md").read_text(encoding="utf-8")
    shared = "\n**Figure:** table 1.png | Table 1, page 12\n"
    text = text.replace("**Page:** 12\n", "**Page:** 12\n" + shared).replace("**Page:** 14\n", "**Page:** 14\n" + shared)
    md = tmp_path / "f.md"
    md.write_text(text, encoding="utf-8")
    pf = parse_file(md)
    check_files([pf])
    assert not [e for q in pf.questions for e in q.errors]
    out = importer.run(db, [pf])
    assert not out.errors and out.figures_used == 1
    assert len(db.tables["figure"]) == 1 and len(db.objects) == 1
    (bucket, path), = db.objects
    assert bucket == "figures" and path.startswith("english/001/") and path.endswith("-table-1.png")
    fig = db.tables["figure"][0]
    assert fig["caption"] == "Table 1, page 12" and fig["page"] == 12
    linked = [q["figure_id"] for q in db.tables["question"]]
    assert linked[:2] == [fig["id"], fig["id"]] and linked[2:] == [None, None]


def test_slugify():
    assert importer.slugify("General Knowledge") == "general-knowledge"
    assert importer.slugify("বাংলা") == ""


def test_five_and_three_options_are_imported(db):
    text = """---
subject: Mathematics
topic: 1
---

### Q1. Five options?

- A. one
- B. two
- C. three
- D. four
- E. five

**Answer:** E

**Reason:** Because five.

**Page:** 3

---

### Q2. Three options?

- A. one
- B. two
- C. three

**Answer:** C

**Reason:** Because three.

**Page:** 4
"""
    pf = parse_text(text, "m.md")
    check_files([pf])
    assert not [e for q in pf.questions for e in q.errors]
    out = importer.run(db, [pf])
    assert (out.imported, out.errors) == (2, [])
    qs = db.tables["question"]
    for q, labels, key in zip(qs, ("ABCDE", "ABC"), ("E", "C")):
        opts = [o for o in db.tables["mcq_option"] if o["question_id"] == q["id"]]
        assert [o["label"] for o in opts] == list(labels)
        assert [o["label"] for o in opts if o["is_correct"]] == [key]
