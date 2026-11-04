from pathlib import Path

from govtimport.parser import parse_file, parse_text

SAMPLES = Path(__file__).resolve().parents[1] / "samples"

GOOD = """---
subject: English
topic: 2
---

### Q1. What is it?

- A. one
- B. two
  continued here
- C. three
- D. four

**Answer:** b

**Reason:** Because.

**Page:** 7
"""


def one(text: str):
    pf = parse_text(text, "t.md")
    assert len(pf.questions) == 1, pf.errors
    return pf, pf.questions[0]


def test_samples_parse_cleanly():
    for name, count in (("english_sample.md", 4), ("bangla_sample.md", 4), ("math_sample.md", 4)):
        pf = parse_file(SAMPLES / name)
        assert not pf.errors
        assert len(pf.questions) == count
        assert all(not q.errors for q in pf.questions), [q.errors for q in pf.questions]


def test_fields_and_continuation():
    pf, q = one(GOOD)
    assert (pf.subject, pf.topic, pf.lang) == ("English", 2, "en")
    assert q.answer == "B"  # case is normalised
    assert q.options["B"] == "two continued here"
    assert q.page == 7 and q.reason == "Because." and not q.errors


def test_multiline_reason_and_overrides():
    pf = parse_file(SAMPLES / "math_sample.md")
    assert "(x-2)(x-3)" in pf.questions[3].reason and "\n" in pf.questions[3].reason
    bn = parse_file(SAMPLES / "bangla_sample.md")
    assert bn.lang == "bn" and bn.questions[2].lang == "en"


def test_missing_pieces_are_reported():
    _, q = one(GOOD.replace("**Answer:** b\n", ""))
    assert any("Answer" in e for e in q.errors)
    _, q = one(GOOD.replace("- D. four\n", ""))
    assert any("missing D" in e for e in q.errors)
    _, q = one(GOOD.replace("**Page:** 7\n", ""))
    assert any("Page" in e for e in q.errors)
    _, q = one(GOOD.replace("**Reason:** Because.", "**Reason:**"))
    assert any("Reason" in e for e in q.errors)
    _, q = one(GOOD.replace("**Answer:** b", "**Answer:** E"))
    assert any("Answer" in e for e in q.errors)


def test_bad_options():
    _, q = one(GOOD.replace("- D. four", "- D. four\n- E. five"))
    assert any("not allowed" in e for e in q.errors)
    _, q = one(GOOD.replace("- D. four", "- D. one"))
    assert any("same text" in e for e in q.errors)
    _, q = one(GOOD.replace("- C. three", "- B. three"))
    assert any("twice" in e for e in q.errors)


def test_page_must_be_a_number():
    _, q = one(GOOD.replace("**Page:** 7", "**Page:** n/a"))
    assert any("Page" in e for e in q.errors)


def test_duplicate_question_numbers_and_stray_text():
    pf = parse_text(GOOD + "\n---\n\n" + GOOD.split("---\n\n", 1)[1], "t.md")
    assert any("appears twice" in e for e in pf.errors)
    _, q = one(GOOD + "\nstray words after the page\n")
    assert any("unexpected" in e for e in q.errors)


def test_header_is_required_and_checked():
    assert any("header" in e for e in parse_text("### Q1. x\n", "t.md").errors)
    assert any("lang" in e for e in parse_text(GOOD.replace("topic: 2", "topic: 2\nlang: fr"), "t.md").errors)
    assert any("topic" in e for e in parse_text(GOOD.replace("topic: 2", "topic: abc"), "t.md").errors)
    assert any("no questions" in e for e in parse_text("---\nsubject: English\n---\n", "t.md").errors)


def test_encoding(tmp_path):
    f = tmp_path / "latin.md"
    f.write_bytes(GOOD.replace("Because", "Café").encode("latin-1"))
    assert any("UTF-8" in e for e in parse_file(f).errors)
    f.write_bytes(b"\xef\xbb\xbf" + GOOD.encode("utf-8"))  # a BOM is fine
    assert not parse_file(f).errors
    f.write_bytes(GOOD.replace("Because", "Bad � char").encode("utf-8"))
    assert any("U+FFFD" in e for e in parse_file(f).errors)
    f.write_bytes(GOOD.replace("Because", "à¦¬").encode("utf-8"))
    assert any("garbled" in e for e in parse_file(f).errors)


def test_windows_line_endings(tmp_path):
    f = tmp_path / "crlf.md"
    f.write_bytes(GOOD.replace("\n", "\r\n").encode("utf-8"))
    pf = parse_file(f)
    assert not pf.errors and not pf.questions[0].errors
