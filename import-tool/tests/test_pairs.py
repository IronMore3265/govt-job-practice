"""question.md + answer.md input."""
import pytest

from govtimport import importer
from govtimport.__main__ import expand, load
from govtimport.pairs import load_pair
from tests.fakes import FakeDB

Q = """---
subject: Bangla
topic: 1
lang: bn
---

# শিরোনাম

## অধ্যায় ১

### Q1. বাংলা লিপির উৎস কী?

- A. সংস্কৃত
- B. ব্রাহ্মী লিপি

- C. আরবি লিপি
- D. চীনা লিপি

---

### Q2. কোন সম্রাট শাসনমালা উৎকীর্ণ করান?

- A. অশোক
- B. আকবর
- C. বাবর
- D. জাহাঙ্গীর
"""

A = """# উত্তর

**দ্রুত উত্তরমালা**

1-B  2-A

---

## অধ্যায় ১

### Q1. বাংলা লিপির উৎস কী?

**উত্তর:** B. ব্রাহ্মী লিপি

**ব্যাখ্যা:** বাংলা লিপি ব্রাহ্মী থেকে এসেছে।
দ্বিতীয় লাইন।

**পৃষ্ঠা:** 7

**উৎস:** বিগত পরীক্ষা

---

### Q2. কোন সম্রাট শাসনমালা উৎকীর্ণ করান?

**উত্তর:** A

**ব্যাখ্যা:** অশোক।

**পৃষ্ঠা:** 7

**উৎস:** নতুন প্রশ্ন
"""


def write(tmp_path, q=Q, a=A):
    (tmp_path / "question.md").write_text(q, encoding="utf-8")
    (tmp_path / "answer.md").write_text(a, encoding="utf-8")
    return tmp_path / "question.md", tmp_path / "answer.md"


def errors(pf):
    return pf.errors + [e for q in pf.questions for e in q.errors]


def test_pair_merges_answers_reasons_and_pages(tmp_path):
    pf = load_pair(*write(tmp_path))
    assert not errors(pf), errors(pf)
    assert (pf.subject, pf.topic, pf.lang) == ("Bangla", 1, "bn")
    q1, q2 = pf.questions
    assert (q1.answer, q1.page) == ("B", 7)
    assert q1.reason == "বাংলা লিপি ব্রাহ্মী থেকে এসেছে।\nদ্বিতীয় লাইন।"
    assert q2.answer == "A"  # a bare letter is fine
    assert sorted(q1.options) == ["A", "B", "C", "D"]


def test_missing_answer_and_extra_answer(tmp_path):
    pf = load_pair(*write(tmp_path, a=A.split("### Q2.")[0]))
    assert any("no answer for Q2" in e for e in errors(pf))
    extra = A + "\n---\n\n### Q3. अतिरिक्त?\n\n**উত্তর:** A\n\n**ব্যাখ্যা:** x\n\n**পৃষ্ঠা:** 1\n"
    pf = load_pair(*write(tmp_path, a=extra))
    assert any("has Q3 but question.md does not" in e for e in errors(pf))


def test_answer_text_must_match_the_option(tmp_path):
    bad = A.replace("**উত্তর:** B. ব্রাহ্মী লিপি", "**উত্তর:** B. সংস্কৃত")
    pf = load_pair(*write(tmp_path, a=bad))
    assert any("option B" in e for e in errors(pf))


def test_files_out_of_step_are_caught(tmp_path):
    bad = A.replace("বাংলা লিপির উৎস কী?", "অন্য প্রশ্ন?", 1)
    pf = load_pair(*write(tmp_path, a=bad))
    assert any("differs from question.md" in e for e in errors(pf))


def test_missing_reason_or_page_is_an_error(tmp_path):
    bad = A.replace("**পৃষ্ঠা:** 7\n\n**উৎস:** নতুন প্রশ্ন", "")
    pf = load_pair(*write(tmp_path, a=bad))
    assert any("Page" in e for e in errors(pf))


def test_english_field_names_also_work(tmp_path):
    a = A.replace("**উত্তর:**", "**Answer:**").replace("**ব্যাখ্যা:**", "**Reason:**").replace("**পৃষ্ঠা:**", "**Page:**")
    pf = load_pair(*write(tmp_path, a=a))
    assert not errors(pf), errors(pf)


def test_folder_is_one_pair_and_other_md_files_are_ignored(tmp_path):
    write(tmp_path)
    (tmp_path / "import.md").write_text("junk", encoding="utf-8")
    units = expand([str(tmp_path)])
    assert units == [(tmp_path / "question.md", tmp_path / "answer.md")]
    assert expand([str(tmp_path / "answer.md")]) == units  # naming either file means the pair
    assert expand([str(tmp_path / "question.md")]) == units


def test_answer_without_question_file_stops(tmp_path):
    (tmp_path / "answer.md").write_text(A, encoding="utf-8")
    with pytest.raises(SystemExit):
        expand([str(tmp_path / "answer.md")])


def test_import_of_a_pair_writes_questions_with_explanations(tmp_path):
    write(tmp_path)
    files, n_err = load([str(tmp_path)], None)
    assert n_err == 0
    db = FakeDB()
    db.add_topic(db.add_subject("Bangla"), 1)
    out = importer.run(db, files)
    assert (out.imported, out.errors) == (2, [])
    options = db.tables["mcq_option"]
    right = [o for o in options if o["is_correct"]]
    assert len(options) == 8 and len(right) == 2
    assert {o["explanation"] for o in right} == {"বাংলা লিপি ব্রাহ্মী থেকে এসেছে।\nদ্বিতীয় লাইন।", "অশোক।"}
    assert db.tables["question"][0]["source_page"] == 7
