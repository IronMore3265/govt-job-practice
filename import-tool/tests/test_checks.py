import shutil

import pytest

from govtimport.checks import KATEX, check_files, split_math
from govtimport.parser import parse_text

HEAD = "---\nsubject: Mathematics\ntopic: 1\n---\n\n"


def q(text="Q", a="one", reason="Because.", extra="", lang=None, header=HEAD):
    body = f"### Q1. {text}\n\n- A. {a}\n- B. two\n- C. three\n- D. four\n\n**Answer:** A\n\n**Reason:** {reason}\n\n**Page:** 1\n{extra}"
    pf = parse_text(header + body, "t.md")
    if lang:
        pf.lang = lang
    return pf


def errors(pf, **kw):
    check_files([pf], **kw)
    return pf.questions[0].errors


def test_split_math_mirrors_the_site():
    assert split_math("a $x$ b $$y$$") == (["x", "y"], [])
    assert split_math(r"costs \$5 and \$6") == ([], [])
    assert split_math("only $ one")[1] == [5]
    assert split_math("a $$$$ b") == ([], [2])  # an empty pair draws nothing, so it is flagged


def test_unclosed_dollar_is_an_error():
    assert any("not closed" in e for e in errors(q(text="costs $5 today")))
    assert not errors(q(text=r"costs \$5 today"))


needs_node = pytest.mark.skipif(not (shutil.which("node") and KATEX.exists()), reason="node and app/node_modules/katex are needed")


@needs_node
def test_latex_is_parsed_by_katex():
    assert not errors(q(text=r"What is $\frac{1}{2}$?"))
    assert any("does not parse" in e for e in errors(q(text=r"What is $\frac{1$?")))
    assert any("does not parse" in e for e in errors(q(reason=r"Use $\notacommand{3}$")))


def test_bangla_checks():
    bn = "বাংলা"
    assert not errors(q(text=bn, lang="bn"))
    assert any("no Bangla letters" in e for e in errors(q(text="????", lang="bn")))
    pf = q(text=bn)
    check_files([pf])
    assert any("lang is en" in w for w in pf.questions[0].warnings)
    pf = q(reason="স্ ")
    check_files([pf])
    assert any("hasanta" in w for w in pf.questions[0].warnings)


def test_length_limits():
    assert any("limit is 4000" in e for e in errors(q(text="x" * 4001)))
    assert any("limit is 1000" in e for e in errors(q(a="y" * 1001)))
    assert any("limit is 2000" in e for e in errors(q(reason="z" * 2001)))


def test_figures(tmp_path):
    assert any("not found" in e for e in errors(q(extra="\n**Figure:** a.png\n"), figures_dir=tmp_path))
    (tmp_path / "a.png").write_bytes(b"\x89PNG" + b"0" * 10)
    assert not errors(q(extra="\n**Figure:** a.png | Table 1\n"), figures_dir=tmp_path)
    assert any(".png, .jpg" in e for e in errors(q(extra="\n**Figure:** a.gif\n"), figures_dir=tmp_path))
    (tmp_path / "big.png").write_bytes(b"0" * (5 * 1024 * 1024 + 1))
    assert any("limit" in e for e in errors(q(extra="\n**Figure:** big.png\n"), figures_dir=tmp_path))


def test_topic_can_come_from_the_question():
    no_topic = "---\nsubject: English\n---\n\n"
    assert any("no topic" in e for e in errors(q(header=no_topic)))
    assert not errors(q(header=no_topic, extra="\n**Topic:** 3\n"))
